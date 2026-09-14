import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchMonthlyFrequency, type MonthlyFrequency } from '@/services/frequency.service';

const log = createLogger('useMonthlyFrequency');

interface UseMonthlyFrequencyResult {
  /** Frequência do mês corrente, por id de aluno. */
  byUser: Readonly<Record<string, MonthlyFrequency>>;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

const VAZIO: Readonly<Record<string, MonthlyFrequency>> = {};

/**
 * Frequência do mês corrente de um conjunto de alunos, numa chamada só.
 *
 * A dependência é a lista de ids serializada, e não o array: um array novo a
 * cada render dispararia a consulta em loop, mesmo com os mesmos alunos.
 */
export function useMonthlyFrequency(userIds: readonly string[]): UseMonthlyFrequencyResult {
  const chave = userIds.join(',');
  const [byUser, setByUser] = useState<Readonly<Record<string, MonthlyFrequency>>>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids = chave === '' ? [] : chave.split(',');
    setLoading(true);
    setError(null);
    try {
      const lista = await fetchMonthlyFrequency(ids);
      const mapa: Record<string, MonthlyFrequency> = {};
      for (const item of lista) {
        mapa[item.userId] = item;
      }
      setByUser(mapa);
    } catch (erro) {
      log.error('Falha ao carregar a frequência', erro);
      setError('Não foi possível carregar a frequência.');
      setByUser(VAZIO);
    } finally {
      setLoading(false);
    }
  }, [chave]);

  useEffect(() => {
    void load();
  }, [load]);

  return { byUser, loading, error, reload: load };
}
