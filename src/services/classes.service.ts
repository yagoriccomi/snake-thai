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

/** Atualiza uma aula existente (edição pelo admin). */
export async function updateClass(id: string, input: NewClassInput): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({
      title: input.title.trim(),
      type: input.type,
      date_time: input.dateTimeIso,
      group_id: input.groupId,
    })
    .eq('id', id);
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

/**
 * Remove o registro de presença de um aluno numa aula — ele volta a aparecer
 * como "Pendente" (a elegibilidade vem da turma, não desta linha; apagá-la
 * só limpa a RESPOSTA, nunca tira o aluno da turma). Ação de quem gerencia a
 * aula (admin, ou o professor dela), não do próprio aluno. [#55]
 */
export async function clearAttendance(classId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', userId);
  if (error !== null) {
    throw error;
  }
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

/**
 * Um professor vinculado a uma aula — o suficiente para desenhar a bolinha
 * (nome + cor) e a faixa da borda. `joinedAt` decide a ORDEM das faixas: quem
 * entrou primeiro na aula ocupa a primeira faixa, da esquerda pra direita.
 */
export interface ClassTeacherRef {
  id: string;
  name: string | null;
  color: string | null;
  joinedAt: string;
}

/**
 * Professores de um conjunto de aulas, agrupados por `class_id`.
 *
 * Uma consulta só (join embutido do PostgREST), não uma por aula: a tela de
 * um dia inteiro não pode disparar N+1 requisições para pintar N cards. [#70]
 */
export async function fetchTeachersForClasses(
  classIds: string[],
): Promise<Record<string, ClassTeacherRef[]>> {
  if (classIds.length === 0) {
    return {};
  }
  const { data, error } = await supabase
    .from('class_teachers')
    .select('class_id, created_at, teacher:profiles!class_teachers_teacher_id_fkey(id, name, color)')
    .in('class_id', classIds)
    .order('created_at', { ascending: true });
  if (error !== null) {
    throw error;
  }

  const porAula: Record<string, ClassTeacherRef[]> = {};
  for (const linha of data) {
    const professor = linha.teacher;
    if (professor === null) {
      continue;
    }
    const lista = porAula[linha.class_id] ?? [];
    lista.push({
      id: professor.id,
      name: professor.name,
      color: professor.color,
      joinedAt: linha.created_at,
    });
    porAula[linha.class_id] = lista;
  }
  return porAula;
}

/**
 * Cria uma aula em nome de um PROFESSOR e o vincula como um dos professores
 * dela, na mesma operação lógica (dois passos, não uma transação — mesmo
 * padrão de `submitProof`: se o segundo passo falhar, a aula fica sem
 * professor, um problema de dado visível e corrigível, não uma brecha de
 * segurança). Sem o segundo passo, "criar para si mesmo" não teria efeito
 * algum, porque `classes` não guarda professor nenhum — só `class_teachers`. [#55]
 */
export async function createClassAsProfessor(
  input: NewClassInput,
  teacherId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      title: input.title.trim(),
      type: input.type,
      date_time: input.dateTimeIso,
      group_id: input.groupId,
    })
    .select('id')
    .single();
  if (error !== null) {
    throw error;
  }
  await addClassTeacher(data.id, teacherId);
}

/**
 * Vincula um professor a uma aula.
 *
 * Serve os dois fluxos ao mesmo tempo — "professor se inclui" (chamando com
 * o próprio id) e "admin põe qualquer professor" — porque quem decide se a
 * chamada é permitida é a RLS de `class_teachers`, não este código. [#20]
 */
export async function addClassTeacher(classId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from('class_teachers')
    .insert({ class_id: classId, teacher_id: teacherId });
  if (error !== null) {
    throw error;
  }
}

/** Remove o vínculo de um professor com uma aula (sair da aula / ser removido). */
export async function removeClassTeacher(classId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from('class_teachers')
    .delete()
    .eq('class_id', classId)
    .eq('teacher_id', teacherId);
  if (error !== null) {
    throw error;
  }
}
