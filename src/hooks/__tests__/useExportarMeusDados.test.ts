import { act, renderHook } from '@testing-library/react-native';
import { Share } from 'react-native';

const mockExportMyData = jest.fn();
jest.mock('@/services/profile.service', () => ({
  exportMyData: (...args: unknown[]): unknown => mockExportMyData(...args),
}));

const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

import { useExportarMeusDados } from '@/hooks/useExportarMeusDados';

beforeEach(() => {
  mockExportMyData.mockReset();
  mockLogError.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useExportarMeusDados', () => {
  it('deveCompartilharOJsonDosDados', async () => {
    mockExportMyData.mockResolvedValue({ perfil: { name: 'Aluna' }, pagamentos: [] });
    const compartilhar = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const { result } = renderHook(() => useExportarMeusDados());

    await act(async () => {
      await result.current.exportar();
    });

    expect(compartilhar).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(compartilhar.mock.calls[0]?.[0].message))).toEqual({ perfil: { name: 'Aluna' }, pagamentos: [] });
    expect(result.current.erro).toBeNull();
    expect(result.current.exportando).toBe(false);
  });

  it('deveMostrarErroERegistrarQuandoFalha', async () => {
    mockExportMyData.mockRejectedValue(new TypeError('Network request failed'));
    const compartilhar = jest.spyOn(Share, 'share');
    const { result } = renderHook(() => useExportarMeusDados());

    await act(async () => {
      await result.current.exportar();
    });

    expect(compartilhar).not.toHaveBeenCalled();
    expect(result.current.erro).toMatch(/conexão/);
    expect(mockLogError).toHaveBeenCalled();
  });
});
