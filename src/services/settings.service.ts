import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * Serviço da configuração da academia (white-label).
 *
 * Concentra o que antes eram constantes de código — chave PIX, senha padrão do
 * aluno, cor da marca, dia de vencimento. Enquanto viviam em `src/constants/`,
 * qualquer mudança exigia desenvolvedor, build e nova instalação; agora o
 * próprio administrador altera pela interface.
 *
 * A tabela é um **singleton**: uma constraint no banco garante uma única linha.
 */

/** Linha de configuração da academia. */
export type AcademySettingsRow =
  Database['public']['Tables']['academy_settings']['Row'];

/** Campos que o administrador pode alterar. */
export type AcademySettingsInput = Pick<
  Database['public']['Tables']['academy_settings']['Update'],
  | 'academy_name'
  | 'logo_url'
  | 'primary_color'
  | 'contact_email'
  | 'contact_phone'
  | 'address'
  | 'pix_key'
  | 'pix_holder_name'
  | 'default_due_day'
  | 'default_plan_id'
>;

/** Identificador da linha única (a coluna `id` é sempre `true`). */
const SINGLETON_ID = true;

/**
 * Lê a configuração vigente da academia.
 *
 * @returns A configuração, ou `null` se a linha ainda não existir — o app deve
 *          continuar funcionando com os padrões em vez de travar o boot.
 */
export async function fetchAcademySettings(): Promise<AcademySettingsRow | null> {
  const { data, error } = await supabase
    .from('academy_settings')
    .select('*')
    .eq('id', SINGLETON_ID)
    .maybeSingle();
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Atualiza a configuração da academia (apenas admin — garantido por RLS).
 *
 * @param input Campos a alterar; os omitidos permanecem como estão.
 * @returns A configuração já atualizada.
 */
export async function updateAcademySettings(
  input: AcademySettingsInput,
): Promise<AcademySettingsRow> {
  const { data, error } = await supabase
    .from('academy_settings')
    .update(input)
    .eq('id', SINGLETON_ID)
    .select('*')
    .single();
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Senha de primeiro acesso (só admin). Não vive mais em `academy_settings`,
 * que todo usuário logado lê: fica numa tabela que só o servidor acessa, e as
 * Edge Functions de conta usam exatamente este valor.
 */
export async function fetchDefaultStudentPassword(): Promise<string | null> {
  const { data, error } = await supabase.rpc('senha_padrao_da_academia');
  if (error !== null) {
    throw error;
  }
  return typeof data === 'string' ? data : null;
}

/** Troca a senha de primeiro acesso (só admin; mínimo de 8 caracteres). */
export async function updateDefaultStudentPassword(password: string): Promise<void> {
  const { error } = await supabase.rpc('definir_senha_padrao_da_academia', { p_senha: password });
  if (error !== null) {
    throw lerErroDoBanco(error, ['23514']);
  }
}

/**
 * Quantas contas ainda não fizeram o primeiro acesso — seguem com a senha
 * anterior depois de uma troca, e vale redefinir a delas.
 */
export async function countAccountsWithoutFirstAccess(): Promise<number> {
  const { data, error } = await supabase.rpc('contas_sem_primeiro_acesso');
  if (error !== null) {
    throw error;
  }
  return typeof data === 'number' ? data : 0;
}
