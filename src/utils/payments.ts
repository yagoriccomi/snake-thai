import type { PaymentRow } from '@/services/payments.service';
import { formatFullDate } from '@/utils/datetime';

const MS_POR_DIA = 86_400_000;

/** Meia-noite local do dia de `data`, em milissegundos. */
function inicioDoDia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/**
 * Dias de atraso de uma mensalidade: até o pagamento, se foi paga; até hoje,
 * se ainda não foi. Nunca negativo — pagar antes do vencimento é "em dia".
 *
 * O vencimento é data sem hora (`AAAA-MM-DD`) e é lido como dia LOCAL. Ler com
 * `new Date("2026-08-10")` o trataria como UTC, e todo pagamento feito no
 * próprio dia do vencimento apareceria com um dia de atraso.
 *
 * @param hoje Injetável para teste; padrão é o relógio do aparelho.
 */
export function diasDeAtraso(
  payment: Pick<PaymentRow, 'due_date' | 'paid_at'>,
  hoje: Date = new Date(),
): number {
  const [ano, mes, dia] = payment.due_date.split('-').map(Number);
  const vencimento = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1).getTime();
  const referencia = payment.paid_at !== null ? new Date(payment.paid_at) : hoje;
  const dias = Math.round((inicioDoDia(referencia) - vencimento) / MS_POR_DIA);
  return Math.max(0, dias);
}

function rotuloDeAtraso(dias: number): string {
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

/**
 * Linha "Pagamento" do histórico: quando pagou e se foi em dia — o que o admin
 * procura ao averiguar um mês.
 */
export function descreverPagamento(
  payment: Pick<PaymentRow, 'due_date' | 'paid_at' | 'status'>,
  hoje: Date = new Date(),
): string {
  const atraso = diasDeAtraso(payment, hoje);
  if (payment.paid_at !== null) {
    const quando = formatFullDate(payment.paid_at);
    return atraso > 0 ? `${quando} · ${rotuloDeAtraso(atraso)}` : `${quando} · em dia`;
  }
  if (payment.status === 'overdue' && atraso > 0) {
    return `Não pago · ${rotuloDeAtraso(atraso)}`;
  }
  return 'Não pago';
}

/** Quantas mensalidades em cada situação. */
export interface ResumoDePagamentos {
  pagas: number;
  emAtraso: number;
  emAberto: number;
  emAnalise: number;
}

/** Conta as mensalidades de um histórico por situação. */
export function resumirPagamentos(
  payments: readonly Pick<PaymentRow, 'status'>[],
): ResumoDePagamentos {
  const resumo: ResumoDePagamentos = { pagas: 0, emAtraso: 0, emAberto: 0, emAnalise: 0 };
  for (const { status } of payments) {
    if (status === 'paid') resumo.pagas += 1;
    else if (status === 'overdue') resumo.emAtraso += 1;
    else if (status === 'pending_approval') resumo.emAnalise += 1;
    else resumo.emAberto += 1;
  }
  return resumo;
}
