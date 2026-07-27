import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import type { Profile } from '@/types/models';

/** Tipos derivados do esquema para o módulo de Aulas. */
export type ClassRow = Database['public']['Tables']['classes']['Row'];
export type ClassType = Database['public']['Enums']['class_type'];
export type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

/**
 * Sanitiza um group_id antes de interpolá-lo num filtro `.or` do PostgREST
 * (defesa contra injeção no filtro). Aceita apenas letras, números, `-` e `_`.
 */
function safeGroupId(groupId: string): string | null {
  return /^[\w-]+$/.test(groupId) ? groupId : null;
}

/**
 * Aulas futuras visíveis para um aluno: as da sua turma (`group_id`) somadas aos
 * eventos globais (`group_id` nulo), ordenadas por data.
 */
export async function fetchUpcomingClassesForStudent(
  groupId: string | null,
): Promise<ClassRow[]> {
  const nowIso = new Date().toISOString();
  const base = supabase
    .from('classes')
    .select('*')
    .gte('date_time', nowIso)
    .order('date_time', { ascending: true });

  const safeGroup = groupId !== null ? safeGroupId(groupId) : null;
  const query =
    safeGroup !== null
      ? base.or(`group_id.eq.${safeGroup},group_id.is.null`)
      : base.is('group_id', null);

  const { data, error } = await query;
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Presenças do próprio aluno (para refletir a escolha nos cards). */
export async function fetchOwnAttendance(userId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId);
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Registra/atualiza a presença do aluno (INSERT ou UPDATE), disparado apenas
 * pela ação explícita do aluno. Usa o UNIQUE (class_id, user_id) como conflito.
 */
export async function upsertAttendance(
  classId: string,
  userId: string,
  status: AttendanceStatus,
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .upsert(
      { class_id: classId, user_id: userId, status },
      { onConflict: 'class_id,user_id' },
    );
  if (error !== null) {
    throw error;
  }
}

/** Aulas de um dia (intervalo `[startIso, endIso)`), para a visão do admin. */
export async function fetchClassesForDay(
  startIso: string,
  endIso: string,
): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .gte('date_time', startIso)
    .lt('date_time', endIso)
    .order('date_time', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Dados para criar uma aula (rotina ou evento). */
export interface NewClassInput {
  title: string;
  type: ClassType;
  dateTimeIso: string;
  /** Turma da rotina; `null` para evento global. */
  groupId: string | null;
}

/** Cria uma aula (rotina vinculada a turma, ou evento global). */
export async function createClass(input: NewClassInput): Promise<void> {
  const { error } = await supabase.from('classes').insert({
    title: input.title.trim(),
    type: input.type,
    date_time: input.dateTimeIso,
    group_id: input.groupId,
  });
  if (error !== null) {
    throw error;
  }
}

/**
 * Alunos elegíveis a uma aula: os da turma informada; para eventos globais
 * (`groupId` nulo), todos os alunos.
 */
export async function fetchStudentsForGroup(
  groupId: string | null,
): Promise<Profile[]> {
  const base = supabase.from('profiles').select('*').eq('role', 'user');
  const query = groupId !== null ? base.eq('group_id', groupId) : base;
  const { data, error } = await query.order('name', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Presenças registradas para uma aula (visão do admin). */
export async function fetchAttendanceForClass(
  classId: string,
): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('class_id', classId);
  if (error !== null) {
    throw error;
  }
  return data;
}
