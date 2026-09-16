import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuth } from '@/context/AuthProvider';
import { createLogger } from '@/lib/logger';
import { navigationRef } from '@/navigation/navigationRef';
import {
  lerPermissao,
  motivoDeIndisponibilidade,
  obterTokenExpo,
  pedirPermissao,
  PushIndisponivelError,
  registrarDispositivo,
  removerDispositivo,
  type MotivoDeIndisponibilidade,
} from '@/services/pushNotifications.service';
import {
  clearStoredPushToken,
  getPushChoice,
  getStoredPushToken,
  setPushChoice,
  setStoredPushToken,
  type PushChoice,
} from '@/services/pushPreference.service';
import { describeError } from '@/utils/errors';
import { destinoDaNotificacao, type DestinoDaNotificacao } from '@/utils/notificationRouting';

const log = createLogger('PushNotifications');

/**
 * - `carregando`: lendo a escolha e a permissão.
 * - `indisponivel`: este build não tem push (sem projeto Expo ou Firebase).
 * - `desativado`: a pessoa não quis (ou ainda não respondeu: ver `escolha`).
 * - `negado`: quis, mas o Android não deu a permissão.
 * - `ativado`: aparelho registrado.
 */
export type PushStatus = 'carregando' | 'indisponivel' | 'desativado' | 'negado' | 'ativado';

interface PushNotificationsContextValue {
  status: PushStatus;
  escolha: PushChoice;
  motivo: MotivoDeIndisponibilidade | null;
  /** O Android ainda mostra o pedido de permissão (senão, só pelas configurações). */
  podePerguntar: boolean;
  ocupado: boolean;
  erro: string | null;
  ativar: () => Promise<void>;
  desativar: () => Promise<void>;
  /** "Agora não" no convite: não pergunta de novo. */
  dispensarConvite: () => Promise<void>;
  abrirConfiguracoes: () => void;
}

const PushNotificationsContext = createContext<PushNotificationsContextValue | undefined>(undefined);

/**
 * Notificações push da sessão: lê a escolha, mantém o aparelho registrado a
 * cada abertura (atualiza "visto por último") e leva à tela certa ao tocar
 * numa notificação — só depois que a pessoa está dentro do app (login,
 * primeiro acesso e digital resolvidos).
 */
