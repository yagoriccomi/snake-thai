import {
  avaliarAtualizacao,
  diaEmSaoPaulo,
  ehVersaoMaior,
  lerTagDaRelease,
  lerVersaoInstalada,
  montarLinkDaAtualizacao,
} from '@/utils/avisoDeAtualizacao';

const LINK_DO_APK_200 =
  'https://github.com/yagoriccomi/snake-thai/releases/download/v2.0.0/snake-thai-v2.0.0.apk';
const PAGINA_DA_TAG_200 = 'https://github.com/yagoriccomi/snake-thai/releases/tag/v2.0.0';

const apkOficial = { name: 'snake-thai-v2.0.0.apk', browser_download_url: LINK_DO_APK_200 };
const aabOficial = {
  name: 'snake-thai-v2.0.0-playstore.aab',
  browser_download_url:
    'https://github.com/yagoriccomi/snake-thai/releases/download/v2.0.0/snake-thai-v2.0.0-playstore.aab',
};

describe('lerTagDaRelease', () => {
  it('deveLerATagNoFormatoVXYZ', () => {
    expect(lerTagDaRelease('v2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
  });

  it.each([['2.0.0'], ['v2.0'], ['v2.0.0-beta'], ['v2.0.0+1'], [' v2.0.0'], ['vx.y.z'], [null], [200]])(
    'deveRecusarTagForaDoFormato %p',
    (tag) => {
      expect(lerTagDaRelease(tag)).toBeNull();
    },
  );
});

describe('lerVersaoInstalada', () => {
  it('deveLerAVersaoDaTag', () => {
    expect(lerVersaoInstalada('1.9.0')).toEqual({ major: 1, minor: 9, patch: 0 });
  });

  it.each([['1.9.0+12.abc1234'], ['1.9.0+dev.12.abc1234'], ['1.9.0+12.abc1234.dirty']])(
    'deveCompararSoONucleoDeUmBuildForaDaTag %p',
    (versao) => {
      expect(lerVersaoInstalada(versao)).toEqual({ major: 1, minor: 9, patch: 0 });
    },
  );

  it.each([[undefined], [null], [''], ['1.9'], ['v1.9.0']])('deveVoltarNuloSemVersaoValida %p', (versao) => {
    expect(lerVersaoInstalada(versao)).toBeNull();
  });
});

describe('ehVersaoMaior', () => {
  const v = (major: number, minor: number, patch: number) => ({ major, minor, patch });

  it('deveCompararComoNumerosENaoComoTexto', () => {
    expect(ehVersaoMaior(v(1, 10, 0), v(1, 9, 0))).toBe(true);
    expect(ehVersaoMaior(v(1, 9, 10), v(1, 9, 9))).toBe(true);
  });

  it('deveDarFalsoParaVersaoIgualOuMenor', () => {
    expect(ehVersaoMaior(v(1, 9, 0), v(1, 9, 0))).toBe(false);
    expect(ehVersaoMaior(v(1, 8, 9), v(1, 9, 0))).toBe(false);
    expect(ehVersaoMaior(v(1, 99, 0), v(2, 0, 0))).toBe(false);
  });
});

describe('montarLinkDaAtualizacao', () => {
  const nova = { major: 2, minor: 0, patch: 0 };

  it('deveOferecerOApkQuandoAReleaseTemOAssetOficial', () => {
    expect(montarLinkDaAtualizacao(nova, [aabOficial, apkOficial])).toBe(LINK_DO_APK_200);
  });

  it('deveLevarAPaginaDaTagQuandoOApkNaoEstaNaRelease', () => {
    expect(montarLinkDaAtualizacao(nova, [aabOficial])).toBe(PAGINA_DA_TAG_200);
    expect(montarLinkDaAtualizacao(nova, [])).toBe(PAGINA_DA_TAG_200);
    expect(montarLinkDaAtualizacao(nova, undefined)).toBe(PAGINA_DA_TAG_200);
  });

  it('deveLevarAPaginaDaTagQuandoAUrlDoAssetForDiferenteDaMontada', () => {
    const adulterado = { name: 'snake-thai-v2.0.0.apk', browser_download_url: 'https://exemplo.com/snake-thai-v2.0.0.apk' };
    expect(montarLinkDaAtualizacao(nova, [adulterado])).toBe(PAGINA_DA_TAG_200);
  });

  it('deveIgnorarAssetComNomeParecido', () => {
    const outroNome = { name: 'snake-thai-v2.0.0-debug.apk', browser_download_url: LINK_DO_APK_200 };
    expect(montarLinkDaAtualizacao(nova, [outroNome, null, 'x'])).toBe(PAGINA_DA_TAG_200);
  });
});

describe('avaliarAtualizacao', () => {
  it('deveMostrarQuandoAReleaseEMaiorQueAInstalada', () => {
    expect(avaliarAtualizacao({ tag_name: 'v2.0.0', assets: [apkOficial] }, '1.9.0')).toEqual({
      instalada: '1.9.0',
      nova: '2.0.0',
      link: LINK_DO_APK_200,
    });
  });

  it('deveMostrarSoONucleoDaInstaladaForaDaTag', () => {
    expect(avaliarAtualizacao({ tag_name: 'v2.0.0', assets: [] }, '1.9.0+3.abc1234')?.instalada).toBe('1.9.0');
  });

  it('naoDeveMostrarComVersaoIgualMenorOuTagForaDoFormato', () => {
    expect(avaliarAtualizacao({ tag_name: 'v1.9.0' }, '1.9.0')).toBeNull();
    expect(avaliarAtualizacao({ tag_name: 'v1.8.0' }, '1.9.0')).toBeNull();
    expect(avaliarAtualizacao({ tag_name: 'v2.0.0-rc.1' }, '1.9.0')).toBeNull();
    expect(avaliarAtualizacao({}, '1.9.0')).toBeNull();
  });

  it('naoDeveMostrarSemVersaoInstalada', () => {
    expect(avaliarAtualizacao({ tag_name: 'v2.0.0' }, undefined)).toBeNull();
  });

  it('naoDeveMostrarComAMesmaVersaoInstaladaForaDaTag', () => {
    expect(avaliarAtualizacao({ tag_name: 'v1.9.0' }, '1.9.0+5.abc1234')).toBeNull();
  });
});

describe('diaEmSaoPaulo', () => {
  it('deveVirarODiaAMeiaNoiteDeSaoPauloENaoEmUtc', () => {
    // 02:30 UTC de 26/09 ainda é 23:30 de 25/09 em São Paulo.
    expect(diaEmSaoPaulo(new Date('2026-09-26T02:30:00Z'))).toBe('2026-09-25');
    expect(diaEmSaoPaulo(new Date('2026-09-26T03:00:00Z'))).toBe('2026-09-26');
  });

  it('deveCairNoUtcMenos3QuandoOMotorNaoConheceOFuso', () => {
    const original = Intl.DateTimeFormat;
    const semFuso = jest.fn(() => {
      throw new RangeError('fuso desconhecido');
    }) as unknown as typeof Intl.DateTimeFormat;
    Intl.DateTimeFormat = semFuso;
    try {
      expect(diaEmSaoPaulo(new Date('2026-09-26T02:30:00Z'))).toBe('2026-09-25');
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});
