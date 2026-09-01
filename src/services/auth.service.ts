import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Serviço de autenticação — encapsula as chamadas do Supabase Auth para manter
 * a UI desacoplada do SDK. A sessão é persistida de forma cifrada (LargeSecureStore).
 */

/** Autentica com e-mail e senha (mesma tela para admin e aluno). */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error !== null) {
    throw error;
  }
  return data.session;
}

/** Encerra a sessão atual. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error !== null) {
    throw error;
  }
}

/** Atualiza a senha do usuário autenticado (usado no onboarding). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error !== null) {
    throw error;
  }
}

/**
 * Troca a senha do usuário autenticado exigindo a senha atual.
 *
 * O Supabase permite `updateUser({ password })` só com a sessão válida, sem
 * pedir a senha vigente. Isso é arriscado no celular: quem pegasse o aparelho
 * desbloqueado trocaria a senha e tomaria a conta. Por isso reautenticamos
 * antes — se a senha atual não confere, o `signInWithPassword` falha e nada é
 * alterado.
 *
 * @param currentPassword Senha vigente, digitada pelo usuário.
 * @param newPassword     Nova senha (já validada pela política do app).
 * @throws Quando a senha atual está errada ou a atualização falha.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user.email;
  if (email === undefined || email === null) {
    throw new Error('Sessão inválida.');
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError !== null) {
    throw new Error('SENHA_ATUAL_INVALIDA');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error !== null) {
    throw error;
  }
}
