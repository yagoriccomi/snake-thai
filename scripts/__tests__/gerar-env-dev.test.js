const { montarConteudo } = require('../gerar-env-dev');
const { lerEnv } = require('../with-variant');

const LOCAL = { url: 'http://127.0.0.1:55321', chave: 'chave-local-de-teste' };

describe('montarConteudo', () => {
  it('devePreservarAsEscolhasManuaisDoArquivoAtual', () => {
    const anterior = {
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
      EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_SENTRY_DSN: 'https://exemplo@o0.ingest.de.sentry.io/1',
      EAS_PROJECT_ID: '5f0a4d1e-0000-4000-8000-1c2b3a4d5e6f',
    };

    const lido = lerEnv(montarConteudo({ ...LOCAL, anterior }));

    expect(lido).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: LOCAL.url,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: LOCAL.chave,
      EXPO_PUBLIC_API_URL: anterior.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_SENTRY_DSN: anterior.EXPO_PUBLIC_SENTRY_DSN,
      EAS_PROJECT_ID: anterior.EAS_PROJECT_ID,
    });
  });

  it('deveDeixarVaziasAsChavesOpcionaisNoPrimeiroUso', () => {
    const lido = lerEnv(montarConteudo(LOCAL));

    expect(lido.EXPO_PUBLIC_API_URL).toBe('');
    expect(lido.EXPO_PUBLIC_SENTRY_DSN).toBe('');
    expect(lido.EAS_PROJECT_ID).toBe('');
  });

  it('deveAtualizarOEnderecoDoBancoSemApagarOProjetoExpo', () => {
    const anterior = { EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EAS_PROJECT_ID: 'projeto-1' };

    const lido = lerEnv(montarConteudo({ ...LOCAL, anterior }));

    expect(lido.EXPO_PUBLIC_SUPABASE_URL).toBe(LOCAL.url);
    expect(lido.EAS_PROJECT_ID).toBe('projeto-1');
  });
});
