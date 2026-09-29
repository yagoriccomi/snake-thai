import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchJustificativasParaRevisar,
  fetchMinhasJustificativas,
  type JustificativaParaRevisar,
  type MinhaJustificativa,
} from '@/services/justifications.service';

const log = createLogger('useJustificativas');

interface ListaResult<T> {
  items: T[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou. */
  error: string | null;
  reload: () => Promise<void>;
}

/** Carga, erro e recarga das duas listas: a regra de quem vê o quê é do banco (§ 9.1). */
function useLista<T>(buscar: () => Promise<T[]>, falha: string, enabled: boolean): ListaResult<T> {
  const [items, setItems] = useState<T[]>([]);
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
      setItems(await buscar());
    } catch (erro) {
      log.error(falha, erro);
      setError(falha);
    } finally {
      setLoading(false);
    }
  }, [buscar, falha, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}

/** As justificativas do aluno, da mais nova à mais antiga. */
export function useMinhasJustificativas(): ListaResult<MinhaJustificativa> {
  return useLista(fetchMinhasJustificativas, 'Não foi possível carregar as suas justificativas.', true);
}

/**
 * As pendentes que quem chama pode decidir (T18, D14).
 *
 * @param enabled `false` para aluno: nem a requisição acontece.
 */
export function useJustificativasParaRevisar(enabled = true): ListaResult<JustificativaParaRevisar> {
  return useLista(fetchJustificativasParaRevisar, 'Não foi possível carregar as justificativas para revisar.', enabled);
}
