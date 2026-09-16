// @ts-check
'use strict';

/**
 * Regras de versão do app, sem dependências e sem efeito colateral (exceto
 * `describeGit`, que só lê o git).
 *
 * Política (docs/VERSIONAMENTO.md): a versão só muda quando um APK é
 * publicado para os usuários. PATCH = correções; MINOR = funcionalidade nova;
 * MAJOR = um APK já instalado deixa de funcionar. O versionCode do Android é
 * derivado da versão, nunca digitado à mão. [#3][#6]
 *
 * CommonJS de propósito: é lido pelo app.config.js e pela CLI (Node), além do
 * Jest.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/** versionCode = MAJOR × 1.000.000 + MINOR × 1.000 + PATCH (1.6.0 → 1006000). */
const MULTIPLICADOR_MAJOR = 1_000_000;
const MULTIPLICADOR_MINOR = 1_000;
/** Maior valor de MINOR e PATCH que cabe na fórmula sem colidir. */
const LIMITE_DA_PARTE = 999;
/** Teto de versionCode aceito pelo Google Play. */
const LIMITE_DO_VERSION_CODE = 2_100_000_000;

const PADRAO_DA_VERSAO = /^v?(\d+)\.(\d+)\.(\d+)$/;
const PADRAO_DO_CABECALHO = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const PADRAO_DO_DESCRIBE = /^(.+)-(\d+)-g([0-9a-f]+)(-dirty)?$/;

/** @typedef {'patch' | 'minor' | 'major'} VersionPart */
/** @typedef {{ major: number, minor: number, patch: number }} ParsedVersion */
/** @typedef {{ subject: string, body?: string }} Commit */
/** @typedef {{ tag: string, commitsSinceTag: number, sha: string, dirty: boolean }} GitDescribe */

/** Ordem das partes, da menor para a maior. */
const ORDEM_DAS_PARTES = Object.freeze({ patch: 0, minor: 1, major: 2 });

/**
 * Lê "1.6.0" ou "v1.6.0".
 *
 * @param {string} texto
 * @returns {ParsedVersion}
 * @throws {Error} Fora do formato MAJOR.MINOR.PATCH.
 */
function parseVersion(texto) {
  const encontrado = PADRAO_DA_VERSAO.exec(String(texto).trim());
  if (encontrado === null) {
    throw new Error(`Versão inválida: "${texto}". Use MAJOR.MINOR.PATCH, ex.: 1.6.0.`);
  }
  return {
    major: Number(encontrado[1]),
    minor: Number(encontrado[2]),
    patch: Number(encontrado[3]),
  };
}

/**
 * @param {ParsedVersion} versao
 * @returns {string}
 */
function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/**
 * Próxima versão: minor zera o patch; major zera minor e patch.
 *
 * @param {string} texto
 * @param {VersionPart} parte
 * @returns {string}
 */
function bumpVersion(texto, parte) {
  const { major, minor, patch } = parseVersion(texto);
  if (parte === 'major') return formatVersion({ major: major + 1, minor: 0, patch: 0 });
  if (parte === 'minor') return formatVersion({ major, minor: minor + 1, patch: 0 });
  if (parte === 'patch') return formatVersion({ major, minor, patch: patch + 1 });
  throw new Error(`Parte inválida: "${parte}". Use patch, minor ou major.`);
}

/**
 * versionCode do Android derivado da versão. Cresce junto com a versão, então
 * o Android recusa instalar um APK antigo por cima de um novo.
 *
 * @param {string} texto
 * @returns {number}
 */
function versionCodeFrom(texto) {
  const { major, minor, patch } = parseVersion(texto);
  if (minor > LIMITE_DA_PARTE || patch > LIMITE_DA_PARTE) {
    throw new Error(`Versão ${texto}: MINOR e PATCH vão até ${LIMITE_DA_PARTE}.`);
  }
  const codigo = major * MULTIPLICADOR_MAJOR + minor * MULTIPLICADOR_MINOR + patch;
  if (codigo > LIMITE_DO_VERSION_CODE) {
    throw new Error(`Versão ${texto}: versionCode ${codigo} passa do limite do Android.`);
  }
  return codigo;
}

/**
 * Lê o cabeçalho Conventional Commits de um commit.
 *
 * @param {Commit} commit
 * @returns {{ type: string, breaking: boolean, description: string } | null}
 */
function parseCommit({ subject, body = '' }) {
  const encontrado = PADRAO_DO_CABECALHO.exec(subject.trim());
  if (encontrado === null) return null;
  return {
    type: encontrado[1].toLowerCase(),
    breaking: encontrado[3] === '!' || /BREAKING[ -]CHANGE/.test(body),
    description: encontrado[4].trim(),
  };
}

/**
 * Parte sugerida pelos commits: quebra → major; algum feat → minor; resto → patch.
 *
 * @param {Commit[]} commits
 * @returns {VersionPart}
 */
function suggestBump(commits) {
  const lidos = commits.map(parseCommit).filter((c) => c !== null);
  if (lidos.some((c) => c.breaking)) return 'major';
  if (lidos.some((c) => c.type === 'feat')) return 'minor';
  return 'patch';
}

/**
 * `true` se a parte escolhida é menor do que os commits pedem (ex.: patch com feat).
 *
 * @param {VersionPart} escolhida
 * @param {VersionPart} sugerida
 */
