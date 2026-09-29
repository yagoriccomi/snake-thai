import { act, renderHook } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

const mockBuscar = jest.fn();
const mockLerMemoria = jest.fn();
const mockGravarMemoria = jest.fn();
jest.mock('@/services/avisoDeAtualizacao.service', () => ({
  buscarUltimaRelease: (...args: unknown[]): unknown => mockBuscar(...args),
  lerMemoriaDoAviso: (...args: unknown[]): unknown => mockLerMemoria(...args),
  gravarMemoriaDoAviso: (...args: unknown[]): unknown => mockGravarMemoria(...args),
}));

const mockWarn = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: (...args: unknown[]): unknown => mockWarn(...args),
    error: (...args: unknown[]): unknown => mockError(...args),
  }),
}));

import { useAvisoDeAtualizacao } from '@/hooks/useAvisoDeAtualizacao';

const LINK_DO_APK =
  'https://github.com/yagoriccomi/snake-thai/releases/download/v2.0.0/snake-thai-v2.0.0.apk';
const RELEASE_200 = {
  tipo: 'release',
  release: {
    tag_name: 'v2.0.0',
    assets: [{ name: 'snake-thai-v2.0.0.apk', browser_download_url: LINK_DO_APK }],
  },
};
/** 25/09/2026, 12:00 em São Paulo. */
const HOJE = new Date('2026-09-25T15:00:00Z');
const ouvintesDoAppState: ((estado: string) => void)[] = [];

function montar(opcoes: Partial<Parameters<typeof useAvisoDeAtualizacao>[0]> = {}) {
  return renderHook(() =>
    useAvisoDeAtualizacao({ ativo: true, versaoInstalada: '1.9.0', agora: () => HOJE, ...opcoes }),
  );
}

