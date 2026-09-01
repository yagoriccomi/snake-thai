import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFetchPlans = jest.fn();
const mockCreatePlan = jest.fn();
const mockDeactivatePlan = jest.fn();

jest.mock('@/services/plans.service', () => ({
  fetchPlans: (...args: unknown[]): unknown => mockFetchPlans(...args),
  createPlan: (...args: unknown[]): unknown => mockCreatePlan(...args),
  updatePlan: jest.fn(),
  deactivatePlan: (...args: unknown[]): unknown => mockDeactivatePlan(...args),
}));

// O logger escreve no console; silenciamos para não poluir a saída do teste,
// mas continuamos podendo verificar que a falha FOI registrada.
const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

import { usePlans } from '@/hooks/usePlans';

const PLANO = {
  id: 'plan-1',
  name: 'Mensal 3x',
  description: null,
  price_cents: 12990,
  billing_period: 'monthly',
  due_day: 10,
  is_active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

beforeEach(() => {
  mockFetchPlans.mockReset();
  mockCreatePlan.mockReset();
  mockDeactivatePlan.mockReset();
  mockLogError.mockReset();
});

describe('usePlans — falha de carga não pode virar lista vazia silenciosa', () => {
  it('deveSinalizarErroEmVezDeFingirQueNaoHaPlanos', async () => {
    mockFetchPlans.mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => usePlans());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // A regressão que este teste trava: antes, o hook devolvia [] sem erro e a
    // tela dizia "nenhum plano cadastrado" — o admin acreditaria que perdeu os
    // dados, quando só faltou rede.
    expect(result.current.error).not.toBeNull();
    expect(result.current.plans).toEqual([]);
  });

  it('deveRegistrarAFalhaNoLogEstruturado', async () => {
    mockFetchPlans.mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => usePlans());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Erro avisado ao usuário E registrado para quem for depurar.
    expect(mockLogError).toHaveBeenCalled();
  });

  it('naoDeveExporDetalheTecnicoNaMensagemDoUsuario', async () => {
    mockFetchPlans.mockRejectedValue(
      new Error('TypeError: Network request failed at XMLHttpRequest.send'),
    );

    const { result } = renderHook(() => usePlans());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toMatch(/TypeError|XMLHttpRequest|at /);
  });

  it('deveLimparOErroQuandoARecargaFunciona', async () => {
    mockFetchPlans.mockRejectedValueOnce(new Error('falhou'));

    const { result } = renderHook(() => usePlans());
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    mockFetchPlans.mockResolvedValue([PLANO]);
    await act(async () => {
      await result.current.reload();
    });

    // Erro que não some depois de resolver vira ruído permanente na tela.
    expect(result.current.error).toBeNull();
    expect(result.current.plans).toEqual([PLANO]);
  });

  it('naoDeveSinalizarErroQuandoAListaEstaGenuinamenteVazia', async () => {
    mockFetchPlans.mockResolvedValue([]);

    const { result } = renderHook(() => usePlans());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Distinção que importa: "não há planos" é diferente de "não deu para saber".
    expect(result.current.error).toBeNull();
    expect(result.current.plans).toEqual([]);
  });

  it('devePropagarAFalhaDeCriacaoParaAsTelaTratar', async () => {
    mockFetchPlans.mockResolvedValue([]);
    mockCreatePlan.mockRejectedValue(new Error('RLS'));

    const { result } = renderHook(() => usePlans());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      result.current.add({
        name: 'X',
        description: null,
        priceCents: 100,
        billingPeriod: 'monthly',
        dueDay: 10,
        isActive: true,
      }),
    ).rejects.toThrow('RLS');
  });

  it('deveRepassarOFiltroDeAtivosParaOServico', async () => {
    mockFetchPlans.mockResolvedValue([PLANO]);

    renderHook(() => usePlans(true));

    await waitFor(() => {
      expect(mockFetchPlans).toHaveBeenCalledWith(true);
    });
  });
});
