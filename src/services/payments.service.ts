import type { ReferenciaDeComprovante } from '@/services/proofs.service';
import { removerArquivoDoComprovante } from '@/services/proofs.service';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

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

/** Pagamentos por status (visão do admin). */
export async function fetchPaymentsByStatus(
  status: PaymentStatus,
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('status', status)
    .order('due_date', { ascending: true });
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Aprova o pagamento (status → paid). */
export async function approvePayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'paid' })
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

/** Primeiro instante do mês corrente, em ISO (para filtrar "recebido no mês"). */
function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Soma, em centavos, das mensalidades quitadas no mês corrente.
 *
 * Base do indicador "recebido" do painel do admin. Some no cliente em vez de um
 * RPC de SUM: o volume mensal é pequeno e evita uma função extra no banco.
 */
export async function fetchReceivedThisMonthCents(): Promise<number> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('status', 'paid')
    .gte('paid_at', startOfCurrentMonthIso());
  if (error !== null) {
    throw error;
  }
  return (data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
}
