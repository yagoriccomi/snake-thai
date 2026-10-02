#!/usr/bin/env node
/**
 * Pareia o celular com o adb do computador por QR code — o mesmo fluxo do
 * Android Studio. Usado pela opção [7] do menu.bat; dispensa digitar IP, porta
 * e código de 6 dígitos.
 *
 * Como funciona: o computador inventa um nome de serviço e uma senha e mostra
 * os dois num QR. O celular (Depuração por Wi-Fi > Parear dispositivo com QR
 * code) lê o QR e passa a anunciar na rede um serviço "_adb-tls-pairing" com
 * aquele nome. O script espera esse anúncio pelo mDNS do adb e roda o
 * `adb pair` com o endereço anunciado e a senha que ele mesmo criou.
 *
 * O desenho do QR usa o `toqr`, que já vem com o Expo CLI (é ele que desenha o
 * QR do Metro). Se um dia ele sumir, o script sai com SAIDA.SEM_QR e o menu
 * volta ao pareamento por código — nada quebra.
 *
 * O adb vem da variável ADB, que o menu.bat já resolve (PATH ou SDK).
 */
'use strict';

const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');

/** Códigos de saída que o menu.bat interpreta. */
const SAIDA = { PAREADO: 0, FALHOU: 1, TEMPO_ESGOTADO: 2, SEM_QR: 3 };

const TIPO_PAREAMENTO = '_adb-tls-pairing';
const TIPO_CONEXAO = '_adb-tls-connect';

/** Tempo para a pessoa abrir a tela certa no celular e apontar a câmera. */
const ESPERA_LEITURA_MS = 3 * 60 * 1000;
/** Depois do pareamento o celular troca para o serviço de conexão. */
const ESPERA_CONEXAO_MS = 20 * 1000;
/**
 * O adb recente conecta sozinho a aparelhos pareados. Esperar um pouco antes
 * de conectar à mão evita abrir duas conexões para o mesmo celular — origem do
 * "more than one device" que o menu.bat combate.
 */
const CARENCIA_AUTOCONEXAO_MS = 4 * 1000;
const INTERVALO_CONSULTA_MS = 1000;

/** Margem branca em volta do QR, em módulos; sem ela a câmera não acha as bordas. */
const MARGEM_QR = 4;

/**
 * Só letras minúsculas e números: o formato WIFI: do QR trata ";", ":", ","
 * e "\" como separadores, e o nome também vira nome de serviço mDNS.
 */
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * @param {number} tamanho
 * @param {(n: number) => Buffer} [aleatorio]
 */
