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

jest.mock('@/context/AuthProvider', () => ({ useAuth: (): unknown => mockUseAuth() }));
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
  getStoredPushToken: jest.fn().mockResolvedValue(null),
  setStoredPushToken: jest.fn().mockResolvedValue(undefined),
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
  mockGetChoice.mockResolvedValue('indefinido');
  mockSetChoice.mockResolvedValue(undefined);
  mockLerPermissao.mockResolvedValue({ concedida: true, podePerguntar: true });
  mockObterToken.mockResolvedValue('ExponentPushToken[abc]');
  mockRegistrar.mockResolvedValue(undefined);
  notificacoes.getLastNotificationResponse.mockReturnValue(null);
});

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
