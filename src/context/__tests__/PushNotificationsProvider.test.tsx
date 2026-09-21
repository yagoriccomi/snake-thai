import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

const mockUseAuth = jest.fn();
const mockNavegar = jest.fn();
const mockPronto = jest.fn();
const mockListeners: (() => void)[] = [];
const mockGetChoice = jest.fn();
const mockSetChoice = jest.fn();
const mockPedirPermissao = jest.fn();
const mockLerPermissao = jest.fn();
const mockObterToken = jest.fn();
const mockRegistrar = jest.fn();
const mockPrecisaAceitar = jest.fn();
const mockGetStoredToken = jest.fn();
const mockSetStoredToken = jest.fn();
/** Ouvintes de token do sistema, para simular o evento `onDevicePushToken`. */
const ouvintesDeToken: ((token: unknown) => void)[] = [];

jest.mock('@/context/AuthProvider', () => ({ useAuth: (): unknown => mockUseAuth() }));
jest.mock('@/context/LegalConsentProvider', () => ({
  useLegalConsent: () => ({ precisaAceitar: mockPrecisaAceitar() }),
}));
jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: (): unknown => mockPronto(),
    getCurrentRoute: () => ({ name: 'AulasHome' }),
    navigate: (...args: unknown[]): unknown => mockNavegar(...args),
    addListener: (_evento: string, callback: () => void) => {
      mockListeners.push(callback);
      return () => undefined;
    },
  },
}));
jest.mock('@/services/pushPreference.service', () => ({
  getPushChoice: (...args: unknown[]): unknown => mockGetChoice(...args),
  setPushChoice: (...args: unknown[]): unknown => mockSetChoice(...args),
  getStoredPushToken: (...args: unknown[]): unknown => mockGetStoredToken(...args),
  setStoredPushToken: (...args: unknown[]): unknown => mockSetStoredToken(...args),
  clearStoredPushToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/pushNotifications.service', () => {
  class PushIndisponivelError extends Error {}
  return {
    PushIndisponivelError,
    motivoDeIndisponibilidade: () => null,
    lerPermissao: (...args: unknown[]): unknown => mockLerPermissao(...args),
    pedirPermissao: (...args: unknown[]): unknown => mockPedirPermissao(...args),
    obterTokenExpo: (...args: unknown[]): unknown => mockObterToken(...args),
    registrarDispositivo: (...args: unknown[]): unknown => mockRegistrar(...args),
    removerDispositivo: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PushNotificationsProvider, usePushNotifications } from '@/context/PushNotificationsProvider';

const notificacoes = jest.mocked(Notifications);

function sessao(papel: 'user' | 'professor' | 'admin', adminLocked = false) {
  return {
    session: { user: { id: 'usuario-1' } },
    profile: { id: 'usuario-1', role: papel, is_first_login: false },
    adminLocked,
    isProfessor: papel === 'professor',
  };
}

function Estado(): React.JSX.Element {
  const { status, escolha, ativar } = usePushNotifications();
  return (
    <Text onPress={() => void ativar()} accessibilityRole="button">
      {`${status}|${escolha}`}
    </Text>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
  mockPronto.mockReturnValue(true);
  mockPrecisaAceitar.mockReturnValue(false);
  mockGetChoice.mockResolvedValue('indefinido');
  mockSetChoice.mockResolvedValue(undefined);
  mockLerPermissao.mockResolvedValue({ concedida: true, podePerguntar: true });
  mockObterToken.mockResolvedValue('ExponentPushToken[abc]');
  mockRegistrar.mockResolvedValue(undefined);
  // Storage de mentira, mas com memória: o real lembra o que gravou, e é
  // justamente isso que evita o segundo registro do mesmo token.
  let tokenGuardado: string | null = null;
  mockGetStoredToken.mockImplementation(() => Promise.resolve(tokenGuardado));
  mockSetStoredToken.mockImplementation((_usuario: string, token: string) => {
    tokenGuardado = token;
    return Promise.resolve();
  });
  ouvintesDeToken.length = 0;
  notificacoes.getLastNotificationResponse.mockReturnValue(null);
  notificacoes.addPushTokenListener.mockImplementation((ouvinte: (token: never) => void) => {
    ouvintesDeToken.push(ouvinte as (token: unknown) => void);
    return { remove: () => undefined } as never;
  });
});

/**
 * O comportamento real da biblioteca: pedir o token ao sistema REEMITE o
 * evento de "token novo" (PushTokenModule.kt resolve a promessa e chama
 * onNewToken em seguida). É esse eco que já fechou um laço infinito.
 */
function pedirTokenReemitindoOEvento(tokenDoAparelho?: unknown): Promise<string> {
  if (tokenDoAparelho === undefined) {
    ouvintesDeToken.forEach((ouvinte) => ouvinte({ type: 'android', data: 'fcm-token' }));
  }
  return Promise.resolve('ExponentPushToken[abc]');
}

describe('PushNotificationsProvider', () => {
  it('naoDevePedirPermissaoSemOToqueEmAtivar', async () => {
    mockUseAuth.mockReturnValue(sessao('user'));
    const { findByText } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    expect(await findByText('desativado|indefinido')).toBeTruthy();
    expect(mockPedirPermissao).not.toHaveBeenCalled();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('deveRegistrarOAparelhoAoAtivarComPermissao', async () => {
    mockUseAuth.mockReturnValue(sessao('user'));
    mockPedirPermissao.mockResolvedValue({ concedida: true, podePerguntar: true });
    const { findByText, getByRole } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );
    await findByText('desativado|indefinido');

    fireEvent.press(getByRole('button'));

    expect(await findByText('ativado|ativado')).toBeTruthy();
    expect(mockSetChoice).toHaveBeenCalledWith('usuario-1', 'ativado');
    expect(mockRegistrar).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  it('deveGuardarARecusaDoAndroidSemRegistrar', async () => {
    mockUseAuth.mockReturnValue(sessao('user'));
    mockPedirPermissao.mockResolvedValue({ concedida: false, podePerguntar: false });
    const { findByText, getByRole } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );
    await findByText('desativado|indefinido');

    fireEvent.press(getByRole('button'));

    expect(await findByText('negado|desativado')).toBeTruthy();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('naoDeveAbrirATelaDaNotificacaoEnquantoADigitalNaoLiberar', async () => {
    notificacoes.getLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { tipo: 'aula_sem_chamada', classId: '8b4284f0-8048-458d-a1d8-6980967e1b55' } } } },
    } as never);
    mockUseAuth.mockReturnValue(sessao('professor', true));
    const { rerender } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockNavegar).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue(sessao('professor', false));
    rerender(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    await waitFor(() =>
      expect(mockNavegar).toHaveBeenCalledWith('Main', { screen: 'Aulas', params: { screen: 'AulasHome' } }),
    );
  });

  it('naoDeveAbrirATelaDaNotificacaoAntesDoAceiteDosTermosNovos', async () => {
    notificacoes.getLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { tipo: 'aula_sem_chamada', classId: '8b4284f0-8048-458d-a1d8-6980967e1b55' } } } },
    } as never);
    mockUseAuth.mockReturnValue(sessao('professor'));
    mockPrecisaAceitar.mockReturnValue(true);
    const { rerender } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockNavegar).not.toHaveBeenCalled();

    mockPrecisaAceitar.mockReturnValue(false);
    rerender(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    await waitFor(() =>
      expect(mockNavegar).toHaveBeenCalledWith('Main', { screen: 'Aulas', params: { screen: 'AulasHome' } }),
    );
  });

  it('naoDeveEntrarEmLacoQuandoPedirOTokenReemiteOEvento', async () => {
    // Regressão: o ouvinte pedia um token novo, o pedido reemitia o evento e o
    // ouvinte rodava outra vez. Em três dias de aparelho ligado deu 120 mil
    // registros — dezenas de chamadas por segundo ao banco.
    mockUseAuth.mockReturnValue(sessao('user'));
    mockGetChoice.mockResolvedValue('ativado');
    mockObterToken.mockImplementation(pedirTokenReemitindoOEvento);
    const { findByText } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    expect(await findByText('ativado|ativado')).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRegistrar).toHaveBeenCalledTimes(1);
  });

  it('deveRegistrarQuandoOSistemaTrocaOTokenDeVerdade', async () => {
    mockUseAuth.mockReturnValue(sessao('user'));
    mockGetChoice.mockResolvedValue('ativado');
    const { findByText } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );
    await findByText('ativado|ativado');

    // Token guardado diferente do novo: o aparelho trocou de token de verdade.
    mockGetStoredToken.mockResolvedValue('ExponentPushToken[antigo]');
    mockObterToken.mockResolvedValue('ExponentPushToken[novo]');
    await act(async () => {
      ouvintesDeToken.forEach((ouvinte) => ouvinte({ type: 'android', data: 'fcm-token-novo' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockRegistrar).toHaveBeenCalledWith('ExponentPushToken[novo]'));
  });

  it('naoDeveRegistrarDeNovoQuandoOTokenNaoMudou', async () => {
    mockUseAuth.mockReturnValue(sessao('user'));
    mockGetChoice.mockResolvedValue('ativado');
    const { findByText } = render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );
    await findByText('ativado|ativado');
    expect(mockRegistrar).toHaveBeenCalledTimes(1);

    mockGetStoredToken.mockResolvedValue('ExponentPushToken[abc]');
    await act(async () => {
      ouvintesDeToken.forEach((ouvinte) => ouvinte({ type: 'android', data: 'fcm-token' }));
      await Promise.resolve();
    });

    expect(mockRegistrar).toHaveBeenCalledTimes(1);
  });

  it('naoDeveLevarProfessorParaOFinanceiro', async () => {
    notificacoes.getLastNotificationResponse.mockReturnValue({
      notification: { request: { content: { data: { tipo: 'comprovante_enviado' } } } },
    } as never);
    mockUseAuth.mockReturnValue(sessao('professor'));
    render(
      <PushNotificationsProvider>
        <Estado />
      </PushNotificationsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockNavegar).not.toHaveBeenCalled();
  });
});
