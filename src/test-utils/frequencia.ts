import type { FrequenciaDaSemana, FrequenciaDoMes, SemanaDoMes } from '@/services/frequency.service';

/** Valores neutros, para os testes mudarem só o que importa. */
export function semanaDeFrequencia(parcial: Partial<FrequenciaDaSemana> = {}): FrequenciaDaSemana {
  return {
    userId: 'aluno-1',
    weekStart: '2027-02-01',
    weekEnd: '2027-02-07',
    scheduleMode: 'free',
    weeklyTarget: 2,
    expected: 2,
    attended: 3,
    excused: 0,
    cancelled: 0,
    frequencyPercent: 150,
    ...parcial,
  };
}

export function mesDeFrequencia(parcial: Partial<FrequenciaDoMes> = {}): FrequenciaDoMes {
  return {
    userId: 'aluno-1',
    referenceMonth: '2027-02-01',
    scheduleMode: 'free',
    expected: 8,
    attended: 3,
    excused: 0,
    cancelled: 0,
    frequencyPercent: 37.5,
    closesOn: '2027-02-28',
    isClosed: false,
    expectedToDate: 2,
    attendedToDate: 3,
    ...parcial,
  };
}

export function semanaDoMes(parcial: Partial<SemanaDoMes> = {}): SemanaDoMes {
  return {
    weekStart: '2027-02-01',
    weekEnd: '2027-02-07',
    label: 'S1',
    isSplit: false,
    expectedWeek: 2,
    attendedWeek: 3,
    weekPercent: 150,
    expectedInMonth: 2,
    attendedInMonth: 3,
    excusedWeek: 0,
    canJustify: false,
    justifyUntil: null,
    justificationsLeft: null,
    justificativas: [],
    ...parcial,
  };
}
