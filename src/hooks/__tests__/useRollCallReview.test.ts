import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFetchRollCallState = jest.fn();
const mockSaveRollCall = jest.fn();
const mockFetchJustificationsForClass = jest.fn();
const mockReviewJustification = jest.fn();

jest.mock('@/services/frequency.service', () => ({
  fetchRollCallState: (...args: unknown[]): unknown => mockFetchRollCallState(...args),
  saveRollCall: (...args: unknown[]): unknown => mockSaveRollCall(...args),
}));

jest.mock('@/services/justifications.service', () => ({
  fetchJustificationsForClass: (...args: unknown[]): unknown =>
    mockFetchJustificationsForClass(...args),
  reviewJustification: (...args: unknown[]): unknown => mockReviewJustification(...args),
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

import { useRollCallReview } from '@/hooks/useRollCallReview';

const AULA = 'aula-1';
const ESTADO = { type: 'routine', dateTimeIso: '2026-11-03T22:00:00+00:00', concludedAt: null };
const JUSTIFICATIVA = { id: 'just-1', user_id: 'aluno-1', class_id: AULA, status: 'pending' };
const CHAMADA = { presentes: ['aluno-1'], ausentes: ['aluno-2'] };

beforeEach(() => {
  mockFetchRollCallState.mockReset().mockResolvedValue(ESTADO);
  mockFetchJustificationsForClass.mockReset().mockResolvedValue([JUSTIFICATIVA]);
  mockSaveRollCall.mockReset().mockResolvedValue('2026-11-03T23:00:00+00:00');
  mockReviewJustification.mockReset().mockResolvedValue(undefined);
  mockLogError.mockReset();
});

describe('useRollCallReview', () => {
  it('deveIndexarAsJustificativasPeloAluno', async () => {
    const { result } = renderHook(() => useRollCallReview(AULA));

    await waitFor(() => expect(result.current.state).toEqual(ESTADO));
    expect(result.current.justificationsByUser['aluno-1']).toEqual(JUSTIFICATIVA);
  });

  it('deveSinalizarFalhaDeCargaEmVezDeFingirChamadaAberta', async () => {
    mockFetchRollCallState.mockRejectedValue(new Error('Network request failed'));
    const { result } = renderHook(() => useRollCallReview(AULA));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.state).toBeNull();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('deveSalvarAChamadaInteiraERecarregarParaMostrarAConclusao', async () => {
    const { result } = renderHook(() => useRollCallReview(AULA));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    const concluida = { ...ESTADO, concludedAt: '2026-11-03T23:00:00+00:00' };
    mockFetchRollCallState.mockResolvedValue(concluida);
    await act(() => result.current.save(CHAMADA));

    expect(mockSaveRollCall).toHaveBeenCalledWith(AULA, CHAMADA);
    expect(result.current.state).toEqual(concluida);
  });

  it('devePropagarRecusaAoSalvar', async () => {
    const recusa = { code: '42501', message: 'permission denied' };
    mockSaveRollCall.mockRejectedValue(recusa);
    const { result } = renderHook(() => useRollCallReview(AULA));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    // A tela precisa saber que falhou para manter as marcações e avisar.
    await expect(result.current.save(CHAMADA)).rejects.toEqual(recusa);
  });

  it('deveRevisarERecarregar', async () => {
    const { result } = renderHook(() => useRollCallReview(AULA));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(() => result.current.review('just-1', 'approved'));

    expect(mockReviewJustification).toHaveBeenCalledWith('just-1', 'approved');
    expect(mockFetchJustificationsForClass).toHaveBeenCalledTimes(2);
  });
});
