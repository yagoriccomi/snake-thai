import type { AlunoDaChamada, ProfessorDaChamada } from '@/services/chamada.service';

/** Um aluno da chamada com valores neutros, para os testes mudarem só o que importa. */
export function alunoDaChamada(parcial: Partial<AlunoDaChamada> = {}): AlunoDaChamada {
  return {
    userId: 'aluno-1',
    name: 'Ana',
    scheduleMode: 'fixed',
    weeklyTarget: null,
    origem: 'turma',
    declaredStatus: null,
    status: null,
    edited: false,
    previousStatus: null,
    editedByName: null,
    editedAt: null,
    takenByName: null,
    justificationId: null,
    justificationStatus: null,
    weekAttended: null,
    weekExpected: null,
    swapId: null,
    swapStatus: null,
    swapRole: null,
    swapOtherDateTime: null,
    ...parcial,
  };
}

export function professorDaChamada(parcial: Partial<ProfessorDaChamada> = {}): ProfessorDaChamada {
  return {
    teacherId: 'prof-1',
    name: 'Rafael',
    color: '#38BDF8',
    scheduled: true,
    present: null,
    addedInRollCall: false,
    edited: false,
    ...parcial,
  };
}
