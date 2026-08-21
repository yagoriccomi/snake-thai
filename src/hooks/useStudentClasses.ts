import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthProvider';
import {
  fetchOwnAttendance,
  fetchUpcomingClassesForStudent,
  upsertAttendance,
  type AttendanceStatus,
  type ClassRow,
} from '@/services/classes.service';

/** Aula com a resposta de presença do próprio aluno anexada. */
export interface StudentClassItem extends ClassRow {
  myStatus: AttendanceStatus | null;
}

interface UseStudentClassesResult {
  items: StudentClassItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  respond: (classId: string, status: AttendanceStatus) => Promise<void>;
}

/**
 * Carrega as próximas aulas do aluno já com o status de presença dele e expõe
 * a ação `respond` (INSERT/UPDATE otimista, revertido em caso de falha).
 */
export function useStudentClasses(): UseStudentClassesResult {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<StudentClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [classes, attendance] = await Promise.all([
        fetchUpcomingClassesForStudent(profile?.group_id ?? null),
        fetchOwnAttendance(userId),
      ]);
      const statusByClass = new Map(attendance.map((row) => [row.class_id, row.status]));
      setItems(
        classes.map((item) => ({
          ...item,
          myStatus: statusByClass.get(item.id) ?? null,
        })),
      );
    } catch {
      setError('Não foi possível carregar as aulas.');
    } finally {
      setLoading(false);
    }
  }, [session, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(
    async (classId: string, status: AttendanceStatus) => {
      const userId = session?.user.id;
      if (userId === undefined) {
        return;
      }
      setError(null);
      // Atualização otimista.
      setItems((previous) =>
        previous.map((item) =>
          item.id === classId ? { ...item, myStatus: status } : item,
        ),
      );
      try {
        await upsertAttendance(classId, userId, status);
      } catch {
        setError('Não foi possível salvar sua resposta.');
        await load();
      }
    },
    [session, load],
  );

  return { items, loading, error, reload: load, respond };
}
