import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createLogger } from '@/lib/logger';
import type { AttendanceStatus } from '@/services/classes.service';
import {
  apagarRascunho,
  apagarRascunhosVencidos,
  guardarRascunho,
  lerRascunho,
} from '@/services/rollCallDraft.service';
import { alternarMarcacao, type RascunhoDeChamada } from '@/utils/rollCall';
import {
  ATRASO_PARA_GUARDAR_MS,
  avaliarRascunho,
  mesmasMarcacoes,
  restringirAosAlunos,
  somenteMarcados,
  VERSAO_DO_RASCUNHO,
  type MarcacoesGravadas,
  type RascunhoGuardado,
} from '@/utils/rollCallDraft';

const log = createLogger('useRollCallDraft');

export interface AvisoDoRascunho {
  /** `recuperado`: marcações restauradas. `conflito`: outra pessoa salvou depois. */
  tipo: 'recuperado' | 'conflito';
  /** Quando o rascunho foi guardado (ISO). */
  salvoEm: string;
}

interface UseRollCallDraftParams {
  /** Quem faz a chamada; sem usuário, nada é lido nem guardado. */
  userId: string | null;
  classId: string;
  alunoIds: readonly string[];
  /** A chamada gravada no banco. Identidade nova = recarga. */
  gravado: MarcacoesGravadas;
  concluidaEm: string | null;
  /** A lista está carregada e a chamada pode ser editada. */
  ativo: boolean;
}

interface UseRollCallDraftResult {
  rascunho: RascunhoDeChamada;
  marcar: (alunoId: string, status: AttendanceStatus) => void;
  /** `false` enquanto o rascunho guardado é lido: a lista não aceita toque. */
  pronto: boolean;
  aviso: AvisoDoRascunho | null;
  /** Conflito: fica com o rascunho e passa a comparar com o que está gravado agora. */
  usarMeuRascunho: () => void;
  /** Volta ao que está gravado e apaga o rascunho. */
  descartar: () => Promise<void>;
  /** Apaga o rascunho sem mexer na tela (a chamada acabou de ser salva). Nunca lança. */
  esquecer: () => Promise<void>;
}

interface Base {
  marcacoes: MarcacoesGravadas;
  concluidaEm: string | null;
}

/**
 * Marcações da chamada, guardadas cifradas no aparelho até "Concluir chamada".
 *
 * Existe porque o Android mata o app em segundo plano: sem isto, uma chamada
 * pela metade some quando o professor atende o telefone. Regras em
 * docs/FREQUENCIA.md e utils/rollCallDraft.ts.
 *
 * Cuidados que não são óbvios:
 * - Nada é gravado nem apagado antes de ler o que está guardado: o primeiro
 *   render tem rascunho `{}` igual a gravado `{}`, e isso apagaria o rascunho
 *   que se queria recuperar.
 * - As operações no armazenamento passam por uma fila: um "guardar" atrasado
 *   nunca termina depois de um "apagar".
 * - Ao ir para segundo plano e ao sair da tela, a gravação pendente vai na hora.
 */
