import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockGetStoredToken = jest.fn();
const mockClearStoredToken = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));
jest.mock('@/config/env', () => ({ env: { appVariant: 'development' } }));
jest.mock('@/services/pushPreference.service', () => ({
  getStoredPushToken: (...args: unknown[]): unknown => mockGetStoredToken(...args),
  clearStoredPushToken: (...args: unknown[]): unknown => mockClearStoredToken(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import {
  obterTokenExpo,
  pedirPermissao,
  PushIndisponivelError,
  registrarDispositivo,
  removerAparelhoAoSair,
} from '@/services/pushNotifications.service';
import { createQueryChain } from '@/test-utils/supabaseMock';

const notificacoes = jest.mocked(Notifications);
const constantes = Constants as unknown as { expoConfig: { extra: Record<string, unknown> } };

beforeEach(() => {
  jest.clearAllMocks();
  constantes.expoConfig.extra = { eas: { projectId: 'projeto-de-teste' } };
  mockClearStoredToken.mockResolvedValue(undefined);
});

describe('obterTokenExpo', () => {
  it('deveCriarOsCanaisAntesDePedirOToken', async () => {
    const ordem: string[] = [];
    notificacoes.setNotificationChannelAsync.mockImplementation(async (id: string) => {
      ordem.push(`canal:${id}`);
      return null;
    });
    notificacoes.getExpoPushTokenAsync.mockImplementation(async () => {
      ordem.push('token');
      return { type: 'expo', data: 'ExponentPushToken[abc]' };
    });

    await expect(obterTokenExpo()).resolves.toBe('ExponentPushToken[abc]');

    // No Android 13+, sem canal criado antes o token não é gerado.
    expect(ordem.indexOf('token')).toBeGreaterThan(ordem.indexOf('canal:financeiro'));
    expect(notificacoes.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'projeto-de-teste' });
  });

  it('deveRecusarSemProjetoDaExpoSemPedirNadaAoSistema', async () => {
    constantes.expoConfig.extra = {};

    await expect(obterTokenExpo()).rejects.toEqual(new PushIndisponivelError('sem_projeto_expo'));
    expect(notificacoes.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('deveTraduzirAFaltaDoFirebaseNoBuild', async () => {
    notificacoes.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('Default FirebaseApp is not initialized'));

    const falha = await obterTokenExpo().catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(PushIndisponivelError);
    expect((falha as PushIndisponivelError).motivo).toBe('sem_firebase');
  });
});

describe('pedirPermissao', () => {
  it('deveDizerQuandoOAndroidNaoPerguntaMais', async () => {
    notificacoes.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);

    await expect(pedirPermissao()).resolves.toEqual({ concedida: false, podePerguntar: false });
    expect(notificacoes.setNotificationChannelAsync).toHaveBeenCalled();
  });
});

describe('registrarDispositivo', () => {
  it('deveMandarOTokenComAPlataformaEAVarianteDoApp', async () => {
    mockRpc.mockResolvedValue({ data: 'id-1', error: null });

    await registrarDispositivo('ExponentPushToken[abc]');

    expect(mockRpc).toHaveBeenCalledWith('registrar_dispositivo_push', {
      p_token: 'ExponentPushToken[abc]',
      p_plataforma: 'android',
      p_variante: 'development',
    });
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Operação negada' } });
    await expect(registrarDispositivo('ExponentPushToken[abc]')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('removerAparelhoAoSair', () => {
  it('deveApagarOAparelhoDoBancoEEsquecerOToken', async () => {
    mockGetStoredToken.mockResolvedValue('ExponentPushToken[abc]');
    const chain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await removerAparelhoAoSair('usuario-1');

    expect(mockFrom).toHaveBeenCalledWith('push_devices');
    expect(chain.eq).toHaveBeenCalledWith('expo_token', 'ExponentPushToken[abc]');
    expect(mockClearStoredToken).toHaveBeenCalledWith('usuario-1');
  });

  it('naoDeveImpedirASaidaQuandoARemocaoFalha', async () => {
    mockGetStoredToken.mockResolvedValue('ExponentPushToken[abc]');
    mockFrom.mockReturnValue(createQueryChain({ data: null, error: { message: 'TypeError: Network request failed' } }));

    await expect(removerAparelhoAoSair('usuario-1')).resolves.toBeUndefined();
    expect(mockClearStoredToken).toHaveBeenCalledWith('usuario-1');
  });

  it('naoDeveIrAoBancoSemTokenGuardado', async () => {
    mockGetStoredToken.mockResolvedValue(null);

    await removerAparelhoAoSair('usuario-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
