import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * As aulas do ponto de vista do aluno (contrato § 12 e § 12.2). O app decide
 * rótulos, botões e o aviso da cota **só** por estas colunas; o banco confere
 * tudo de novo quando a pessoa age.
 */

type Enums = Database['public']['Enums'];

export type ScheduleModeDoAluno = Enums['plan_schedule_mode'];
export type OrigemDaAula = 'turma' | 'permanente' | 'troca' | 'troca_pendente' | 'extra' | 'trocou' | 'marcou' | 'incluido';

export interface ProfessorDaAula {
  id: string;
  name: string | null;
  color: string | null;
}

/** Uma linha de `aulas_do_aluno` ou de `menu_de_aulas` (as duas têm as mesmas colunas). */
export interface AulaDoAluno {
  class_id: string;
  title: string;
  type: Enums['class_type'];
  date_time: string;
  group_id: string | null;
  group_name: string | null;
  audience: Enums['class_audience'];
  cancelled: boolean;
  declared_status: Enums['attendance_status'] | null;
  status: Enums['attendance_status'] | null;
  justification_id: string | null;
  justification_status: Enums['justification_status'] | null;
  schedule_mode: ScheduleModeDoAluno;
  /** Cota (livre) ou meta (à vontade) da semana; nulo para o fixo. */
  weekly_target: number | null;
  marked_in_week: number;
  can_justify: boolean;
  justify_until: string | null;
  can_contest: boolean;
  contest_until: string | null;
  teachers: ProfessorDaAula[];
  /** Nulo = a aula não é dele (só aparece no menu). */
  origem: OrigemDaAula | null;
  is_recurring: boolean;
  schedule_ends_on: string | null;
  can_mark_extra: boolean;
  can_swap_from: boolean;
  can_swap_from_permanent: boolean;
  can_swap_to: boolean;
  swap_id: string | null;
  swap_kind: Enums['class_swap_kind'] | null;
  swap_status: Enums['class_swap_status'] | null;
  swap_decided_via: string | null;
  swap_role: 'origem' | 'destino' | null;
  swap_other_class_id: string | null;
  swap_other_date_time: string | null;
  can_cancel_swap: boolean;
}

/** O que o banco devolve ao declarar (§ 9.2). */
export interface ResultadoDaDeclaracao {
  marcadasNaSemana: number;
  cota: number | null;
  acimaDaCota: boolean;
}

/** Recusas que o banco escreve para a pessoa (§ 9.2, § 12.2, § 5.3). */
const RECUSAS_COM_FRASE = ['23514', '22023', 'P0002', '42501'] as const;

/**
 * Os tipos gerados não sabem quais colunas de uma função podem vir nulas.
 * Aqui a linha ganha o tipo certo, e `teachers` sai do jsonb como lista. [#11]
 */
function comoAula(linha: Record<string, unknown>): AulaDoAluno {
  const aula = linha as unknown as AulaDoAluno;
  return { ...aula, teachers: Array.isArray(linha.teachers) ? (linha.teachers as ProfessorDaAula[]) : [] };
}

/** As aulas do próprio aluno entre `de` e `ate` (§ 12). */
export async function fetchAulasDoAluno(de: Date, ate: Date): Promise<AulaDoAluno[]> {
  const { data, error } = await supabase.rpc('aulas_do_aluno', {
    p_de: de.toISOString(),
    p_ate: ate.toISOString(),
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return (data as unknown as Record<string, unknown>[]).map(comoAula);
}

/**
 * O menu de aulas de uma semana (§ 12.2): esta ou a próxima. `semanaIso` é
 * qualquer dia da semana (`AAAA-MM-DD`); o banco normaliza para a segunda.
 */
export async function fetchMenuDeAulas(semanaIso: string): Promise<AulaDoAluno[]> {
  const { data, error } = await supabase.rpc('menu_de_aulas', { p_semana: semanaIso });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return (data as unknown as Record<string, unknown>[]).map(comoAula);
}

/** "Vou" (`true`) ou "Não vou" / "Desmarcar" (`false`) numa aula (§ 9.2). */
export async function declararAula(classId: string, vou: boolean): Promise<ResultadoDaDeclaracao> {
  const { data, error } = await supabase.rpc('declarar_aula', { p_class_id: classId, p_vou: vou });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  const json = (data ?? {}) as Record<string, unknown>;
  return {
    marcadasNaSemana: typeof json.marcadas_na_semana === 'number' ? json.marcadas_na_semana : 0,
    cota: typeof json.cota === 'number' ? json.cota : null,
    acimaDaCota: json.acima_da_cota === true,
  };
}

/** Meta do à vontade (§ 5.3): vale a partir da próxima segunda. */
export async function definirMetaSemanal(meta: number): Promise<{ meta: number; valeAPartir: string }> {
  const { data, error } = await supabase.rpc('definir_meta_semanal', { p_meta: meta });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  const json = (data ?? {}) as Record<string, unknown>;
  return { meta: Number(json.meta), valeAPartir: String(json.vale_a_partir) };
}
