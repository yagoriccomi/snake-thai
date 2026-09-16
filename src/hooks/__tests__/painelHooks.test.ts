import { act, renderHook } from '@testing-library/react-native';

const mockResumo = jest.fn();
const mockFaixas = jest.fn();
const mockFaturamento = jest.fn();
const mockEmRisco = jest.fn();
const mockRelatorio = jest.fn();
const mockLogError = jest.fn();

jest.mock('@/services/painel.service', () => ({
  fetchPainelResumo: (...args: unknown[]): unknown => mockResumo(...args),
  fetchInadimplenciaFaixas: (...args: unknown[]): unknown => mockFaixas(...args),
  fetchFaturamentoMensal: (...args: unknown[]): unknown => mockFaturamento(...args),
  fetchAlunosEmRisco: (...args: unknown[]): unknown => mockEmRisco(...args),
  fetchRelatorioInadimplencia: (...args: unknown[]): unknown => mockRelatorio(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useDelinquencyReport, type FiltroDeFaixa } from '@/hooks/useDelinquencyReport';

function devedor(nome: string, maiorAtrasoDias: number, totalDevidoCents: number) {
  return {
    userId: nome,
    nome,
    turma: 'Turma A',
    alunoAtivo: true,
    mensalidades: 1,
    totalDevidoCents,
    maiorAtrasoDias,
    vencimentoMaisAntigo: '2026-08-10',
  };
}

beforeEach(() => {
  for (const mock of [mockResumo, mockFaixas, mockFaturamento, mockEmRisco, mockRelatorio, mockLogError]) {
    mock.mockReset();
  }
  mockResumo.mockResolvedValue({ alunosAtivos: 50 });
  mockFaixas.mockResolvedValue([]);
  mockFaturamento.mockResolvedValue([]);
  mockEmRisco.mockResolvedValue([{ userId: 'a', nome: 'Ana Souza' }]);
});

describe('useAdminDashboard', () => {
  it('deveFazerUmaChamadaPorFuncaoACadaRecarga', async () => {
    const { result } = renderHook(() => useAdminDashboard());

    // Sem carga na montagem: quem chama é a tela, no foco.
    expect(mockResumo).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.reload();
    });

    for (const mock of [mockResumo, mockFaixas, mockFaturamento, mockEmRisco]) {
      expect(mock).toHaveBeenCalledTimes(1);
    }
    expect(result.current.dados?.resumo).toEqual({ alunosAtivos: 50 });
    expect(result.current.loading).toBe(false);
  });

  it('deveManterOsDadosAnterioresEAvisarQuandoARecargaFalha', async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await act(async () => {
      await result.current.reload();
    });

    mockFaturamento.mockRejectedValueOnce({ message: 'TypeError: Network request failed' });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe('Não foi possível carregar o painel. Verifique sua conexão.');
    expect(result.current.dados?.resumo).toEqual({ alunosAtivos: 50 });
    // O log leva só o erro, nunca as listas com nomes.
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockLogError.mock.calls)).not.toContain('Ana Souza');
  });
});

describe('useDelinquencyReport', () => {
  it('deveFiltrarPelaFaixaDoMaiorAtrasoERecalcularOTotal', async () => {
    mockRelatorio.mockResolvedValue([devedor('A', 75, 30000), devedor('B', 40, 20000), devedor('C', 5, 10000)]);
    const { result, rerender } = renderHook(({ filtro }: { filtro: FiltroDeFaixa }) => useDelinquencyReport(filtro), {
      initialProps: { filtro: 'todas' as FiltroDeFaixa },
    });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.linhas).toHaveLength(3);
    expect(result.current.totalCents).toBe(60000);

    rerender({ filtro: '31-60' });
    expect(result.current.linhas.map((d) => d.nome)).toEqual(['B']);
    expect(result.current.totalCents).toBe(20000);
    expect(result.current.totalDeDevedores).toBe(3);
    expect(mockRelatorio).toHaveBeenCalledTimes(1);
  });

  it('deveAvisarQuandoOCarregamentoFalha', async () => {
    mockRelatorio.mockRejectedValue({ code: '42501', message: 'Operação negada' });
    const { result } = renderHook(() => useDelinquencyReport('todas'));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe('Não foi possível carregar o relatório. Verifique sua conexão.');
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });
});
