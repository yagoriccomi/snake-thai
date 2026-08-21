import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import { fetchAllStudents } from '@/services/profile.service';
import { fetchPlans } from '@/services/plans.service';
import {
  fetchPaymentsByStatus,
  fetchReceivedThisMonthCents,
  type PaymentRow,
} from '@/services/payments.service';

/** Pagamento com o nome do aluno e do plano resolvidos (visão do admin). */
export interface PaymentWithName extends PaymentRow {
  studentName: string;
  /** Nome do plano contratado, quando conhecido. */
  planName: string | null;
}

/** Totais do mês exibidos no resumo do painel. */
export interface FinanceTotals {
  receivedCents: number;
  openCents: number;
  openCount: number;
  overdueCents: number;
  overdueCount: number;
}

const log = createLogger('useAdminPayments');

interface UseAdminPaymentsResult {
  pending: PaymentWithName[];
  open: PaymentWithName[];
  overdue: PaymentWithName[];
  totals: FinanceTotals;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY_TOTALS: FinanceTotals = {
  receivedCents: 0,
  openCents: 0,
  openCount: 0,
  overdueCents: 0,
  overdueCount: 0,
};

/** Soma os valores (em centavos) de uma lista de pagamentos. */
function sumCents(rows: PaymentRow[]): number {
  return rows.reduce((total, row) => total + (row.amount_cents ?? 0), 0);
}

/**
 * Carrega os pagamentos das três categorias do admin (Aguardando Aprovação,
 * Em Aberto, Vencidos) com nome do aluno e do plano, além dos totais do mês.
 */
export function useAdminPayments(): UseAdminPaymentsResult {
  const [pending, setPending] = useState<PaymentWithName[]>([]);
  const [open, setOpen] = useState<PaymentWithName[]>([]);
  const [overdue, setOverdue] = useState<PaymentWithName[]>([]);
  const [totals, setTotals] = useState<FinanceTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [students, plans, receivedCents, pendingRows, openRows, overdueRows] =
        await Promise.all([
          fetchAllStudents(),
          fetchPlans(),
          fetchReceivedThisMonthCents(),
          fetchPaymentsByStatus('pending_approval'),
          fetchPaymentsByStatus('open'),
          fetchPaymentsByStatus('overdue'),
        ]);

      const nameById = new Map(
        students.map((student) => [student.id, student.name ?? 'Aluno pendente']),
      );
      const planById = new Map(plans.map((plan) => [plan.id, plan.name]));
      const attach = (rows: PaymentRow[]): PaymentWithName[] =>
        rows.map((row) => ({
          ...row,
          studentName: nameById.get(row.user_id) ?? 'Aluno',
          planName: row.plan_id !== null ? planById.get(row.plan_id) ?? null : null,
        }));

      setPending(attach(pendingRows));
      setOpen(attach(openRows));
      setOverdue(attach(overdueRows));
      setTotals({
        receivedCents,
        openCents: sumCents(openRows),
        openCount: openRows.length,
        overdueCents: sumCents(overdueRows),
        overdueCount: overdueRows.length,
      });
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar os pagamentos.');
      setPending([]);
      setOpen([]);
      setOverdue([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { pending, open, overdue, totals, loading, error, reload: load };
}