function textoAleatorio(tamanho, aleatorio = crypto.randomBytes) {
  const bytes = aleatorio(tamanho);
  let texto = '';
  for (let i = 0; i < tamanho; i += 1) {
    texto += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return texto;
}

/**
 * Nome e senha novos a cada pareamento: o QR de ontem não serve hoje.
 *
 * @param {(n: number) => Buffer} [aleatorio]
 * @returns {{ nome: string, senha: string }}
 */
function gerarCredenciais(aleatorio = crypto.randomBytes) {
  return {
    nome: `snake-${textoAleatorio(10, aleatorio)}`,
    senha: textoAleatorio(12, aleatorio),
  };
}

/** Formato que a tela de pareamento do Android espera ler no QR. */
function montarConteudoQr({ nome, senha }) {
  return `WIFI:T:ADB;S:${nome};P:${senha};;`;
}

/**
 * Desenha o QR com meio-blocos: cada linha do terminal leva duas linhas de
 * módulos. As cores vão fixas (preto sobre branco) porque o menu.bat pinta o
 * terminal de verde no preto, e o leitor do Android não lê QR invertido.
 *
 * @param {Uint8Array} modulos matriz lado×lado, 1 = módulo escuro
 * @returns {string}
 */
function desenharQr(modulos) {
  const lado = Math.round(Math.sqrt(modulos.length));
  const total = lado + MARGEM_QR * 2;
  const escuro = (linha, coluna) => {
    const l = linha - MARGEM_QR;
    const c = coluna - MARGEM_QR;
    if (l < 0 || c < 0 || l >= lado || c >= lado) return false;
    return modulos[l * lado + c] === 1;
  };

  const PRETO_NO_BRANCO = '\x1b[30;107m';
  const RESTAURA = '\x1b[0m';
  const linhas = [];
  for (let linha = 0; linha < total; linha += 2) {
    let texto = '';
    for (let coluna = 0; coluna < total; coluna += 1) {
      const cima = escuro(linha, coluna);
      const baixo = escuro(linha + 1, coluna);
      if (cima && baixo) texto += '█';
      else if (cima) texto += '▀';
      else if (baixo) texto += '▄';
      else texto += ' ';
    }
    linhas.push(`  ${PRETO_NO_BRANCO}${texto}${RESTAURA}`);
  }
  return linhas.join('\n');
}

/**
 * Procura, na saída de `adb mdns services`, o endereço de um serviço.
 * Cada linha traz: nome, tipo e IP:porta, separados por espaço ou tab.
 *
 * @param {string} saida
 * @param {{ nome: string, tipo: string }} alvo
 * @returns {string | null} IP:porta, ou null se ainda não foi anunciado
 */
function acharServico(saida, { nome, tipo }) {
  for (const linha of saida.split(/\r?\n/)) {
    const [nomeLido, tipoLido, endereco] = linha.trim().split(/\s+/);
    if (nomeLido === nome && tipoLido?.startsWith(tipo) && endereco) {
      return endereco;
    }
  }
  return null;
}

/**
 * O `adb pair` diz "Successfully paired to IP:PORTA [guid=adb-XXXX-yyyy]".
 * O guid é o nome do serviço de conexão que o celular vai anunciar em seguida.
 *
 * @param {string} saida
 * @returns {{ pareou: boolean, guid: string | null }}
 */
function lerResultadoPareamento(saida) {
  return {
    pareou: /Successfully paired/i.test(saida),
    guid: /\[guid=([^\]\s]+)\]/.exec(saida)?.[1] ?? null,
  };
}

/**
 * Diz se `adb devices` já lista o celular conectado por Wi-Fi. A conexão
 * automática usa como serial "<guid>._adb-tls-connect._tcp".
 *
 * @param {string} saida
 * @param {string} guid
 */
function jaConectado(saida, guid) {
  return saida
    .split(/\r?\n/)
    .some((linha) => linha.startsWith(guid) && /\sdevice\s*$/.test(linha));
}

/** Resolve o toqr de onde estiver: na raiz ou aninhado no Expo CLI. */
function carregarToQr() {
  const raiz = path.join(__dirname, '..');
  const lugares = [raiz, path.join(raiz, 'node_modules', 'expo', 'node_modules', '@expo', 'cli')];
  for (const lugar of lugares) {
    try {
      return require(require.resolve('toqr', { paths: [lugar] })).toQR;
    } catch {
      // tenta o próximo lugar
    }
  }
  return null;
}

/**
 * @param {string} adb
 * @param {string[]} argumentos
 * @returns {Promise<string>} stdout + stderr; nunca rejeita
 */
function rodarAdb(adb, argumentos) {
  return new Promise((resolve) => {
    execFile(adb, argumentos, { windowsHide: true, timeout: 30 * 1000 }, (erro, stdout, stderr) => {
      resolve(`${stdout ?? ''}${stderr ?? ''}${erro && !stdout && !stderr ? erro.message : ''}`);
    });
  });
}

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Repete `consulta` até ela devolver algo diferente de null ou o prazo vencer.
 *
 * @template T
 * @param {() => Promise<T | null>} consulta
 * @param {number} prazoMs
 * @param {() => void} [aCadaVolta]
 * @returns {Promise<T | null>}
 */
