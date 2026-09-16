import { renderHook, waitFor } from '@testing-library/react-native';

const mockFetchAllStudents = jest.fn();
const mockFetchPlans = jest.fn();
const mockFetchPaymentsForMonth = jest.fn();
const mockFetchPaymentMonthsOverview = jest.fn();

jest.mock('@/services/profile.service', () => ({
  fetchAllStudents: (...args: unknown[]): unknown => mockFetchAllStudents(...args),
}));
jest.mock('@/services/plans.service', () => ({
  fetchPlans: (...args: unknown[]): unknown => mockFetchPlans(...args),
}));
jest.mock('@/services/payments.service', () => ({
  fetchPaymentsForMonth: (...args: unknown[]): unknown => mockFetchPaymentsForMonth(...args),
  fetchPaymentMonthsOverview: (...args: unknown[]): unknown =>
    mockFetchPaymentMonthsOverview(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { useAdminPayments } from '@/hooks/useAdminPayments';

function pagamento(id: string, status: string, amount_cents: number) {
  return { id, user_id: 'aluno-1', plan_id: 'plano-1', status, amount_cents, reference_month: '2026-08-01' };
}

beforeEach(() => {
  mockFetchAllStudents.mockReset().mockResolvedValue([{ id: 'aluno-1', name: 'Ana Souza' }]);
  mockFetchPlans.mockReset().mockResolvedValue([{ id: 'plano-1', name: 'Mensal 2x' }]);
  mockFetchPaymentsForMonth.mockReset().mockResolvedValue([
    pagamento('p1', 'paid', 10000),
    pagamento('p2', 'paid', 10000),
    pagamento('p3', 'overdue', 10000),
    pagamento('p4', 'pending_approval', 10000),
  ]);
  mockFetchPaymentMonthsOverview.mockReset().mockResolvedValue([
    { reference_month: '2026-08-01', status: 'paid' },
    { reference_month: '2026-08-01', status: 'overdue' },
    { reference_month: '2026-07-01', status: 'paid' },
  ]);
});

describe('useAdminPayments', () => {
  it('deveConsultarAsMensalidadesDoMesEscolhido', async () => {
    const { result } = renderHook(() => useAdminPayments('2026-08-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchPaymentsForMonth).toHaveBeenCalledWith('2026-08-01');
  });

  it('deveSepararPorSituacaoESomarORecebidoDaCompetencia', async () => {
    const { result } = renderHook(() => useAdminPayments('2026-08-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.paid.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.overdue.map((p) => p.id)).toEqual(['p3']);
    expect(result.current.pending.map((p) => p.id)).toEqual(['p4']);
    expect(result.current.totals).toEqual(
      expect.objectContaining({ receivedCents: 20000, overdueCents: 10000, overdueCount: 1 }),
    );
    expect(result.current.paid[0]).toEqual(
      expect.objectContaining({ studentName: 'Ana Souza', planName: 'Mensal 2x' }),
    );
  });

  it('deveMarcarNoSeletorOMesQueTemAtraso', async () => {
    const { result } = renderHook(() => useAdminPayments('2026-08-01'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.months).toEqual(
      expect.arrayContaining([
        { referenceMonth: '2026-08-01', situacao: 'overdue' },
        { referenceMonth: '2026-07-01', situacao: 'paid' },
      ]),
    );
  });

  it('deveSinalizarErroEmVezDeMostrarMesVazio', async () => {
    mockFetchPaymentsForMonth.mockRejectedValue(new Error('Network request failed'));
    const { result } = renderHook(() => useAdminPayments('2026-08-01'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
});
