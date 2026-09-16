#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Versão do app: publicar, conferir e gerar notas. Regras em docs/VERSIONAMENTO.md.
 *
 *   node scripts/version.js patch|minor|major [--dry-run] [--forcar]
 *       Calcula a próxima versão a partir da última tag, grava app.json,
 *       package.json, package-lock.json e a seção do CHANGELOG.md. Não commita.
 *   node scripts/version.js tag
 *       Commita esses 4 arquivos como chore(release) e cria a tag anotada. Não
 *       faz push.
 *   node scripts/version.js check [--tag vX.Y.Z] [--android] [--variant dev|prod]
 *       Confere versionCode, package.json e, com --android, a pasta android/.
 *   node scripts/version.js notes vX.Y.Z
 *       Imprime as notas da versão (para o GitHub Release).
 *   node scripts/version.js build-name [--variant dev|prod]
 *       Imprime o versionName deste build (ex.: 1.6.0+dev.12.abc1234).
 *
 * O git é sempre chamado com execFileSync e argumentos separados, nunca com
 * comando montado em texto. [#52]
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lib = require('./version-lib');

const RAIZ = path.join(__dirname, '..');
const ARQUIVOS_DA_VERSAO = Object.freeze(['app.json', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
const PARTES = Object.freeze(['patch', 'minor', 'major']);
/** Tags antigas sem versionCode no app.json saíram todas com o padrão do Android. */
const VERSION_CODE_SEM_REGISTRO = 1;

class ErroDeUso extends Error {}

/**
 * @param {string[]} args
 * @param {{ permitirFalha?: boolean, cru?: boolean }} [opcoes] `cru` mantém os espaços do início
 *   (o `git status --porcelain` depende deles).
 * @returns {string}
 */
function git(args, { permitirFalha = false, cru = false } = {}) {
  try {
    const saida = execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return cru ? saida : saida.trim();
  } catch (erro) {
    if (permitirFalha) return '';
    throw erro;
  }
}

/** @param {string} arquivo */
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8'));

/**
 * Grava no mesmo formato que o npm usa (2 espaços, LF no fim).
 *
 * @param {string} arquivo
 * @param {unknown} conteudo
 */
const gravarJson = (arquivo, conteudo) =>
  fs.writeFileSync(path.join(RAIZ, arquivo), `${JSON.stringify(conteudo, null, 2)}\n`);

/**
 * @param {string[]} args
 * @param {string} nome
 */
const temOpcao = (args, nome) => args.includes(nome);

/**
 * @param {string[]} args
 * @param {string} nome
 * @returns {string | undefined}
 */
function valorDaOpcao(args, nome) {
  const i = args.indexOf(nome);
  return i === -1 ? undefined : args[i + 1];
}

/**
 * @param {string[]} args
 * @returns {'dev' | 'prod'}
 */
function varianteDe(args) {
  const valor = valorDaOpcao(args, '--variant') ?? (process.env.APP_VARIANT === 'development' ? 'dev' : 'prod');
  if (valor !== 'dev' && valor !== 'prod') {
    throw new ErroDeUso(`--variant "${valor}" inválida. Use dev ou prod.`);
  }
  return valor;
}

function versaoDoApp() {
  return lerJson('app.json').expo.version;
}

function ultimaTag() {
  const tag = git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { permitirFalha: true });
  if (tag === '') throw new ErroDeUso('Nenhuma tag de versão (vX.Y.Z) encontrada neste histórico.');
  return tag;
}

/**
 * Commits desde a tag, sem merges.
 *
 * @param {string} tag
 * @returns {import('./version-lib').Commit[]}
 */
function commitsDesde(tag) {
  const SEPARADOR_DE_CAMPO = '\x1f';
  const SEPARADOR_DE_COMMIT = '\x1e';
  const saida = git(['log', `${tag}..HEAD`, '--no-merges', `--format=%s${SEPARADOR_DE_CAMPO}%b${SEPARADOR_DE_COMMIT}`]);
  return saida
    .split(SEPARADOR_DE_COMMIT)
    .map((bloco) => bloco.trim())
    .filter((bloco) => bloco !== '')
    .map((bloco) => {
      const [subject = '', body = ''] = bloco.split(SEPARADOR_DE_CAMPO);
      return { subject: subject.trim(), body: body.trim() };
    });
}

/** @param {string} tag */
function versionCodeDaTag(tag) {
  const conteudo = git(['show', `${tag}:app.json`], { permitirFalha: true });
  if (conteudo === '') return VERSION_CODE_SEM_REGISTRO;
  return JSON.parse(conteudo).expo?.android?.versionCode ?? VERSION_CODE_SEM_REGISTRO;
}

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

// ---------------------------------------------------------------------------

/**
 * @param {import('./version-lib').VersionPart} parte
 * @param {string[]} args
 */
function publicar(parte, args) {
  const simulacao = temOpcao(args, '--dry-run');
  const forcar = temOpcao(args, '--forcar');

  const alteracoes = git(['status', '--porcelain']);
  if (alteracoes !== '' && !simulacao) {
    throw new ErroDeUso('Há alterações não commitadas. Commite ou descarte antes de publicar uma versão.');
  }

  const atual = versaoDoApp();
  const tag = ultimaTag();
  if (tag !== `v${atual}`) {
    throw new ErroDeUso(
      `A última tag é ${tag}, mas o app.json está em ${atual}. Termine a publicação anterior (npm run versao:tag) antes.`,
    );
  }

  const commits = commitsDesde(tag);
  if (commits.length === 0) {
    throw new ErroDeUso(`Nenhum commit desde ${tag}: nada a publicar.`);
  }

  const nova = lib.bumpVersion(atual, parte);
  const codigo = lib.versionCodeFrom(nova);
  const codigoAnterior = versionCodeDaTag(tag);
  if (codigo <= codigoAnterior) {
    throw new ErroDeUso(`versionCode ${codigo} não é maior que o de ${tag} (${codigoAnterior}).`);
  }

  if (git(['tag', '-l', `v${nova}`]) !== '') {
    throw new ErroDeUso(`A tag v${nova} já existe neste computador.`);
  }
  const remota = git(['ls-remote', '--tags', 'origin', `refs/tags/v${nova}`], { permitirFalha: true });
  if (remota !== '') {
    throw new ErroDeUso(`A tag v${nova} já existe no GitHub.`);
  }

  const sugerida = lib.suggestBump(commits);
  if (lib.isSmallerThanSuggested(parte, sugerida) && !forcar) {
    throw new ErroDeUso(
      `Os commits desde ${tag} pedem "${sugerida}" e foi pedido "${parte}". ` +
        `Se for isso mesmo (ex.: um feat que é só ajuste), repita com --forcar.`,
    );
  }

  const secao = lib.buildChangelogSection({ version: nova, date: hojeEmSaoPaulo(), commits });

  console.log(`${atual} → ${nova} (versionCode ${codigo})`);
  console.log(`Sugestão pelos commits: ${sugerida} · ${commits.length} commit(s) desde ${tag}`);
  console.log(`\n${secao}`);

  if (simulacao) {
    if (alteracoes !== '') console.log('(aviso: há alterações não commitadas; a publicação de verdade vai recusar)');
    console.log('Simulação: nenhum arquivo foi alterado.');
    return;
  }

  const app = lerJson('app.json');
  app.expo.version = nova;
  app.expo.android = { ...app.expo.android, versionCode: codigo };
  gravarJson('app.json', app);

  const pacote = lerJson('package.json');
  pacote.version = nova;
  gravarJson('package.json', pacote);

  const trava = lerJson('package-lock.json');
  trava.version = nova;
  trava.packages[''].version = nova;
  gravarJson('package-lock.json', trava);

  const caminhoDoChangelog = path.join(RAIZ, 'CHANGELOG.md');
  const changelog = fs.existsSync(caminhoDoChangelog) ? fs.readFileSync(caminhoDoChangelog, 'utf8') : '# Changelog\n';
  fs.writeFileSync(caminhoDoChangelog, lib.insertChangelogSection(changelog, secao));

  console.log('Arquivos atualizados. Revise o CHANGELOG.md e rode: npm run versao:tag');
}

function criarTag() {
  const alterados = git(['status', '--porcelain'], { cru: true })
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => linha.slice(3).trim());
  const inesperados = alterados.filter((arquivo) => !ARQUIVOS_DA_VERSAO.includes(arquivo));
  if (alterados.length === 0 || !alterados.includes('app.json') || inesperados.length > 0) {
    throw new ErroDeUso(
      `A tag só commita ${ARQUIVOS_DA_VERSAO.join(', ')}, e o app.json precisa estar entre eles. ` +
        `Alterados agora: ${alterados.join(', ') || 'nenhum'}.`,
    );
  }

  const versao = versaoDoApp();
  conferir([]);
  const changelog = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
  const notas = lib.extractChangelogSection(changelog, versao);
  if (notas === null) {
    throw new ErroDeUso(`CHANGELOG.md sem a seção "## [${versao}]".`);
  }

  const ramo = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (ramo !== 'main') {
    console.log(`Aviso: a tag vai ser criada no ramo "${ramo}". O combinado é criar na main, depois do merge.`);
  }

  git(['add', ...ARQUIVOS_DA_VERSAO]);
  execFileSync('git', ['commit', '-m', `chore(release): v${versao}`], { cwd: RAIZ, stdio: 'inherit' });

  const arquivoDasNotas = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'snake-versao-')), 'notas.md');
  fs.writeFileSync(arquivoDasNotas, `Snake Thai ${versao}\n\n${notas}`);
  git(['tag', '-a', `v${versao}`, '-F', arquivoDasNotas]);

  console.log(`\nCommit e tag v${versao} criados só neste computador. Para publicar:`);
  console.log(`  git push origin ${ramo}`);
  console.log(`  git push origin v${versao}`);
}

