import { supabase } from '@/lib/supabase';
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
 * Cadastra um novo aluno. A criação da conta (com senha padrão) e a
 * inicialização do perfil ocorrem numa Edge Function com `service_role`
 * (nunca no cliente), que valida se o chamador é admin.
 */
export async function createStudent(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('create-student', {
    body: { email: email.trim().toLowerCase() },
  });
  if (error !== null) {
    throw error;
  }
}
