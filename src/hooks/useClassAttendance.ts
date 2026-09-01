import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import {
  fetchAttendanceForClass,
  fetchStudentsForGroup,
} from '@/services/classes.service';
import type { Profile } from '@/types/models';

/** Alunos agrupados pela resposta de presença. */
export interface AttendanceBreakdown {
  present: Profile[];
  absent: Profile[];
  pending: Profile[];
}

const log = createLogger('useClassAttendance');

interface UseClassAttendanceResult extends AttendanceBreakdown {
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

const EMPTY: AttendanceBreakdown = { present: [], absent: [], pending: [] };

/**
 * Monta a frequência de uma aula: cruza os alunos elegíveis (turma ou todos, se
 * evento global) com as presenças registradas, separando em
 * Confirmaram / Faltarão / Pendentes.
 */
export function useClassAttendance(
  classId: string,
  groupId: string | null,
): UseClassAttendanceResult {
  const [breakdown, setBreakdown] = useState<AttendanceBreakdown>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [students, attendance] = await Promise.all([
        fetchStudentsForGroup(groupId),
        fetchAttendanceForClass(classId),
      ]);
      const statusByUser = new Map(attendance.map((row) => [row.user_id, row.status]));
      const present: Profile[] = [];
      const absent: Profile[] = [];
      const pending: Profile[] = [];
      for (const student of students) {
        const status = statusByUser.get(student.id) ?? null;
        if (status === 'present') {
          present.push(student);
        } else if (status === 'absent') {
          absent.push(student);
        } else {
          pending.push(student);
        }
      }
      setBreakdown({ present, absent, pending });
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar a lista de presença.');
      setBreakdown(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [classId, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...breakdown, loading, error, reload: load };
}