/** @param {string[]} args */
function conferir(args) {
  const app = lerJson('app.json');
  const versao = app.expo.version;
  const problemas = [];

  const esperado = lib.versionCodeFrom(versao);
  const codigo = app.expo.android?.versionCode;
  if (codigo === undefined) {
    problemas.push(`app.json sem expo.android.versionCode (esperado ${esperado}).`);
  } else if (codigo !== esperado) {
    problemas.push(`versionCode ${codigo} no app.json; para ${versao} deveria ser ${esperado}.`);
  }

  const pacote = lerJson('package.json').version;
  if (pacote !== versao) problemas.push(`package.json está em ${pacote}; app.json em ${versao}.`);

  const tag = valorDaOpcao(args, '--tag');
  if (tag !== undefined && tag !== `v${versao}`) {
    problemas.push(`A tag ${tag} não corresponde à versão ${versao} do app.json.`);
  }

  if (temOpcao(args, '--android')) {
    problemas.push(...conferirAndroid(esperado, varianteDe(args), versao));
  }

  if (problemas.length > 0) {
    throw new ErroDeUso(problemas.join('\n'));
  }
  console.log(`Versão ${versao} (versionCode ${esperado}) consistente.`);
}

/**
 * A pasta android/ guarda versionCode e versionName do último prebuild.
 *
 * @param {number} codigoEsperado
 * @param {'dev' | 'prod'} variante
 * @param {string} versao
 * @returns {string[]}
 */
