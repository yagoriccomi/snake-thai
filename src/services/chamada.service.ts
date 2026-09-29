import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * A chamada nova (contrato § 7.2). Quem está na chamada, por quê e o que
 * muda ao salvar são decididos no banco; aqui só se chama e se traduz. [#6]
 */

type Enums = Database['public']['Enums'];

export type OrigemNaChamada =
  | 'turma'
  | 'permanente'
  | 'troca'
  | 'troca_pendente'
  | 'extra'
  | 'trocou'
  | 'marcou'
  | 'incluido';

/** Uma linha de `lista_da_chamada`. Os detalhes da edição só vêm para o admin (D20). */
export interface AlunoDaChamada {
  userId: string;
  name: string | null;
  scheduleMode: Enums['plan_schedule_mode'];
  /** Cota (livre) ou meta (à vontade); nulo no fixo. */
  weeklyTarget: number | null;
  origem: OrigemNaChamada;
  declaredStatus: Enums['attendance_status'] | null;
  status: Enums['attendance_status'] | null;
  edited: boolean;
  previousStatus: Enums['attendance_status'] | null;
  editedByName: string | null;
  editedAt: string | null;
  takenByName: string | null;
  justificationId: string | null;
  justificationStatus: Enums['justification_status'] | null;
  weekAttended: number | null;
  weekExpected: number | null;
  swapId: string | null;
  swapStatus: Enums['class_swap_status'] | null;
  swapRole: 'origem' | 'destino' | null;
  swapOtherDateTime: string | null;
}

export interface ProfessorDaChamada {
  teacherId: string;
  name: string | null;
  color: string | null;
  /** Estava escalado (não foi acrescentado na chamada). */
  scheduled: boolean;
  /** Nulo enquanto ninguém marcou. */
  present: boolean | null;
  addedInRollCall: boolean;
  edited: boolean;
}

export interface AlunoParaIncluir {
  userId: string;
  name: string | null;
  scheduleMode: Enums['plan_schedule_mode'];
  groupName: string | null;
}

export interface EquipeParaIncluir {
  teacherId: string;
  name: string | null;
  color: string | null;
}

/** O que vai para `salvar_chamada_v2`. */
export interface EnvioDaChamada {
  presentes: string[];
  ausentes: string[];
  professoresPresentes: string[];
  professoresAusentes: string[];
  removerIncluidos: string[];
  motivoId: string | null;
}

export interface ResultadoDaChamada {
  concluidaEm: string | null;
  retificada: boolean;
  alteracoes: number;
}

export interface ChamadaPendente {
  classId: string;
  title: string;
  dateTime: string;
  groupId: string | null;
  groupName: string | null;
  audience: Enums['class_audience'];
  diasEmAberto: number;
}

/** A aula, do ponto de vista da chamada. */
export interface EstadoDaChamada {
  type: Enums['class_type'];
  dateTimeIso: string;
  /** Primeira conclusão; nulo enquanto pendente. Nunca é reescrita (T14). */
  concludedAt: string | null;
  /** Selo "Editada" (§ 7.1). */
  edited: boolean;
  audience: Enums['class_audience'];
  cancelled: boolean;
}

/** Recusas que o banco escreve para a pessoa (§ 7.2). */
const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

function erroDoBanco(erro: unknown): unknown {
  return lerErroDoBanco(erro, RECUSAS_COM_FRASE);
}

export async function fetchEstadoDaChamada(classId: string): Promise<EstadoDaChamada> {
  const { data, error } = await supabase
    .from('classes')
    .select('type, date_time, attendance_taken_at, attendance_edited, audience, cancelled_at')
    .eq('id', classId)
    .single();
  if (error !== null) {
    throw error;
  }
  return {
    type: data.type,
    dateTimeIso: data.date_time,
    concludedAt: data.attendance_taken_at,
    edited: data.attendance_edited === true,
    audience: data.audience,
    cancelled: data.cancelled_at !== null,
  };
}

export async function fetchListaDaChamada(classId: string): Promise<AlunoDaChamada[]> {
  const { data, error } = await supabase.rpc('lista_da_chamada', { p_class_id: classId });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data.map((linha) => ({
    userId: linha.user_id,
    name: linha.name ?? null,
    scheduleMode: linha.schedule_mode,
    weeklyTarget: linha.weekly_target ?? null,
    origem: linha.origem as OrigemNaChamada,
    declaredStatus: linha.declared_status ?? null,
    status: linha.status ?? null,
    edited: linha.edited === true,
    previousStatus: linha.previous_status ?? null,
    editedByName: linha.edited_by_name ?? null,
    editedAt: linha.edited_at ?? null,
    takenByName: linha.taken_by_name ?? null,
    justificationId: linha.justification_id ?? null,
    justificationStatus: linha.justification_status ?? null,
    weekAttended: linha.week_attended ?? null,
    weekExpected: linha.week_expected ?? null,
    swapId: linha.swap_id ?? null,
    swapStatus: linha.swap_status ?? null,
    swapRole: (linha.swap_role as 'origem' | 'destino' | null) ?? null,
    swapOtherDateTime: linha.swap_other_date_time ?? null,
  }));
}

export async function fetchProfessoresDaChamada(classId: string): Promise<ProfessorDaChamada[]> {
  const { data, error } = await supabase.rpc('professores_da_chamada', { p_class_id: classId });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data.map((linha) => ({
    teacherId: linha.teacher_id,
    name: linha.name ?? null,
    color: linha.color ?? null,
    scheduled: linha.scheduled,
    present: linha.present ?? null,
    addedInRollCall: linha.added_in_roll_call,
    edited: linha.edited,
  }));
}

export async function buscarAlunosParaIncluir(classId: string, busca: string): Promise<AlunoParaIncluir[]> {
  const { data, error } = await supabase.rpc('buscar_alunos_para_incluir', { p_class_id: classId, p_busca: busca });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data.map((linha) => ({
    userId: linha.user_id,
    name: linha.name ?? null,
    scheduleMode: linha.schedule_mode,
    groupName: linha.group_name ?? null,
  }));
}

export async function buscarEquipeParaIncluir(classId: string, busca: string): Promise<EquipeParaIncluir[]> {
  const { data, error } = await supabase.rpc('buscar_equipe_para_incluir', { p_class_id: classId, p_busca: busca });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data.map((linha) => ({ teacherId: linha.teacher_id, name: linha.name ?? null, color: linha.color ?? null }));
}

/** O motivo obrigatório da retificação (§ 8, D17). Devolve o id que a chamada consome. */
export async function criarMotivoDeRetificacao(classId: string, texto: string): Promise<string> {
  const { data, error } = await supabase.rpc('criar_motivo', {
    p_kind: 'roll_call_edit',
    p_class_id: classId,
    p_texto: texto,
  });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data;
}

/** Salva e conclui; depois da conclusão, toda diferença é retificação (D17). */
export async function salvarChamada(classId: string, envio: EnvioDaChamada): Promise<ResultadoDaChamada> {
  const { data, error } = await supabase.rpc('salvar_chamada_v2', {
    p_class_id: classId,
    p_presentes: envio.presentes,
    p_ausentes: envio.ausentes,
    p_professores_presentes: envio.professoresPresentes,
    p_professores_ausentes: envio.professoresAusentes,
    p_remover_incluidos: envio.removerIncluidos,
    ...(envio.motivoId !== null ? { p_motivo_id: envio.motivoId } : {}),
  });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  const json = (data ?? {}) as Record<string, unknown>;
  return {
    concluidaEm: typeof json.concluida_em === 'string' ? json.concluida_em : null,
    retificada: json.retificada === true,
    alteracoes: typeof json.alteracoes === 'number' ? json.alteracoes : 0,
  };
}

/** T13: as aulas passadas sem chamada. `somenteMinhas = false` só vale para o admin. */
export async function fetchChamadasPendentes(somenteMinhas: boolean): Promise<ChamadaPendente[]> {
  const { data, error } = await supabase.rpc('chamadas_pendentes', { p_somente_minhas: somenteMinhas });
  if (error !== null) {
    throw erroDoBanco(error);
  }
  return data.map((linha) => ({
    classId: linha.class_id,
    title: linha.title,
    dateTime: linha.date_time,
    groupId: linha.group_id ?? null,
    groupName: linha.group_name ?? null,
    audience: linha.audience,
    diasEmAberto: linha.dias_em_aberto,
  }));
}
