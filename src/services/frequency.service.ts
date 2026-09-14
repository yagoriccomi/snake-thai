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

/** Linha do histórico mensal congelado. */
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

/** Histórico mensal congelado de um aluno, do mês mais recente para o mais antigo. */
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

/**
 * Conclui a chamada da aula: é o que efetiva as presenças e faz a aula entrar
 * no cálculo. Professor da aula ou admin; o banco recusa aula que não começou.
 *
 * @returns O instante da conclusão (o original, se já estava concluída).
 */
export async function concludeRollCall(classId: string): Promise<string> {
  const { data, error } = await supabase.rpc('concluir_chamada', { p_class_id: classId });
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
