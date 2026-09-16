jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// O polyfill nativo não carrega no Jest; o Node 22 já tem crypto.getRandomValues.
jest.mock('react-native-get-random-values', () => ({}));

const mockChavesSeguras = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockChavesSeguras.set(chave, valor);
  }),
  getItemAsync: jest.fn(async (chave: string) => mockChavesSeguras.get(chave) ?? null),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockChavesSeguras.delete(chave);
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { largeSecureStore } from '@/lib/secureStorage';

beforeEach(async () => {
  await AsyncStorage.clear();
  mockChavesSeguras.clear();
});

describe('largeSecureStore', () => {
  it('deveDevolverOValorGuardadoSemDeixarTextoPuroNoAsyncStorage', async () => {
    const valor = JSON.stringify({ marcacoes: { 'aluno-1': 'present' } });

    await largeSecureStore.setItem('rollcall_draft.u.a', valor);

    expect(await largeSecureStore.getItem('rollcall_draft.u.a')).toBe(valor);
    expect(await AsyncStorage.getItem('rollcall_draft.u.a')).not.toContain('present');
  });

  it('listKeysDeveDevolverSoAsChavesComOPrefixo', async () => {
    await largeSecureStore.setItem('rollcall_draft.u.a', '{}');
    await largeSecureStore.setItem('rollcall_draft.u.b', '{}');
    await largeSecureStore.setItem('sb-projeto-auth-token', '{}');

    const chaves = await largeSecureStore.listKeys('rollcall_draft.');

    expect(chaves.sort()).toEqual(['rollcall_draft.u.a', 'rollcall_draft.u.b']);
  });

  it('removeItemDeveApagarOCiphertextEAChave', async () => {
    await largeSecureStore.setItem('rollcall_draft.u.a', '{}');

    await largeSecureStore.removeItem('rollcall_draft.u.a');

    expect(await AsyncStorage.getItem('rollcall_draft.u.a')).toBeNull();
    expect(mockChavesSeguras.has('rollcall_draft.u.a')).toBe(false);
  });
});