function conferirAndroid(codigoEsperado, variante, versao) {
  const gradle = path.join(RAIZ, 'android', 'app', 'build.gradle');
  if (!fs.existsSync(gradle)) {
    return ['Pasta android/ não existe: rode o prebuild (menu [P]).'];
  }
  const conteudo = fs.readFileSync(gradle, 'utf8');
  const codigo = Number(/versionCode\s+(\d+)/.exec(conteudo)?.[1]);
  const nome = /versionName\s+["']([^"']+)["']/.exec(conteudo)?.[1];
  const nomeEsperado = lib.buildVersionName({ version: versao, describe: lib.describeGit(RAIZ), variant: variante });
  const ATUALIZE = 'android/ desatualizada: rode o prebuild (menu [P]).';

  const problemas = [];
  if (codigo !== codigoEsperado) {
    problemas.push(`versionCode ${codigo} em android/, esperado ${codigoEsperado}. ${ATUALIZE}`);
  }
  if (nome !== nomeEsperado) {
    problemas.push(`versionName "${nome}" em android/, esperado "${nomeEsperado}". ${ATUALIZE}`);
  }
  return problemas;
}

/** @param {string[]} args */
function notas(args) {
  const versao = args[0];
  if (versao === undefined) throw new ErroDeUso('Informe a versão: node scripts/version.js notes v1.6.0');
  const changelog = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
  const texto = lib.extractChangelogSection(changelog, versao);
  if (texto === null) throw new ErroDeUso(`CHANGELOG.md não tem a versão ${versao}.`);
  process.stdout.write(texto);
}

/** @param {string[]} args */
function nomeDoBuild(args) {
  console.log(lib.buildVersionName({ version: versaoDoApp(), describe: lib.describeGit(RAIZ), variant: varianteDe(args) }));
}

function main() {
  const [comando, ...args] = process.argv.slice(2);
  if (comando !== undefined && PARTES.includes(comando)) {
    return publicar(/** @type {import('./version-lib').VersionPart} */ (comando), args);
  }
  if (comando === 'tag') return criarTag();
  if (comando === 'check') return conferir(args);
  if (comando === 'notes') return notas(args);
  if (comando === 'build-name') return nomeDoBuild(args);
  throw new ErroDeUso('Uso: node scripts/version.js patch|minor|major|tag|check|notes|build-name (ver docs/VERSIONAMENTO.md)');
}

try {
  main();
} catch (erro) {
  if (erro instanceof ErroDeUso) {
    console.error(`✖ ${erro.message}`);
    process.exit(1);
  }
  throw erro;
}
