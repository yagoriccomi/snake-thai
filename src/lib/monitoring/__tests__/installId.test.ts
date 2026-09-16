jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-get-random-values', () => ({}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { _esquecerIdEmMemoria, gerarUuidV4, obterIdDeInstalacao } from '@/lib/monitoring/installId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(async () => {
  await AsyncStorage.clear();
  _esquecerIdEmMemoria();
});

describe('id de instalação', () => {
  it('deveGerarUuidV4Valido', () => {
    const ids = new Set(Array.from({ length: 50 }, gerarUuidV4));
    expect(ids.size).toBe(50);
    ids.forEach((id) => expect(id).toMatch(UUID_V4));
  });

  it('deveReutilizarOMesmoIdEntreChamadasEAberturas', async () => {
    const primeiro = await obterIdDeInstalacao();
    _esquecerIdEmMemoria(); // nova abertura do app

    expect(await obterIdDeInstalacao()).toBe(primeiro);
    expect(primeiro).toMatch(UUID_V4);
  });

  it('deveDevolverNuloQuandoOArmazenamentoFalha', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('indisponível'));
    expect(await obterIdDeInstalacao()).toBeNull();
  });
});
