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
  | 'default_student_password'
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
