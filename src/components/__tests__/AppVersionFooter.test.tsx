import React from 'react';
import { render } from '@testing-library/react-native';

import { AppVersionFooter } from '@/components/AppVersionFooter';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockConstants: { expoConfig: unknown } = { expoConfig: null };

jest.mock('expo-constants', () => ({
  __esModule: true,
  get default() {
    return mockConstants;
  },
}));

jest.mock('@/lib/logger', () => {
  const warn = jest.fn();
  return { createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn, error: jest.fn() }), mockWarn: warn };
});

const { mockWarn } = jest.requireMock('@/lib/logger') as { mockWarn: jest.Mock };

function renderRodape() {
  return render(
    <ThemeProvider>
      <AppVersionFooter />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockWarn.mockClear();
});

describe('AppVersionFooter', () => {
  it('deveExibirAVersaoInstaladaComRotuloParaOLeitorDeTela', () => {
    mockConstants.expoConfig = { version: '1.7.0', android: { versionCode: 1007000 } };

    const { getByText, getByLabelText } = renderRodape();

    expect(getByText('Versão 1.7.0 (1007000)')).toBeTruthy();
    expect(getByLabelText('Versão do aplicativo 1.7.0, código 1007000')).toBeTruthy();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('deveAvisarNaTelaERegistrarQuandoOBuildNaoTemVersao', () => {
    mockConstants.expoConfig = null;

    const { getByText } = renderRodape();

    expect(getByText('Versão indisponível')).toBeTruthy();
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
});
