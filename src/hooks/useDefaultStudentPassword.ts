import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchDefaultStudentPassword } from '@/services/settings.service';

const log = createLogger('useDefaultStudentPassword');

interface UseDefaultStudentPasswordResult {
  /** A senha de primeiro acesso; `null` enquanto carrega ou se falhar. */
  password: string | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Senha de primeiro acesso de alunos e equipe — só para telas do admin (o
 * banco recusa os demais). Nunca há valor de reserva: mostrar um literal
 * diferente do configurado faria o admin passar a senha errada no balcão.
 */
export function useDefaultStudentPassword(): UseDefaultStudentPasswordResult {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPassword(await fetchDefaultStudentPassword());
    } catch (falha) {
      // Só o erro: a senha nunca vai para o log.
      log.error('Falha ao carregar a senha de primeiro acesso', falha);
      setError('Não foi possível carregar a senha de primeiro acesso.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { password, loading, error, reload };
}