function isSmallerThanSuggested(escolhida, sugerida) {
  return ORDEM_DAS_PARTES[escolhida] < ORDEM_DAS_PARTES[sugerida];
}

/** @param {string} texto */
function primeiraMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Seção do CHANGELOG para uma versão. Só entra o que muda para quem usa o
 * app: docs, chore, ci, test, style, build e refactor ficam de fora.
 *
 * @param {{ version: string, date: string, commits: Commit[] }} entrada
 * @returns {string}
 */
function buildChangelogSection({ version, date, commits }) {
  /** @type {Record<string, string[]>} */
  const grupos = { 'Quebra de compatibilidade': [], Novidades: [], Correções: [] };

  for (const commit of commits) {
    const lido = parseCommit(commit);
    if (lido === null) continue;
    const item = `- ${primeiraMaiuscula(lido.description)}`;
    if (lido.breaking) grupos['Quebra de compatibilidade'].push(item);
    else if (lido.type === 'feat') grupos.Novidades.push(item);
    else if (lido.type === 'fix' || lido.type === 'perf') grupos.Correções.push(item);
  }

  const blocos = Object.entries(grupos)
    .filter(([, itens]) => itens.length > 0)
    .map(([titulo, itens]) => `### ${titulo}\n\n${itens.join('\n')}`);

  const corpo = blocos.length > 0 ? blocos.join('\n\n') : '- Sem mudanças visíveis para quem usa o app.';
  return `## [${formatVersion(parseVersion(version))}] - ${date}\n\n${corpo}\n`;
}

/**
 * Coloca a seção nova acima da versão mais recente do CHANGELOG.
 *
 * @param {string} changelog
 * @param {string} secao
 * @returns {string}
 */
function insertChangelogSection(changelog, secao) {
  const inicio = changelog.search(/^## \[/m);
  if (inicio === -1) {
    return `${changelog.replace(/\s*$/, '')}\n\n${secao}`;
  }
  return `${changelog.slice(0, inicio)}${secao}\n${changelog.slice(inicio)}`;
}

/**
 * Texto de uma versão no CHANGELOG, sem o título — é o que vai nas notas do
 * GitHub Release.
 *
 * @param {string} changelog
 * @param {string} version
 * @returns {string | null}
 */
function extractChangelogSection(changelog, version) {
  const alvo = formatVersion(parseVersion(version));
  const linhas = changelog.split(/\r?\n/);
  const titulo = linhas.findIndex((linha) => linha.startsWith(`## [${alvo}]`));
  if (titulo === -1) return null;
  const proximo = linhas.findIndex((linha, i) => i > titulo && linha.startsWith('## ['));
  const fim = proximo === -1 ? linhas.length : proximo;
  return `${linhas.slice(titulo + 1, fim).join('\n').trim()}\n`;
}

/**
 * Lê a saída de `git describe --tags --long --dirty` (ex.: v1.6.0-18-gc03dc6d-dirty).
 *
 * @param {string} texto
 * @returns {GitDescribe | null}
 */
function parseDescribe(texto) {
  const encontrado = PADRAO_DO_DESCRIBE.exec(String(texto).trim());
  if (encontrado === null) return null;
  return {
    tag: encontrado[1],
    commitsSinceTag: Number(encontrado[2]),
    sha: encontrado[3],
    dirty: encontrado[4] !== undefined,
  };
}

/**
 * Onde o código está em relação à última tag de versão. `null` sem git ou sem
 * tag (ex.: clone raso no CI sem `fetch-depth: 0`).
 *
 * @param {string} [cwd]
 * @returns {GitDescribe | null}
 */
function describeGit(cwd = path.join(__dirname, '..')) {
  try {
    const saida = execFileSync(
      'git',
      ['describe', '--tags', '--long', '--dirty', '--match', 'v[0-9]*'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return parseDescribe(saida);
  } catch {
    return null;
  }
}

/**
 * Nome de versão exibido pelo Android (versionName). A versão em si não muda;
 * builds que não são publicação ganham um sufixo que diz de onde vieram:
 *
 * - exatamente na tag, sem alteração: `1.6.0`
 * - fora da tag: `1.6.0+12.abc1234`
 * - app DEV: `1.6.0+dev.12.abc1234`
 * - com alteração não commitada: `.dirty` no fim
 *
 * @param {{ version: string, describe: GitDescribe | null, variant: 'dev' | 'prod' }} entrada
 * @returns {string}
 */
function buildVersionName({ version, describe, variant }) {
  const base = formatVersion(parseVersion(version));
  const prefixo = variant === 'dev' ? 'dev.' : '';

  if (describe === null) {
    return variant === 'dev' ? `${base}+dev` : base;
  }

  const naTag = describe.commitsSinceTag === 0 && !describe.dirty && describe.tag === `v${base}`;
  if (naTag && variant !== 'dev') {
    return base;
  }

  const sujo = describe.dirty ? '.dirty' : '';
  return `${base}+${prefixo}${describe.commitsSinceTag}.${describe.sha}${sujo}`;
}

module.exports = {
  LIMITE_DA_PARTE,
  bumpVersion,
  buildChangelogSection,
  buildVersionName,
  describeGit,
  extractChangelogSection,
  formatVersion,
  insertChangelogSection,
  isSmallerThanSuggested,
  parseCommit,
  parseDescribe,
  parseVersion,
  suggestBump,
  versionCodeFrom,
};
