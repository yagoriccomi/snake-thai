import { useCallback, useMemo, useState } from 'react';

import type { FaixaDeAtraso } from '@/constants/painel';
import { createLogger } from '@/lib/logger';
import { fetchRelatorioInadimplencia, type Devedor } from '@/services/painel.service';
import { faixaDoAtraso } from '@/utils/painel';

const log = createLogger('useDelinquencyReport');

/** Filtro do relatório: todas as faixas ou uma. */
export type FiltroDeFaixa = FaixaDeAtraso | 'todas';

interface UseDelinquencyReportResult {
  /** Devedores da faixa escolhida, do maior atraso para o menor. */
  linhas: Devedor[];
  /** Soma devida das linhas filtradas. */
  totalCents: number;
  /** Quantos devedores existem sem filtro. */
  totalDeDevedores: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Relatório de inadimplência por aluno. O filtro de faixa é aplicado em
 * memória (uma consulta só), pelo MAIOR atraso de cada aluno — a mesma regra
 * do Painel.
 *
 * Não carrega sozinho: a tela chama `reload` no foco (voltar do histórico
 * depois de dar baixa precisa atualizar a lista).
 */
export function useDelinquencyReport(filtro: FiltroDeFaixa): UseDelinquencyReportResult {
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevedores(await fetchRelatorioInadimplencia());
    } catch (falha) {
      // Só o erro: as linhas trazem nomes, e o log não mascara nome.
      log.error('Falha ao carregar o relatório de inadimplência', falha);
      setError('Não foi possível carregar o relatório. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  const linhas = useMemo(
    () => (filtro === 'todas' ? devedores : devedores.filter((d) => faixaDoAtraso(d.maiorAtrasoDias) === filtro)),
    [devedores, filtro],
  );

  const totalCents = useMemo(() => linhas.reduce((soma, d) => soma + d.totalDevidoCents, 0), [linhas]);

  return { linhas, totalCents, totalDeDevedores: devedores.length, loading, error, reload };
}
