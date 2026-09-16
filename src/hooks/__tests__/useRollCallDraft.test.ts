import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

const mockLerRascunho = jest.fn();
const mockGuardarRascunho = jest.fn();
const mockApagarRascunho = jest.fn();
const mockApagarRascunhosVencidos = jest.fn();

jest.mock('@/services/rollCallDraft.service', () => ({
  lerRascunho: (...args: unknown[]): unknown => mockLerRascunho(...args),
  guardarRascunho: (...args: unknown[]): unknown => mockGuardarRascunho(...args),
  apagarRascunho: (...args: unknown[]): unknown => mockApagarRascunho(...args),
  apagarRascunhosVencidos: (...args: unknown[]): unknown => mockApagarRascunhosVencidos(...args),
}));

const mockLogWarn = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: (...args: unknown[]): unknown => mockLogWarn(...args),
    error: jest.fn(),
  }),
}));

import { useRollCallDraft } from '@/hooks/useRollCallDraft';
import type { AttendanceStatus } from '@/services/classes.service';
import {
  ATRASO_PARA_GUARDAR_MS,
  VALIDADE_DO_RASCUNHO_MS,
  VERSAO_DO_RASCUNHO,
  type MarcacoesGravadas,
  type RascunhoGuardado,
} from '@/utils/rollCallDraft';

const PROFESSOR = 'prof-1';
const AULA = 'aula-1';
const ALUNOS = ['aluno-1', 'aluno-2', 'aluno-3'];
const VAZIO: MarcacoesGravadas = {};

let mockOuvinteDoAppState: ((estado: AppStateStatus) => void) | null = null;

interface Props {
  userId: string | null;
  gravado: MarcacoesGravadas;
  concluidaEm: string | null;
  ativo: boolean;
}

function renderRascunho(inicial: Partial<Props> = {}) {
  const initialProps: Props = { userId: PROFESSOR, gravado: VAZIO, concluidaEm: null, ativo: true, ...inicial };
  return renderHook(
    (props: Props) => useRollCallDraft({ ...props, classId: AULA, alunoIds: ALUNOS }),
    { initialProps },
  );
}

function guardado(parcial: Partial<RascunhoGuardado> = {}): RascunhoGuardado {
  return {
    versao: VERSAO_DO_RASCUNHO,
    classId: AULA,
    salvoEm: new Date(Date.now() - 60_000).toISOString(),
    base: { marcacoes: {}, concluidaEm: null },
    marcacoes: { 'aluno-1': 'present', 'aluno-2': 'absent' },
    ...parcial,
  };
}

/** Avança o debounce e deixa a fila de gravações andar. */
async function avancar(ms = ATRASO_PARA_GUARDAR_MS): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

async function esperarPronto(result: { current: { pronto: boolean } }): Promise<void> {
  await waitFor(() => expect(result.current.pronto).toBe(true));
  await act(async () => {
    await Promise.resolve();
  });
}

