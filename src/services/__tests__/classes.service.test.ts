import {
  createQueryChain,
  NETWORK_FAILURE,
  RLS_DENIED,
  type QueryChainMock,
} from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

import {
  addClassTeacher,
  clearAttendance,
  createClassAsProfessor,
  fetchTeachersForClasses,
  removeClassTeacher,
  type NewClassInput,
} from '@/services/classes.service';

const CLASS_ID = 'class-1';
const TEACHER_ID = 'teacher-1';

const NOVA_AULA: NewClassInput = {
  title: 'Muay Thai — Rotina',
  type: 'routine',
  dateTimeIso: '2030-01-01T19:00:00.000Z',
  groupId: 'turma-a',
};

function mockQuery(resultado: Parameters<typeof createQueryChain>[0]): QueryChainMock {
  const chain = createQueryChain(resultado);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchTeachersForClasses', () => {
  it('devePularAConsultaQuandoNaoHaAulas', async () => {
    const resultado = await fetchTeachersForClasses([]);
    expect(resultado).toEqual({});
    // Nenhuma requisição desnecessária: uma lista de dia vazia não pode
    // disparar uma consulta ao banco. [#70]
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deveAgruparOsProfessoresPorAula', async () => {
    // Duas consultas: os vínculos e, à parte, nome/cor no DIRETÓRIO. O join
    // embutido em `profiles` devolvia null para aluno e professor por causa
    // da RLS, apagando a cor justamente de quem precisa vê-la.
    const vinculos = createQueryChain({
      data: [
        { class_id: CLASS_ID, teacher_id: TEACHER_ID, created_at: '2030-01-01T00:00:00.000Z' },
        { class_id: CLASS_ID, teacher_id: 'teacher-2', created_at: '2030-01-02T00:00:00.000Z' },
      ],
      error: null,
    });
    const diretorio = createQueryChain({
      data: [
        { id: TEACHER_ID, name: 'Prof. Ana', color: '#FF0000' },
        { id: 'teacher-2', name: 'Prof. Bruno', color: '#00FF00' },
      ],
      error: null,
    });
    mockFrom.mockImplementation((tabela: string) =>
      tabela === 'class_teachers' ? vinculos : diretorio,
    );

    const resultado = await fetchTeachersForClasses([CLASS_ID]);

    expect(resultado[CLASS_ID]).toEqual([
      { id: TEACHER_ID, name: 'Prof. Ana', color: '#FF0000', joinedAt: '2030-01-01T00:00:00.000Z' },
      { id: 'teacher-2', name: 'Prof. Bruno', color: '#00FF00', joinedAt: '2030-01-02T00:00:00.000Z' },
    ]);
  });

  it('devePropagarFalhaDeRede', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(fetchTeachersForClasses([CLASS_ID])).rejects.toEqual(
      NETWORK_FAILURE.error,
    );
  });
});

describe('createClassAsProfessor', () => {
  it('deveCriarAAulaEVincularOProfessorQueACriou', async () => {
    const classesChain = createQueryChain({ data: { id: CLASS_ID }, error: null });
    const teachersChain = createQueryChain({ data: null, error: null });
    mockFrom.mockImplementation((table: string) =>
      table === 'classes' ? classesChain : teachersChain,
    );

    await createClassAsProfessor(NOVA_AULA, TEACHER_ID);

    expect(classesChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: NOVA_AULA.title }),
    );
    expect(teachersChain.insert).toHaveBeenCalledWith({
      class_id: CLASS_ID,
      teacher_id: TEACHER_ID,
    });
  });

  it('devePropagarARecusaSeAAulaFalharSemVincularProfessorAlgum', async () => {
    // Se o INSERT em `classes` falhar, jamais podemos tentar vincular um
    // professor a uma aula que não existe.
    const classesChain = createQueryChain(RLS_DENIED);
    const teachersChain = createQueryChain({ data: null, error: null });
    mockFrom.mockImplementation((table: string) =>
      table === 'classes' ? classesChain : teachersChain,
    );

    await expect(createClassAsProfessor(NOVA_AULA, TEACHER_ID)).rejects.toEqual(
      RLS_DENIED.error,
    );
    expect(teachersChain.insert).not.toHaveBeenCalled();
  });
});

describe('addClassTeacher / removeClassTeacher', () => {
  it('deveVincularUmProfessorAUmaAula', async () => {
    const chain = mockQuery({ data: null, error: null });
    await addClassTeacher(CLASS_ID, TEACHER_ID);
    expect(chain.insert).toHaveBeenCalledWith({
      class_id: CLASS_ID,
      teacher_id: TEACHER_ID,
    });
  });

  it('devePropagarARecusaDaRlsAoVincular', async () => {
    mockQuery(RLS_DENIED);
    // Ex.: aluno tentando se vincular como professor de uma aula.
    await expect(addClassTeacher(CLASS_ID, TEACHER_ID)).rejects.toEqual(
      RLS_DENIED.error,
    );
  });

  it('deveDesvincularUmProfessorDeUmaAula', async () => {
    const chain = mockQuery({ data: null, error: null });
    await removeClassTeacher(CLASS_ID, TEACHER_ID);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('class_id', CLASS_ID);
    expect(chain.eq).toHaveBeenCalledWith('teacher_id', TEACHER_ID);
  });
});

describe('clearAttendance', () => {
  it('deveApagarARespostaDePresencaDoAluno', async () => {
    const chain = mockQuery({ data: null, error: null });
    await clearAttendance(CLASS_ID, TEACHER_ID);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('class_id', CLASS_ID);
    expect(chain.eq).toHaveBeenCalledWith('user_id', TEACHER_ID);
  });

  it('devePropagarFalhaDeRede', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(clearAttendance(CLASS_ID, TEACHER_ID)).rejects.toEqual(
      NETWORK_FAILURE.error,
    );
  });
});
