// ============================================================================
// Senha de primeiro acesso — lida do banco, nunca de um literal no código.
//
// Vive em academy_secrets (só service_role lê; o admin troca pelo app). O
// repositório é público: um valor fixo aqui seria a senha de toda conta nova
// para qualquer pessoa. Sem senha configurada, quem chama recusa com 500 em vez
// de inventar uma. Ver migration senha_padrao_protegida (lacuna L1).
// ============================================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TAMANHO_MINIMO = 8;

/** A senha configurada, ou `null` se faltar ou não puder ser lida. */
export async function lerSenhaPadrao(adminClient: SupabaseClient): Promise<string | null> {
  const { data, error } = await adminClient
    .from('academy_secrets')
    .select('default_student_password')
    .eq('id', true)
    .maybeSingle();
  if (error !== null || data === null) {
    return null;
  }
  const senha = (data as { default_student_password?: unknown }).default_student_password;
  return typeof senha === 'string' && senha.length >= TAMANHO_MINIMO ? senha : null;
}

export const ERRO_SENHA_NAO_CONFIGURADA = 'Senha de primeiro acesso não configurada. Defina em Configurações.';
