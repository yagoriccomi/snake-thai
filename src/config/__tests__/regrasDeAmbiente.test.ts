import { problemaDeAmbiente } from '@/config/regrasDeAmbiente';

const PRODUCAO = 'https://abcdefghijklmnop.supabase.co';
const LOCAL = 'http://127.0.0.1:55321';

describe('problemaDeAmbiente', () => {
  it('deveAceitarProducaoComSupabaseEApiPublicos', () => {
    expect(
      problemaDeAmbiente({
        variante: 'production',
        supabaseUrl: PRODUCAO,
        apiUrl: 'https://snakethai-api.onrender.com',
      }),
    ).toBeNull();
  });

  it('deveAceitarDevComBancoLocalESemApi', () => {
    expect(problemaDeAmbiente({ variante: 'development', supabaseUrl: LOCAL, apiUrl: null })).toBeNull();
  });

  it('deveRecusarAppDevApontandoParaOBancoDeProducao', () => {
    // O erro que esta regra existe para impedir: testar gravando em produção.
    expect(problemaDeAmbiente({ variante: 'development', supabaseUrl: PRODUCAO })).toMatch(/DEV/);
  });

  it('deveRecusarAppDevComApiDeProducao', () => {
    expect(
      problemaDeAmbiente({
        variante: 'development',
        supabaseUrl: LOCAL,
        apiUrl: 'https://snakethai-api.onrender.com',
      }),
    ).toMatch(/EXPO_PUBLIC_API_URL/);
  });

  it('deveRecusarAppDeProducaoApontandoParaEnderecoLocal', () => {
    expect(problemaDeAmbiente({ variante: 'production', supabaseUrl: LOCAL })).toMatch(/PRODUÇÃO/);
  });

  it('deveRecusarProducaoSemHttps', () => {
    expect(
      problemaDeAmbiente({ variante: 'production', supabaseUrl: 'http://abcdefghijklmnop.supabase.co' }),
    ).toMatch(/https/);
  });

  it('deveReconhecerAsFaixasDeRedePrivada', () => {
    for (const host of ['10.0.2.2', '192.168.15.10', '172.20.0.5', 'localhost']) {
      expect(
        problemaDeAmbiente({ variante: 'development', supabaseUrl: `http://${host}:55321` }),
      ).toBeNull();
    }
    // 172.32.x.x já é endereço público.
    expect(
      problemaDeAmbiente({ variante: 'development', supabaseUrl: 'http://172.32.0.1:55321' }),
    ).not.toBeNull();
  });

  it('deveRecusarVarianteDesconhecida', () => {
    expect(problemaDeAmbiente({ variante: 'staging', supabaseUrl: PRODUCAO })).toMatch(/staging/);
  });

  it('deveRecusarUrlMalformada', () => {
    expect(problemaDeAmbiente({ variante: 'production', supabaseUrl: 'supabase.co' })).toMatch(/válida/);
  });
});
