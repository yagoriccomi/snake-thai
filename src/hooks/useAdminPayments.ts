import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import { fetchAllStudents } from '@/services/profile.service';
import {
  fetchPaymentsByStatus,
  type PaymentRow,
} from '@/services/payments.service';

/** Pagamento com o nome do aluno resolvido (para a visão do admin). */
export interface PaymentWithName extends PaymentRow {
  studentName: string;
}

const log = createLogger('useAdminPayments');

interface UseAdminPaymentsResult {
  pending: PaymentWithName[];
  open: PaymentWithName[];
  overdue: PaymentWithName[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar os pagamentos.');
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

  return { pending, open, overdue, loading, error, reload: load };
}
