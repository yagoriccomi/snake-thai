import * as SecureStore from 'expo-secure-store';

/**
 * Escolha de receber notificações e o último token registrado, por usuário e
 * por aparelho. Mesmo padrão da preferência de biometria: SecureStore, chave
 * com o id do usuário, e leitura que nunca quebra o boot.
 *
 * O token fica guardado para o app conseguir apagar a linha do aparelho no
 * banco ao sair da conta ou desativar — mesmo sem pedir outro token à Expo.
 */

/** `indefinido`: ainda não respondeu ao convite. */
export type PushChoice = 'indefinido' | 'ativado' | 'desativado';

const PREFIXO_ESCOLHA = 'push_choice_';
const PREFIXO_TOKEN = 'push_token_';

function chave(prefixo: string, userId: string): string {
  return `${prefixo}${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;
}

export async function getPushChoice(userId: string): Promise<PushChoice> {
  try {
    const guardada = await SecureStore.getItemAsync(chave(PREFIXO_ESCOLHA, userId));
    return guardada === 'ativado' || guardada === 'desativado' ? guardada : 'indefinido';
  } catch {
    return 'indefinido';
  }
}

export async function setPushChoice(userId: string, escolha: Exclude<PushChoice, 'indefinido'>): Promise<void> {
  await SecureStore.setItemAsync(chave(PREFIXO_ESCOLHA, userId), escolha);
}

/** Último token Expo registrado por este usuário neste aparelho. */
export async function getStoredPushToken(userId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(chave(PREFIXO_TOKEN, userId));
  } catch {
    return null;
  }
}

export async function setStoredPushToken(userId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(chave(PREFIXO_TOKEN, userId), token);
}

export async function clearStoredPushToken(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(chave(PREFIXO_TOKEN, userId));
  } catch {
    // A ausência da chave já é o estado desejado.
  }
}
