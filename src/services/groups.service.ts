import { ErroDeFuncao, lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import { horarioEstaAtivo } from '@/utils/gradeSemanal';
import { comoObjeto, lerBooleano, lerInteiro, lerTexto } from '@/utils/jsonDoBanco';

/** Linha de uma turma. */
export type GroupRow = Database['public']['Tables']['groups']['Row'];

/** Recusas das funções de turma que já trazem a explicação para a pessoa. */
const RECUSAS_COM_MENSAGEM = ['22023', '23514', 'P0002'] as const;

/**
 * Lista as turmas cadastradas (ordenadas por nome), INCLUSIVE as arquivadas:
 * aulas e frequências antigas ainda precisam do nome delas. Seletor de turma
 * filtra as ativas.
 */
export async function fetchGroups(): Promise<GroupRow[]> {
  const { data, error } = await supabase.from('groups').select('*').order('name');
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Cria uma turma e retorna a linha criada (apenas admin — enforced por RLS). */
export async function createGroup(name: string): Promise<GroupRow> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: name.trim() })
    .select('*')
    .single();
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Turma na tela de gestão, com o que o admin precisa ver antes de mexer. */
export interface GroupOverview {
  group: GroupRow;
  studentCount: number;
  activeScheduleCount: number;
}

/**
 * Turmas com a contagem de alunos e de horários vigentes — duas consultas,
 * não uma por turma. [#70]
 *
 * @param hojeIso Hoje, `AAAA-MM-DD`: horário encerrado antes disso não conta.
 */
export async function fetchGroupsOverview(hojeIso: string): Promise<GroupOverview[]> {
  const { data: turmas, error } = await supabase
    .from('groups')
    .select('*, profiles(count)')
    .order('name');
  if (error !== null) {
    throw error;
  }
  const { data: horarios, error: erroHorarios } = await supabase
    .from('class_schedules')
    .select('group_id, valid_until');
  if (erroHorarios !== null) {
    throw erroHorarios;
  }

  const horariosPorTurma = new Map<string, number>();
  for (const horario of horarios) {
    if (horarioEstaAtivo(horario.valid_until, hojeIso)) {
      horariosPorTurma.set(horario.group_id, (horariosPorTurma.get(horario.group_id) ?? 0) + 1);
    }
  }

  return turmas.map(({ profiles, ...group }) => ({
    group,
    studentCount: profiles[0]?.count ?? 0,
    activeScheduleCount: horariosPorTurma.get(group.id) ?? 0,
  }));
}

/**
 * Renomeia uma turma. Só o nome muda pelo app (privilégio por coluna no banco).
 */
export async function renameGroup(id: string, name: string): Promise<GroupRow> {
  const { data, error } = await supabase
    .from('groups')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('*')
    .single();
  if (error !== null) {
    // O nome é único: o erro cru traria "duplicate key value ..." em inglês.
    if (error.code === '23505') {
      throw new ErroDeFuncao('Já existe uma turma com esse nome.', null);
    }
    throw error;
  }
  return data;
}

/** O que excluir a turma vai fazer, para a pessoa decidir antes. */
export interface GroupRemovalPreview {
  archived: boolean;
  students: number;
  futureClassesWithoutRollCall: number;
  pastClasses: number;
  activeSchedules: number;
  frozenMonths: number;
  /** Sem histórico: a turma some de vez em vez de ser arquivada. */
  canDeleteForGood: boolean;
}

const PREVIA = 'previa_exclusao_turma';

/** Prévia da exclusão (só admin). */
export async function previewGroupRemoval(groupId: string): Promise<GroupRemovalPreview> {
  const { data, error } = await supabase.rpc(PREVIA, { p_group_id: groupId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_MENSAGEM);
  }
  const previa = comoObjeto(data, PREVIA);
  return {
    archived: lerBooleano(previa, 'arquivada', PREVIA),
    students: lerInteiro(previa, 'alunos', PREVIA),
    futureClassesWithoutRollCall: lerInteiro(previa, 'aulas_futuras_sem_chamada', PREVIA),
    pastClasses: lerInteiro(previa, 'aulas_passadas', PREVIA),
    activeSchedules: lerInteiro(previa, 'horarios_ativos', PREVIA),
    frozenMonths: lerInteiro(previa, 'meses_congelados', PREVIA),
    canDeleteForGood: lerBooleano(previa, 'pode_apagar_de_vez', PREVIA),
  };
}

/** Para onde vão os alunos da turma excluída. */
export interface GroupRemovalInput {
  groupId: string;
  /** Turma de destino; `null` só junto de `leaveWithoutGroup`. */
  destinationGroupId: string | null;
  /** "Sem turma" escolhido de propósito: o aluno passa a ver só eventos. */
  leaveWithoutGroup: boolean;
}

export interface GroupRemovalResult {
  action: 'apagada' | 'arquivada';
  movedStudents: number;
  removedClasses: number;
  deletedSchedules: number;
}

const EXCLUIR = 'excluir_turma';

/**
 * Exclui a turma: apaga a nunca usada, arquiva a com histórico. O banco move
 * os alunos, tira as aulas futuras sem chamada e encerra os horários, numa
 * transação só.
 */
export async function removeGroup(input: GroupRemovalInput): Promise<GroupRemovalResult> {
  const { data, error } = await supabase.rpc(EXCLUIR, {
    p_group_id: input.groupId,
    p_deixar_sem_turma: input.leaveWithoutGroup,
    ...(input.destinationGroupId !== null ? { p_destino: input.destinationGroupId } : {}),
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_MENSAGEM);
  }
  const resultado = comoObjeto(data, EXCLUIR);
  const acao = lerTexto(resultado, 'acao', EXCLUIR);
  if (acao !== 'apagada' && acao !== 'arquivada') {
    throw new Error(`Resposta inesperada do banco (${EXCLUIR}.acao).`);
  }
  return {
    action: acao,
    movedStudents: lerInteiro(resultado, 'alunos_movidos', EXCLUIR),
    removedClasses: lerInteiro(resultado, 'aulas_removidas', EXCLUIR),
    deletedSchedules: lerInteiro(resultado, 'horarios_apagados', EXCLUIR),
  };
}

/** Reativa uma turma arquivada: volta aos seletores e aceita alunos e aulas. */
export async function reactivateGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('reativar_turma', { p_group_id: groupId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_MENSAGEM);
  }
}