async function esperar(consulta, prazoMs, aCadaVolta) {
  const fim = Date.now() + prazoMs;
  while (Date.now() < fim) {
    const resultado = await consulta();
    if (resultado !== null) return resultado;
    aCadaVolta?.();
    await dormir(INTERVALO_CONSULTA_MS);
  }
  return null;
}

/** Depois de parear, garante uma (e só uma) conexão com o celular. */
async function conectar(adb, guid) {
  let vistoEm = null;
  return esperar(async () => {
    if (jaConectado(await rodarAdb(adb, ['devices']), guid)) return 'automatica';
    const endereco = acharServico(await rodarAdb(adb, ['mdns', 'services']), {
      nome: guid,
      tipo: TIPO_CONEXAO,
    });
    if (!endereco) return null;
    vistoEm ??= Date.now();
    if (Date.now() - vistoEm < CARENCIA_AUTOCONEXAO_MS) return null;
    const saida = await rodarAdb(adb, ['connect', endereco]);
    return /connected to/i.test(saida) ? endereco : null;
  }, ESPERA_CONEXAO_MS);
}

async function principal() {
  const toQR = carregarToQr();
  if (!toQR) {
    console.log('  [!] Gerador de QR nao encontrado (pacote "toqr" do Expo).');
    console.log('      Rode "npm install" ou pareie pelo codigo de 6 digitos.');
    return SAIDA.SEM_QR;
  }

  const adb = process.env.ADB || 'adb';
  const credenciais = gerarCredenciais();

  console.log('  No celular: Opcoes do desenvolvedor > Depuracao por Wi-Fi');
  console.log('              > Parear dispositivo com QR code. Aponte para este QR:');
  console.log('');
  console.log(desenharQr(toQR(montarConteudoQr(credenciais))));
  console.log('');
  console.log('  Celular e computador precisam estar na MESMA rede Wi-Fi.');
  process.stdout.write('  Esperando o celular ler o QR');

  const enderecoPareamento = await esperar(
    async () =>
      acharServico(await rodarAdb(adb, ['mdns', 'services']), {
        nome: credenciais.nome,
        tipo: TIPO_PAREAMENTO,
      }),
    ESPERA_LEITURA_MS,
    () => process.stdout.write('.'),
  );
  console.log('');

  if (!enderecoPareamento) {
    console.log('');
    console.log('  [!] O celular nao apareceu na rede em 3 minutos.');
    console.log('      Confira se estao na mesma rede Wi-Fi e se o QR foi lido.');
    return SAIDA.TEMPO_ESGOTADO;
  }

  console.log(`  [>] QR lido. Pareando com ${enderecoPareamento}...`);
  const resultado = lerResultadoPareamento(
    await rodarAdb(adb, ['pair', enderecoPareamento, credenciais.senha]),
  );
  if (!resultado.pareou) {
    console.log('  [!] O adb recusou o pareamento. Gere um QR novo e tente de novo.');
    return SAIDA.FALHOU;
  }
  console.log('  [OK] Pareado.');

  if (!resultado.guid) {
    console.log('       Use a opcao [2] para conectar.');
    return SAIDA.PAREADO;
  }

  console.log('  [>] Conectando...');
  const conexao = await conectar(adb, resultado.guid);
  if (conexao === 'automatica') console.log('  [OK] Conectado (o adb conectou sozinho).');
  else if (conexao) console.log(`  [OK] Conectado em ${conexao}.`);
  else console.log('  [i] Pareado, mas ainda nao conectado. Use a opcao [2].');
  return SAIDA.PAREADO;
}

if (require.main === module) {
  principal().then((codigo) => {
    process.exitCode = codigo;
  });
}

module.exports = {
  SAIDA,
  gerarCredenciais,
  montarConteudoQr,
  desenharQr,
  acharServico,
  lerResultadoPareamento,
  jaConectado,
};
