import { lerErroDoBanco } from '@/lib/functionsError';
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

/** Modalidade do plano (contrato § 5, D1): fixo, livre (com cota) ou à vontade. */
export type ScheduleMode = Database['public']['Enums']['plan_schedule_mode'];

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
  scheduleMode: ScheduleMode;
  /** Aulas por semana; só no plano livre (ignorada nos outros). */
  weeklyQuota: number | null;
}

/** Rótulos de exibição de cada periodicidade, na ordem em que aparecem na UI. */
export const BILLING_PERIOD_LABELS: Readonly<Record<BillingPeriod, string>> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

/** Rótulos da § 3 do contrato, iguais no app e na web. */
export const SCHEDULE_MODE_LABELS: Readonly<Record<ScheduleMode, string>> = {
  fixed: 'Horário fixo',
  free: 'Horário livre',
  unlimited: 'À vontade',
};

/** Cota do plano livre: de 1 a 6 aulas por semana (`plans_cota_coerente`). */
export const MIN_WEEKLY_QUOTA = 1;
export const MAX_WEEKLY_QUOTA = 6;

/** SQLSTATE da recusa escrita pelo banco para a pessoa: plano com histórico (T4). */
const CODIGOS_COM_FRASE_DO_PLANO = ['23514'] as const;

/** O que o plano pede do aluno, em uma linha (lista de planos, mockup da linha A). */
export function resumoDaModalidade(plan: Pick<PlanRow, 'schedule_mode' | 'weekly_quota'>): string {
  if (plan.schedule_mode === 'free') return `${plan.weekly_quota ?? MIN_WEEKLY_QUOTA}x por semana`;
  if (plan.schedule_mode === 'unlimited') return 'Sem cota · meta do aluno';
  return 'Segue a grade da turma';
}

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
    // Plano com histórico não muda de modalidade nem de cota (T4): a frase é do banco.
    throw lerErroDoBanco(error, CODIGOS_COM_FRASE_DO_PLANO);
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
    schedule_mode: input.scheduleMode,
    // A cota só existe no livre; nos outros o banco exige nulo (`plans_cota_coerente`).
    weekly_quota: input.scheduleMode === 'free' ? input.weeklyQuota : null,
  };
}
