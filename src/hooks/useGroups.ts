import { useCallback, useEffect, useState } from 'react';

import { createGroup, fetchGroups, type GroupRow } from '@/services/groups.service';

interface UseGroupsResult {
  groups: GroupRow[];
  loading: boolean;
  reload: () => Promise<void>;
  addGroup: (name: string) => Promise<GroupRow>;
}

/** Carrega e gerencia as turmas (fonte do seletor de group_id). */
export function useGroups(): UseGroupsResult {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await fetchGroups());
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addGroup = useCallback(async (name: string): Promise<GroupRow> => {
    const created = await createGroup(name);
    setGroups((previous) =>
      [...previous, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return created;
  }, []);

  return { groups, loading, reload: load, addGroup };
}
