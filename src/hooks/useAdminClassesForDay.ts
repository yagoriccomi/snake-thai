import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import { fetchClassesForDay, type ClassRow } from '@/services/classes.service';
import { dayBoundsIso } from '@/utils/datetime';

const log = createLogger('useAdminClassesForDay');

interface UseAdminClassesForDayResult {
  items: ClassRow[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/** Carrega as aulas de um dia específico (visão do admin). */
export function useAdminClassesForDay(date: Date): UseAdminClassesForDayResult {
  const [items, setItems] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startIso, endIso } = dayBoundsIso(date);
      setItems(await fetchClassesForDay(startIso, endIso));
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar as aulas do dia.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, reload: load };
}
