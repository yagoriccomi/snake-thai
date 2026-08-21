import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/** Linha de uma turma. */
export type GroupRow = Database['public']['Tables']['groups']['Row'];

/** Lista as turmas cadastradas (ordenadas por nome). */
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
