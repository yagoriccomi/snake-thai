import { supabase } from '@/lib/supabase';
import type { ClassType } from '@/services/classes.service';
import type { Database } from '@/types/database.types';

/**
 * Serviço de frequência. Toda a CONTA vive no banco (`frequencia_mensal`) —
 * aqui só se chama e se traduz para o formato do app. Refazer o cálculo no
 * cliente criaria duas versões da regra, e as exceções do denominador
 * (docs/FREQUENCIA.md) são exatamente o tipo de coisa que diverge em silêncio.
 */

/** Frequência de um aluno no mês corrente (fuso de São Paulo). */
export interface MonthlyFrequency {
  userId: string;
  /** Primeiro dia do mês, `AAAA-MM-DD`. */
  referenceMonth: string;
  /** Aulas de rotina do mês INTEIRO — o "12" de "Presença em Aulas: 0/12". */
  totalClasses: number;
  /** Das aulas já ocorridas, as que tiveram chamada concluída. */
  countedClasses: number;
  /** Presenças confirmadas pelo professor. */
  attended: number;
  /** Faltas com justificativa aprovada (saem do denominador). */
  justified: number;
  /** 0–100, duas casas. Denominador zero vale 100. */
  frequencyPercent: number;
}

/** Modalidade da semana ou do mês (fixo, livre, à vontade). */
export type ModoDaFrequencia = Database['public']['Enums']['plan_schedule_mode'];

/** A frequência de uma semana (contrato § 11.6, `frequencia_semanal`). */
export interface FrequenciaDaSemana {
  userId: string;
  /** Segunda-feira, `AAAA-MM-DD`. */
  weekStart: string;
  /** Domingo, `AAAA-MM-DD`. */
  weekEnd: string;
  scheduleMode: ModoDaFrequencia;
  /** Cota (livre) ou meta (à vontade); nulo no fixo. */
  weeklyTarget: number | null;
  expected: number;
  attended: number;
  excused: number;
  cancelled: number;
  /** Sem teto (pode passar de 100). Nulo com esperado 0: a tela mostra "—". */
  frequencyPercent: number | null;
}

/** A frequência de um mês (contrato § 11.6, `frequencia_do_mes`). */
export interface FrequenciaDoMes {
  userId: string;
  referenceMonth: string;
  scheduleMode: ModoDaFrequencia;
  expected: number;
  attended: number;
  excused: number;
  cancelled: number;
  frequencyPercent: number | null;
  /** Domingo da última semana do mês (ou da Semana Extra final). */
  closesOn: string;
  isClosed: boolean;
  expectedToDate: number;
  attendedToDate: number;
}

/** Uma justificativa semanal, como `semanas_do_mes` a devolve. */
export interface JustificativaDaSemana {
  id: string;
  status: Database['public']['Enums']['justification_status'];
  attempt: number;
  approvedByName: string | null;
}

/** Uma semana do mês (contrato § 11.6, `semanas_do_mes`). */
export interface SemanaDoMes {
  weekStart: string;
  weekEnd: string;
  /** 'S1'..'S5' ou 'Semana extra'. */
  label: string;
  isSplit: boolean;
  expectedWeek: number;
  attendedWeek: number;
  weekPercent: number | null;
  /** A parte da semana que conta NESTE mês. */
  expectedInMonth: number;
  attendedInMonth: number;
  excusedWeek: number;
  canJustify: boolean;
  justifyUntil: string | null;
  justificationsLeft: number | null;
  justificativas: JustificativaDaSemana[];
}

/** Os tipos gerados não sabem quais colunas numéricas vêm nulas. [#11] */
function percentualOuNulo(valor: unknown): number | null {
  return valor === null || valor === undefined ? null : Number(valor);
}

function comoJustificativas(valor: unknown): JustificativaDaSemana[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  return (valor as Record<string, unknown>[]).map((item) => ({
    id: String(item.id),
    status: item.status as JustificativaDaSemana['status'],
    attempt: Number(item.attempt),
    approvedByName: typeof item.approved_by_name === 'string' ? item.approved_by_name : null,
  }));
}

/**
 * Semanas (seg–dom) de `de` a `ate` (`AAAA-MM-DD`). A conta é do banco; aqui
 * só se traduz. [#6]
 */
export async function fetchFrequenciaSemanal(
  userIds: string[],
  de: string,
  ate: string,
): Promise<FrequenciaDaSemana[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.rpc('frequencia_semanal', { p_user_ids: userIds, p_de: de, p_ate: ate });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    userId: linha.user_id,
    weekStart: linha.week_start,
    weekEnd: linha.week_end,
    scheduleMode: linha.schedule_mode,
    weeklyTarget: linha.weekly_target ?? null,
    expected: linha.expected,
    attended: linha.attended,
    excused: linha.excused,
    cancelled: linha.cancelled,
    frequencyPercent: percentualOuNulo(linha.frequency_percent),
  }));
}

