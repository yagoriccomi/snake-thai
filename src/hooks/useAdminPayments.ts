import { useCallback, useEffect, useState } from 'react';

import { fetchAllStudents } from '@/services/profile.service';
import {
  fetchPaymentsByStatus,
  type PaymentRow,
} from '@/services/payments.service';

/** Pagamento com o nome do aluno resolvido (para a visão do admin). */
export interface PaymentWithName extends PaymentRow {
  studentName: string;
}

interface UseAdminPaymentsResult {
  pending: PaymentWithName[];
  open: PaymentWithName[];
  overdue: PaymentWithName[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Carrega os pagamentos das três categorias do admin (Aguardando Aprovação,
 * Em Aberto, Vencidos) já com o nome do aluno anexado.
 */
export function useAdminPayments(): UseAdminPaymentsResult {
  const [pending, setPending] = useState<PaymentWithName[]>([]);
  const [open, setOpen] = useState<PaymentWithName[]>([]);
  const [overdue, setOverdue] = useState<PaymentWithName[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [students, pendingRows, openRows, overdueRows] = await Promise.all([
        fetchAllStudents(),
        fetchPaymentsByStatus('pending_approval'),
        fetchPaymentsByStatus('open'),
        fetchPaymentsByStatus('overdue'),
      ]);
      const nameById = new Map(
        students.map((student) => [student.id, student.name ?? 'Aluno pendente']),
      );
      const attach = (rows: PaymentRow[]): PaymentWithName[] =>
        rows.map((row) => ({
          ...row,
          studentName: nameById.get(row.user_id) ?? 'Aluno',
        }));
      setPending(attach(pendingRows));
      setOpen(attach(openRows));
      setOverdue(attach(overdueRows));
    } catch {
      setPending([]);
      setOpen([]);
      setOverdue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { pending, open, overdue, loading, reload: load };
}
