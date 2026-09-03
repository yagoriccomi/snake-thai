/**
 * Config Plugin do Expo — injeta a keystore de release no `build.gradle`
 * gerado pelo prebuild.
 *
 * POR QUE ISTO PRECISA SER UM PLUGIN, E NÃO UM `build.gradle` editado à mão:
 * a pasta `android/` não é versionada (fluxo prebuild) — `npx expo prebuild`
 * a regenera do zero a partir do template do Expo, mesmo sem `--clean`. Uma
 * edição manual no arquivo sobrevive só até o próximo prebuild, e então
 * desaparece em silêncio, sem aviso nenhum. `menu.bat` já resolve esse mesmo
 * problema para a porta do Metro reaplicando a propriedade depois do
 * prebuild; este plugin é o equivalente para a assinatura de release,
 * seguindo o padrão do próprio Expo em vez de inventar um mecanismo novo.
 *
 * O que ele faz: se `android/gradle.properties` tiver `RELEASE_STORE_FILE`
 * (ver `docs/RELEASE-SIGNING.md`), o build de release passa a usar a
 * keystore de produção. Sem essa propriedade, o `build.gradle` gerado
 * permanece EXATAMENTE como o template padrão do Expo — a keystore de debug,
 * como hoje. Nenhum segredo é lido nem gravado por este arquivo: as senhas
 * vivem só em `gradle.properties`, fora do Git. [#37][#80]
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARCADOR = 'RELEASE_STORE_FILE'; // idempotência: não injeta duas vezes

// Mesma indentação do bloco `debug` vizinho (8 espaços para `release {`) —
// o texto é inserido DEPOIS do `}` que fecha `debug`, e ANTES do `}` que
// fecha `signingConfigs` (esse último não faz parte da âncora nem do bloco:
// ele já existe no arquivo e continua fechando o `signingConfigs` como
// sempre fechou). [confirmado rodando `expo prebuild --clean` de verdade]
const BLOCO_SIGNING_CONFIG = `        release {
            // Nada de segredo hardcoded aqui — tudo vem de gradle.properties,
            // que NÃO é versionado. Ver docs/RELEASE-SIGNING.md.
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }`;

// Só o fechamento do bloco `debug { ... }` — NÃO inclui o `}` que fecha
// `signingConfigs`, senão o bloco de release seria inserido por FORA dele.
const ANCORA_SIGNING_CONFIGS = `            keyPassword 'android'
        }`;

const LINHA_ANTIGA_BUILD_TYPE = 'signingConfig signingConfigs.debug';
const LINHA_NOVA_BUILD_TYPE =
  "signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning só sabe editar build.gradle em Groovy.');
    }

    let conteudo = config.modResults.contents;

    if (conteudo.includes(MARCADOR)) {
      // Já injetado nesta execução do prebuild (ou build.gradle não foi
      // regenerado do zero) — não duplica o bloco.
      return config;
    }

    if (!conteudo.includes(ANCORA_SIGNING_CONFIGS)) {
      throw new Error(
        'withReleaseSigning: âncora do signingConfigs não encontrada no build.gradle ' +
          'gerado. O template do Expo pode ter mudado — atualize plugins/withReleaseSigning.js.',
      );
    }
    conteudo = conteudo.replace(ANCORA_SIGNING_CONFIGS, ANCORA_SIGNING_CONFIGS + '\n' + BLOCO_SIGNING_CONFIG);

    // Só a PRIMEIRA ocorrência é a do buildType `release` (a do `debug` vem
    // antes e deve continuar apontando para `signingConfigs.debug`).
    const indiceRelease = conteudo.indexOf('release {', conteudo.indexOf('buildTypes {'));
    const indiceLinha = conteudo.indexOf(LINHA_ANTIGA_BUILD_TYPE, indiceRelease);
    if (indiceRelease === -1 || indiceLinha === -1) {
      throw new Error(
        'withReleaseSigning: bloco buildTypes.release não encontrado como esperado.',
      );
    }
    conteudo =
      conteudo.slice(0, indiceLinha) +
      LINHA_NOVA_BUILD_TYPE +
      conteudo.slice(indiceLinha + LINHA_ANTIGA_BUILD_TYPE.length);

    config.modResults.contents = conteudo;
    return config;
  });
}

module.exports = withReleaseSigning;
