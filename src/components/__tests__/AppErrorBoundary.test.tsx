import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

let deveQuebrar = true;

function TelaQueQuebra(): React.JSX.Element {
  if (deveQuebrar) {
    throw new Error('render quebrou');
  }
  return <Text>Tela de volta</Text>;
}

function Aplicativo(): React.JSX.Element {
  const [aberta, setAberta] = useState(false);
  return aberta ? (
    <TelaQueQuebra />
  ) : (
    <Pressable onPress={() => setAberta(true)}>
      <Text>Abrir</Text>
    </Pressable>
  );
}

beforeEach(() => {
  deveQuebrar = true;
  mockLogError.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('deveMostrarMensagemAmigavelSemDetalheTecnicoERegistrarOErro', () => {
    const { getByText, queryByText } = render(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ThemeProvider>
          <AppErrorBoundary>
            <TelaQueQuebra />
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(getByText('Algo deu errado')).toBeTruthy();
    expect(queryByText(/render quebrou/)).toBeNull();
    expect(mockLogError).toHaveBeenCalledWith('Erro de renderização derrubou a tela', expect.any(Error));
  });

  it('deveChamarResetAoTocarEmTentarDeNovo', () => {
    const { getByText } = render(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ThemeProvider>
          <AppErrorBoundary>
            <TelaQueQuebra />
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    deveQuebrar = false;
    fireEvent.press(getByText('Tentar de novo'));

    expect(getByText('Tela de volta')).toBeTruthy();
  });

  it('naoDeveInterferirQuandoNadaQuebra', () => {
    deveQuebrar = false;
    const { getByText } = render(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ThemeProvider>
          <AppErrorBoundary>
            <Aplicativo />
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    fireEvent.press(getByText('Abrir'));

    expect(getByText('Tela de volta')).toBeTruthy();
    expect(mockLogError).not.toHaveBeenCalled();
  });
});
