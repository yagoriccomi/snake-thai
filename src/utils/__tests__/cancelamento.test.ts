import { juntarComE, listaDosAvisados, textoDaPrevia } from '@/utils/cancelamento';

const PREVIA = { antesDaAula: true, fixos: 18, livres: 32, alunosDoEvento: 0, professores: ['Ana'], admins: 2 };

describe('juntarComE', () => {
  it('deveJuntarComVirgulaEE', () => {
    expect(juntarComE([])).toBe('');
    expect(juntarComE(['a'])).toBe('a');
    expect(juntarComE(['a', 'b'])).toBe('a e b');
    expect(juntarComE(['a', 'b', 'c'])).toBe('a, b e c');
  });
});

describe('textoDaPrevia (mockup Cancelar aula, D25, T22)', () => {
  it('deveAvisarNaHoraAntesDaAula', () => {
    expect(textoDaPrevia(PREVIA, 'cancelar')).toBe(
      'A aula ainda não aconteceu. O aviso sai agora, mesmo à noite, para: 18 alunos fixos, 32 alunos livres, Ana (professor da aula) e 2 admins.',
    );
  });

  it('deveAvisarSoAEquipeDepoisDaAula', () => {
    expect(textoDaPrevia({ ...PREVIA, antesDaAula: false, fixos: 0, livres: 0 }, 'cancelar')).toBe(
      'A aula já aconteceu. O aviso vai só para a equipe: Ana (professor da aula) e 2 admins.',
    );
  });

  it('deveRespeitarOSilencioNaReativacao', () => {
    expect(textoDaPrevia(PREVIA, 'reativar')).toMatch(/respeitando o silêncio das 22h às 7h\.$/);
  });

  it('deveUsarOSingularEONinguem', () => {
    expect(listaDosAvisados({ ...PREVIA, fixos: 1, livres: 0, professores: ['Ana', 'Rafael'], admins: 1 })).toBe(
      '1 aluno fixo, Ana e Rafael (professores da aula) e 1 admin',
    );
    expect(textoDaPrevia({ antesDaAula: true, fixos: 0, livres: 0, alunosDoEvento: 0, professores: [], admins: 0 }, 'cancelar')).toBe(
      'Ninguém será avisado.',
    );
  });
});
