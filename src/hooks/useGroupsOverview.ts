import { useCallback, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchGroupsOverview, type GroupOverview } from '@/services/groups.service';
import { isoDateKey } from '@/utils/datetime';

const log = createLogger('useGroupsOverview');

interface UseGroupsOverviewResult {
  overview: GroupOverview[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Turmas com contagem de alunos e horários vigentes (tela de gestão).
 *
 * Não carrega sozinho: a tela chama `reload` no foco (as contagens mudam ao
 * voltar da grade), e carregar também na montagem dobraria a requisição. [#70]
 */
export function useGroupsOverview(): UseGroupsOverviewResult {
  const [overview, setOverview] = useState<GroupOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchGroupsOverview(isoDateKey(new Date())));
    } catch (loadError) {
      log.error('Falha ao carregar as turmas', loadError);
      setError('Não foi possível carregar as turmas. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { overview, loading, error, reload: load };
}
