import { useCallback, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchSchedulesForGroup, type ScheduleWithTeachers } from '@/services/schedules.service';

const log = createLogger('useGroupSchedules');

interface UseGroupSchedulesResult {
  schedules: ScheduleWithTeachers[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Horários da grade semanal de uma turma, com os professores.
 *
 * Não carrega sozinho: a tela chama `reload` no foco (volta do formulário de
 * horário), e carregar também na montagem dobraria a requisição. [#70]
 */
export function useGroupSchedules(groupId: string): UseGroupSchedulesResult {
  const [schedules, setSchedules] = useState<ScheduleWithTeachers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await fetchSchedulesForGroup(groupId));
    } catch (loadError) {
      // Lista vazia mentiria ("turma sem horários"): sinaliza o erro.
      log.error('Falha ao carregar a grade', loadError);
      setError('Não foi possível carregar a grade. Verifique sua conexão.');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  return { schedules, loading, error, reload: load };
}
