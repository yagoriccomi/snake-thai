import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DevEnvironmentFrame } from '@/components/DevBanner';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

function renderMoldura(ativo: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <DevEnvironmentFrame ativo={ativo}>
          <Text>Conteúdo do app</Text>
        </DevEnvironmentFrame>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('DevEnvironmentFrame', () => {
  it('deveMostrarAFaixaNoAppDeDesenvolvimento', () => {
    const { getByText, getByLabelText } = renderMoldura(true);

    expect(getByText('DEV · banco local')).toBeTruthy();
    expect(getByLabelText('Aplicativo de desenvolvimento, conectado ao banco local')).toBeTruthy();
    expect(getByText('Conteúdo do app')).toBeTruthy();
  });

  it('naoDeveMostrarNadaAlemDoAppEmProducao', () => {
    const { queryByText, getByText } = renderMoldura(false);

    expect(queryByText('DEV · banco local')).toBeNull();
    expect(getByText('Conteúdo do app')).toBeTruthy();
  });
});
