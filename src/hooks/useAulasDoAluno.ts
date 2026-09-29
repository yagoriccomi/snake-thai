import { useCallback, useEffect, useRef, useState } from 'react';

import { createLogger } from '@/lib/logger';
import {
  declararAula,
  fetchAulasDoAluno,
  fetchMenuDeAulas,
  type AulaDoAluno,
  type ResultadoDaDeclaracao,
} from '@/services/aulas.service';
import { describeError } from '@/utils/errors';

const log = createLogger('useAulasDoAluno');

export const ERRO_AO_CARREGAR_AULAS = 'Não foi possível carregar as aulas. Verifique sua conexão.';

interface AulasState {
  aulas: AulaDoAluno[];
  carregando: boolean;
  /** Falha ao carregar (a lista vazia não pode fingir "sem aulas"). */
  erro: string | null;
  /** Falha ao declarar, com a frase do banco quando houver. */
  erroDaAcao: string | null;
  /** Aula em que a declaração está em andamento. */
  declarando: string | null;
  recarregar: () => Promise<void>;
  /** @returns o resultado (para o aviso de cota) ou `null` se falhou. */
  declarar: (aula: AulaDoAluno, vou: boolean) => Promise<ResultadoDaDeclaracao | null>;
}

/**
 * Carrega as aulas por um `carregar` qualquer (a lista ou o menu) e aplica a
 * declaração pela RPC, recarregando depois: as colunas de ação dependem do
 * banco, não dá para prevê-las no aparelho. [#93]
 */
function useAulas(carregar: () => Promise<AulaDoAluno[]>): AulasState {
  const [aulas, setAulas] = useState<AulaDoAluno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [declarando, setDeclarando] = useState<string | null>(null);
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setAulas(await carregarRef.current());
    } catch (falha) {
      log.error('Falha ao carregar as aulas do aluno', falha);
      setErro(ERRO_AO_CARREGAR_AULAS);
    } finally {
      setCarregando(false);
    }
  }, []);

  const declarar = useCallback(
    async (aula: AulaDoAluno, vou: boolean): Promise<ResultadoDaDeclaracao | null> => {
      setErroDaAcao(null);
      setDeclarando(aula.class_id);
      try {
        const resultado = await declararAula(aula.class_id, vou);
        await recarregar();
        return resultado;
      } catch (falha) {
        log.warn('Declaração recusada ou falhou', falha);
        setErroDaAcao(describeError(falha));
        return null;
      } finally {
        setDeclarando(null);
      }
    },
    [recarregar],
  );

  return { aulas, carregando, erro, erroDaAcao, declarando, recarregar, declarar };
}

/** Dias à frente que a lista de Aulas mostra (esta semana e a próxima, T43). */
const DIAS_DA_LISTA = 14;

/**
 * A lista de Aulas do aluno: de hoje (00:00) até duas semanas à frente (§ 12).
 * Carrega ao montar; a tela chama `recarregar` quando volta a ter foco.
 */
export function useAulasDoAluno(): AulasState {
  const carregar = useCallback(() => {
    const hoje = new Date();
    const de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const ate = new Date(de);
    ate.setDate(ate.getDate() + DIAS_DA_LISTA);
    return fetchAulasDoAluno(de, ate);
  }, []);
  const estado = useAulas(carregar);
  const { recarregar } = estado;

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return estado;
}

/** O menu de aulas de uma semana (`AAAA-MM-DD` de qualquer dia dela, § 12.2). */
export function useMenuDeAulas(semanaIso: string): AulasState {
  const carregar = useCallback(() => fetchMenuDeAulas(semanaIso), [semanaIso]);
  const estado = useAulas(carregar);
  const { recarregar } = estado;

  useEffect(() => {
    void recarregar();
  }, [recarregar, semanaIso]);

  return estado;
}
