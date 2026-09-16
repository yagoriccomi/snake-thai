import type { PaymentRow, PaymentStatus } from '@/services/payments.service';
import type { ColorScheme } from '@/theme/colors';
import { formatFullDate } from '@/utils/datetime';

/** Rótulo de cada situação — o mesmo texto do selo `PaymentStatusBadge`. */
export const ROTULO_DA_SITUACAO: Readonly<Record<PaymentStatus, string>> = {
  paid: 'Paga',
  overdue: 'Vencida',
  pending_approval: 'Em análise',
  open: 'Em aberto',
};

/** Cor de cada situação nos marcadores (seletor de mês). */
export function coresDasSituacoes(colors: ColorScheme): Record<PaymentStatus, string> {
  return {
    paid: colors.success,
    overdue: colors.error,
    // Mesmo azul legível do selo "Em análise"; o `info` do tema some no escuro.
    pending_approval: '#93C5FD',
    open: colors.warning,
  };
}

/** A mensalidade tem arquivo anexado (em qualquer provedor, inclusive legado)? */
export function temComprovante(
  payment: Pick<PaymentRow, 'proof_public_id' | 'proof_storage_path' | 'proof_url'>,
): boolean {
  return (
    payment.proof_public_id !== null ||
    payment.proof_storage_path !== null ||
    payment.proof_url !== null
  );
}

/**
 * Situação de uma mensalidade que NÃO está paga: vencida se o vencimento já
 * passou, em aberto se não. Mesmo critério do `mark_overdue_payments`
 * (`due_date < current_date`) — o vencimento do próprio dia ainda é "em aberto".
 */
/**
 * Mensalidades que ainda cobram a pessoa: em aberto ou vencidas. As em análise
 * (comprovante enviado) não entram — o pagamento já foi feito, falta aprovar.
 */
export function contarMensalidadesEmAberto(pagamentos: ReadonlyArray<{ status: PaymentStatus }>): number {
  return pagamentos.filter((pagamento) => pagamento.status === 'open' || pagamento.status === 'overdue').length;
}

export function situacaoSemPagamento(
  dueDate: string,
  hoje: Date = new Date(),
): Extract<PaymentStatus, 'open' | 'overdue'> {
  const [ano, mes, dia] = dueDate.split('-').map(Number);
  const vencimento = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1).getTime();
  return vencimento < inicioDoDia(hoje) ? 'overdue' : 'open';
}

/** Da mais urgente para a menos: é a que colore o mês no seletor. */
const URGENCIA: readonly PaymentStatus[] = ['overdue', 'pending_approval', 'open', 'paid'];

/** A situação mais urgente entre as mensalidades de um mês; `null` sem mensalidades. */
export function situacaoDoMes(situacoes: readonly PaymentStatus[]): PaymentStatus | null {
  return URGENCIA.find((situacao) => situacoes.includes(situacao)) ?? null;
}

/** Um mês do seletor do financeiro geral. */
export interface MesDoFinanceiro {
  referenceMonth: string;
  situacao: PaymentStatus | null;
}

/**
 * Meses com mensalidade, do mais recente para o mais antigo, cada um com a
 * situação mais urgente. `obrigatorios` entram mesmo sem mensalidade — o mês
 * corrente precisa estar no seletor no dia 1º, antes de a cobrança existir.
 */
export function situacoesPorMes(
  linhas: readonly Pick<PaymentRow, 'reference_month' | 'status'>[],
  obrigatorios: readonly string[],
): MesDoFinanceiro[] {
  const porMes = new Map<string, PaymentStatus[]>();
  for (const mes of obrigatorios) {
    porMes.set(mes, []);
  }
  for (const linha of linhas) {
    const lista = porMes.get(linha.reference_month) ?? [];
    lista.push(linha.status);
    porMes.set(linha.reference_month, lista);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([referenceMonth, situacoes]) => ({
      referenceMonth,
      situacao: situacaoDoMes(situacoes),
    }));
}

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

/** "1 dia de atraso" / "N dias de atraso". */
export function rotuloDeAtraso(dias: number): string {
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
