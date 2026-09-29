import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import type { Profile } from '@/types/models';

/** SQLSTATE das recusas de vínculo com a aula que o banco escreve para a pessoa. */
const CODIGOS_COM_FRASE_DA_AULA = ['23514'] as const;

/** Tipos derivados do esquema para o módulo de Aulas. */
export type ClassRow = Database['public']['Tables']['classes']['Row'];
export type ClassType = Database['public']['Enums']['class_type'];
export type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

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

/** Opções da edição de uma aula. */
export interface UpdateClassOptions {
  /** A aula veio da grade semanal (`schedule_id` preenchido). */
  isScheduleOccurrence?: boolean;
}

/**
 * Atualiza uma aula existente (edição pelo admin).
 *
 * Aula da grade editada à mão fica DESVINCULADA: uma edição posterior do
 * horário não sobrescreve o que o admin ajustou nesta data. [PLANO-T6 P4]
 */
export async function updateClass(
  id: string,
  input: NewClassInput,
  options: UpdateClassOptions = {},
): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({
      title: input.title.trim(),
      type: input.type,
      date_time: input.dateTimeIso,
      group_id: input.groupId,
      ...(options.isScheduleOccurrence === true ? { schedule_detached: true } : {}),
    })
    .eq('id', id);
  if (error !== null) {
    throw error;
  }
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
  const { data: vinculos, error } = await supabase
    .from('class_teachers')
    .select('class_id, teacher_id, created_at')
    .in('class_id', classIds)
    .order('created_at', { ascending: true });
  if (error !== null) {
    throw error;
  }
  if (vinculos.length === 0) {
    return {};
  }

  // Nome e cor vêm do DIRETÓRIO, não de `profiles`: a RLS de profiles é
  // "só o próprio ou admin", então um join embutido devolvia `null` para
  // aluno e professor, e a bolinha colorida sumia justamente para quem ela
  // foi feita. O diretório expõe só id/nome/cor, sem dado pessoal. [#54]
  const idsDosProfessores = [...new Set(vinculos.map((v) => v.teacher_id))];
  const { data: professores, error: erroProfessores } = await supabase
    .from('diretorio_perfis')
    .select('id, name, color')
    .in('id', idsDosProfessores);
  if (erroProfessores !== null) {
    throw erroProfessores;
  }

  const porId = new Map(professores.map((p) => [p.id, p]));
  const porAula: Record<string, ClassTeacherRef[]> = {};
  for (const vinculo of vinculos) {
    const professor = porId.get(vinculo.teacher_id);
    if (professor === undefined) {
      continue;
    }
    const lista = porAula[vinculo.class_id] ?? [];
    lista.push({
      id: vinculo.teacher_id,
      name: professor.name,
      color: professor.color,
      joinedAt: vinculo.created_at,
    });
    porAula[vinculo.class_id] = lista;
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
    // O banco explica a recusa (ex.: "Escolha a sua cor antes de entrar na aula.", T24).
    throw lerErroDoBanco(error, CODIGOS_COM_FRASE_DA_AULA);
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
    // Ex.: "A equipe de uma aula que já começou só muda pela chamada."
    throw lerErroDoBanco(error, CODIGOS_COM_FRASE_DA_AULA);
  }
}
