import { useCallback, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchAlunosEmRisco,
  fetchFaturamentoMensal,
  fetchInadimplenciaFaixas,
  fetchPainelResumo,
  fetchSaudeDasRotinas,
  type AlunoEmRisco,
  type FaixaDeInadimplencia,
  type MesDeFaturamento,
  type PainelResumo,
  type SaudeDaRotina,
} from '@/services/painel.service';

const log = createLogger('useAdminDashboard');

/** Tudo o que a tela do Painel mostra, carregado junto. */
export interface DadosDoPainel {
  resumo: PainelResumo;
  faixas: FaixaDeInadimplencia[];
  faturamento: MesDeFaturamento[];
  emRisco: AlunoEmRisco[];
  /** `null` quando não deu para ler (não derruba o resto do Painel). */
  rotinas: SaudeDaRotina[] | null;
}

interface UseAdminDashboardResult {
  /** `null` até a primeira carga dar certo. */
  dados: DadosDoPainel | null;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Números do Painel do admin: 4 funções do banco em paralelo.
 *
 * Não carrega sozinho — a tela chama `reload` no foco (os números mudam ao
 * dar baixa em outra aba), e carregar também na montagem dobraria as
 * requisições. Durante uma recarga os dados anteriores continuam na tela. [#70]
 */
export function useAdminDashboard(): UseAdminDashboardResult {
  const [dados, setDados] = useState<DadosDoPainel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumo, faixas, faturamento, emRisco, rotinas] = await Promise.all([
        fetchPainelResumo(),
        fetchInadimplenciaFaixas(),
        fetchFaturamentoMensal(),
        fetchAlunosEmRisco(),
        // Secundário: sem ele o Painel segue (ex.: banco ainda sem a função).
        fetchSaudeDasRotinas().catch((falha: unknown) => {
          log.warn('Saúde das rotinas indisponível', falha);
          return null;
        }),
      ]);
      setDados({ resumo, faixas, faturamento, emRisco, rotinas });
    } catch (falha) {
      // Só o erro: as listas trazem nomes, e o log não mascara nome.
      log.error('Falha ao carregar o painel', falha);
      setError('Não foi possível carregar o painel. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { dados, loading, error, reload };
}
