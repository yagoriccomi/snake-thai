import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchFrequenciaDoMes,
  fetchFrequenciaSemanal,
  type FrequenciaDaSemana,
  type FrequenciaDoMes,
} from '@/services/frequency.service';
import { isoDateKey } from '@/utils/datetime';

const log = createLogger('useFrequenciaDoAluno');

interface UseFrequenciaDoAlunoResult {
  /** A semana em curso; `null` enquanto carrega ou se falhou. */
  semana: FrequenciaDaSemana | null;
  /** O mês em curso; `null` enquanto carrega ou se falhou. */
  mes: FrequenciaDoMes | null;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * A semana e o mês em curso de um aluno, para o cartão da tela Aulas
 * (contrato § 3: "Semana · {p}%" e "Mês · {p}%"). As duas leituras saem
 * juntas: o cartão só faz sentido com as duas.
 */
export function useFrequenciaDoAluno(userId: string | null): UseFrequenciaDoAlunoResult {
  const [semana, setSemana] = useState<FrequenciaDaSemana | null>(null);
  const [mes, setMes] = useState<FrequenciaDoMes | null>(null);
  const [loading, setLoading] = useState(userId !== null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (userId === null) {
      setLoading(false);
      return;
    }
    const hoje = isoDateKey(new Date());
    setLoading(true);
    setError(null);
    try {
      const [semanas, meses] = await Promise.all([
        fetchFrequenciaSemanal([userId], hoje, hoje),
        fetchFrequenciaDoMes([userId], hoje),
      ]);
      setSemana(semanas[0] ?? null);
      setMes(meses[0] ?? null);
    } catch (erro) {
      log.error('Falha ao carregar a frequência do aluno', erro);
      setError('Não foi possível carregar a frequência.');
      setSemana(null);
      setMes(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { semana, mes, loading, error, reload: load };
}
