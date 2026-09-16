import {
  createQueryChain,
  NETWORK_FAILURE,
  RLS_DENIED,
  type QueryChainMock,
} from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  fetchGroupsOverview,
  previewGroupRemoval,
  reactivateGroup,
  removeGroup,
  renameGroup,
} from '@/services/groups.service';
import { describeError } from '@/utils/errors';

const TURMA = {
  id: 'turma-a',
  name: 'Turma A',
  created_at: '2026-01-01T00:00:00.000Z',
  archived_at: null,
};

function mockQuery(resultado: Parameters<typeof createQueryChain>[0]): QueryChainMock {
  const chain = createQueryChain(resultado);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('fetchGroupsOverview', () => {
  it('deveContarAlunosEHorariosVigentesSemUmaConsultaPorTurma', async () => {
    const turmas = createQueryChain({
      data: [
        { ...TURMA, profiles: [{ count: 12 }] },
        { ...TURMA, id: 'turma-b', name: 'Turma B', profiles: [{ count: 0 }] },
      ],
      error: null,
    });
    const horarios = createQueryChain({
      data: [
        { group_id: 'turma-a', valid_until: null },
        { group_id: 'turma-a', valid_until: '2026-09-16' },
        // Encerrado ontem: não conta como vigente.
        { group_id: 'turma-a', valid_until: '2026-09-15' },
      ],
      error: null,
    });
    mockFrom.mockImplementation((tabela: string) => (tabela === 'groups' ? turmas : horarios));

    const resultado = await fetchGroupsOverview('2026-09-16');

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual([
      { group: TURMA, studentCount: 12, activeScheduleCount: 2 },
      { group: { ...TURMA, id: 'turma-b', name: 'Turma B' }, studentCount: 0, activeScheduleCount: 0 },
    ]);
  });

  it('devePropagarAFalhaDeRede', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(fetchGroupsOverview('2026-09-16')).rejects.toEqual(NETWORK_FAILURE.error);
  });
});

describe('renameGroup', () => {
  it('deveMandarSoONomeSemEspacosNasPontas', async () => {
    const chain = mockQuery({ data: { ...TURMA, name: 'Turma Noite' }, error: null });

    await renameGroup('turma-a', '  Turma Noite ');

    expect(chain.update).toHaveBeenCalledWith({ name: 'Turma Noite' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'turma-a');
  });

  it('deveExplicarONomeRepetido', async () => {
    mockQuery({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "groups_name_key"' } });

    const falha = await renameGroup('turma-a', 'Turma B').catch((erro: unknown) => erro);

    expect(describeError(falha)).toBe('Já existe uma turma com esse nome.');
  });

  it('devePropagarARecusaDaRls', async () => {
    mockQuery(RLS_DENIED);
    await expect(renameGroup('turma-a', 'X')).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('previewGroupRemoval', () => {
  it('deveTraduzirAPreviaDoBanco', async () => {
    mockRpc.mockResolvedValue({
      data: {
        arquivada: false,
        alunos: 8,
        aulas_futuras_sem_chamada: 5,
        aulas_passadas: 30,
        horarios_ativos: 3,
        meses_congelados: 2,
        pode_apagar_de_vez: false,
      },
      error: null,
    });

    await expect(previewGroupRemoval('turma-a')).resolves.toEqual({
      archived: false,
      students: 8,
      futureClassesWithoutRollCall: 5,
      pastClasses: 30,
      activeSchedules: 3,
      frozenMonths: 2,
      canDeleteForGood: false,
    });
    expect(mockRpc).toHaveBeenCalledWith('previa_exclusao_turma', { p_group_id: 'turma-a' });
  });

  it('deveFalharAltoQuandoOFormatoMuda', async () => {
    // Campo renomeado numa migration não pode virar "0 alunos" na tela.
    mockRpc.mockResolvedValue({ data: { arquivada: false, students: 8 }, error: null });
    await expect(previewGroupRemoval('turma-a')).rejects.toThrow('previa_exclusao_turma.alunos');
  });
});

describe('removeGroup', () => {
  const RESPOSTA = { acao: 'arquivada', alunos_movidos: 8, aulas_removidas: 5, horarios_apagados: 1 };

  it('deveMandarODestinoQuandoEscolhido', async () => {
    mockRpc.mockResolvedValue({ data: RESPOSTA, error: null });

    const resultado = await removeGroup({ groupId: 'turma-a', destinationGroupId: 'turma-b', leaveWithoutGroup: false });

    expect(mockRpc).toHaveBeenCalledWith('excluir_turma', {
      p_group_id: 'turma-a',
      p_destino: 'turma-b',
      p_deixar_sem_turma: false,
    });
    expect(resultado).toEqual({ action: 'arquivada', movedStudents: 8, removedClasses: 5, deletedSchedules: 1 });
  });

  it('deveOmitirODestinoQuandoOsAlunosFicamSemTurma', async () => {
    mockRpc.mockResolvedValue({ data: { ...RESPOSTA, acao: 'apagada' }, error: null });

    await removeGroup({ groupId: 'turma-a', destinationGroupId: null, leaveWithoutGroup: true });

    expect(mockRpc).toHaveBeenCalledWith('excluir_turma', { p_group_id: 'turma-a', p_deixar_sem_turma: true });
  });

  it('deveMostrarARecusaEscritaPeloBanco', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'Escolha para qual turma vão os alunos, ou marque "sem turma".', details: null },
    });

    const falha = await removeGroup({ groupId: 'turma-a', destinationGroupId: null, leaveWithoutGroup: false }).catch(
      (erro: unknown) => erro,
    );

    expect(describeError(falha)).toBe('Escolha para qual turma vão os alunos, ou marque "sem turma".');
  });

  it('deveRecusarAcaoDesconhecida', async () => {
    mockRpc.mockResolvedValue({ data: { ...RESPOSTA, acao: 'sumiu' }, error: null });
    await expect(
      removeGroup({ groupId: 'turma-a', destinationGroupId: 'turma-b', leaveWithoutGroup: false }),
    ).rejects.toThrow('excluir_turma.acao');
  });
});

describe('reactivateGroup', () => {
  it('deveChamarAFuncaoEPropagarFalhaDeRede', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await reactivateGroup('turma-a');
    expect(mockRpc).toHaveBeenCalledWith('reativar_turma', { p_group_id: 'turma-a' });

    mockRpc.mockResolvedValueOnce(NETWORK_FAILURE);
    await expect(reactivateGroup('turma-a')).rejects.toEqual(NETWORK_FAILURE.error);
  });
});
