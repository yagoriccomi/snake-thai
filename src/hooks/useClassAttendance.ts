import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchAttendanceForClass,
  fetchStudentsForGroup,
  type AttendanceStatus,
  type StudentRef,
} from '@/services/classes.service';

const log = createLogger('useClassAttendance');

type PorAluno = Readonly<Record<string, AttendanceStatus>>;

interface UseClassAttendanceResult {
  /** Alunos elegíveis à aula, em ordem alfabética. */
  students: StudentRef[];
  /** A CHAMADA gravada (presença oficial), por id do aluno. */
  officialByStudent: PorAluno;
  /**
   * O que cada aluno DECLAROU no app ("vou" / "não vou"), por id. Referência
   * para quem faz a chamada — não conta como presença nem como falta.
   */
  declaredByStudent: PorAluno;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
}

const SEM_ALUNOS: StudentRef[] = [];
const VAZIO: PorAluno = {};

/**
 * Dados da chamada de uma aula: os alunos elegíveis (turma, ou todos se evento
 * global), a chamada gravada e as declarações.
 *
 * Só LÊ. Gravar é da tela, de uma vez, em "Concluir chamada" — quando cada
 * toque gravava e recarregava, a lista era remontada e voltava ao topo.
 */
export function useClassAttendance(
  classId: string,
  groupId: string | null,
): UseClassAttendanceResult {
  const [students, setStudents] = useState<StudentRef[]>(SEM_ALUNOS);
  const [officialByStudent, setOfficialByStudent] = useState<PorAluno>(VAZIO);
  const [declaredByStudent, setDeclaredByStudent] = useState<PorAluno>(VAZIO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alunos, presencas] = await Promise.all([
        fetchStudentsForGroup(groupId),
        fetchAttendanceForClass(classId),
      ]);
      const oficial: Record<string, AttendanceStatus> = {};
      const declarado: Record<string, AttendanceStatus> = {};
      for (const linha of presencas) {
        if (linha.status !== null) {
          oficial[linha.user_id] = linha.status;
        }
        if (linha.declared_status !== null) {
          declarado[linha.user_id] = linha.declared_status;
        }
      }
      setStudents(alunos);
      setOfficialByStudent(oficial);
      setDeclaredByStudent(declarado);
    } catch (erro) {
      // Devolver vazio faria o usuário concluir que não há alunos, quando na
      // verdade a carga falhou. Sinaliza para a tela poder oferecer retry.
      log.error('Falha ao carregar dados', erro);
      setError('Não foi possível carregar a lista de presença.');
    } finally {
      setLoading(false);
    }
  }, [classId, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { students, officialByStudent, declaredByStudent, loading, error, reload: load };
}
