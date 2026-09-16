import type { ReferenciaDeComprovante } from '@/services/proofs.service';
import { removerArquivoDoComprovante } from '@/services/proofs.service';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import { situacaoSemPagamento } from '@/utils/payments';

export type { ProofUpload, ReferenciaDeComprovante } from '@/services/proofs.service';
export {
  submitProof,
  createSignedProofUrl,
} from '@/services/proofs.service';

/** Tipos derivados do esquema para o financeiro. */
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

/** Modo de listagem do aluno: pagamentos ativos ou histórico (pagos). */
export type StudentPaymentsMode = 'active' | 'history';

/** Pagamentos do aluno: ativos (open/overdue/pending) ou histórico (paid). */
export async function fetchStudentPayments(
  userId: string,
  mode: StudentPaymentsMode,
): Promise<PaymentRow[]> {
  const base = supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  const query =
    mode === 'history'
      ? base.eq('status', 'paid')
      : base.in('status', ['open', 'overdue', 'pending_approval']);
  const { data, error } = await query;
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Histórico completo de mensalidades de um aluno, da competência mais recente
 * para a mais antiga. Todas as situações, não só as pagas: ao averiguar um mês,
 * o admin precisa ver também o que ficou em aberto. A RLS limita o aluno ao
 * próprio histórico.
 */
export async function fetchPaymentHistory(userId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('reference_month', { ascending: false });
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Mensalidades de uma competência (`AAAA-MM-01`), todas as situações — visão
 * do admin, que escolhe o mês no financeiro geral.
 */
export async function fetchPaymentsForMonth(referenceMonth: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('reference_month', referenceMonth)
    .order('due_date', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Competência e situação de uma mensalidade — o mínimo para o seletor de meses. */
export type PaymentMonthStatus = Pick<PaymentRow, 'reference_month' | 'status'>;

/**
 * Competência e situação de TODAS as mensalidades, sem o resto das colunas:
 * alimenta o seletor de meses (quais existem e onde há atraso) sem trazer
 * dados de pagamento de meses que ninguém abriu.
 */
export async function fetchPaymentMonthsOverview(): Promise<PaymentMonthStatus[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('reference_month, status')
    .order('reference_month', { ascending: false });
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Aprova o pagamento (status → paid).
 *
 * `paid_at` viaja JUNTO com o status porque a constraint
 * `payments_paid_at_matches_status` exige `(status = 'paid') = (paid_at is not
 * null)`. Gravar só o status fazia TODA aprovação falhar no banco — o admin via
 * "Não foi possível aprovar o pagamento" e nenhuma mensalidade era quitada.
 */
export async function approvePayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', paymentId);
  if (error !== null) {
    throw error;
  }
}

/**
 * Recusa o comprovante: apaga o arquivo e volta o pagamento para `open`.
 *
 * Limpar as tres colunas de comprovante nao e detalhe: e o que dispara o
 * gatilho que enfileira a eliminacao do arquivo no provedor. Zerar so o
 * `proof_url` deixaria o arquivo vivo na Cloudinary para sempre. [#63]
 */
export async function rejectPayment(
  payment: ReferenciaDeComprovante,
): Promise<void> {
  await removerArquivoDoComprovante(payment);

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'open',
      // Mesma constraint da aprovação, no sentido inverso: cobrança reaberta
      // não pode carregar data de pagamento.
      paid_at: null,
      proof_provider: null,
      proof_public_id: null,
      proof_storage_path: null,
      proof_url: null,
    })
    .eq('id', payment.id);
  if (error !== null) {
    throw error;
  }
}

/**
 * Desfaz um pagamento (admin): a mensalidade volta a "em aberto" ou "vencida",
 * conforme o vencimento, e perde a data de pagamento.
 *
 * O comprovante, se houver, NÃO é apagado: desmarcar um pagamento lançado por
 * engano não pode destruir o que o aluno enviou. Apagar o arquivo é o que faz
 * "Recusar comprovante", e é outra decisão.
 *
 * Marcar como paga é `approvePayment` — o mesmo registro, com ou sem anexo.
 */
export async function markPaymentAsUnpaid(
  payment: Pick<PaymentRow, 'id' | 'due_date'>,
  hoje: Date = new Date(),
): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: situacaoSemPagamento(payment.due_date, hoje), paid_at: null })
    .eq('id', payment.id);
  if (error !== null) {
    throw error;
  }
}
