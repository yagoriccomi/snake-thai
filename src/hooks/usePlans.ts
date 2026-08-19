import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import {
  createPlan,
  deactivatePlan,
  fetchPlans,
  updatePlan,
  type PlanInput,
  type PlanRow,
} from '@/services/plans.service';

const log = createLogger('usePlans');

interface UsePlansResult {
  plans: PlanRow[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
  add: (input: PlanInput) => Promise<void>;
  edit: (id: string, input: PlanInput) => Promise<void>;
  deactivate: (id: string) => Promise<void>;
}

/**
 * Carrega e gerencia os planos da academia.
 *
 * @param onlyActive Restringe a lista aos planos disponíveis para contratação.
 */
export function usePlans(onlyActive = false): UsePlansResult {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await fetchPlans(onlyActive));
    } catch (loadError) {
      // Lista vazia mentiria: o usuário concluiria que não há dados, quando na
      // verdade a carga falhou. Sinaliza o erro e deixa a tela oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar. Verifique sua conexão.');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [onlyActive]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (input: PlanInput) => {
      await createPlan(input);
      await load();
    },
    [load],
  );

  const edit = useCallback(
    async (id: string, input: PlanInput) => {
      await updatePlan(id, input);
      await load();
    },
    [load],
  );

  const deactivate = useCallback(
    async (id: string) => {
      await deactivatePlan(id);
      await load();
    },
    [load],
  );

  return { plans, loading, error, reload: load, add, edit, deactivate };
}