export function PushNotificationsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session, profile, adminLocked, isProfessor } = useAuth();
  const userId = session?.user.id ?? null;
  const dentroDoApp = userId !== null && profile !== null && !profile.is_first_login && !adminLocked;

  const [status, setStatus] = useState<PushStatus>('carregando');
  const [escolha, setEscolha] = useState<PushChoice>('indefinido');
  const [motivo, setMotivo] = useState<MotivoDeIndisponibilidade | null>(null);
  const [podePerguntar, setPodePerguntar] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [destinoPendente, setDestinoPendente] = useState<DestinoDaNotificacao | null>(null);
  const escolhaRef = useRef<PushChoice>('indefinido');

  const marcarIndisponivel = useCallback((motivoAtual: MotivoDeIndisponibilidade) => {
    setMotivo(motivoAtual);
    setStatus('indisponivel');
  }, []);

  /** Pede o token e grava o aparelho; guarda o token para poder apagá-lo depois. */
  const registrar = useCallback(
    async (usuario: string): Promise<boolean> => {
      try {
        const token = await obterTokenExpo();
        await registrarDispositivo(token);
        await setStoredPushToken(usuario, token);
        setErro(null);
        return true;
      } catch (falha) {
        if (falha instanceof PushIndisponivelError) {
          marcarIndisponivel(falha.motivo);
          return false;
        }
        log.error('Falha ao registrar o aparelho para notificações', falha);
        setErro(`Não foi possível ativar as notificações. ${describeError(falha)}`);
        return false;
      }
    },
    [marcarIndisponivel],
  );

  // Ao entrar na conta (e a cada abertura): estado atual e registro do aparelho.
  useEffect(() => {
    if (userId === null || profile === null || profile.is_first_login) {
      setStatus('carregando');
      return;
    }
    let cancelado = false;
    void (async () => {
      const escolhaSalva = await getPushChoice(userId);
      if (cancelado) return;
      escolhaRef.current = escolhaSalva;
      setEscolha(escolhaSalva);

      const indisponivel = motivoDeIndisponibilidade();
      if (indisponivel !== null) {
        marcarIndisponivel(indisponivel);
        return;
      }
      if (escolhaSalva !== 'ativado') {
        setStatus('desativado');
        return;
      }
      const permissao = await lerPermissao();
      if (cancelado) return;
      setPodePerguntar(permissao.podePerguntar);
      if (!permissao.concedida) {
        // Permissão tirada nas configurações do Android depois de ativar.
        setStatus('negado');
        return;
      }
      const ok = await registrar(userId);
      if (!cancelado && ok) setStatus('ativado');
    })();
    return () => {
      cancelado = true;
    };
  }, [userId, profile, marcarIndisponivel, registrar]);

  // Token trocado pelo sistema: registra o novo.
  useEffect(() => {
    if (userId === null) return undefined;
    const assinatura = Notifications.addPushTokenListener(() => {
      if (escolhaRef.current === 'ativado') void registrar(userId);
    });
    return () => assinatura.remove();
  }, [userId, registrar]);

  // Toque numa notificação: com o app fechado (última resposta) ou aberto.
  useEffect(() => {
    const guardar = (resposta: Notifications.NotificationResponse | null): void => {
      const destino = destinoDaNotificacao(resposta?.notification.request.content.data);
      if (destino !== null) setDestinoPendente(destino);
    };
    guardar(Notifications.getLastNotificationResponse());
    const assinatura = Notifications.addNotificationResponseReceivedListener(guardar);
    return () => assinatura.remove();
  }, []);

  // Só navega com a pessoa dentro do app: a digital continua sendo respeitada.
  useEffect(() => {
    if (destinoPendente === null || !dentroDoApp) return undefined;
    // Professor não tem a aba Financeiro: um aviso financeiro não o leva a lugar nenhum.
    if (destinoPendente.aba === 'Financeiro' && isProfessor) {
      setDestinoPendente(null);
      return undefined;
    }
    const navegar = (): boolean => {
      if (!navigationRef.isReady() || navigationRef.getCurrentRoute() === undefined) return false;
      if (destinoPendente.aba === 'Financeiro') {
        navigationRef.navigate('Main', { screen: 'Financeiro', params: { screen: destinoPendente.tela } });
      } else {
        navigationRef.navigate('Main', { screen: 'Aulas', params: { screen: destinoPendente.tela } });
      }
      setDestinoPendente(null);
      return true;
    };
    if (navegar()) return undefined;
    const cancelar = navigationRef.addListener('state', () => {
      if (navegar()) cancelar();
    });
    return cancelar;
  }, [destinoPendente, dentroDoApp, isProfessor]);

  const ativar = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    setOcupado(true);
    setErro(null);
    try {
      const permissao = await pedirPermissao();
      setPodePerguntar(permissao.podePerguntar);
      if (!permissao.concedida) {
        setStatus('negado');
        await setPushChoice(userId, 'desativado');
        escolhaRef.current = 'desativado';
        setEscolha('desativado');
        return;
      }
      await setPushChoice(userId, 'ativado');
      escolhaRef.current = 'ativado';
      setEscolha('ativado');
      if (await registrar(userId)) setStatus('ativado');
    } catch (falha) {
      log.error('Falha ao ativar notificações', falha);
      setErro(`Não foi possível ativar as notificações. ${describeError(falha)}`);
    } finally {
      setOcupado(false);
    }
  }, [userId, registrar]);

  const desativar = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    setOcupado(true);
    setErro(null);
    try {
      const token = await getStoredPushToken(userId);
      if (token !== null) {
        // Sem conseguir apagar, o aparelho seguiria recebendo: não finge que desativou.
        await removerDispositivo(token);
        await clearStoredPushToken(userId);
      }
      await setPushChoice(userId, 'desativado');
      escolhaRef.current = 'desativado';
      setEscolha('desativado');
      setStatus(motivoDeIndisponibilidade() !== null ? 'indisponivel' : 'desativado');
    } catch (falha) {
      log.error('Falha ao desativar notificações', falha);
      setErro(`Não foi possível desativar as notificações. ${describeError(falha)}`);
    } finally {
      setOcupado(false);
    }
  }, [userId]);

  const dispensarConvite = useCallback(async (): Promise<void> => {
    if (userId === null) return;
    try {
      await setPushChoice(userId, 'desativado');
    } catch (falha) {
      log.warn('Escolha de notificações não gravada', falha);
    }
    escolhaRef.current = 'desativado';
    setEscolha('desativado');
  }, [userId]);

  const abrirConfiguracoes = useCallback(() => {
    Linking.openSettings().catch((falha: unknown) => log.warn('Configurações do sistema não abriram', falha));
  }, []);

  const valor = useMemo<PushNotificationsContextValue>(
    () => ({ status, escolha, motivo, podePerguntar, ocupado, erro, ativar, desativar, dispensarConvite, abrirConfiguracoes }),
    [status, escolha, motivo, podePerguntar, ocupado, erro, ativar, desativar, dispensarConvite, abrirConfiguracoes],
  );

  return <PushNotificationsContext.Provider value={valor}>{children}</PushNotificationsContext.Provider>;
}

export function usePushNotifications(): PushNotificationsContextValue {
  const contexto = useContext(PushNotificationsContext);
  if (contexto === undefined) {
    throw new Error('usePushNotifications precisa estar dentro de PushNotificationsProvider');
  }
  return contexto;
}
