import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  fetchEstadoDaChamada,
  fetchListaDaChamada,
  fetchProfessoresDaChamada,
  salvarChamada,
  type AlunoDaChamada,
  type EnvioDaChamada,
  type EstadoDaChamada,
  type ProfessorDaChamada,
  type ResultadoDaChamada,
} from '@/services/chamada.service';

const log = createLogger('useChamada');

interface UseChamadaResult {
  estado: EstadoDaChamada | null;
  alunos: AlunoDaChamada[];
  /** Vazio para quem não é da equipe da aula (o banco não mostra). */
  professores: ProfessorDaChamada[];
  loading: boolean;
  /** Mensagem amigável quando a carga falhou. */
  error: string | null;
  reload: () => Promise<void>;
  /** Salva e recarrega. Lança a recusa do banco: a tela decide o que dizer. */
  salvar: (envio: EnvioDaChamada) => Promise<ResultadoDaChamada>;
}

const SEM_ALUNOS: AlunoDaChamada[] = [];
const SEM_PROFESSORES: ProfessorDaChamada[] = [];

/**
 * A chamada de uma aula (contrato § 7.2): o estado da aula, quem está nela e
 * os professores. `podeVerProfessores` evita pedir ao banco o que ele vai
 * recusar (professor que só está olhando a aula de outro).
 */
export function useChamada(classId: string, podeVerProfessores: boolean): UseChamadaResult {
  const [estado, setEstado] = useState<EstadoDaChamada | null>(null);
  const [alunos, setAlunos] = useState<AlunoDaChamada[]>(SEM_ALUNOS);
  const [professores, setProfessores] = useState<ProfessorDaChamada[]>(SEM_PROFESSORES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aula, lista, equipe] = await Promise.all([
        fetchEstadoDaChamada(classId),
        fetchListaDaChamada(classId),
        podeVerProfessores ? fetchProfessoresDaChamada(classId) : Promise.resolve(SEM_PROFESSORES),
      ]);
      setEstado(aula);
      setAlunos(lista);
      setProfessores(equipe);
    } catch (erro) {
      // Lista vazia faria parecer que ninguém veio; a tela oferece "Tentar de novo".
      log.error('Falha ao carregar a chamada', erro, { classId });
      setError('Não foi possível carregar a chamada.');
    } finally {
      setLoading(false);
    }
  }, [classId, podeVerProfessores]);

  useEffect(() => {
    void load();
  }, [load]);

  const salvar = useCallback(
    async (envio: EnvioDaChamada) => {
      const resultado = await salvarChamada(classId, envio);
      await load();
      return resultado;
    },
    [classId, load],
  );

  return { estado, alunos, professores, loading, error, reload: load, salvar };
}
