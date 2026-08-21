import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthProvider';
import {
  fetchStudentPayments,
  type PaymentRow,
  type StudentPaymentsMode,
} from '@/services/payments.service';

interface UseMyPaymentsResult {
  items: PaymentRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Carrega os pagamentos do aluno conforme o modo (ativos ou histórico). */
export function useMyPayments(mode: StudentPaymentsMode): UseMyPaymentsResult {
  const { session } = useAuth();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchStudentPayments(userId, mode));
    } catch {
      setError('Não foi possível carregar as mensalidades.');
    } finally {
      setLoading(false);
    }
  }, [session, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}
