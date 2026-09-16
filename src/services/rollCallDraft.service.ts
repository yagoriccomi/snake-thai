import { largeSecureStore } from '@/lib/secureStorage';
import {
  chaveDoRascunho,
  interpretarRascunhoGuardado,
  PREFIXO_DO_RASCUNHO,
  rascunhoVencido,
  type RascunhoGuardado,
} from '@/utils/rollCallDraft';

/**
 * Rascunhos de chamada guardados no aparelho — a única porta para eles.
 *
 * Sempre pelo armazenamento cifrado: o rascunho diz quem veio e quem faltou,
 * dado pessoal que não fica em texto puro (CLAUDE.md §3). Nenhuma função daqui
 * registra conteúdo ou id de aluno em log.
 */

/**
 * O rascunho de um usuário numa aula. Registro ilegível ou de outra aula é
 * apagado e vira `null`.
 */
export async function lerRascunho(userId: string, classId: string): Promise<RascunhoGuardado | null> {
  const chave = chaveDoRascunho(userId, classId);
  const texto = await largeSecureStore.getItem(chave);
  if (texto === null) {
    return null;
  }
  const registro = interpretarRascunhoGuardado(texto);
  if (registro === null || registro.classId !== classId) {
    await largeSecureStore.removeItem(chave);
    return null;
  }
  return registro;
}

/** Guarda (ou substitui) o rascunho de um usuário numa aula. */
export async function guardarRascunho(userId: string, registro: RascunhoGuardado): Promise<void> {
  await largeSecureStore.setItem(chaveDoRascunho(userId, registro.classId), JSON.stringify(registro));
}

/** Apaga o rascunho de um usuário numa aula. */
export async function apagarRascunho(userId: string, classId: string): Promise<void> {
  await largeSecureStore.removeItem(chaveDoRascunho(userId, classId));
}

/**
 * Apaga todos os rascunhos do aparelho, de qualquer usuário (ao sair do login).
 * Um de cada vez: cada remoção mexe no Keystore, e N escritas simultâneas não
 * ganham nada.
 */
export async function apagarRascunhosDoAparelho(): Promise<void> {
  const chaves = await largeSecureStore.listKeys(PREFIXO_DO_RASCUNHO);
  for (const chave of chaves) {
    await largeSecureStore.removeItem(chave);
  }
}

/**
 * Apaga os rascunhos vencidos ou ilegíveis de qualquer usuário.
 *
 * @returns Quantos foram apagados.
 */
export async function apagarRascunhosVencidos(agoraMs: number): Promise<number> {
  const chaves = await largeSecureStore.listKeys(PREFIXO_DO_RASCUNHO);
  let apagados = 0;
  for (const chave of chaves) {
    const texto = await largeSecureStore.getItem(chave);
    const registro = texto === null ? null : interpretarRascunhoGuardado(texto);
    if (registro === null || rascunhoVencido(registro.salvoEm, agoraMs)) {
      await largeSecureStore.removeItem(chave);
      apagados += 1;
    }
  }
  return apagados;
}
