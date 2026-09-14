import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchMissedRollCalls, type MissedRollCall } from '@/services/frequency.service';

const log = createLogger('useMissedRollCalls');

interface UseMissedRollCallsResult {
  items: MissedRollCall[];
  reload: () => Promise<void>;
}

/**
 * Aulas do mês que passaram sem chamada — o aviso para admin e professores.
 *
 * Falha de carga não vira tela de erro: o aviso é um lembrete sobre a agenda,
 * não pode derrubar a agenda. Registra no log e mostra lista vazia.
 *
 * @param enabled `false` para aluno: o banco já não devolveria nada, e assim
 *                nem a requisição acontece.
 */
export function useMissedRollCalls(enabled: boolean): UseMissedRollCallsResult {
  const [items, setItems] = useState<MissedRollCall[]>([]);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    try {
      setItems(await fetchMissedRollCalls());
    } catch (erro) {
      log.error('Falha ao carregar aulas sem chamada', erro);
      setItems([]);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, reload: load };
}
