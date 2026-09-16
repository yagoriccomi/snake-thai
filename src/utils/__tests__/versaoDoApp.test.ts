import { descreverVersaoDoApp } from '@/utils/versaoDoApp';

describe('descreverVersaoDoApp', () => {
  it('deveMostrarVersaoECodigoDoAndroid', () => {
    expect(descreverVersaoDoApp({ version: '1.7.0', android: { versionCode: 1007000 } })).toEqual({
      texto: 'Versão 1.7.0 (1007000)',
      rotuloAcessivel: 'Versão do aplicativo 1.7.0, código 1007000',
    });
  });

  it('deveMostrarSoAVersaoQuandoNaoHaCodigo', () => {
    expect(descreverVersaoDoApp({ version: '1.6.0+dev.12.abc1234' })?.texto).toBe('Versão 1.6.0+dev.12.abc1234');
  });

  it.each([null, undefined, {}, { version: '  ' }])('deveDevolverNuloSemVersao %p', (configuracao) => {
    expect(descreverVersaoDoApp(configuracao)).toBeNull();
  });
});
