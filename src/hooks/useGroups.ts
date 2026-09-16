import { useCallback, useEffect, useMemo, useState } from 'react';

import { createLogger } from '@/lib/logger';

import { createGroup, fetchGroups, type GroupRow } from '@/services/groups.service';

const log = createLogger('useGroups');

interface UseGroupsResult {
  /** Todas as turmas, inclusive as arquivadas (rótulos de aulas antigas). */
  groups: GroupRow[];
  /** Só as turmas ativas: as únicas que recebem aluno e aula. */
  activeGroups: GroupRow[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
  addGroup: (name: string) => Promise<GroupRow>;
}

/** Carrega e gerencia as turmas (fonte do seletor de group_id). */
export function useGroups(): UseGroupsResult {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await fetchGroups());
    } catch (loadError) {
      // Lista vazia mentiria: o usuário concluiria que não há dados, quando na
      // verdade a carga falhou. Sinaliza o erro e deixa a tela oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar. Verifique sua conexão.');
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

  const activeGroups = useMemo(() => groups.filter((group) => group.archived_at === null), [groups]);

  return { groups, activeGroups, loading, error, reload: load, addGroup };
}
