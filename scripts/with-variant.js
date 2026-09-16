#!/usr/bin/env node
/**
 * Roda um comando com o ambiente da variante escolhida.
 *
 *   node scripts/with-variant.js dev  -- npx expo start --port 6969
 *   node scripts/with-variant.js prod -- npx expo prebuild --platform android
 *
 * Carrega .env.dev (DEV Snake Thai, banco local) ou .env.prod (produção),
 * define APP_VARIANT e EXPO_PUBLIC_APP_VARIANT e desliga a leitura automática
 * de .env do Expo (EXPO_NO_DOTENV). Assim um único caminho decide para onde o
 * app aponta, e ele passa pela mesma trava que o app confere no boot.
 *
 * Por que não .env.development/.env.production do próprio Expo: eles seguem o
 * NODE_ENV, e o build de release do app DEV roda com NODE_ENV=production —
 * carregaria o banco de produção. [#80][#81]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { problemaDeAmbiente } = require('../src/config/regrasDeAmbiente');

const APELIDOS = Object.freeze({ dev: 'development', prod: 'production' });
const ARQUIVOS = Object.freeze({ development: '.env.dev', production: '.env.prod' });
const OBRIGATORIAS = Object.freeze(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);

/**
 * Lê um arquivo KEY=VALUE, ignorando comentários e linhas vazias e tirando
 * aspas externas. Não interpreta variáveis nem escapes: é só o formato do .env.
 *
 * @param {string} conteudo
 * @returns {Record<string, string>}
 */
function lerEnv(conteudo) {
  /** @type {Record<string, string>} */
  const valores = {};
  for (const linhaCrua of conteudo.split(/\r?\n/)) {
    const linha = linhaCrua.trim();
    if (linha === '' || linha.startsWith('#')) continue;
    const igual = linha.indexOf('=');
    if (igual <= 0) continue;
    const chave = linha.slice(0, igual).trim();
    let valor = linha.slice(igual + 1).trim();
    if (valor.length >= 2 && /^(['"]).*\1$/.test(valor)) {
      valor = valor.slice(1, -1);
    }
    valores[chave] = valor;
  }
  return valores;
}

/**
 * Monta o ambiente do comando a partir do .env da variante.
 *
 * @param {string} apelido `dev` ou `prod`
 * @param {Record<string, string>} valores conteúdo do .env já lido
 * @param {NodeJS.ProcessEnv} ambienteAtual
 * @returns {NodeJS.ProcessEnv}
 */
function montarAmbiente(apelido, valores, ambienteAtual) {
  const variante = APELIDOS[apelido];
  if (variante === undefined) {
    throw new Error(`Variante "${apelido}" desconhecida. Use dev ou prod.`);
  }
  const faltando = OBRIGATORIAS.filter((chave) => !valores[chave]);
  if (faltando.length > 0) {
    throw new Error(`${ARQUIVOS[variante]} sem: ${faltando.join(', ')}.`);
  }
  const problema = problemaDeAmbiente({
    variante,
    supabaseUrl: valores.EXPO_PUBLIC_SUPABASE_URL,
    apiUrl: valores.EXPO_PUBLIC_API_URL,
  });
  if (problema !== null) {
    throw new Error(`${ARQUIVOS[variante]}: ${problema}`);
  }
  // Os valores do arquivo vencem o shell: uma variável esquecida no terminal
  // não pode desviar o app para outro banco.
  return {
    ...ambienteAtual,
    ...valores,
    APP_VARIANT: variante,
    EXPO_PUBLIC_APP_VARIANT: variante,
    EXPO_NO_DOTENV: '1',
  };
}

function principal(argumentos) {
  const separador = argumentos.indexOf('--');
  const apelido = argumentos[0];
  const comando = separador === -1 ? [] : argumentos.slice(separador + 1);
  if (apelido === undefined || comando.length === 0) {
    console.error('Uso: node scripts/with-variant.js <dev|prod> -- <comando...>');
    return 1;
  }

  const variante = APELIDOS[apelido];
  const arquivo = path.join(__dirname, '..', variante ? ARQUIVOS[variante] : '');
  if (variante === undefined || !fs.existsSync(arquivo)) {
    const dica = apelido === 'dev' ? ' Gere com: scripts\\db-dev env' : '';
    console.error(`Arquivo de ambiente não encontrado para "${apelido}".${dica}`);
    return 1;
  }

  let ambiente;
  try {
    ambiente = montarAmbiente(apelido, lerEnv(fs.readFileSync(arquivo, 'utf8')), process.env);
  } catch (erro) {
    console.error(`[with-variant] ${erro.message}`);
    return 1;
  }

  const resultado = spawnSync(comando[0], comando.slice(1), {
    stdio: 'inherit',
    env: ambiente,
    // No Windows, npx e gradlew são .cmd/.bat e só rodam pelo shell.
    shell: process.platform === 'win32',
  });
  if (resultado.error) {
    console.error(`[with-variant] não foi possível executar: ${resultado.error.message}`);
    return 1;
  }
  return resultado.status ?? 1;
}

if (require.main === module) {
  process.exit(principal(process.argv.slice(2)));
}

module.exports = { lerEnv, montarAmbiente };
