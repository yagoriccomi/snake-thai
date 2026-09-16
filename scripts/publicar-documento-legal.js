#!/usr/bin/env node
/**
 * Gera a migration que publica uma versão APROVADA da Política de Privacidade
 * ou dos Termos de Uso, a partir do arquivo em docs/legal/.
 *
 *   npm run legal:publicar -- politica 1.0
 *   npm run legal:publicar -- termos 1.0
 *
 * Só gera o arquivo: nada vai ao banco. A migration segue o caminho de todas
 * (scripts\db-dev test, PR e, com aprovação, scripts\db-push-prod.bat). Copiar
 * o texto à mão para o SQL arriscaria publicar uma versão diferente da aprovada.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/** Documento de cada apelido: tipo no banco e arquivo do texto. */
const DOCUMENTOS = {
  politica: { tipo: 'privacy_policy', arquivo: 'docs/legal/POLITICA-DE-PRIVACIDADE.md' },
  termos: { tipo: 'terms_of_use', arquivo: 'docs/legal/TERMOS-DE-USO.md' },
};

const MARCADOR_DE_RASCUNHO = '[PREENCHER';
const VERSAO_VALIDA = /^[0-9A-Za-z][0-9A-Za-z.\-]{0,39}$/;

/**
 * Confere se o texto pode ser publicado.
 * @param {string} versao Versão escolhida (ex.: "1.0").
 * @param {string} conteudo Texto do documento.
 * @returns {string[]} Problemas encontrados; vazio quando está pronto.
 */
function problemasDaPublicacao(versao, conteudo) {
  const problemas = [];
  if (!VERSAO_VALIDA.test(versao)) {
    problemas.push('Versão inválida: use letras, números, ponto ou hífen (ex.: 1.0).');
  }
  if (conteudo.trim() === '') {
    problemas.push('O documento está vazio.');
  }
  const pendentes = conteudo.split('\n').filter((linha) => linha.includes(MARCADOR_DE_RASCUNHO)).length;
  if (pendentes > 0) {
    problemas.push(`O texto ainda tem ${pendentes} linha(s) com ${MARCADOR_DE_RASCUNHO}: …]. Preencha antes de publicar.`);
  }
  return problemas;
}

/**
 * Delimitador de string do Postgres que não aparece no texto, para o conteúdo
 * entrar literal (sem escapar aspas).
 * @param {string} conteudo
 * @returns {string}
 */
function delimitadorLivre(conteudo) {
  let indice = 0;
  let delimitador = '$texto$';
  while (conteudo.includes(delimitador)) {
    indice += 1;
    delimitador = `$texto${indice}$`;
  }
  return delimitador;
}

/**
 * Monta o SQL da migration.
 * @param {{ tipo: string, versao: string, conteudo: string }} documento
 * @returns {string}
 */
function montarMigration({ tipo, versao, conteudo }) {
  const delimitador = delimitadorLivre(conteudo);
  const texto = conteudo.replace(/\r\n/g, '\n').trimEnd();
  return [
    `-- Publica ${tipo} versão ${versao} (gerado por scripts/publicar-documento-legal.js).`,
    '-- O texto é o aprovado em docs/legal/. Documento publicado não muda: para',
    '-- corrigir, publique outra versão. Todos os usuários serão chamados a aceitar.',
    `select public.publicar_documento_legal('${tipo}', '${versao}', ${delimitador}${texto}\n${delimitador});`,
    '',
  ].join('\n');
}

/**
 * Nome do arquivo no padrão da CLI da Supabase (carimbo UTC).
 * @param {string} tipo
 * @param {string} versao
 * @param {Date} agora
 * @returns {string}
 */
function nomeDaMigration(tipo, versao, agora) {
  const carimbo = agora.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const sufixo = versao.replace(/[^0-9A-Za-z]+/g, '_');
  return `${carimbo}_publicar_${tipo}_${sufixo}.sql`;
}

function principal(argumentos) {
  const [apelido, versao] = argumentos;
  const documento = DOCUMENTOS[apelido];
  if (documento === undefined || versao === undefined) {
    console.error('Uso: npm run legal:publicar -- <politica|termos> <versão>');
    return 1;
  }
  const conteudo = fs.readFileSync(path.join(RAIZ, documento.arquivo), 'utf8');
  const problemas = problemasDaPublicacao(versao, conteudo);
  if (problemas.length > 0) {
    problemas.forEach((problema) => console.error(`✗ ${problema}`));
    return 1;
  }
  const arquivo = path.join(RAIZ, 'supabase', 'migrations', nomeDaMigration(documento.tipo, versao, new Date()));
  fs.writeFileSync(arquivo, montarMigration({ tipo: documento.tipo, versao, conteudo }), 'utf8');
  console.log(`Migration criada: ${path.relative(RAIZ, arquivo)}`);
  console.log('Próximo passo: scripts\\db-dev test, PR e publicação conforme docs/legal/README.md.');
  return 0;
}

if (require.main === module) {
  process.exitCode = principal(process.argv.slice(2));
}

module.exports = { problemasDaPublicacao, montarMigration, nomeDaMigration, delimitadorLivre };
