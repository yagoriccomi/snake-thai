import * as SecureStore from 'expo-secure-store';

/**
 * Preferência de desbloqueio biométrico, por usuário.
 *
 * A escolha é do usuário — o app pergunta uma única vez, logo após o primeiro
 * acesso, e respeita a resposta. Guardamos em `SecureStore` (Keychain/Keystore)
 * e não em AsyncStorage: embora seja só um sinalizador, ele governa uma decisão
 * de segurança e não deve ser adulterável por um simples dump de arquivos.
 *
 * Chaves são namespaced pelo id do usuário para que dois cadastros no mesmo
 * aparelho não herdem a escolha um do outro.
 */

/** Estado da preferência: nunca perguntado, ativado ou recusado. */
export type BiometricChoice = 'unset' | 'enabled' | 'disabled';

const KEY_PREFIX = 'biometric_choice_';

/** Monta a chave do SecureStore para um usuário. */
function storageKey(userId: string): string {
  // SecureStore aceita apenas [A-Za-z0-9._-]; o UUID já se encaixa, mas
  // normalizamos por segurança contra ids futuros em outro formato.
  return `${KEY_PREFIX}${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;
}

/**
 * Lê a escolha registrada para o usuário.
 *
 * @param userId Id do usuário autenticado.
 * @returns `'unset'` quando ainda não foi perguntado, ou a escolha registrada.
 *          Falhas de leitura degradam para `'unset'` (nunca quebram o boot).
 */
export async function getBiometricChoice(userId: string): Promise<BiometricChoice> {
  try {
    const stored = await SecureStore.getItemAsync(storageKey(userId));
    return stored === 'enabled' || stored === 'disabled' ? stored : 'unset';
  } catch {
    return 'unset';
  }
}

/**
 * Grava a escolha do usuário.
 *
 * @param userId Id do usuário autenticado.
 * @param choice `'enabled'` para exigir biometria, `'disabled'` para dispensar.
 */
export async function setBiometricChoice(
  userId: string,
  choice: Exclude<BiometricChoice, 'unset'>,
): Promise<void> {
  await SecureStore.setItemAsync(storageKey(userId), choice);
}

/** Esquece a escolha — o app voltará a perguntar no próximo acesso. */
export async function clearBiometricChoice(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(storageKey(userId));
  } catch {
    // Nada a fazer: a ausência da chave já é o estado desejado.
  }
}
