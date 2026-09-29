import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchChamadasPendentes, type ChamadaPendente } from '@/services/chamada.service';

const log = createLogger('useChamadasPendentes');

interface UseChamadasPendentesResult {
  items: ChamadaPendente[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * As chamadas pendentes (T13): rotinas passadas, sem chamada e não canceladas,
 * de qualquer mês. `somenteMinhas = false` só muda algo para o admin.
 *
 * @param enabled `false` para aluno: nem a requisição acontece.
 */
export function useChamadasPendentes(somenteMinhas: boolean, enabled = true): UseChamadasPendentesResult {
  const [items, setItems] = useState<ChamadaPendente[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchChamadasPendentes(somenteMinhas));
    } catch (erro) {
      log.error('Falha ao carregar as chamadas pendentes', erro);
      setError('Não foi possível carregar as chamadas pendentes.');
    } finally {
      setLoading(false);
    }
  }, [enabled, somenteMinhas]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}