/** O mês de cada aluno. `mes` é qualquer dia do mês (`AAAA-MM-DD`). */
export async function fetchFrequenciaDoMes(userIds: string[], mes: string): Promise<FrequenciaDoMes[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.rpc('frequencia_do_mes', { p_user_ids: userIds, p_mes: mes });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    userId: linha.user_id,
    referenceMonth: linha.reference_month,
    scheduleMode: linha.schedule_mode,
    expected: linha.expected,
    attended: linha.attended,
    excused: linha.excused,
    cancelled: linha.cancelled,
    frequencyPercent: percentualOuNulo(linha.frequency_percent),
    closesOn: linha.closes_on,
    isClosed: linha.is_closed,
    expectedToDate: linha.expected_to_date,
    attendedToDate: linha.attended_to_date,
  }));
}

/** As semanas de um mês de um aluno, com a Semana extra. */
export async function fetchSemanasDoMes(userId: string, mes: string): Promise<SemanaDoMes[]> {
  const { data, error } = await supabase.rpc('semanas_do_mes', { p_user_id: userId, p_mes: mes });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    weekStart: linha.week_start,
    weekEnd: linha.week_end,
    label: linha.label,
    isSplit: linha.is_split,
    expectedWeek: linha.expected_week,
    attendedWeek: linha.attended_week,
    weekPercent: percentualOuNulo(linha.week_percent),
    expectedInMonth: linha.expected_in_month,
    attendedInMonth: linha.attended_in_month,
    excusedWeek: linha.excused_week,
    canJustify: linha.can_justify,
    justifyUntil: linha.justify_until ?? null,
    justificationsLeft: linha.justifications_left ?? null,
    justificativas: comoJustificativas(linha.justificativas),
  }));
}

/** Linha do histórico mensal (gravada quando o mês fecha, regravada se ele mudar). */
export type MonthlyHistoryRow = Database['public']['Tables']['attendance_monthly']['Row'];

/** Aula de rotina que passou sem chamada concluída. */
export interface MissedRollCall {
  classId: string;
  title: string;
  dateTimeIso: string;
  groupId: string | null;
}

/**
 * Frequência do mês corrente para vários alunos numa chamada só — a tela do
 * professor não pode disparar uma requisição por aluno. [#70]
 *
 * Alunos que o chamador não pode ver são descartados pelo banco, sem erro.
 */
export async function fetchMonthlyFrequency(userIds: string[]): Promise<MonthlyFrequency[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.rpc('frequencia_mensal', { p_user_ids: userIds });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    userId: linha.user_id,
    referenceMonth: linha.reference_month,
    totalClasses: linha.total_classes,
    countedClasses: linha.counted_classes,
    attended: linha.attended,
    justified: linha.justified,
    frequencyPercent: Number(linha.frequency_percent),
  }));
}

/** Meses fechados de um aluno, do mais recente para o mais antigo. */
export async function fetchMonthlyHistory(userId: string): Promise<MonthlyHistoryRow[]> {
  const { data, error } = await supabase
    .from('attendance_monthly')
    .select('*')
    .eq('user_id', userId)
    .order('reference_month', { ascending: false });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** O que a tela de chamada precisa saber da aula para oferecer "Concluir chamada". */
export interface RollCallState {
  type: ClassType;
  dateTimeIso: string;
  /** `null` enquanto a chamada não foi concluída. */
  concludedAt: string | null;
}

/** Estado da chamada de uma aula (horário e conclusão). */
export async function fetchRollCallState(classId: string): Promise<RollCallState> {
  const { data, error } = await supabase
    .from('classes')
    .select('type, date_time, attendance_taken_at')
    .eq('id', classId)
    .single();
  if (error !== null) {
    throw error;
  }
  return {
    type: data.type,
    dateTimeIso: data.date_time,
    concludedAt: data.attendance_taken_at,
  };
}

/** A chamada montada na tela, pronta para ir ao banco de uma vez. */
export interface RollCallSubmission {
  presentes: string[];
  ausentes: string[];
}

/**
 * Grava a chamada inteira e a conclui — UMA requisição, disparada só quando o
 * professor toca em "Concluir chamada". Marcar aluno por aluno não toca o
 * banco: a tela recarregava a cada toque e voltava ao topo.
 *
 * Atômico: ou tudo é gravado, ou nada. Aluno fora das duas listas volta a "sem
 * chamada"; a declaração do aluno é preservada. O banco recusa aula que não
 * começou e quem não é professor da aula nem admin.
 *
 * @returns O instante da conclusão (o original, se já estava concluída).
 */
export async function saveRollCall(
  classId: string,
  chamada: RollCallSubmission,
): Promise<string> {
  const { data, error } = await supabase.rpc('salvar_chamada', {
    p_class_id: classId,
    p_presentes: chamada.presentes,
    p_ausentes: chamada.ausentes,
  });
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Aulas do mês corrente que passaram sem chamada. O banco já filtra por papel:
 * o admin recebe todas, o professor só as suas, o aluno nenhuma.
 */
export async function fetchMissedRollCalls(): Promise<MissedRollCall[]> {
  const { data, error } = await supabase.rpc('aulas_sem_chamada');
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    classId: linha.class_id,
    title: linha.title,
    dateTimeIso: linha.date_time,
    groupId: linha.group_id,
  }));
}