function marcar(result: { current: { marcar: (id: string, s: AttendanceStatus) => void } }, id: string, status: AttendanceStatus): void {
  act(() => {
    result.current.marcar(id, status);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLerRascunho.mockReset().mockResolvedValue(null);
  mockGuardarRascunho.mockReset().mockResolvedValue(undefined);
  mockApagarRascunho.mockReset().mockResolvedValue(undefined);
  mockApagarRascunhosVencidos.mockReset().mockResolvedValue(0);
  mockLogWarn.mockReset();
  mockOuvinteDoAppState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_tipo, ouvinte) => {
    mockOuvinteDoAppState = ouvinte as (estado: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useRollCallDraft', () => {
  it('naoDeveApagarNemGravarAntesDeCarregar', async () => {
    renderRascunho({ ativo: false });

    await avancar();

    expect(mockLerRascunho).not.toHaveBeenCalled();
    expect(mockApagarRascunho).not.toHaveBeenCalled();
    expect(mockGuardarRascunho).not.toHaveBeenCalled();
  });

  it('deveRestaurarOsRascunhosEAvisarRecuperado', async () => {
    const registro = guardado();
    mockLerRascunho.mockResolvedValue(registro);

    const { result } = renderRascunho();
    await esperarPronto(result);

    expect(result.current.rascunho).toEqual(registro.marcacoes);
    expect(result.current.aviso).toEqual({ tipo: 'recuperado', salvoEm: registro.salvoEm });
    await avancar();
    // Só abrir a tela não regrava (e não renova a validade).
    expect(mockGuardarRascunho).not.toHaveBeenCalled();
  });

  it('deveAcusarConflitoQuandoOGravadoMudouDesdeABase', async () => {
    mockLerRascunho.mockResolvedValue(guardado());
    const gravado = { 'aluno-3': 'present' } as const;

    const { result } = renderRascunho({ gravado });
    await esperarPronto(result);

    expect(result.current.aviso?.tipo).toBe('conflito');
    expect(result.current.rascunho).toEqual(gravado);
    marcar(result, 'aluno-1', 'absent');
    await avancar();
    expect(result.current.rascunho).toEqual(gravado);
    expect(mockGuardarRascunho).not.toHaveBeenCalled();
    expect(mockApagarRascunho).not.toHaveBeenCalled();
  });

  it('usarMeuRascunhoDeveAplicarERebasear', async () => {
    const registro = guardado();
    mockLerRascunho.mockResolvedValue(registro);
    const gravado = { 'aluno-3': 'present' } as const;
    const { result } = renderRascunho({ gravado, concluidaEm: '2026-09-16T10:00:00Z' });
    await esperarPronto(result);

    act(() => {
      result.current.usarMeuRascunho();
    });
    await avancar();

    expect(result.current.rascunho).toEqual(registro.marcacoes);
    expect(result.current.aviso?.tipo).toBe('recuperado');
    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
    expect(mockGuardarRascunho.mock.calls[0]?.[1]).toMatchObject({
      base: { marcacoes: gravado, concluidaEm: '2026-09-16T10:00:00Z' },
      marcacoes: registro.marcacoes,
    });
  });

  it('deveApagarEmSilencioRascunhoIdenticoAoGravado', async () => {
    const registro = guardado();
    mockLerRascunho.mockResolvedValue(registro);

    const { result } = renderRascunho({ gravado: registro.marcacoes });
    await esperarPronto(result);

    expect(result.current.aviso).toBeNull();
    expect(mockApagarRascunho).toHaveBeenCalledWith(PROFESSOR, AULA);
  });

  it('deveApagarEmSilencioRascunhoVencido', async () => {
    mockLerRascunho.mockResolvedValue(
      guardado({ salvoEm: new Date(Date.now() - VALIDADE_DO_RASCUNHO_MS - 1).toISOString() }),
    );

    const { result } = renderRascunho();
    await esperarPronto(result);

    expect(result.current.aviso).toBeNull();
    expect(result.current.rascunho).toEqual(VAZIO);
    expect(mockApagarRascunho).toHaveBeenCalledWith(PROFESSOR, AULA);
  });

  it('deveJuntarMarcacoesSeguidasNumaGravacaoSo', async () => {
    const { result } = renderRascunho();
    await esperarPronto(result);

    marcar(result, 'aluno-1', 'present');
    marcar(result, 'aluno-2', 'absent');
    marcar(result, 'aluno-3', 'present');
    await avancar();

    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
    expect(mockGuardarRascunho.mock.calls[0]?.[1]).toMatchObject({
      classId: AULA,
      base: { marcacoes: {}, concluidaEm: null },
      marcacoes: { 'aluno-1': 'present', 'aluno-2': 'absent', 'aluno-3': 'present' },
    });
  });

  it('deveApagarQuandoAsMarcacoesVoltamAoGravado', async () => {
    const { result } = renderRascunho();
    await esperarPronto(result);

    marcar(result, 'aluno-1', 'present');
    await avancar();
    marcar(result, 'aluno-1', 'present');
    await avancar();

    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
    expect(mockApagarRascunho).toHaveBeenCalledTimes(1);
  });

  it('descartarDeveCancelarGravacaoPendente', async () => {
    const { result } = renderRascunho({ gravado: { 'aluno-2': 'absent' } });
    await esperarPronto(result);

    marcar(result, 'aluno-1', 'present');
    await act(async () => {
      await result.current.descartar();
    });
    await avancar();

    expect(result.current.rascunho).toEqual({ 'aluno-2': 'absent' });
    expect(mockGuardarRascunho).not.toHaveBeenCalled();
    expect(mockApagarRascunho).toHaveBeenCalledWith(PROFESSOR, AULA);
  });

  it('esquecerDeveApagarENaoRegravarAposARecarga', async () => {
    const { result, rerender } = renderRascunho();
    await esperarPronto(result);
    marcar(result, 'aluno-1', 'present');
    await avancar();

    await act(async () => {
      await result.current.esquecer();
    });
    // Recarga depois de salvar: o gravado agora é o que foi marcado.
    rerender({ userId: PROFESSOR, gravado: { 'aluno-1': 'present' }, concluidaEm: '2026-09-16T12:00:00Z', ativo: true });
    await avancar();

    expect(mockApagarRascunho).toHaveBeenCalledTimes(1);
    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
    expect(result.current.rascunho).toEqual({ 'aluno-1': 'present' });
  });

  it('deveGravarNaHoraAoIrParaSegundoPlano', async () => {
    const { result } = renderRascunho();
    await esperarPronto(result);
    marcar(result, 'aluno-1', 'absent');

    await act(async () => {
      mockOuvinteDoAppState?.('background');
      await Promise.resolve();
    });

    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
  });

  it('deveGravarAoSairDaTelaComMarcacaoPendente', async () => {
    const { result, unmount } = renderRascunho();
    await esperarPronto(result);
    marcar(result, 'aluno-1', 'absent');

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGuardarRascunho).toHaveBeenCalledTimes(1);
  });

  it('naoDeveLerNemGravarSemUsuario', async () => {
    const { result } = renderRascunho({ userId: null });

    marcar(result, 'aluno-1', 'present');
    await avancar();

    expect(result.current.rascunho).toEqual({ 'aluno-1': 'present' });
    expect(mockLerRascunho).not.toHaveBeenCalled();
    expect(mockGuardarRascunho).not.toHaveBeenCalled();
  });

  it('falhaDoArmazenamentoNaoDeveQuebrarATela', async () => {
    mockLerRascunho.mockRejectedValue(new Error('Keystore indisponível'));
    mockGuardarRascunho.mockRejectedValue(new Error('Keystore indisponível'));

    const { result } = renderRascunho({ gravado: { 'aluno-2': 'absent' } });
    await esperarPronto(result);
    marcar(result, 'aluno-1', 'present');
    await avancar();

    expect(result.current.rascunho).toEqual({ 'aluno-1': 'present', 'aluno-2': 'absent' });
    expect(mockLogWarn).toHaveBeenCalledTimes(2);
  });
});
