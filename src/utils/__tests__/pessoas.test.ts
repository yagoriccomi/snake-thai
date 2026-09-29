import type { Profile } from '@/types/models';
import {
  avisoDeMudancaDeTurma,
  contarPessoas,
  filtrarPessoas,
  iniciais,
  rotuloDaAulaDoAluno,
  rotuloDaAulaDoProfessor,
  situacaoDaPessoa,
  turmaPorPeriodo,
} from '@/utils/pessoas';

function pessoa(parcial: Partial<Profile>): Profile {
  return {
    id: 'p',
    role: 'user',
    name: 'Ana Beatriz Lima',
    cpf: '12345678900',
    status: 'active',
    is_first_login: false,
    group_id: null,
    plan_id: null,
    color: null,
    ...parcial,
  } as Profile;
}

describe('pessoas (opção A dos mockups da linha E)', () => {
  const ana = pessoa({ id: 'a' });
  const carlos = pessoa({ id: 'c', name: 'Carlos Eduardo', is_first_login: true, cpf: '99988877766' });
  const marina = pessoa({ id: 'm', name: 'Marina Souza', status: 'inactive' });
  const rafael = pessoa({ id: 'r', name: 'Rafael Tanaka', role: 'professor', color: '#FB923C' });
  const yago = pessoa({ id: 'y', name: 'Yago', role: 'admin' });
  const todos = [ana, carlos, marina, rafael, yago];

  it('deveDarAsIniciais', () => {
    expect(iniciais('Ana Beatriz Lima')).toBe('AL');
    expect(iniciais('Yago')).toBe('YA');
    expect(iniciais(null)).toBe('•');
  });

  it('deveSepararSituacaoDeCargo', () => {
    expect(situacaoDaPessoa(marina)).toBe('trancado');
    expect(situacaoDaPessoa(carlos)).toBe('primeiro_acesso');
    expect(situacaoDaPessoa(ana)).toBe('ativo');
  });

  it('deveFiltrarPorAbaFiltroEBusca', () => {
    const ids = (lista: Profile[]) => lista.map((p) => p.id);
    expect(ids(filtrarPessoas(todos, { aba: 'alunos', filtro: 'ativos', busca: '' }))).toEqual(['a', 'c']);
    expect(ids(filtrarPessoas(todos, { aba: 'alunos', filtro: 'pendentes', busca: '' }))).toEqual(['c']);
    expect(ids(filtrarPessoas(todos, { aba: 'alunos', filtro: 'trancados', busca: '' }))).toEqual(['m']);
    expect(ids(filtrarPessoas(todos, { aba: 'equipe', filtro: 'trancados', busca: '' }))).toEqual(['r', 'y']);
    expect(ids(filtrarPessoas(todos, { aba: 'alunos', filtro: 'ativos', busca: '999.888' }))).toEqual(['c']);
    expect(ids(filtrarPessoas(todos, { aba: 'alunos', filtro: 'ativos', busca: 'beatriz' }))).toEqual(['a']);
  });

  it('deveContarAsAbasEOsFiltros', () => {
    expect(contarPessoas(todos)).toEqual({ alunos: 3, equipe: 2, pendentes: 1, trancados: 1 });
  });
});

describe('turmaPorPeriodo (§ 3, D58)', () => {
  const MES = '2026-09-01';

  it('deveEscreverAMudancaNoMes', () => {
    expect(
      turmaPorPeriodo(
        [
          { turma: 'Turma Noite', desde: '2026-08-01', ate: '2026-09-15' },
          { turma: 'Turma Manhã', desde: '2026-09-15', ate: null },
        ],
        MES,
      ),
    ).toBe('Turma Noite até 15/09 · Turma Manhã desde 15/09');
  });

  it('deveMostrarSoATurmaQuandoNadaMudou', () => {
    expect(turmaPorPeriodo([{ turma: 'Turma Noite', desde: '2026-01-10', ate: null }], MES)).toBe('Turma Noite');
  });

  it('deveFecharComSemTurma', () => {
    expect(turmaPorPeriodo([{ turma: 'Turma Noite', desde: '2026-09-03', ate: '2026-09-20' }], MES)).toBe(
      'Turma Noite de 03/09 a 20/09 · Sem turma desde 20/09',
    );
  });

  it('deveDevolverNuloSemPeriodo', () => {
    expect(turmaPorPeriodo([], MES)).toBeNull();
  });
});

describe('avisoDeMudancaDeTurma (§ 3)', () => {
  it('deveUsarOsTresTextos', () => {
    expect(avisoDeMudancaDeTurma('Turma Noite', 'Turma Manhã')).toBe(
      'A frequência continua contando as aulas da Turma Noite até agora e passa a contar as da Turma Manhã a partir de agora. Trocas de aula que saem de aulas futuras e trocas permanentes deste aluno serão canceladas.',
    );
    expect(avisoDeMudancaDeTurma('Turma Noite', null)).toBe(
      'A frequência continua contando as aulas da Turma Noite até agora. Trocas de aula que saem de aulas futuras e trocas permanentes deste aluno serão canceladas.',
    );
    expect(avisoDeMudancaDeTurma(null, 'Turma Manhã')).toBe('As aulas da Turma Manhã passam a contar a partir de agora.');
    expect(avisoDeMudancaDeTurma('Turma Noite', 'Turma Noite')).toBeNull();
  });
});

describe('rótulos do histórico', () => {
  const base = { cancelled: false, status: null, origem: null, justificationStatus: null, swapOtherDateTime: null } as const;

  it('deveTrocarFaltaPorTrocouPara', () => {
    expect(rotuloDaAulaDoAluno({ ...base, origem: 'trocou', swapOtherDateTime: '2030-03-12T21:00:00Z' })).toMatch(/^Trocou para /);
    expect(rotuloDaAulaDoAluno({ ...base, status: 'absent' })).toBe('Falta');
    expect(rotuloDaAulaDoAluno({ ...base, status: 'absent', justificationStatus: 'approved' })).toBe('Falta justificada');
    expect(rotuloDaAulaDoAluno({ ...base, status: 'present' })).toBe('Presente');
    expect(rotuloDaAulaDoAluno({ ...base, cancelled: true })).toBe('Cancelada');
  });

  it('deveDizerASituacaoDoProfessor', () => {
    expect(rotuloDaAulaDoProfessor({ cancelled: false, present: true, addedInRollCall: true })).toBe('Deu a aula (fora da escala)');
    expect(rotuloDaAulaDoProfessor({ cancelled: false, present: false, addedInRollCall: false })).toBe('Falta');
    expect(rotuloDaAulaDoProfessor({ cancelled: false, present: null, addedInRollCall: false })).toBe('Sem registro');
  });
});
