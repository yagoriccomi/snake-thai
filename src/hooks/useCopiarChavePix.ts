import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createLogger } from '@/lib/logger';

const log = createLogger('useCopiarChavePix');

/**
 * Quanto tempo a confirmação fica na tela antes de o botão voltar ao normal.
 * Curto o bastante para não parecer travado, longo o bastante para ser lido.
 */
const DURACAO_DA_CONFIRMACAO_MS = 2500;

/** O que a tela precisa mostrar depois do toque. */
export type EstadoDaCopia = 'ocioso' | 'copiada' | 'falhou';

export interface CopiaDaChavePix {
  /** Estado atual; volta a `ocioso` sozinho. */
  estado: EstadoDaCopia;
  /** `false` quando a academia ainda não cadastrou a chave. */
  podeCopiar: boolean;
  /** Copia a chave. Sem chave cadastrada, não faz nada. */
  copiar: () => void;
}

/**
 * Copia a chave PIX da academia para a área de transferência.
 *
 * Existe como hook porque a regra não é só "copiar": é confirmar que copiou,
 * avisar o leitor de tela, voltar ao estado inicial sozinho e nunca deixar a
 * falha passar em silêncio. A tela fica só com o desenho. [#2][#6]
 *
 * @param chave Chave cadastrada em `academy_settings.pix_key`, ou `null`.
 */
export function useCopiarChavePix(chave: string | null): CopiaDaChavePix {
  const [estado, setEstado] = useState<EstadoDaCopia>('ocioso');
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limparTemporizador = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  // Sem isto, a confirmação tentaria aparecer numa tela que o aluno já fechou.
  useEffect(() => limparTemporizador, [limparTemporizador]);

  const chaveLimpa = chave !== null ? chave.trim() : '';
  const podeCopiar = chaveLimpa !== '';

  const copiar = useCallback(() => {
    if (!podeCopiar) {
      return;
    }
    void (async () => {
      try {
        await Clipboard.setStringAsync(chaveLimpa);
        setEstado('copiada');
        // O botão troca de texto, mas quem usa leitor de tela só ouviria isso
        // ao focar o botão de novo — o anúncio fecha essa lacuna.
        AccessibilityInfo.announceForAccessibility('Chave PIX copiada.');
      } catch (erro) {
        // O detalhe técnico vai para o log; a tela recebe só o que dá para
        // resolver, e nunca a stack. [#92][#93]
        log.error('Falha ao copiar a chave PIX', erro);
        setEstado('falhou');
      }
      limparTemporizador();
      temporizador.current = setTimeout(() => setEstado('ocioso'), DURACAO_DA_CONFIRMACAO_MS);
    })();
  }, [chaveLimpa, podeCopiar, limparTemporizador]);

  return { estado, podeCopiar, copiar };
}
