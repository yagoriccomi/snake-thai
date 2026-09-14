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
  concludeRollCall,
  fetchMissedRollCalls,
  fetchMonthlyFrequency,
  fetchMonthlyHistory,
  fetchRollCallState,
} from '@/services/frequency.service';

const ALUNO = '219ce3c9-5ad7-4319-9cde-7dbe07e1a573';
const AULA = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('fetchMonthlyFrequency', () => {
  it('naoDeveIrAoBancoQuandoNaoHaAlunos', async () => {
    // Turma vazia não pode custar uma requisição.
    await expect(fetchMonthlyFrequency([])).resolves.toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deveConsultarTodosOsAlunosNumaChamadaSo', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await fetchMonthlyFrequency([ALUNO, 'outro']);
    // Uma RPC para a turma inteira, não uma por aluno. [#70]
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('frequencia_mensal', { p_user_ids: [ALUNO, 'outro'] });
  });

  it('deveTraduzirARespostaDoBancoSemRefazerAConta', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: ALUNO,
          reference_month: '2026-11-01',
          total_classes: 8,
          counted_classes: 4,
          attended: 1,
          justified: 1,
          frequency_percent: 33.33,
        },
      ],
      error: null,
    });

    await expect(fetchMonthlyFrequency([ALUNO])).resolves.toEqual([
      {
        userId: ALUNO,
        referenceMonth: '2026-11-01',
        totalClasses: 8,
        countedClasses: 4,
        attended: 1,
        justified: 1,
        frequencyPercent: 33.33,
      },
    ]);
  });

  it('deveConverterPercentualQueChegaComoTextoEmNumero', async () => {
    // `numeric` do Postgres pode atravessar o PostgREST como string; a tela
    // não pode receber "100.00" e compará-lo com 100.
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: ALUNO,
          reference_month: '2026-11-01',
          total_classes: 9,
          counted_classes: 0,
          attended: 0,
          justified: 0,
          frequency_percent: '100.00',
        },
      ],
      error: null,
    });

    const [resultado] = await fetchMonthlyFrequency([ALUNO]);
    expect(resultado?.frequencyPercent).toBe(100);
  });

  it('devePropagarFalhaDeRede', async () => {
    mockRpc.mockResolvedValue({ data: null, error: NETWORK_FAILURE.error });
    await expect(fetchMonthlyFrequency([ALUNO])).rejects.toEqual(NETWORK_FAILURE.error);
  });
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

describe('fetchRollCallState', () => {
  it('deveTraduzirAAulaParaOEstadoDaChamada', async () => {
    const chain = createQueryChain({
      data: { type: 'routine', date_time: '2026-11-03T22:00:00+00:00', attendance_taken_at: null },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    await expect(fetchRollCallState(AULA)).resolves.toEqual({
      type: 'routine',
      dateTimeIso: '2026-11-03T22:00:00+00:00',
      concludedAt: null,
    });
    expect(mockFrom).toHaveBeenCalledWith('classes');
    expect(chain.eq).toHaveBeenCalledWith('id', AULA);
  });

  it('devePropagarAFalhaEmVezDeFingirChamadaAberta', async () => {
    // Engolir o erro devolveria "não concluída" e ofereceria concluir de novo.
    mockFrom.mockReturnValue(createQueryChain(NETWORK_FAILURE));
    await expect(fetchRollCallState(AULA)).rejects.toEqual(NETWORK_FAILURE.error);
  });
});

describe('concludeRollCall', () => {
  it('deveConcluirPelaFuncaoDoBancoEDevolverOInstante', async () => {
    mockRpc.mockResolvedValue({ data: '2026-11-05T23:00:00+00:00', error: null });

    await expect(concludeRollCall(AULA)).resolves.toBe('2026-11-05T23:00:00+00:00');
    // Nunca um UPDATE direto em classes: a policy de UPDATE é só do admin, e
    // é a função que aplica "só o professor da aula" e "aula já começou".
    expect(mockRpc).toHaveBeenCalledWith('concluir_chamada', { p_class_id: AULA });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('devePropagarARecusaDeQuemNaoEhProfessorDaAula', async () => {
    mockRpc.mockResolvedValue({ data: null, error: RLS_DENIED.error });
    await expect(concludeRollCall(AULA)).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('fetchMissedRollCalls', () => {
  it('deveTraduzirOsAvisosDeAulaSemChamada', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          class_id: AULA,
          title: 'Muay Thai — Turma Noite',
          date_time: '2026-11-12T22:00:00+00:00',
          group_id: 'turma-noite',
        },
      ],
      error: null,
    });

    await expect(fetchMissedRollCalls()).resolves.toEqual([
      {
        classId: AULA,
        title: 'Muay Thai — Turma Noite',
        dateTimeIso: '2026-11-12T22:00:00+00:00',
        groupId: 'turma-noite',
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('aulas_sem_chamada');
  });
});
