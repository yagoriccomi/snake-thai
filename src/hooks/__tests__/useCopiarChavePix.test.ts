import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]): unknown => mockSetStringAsync(...args),
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

import { useCopiarChavePix } from '@/hooks/useCopiarChavePix';

beforeEach(() => {
  jest.useFakeTimers();
  mockSetStringAsync.mockReset().mockResolvedValue(undefined);
  mockLogError.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useCopiarChavePix', () => {
  it('deveCopiarAChaveEConfirmar', async () => {
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const { result } = renderHook(() => useCopiarChavePix('12.345.678/0001-90'));

    await act(async () => {
      result.current.copiar();
    });

    expect(mockSetStringAsync).toHaveBeenCalledWith('12.345.678/0001-90');
    expect(result.current.estado).toBe('copiada');
    // Quem usa leitor de tela não vê o botão trocar de texto.
    expect(anunciar).toHaveBeenCalledWith('Chave PIX copiada.');
  });

  it('deveVoltarAoEstadoInicialSozinho', async () => {
    const { result } = renderHook(() => useCopiarChavePix('chave-aleatoria'));

    await act(async () => {
      result.current.copiar();
    });
    expect(result.current.estado).toBe('copiada');

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.estado).toBe('ocioso');
  });

  it('naoDeveCopiarQuandoAAcademiaNaoCadastrouAChave', async () => {
    // Copiar o aviso "Chave PIX não configurada" faria o aluno colar lixo no
    // app do banco; melhor não oferecer o botão.
    const { result } = renderHook(() => useCopiarChavePix(null));

    expect(result.current.podeCopiar).toBe(false);
    await act(async () => {
      result.current.copiar();
    });

    expect(mockSetStringAsync).not.toHaveBeenCalled();
  });

  it('naoDeveAceitarChaveSoComEspacos', () => {
    const { result } = renderHook(() => useCopiarChavePix('   '));
    expect(result.current.podeCopiar).toBe(false);
  });

  it('deveCopiarSemOsEspacosDasPontas', async () => {
    const { result } = renderHook(() => useCopiarChavePix('  chave@academia.com  '));

    await act(async () => {
      result.current.copiar();
    });

    expect(mockSetStringAsync).toHaveBeenCalledWith('chave@academia.com');
  });

  it('deveAvisarNaTelaELogarQuandoCopiarFalha', async () => {
    mockSetStringAsync.mockRejectedValue(new Error('clipboard indisponível'));
    const { result } = renderHook(() => useCopiarChavePix('chave-aleatoria'));

    await act(async () => {
      result.current.copiar();
    });

    // Falha silenciosa deixaria o aluno achando que copiou e colar a chave errada.
    expect(result.current.estado).toBe('falhou');
    expect(mockLogError).toHaveBeenCalled();
  });
});
