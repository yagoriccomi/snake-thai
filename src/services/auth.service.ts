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
