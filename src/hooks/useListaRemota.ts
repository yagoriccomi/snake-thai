import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

const log = createLogger('useListaRemota');

export interface ListaRemota<T> {
  items: T[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Carga, erro e recarga de uma lista que vem do banco. A regra de quem vê o
 * quê fica no banco; aqui só o estado da tela.
 *
 * @param buscar  estável (função de módulo ou `useCallback`).
 * @param falha   a frase para a pessoa quando a carga falha.
 * @param enabled `false` para quem não pode ver: nem a requisição acontece.
 */
export function useListaRemota<T>(buscar: () => Promise<T[]>, falha: string, enabled = true): ListaRemota<T> {
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
