import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchRollCallState,
  saveRollCall,
  type RollCallState,
  type RollCallSubmission,
} from '@/services/frequency.service';
import {
  fetchJustificationsForClass,
  reviewJustification,
  type JustificationRow,
  type JustificationStatus,
} from '@/services/justifications.service';

const log = createLogger('useRollCallReview');

interface UseRollCallReviewResult {
  /** `null` enquanto carrega ou se a carga falhou. */
  state: RollCallState | null;
  /** Justificativa de cada aluno nesta aula, por id do aluno. */
  justificationsByUser: Readonly<Record<string, JustificationRow>>;
  error: string | null;
  reload: () => Promise<void>;
  /** Grava e conclui a chamada. Lança se o banco recusar — a tela decide o que dizer. */
  save: (chamada: RollCallSubmission) => Promise<void>;
  /** Aprova ou recusa. Lança se o banco recusar. */
  review: (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => Promise<void>;
}

const SEM_JUSTIFICATIVAS: Readonly<Record<string, JustificationRow>> = {};

/**
 * A parte da chamada que é da FREQUÊNCIA: se a aula já pode ser concluída, se
 * já foi, e as justificativas de falta a revisar. A lista de alunos continua
 * em `useClassAttendance` — são dados de origens diferentes, com falhas
 * independentes.
 */
export function useRollCallReview(classId: string): UseRollCallReviewResult {
  const [state, setState] = useState<RollCallState | null>(null);
  const [justificationsByUser, setJustificationsByUser] =
    useState<Readonly<Record<string, JustificationRow>>>(SEM_JUSTIFICATIVAS);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [estado, justificativas] = await Promise.all([
        fetchRollCallState(classId),
        fetchJustificationsForClass(classId),
      ]);
      const porAluno: Record<string, JustificationRow> = {};
      for (const justificativa of justificativas) {
        porAluno[justificativa.user_id] = justificativa;
      }
      setState(estado);
      setJustificationsByUser(porAluno);
    } catch (erro) {
      log.error('Falha ao carregar o estado da chamada', erro, { classId });
      setError('Não foi possível carregar o estado da chamada.');
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (chamada: RollCallSubmission) => {
      await saveRollCall(classId, chamada);
      await load();
    },
    [classId, load],
  );

  const review = useCallback(
    async (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => {
      await reviewJustification(justificationId, status);
      await load();
    },
    [load],
  );

  return { state, justificationsByUser, error, reload: load, save, review };
}
