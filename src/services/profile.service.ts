import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import type { Profile } from '@/types/models';

/**
 * Serviço de perfil — leitura e escrita na tabela `profiles`, sempre via cliente
 * tipado (queries parametrizadas; nunca concatenação de SQL — CLAUDE.md §3).
 */

/** Busca o perfil de um usuário. Retorna `null` se ainda não existir. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Dados coletados no onboarding (já sanitizados: cpf/phone só com dígitos). */
export interface OnboardingProfileData {
  name: string;
  cpf: string;
  phone: string;
  /** Data de nascimento em ISO (`AAAA-MM-DD`). */
  dob: string;
}

/**
 * Conclui o onboarding: grava os dados pessoais e marca `is_first_login = false`.
 */
export async function completeProfileOnboarding(
  userId: string,
  data: OnboardingProfileData,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: data.name.trim(),
      cpf: data.cpf,
      phone: data.phone,
      dob: data.dob,
      is_first_login: false,
    })
    .eq('id', userId);
  if (error !== null) {
    throw error;
  }
}

/** Campos editáveis do perfil (variam conforme o papel — validado na UI). */
export interface EditableProfileData {
  /** Editável apenas por admin (aluno não altera o próprio nome nesta fase). */
  name?: string;
  phone: string;
  /** Data em ISO (`AAAA-MM-DD`) ou `null` para limpar. */
  dob: string | null;
}

/** Atualiza os campos permitidos do perfil. */
export async function updateProfile(
  userId: string,
  data: EditableProfileData,
): Promise<void> {
  const payload: { name?: string; phone: string; dob: string | null } = {
    phone: data.phone,
    dob: data.dob,
  };
  if (data.name !== undefined) {
    payload.name = data.name.trim();
  }
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error !== null) {
    throw error;
  }
}

/**
 * Cadastra um novo aluno (com turma opcional). A criação da conta (com senha
 * padrão) e a inicialização do perfil ocorrem numa Edge Function com
 * `service_role` (nunca no cliente), que valida se o chamador é admin.
 */
export async function createStudent(
  email: string,
  groupId: string | null,
): Promise<void> {
  const { error } = await supabase.functions.invoke('create-student', {
    body: { email: email.trim().toLowerCase(), groupId },
  });
  if (error !== null) {
    throw error;
  }
}

/** Lista todos os alunos (visão do admin). */
export async function fetchAllStudents(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'user')
    .order('name', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Lista todos os professores (para o admin escolher em quais aulas colocar). */
export async function fetchAllProfessors(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'professor')
    .order('name', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Cargo de um funcionário (professor ou administrador) — nunca aluno aqui. */
export type StaffRole = Extract<Database['public']['Enums']['user_role'], 'professor' | 'admin'>;

/** Dados para cadastrar professor ou admin (cadastro completo — sem onboarding). */
export interface StaffInput {
  email: string;
  name: string;
  /** Só dígitos. */
  cpf: string;
  role: StaffRole;
  /** Obrigatório para `professor`; deve ficar `null` para `admin`. */
  color: string | null;
}

/**
 * Cadastra professor ou administrador. Diferente de `createStudent`: o
 * cadastro nasce COMPLETO (nome e CPF já informados) — não há onboarding
 * depois. Roda na Edge Function `create-staff` (service_role, nunca no
 * cliente), que também valida o formato da cor e se o chamador é admin.
 */
export async function createStaff(input: StaffInput): Promise<void> {
  const { error } = await supabase.functions.invoke('create-staff', {
    body: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      cpf: input.cpf,
      role: input.role,
      color: input.color,
    },
  });
  if (error !== null) {
    throw error;
  }
}

/**
 * Atualiza a cor do PRÓPRIO professor. A RLS permite a autoedição deste
 * campo (e só deste, para quem não é admin); a constraint do banco garante
 * que só quem é professor pode ter uma cor.
 */
export async function updateOwnColor(userId: string, color: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ color }).eq('id', userId);
  if (error !== null) {
    throw error;
  }
}

/** Atribui/altera a turma de um aluno (apenas admin — enforced por RLS). */
export async function updateStudentGroup(
  studentId: string,
  groupId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ group_id: groupId })
    .eq('id', studentId);
  if (error !== null) {
    throw error;
  }
}

/**
 * Redefine a senha de um aluno para a padrão (ação exclusiva do admin).
 *
 * Roda na Edge Function `reset-student-password`, porque trocar a senha de
 * OUTRO usuário exige a `service_role`, que jamais pode existir no app. A
 * função também remarca `is_first_login`, forçando o aluno a definir uma senha
 * própria no próximo acesso — a senha padrão nunca vira definitiva.
 *
 * @param userId Id do aluno cuja senha será redefinida.
 * @throws Quando o chamador não é admin ou o aluno não existe.
 */
export async function resetStudentPassword(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-student-password', {
    body: { userId },
  });
  if (error !== null) {
    throw error;
  }
}

/**
 * Promove ou rebaixa um usuário entre aluno e administrador.
 *
 * A trava contra ficar sem administrador vive no banco (trigger
 * `prevent_last_admin_removal`), não aqui: validar só no app deixaria a brecha
 * aberta para qualquer outro cliente da API. O erro do banco sobe para a UI.
 *
 * @param userId Id do usuário alvo.
 * @param role   Novo papel.
 * @throws Quando é a última conta de administrador ativa.
 */
export async function updateUserRole(
  userId: string,
  role: Database['public']['Enums']['user_role'],
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error !== null) {
    throw error;
  }
}

/**
 * Ativa ou tranca a matrícula de um aluno.
 *
 * Trancar não apaga: o histórico de presença e o financeiro precisam
 * sobreviver. `deactivated_at` acompanha o status por causa da constraint de
 * coerência no banco.
 *
 * @param userId Id do aluno.
 * @param active `true` para reativar, `false` para trancar.
 */
export async function setStudentActive(
  userId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      status: active ? 'active' : 'inactive',
      deactivated_at: active ? null : new Date().toISOString(),
    })
    .eq('id', userId);
  if (error !== null) {
    throw error;
  }
}
