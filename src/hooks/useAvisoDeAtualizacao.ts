import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { createLogger } from '@/lib/logger';
import {
  buscarUltimaRelease,
  gravarMemoriaDoAviso,
  lerMemoriaDoAviso,
  type MemoriaDoAviso,
} from '@/services/avisoDeAtualizacao.service';
import {
  avaliarAtualizacao,
  diaEmSaoPaulo,
  lerTagDaRelease,
  type AtualizacaoDisponivel,
} from '@/utils/avisoDeAtualizacao';

const log = createLogger('AvisoDeAtualizacao');

/** A tag vem de fora: guardar só o tamanho de uma tag de verdade. */
const TAMANHO_MAXIMO_DA_TAG_GUARDADA = 32;

interface OpcoesDoAviso {
  /** `false` no APK DEV: não consulta nada (§ 12.3). */
  ativo: boolean;
  /** `Constants.expoConfig.version` (pode ter `+N.sha`). */
  versaoInstalada: string | null | undefined;
  /** Relógio (substituível nos testes). */
  agora?: () => Date;
}

interface AvisoDeAtualizacao {
  /** O que mostrar; `null` = nada. */
  atualizacao: AtualizacaoDisponivel | null;
  /** **Baixar atualização**: abre o link montado no navegador e fecha. */
  baixar: () => void;
  /** **Agora não** (ou voltar do Android): fecha até o dia seguinte. */
  dispensar: () => void;
}

const relogioDoAparelho = (): Date => new Date();

/**
 * Quando consultar e o que mostrar no aviso de atualização (contrato § 12.3).
 *
 * Confere ao abrir e ao voltar ao primeiro plano, no máximo uma consulta e um
 * aviso por dia (dia de São Paulo). Toda falha vai para `log.warn` e some: o
 * aviso é informativo e **nunca** trava nem atrasa a abertura (T48) — a
 * consulta corre depois da primeira tela, sem ninguém esperar por ela.
 */
export function useAvisoDeAtualizacao({
  ativo,
  versaoInstalada,
  agora = relogioDoAparelho,
}: OpcoesDoAviso): AvisoDeAtualizacao {
  const [atualizacao, setAtualizacao] = useState<AtualizacaoDisponivel | null>(null);
  const consultando = useRef(false);
  const montado = useRef(true);
  // Numa ref: uma função nova a cada render não pode disparar outra consulta.
  const relogio = useRef(agora);
  relogio.current = agora;

  const verificar = useCallback(async (): Promise<void> => {
    // Abrir e voltar ao primeiro plano podem chegar juntos: uma consulta só.
    if (!ativo || consultando.current) return;
    consultando.current = true;
    try {
      const hoje = diaEmSaoPaulo(relogio.current());
      const memoria = await lerMemoria();
      if (memoria?.dia === hoje) return;

      const resultado = await buscarUltimaRelease();
      if (resultado.tipo === 'falha') {
        // Sem rede ou tempo esgotado: o dia não conta, e a próxima volta ao app tenta de novo.
        log.warn('Consulta da versão nova falhou', resultado.erro, { motivo: resultado.motivo });
        return;
      }

      const tagVista = resultado.tipo === 'release' ? tagParaGuardar(resultado.release.tag_name) : null;
      await gravarMemoria({ dia: hoje, ultimaTag: tagVista ?? memoria?.ultimaTag ?? null });

      if (resultado.tipo === 'limite') {
        log.warn('GitHub limitou a consulta da versão nova; o dia conta como consultado', undefined, {
          status: resultado.status,
        });
        return;
      }
      if (lerTagDaRelease(resultado.release.tag_name) === null) {
        log.warn('Release com tag fora do formato vX.Y.Z; aviso não mostrado', undefined, { tag: tagVista });
        return;
      }

      const aviso = avaliarAtualizacao(resultado.release, versaoInstalada);
      if (aviso !== null && montado.current) setAtualizacao(aviso);
    } finally {
      consultando.current = false;
    }
  }, [ativo, versaoInstalada]);

  useEffect(() => {
    montado.current = true;
    void verificar();
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void verificar();
    });
    return () => {
      montado.current = false;
      assinatura.remove();
    };
  }, [verificar]);

  const dispensar = useCallback(() => setAtualizacao(null), []);

  const baixar = useCallback(() => {
    if (atualizacao === null) return;
    Linking.openURL(atualizacao.link).then(
      () => setAtualizacao(null),
      // O cartão fica aberto para tentar de novo.
      (falha: unknown) => log.warn('Navegador não abriu o link da versão nova', falha),
    );
  }, [atualizacao]);

  return { atualizacao, baixar, dispensar };
}

async function lerMemoria(): Promise<MemoriaDoAviso | null> {
  try {
    return await lerMemoriaDoAviso();
  } catch (erro) {
    log.warn('Memória do aviso de atualização ilegível; consultando assim mesmo', erro);
    return null;
  }
}

async function gravarMemoria(memoria: MemoriaDoAviso): Promise<void> {
  try {
    await gravarMemoriaDoAviso(memoria);
  } catch (erro) {
    log.warn('Memória do aviso de atualização não gravou', erro);
  }
}

function tagParaGuardar(tag: unknown): string | null {
  return typeof tag === 'string' ? tag.slice(0, TAMANHO_MAXIMO_DA_TAG_GUARDADA) : null;
}
