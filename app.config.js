/**
 * Configuração dinâmica do Expo: o app.json continua sendo a base (e a fonte da
 * versão), e este arquivo só aplica as diferenças da variante escolhida em
 * APP_VARIANT.
 *
 * - `production` (padrão): o app das pessoas, idêntico ao app.json.
 * - `development`: "DEV Snake Thai", outro pacote Android — instala ao lado do
 *   de produção —, ícone em âmbar e HTTP liberado só para o próprio computador
 *   (o banco local da Supabase CLI não tem TLS).
 *
 * Os comandos do dia a dia passam por scripts/with-variant.js, que carrega o
 * .env da variante e define APP_VARIANT. Ver docs/RUNBOOK.md. [#80][#81]
 */
const { VARIANTE_PADRAO, VARIANTES, problemaDeAmbiente } = require('./src/config/regrasDeAmbiente');
const { buildVersionName, describeGit } = require('./scripts/version-lib');

/** Mesmo âmbar do token `devBanner` (src/theme/colors.ts): a cor que diz "isto é DEV". */
const COR_DO_ICONE_DEV = '#F59E0B';

const PACOTE_DEV = 'com.snakethai.app.dev';

const PLUGIN_DE_ASSINATURA = './plugins/withReleaseSigning.js';

/**
 * O app DEV nunca é publicado: assina o release com a chave de debug e não
 * precisa da keystore de produção (docs/RELEASE-SIGNING.md). Mantém o plugin
 * na lista e só troca a opção.
 *
 * @param {string | [string, object]} plugin
 */
const semExigirChaveDeProducao = (plugin) =>
  Array.isArray(plugin) && plugin[0] === PLUGIN_DE_ASSINATURA
    ? [PLUGIN_DE_ASSINATURA, { ...plugin[1], exigirChaveDeProducao: false }]
    : plugin;

module.exports = ({ config }) => {
  // Lido por referência, e não como `process.env.EXPO_PUBLIC_…`: o babel-preset-expo
  // troca essa forma pelo valor na hora de transformar o arquivo, e a trava
  // abaixo deixaria de ver a URL de verdade.
  const ambiente = process.env;
  const variante = ambiente.APP_VARIANT || VARIANTE_PADRAO;
  if (!VARIANTES.includes(variante)) {
    throw new Error(`APP_VARIANT="${variante}" desconhecida. Use ${VARIANTES.join(' ou ')}.`);
  }

  // Só confere quando as variáveis existem: comandos de manutenção (ex.:
  // `expo install`) rodam sem .env, e o app ainda falha no boot se faltar algo.
  const supabaseUrl = ambiente.EXPO_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const problema = problemaDeAmbiente({
      variante,
      supabaseUrl,
      apiUrl: ambiente.EXPO_PUBLIC_API_URL,
    });
    if (problema !== null) {
      throw new Error(`Build recusado: ${problema}`);
    }
  }

  const extra = { ...config.extra, appVariant: variante };
  // A versão do app.json só muda ao publicar (docs/VERSIONAMENTO.md). Build que
  // não é publicação ganha sufixo de commit (1.6.0+12.abc1234, 1.6.0+dev.12.abc1234)
  // para dar para saber de onde veio um APK sem inflar o número.
  const version = buildVersionName({
    version: config.version,
    describe: describeGit(__dirname),
    variant: variante === 'development' ? 'dev' : 'prod',
  });

  if (variante === 'production') {
    return { ...config, version, extra };
  }

  const { backgroundImage: _imagemDeFundo, ...iconeSemImagemDeFundo } = config.android.adaptiveIcon;

  return {
    ...config,
    name: 'DEV Snake Thai',
    version,
    scheme: 'snakethai-dev',
    ios: { ...config.ios, bundleIdentifier: PACOTE_DEV },
    android: {
      ...config.android,
      package: PACOTE_DEV,
      adaptiveIcon: { ...iconeSemImagemDeFundo, backgroundColor: COR_DO_ICONE_DEV },
    },
    plugins: [...config.plugins.map(semExigirChaveDeProducao), './plugins/withDevCleartext.js'],
    extra,
  };
};
