import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { DevicePushToken } from 'expo-notifications';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { clearStoredPushToken, getStoredPushToken } from '@/services/pushPreference.service';

const log = createLogger('pushNotifications');

/**
 * Notificações push no aparelho: canais, permissão, token da Expo e registro
 * no banco. Telas não importam expo-notifications nem o Supabase direto: tudo
 * passa por aqui (docs/NOTIFICACOES.md).
 */

/** Canais Android — os mesmos que a Edge Function send-push usa. */
export const CANAIS_ANDROID = {
  financeiro: { name: 'Financeiro', importance: Notifications.AndroidImportance.HIGH },
  frequencia: { name: 'Aulas e frequência', importance: Notifications.AndroidImportance.DEFAULT },
  geral: { name: 'Avisos gerais', importance: Notifications.AndroidImportance.DEFAULT },
} as const;

/** Por que não dá para ativar push neste aparelho/build. */
export type MotivoDeIndisponibilidade = 'sem_projeto_expo' | 'plataforma' | 'sem_firebase';

export class PushIndisponivelError extends Error {
  readonly motivo: MotivoDeIndisponibilidade;

  constructor(motivo: MotivoDeIndisponibilidade) {
    super(`Notificações indisponíveis: ${motivo}`);
    this.name = 'PushIndisponivelError';
    this.motivo = motivo;
  }
}

export interface PermissaoDePush {
  concedida: boolean;
  /** Falso quando o Android não mostra mais o pedido (só pelas configurações). */
  podePerguntar: boolean;
}

// Com o app aberto, a notificação aparece como banner, sem som e sem número
// no ícone. Em escopo de módulo: precisa valer antes de qualquer tela montar.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

/**
 * Cria os canais. No Android 13+, sem canal criado ANTES, o pedido de permissão
 * não aparece e o token não é gerado.
 */
export async function configurarCanais(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    Object.entries(CANAIS_ANDROID).map(([id, canal]) => Notifications.setNotificationChannelAsync(id, canal)),
  );
}

function comoPermissao(resposta: Notifications.NotificationPermissionsStatus): PermissaoDePush {
  return { concedida: resposta.granted, podePerguntar: resposta.canAskAgain };
}

export async function lerPermissao(): Promise<PermissaoDePush> {
  return comoPermissao(await Notifications.getPermissionsAsync());
}

/** Mostra o pedido do sistema. Chame só depois de um toque em "Ativar". */
export async function pedirPermissao(): Promise<PermissaoDePush> {
  await configurarCanais();
  return comoPermissao(await Notifications.requestPermissionsAsync());
}

function projectIdDaExpo(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const projectId = extra?.eas?.projectId;
  return typeof projectId === 'string' && projectId !== '' ? projectId : null;
}

/** Diz, sem pedir nada ao sistema, se este build consegue ter push. */
export function motivoDeIndisponibilidade(): MotivoDeIndisponibilidade | null {
  if (Platform.OS !== 'android') return 'plataforma';
  if (projectIdDaExpo() === null) return 'sem_projeto_expo';
  return null;
}

/**
 * Token Expo do aparelho.
 *
 * @param tokenDoAparelho Token do Firebase que já veio no evento do sistema.
 *   Informe sempre que tiver: sem ele, a biblioteca pede um token novo ao
 *   Firebase e **reemite o evento `onDevicePushToken`** — quem registra o
 *   aparelho dentro do ouvinte desse evento cai num laço infinito.
 *   (`PushTokenModule.kt`: `promise.resolve(token); onNewToken(token)`.)
 * @throws PushIndisponivelError sem projectId, fora do Android ou sem Firebase
 *   no build (a biblioteca nativa recusa gerar o token).
 */
export async function obterTokenExpo(tokenDoAparelho?: DevicePushToken): Promise<string> {
  const motivo = motivoDeIndisponibilidade();
  if (motivo !== null) {
    throw new PushIndisponivelError(motivo);
  }
  await configurarCanais();
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: projectIdDaExpo() ?? undefined,
      devicePushToken: tokenDoAparelho,
    });
    return data;
  } catch (falha) {
    // Build sem google-services.json: o FirebaseApp não existe e o token falha.
    if (/firebase|FCM|google/i.test(falha instanceof Error ? falha.message : String(falha))) {
      throw new PushIndisponivelError('sem_firebase');
    }
    throw falha;
  }
}

/** Grava (ou atualiza) o aparelho de quem está logado. */
export async function registrarDispositivo(token: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_dispositivo_push', {
    p_token: token,
    p_plataforma: Platform.OS === 'ios' ? 'ios' : 'android',
    p_variante: env.appVariant,
  });
  if (error !== null) {
    throw error;
  }
}

/** Apaga o aparelho do banco (a RLS só deixa apagar o próprio). */
export async function removerDispositivo(token: string): Promise<void> {
  const { error } = await supabase.from('push_devices').delete().eq('expo_token', token);
  if (error !== null) {
    throw error;
  }
}

/** Tempo máximo que sair da conta espera pela remoção do aparelho. */
const ESPERA_AO_SAIR_MS = 3000;

/**
 * Tira o aparelho do banco ANTES de encerrar a sessão (depois, sem JWT, a RLS
 * não deixa). Nunca impede a saída: sem rede ou demorando, segue — o próximo
 * login reatribui o token e a Expo acaba dizendo que ele não existe.
 */
export async function removerAparelhoAoSair(userId: string): Promise<void> {
  const token = await getStoredPushToken(userId);
  if (token === null) return;
  try {
    await Promise.race([
      removerDispositivo(token),
      new Promise<void>((_resolver, rejeitar) => {
        setTimeout(() => rejeitar(new Error('Tempo esgotado ao remover o aparelho')), ESPERA_AO_SAIR_MS);
      }),
    ]);
  } catch (falha) {
    log.warn('Aparelho não removido ao sair da conta', falha);
  } finally {
    await clearStoredPushToken(userId);
  }
}
