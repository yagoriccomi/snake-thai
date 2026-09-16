const { lerEnv, montarAmbiente } = require('../with-variant');

const DEV = {
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'chave-local-de-teste',
};

describe('lerEnv', () => {
  it('deveIgnorarComentariosELinhasVaziasETirarAspas', () => {
    const texto = '# comentario\n\nA=1\r\nB="dois"\nC=\'tres\'\nD=\nsem-igual\n';
    expect(lerEnv(texto)).toEqual({ A: '1', B: 'dois', C: 'tres', D: '' });
  });

  it('deveManterIgualDentroDoValor', () => {
    expect(lerEnv('URL=http://x/?a=b')).toEqual({ URL: 'http://x/?a=b' });
  });
});

describe('montarAmbiente', () => {
  it('deveDefinirAVarianteEDesligarOsEnvDoExpo', () => {
    const ambiente = montarAmbiente('dev', DEV, {});
    expect(ambiente).toMatchObject({
      APP_VARIANT: 'development',
      EXPO_PUBLIC_APP_VARIANT: 'development',
      EXPO_NO_DOTENV: '1',
    });
  });

  it('deveFazerOArquivoVencerOQueEstiverNoTerminal', () => {
    // Uma URL de produção esquecida no shell não pode desviar o app DEV.
    const ambiente = montarAmbiente('dev', DEV, {
      EXPO_PUBLIC_SUPABASE_URL: 'https://producao.supabase.co',
    });
    expect(ambiente.EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:55321');
  });

  it('deveRecusarArquivoDevComBancoDeProducao', () => {
    expect(() =>
      montarAmbiente('dev', { ...DEV, EXPO_PUBLIC_SUPABASE_URL: 'https://producao.supabase.co' }, {}),
    ).toThrow(/DEV/);
  });

  it('deveApontarAsVariaveisObrigatoriasQueFaltam', () => {
    expect(() => montarAmbiente('prod', {}, {})).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('deveRecusarApelidoDesconhecido', () => {
    expect(() => montarAmbiente('homolog', DEV, {})).toThrow(/dev ou prod/);
  });
});
