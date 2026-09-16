import { act, renderHook } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

const mockForceNativeCrash = jest.fn();
jest.mock('@/lib/monitoring', () => ({
  monitoringEnvironment: 'production',
  forceNativeCrash: (...args: unknown[]): unknown => mockForceNativeCrash(...args),
}));

import { MARCA_DO_TESTE, useDiagnosticoDeErros } from '@/hooks/useDiagnosticoDeErros';

function botoesDoAlerta(spy: jest.SpyInstance): AlertButton[] {
  return (spy.mock.calls[0]?.[2] ?? []) as AlertButton[];
}

beforeEach(() => {
  mockLogError.mockReset();
  mockForceNativeCrash.mockReset();
});

describe('useDiagnosticoDeErros', () => {
  it('naoDeveExibirDiagnosticoEmProducao', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => useDiagnosticoDeErros('production'));

    act(() => result.current.abrir());

    expect(result.current.visivel).toBe(false);
    expect(alerta).not.toHaveBeenCalled();
  });

  it('deveUsarOAmbienteDoBuildQuandoNadaEInformado', () => {
    const { result } = renderHook(() => useDiagnosticoDeErros());
    expect(result.current.visivel).toBe(false);
  });

  it('deveExibirDiagnosticoEmDevelopmentComAsTresOpcoes', () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { result } = renderHook(() => useDiagnosticoDeErros('development'));

    act(() => result.current.abrir());

    expect(result.current.visivel).toBe(true);
    const botoes = botoesDoAlerta(alerta);
    expect(botoes.map((botao) => botao.text)).toEqual(['Enviar erro de teste', 'Erro de tela', 'Travamento nativo']);

    act(() => botoes[0]?.onPress?.());
    expect(mockLogError).toHaveBeenCalledWith(expect.any(String), new Error(MARCA_DO_TESTE));

    act(() => botoes[1]?.onPress?.());
    expect(result.current.erroDeTela).toBe(true);

    act(() => botoes[2]?.onPress?.());
    expect(mockForceNativeCrash).toHaveBeenCalledTimes(1);
  });
});
