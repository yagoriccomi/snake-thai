import {
  createQueryChain,
  LAST_ADMIN_BLOCKED,
  NETWORK_FAILURE,
  RLS_DENIED,
  type QueryChainMock,
} from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]): unknown => mockInvoke(...args),
    },
  },
}));

import {
  createStaff,
  createStudent,
  fetchAllProfessors,
  finishStaffOnboarding,
  resetStudentPassword,
  setStudentActive,
  updateOwnColor,
  updateStudentPlan,
  updateUserRole,
  type StaffInput,
} from '@/services/profile.service';

const ALUNO_ID = '219ce3c9-5ad7-4319-9cde-7dbe07e1a573';
const PROFESSOR_ID = '3e2d1c0b-9a8f-4e5d-8c7b-6a5f4e3d2c1b';

function mockQuery(resultado: Parameters<typeof createQueryChain>[0]): QueryChainMock {
  const chain = createQueryChain(resultado);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockInvoke.mockReset();
});

describe('updateUserRole — promoção e rebaixamento', () => {
  it('devePropagarARecusaQuandoEhOUltimoAdministradorAtivo', async () => {
    mockQuery(LAST_ADMIN_BLOCKED);
    // O pior desfecho possível: engolir este erro faria a tela dizer "rebaixado
    // com sucesso" e o sistema ficaria SEM nenhum administrador, para sempre.
    await expect(updateUserRole(ALUNO_ID, 'user')).rejects.toEqual(
      LAST_ADMIN_BLOCKED.error,
    );
  });

  it('devePropagarARecusaDaRlsQuandoQuemChamaNaoEhAdmin', async () => {
    mockQuery(RLS_DENIED);
    // Um aluno não pode se autopromover — e a tela precisa saber que falhou.
    await expect(updateUserRole(ALUNO_ID, 'admin')).rejects.toEqual(
      RLS_DENIED.error,
    );
  });

  it('devePropagarFalhaDeRede', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(updateUserRole(ALUNO_ID, 'admin')).rejects.toEqual(
      NETWORK_FAILURE.error,
    );
  });

  it('deveAlterarSomenteOUsuarioIndicado', async () => {
    const chain = mockQuery({ data: null, error: null });
    await updateUserRole(ALUNO_ID, 'admin');
    // Sem o filtro por id, um UPDATE promoveria a base inteira a administrador.
    expect(chain.eq).toHaveBeenCalledWith('id', ALUNO_ID);
    expect(chain.update).toHaveBeenCalledWith({ role: 'admin' });
  });
});

describe('setStudentActive — trancar e reativar matrícula', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deveRegistrarADataAoTrancarPorCausaDaConstraintDeCoerencia', async () => {
    const chain = mockQuery({ data: null, error: null });
    await setStudentActive(ALUNO_ID, false);
    // O banco exige que status='inactive' venha com deactivated_at preenchido.
    expect(chain.update).toHaveBeenCalledWith({
      status: 'inactive',
      deactivated_at: '2026-08-19T12:00:00.000Z',
    });
  });

  it('deveLimparADataAoReativarParaNaoViolarAConstraint', async () => {
    const chain = mockQuery({ data: null, error: null });
    await setStudentActive(ALUNO_ID, true);
    expect(chain.update).toHaveBeenCalledWith({
      status: 'active',
      deactivated_at: null,
    });
  });

  it('naoDeveExcluirOAlunoAoTrancarAMatricula', async () => {
    const chain = mockQuery({ data: null, error: null });
    await setStudentActive(ALUNO_ID, false);
    // Excluir destruiria histórico de presença e financeiro do período.
    expect(chain.delete).not.toHaveBeenCalled();
  });

  it('devePropagarOErroQuandoOBancoRecusa', async () => {
    mockQuery(LAST_ADMIN_BLOCKED);
    // Desativar o último admin é recusado pelo mesmo trigger do rebaixamento.
    await expect(setStudentActive(ALUNO_ID, false)).rejects.toEqual(
      LAST_ADMIN_BLOCKED.error,
    );
  });
});

