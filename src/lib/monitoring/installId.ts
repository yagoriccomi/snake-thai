import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Id aleatório desta instalação do app, usado como "usuário" no monitoramento.
 *
 * Não é ligado à conta (nem e-mail, nem id do perfil): conta quantas pessoas um
 * erro afeta sem identificar ninguém a partir do painel. Reinstalar gera outro.
 * Texto puro no AsyncStorage de propósito: é um número sem significado. [#63]
 */

const CHAVE_DO_ID = 'snakethai.monitoramento.id_instalacao';

let emMemoria: string | null = null;

/** UUID v4 com o gerador criptográfico do aparelho. */
export function gerarUuidV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Versão 4 e variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * O id desta instalação (criado na primeira vez). `null` se o armazenamento
 * falhar: o monitoramento segue sem usuário.
 */
export async function obterIdDeInstalacao(): Promise<string | null> {
  if (emMemoria !== null) {
    return emMemoria;
  }
  try {
    const guardado = await AsyncStorage.getItem(CHAVE_DO_ID);
    if (guardado !== null) {
      emMemoria = guardado;
      return guardado;
    }
    const novo = gerarUuidV4();
    await AsyncStorage.setItem(CHAVE_DO_ID, novo);
    emMemoria = novo;
    return novo;
  } catch {
    return null;
  }
}

/** Só para testes: esquece o id em memória. */
export function _esquecerIdEmMemoria(): void {
  emMemoria = null;
}
