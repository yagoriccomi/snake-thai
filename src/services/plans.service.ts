import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * Serviço de planos da academia.
 *
 * Preço vive em **centavos** (`price_cents`) — ponto flutuante não representa
 * 0,10 e erra o fechamento do mês (CLAUDE.md §3). A conversão para reais é
 * responsabilidade da borda de exibição (`@/utils/currency`).
 */

/** Linha de um plano. */
export type PlanRow = Database['public']['Tables']['plans']['Row'];

/** Periodicidade de cobrança aceita pelo domínio. */
export type BillingPeriod = Database['public']['Enums']['billing_period'];

/** Dados necessários para criar ou editar um plano. */
export interface PlanInput {
  name: string;
  description: string | null;
  /** Valor em centavos (ex.: 12990 = R$ 129,90). */
  priceCents: number;
  billingPeriod: BillingPeriod;
  /** Dia do vencimento, de 1 a 28. */
  dueDay: number;
  isActive: boolean;
}

/** Rótulos de exibição de cada periodicidade, na ordem em que aparecem na UI. */
export const BILLING_PERIOD_LABELS: Readonly<Record<BillingPeriod, string>> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

/** Menor e maior dia de vencimento aceitos (28 existe em todo mês). */
export const MIN_DUE_DAY = 1;
export const MAX_DUE_DAY = 28;

/**
 * Lista os planos cadastrados.
 *
 * @param onlyActive Quando `true`, devolve apenas os planos disponíveis para
 *                   novas contratações; o histórico continua íntegro.
 */
export async function fetchPlans(onlyActive = false): Promise<PlanRow[]> {
  const query = supabase.from('plans').select('*').order('name');
  const { data, error } = onlyActive ? await query.eq('is_active', true) : await query;
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Busca um plano pelo id — usado pelo aluno para ver o próprio plano.
 *
 * Aceita plano inativo de propósito: se a academia aposentar um plano, quem
 * ainda está nele precisa continuar enxergando o que contratou.
 *
 * @returns O plano, ou `null` se não existir (aluno sem plano vinculado).
 */
export async function fetchPlanById(id: string): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Cria um plano (apenas admin — garantido por RLS).
 *
 * @param input Dados do plano, com preço já convertido para centavos.
 * @returns A linha criada.
 */
export async function createPlan(input: PlanInput): Promise<PlanRow> {
  const { data, error } = await supabase
    .from('plans')
    .insert(toRow(input))
    .select('*')
    .single();
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Edita um plano existente.
 *
 * Reajustar o preço NÃO altera cobranças já emitidas: cada pagamento congela o
 * próprio `amount_cents` no momento da geração.
 *
 * @param id    Identificador do plano.
 * @param input Novos dados do plano.
 */
export async function updatePlan(id: string, input: PlanInput): Promise<PlanRow> {
  const { data, error } = await supabase
    .from('plans')
    .update(toRow(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Desativa um plano em vez de apagá-lo.
 *
 * Excluir de verdade quebraria o vínculo dos pagamentos que o referenciam; a
 * desativação tira o plano das novas contratações e preserva o histórico [#89].
 *
 * @param id Identificador do plano.
 */
export async function deactivatePlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: false })
    .eq('id', id);
  if (error !== null) {
    throw error;
  }
}

/** Converte o input de domínio na forma da tabela. */
function toRow(input: PlanInput): Database['public']['Tables']['plans']['Insert'] {
  // `?? null` só cobre null/undefined: uma descrição composta apenas de espaços
  // vira string vazia no trim e seria gravada como '' — dois estados diferentes
  // no banco significando a mesma coisa ("sem descrição").
  const description = input.description?.trim();
  return {
    name: input.name.trim(),
    description: description === undefined || description === '' ? null : description,
    price_cents: input.priceCents,
    billing_period: input.billingPeriod,
    due_day: input.dueDay,
    is_active: input.isActive,
  };
}
