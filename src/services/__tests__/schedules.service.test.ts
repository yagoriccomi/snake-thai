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
  endSchedule,
  fetchSchedulesForGroup,
  saveSchedule,
  type ScheduleInput,
} from '@/services/schedules.service';
import { describeError } from '@/utils/errors';

const HORARIO = {
  id: 'h-1',
  group_id: 'turma-a',
  title: 'Muay Thai',
  weekday: 1,
  start_time: '19:00:00',
  valid_from: '2030-03-01',
  valid_until: null,
  created_by: 'admin-1',
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
};

const ENTRADA: ScheduleInput = {
  id: null,
  groupId: 'turma-a',
  title: '  Muay Thai ',
  weekday: 1,
  startTime: '19:00',
  validFromIso: '2030-03-01',
  validUntilIso: null,
  teacherIds: ['p-1'],
};

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('fetchSchedulesForGroup', () => {
  it('naoDeveBuscarProfessoresQuandoNaoHaHorarios', async () => {
    mockFrom.mockReturnValue(createQueryChain({ data: [], error: null }));

    await expect(fetchSchedulesForGroup('turma-a')).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('deveJuntarOsProfessoresPeloDiretorio', async () => {
    const horarios = createQueryChain({ data: [HORARIO, { ...HORARIO, id: 'h-2' }], error: null });
    const vinculos = createQueryChain({
      data: [
        { schedule_id: 'h-1', teacher_id: 'p-1' },
        { schedule_id: 'h-1', teacher_id: 'p-2' },
      ],
      error: null,
    });
    const diretorio = createQueryChain({
      data: [
        { id: 'p-1', name: 'Prof. Ana', color: '#FF0000' },
        { id: 'p-2', name: 'Prof. Bruno', color: '#00FF00' },
      ],
      error: null,
    });
    mockFrom.mockImplementation((tabela: string) => {
      if (tabela === 'class_schedules') return horarios;
      if (tabela === 'class_schedule_teachers') return vinculos;
      return diretorio;
    });

    const resultado = await fetchSchedulesForGroup('turma-a');

    expect(horarios.eq).toHaveBeenCalledWith('group_id', 'turma-a');
    expect(vinculos.in).toHaveBeenCalledWith('schedule_id', ['h-1', 'h-2']);
    expect(diretorio.in).toHaveBeenCalledWith('id', ['p-1', 'p-2']);
    expect(resultado).toEqual([
      {
        schedule: HORARIO,
        teachers: [
          { id: 'p-1', name: 'Prof. Ana', color: '#FF0000' },
          { id: 'p-2', name: 'Prof. Bruno', color: '#00FF00' },
        ],
      },
      { schedule: { ...HORARIO, id: 'h-2' }, teachers: [] },
    ]);
  });

  it('devePropagarARecusaDaRls', async () => {
    mockFrom.mockReturnValue(createQueryChain(RLS_DENIED));
    await expect(fetchSchedulesForGroup('turma-a')).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('saveSchedule', () => {
  const RESPOSTA = { schedule_id: 'h-1', ajustadas: 0, removidas: 0, criadas: 9 };

  it('deveCriarMandandoAHoraComoTextoEOmitindoOsOpcionais', async () => {
    mockRpc.mockResolvedValue({ data: RESPOSTA, error: null });

    const resultado = await saveSchedule(ENTRADA);

    expect(mockRpc).toHaveBeenCalledWith('salvar_horario_da_grade', {
      p_group_id: 'turma-a',
      p_title: 'Muay Thai',
      p_weekday: 1,
      p_start_time: '19:00',
      p_valid_from: '2030-03-01',
      p_teacher_ids: ['p-1'],
    });
    expect(resultado).toEqual({ scheduleId: 'h-1', adjusted: 0, removed: 0, created: 9 });
  });

  it('deveEditarComIdEFimDaVigencia', async () => {
    mockRpc.mockResolvedValue({ data: { ...RESPOSTA, ajustadas: 7, removidas: 2, criadas: 0 }, error: null });

    const resultado = await saveSchedule({ ...ENTRADA, id: 'h-1', validUntilIso: '2030-04-10' });

    expect(mockRpc).toHaveBeenCalledWith(
      'salvar_horario_da_grade',
      expect.objectContaining({ p_id: 'h-1', p_valid_until: '2030-04-10' }),
    );
    expect(resultado).toEqual({ scheduleId: 'h-1', adjusted: 7, removed: 2, created: 0 });
  });

  it('deveMostrarARecusaEscritaPeloBanco', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'Esta turma já tem um horário nesse dia e hora.', details: null },
    });

    const falha = await saveSchedule(ENTRADA).catch((erro: unknown) => erro);

    expect(describeError(falha)).toBe('Esta turma já tem um horário nesse dia e hora.');
  });

  it('devePropagarFalhaDeRede', async () => {
    mockRpc.mockResolvedValue(NETWORK_FAILURE);
    await expect(saveSchedule(ENTRADA)).rejects.toEqual(NETWORK_FAILURE.error);
  });
});

describe('endSchedule', () => {
  it('deveEncerrarNoUltimoDia', async () => {
    mockRpc.mockResolvedValue({ data: { acao: 'encerrado', removidas: 3 }, error: null });

    await expect(endSchedule('h-1', '2030-04-10')).resolves.toEqual({ action: 'encerrado', removed: 3 });
    expect(mockRpc).toHaveBeenCalledWith('encerrar_horario_da_grade', { p_id: 'h-1', p_ultimo_dia: '2030-04-10' });
  });

  it('deveMostrarARecusaDoUltimoDiaNoPassado', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'O último dia do horário não pode ser antes de ontem.', details: null },
    });

    const falha = await endSchedule('h-1', '2020-01-01').catch((erro: unknown) => erro);

    expect(describeError(falha)).toBe('O último dia do horário não pode ser antes de ontem.');
  });
});