/** Deixa as promessas encadeadas da consulta terminarem. */
async function esperarAConsulta(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBuscar.mockReset().mockResolvedValue(RELEASE_200);
  mockLerMemoria.mockReset().mockResolvedValue(null);
  mockGravarMemoria.mockReset().mockResolvedValue(undefined);
  ouvintesDoAppState.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_evento, ouvinte) => {
    ouvintesDoAppState.push(ouvinte as (estado: string) => void);
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  // Nenhum caminho do aviso é falha grave (§ 12.3: "nunca log.error").
  expect(mockError).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

describe('useAvisoDeAtualizacao', () => {
  it('deveMostrarAVersaoNovaEGravarODiaConsultado', async () => {
    const { result } = montar();
    await esperarAConsulta();

    expect(result.current.atualizacao).toEqual({ instalada: '1.9.0', nova: '2.0.0', link: LINK_DO_APK });
    expect(mockGravarMemoria).toHaveBeenCalledWith({ dia: '2026-09-25', ultimaTag: 'v2.0.0' });
  });

  it('naoDeveConsultarNoApkDev', async () => {
    const { result } = montar({ ativo: false });
    await esperarAConsulta();

    act(() => ouvintesDoAppState.forEach((ouvinte) => ouvinte('active')));
    await esperarAConsulta();

    expect(mockBuscar).not.toHaveBeenCalled();
    expect(mockLerMemoria).not.toHaveBeenCalled();
    expect(result.current.atualizacao).toBeNull();
  });

  it('naoDeveConsultarDeNovoNoMesmoDia', async () => {
    mockLerMemoria.mockResolvedValue({ dia: '2026-09-25', ultimaTag: 'v2.0.0' });
    const { result } = montar();
    await esperarAConsulta();

    expect(mockBuscar).not.toHaveBeenCalled();
    expect(result.current.atualizacao).toBeNull();
  });

  it('deveConsultarNoDiaSeguinteEmSaoPaulo', async () => {
    mockLerMemoria.mockResolvedValue({ dia: '2026-09-24', ultimaTag: 'v2.0.0' });
    const { result } = montar();
    await esperarAConsulta();

    expect(mockBuscar).toHaveBeenCalledTimes(1);
    expect(result.current.atualizacao?.nova).toBe('2.0.0');
  });

  it('naoDeveMostrarNemGravarODiaSemRedeOuComTempoEsgotado', async () => {
    mockBuscar.mockResolvedValue({ tipo: 'falha', motivo: 'tempo esgotado' });
    const { result } = montar();
    await esperarAConsulta();

    expect(result.current.atualizacao).toBeNull();
    expect(mockGravarMemoria).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith('Consulta da versão nova falhou', undefined, { motivo: 'tempo esgotado' });
  });

  it.each([[403], [429]])('deveContarODiaSemMostrarQuandoOGithubResponde %p', async (status) => {
    mockLerMemoria.mockResolvedValue({ dia: '2026-09-24', ultimaTag: 'v1.9.0' });
    mockBuscar.mockResolvedValue({ tipo: 'limite', status });
    const { result } = montar();
    await esperarAConsulta();

    expect(result.current.atualizacao).toBeNull();
    expect(mockGravarMemoria).toHaveBeenCalledWith({ dia: '2026-09-25', ultimaTag: 'v1.9.0' });
    expect(mockWarn).toHaveBeenCalled();
  });

  it.each([
    ['tag fora do formato', 'v2.0.0-rc.1', '1.9.0'],
    ['versão igual', 'v1.9.0', '1.9.0'],
    ['versão menor', 'v1.8.0', '1.9.0'],
    ['mesma versão fora da tag', 'v1.9.0', '1.9.0+4.abc1234'],
  ])('naoDeveMostrarCom %s', async (_caso, tag, instalada) => {
    mockBuscar.mockResolvedValue({ tipo: 'release', release: { tag_name: tag, assets: [] } });
    const { result } = montar({ versaoInstalada: instalada });
    await esperarAConsulta();

    expect(result.current.atualizacao).toBeNull();
    expect(mockGravarMemoria).toHaveBeenCalledWith({ dia: '2026-09-25', ultimaTag: tag });
  });

  it('deveCompararSoONucleoDaInstaladaComSufixoDoBuild', async () => {
    const { result } = montar({ versaoInstalada: '1.9.0+12.abc1234' });
    await esperarAConsulta();

    expect(result.current.atualizacao?.instalada).toBe('1.9.0');
  });

  it('deveConsultarAoVoltarAoPrimeiroPlanoSeAPrimeiraFalhou', async () => {
    mockBuscar.mockResolvedValueOnce({ tipo: 'falha', motivo: 'sem rede ou resposta inválida' });
    const { result } = montar();
    await esperarAConsulta();
    expect(result.current.atualizacao).toBeNull();

    act(() => ouvintesDoAppState.forEach((ouvinte) => ouvinte('active')));
    await esperarAConsulta();

    expect(mockBuscar).toHaveBeenCalledTimes(2);
    expect(result.current.atualizacao?.nova).toBe('2.0.0');
  });

  it('deveFazerUmaConsultaSoQuandoAbrirEVoltarChegamJuntos', async () => {
    let responder: (valor: unknown) => void = () => {};
    mockBuscar.mockReturnValue(new Promise((resolver) => (responder = resolver)));
    montar();
    await esperarAConsulta();

    act(() => ouvintesDoAppState.forEach((ouvinte) => ouvinte('active')));
    await esperarAConsulta();
    responder(RELEASE_200);
    await esperarAConsulta();

    expect(mockBuscar).toHaveBeenCalledTimes(1);
  });

  it('naoDeveTravarQuandoOArmazenamentoFalha', async () => {
    mockLerMemoria.mockRejectedValue(new Error('armazenamento indisponível'));
    mockGravarMemoria.mockRejectedValue(new Error('armazenamento indisponível'));
    const { result } = montar();
    await esperarAConsulta();

    expect(result.current.atualizacao?.nova).toBe('2.0.0');
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });

  it('naoDeveConsultarDeNovoAoVoltarNoMesmoDiaDepoisDeUmaConsultaComResposta', async () => {
    // Memória de verdade: o que a primeira consulta grava é o que a volta lê.
    let memoria: unknown = null;
    mockLerMemoria.mockImplementation(async () => memoria);
    mockGravarMemoria.mockImplementation(async (valor: unknown) => {
      memoria = valor;
    });
    const { result } = montar();
    await esperarAConsulta();
    act(() => result.current.dispensar());

    act(() => ouvintesDoAppState.forEach((ouvinte) => ouvinte('active')));
    await esperarAConsulta();

    // Uma consulta e um aviso por dia (§ 12.3): o "Agora não" vale até amanhã.
    expect(mockBuscar).toHaveBeenCalledTimes(1);
    expect(result.current.atualizacao).toBeNull();
  });

  it('deveFecharAoDispensar', async () => {
    const { result } = montar();
    await esperarAConsulta();

    act(() => result.current.dispensar());

    expect(result.current.atualizacao).toBeNull();
  });

  it('deveAbrirOLinkMontadoEFecharAoBaixar', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { result } = montar();
    await esperarAConsulta();

    act(() => result.current.baixar());
    await esperarAConsulta();

    expect(abrir).toHaveBeenCalledWith(LINK_DO_APK);
    expect(result.current.atualizacao).toBeNull();
  });

  it('deveManterOCartaoAbertoQuandoONavegadorNaoAbre', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sem navegador'));
    const { result } = montar();
    await esperarAConsulta();

    act(() => result.current.baixar());
    await esperarAConsulta();

    expect(result.current.atualizacao?.nova).toBe('2.0.0');
    expect(mockWarn).toHaveBeenCalledWith('Navegador não abriu o link da versão nova', expect.any(Error));
  });
});
