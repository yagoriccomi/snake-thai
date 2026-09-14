import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';

import {
  clearRollCall,
  fetchAttendanceForClass,
  fetchStudentsForGroup,
  recordRollCall,
  type AttendanceStatus,
  type StudentRef,
} from '@/services/classes.service';

/** Alunos agrupados pela CHAMADA do professor (a presença oficial). */
export interface AttendanceBreakdown {
  present: StudentRef[];
  absent: StudentRef[];
  /** Ainda sem registro na chamada. */
  pending: StudentRef[];
}

const log = createLogger('useClassAttendance');

interface UseClassAttendanceResult extends AttendanceBreakdown {
  /**
   * O que cada aluno DECLAROU no app ("vou" / "não vou"), por id. Referência
   * para quem faz a chamada — não conta como presença nem como falta.
   */
  declaredByStudent: Readonly<Record<string, AttendanceStatus>>;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
  /**
   * Registra a chamada de um aluno — ação de quem GERENCIA a aula (professor
   * dela ou admin; a RLS e o gatilho do banco decidem quem realmente pode).
   */
  setStudentStatus: (userId: string, status: AttendanceStatus) => Promise<void>;
  /** Desfaz o registro da chamada, preservando a declaração do aluno. */
  clearStudentStatus: (userId: string) => Promise<void>;
}

const EMPTY: AttendanceBreakdown = { present: [], absent: [], pending: [] };
const SEM_DECLARACOES: Readonly<Record<string, AttendanceStatus>> = {};

/**
 * Monta a chamada de uma aula: cruza os alunos elegíveis (turma, ou todos se
 * evento global) com os registros de presença, separando pela CHAMADA do
 * professor. A declaração do aluno segue à parte, só como referência — regra
 * em docs/FREQUENCIA.md.
 */
export function useClassAttendance(
  classId: string,
  groupId: string | null,
): UseClassAttendanceResult {
  const [breakdown, setBreakdown] = useState<AttendanceBreakdown>(EMPTY);
  const [declaredByStudent, setDeclaredByStudent] =
    useState<Readonly<Record<string, AttendanceStatus>>>(SEM_DECLARACOES);
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
      const officialByUser = new Map(attendance.map((row) => [row.user_id, row.status]));
      const declared: Record<string, AttendanceStatus> = {};
      for (const row of attendance) {
        if (row.declared_status !== null) {
          declared[row.user_id] = row.declared_status;
        }
      }

      const present: StudentRef[] = [];
      const absent: StudentRef[] = [];
      const pending: StudentRef[] = [];
      for (const student of students) {
        const official = officialByUser.get(student.id) ?? null;
        if (official === 'present') {
          present.push(student);
        } else if (official === 'absent') {
          absent.push(student);
        } else {
          pending.push(student);
        }
      }
      setBreakdown({ present, absent, pending });
      setDeclaredByStudent(declared);
    } catch (loadError) {
      // Devolver vazio faria o usuário concluir que não há dados, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar a lista de presença.');
      setBreakdown(EMPTY);
      setDeclaredByStudent(SEM_DECLARACOES);
    } finally {
      setLoading(false);
    }
  }, [classId, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStudentStatus = useCallback(
    async (userId: string, status: AttendanceStatus) => {
      await recordRollCall(classId, userId, status);
      await load();
    },
    [classId, load],
  );

  const clearStudentStatus = useCallback(
    async (userId: string) => {
      await clearRollCall(classId, userId);
      await load();
    },
    [classId, load],
  );

  return {
    ...breakdown,
    declaredByStudent,
    loading,
    error,
    reload: load,
    setStudentStatus,
    clearStudentStatus,
  };
}