export function useRollCallDraft({
  userId,
  classId,
  alunoIds,
  gravado,
  concluidaEm,
  ativo,
}: UseRollCallDraftParams): UseRollCallDraftResult {
  const [rascunho, setRascunho] = useState<RascunhoDeChamada>(gravado);
  const [pronto, setPronto] = useState(true);
  const [aviso, setAviso] = useState<AvisoDoRascunho | null>(null);

  // Valores mais recentes para as operações que rodam fora do render.
  const gravadoRef = useRef(gravado);
  const concluidaEmRef = useRef(concluidaEm);
  const alunoIdsRef = useRef(alunoIds);
  gravadoRef.current = gravado;
  concluidaEmRef.current = concluidaEm;
  alunoIdsRef.current = alunoIds;

  const avaliadoRef = useRef(false);
  const baseRef = useRef<Base>({ marcacoes: gravado, concluidaEm });
  const emConflitoRef = useRef<RascunhoGuardado | null>(null);
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendenteRef = useRef<(() => void) | null>(null);
  /** Conteúdo (sem a data) da última gravação: abrir a tela não renova a validade. */
  const ultimoConteudoRef = useRef<string | null>(null);
  /** Há rascunho guardado desta aula? Evita apagar o que não existe. */
  const existeGuardadoRef = useRef(false);
  /** Depois de descartar/esquecer, sair da tela não regrava. */
  const semGravarAoSairRef = useRef(false);

  const enfileirar = useCallback(
    (operacao: () => Promise<void>): Promise<void> => {
      filaRef.current = filaRef.current.then(operacao).catch((erro: unknown) => {
        log.warn('Falha no armazenamento do rascunho da chamada', erro, { classId });
      });
      return filaRef.current;
    },
    [classId],
  );

  const cancelarPendente = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendenteRef.current = null;
  }, []);

  const gravarPendenteAgora = useCallback(() => {
    const operacao = pendenteRef.current;
    cancelarPendente();
    operacao?.();
  }, [cancelarPendente]);

  // Limpeza de rascunhos vencidos de qualquer aula, uma vez por abertura.
  useEffect(() => {
    void apagarRascunhosVencidos(Date.now()).catch((erro: unknown) => {
      log.warn('Falha ao limpar rascunhos vencidos', erro);
    });
  }, []);

  // Recarga da chamada gravada (abertura e depois de salvar): a tela volta ao
  // que está gravado, e o gravado vira a nova base.
  const gravadoAnteriorRef = useRef(gravado);
  useEffect(() => {
    const mudouGravado = gravadoAnteriorRef.current !== gravado;
    gravadoAnteriorRef.current = gravado;

    if (!avaliadoRef.current) {
      if (mudouGravado) setRascunho(gravado);
      return;
    }
    if (emConflitoRef.current === null) {
      baseRef.current = { marcacoes: gravado, concluidaEm };
    }
    if (mudouGravado) {
      cancelarPendente();
      emConflitoRef.current = null;
      baseRef.current = { marcacoes: gravado, concluidaEm };
      setRascunho(gravado);
      setAviso(null);
    }
  }, [gravado, concluidaEm, cancelarPendente]);

  // Primeira ativação: lê o que está guardado e decide o que fazer.
  useEffect(() => {
    if (!ativo || userId === null || avaliadoRef.current) {
      return undefined;
    }
    let cancelado = false;
    setPronto(false);

    void (async () => {
      try {
        const guardado = await lerRascunho(userId, classId);
        if (cancelado) return;

        const agora = { marcacoes: gravadoRef.current, concluidaEm: concluidaEmRef.current };
        baseRef.current = agora;
        if (guardado === null) return;

        const avaliacao = avaliarRascunho({
          guardado,
          gravado: agora.marcacoes,
          concluidaEm: agora.concluidaEm,
          alunoIds: alunoIdsRef.current,
          agoraMs: Date.now(),
        });

        if (avaliacao === 'vencido' || avaliacao === 'identico') {
          void enfileirar(() => apagarRascunho(userId, classId));
          return;
        }

        existeGuardadoRef.current = true;
        if (avaliacao === 'conflito') {
          emConflitoRef.current = guardado;
          setAviso({ tipo: 'conflito', salvoEm: guardado.salvoEm });
          return;
        }

        const marcacoes = restringirAosAlunos(guardado.marcacoes, alunoIdsRef.current);
        ultimoConteudoRef.current = conteudoDoRascunho(classId, agora, marcacoes);
        setRascunho(marcacoes);
        setAviso({ tipo: 'recuperado', salvoEm: guardado.salvoEm });
      } catch (erro) {
        // Sem o rascunho, a chamada segue com o que está gravado: nunca trava a tela.
        log.warn('Falha ao ler o rascunho da chamada', erro, { classId });
      } finally {
        if (!cancelado) {
          avaliadoRef.current = true;
          setPronto(true);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ativo, userId, classId, enfileirar]);

  // Cada mudança nas marcações agenda uma gravação; toques seguidos viram uma só.
  useEffect(() => {
    if (!avaliadoRef.current || userId === null || emConflitoRef.current !== null) {
      return;
    }
    cancelarPendente();

    const operacao = (): void => {
      if (mesmasMarcacoes(rascunho, gravadoRef.current)) {
        ultimoConteudoRef.current = null;
        if (!existeGuardadoRef.current) return;
        existeGuardadoRef.current = false;
        void enfileirar(() => apagarRascunho(userId, classId));
        return;
      }

      const base = baseRef.current;
      const marcacoes = somenteMarcados(rascunho);
      const conteudo = conteudoDoRascunho(classId, base, marcacoes);
      if (conteudo === ultimoConteudoRef.current) return;

      ultimoConteudoRef.current = conteudo;
      existeGuardadoRef.current = true;
      void enfileirar(() =>
        guardarRascunho(userId, {
          versao: VERSAO_DO_RASCUNHO,
          classId,
          salvoEm: new Date().toISOString(),
          base,
          marcacoes,
        }),
      );
    };

    pendenteRef.current = operacao;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendenteRef.current = null;
      operacao();
    }, ATRASO_PARA_GUARDAR_MS);
  }, [rascunho, userId, classId, cancelarPendente, enfileirar]);

  // O Android pode matar o processo em segundo plano: grava o pendente já.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') gravarPendenteAgora();
    });
    return () => assinatura.remove();
  }, [gravarPendenteAgora]);

  // Saindo da tela ("Sair e guardar"), a gravação pendente não pode se perder.
  const gravarPendenteAgoraRef = useRef(gravarPendenteAgora);
  gravarPendenteAgoraRef.current = gravarPendenteAgora;
  useEffect(
    () => () => {
      if (semGravarAoSairRef.current) {
        cancelarPendente();
        return;
      }
      gravarPendenteAgoraRef.current();
    },
    [cancelarPendente],
  );

  const marcar = useCallback(
    (alunoId: string, status: AttendanceStatus) => {
      if (!pronto || emConflitoRef.current !== null) return;
      semGravarAoSairRef.current = false;
      setRascunho((anterior) => ({
        ...anterior,
        [alunoId]: alternarMarcacao(anterior[alunoId] ?? null, status),
      }));
    },
    [pronto],
  );

  const usarMeuRascunho = useCallback(() => {
    const guardado = emConflitoRef.current;
    if (guardado === null || userId === null) return;

    emConflitoRef.current = null;
    semGravarAoSairRef.current = false;
    // Nova base = o que está gravado agora; senão o conflito volta na próxima abertura.
    const base = { marcacoes: gravadoRef.current, concluidaEm: concluidaEmRef.current };
    baseRef.current = base;
    const marcacoes = restringirAosAlunos(guardado.marcacoes, alunoIdsRef.current);
    ultimoConteudoRef.current = conteudoDoRascunho(classId, base, marcacoes);
    existeGuardadoRef.current = true;

    setRascunho(marcacoes);
    setAviso({ tipo: 'recuperado', salvoEm: guardado.salvoEm });
    void enfileirar(() =>
      guardarRascunho(userId, {
        versao: VERSAO_DO_RASCUNHO,
        classId,
        salvoEm: new Date().toISOString(),
        base,
        marcacoes,
      }),
    );
  }, [userId, classId, enfileirar]);

  const apagarGuardado = useCallback((): Promise<void> => {
    cancelarPendente();
    semGravarAoSairRef.current = true;
    ultimoConteudoRef.current = null;
    existeGuardadoRef.current = false;
    if (userId === null) return Promise.resolve();
    return enfileirar(() => apagarRascunho(userId, classId));
  }, [userId, classId, cancelarPendente, enfileirar]);

  const descartar = useCallback((): Promise<void> => {
    emConflitoRef.current = null;
    baseRef.current = { marcacoes: gravadoRef.current, concluidaEm: concluidaEmRef.current };
    setRascunho(gravadoRef.current);
    setAviso(null);
    return apagarGuardado();
  }, [apagarGuardado]);

  return {
    rascunho,
    marcar,
    pronto,
    aviso,
    usarMeuRascunho,
    descartar,
    esquecer: apagarGuardado,
  };
}

/** Identidade do rascunho sem a data: base + marcações. */
function conteudoDoRascunho(
  classId: string,
  base: Base,
  marcacoes: MarcacoesGravadas,
): string {
  return JSON.stringify({ classId, base, marcacoes });
}
