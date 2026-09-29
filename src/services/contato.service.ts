import { supabase } from '@/lib/supabase';
import type { ContatoDaAcademia } from '@/utils/contato';

/** Lê um campo de texto do JSON da RPC; qualquer outra coisa conta como "não cadastrado". */
function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/**
 * O contato público da academia (contrato § 5.4). App e web leem o contato
 * **só por esta RPC**, nunca por `select` em `academy_settings`; ela não existe
 * antes do login (D52).
 */
export async function fetchContatoDaAcademia(): Promise<ContatoDaAcademia> {
  const { data, error } = await supabase.rpc('contato_da_academia');
  if (error !== null) {
    throw error;
  }
  const json = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  return { whatsapp: textoOuNulo(json.whatsapp), email: textoOuNulo(json.email) };
}
