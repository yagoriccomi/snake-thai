import { useCallback, useEffect, useState } from 'react';

import {
  createPlan,
  deactivatePlan,
  fetchPlans,
  updatePlan,
  type PlanInput,
  type PlanRow,
} from '@/services/plans.service';

interface UsePlansResult {
  plans: PlanRow[];
  loading: boolean;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await fetchPlans(onlyActive));
    } catch {
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

  return { plans, loading, reload: load, add, edit, deactivate };
}
