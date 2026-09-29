import { renderHook, waitFor } from '@testing-library/react-native';

const mockSemanal = jest.fn();
const mockDoMes = jest.fn();
const mockSemanas = jest.fn();
const mockHistorico = jest.fn();

jest.mock('@/services/frequency.service', () => ({
  fetchFrequenciaSemanal: (...args: unknown[]): unknown => mockSemanal(...args),
  fetchFrequenciaDoMes: (...args: unknown[]): unknown => mockDoMes(...args),
  fetchSemanasDoMes: (...args: unknown[]): unknown => mockSemanas(...args),
  fetchMonthlyHistory: (...args: unknown[]): unknown => mockHistorico(...args),
}));

const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

import { useFrequenciaDoAluno } from '@/hooks/useFrequenciaDoAluno';
import { useFrequenciaDoMes } from '@/hooks/useFrequenciaDoMes';
import { mesDeFrequencia, semanaDeFrequencia, semanaDoMes } from '@/test-utils/frequencia';

beforeEach(() => {
  mockSemanal.mockReset();
  mockDoMes.mockReset();
  mockSemanas.mockReset();
  mockHistorico.mockReset();
  mockLogError.mockReset();
});

describe('useFrequenciaDoAluno', () => {
  it('deveTrazerASemanaEOMesDeHoje', async () => {
    mockSemanal.mockResolvedValue([semanaDeFrequencia()]);
    mockDoMes.mockResolvedValue([mesDeFrequencia()]);
    const { result } = renderHook(() => useFrequenciaDoAluno('aluno-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.semana?.frequencyPercent).toBe(150);
    expect(result.current.mes?.expected).toBe(8);
    const [ids, de, ate] = mockSemanal.mock.calls[0] as [string[], string, string];
    expect(ids).toEqual(['aluno-1']);
    expect(de).toBe(ate);
  });

  it('deveAvisarELogarAFalhaEmVezDeMostrarZero', async () => {
    mockSemanal.mockRejectedValue(new Error('Network request failed'));
    mockDoMes.mockResolvedValue([mesDeFrequencia()]);
    const { result } = renderHook(() => useFrequenciaDoAluno('aluno-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Não foi possível carregar a frequência.');
    expect(result.current.mes).toBeNull();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('naoDeveIrAoBancoSemAluno', async () => {
    const { result } = renderHook(() => useFrequenciaDoAluno(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSemanal).not.toHaveBeenCalled();
  });
});

describe('useFrequenciaDoMes', () => {
  it('deveTrazerOMesAsSemanasEOHistorico', async () => {
    mockDoMes.mockResolvedValue([mesDeFrequencia()]);
    mockSemanas.mockResolvedValue([semanaDoMes()]);
    mockHistorico.mockResolvedValue([{ reference_month: '2027-01-01' }]);
    const { result } = renderHook(() => useFrequenciaDoMes('aluno-1', '2027-02-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSemanas).toHaveBeenCalledWith('aluno-1', '2027-02-01');
    expect(result.current.semanas).toHaveLength(1);
    expect(result.current.historico).toHaveLength(1);
  });

  it('deveAvisarELogarAFalha', async () => {
    mockDoMes.mockRejectedValue(new Error('boom'));
    mockSemanas.mockResolvedValue([]);
    mockHistorico.mockResolvedValue([]);
    const { result } = renderHook(() => useFrequenciaDoMes('aluno-1', '2027-02-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Não foi possível carregar a frequência.');
    expect(mockLogError).toHaveBeenCalled();
  });
});
