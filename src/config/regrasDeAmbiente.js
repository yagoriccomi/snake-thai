// @ts-check
'use strict';

/**
 * Regras que impedem o app de falar com o ambiente errado.
 *
 * Um arquivo só, em CommonJS, porque é lido em DOIS lugares que precisam
 * concordar: no build (app.config.js e scripts/with-variant.js, em Node) e em
 * tempo de execução (src/config/env.ts, no aparelho). Duas cópias da regra
 * divergiriam em silêncio — e o erro que ela evita é gravar dado de teste em
 * produção, ou o contrário. [#6][#81]
 */

/** Variantes aceitas. `production` é o app das pessoas; `development`, o "DEV Snake Thai". */
const VARIANTES = Object.freeze(['development', 'production']);

/** Variante usada quando nada é informado: nunca cair num banco de teste sem querer. */
const VARIANTE_PADRAO = 'production';

/**
 * Extrai protocolo e host de uma URL sem depender de `URL`, que o Hermes do
 * React Native não implementa por completo.
 *
 * @param {string} url
 * @returns {{ protocolo: string, host: string } | null}
 */
function partesDaUrl(url) {
  const encontrado = /^(https?):\/\/([^/:?#]+)/i.exec(url.trim());
  if (encontrado === null) {
    return null;
  }
  return { protocolo: encontrado[1].toLowerCase(), host: encontrado[2].toLowerCase() };
}

/**
 * O host é desta máquina ou da rede local? Inclui o 10.0.2.2, que é o
 * computador visto de dentro do emulador Android.
 *
 * @param {string} host
 * @returns {boolean}
 */
function hostLocal(host) {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Confere se as URLs combinam com a variante.
 *
 * - `production`: Supabase e API com https e host público.
 * - `development`: Supabase e API só em host local.
 *
 * @param {{ variante: string, supabaseUrl: string, apiUrl?: string | null }} entrada
 * @returns {string | null} A explicação do problema, ou `null` se está tudo certo.
 */
function problemaDeAmbiente({ variante, supabaseUrl, apiUrl }) {
  if (!VARIANTES.includes(variante)) {
    return `Variante "${variante}" desconhecida. Use ${VARIANTES.join(' ou ')}.`;
  }

  const enderecos = [['EXPO_PUBLIC_SUPABASE_URL', supabaseUrl]];
  if (apiUrl !== undefined && apiUrl !== null && apiUrl.trim() !== '') {
    enderecos.push(['EXPO_PUBLIC_API_URL', apiUrl]);
  }

  for (const [nome, url] of enderecos) {
    const partes = partesDaUrl(url);
    if (partes === null) {
      return `${nome} não é uma URL http(s) válida.`;
    }
    const local = hostLocal(partes.host);
    if (variante === 'production' && (local || partes.protocolo !== 'https')) {
      return `${nome} aponta para um endereço local ou sem https, mas este é o app de PRODUÇÃO.`;
    }
    if (variante === 'development' && !local) {
      return `${nome} aponta para um servidor da internet, mas este é o app DEV: ele só pode usar o banco local.`;
    }
  }
  return null;
}

module.exports = { VARIANTES, VARIANTE_PADRAO, problemaDeAmbiente };
