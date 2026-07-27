import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { PROOF_BUCKET } from '@/constants/payments';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

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

/** Remove caracteres perigosos do nome do arquivo antes de compor o caminho. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/** Dados para o upload do comprovante. */
export interface ProofUpload {
  userId: string;
  paymentId: string;
  fileUri: string;
  fileName: string;
  contentType: string;
  /** base64 já lido (ex.: expo-image-picker) — evita reler o arquivo. */
  base64?: string;
}

/**
 * Envia o comprovante ao Storage (caminho `<auth.uid()>/...`, respeitando a RLS
 * de Storage) e marca o pagamento como `pending_approval` com o proof_url (path).
 */
export async function submitProof(upload: ProofUpload): Promise<void> {
  const { userId, paymentId, fileUri, fileName, contentType, base64 } = upload;
  const path = `${userId}/${paymentId}_${sanitizeFileName(fileName)}`;

  const raw =
    base64 ??
    (await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
  const bytes = decode(raw);

  const { error: uploadError } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadError !== null) {
    throw uploadError;
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update({ status: 'pending_approval', proof_url: path })
    .eq('id', paymentId);
  if (updateError !== null) {
    throw updateError;
  }
}

/** Gera uma URL assinada (10 min) para o admin visualizar o comprovante privado. */
export async function createSignedProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, 600);
  if (error !== null) {
    throw error;
  }
  return data.signedUrl;
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

/** Recusa o comprovante: apaga o arquivo e volta o pagamento para `open`. */
export async function rejectPayment(
  payment: Pick<PaymentRow, 'id' | 'proof_url'>,
): Promise<void> {
  if (payment.proof_url !== null) {
    await supabase.storage.from(PROOF_BUCKET).remove([payment.proof_url]);
  }
  const { error } = await supabase
    .from('payments')
    .update({ status: 'open', proof_url: null })
    .eq('id', payment.id);
  if (error !== null) {
    throw error;
  }
}
