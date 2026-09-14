import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchPlans } from '@/services/plans.service';
import {
  fetchPaymentMonthsOverview,
  fetchPaymentsForMonth,
  type PaymentRow,
} from '@/services/payments.service';
import { fetchAllStudents } from '@/services/profile.service';
import { currentMonthIso } from '@/utils/datetime';
import { situacoesPorMes, type MesDoFinanceiro } from '@/utils/payments';

/** Pagamento com o nome do aluno e do plano resolvidos (visão do admin). */
export interface PaymentWithName extends PaymentRow {
  studentName: string;
  /** Nome do plano contratado, quando conhecido. */
  planName: string | null;
}

/** Totais da competência exibidos no resumo do painel. */
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
  paid: PaymentWithName[];
  totals: FinanceTotals;
  /** Meses do seletor, do mais recente para o mais antigo. */
  months: MesDoFinanceiro[];
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
function sumCents(rows: readonly PaymentRow[]): number {
  return rows.reduce((total, row) => total + (row.amount_cents ?? 0), 0);
}

/**
 * Financeiro geral do admin para UMA competência (`AAAA-MM-01`): as
 * mensalidades do mês separadas por situação, os totais e a lista de meses
 * para o seletor.
 *
 * Antes a tela listava pendências de todos os meses misturadas e somava o
 * "recebido" pela data do pagamento; não havia como averiguar um mês passado.
 * Agora tudo é por competência — o mês a que a mensalidade se refere.
 */
export function useAdminPayments(referenceMonth: string): UseAdminPaymentsResult {
  const [pending, setPending] = useState<PaymentWithName[]>([]);
  const [open, setOpen] = useState<PaymentWithName[]>([]);
  const [overdue, setOverdue] = useState<PaymentWithName[]>([]);
  const [paid, setPaid] = useState<PaymentWithName[]>([]);
  const [totals, setTotals] = useState<FinanceTotals>(EMPTY_TOTALS);
  const [months, setMonths] = useState<MesDoFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [students, plans, doMes, visaoGeral] = await Promise.all([
        fetchAllStudents(),
        fetchPlans(),
        fetchPaymentsForMonth(referenceMonth),
        fetchPaymentMonthsOverview(),
      ]);

      const nameById = new Map(
        students.map((student) => [student.id, student.name ?? 'Aluno pendente']),
      );
      const planById = new Map(plans.map((plan) => [plan.id, plan.name]));
      const comNome: PaymentWithName[] = doMes.map((row) => ({
        ...row,
        studentName: nameById.get(row.user_id) ?? 'Aluno',
        planName: row.plan_id !== null ? planById.get(row.plan_id) ?? null : null,
      }));

      const pagas = comNome.filter((row) => row.status === 'paid');
      const abertas = comNome.filter((row) => row.status === 'open');
      const vencidas = comNome.filter((row) => row.status === 'overdue');

      setPending(comNome.filter((row) => row.status === 'pending_approval'));
      setOpen(abertas);
      setOverdue(vencidas);
      setPaid(pagas);
      setTotals({
        receivedCents: sumCents(pagas),
        openCents: sumCents(abertas),
        openCount: abertas.length,
        overdueCents: sumCents(vencidas),
        overdueCount: vencidas.length,
      });
      setMonths(situacoesPorMes(visaoGeral, [currentMonthIso(), referenceMonth]));
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar os pagamentos.');
      setPending([]);
      setOpen([]);
      setOverdue([]);
      setPaid([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [referenceMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  return { pending, open, overdue, paid, totals, months, loading, error, reload: load };
}
