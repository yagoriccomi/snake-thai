/**
 * Config Plugin do Expo — assinatura de release no `build.gradle` gerado pelo
 * prebuild.
 *
 * POR QUE ISTO PRECISA SER UM PLUGIN, E NÃO UM `build.gradle` editado à mão:
 * a pasta `android/` não é versionada (fluxo prebuild) — `npx expo prebuild`
 * a regenera a partir do template do Expo. Uma edição manual some no próximo
 * prebuild, sem aviso nenhum.
 *
 * O que ele faz, com `exigirChaveDeProducao: true` (o app de produção):
 * 1. o build de release usa a keystore de produção descrita pelas propriedades
 *    `SNAKETHAI_RELEASE_*` (em `%USERPROFILE%\.gradle\gradle.properties`, fora
 *    do repositório e fora de `android/` — ver docs/RELEASE-SIGNING.md);
 * 2. **empacotar um release sem essa keystore derruba o build.** Antes, o
 *    template caía na chave de debug em silêncio — foi assim que a 1.6.0 saiu
 *    assinada com uma chave pública.
 *
 * Com `exigirChaveDeProducao: false` (o app DEV, que nunca é publicado), o
 * `build.gradle` fica como o template: release assinado com a chave de debug.
 *
 * Nenhum segredo é lido nem gravado por este arquivo. [#37][#80]
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

/** Prefixo próprio: o gradle.properties do usuário vale para todo projeto Gradle da máquina. */
const PROPRIEDADE_DO_ARQUIVO = 'SNAKETHAI_RELEASE_STORE_FILE';

// Mesma indentação do bloco `debug` vizinho. O texto entra DEPOIS do `}` que
// fecha `debug` e ANTES do `}` que fecha `signingConfigs`.
const BLOCO_SIGNING_CONFIG = `        release {
            // Nada de segredo aqui: tudo vem de gradle.properties fora do
            // repositório. Ver docs/RELEASE-SIGNING.md.
            if (project.hasProperty('${PROPRIEDADE_DO_ARQUIVO}')) {
                storeFile file(SNAKETHAI_RELEASE_STORE_FILE)
                storePassword SNAKETHAI_RELEASE_STORE_PASSWORD
                keyAlias SNAKETHAI_RELEASE_KEY_ALIAS
                keyPassword SNAKETHAI_RELEASE_KEY_PASSWORD
            }
        }`;

// Só o fechamento do bloco `debug { ... }` — NÃO inclui o `}` que fecha
// `signingConfigs`, senão o bloco de release seria inserido por FORA dele.
const ANCORA_SIGNING_CONFIGS = `            keyPassword 'android'
        }`;

const LINHA_ANTIGA_BUILD_TYPE = 'signingConfig signingConfigs.debug';
// A alternativa de debug só existe para a fase de configuração (ex.: um
// assembleDebug numa máquina sem a chave); empacotar release sem a chave é
// barrado pela trava abaixo.
const LINHA_NOVA_BUILD_TYPE = `signingConfig project.hasProperty('${PROPRIEDADE_DO_ARQUIVO}') ? signingConfigs.release : signingConfigs.debug`;

/** Mensagem da trava: não imprime caminho nem senha. */
const MENSAGEM_DA_TRAVA =
  'Release sem keystore de producao: configure SNAKETHAI_RELEASE_* (docs/RELEASE-SIGNING.md)';

const TRAVA_DE_RELEASE = `
// Snake Thai (plugins/withReleaseSigning.js): release sem a keystore de
// producao nao compila. Um fallback silencioso para a chave de debug publicou
// a 1.6.0 assinada com uma chave publica.
gradle.taskGraph.whenReady { grafo ->
    def empacotaRelease = grafo.allTasks.any { tarefa ->
        tarefa.project == project && (tarefa.name == 'packageRelease' || tarefa.name == 'signReleaseBundle')
    }
    def keystore = project.findProperty('${PROPRIEDADE_DO_ARQUIVO}')
    if (empacotaRelease && (keystore == null || !file(keystore).exists())) {
        throw new GradleException('${MENSAGEM_DA_TRAVA}')
    }
}
`;

/**
 * Aplica a assinatura de produção e a trava ao texto do `app/build.gradle`.
 * Idempotente: rodar duas vezes não duplica nada.
 *
 * @param {string} conteudo Texto do build.gradle gerado pelo template.
 * @param {{ exigirChaveDeProducao?: boolean }} [opcoes]
 * @returns {string}
 * @throws {Error} Se o template mudou e as âncoras não existem mais.
 */
function injetarAssinatura(conteudo, { exigirChaveDeProducao = true } = {}) {
  if (!exigirChaveDeProducao || conteudo.includes(PROPRIEDADE_DO_ARQUIVO)) {
    return conteudo;
  }

  if (!conteudo.includes(ANCORA_SIGNING_CONFIGS)) {
    throw new Error(
      'withReleaseSigning: âncora do signingConfigs não encontrada no build.gradle ' +
        'gerado. O template do Expo pode ter mudado — atualize plugins/withReleaseSigning.js.',
    );
  }
  let novo = conteudo.replace(ANCORA_SIGNING_CONFIGS, `${ANCORA_SIGNING_CONFIGS}\n${BLOCO_SIGNING_CONFIG}`);

  // A primeira `signingConfig signingConfigs.debug` depois de `release {` dentro
  // de `buildTypes` é a do release; a do buildType debug vem antes e fica.
  const inicioDosBuildTypes = novo.indexOf('buildTypes {');
  const indiceRelease = inicioDosBuildTypes === -1 ? -1 : novo.indexOf('release {', inicioDosBuildTypes);
  const indiceLinha = indiceRelease === -1 ? -1 : novo.indexOf(LINHA_ANTIGA_BUILD_TYPE, indiceRelease);
  if (indiceLinha === -1) {
    throw new Error('withReleaseSigning: bloco buildTypes.release não encontrado como esperado.');
  }
  novo = novo.slice(0, indiceLinha) + LINHA_NOVA_BUILD_TYPE + novo.slice(indiceLinha + LINHA_ANTIGA_BUILD_TYPE.length);

  return `${novo.replace(/\s*$/, '')}\n${TRAVA_DE_RELEASE}`;
}

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {{ exigirChaveDeProducao?: boolean }} [opcoes]
 */
function withReleaseSigning(config, opcoes = {}) {
  return withAppBuildGradle(config, (configuracao) => {
    if (configuracao.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning só sabe editar build.gradle em Groovy.');
    }
    configuracao.modResults.contents = injetarAssinatura(configuracao.modResults.contents, opcoes);
    return configuracao;
  });
}

module.exports = withReleaseSigning;
module.exports.injetarAssinatura = injetarAssinatura;
module.exports.MENSAGEM_DA_TRAVA = MENSAGEM_DA_TRAVA;
