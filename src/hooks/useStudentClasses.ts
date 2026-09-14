import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthProvider';
import {
  declareAttendance,
  fetchOwnAttendance,
  fetchTeachersForClasses,
  fetchUpcomingClassesForStudent,
  type AttendanceStatus,
  type ClassRow,
  type ClassTeacherRef,
} from '@/services/classes.service';
import {
  fetchOwnJustifications,
  type JustificationRow,
} from '@/services/justifications.service';

/** Aula com a declaração do próprio aluno e seus professores anexados. */
export interface StudentClassItem extends ClassRow {
  /**
   * O que o aluno DECLAROU ("vou" / "não vou"). Apenas sugestivo: a presença
   * oficial vem da chamada do professor (docs/FREQUENCIA.md).
   */
  myStatus: AttendanceStatus | null;
  /** Justificativa de falta enviada para esta aula, se houver. */
  justification: JustificationRow | null;
  teachers: ClassTeacherRef[];
}

interface UseStudentClassesResult {
  items: StudentClassItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** @returns `true` se a declaração foi gravada. */
  respond: (classId: string, status: AttendanceStatus) => Promise<boolean>;
}

/**
 * Carrega as próximas aulas do aluno já com a declaração dele e expõe a ação
 * `respond` (INSERT/UPDATE otimista da declaração, revertido em caso de falha).
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
      const [classes, attendance, justifications] = await Promise.all([
        fetchUpcomingClassesForStudent(profile?.group_id ?? null),
        fetchOwnAttendance(userId),
        fetchOwnJustifications(userId),
      ]);
      const teachersByClass = await fetchTeachersForClasses(classes.map((item) => item.id));
      // Lê a DECLARAÇÃO, não a chamada: o card mostra o que o aluno escolheu.
      const declaredByClass = new Map(
        attendance.map((row) => [row.class_id, row.declared_status]),
      );
      const justificationByClass = new Map(justifications.map((row) => [row.class_id, row]));
      setItems(
        classes.map((item) => ({
          ...item,
          myStatus: declaredByClass.get(item.id) ?? null,
          justification: justificationByClass.get(item.id) ?? null,
          teachers: teachersByClass[item.id] ?? [],
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
    async (classId: string, status: AttendanceStatus): Promise<boolean> => {
      const userId = session?.user.id;
      if (userId === undefined) {
        return false;
      }
      setError(null);
      // Atualização otimista.
      setItems((previous) =>
        previous.map((item) =>
          item.id === classId ? { ...item, myStatus: status } : item,
        ),
      );
      try {
        await declareAttendance(classId, userId, status);
        return true;
      } catch {
        setError('Não foi possível salvar sua resposta.');
        await load();
        return false;
      }
    },
    [session, load],
  );

  return { items, loading, error, reload: load, respond };
}