describe('resetStudentPassword', () => {
  it('devePropagarOErroQuandoAEdgeFunctionRecusa', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Acesso restrito a administradores' },
    });
    await expect(resetStudentPassword(ALUNO_ID)).rejects.toEqual({
      message: 'Acesso restrito a administradores',
    });
  });

  it('deveChamarAFuncaoServidoraEmVezDeAlterarOBancoDireto', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await resetStudentPassword(ALUNO_ID);
    // Trocar a senha de outra pessoa exige service_role, que nunca pode estar
    // no aplicativo: a operação tem de acontecer no servidor.
    expect(mockInvoke).toHaveBeenCalledWith('reset-student-password', {
      body: { userId: ALUNO_ID },
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('fetchAllProfessors', () => {
  it('deveFiltrarSomenteOPapelProfessor', async () => {
    const chain = mockQuery({ data: [], error: null });
    await fetchAllProfessors();
    // Sem este filtro, o seletor de professores do admin listaria alunos e
    // administradores junto — confuso na hora de montar uma aula.
    expect(chain.eq).toHaveBeenCalledWith('role', 'professor');
  });

  it('devePropagarFalhaDeRede', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(fetchAllProfessors()).rejects.toEqual(NETWORK_FAILURE.error);
  });
});

describe('createStaff', () => {
  const ENTRADA: StaffInput = {
    email: '  Professor@Snake.com  ',
    name: '  Fulano de Tal  ',
    cpf: '12345678900',
    role: 'professor',
    color: '#FF5733',
  };

  it('deveChamarAEdgeFunctionComOsDadosSaneados', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await createStaff(ENTRADA);
    // Cadastrar professor/admin exige service_role — nunca pode acontecer
    // direto no cliente, igual createStudent.
    expect(mockInvoke).toHaveBeenCalledWith('create-staff', {
      body: {
        email: 'professor@snake.com',
        name: 'Fulano de Tal',
        cpf: '12345678900',
        role: 'professor',
        color: '#FF5733',
      },
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('devePropagarARecusaQuandoQuemChamaNaoEhAdmin', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Acesso restrito a administradores' },
    });
    await expect(createStaff(ENTRADA)).rejects.toEqual({
      message: 'Acesso restrito a administradores',
    });
  });
});

describe('updateStudentPlan', () => {
  it('deveVincularOPlanoApenasAoAlunoIndicado', async () => {
    const chain = mockQuery({ data: null, error: null });
    await updateStudentPlan(ALUNO_ID, 'plan-1');
    // Sem o filtro por id, um UPDATE colocaria a base inteira no mesmo plano
    // — e a recorrência mensal passaria a cobrar todo mundo por ele.
    expect(chain.update).toHaveBeenCalledWith({ plan_id: 'plan-1' });
    expect(chain.eq).toHaveBeenCalledWith('id', ALUNO_ID);
  });

  it('deveAceitarNuloParaTirarOAlunoDoFaturamento', async () => {
    const chain = mockQuery({ data: null, error: null });
    await updateStudentPlan(ALUNO_ID, null);
    expect(chain.update).toHaveBeenCalledWith({ plan_id: null });
  });

  it('devePropagarARecusaDaRlsQuandoQuemChamaNaoEhAdmin', async () => {
    mockQuery(RLS_DENIED);
    // Aluno não escolhe o próprio plano — isso é preço, não preferência.
    await expect(updateStudentPlan(ALUNO_ID, 'plan-1')).rejects.toEqual(
      RLS_DENIED.error,
    );
  });
});

describe('createStudent', () => {
  it('deveEnviarOPlanoEscolhidoParaAEdgeFunction', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await createStudent('  Aluno@Snake.com  ', 'turma-1', 'plan-1');
    // O plano é o que liga o aluno ao faturamento: se não trafegar aqui, o
    // aluno nasce sem cobrança e ninguém percebe até o fim do mês.
    expect(mockInvoke).toHaveBeenCalledWith('create-student', {
      body: { email: 'aluno@snake.com', groupId: 'turma-1', planId: 'plan-1' },
    });
  });

  it('deveMandarPlanoNuloQuandoNaoInformado', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await createStudent('aluno@snake.com', null);
    expect(mockInvoke).toHaveBeenCalledWith('create-student', {
      body: { email: 'aluno@snake.com', groupId: null, planId: null },
    });
  });
});

describe('finishStaffOnboarding', () => {
  it('deveApenasBaixarAFlagSemRegravarCadastro', async () => {
    const chain = mockQuery({ data: null, error: null });
    await finishStaffOnboarding(PROFESSOR_ID);
    // Nome/CPF vieram do admin e não podem ser sobrescritos aqui; e o papel
    // JAMAIS pode viajar neste update — seria uma autopromoção disfarçada de
    // "concluir cadastro".
    expect(chain.update).toHaveBeenCalledWith({ is_first_login: false });
    expect(chain.eq).toHaveBeenCalledWith('id', PROFESSOR_ID);
  });

  it('devePropagarOErroEmVezDeLiberarOAppComOnboardingPendente', async () => {
    mockQuery(NETWORK_FAILURE);
    // Engolir o erro deixaria a conta na senha padrão achando que concluiu.
    await expect(finishStaffOnboarding(PROFESSOR_ID)).rejects.toEqual(
      NETWORK_FAILURE.error,
    );
  });
});

describe('updateOwnColor', () => {
  it('deveAtualizarSomenteACorDoProprioProfessor', async () => {
    const chain = mockQuery({ data: null, error: null });
    await updateOwnColor(PROFESSOR_ID, '#00AAFF');
    expect(chain.update).toHaveBeenCalledWith({ color: '#00AAFF' });
    expect(chain.eq).toHaveBeenCalledWith('id', PROFESSOR_ID);
  });

  it('devePropagarARecusaDaConstraintQuandoQuemChamaNaoEhProfessor', async () => {
    // Ex.: um aluno tentando se autoatribuir uma cor — a constraint
    // `profiles_color_only_for_professor` barra no banco.
    mockQuery(RLS_DENIED);
    await expect(updateOwnColor(ALUNO_ID, '#00AAFF')).rejects.toEqual(
      RLS_DENIED.error,
    );
  });
});
