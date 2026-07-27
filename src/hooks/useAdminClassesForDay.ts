import { useCallback, useEffect, useState } from 'react';

import { fetchClassesForDay, type ClassRow } from '@/services/classes.service';
import { dayBoundsIso } from '@/utils/datetime';

interface UseAdminClassesForDayResult {
  items: ClassRow[];
  loading: boolean;
  reload: () => Promise<void>;
}

/** Carrega as aulas de um dia específico (visão do admin). */
export function useAdminClassesForDay(date: Date): UseAdminClassesForDayResult {
  const [items, setItems] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { startIso, endIso } = dayBoundsIso(date);
      setItems(await fetchClassesForDay(startIso, endIso));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, reload: load };
}
