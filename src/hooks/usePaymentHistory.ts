import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchPaymentHistory, type PaymentRow } from '@/services/payments.service';

const log = createLogger('usePaymentHistory');

interface UsePaymentHistoryResult {
  /** Da competência mais recente para a mais antiga. */
  payments: PaymentRow[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Histórico de mensalidades de um aluno.
 *
 * Falha de carga vira erro visível, não lista vazia: "este aluno não tem
 * cobranças" é uma afirmação que o admin usaria para cobrar ou não cobrar.
 */
export function usePaymentHistory(userId: string): UsePaymentHistoryResult {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(await fetchPaymentHistory(userId));
    } catch (erro) {
      log.error('Falha ao carregar o histórico de pagamentos', erro);
      setError('Não foi possível carregar o histórico de pagamentos.');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { payments, loading, error, reload: load };
}
