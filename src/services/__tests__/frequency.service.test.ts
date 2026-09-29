import { createQueryChain, NETWORK_FAILURE, RLS_DENIED } from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  fetchFrequenciaDoMes,
  fetchFrequenciaSemanal,
  fetchSemanasDoMes,
  fetchMonthlyHistory,
} from '@/services/frequency.service';

const ALUNO = '219ce3c9-5ad7-4319-9cde-7dbe07e1a573';
const AULA = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('fetchMonthlyHistory', () => {
  it('deveListarOHistoricoDoAlunoDoMesMaisRecenteParaOMaisAntigo', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchMonthlyHistory(ALUNO);

    expect(mockFrom).toHaveBeenCalledWith('attendance_monthly');
    expect(chain.eq).toHaveBeenCalledWith('user_id', ALUNO);
    expect(chain.order).toHaveBeenCalledWith('reference_month', { ascending: false });
  });
});

describe('frequência nova (contrato § 11.6)', () => {
  it('deveLerASemanaETrazerOPercentualNuloComoNulo', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: ALUNO, week_start: '2027-02-01', week_end: '2027-02-07', schedule_mode: 'free',
          weekly_target: 2, expected: 0, attended: 0, excused: 0, cancelled: 0, frequency_percent: null,
        },
      ],
      error: null,
    });
    const [semana] = await fetchFrequenciaSemanal([ALUNO], '2027-02-03', '2027-02-03');
    expect(mockRpc).toHaveBeenCalledWith('frequencia_semanal', { p_user_ids: [ALUNO], p_de: '2027-02-03', p_ate: '2027-02-03' });
    // Nulo não pode virar 0: a tela mostra "—" (T9).
    expect(semana?.frequencyPercent).toBeNull();
    expect(semana?.weeklyTarget).toBe(2);
  });

  it('deveLerOMesComAcimaDeCem', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: ALUNO, reference_month: '2027-02-01', schedule_mode: 'fixed', expected: 8, attended: 9,
          excused: 0, cancelled: 1, frequency_percent: 112.5, closes_on: '2027-02-28', is_closed: false,
          expected_to_date: 5, attended_to_date: 6,
        },
      ],
      error: null,
    });
    const [mes] = await fetchFrequenciaDoMes([ALUNO], '2027-02-10');
    expect(mockRpc).toHaveBeenCalledWith('frequencia_do_mes', { p_user_ids: [ALUNO], p_mes: '2027-02-10' });
    expect(mes).toMatchObject({ frequencyPercent: 112.5, closesOn: '2027-02-28', expectedToDate: 5, attendedToDate: 6 });
  });

  it('naoDeveIrAoBancoSemAlunos', async () => {
    await expect(fetchFrequenciaDoMes([], '2027-02-01')).resolves.toEqual([]);
    await expect(fetchFrequenciaSemanal([], '2027-02-01', '2027-02-07')).resolves.toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deveLerAsSemanasComAsJustificativas', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          week_start: '2026-09-28', week_end: '2026-10-04', label: 'Semana extra', is_split: true,
          expected_week: 2, attended_week: 2, week_percent: 100, expected_in_month: 0, attended_in_month: 0,
          excused_week: 0, can_justify: true, justify_until: '2026-10-11T03:00:00+00:00', justifications_left: 1,
          justificativas: [{ id: 'j-1', status: 'approved', attempt: 1, approved_by_name: 'Ana' }],
        },
      ],
      error: null,
    });
    const [semana] = await fetchSemanasDoMes(ALUNO, '2026-09-01');
    expect(mockRpc).toHaveBeenCalledWith('semanas_do_mes', { p_user_id: ALUNO, p_mes: '2026-09-01' });
    expect(semana).toMatchObject({ label: 'Semana extra', isSplit: true, justificationsLeft: 1 });
    expect(semana?.justificativas).toEqual([{ id: 'j-1', status: 'approved', attempt: 1, approvedByName: 'Ana' }]);
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockRpc.mockResolvedValue(RLS_DENIED);
    await expect(fetchSemanasDoMes('outro', '2026-09-01')).rejects.toEqual(RLS_DENIED.error);
  });
});
