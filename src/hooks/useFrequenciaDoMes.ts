import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchFrequenciaDoMes,
  fetchMonthlyHistory,
  fetchSemanasDoMes,
  type FrequenciaDoMes,
  type MonthlyHistoryRow,
  type SemanaDoMes,
} from '@/services/frequency.service';

const log = createLogger('useFrequenciaDoMes');

interface UseFrequenciaDoMesResult {
  /** O mês escolhido; `null` enquanto carrega ou se falhou. */
  mes: FrequenciaDoMes | null;
  semanas: SemanaDoMes[];
  /** Meses já fechados, do mais recente para o mais antigo (para o seletor). */
  historico: MonthlyHistoryRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * A tela Frequência de um aluno: o mês escolhido (`AAAA-MM-01`), as semanas
 * dele e os meses fechados. Tudo vem do banco (contrato § 11.6); a tela só
 * mostra.
 */
export function useFrequenciaDoMes(userId: string, mesIso: string): UseFrequenciaDoMesResult {
  const [mes, setMes] = useState<FrequenciaDoMes | null>(null);
  const [semanas, setSemanas] = useState<SemanaDoMes[]>([]);
  const [historico, setHistorico] = useState<MonthlyHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meses, doMes, fechados] = await Promise.all([
        fetchFrequenciaDoMes([userId], mesIso),
        fetchSemanasDoMes(userId, mesIso),
        fetchMonthlyHistory(userId),
      ]);
      setMes(meses[0] ?? null);
      setSemanas(doMes);
      setHistorico(fechados);
    } catch (erro) {
      log.error('Falha ao carregar a frequência do mês', erro, { mes: mesIso });
      setError('Não foi possível carregar a frequência.');
      setMes(null);
      setSemanas([]);
    } finally {
      setLoading(false);
    }
  }, [userId, mesIso]);

  useEffect(() => {
    void load();
  }, [load]);

  return { mes, semanas, historico, loading, error, reload: load };
}
