#!/usr/bin/env node
/**
 * Leva o texto de docs/legal/ para o banco como MODELO (`legal_templates`),
 * gerando uma migration. O texto continua sendo revisado em PR: o que o banco
 * publica é sempre o que passou por revisão.
 *
 *   npm run legal:modelo -- politica
 *   npm run legal:modelo -- termos
 *
 * Os campos que só a academia sabe ficam como marcadores `{{chave}}` e são
 * preenchidos pelo admin no app (tela "Dados dos termos"). A substituição
 * acontece no banco, na hora de publicar.
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

const MARCADOR = /\{\{([a-z0-9_]+)\}\}/g;
const RASCUNHO_ANTIGO = '[PREENCHER';

/**
 * Confere se o texto pode virar modelo.
 * @param {string} conteudo
 * @returns {string[]} Problemas encontrados; vazio quando está pronto.
 */
function problemasDoModelo(conteudo) {
  const problemas = [];
  if (conteudo.trim() === '') {
    problemas.push('O documento está vazio.');
  }
  if (conteudo.includes(RASCUNHO_ANTIGO)) {
    problemas.push(`O texto ainda tem ${RASCUNHO_ANTIGO}: …]. Troque por um marcador {{chave}}.`);
  }
  const soltos = conteudo.match(/\{\{[^}]*\}\}/g) ?? [];
  const invalidos = soltos.filter((marcador) => !/^\{\{[a-z0-9_]+\}\}$/.test(marcador));
  if (invalidos.length > 0) {
    problemas.push(`Marcador fora do formato {{chave}}: ${invalidos.join(', ')}.`);
  }
  return problemas;
}

/** Chaves usadas no texto, sem repetição e em ordem. */
function chavesDoModelo(conteudo) {
  return [...new Set([...conteudo.matchAll(MARCADOR)].map((m) => m[1]))].sort();
}

/**
 * Delimitador de string do Postgres que não aparece no texto.
 * @param {string} conteudo
 * @returns {string}
 */
function delimitadorLivre(conteudo) {
  let indice = 0;
  let delimitador = '$modelo$';
  while (conteudo.includes(delimitador)) {
    indice += 1;
    delimitador = `$modelo${indice}$`;
  }
  return delimitador;
}

/**
 * Monta o SQL da migration que grava o modelo.
 * @param {{ tipo: string, conteudo: string }} documento
 * @returns {string}
 */
function montarMigration({ tipo, conteudo }) {
  const texto = conteudo.replace(/\r\n/g, '\n').trimEnd();
  const delimitador = delimitadorLivre(texto);
  const chaves = chavesDoModelo(texto);
  return [
    `-- Modelo de ${tipo} (gerado por scripts/sincronizar-modelo-legal.js).`,
    '-- O texto é o de docs/legal/. Campos da academia ficam como {{chave}} e são',
    '-- preenchidos pelo admin no app; a substituição acontece ao publicar.',
    `-- Marcadores: ${chaves.join(', ')}`,
    '',
    `insert into public.legal_templates (kind, body)`,
    `values ('${tipo}', ${delimitador}${texto}\n${delimitador})`,
    'on conflict (kind) do update set body = excluded.body, updated_at = now();',
    '',
  ].join('\n');
}

/**
 * Nome do arquivo no padrão da CLI da Supabase (carimbo UTC).
 * @param {string} tipo
 * @param {Date} agora
 * @returns {string}
 */
function nomeDaMigration(tipo, agora) {
  const carimbo = agora.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${carimbo}_modelo_${tipo}.sql`;
}

function principal(argumentos) {
  const [apelido] = argumentos;
  const documento = DOCUMENTOS[apelido];
  if (documento === undefined) {
    console.error('Uso: npm run legal:modelo -- <politica|termos>');
    return 1;
  }
  const conteudo = fs.readFileSync(path.join(RAIZ, documento.arquivo), 'utf8');
  const problemas = problemasDoModelo(conteudo);
  if (problemas.length > 0) {
    problemas.forEach((problema) => console.error(`✗ ${problema}`));
    return 1;
  }
  const arquivo = path.join(RAIZ, 'supabase', 'migrations', nomeDaMigration(documento.tipo, new Date()));
  fs.writeFileSync(arquivo, montarMigration({ tipo: documento.tipo, conteudo }), 'utf8');
  console.log(`Migration criada: ${path.relative(RAIZ, arquivo)}`);
  console.log(`Marcadores no texto: ${chavesDoModelo(conteudo).join(', ')}`);
  return 0;
}

if (require.main === module) {
  process.exitCode = principal(process.argv.slice(2));
}

module.exports = { problemasDoModelo, chavesDoModelo, montarMigration, nomeDaMigration, delimitadorLivre };
