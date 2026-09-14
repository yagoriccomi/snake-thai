import { renderHook, waitFor } from '@testing-library/react-native';

const mockFetchPaymentHistory = jest.fn();

jest.mock('@/services/payments.service', () => ({
  fetchPaymentHistory: (...args: unknown[]): unknown => mockFetchPaymentHistory(...args),
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

import { usePaymentHistory } from '@/hooks/usePaymentHistory';

beforeEach(() => {
  mockFetchPaymentHistory.mockReset();
  mockLogError.mockReset();
});

describe('usePaymentHistory', () => {
  it('deveCarregarOHistoricoDoAlunoInformado', async () => {
    const historico = [{ id: 'p1', reference_month: '2026-08-01', status: 'paid' }];
    mockFetchPaymentHistory.mockResolvedValue(historico);

    const { result } = renderHook(() => usePaymentHistory('aluno-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchPaymentHistory).toHaveBeenCalledWith('aluno-1');
    expect(result.current.payments).toEqual(historico);
    expect(result.current.error).toBeNull();
  });

  it('deveSinalizarErroEmVezDeDizerQueNaoHaCobrancas', async () => {
    mockFetchPaymentHistory.mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => usePaymentHistory('aluno-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(mockLogError).toHaveBeenCalled();
  });
});
