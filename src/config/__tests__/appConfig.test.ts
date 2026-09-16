/* eslint-disable @typescript-eslint/no-require-imports */
import type { ExpoConfig } from 'expo/config';

type ConfigFn = (entrada: { config: ExpoConfig }) => ExpoConfig;

const criarConfig = require('../../../app.config.js') as ConfigFn;
const base = (require('../../../app.json') as { expo: ExpoConfig }).expo;

const AMBIENTE_ORIGINAL = { ...process.env };

function configPara(ambiente: Record<string, string | undefined>): ExpoConfig {
  process.env = { ...AMBIENTE_ORIGINAL, ...ambiente };
  return criarConfig({ config: structuredClone(base) });
}

afterEach(() => {
  process.env = { ...AMBIENTE_ORIGINAL };
});

describe('app.config.js', () => {
  it('deveManterAConfiguracaoDeProducaoIgualAoAppJson', () => {
    const config = configPara({ APP_VARIANT: 'production', EXPO_PUBLIC_SUPABASE_URL: undefined });

    expect(config.name).toBe(base.name);
    expect(config.android?.package).toBe('com.snakethai.app');
    expect(config.scheme).toBe(base.scheme);
    expect(config.plugins).toEqual(base.plugins);
    expect(config.plugins).toContainEqual(['./plugins/withReleaseSigning.js', { exigirChaveDeProducao: true }]);
    expect(config.extra).toMatchObject({ appVariant: 'production' });
    // Mesma versão do app.json; fora da tag, só ganha o sufixo do commit.
    expect(config.version?.startsWith(base.version ?? '')).toBe(true);
    expect(config.version).toMatch(/^\d+\.\d+\.\d+(\+\d+\.[0-9a-f]+(\.dirty)?)?$/);
    expect(config.android?.versionCode).toBe(base.android?.versionCode);
  });

  it('deveUsarProducaoQuandoAVarianteNaoEInformada', () => {
    const config = configPara({ APP_VARIANT: undefined, EXPO_PUBLIC_SUPABASE_URL: undefined });
    expect(config.android?.package).toBe('com.snakethai.app');
  });

  it('deveMontarOAppDevComOutroPacoteParaInstalarAoLado', () => {
    const config = configPara({
      APP_VARIANT: 'development',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
    });

    expect(config.name).toBe('DEV Snake Thai');
    expect(config.android?.package).toBe('com.snakethai.app.dev');
    expect(config.scheme).toBe('snakethai-dev');
    expect(config.version?.startsWith(`${base.version}+dev`)).toBe(true);
    expect(config.android?.versionCode).toBe(base.android?.versionCode);
    expect(config.android?.adaptiveIcon?.backgroundImage).toBeUndefined();
    expect(config.plugins).toContain('./plugins/withDevCleartext.js');
    // DEV assina com a chave de debug e não depende da keystore de produção.
    expect(config.plugins).toContainEqual(['./plugins/withReleaseSigning.js', { exigirChaveDeProducao: false }]);
    expect(base.plugins).toContainEqual(['./plugins/withReleaseSigning.js', { exigirChaveDeProducao: true }]);
    // A liberação de HTTP nunca pode vazar para produção.
    expect(base.plugins).not.toContain('./plugins/withDevCleartext.js');
  });

  it('deveRecusarBuildDevApontandoParaProducao', () => {
    expect(() =>
      configPara({
        APP_VARIANT: 'development',
        EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
      }),
    ).toThrow(/Build recusado/);
  });

  it('deveRecusarVarianteDesconhecida', () => {
    expect(() => configPara({ APP_VARIANT: 'staging' })).toThrow(/staging/);
  });
  it('naoDeveExigirOArquivoDoFirebaseParaCompilar', () => {
    const config = configPara({ APP_VARIANT: 'production', GOOGLE_SERVICES_JSON: 'C:/nao/existe/google-services.json' });
    expect(config.android?.googleServicesFile).toBeUndefined();
    expect(config.extra?.eas).toBeUndefined();
  });

  it('deveUsarOArquivoDoFirebaseEOProjectIdQuandoExistem', () => {
    // Qualquer arquivo existente serve para provar a regra; o conteúdo é do build nativo.
    const arquivo = (require('path') as { resolve: (...partes: string[]) => string }).resolve(process.cwd(), 'app.json');
    const config = configPara({
      APP_VARIANT: 'development',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
      GOOGLE_SERVICES_JSON: arquivo,
      EAS_PROJECT_ID: '00000000-0000-4000-8000-000000000000',
    });
    expect(config.android?.googleServicesFile).toBe(arquivo);
    expect(config.android?.package).toBe('com.snakethai.app.dev');
    expect(config.extra?.eas).toEqual({ projectId: '00000000-0000-4000-8000-000000000000' });
    expect(config.plugins).toContainEqual(['expo-notifications', expect.objectContaining({ defaultChannel: 'geral' })]);
  });
});
