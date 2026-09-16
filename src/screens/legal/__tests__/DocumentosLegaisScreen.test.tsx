import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchCurrent = jest.fn();

jest.mock('@/services/legalDocuments.service', () => ({
  fetchCurrentLegalDocuments: (...args: unknown[]): unknown => mockFetchCurrent(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { DocumentosLegaisScreen } from '@/screens/legal/DocumentosLegaisScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// O primeiro render da tela (módulos frios) passa dos 5 s padrão com a suíte
// inteira em paralelo; visto no pre-commit.
jest.setTimeout(20000);

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <DocumentosLegaisScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockFetchCurrent.mockReset();
});

describe('DocumentosLegaisScreen', () => {
  it('deveMostrarATextoEADataDoAceiteEAlternarEntreOsDocumentos', async () => {
    mockFetchCurrent.mockResolvedValue([
      {
        id: 'politica-1',
        tipo: 'privacy_policy',
        versao: '1.0',
        publicadoEm: '2026-09-16T12:00:00Z',
        conteudo: '# Política de Privacidade\n\nTexto da política.',
        aceitoEm: '2026-09-17T12:00:00Z',
      },
      {
        id: 'termos-1',
        tipo: 'terms_of_use',
        versao: '1.1',
        publicadoEm: '2026-09-20T12:00:00Z',
        conteudo: '# Termos de Uso\n\nTexto dos termos.',
        aceitoEm: null,
      },
    ]);
    const tela = renderTela();

    await waitFor(() => expect(tela.getByText('Texto da política.')).toBeTruthy());
    expect(tela.getByText('Você aceitou em 17/09/2026.')).toBeTruthy();

    fireEvent.press(tela.getByRole('tab', { name: 'Termos de Uso' }));
    expect(tela.getByText('Texto dos termos.')).toBeTruthy();
    expect(tela.getByText('Versão 1.1 · publicada em 20/09/2026')).toBeTruthy();
    expect(tela.getByText('Você ainda não aceitou esta versão.')).toBeTruthy();
  });

  it('deveAvisarQuandoNadaFoiPublicado', async () => {
    mockFetchCurrent.mockResolvedValue([]);
    const tela = renderTela();
    await waitFor(() =>
      expect(tela.getByText('A academia ainda não publicou a Política de Privacidade e os Termos de Uso no app.')).toBeTruthy(),
    );
    expect(tela.queryByRole('tab')).toBeNull();
  });

  it('deveMostrarErroComTentarDeNovo', async () => {
    mockFetchCurrent.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce([]);
    const tela = renderTela();

    await waitFor(() =>
      expect(tela.getByText('Não foi possível carregar os documentos. Verifique a conexão e tente de novo.')).toBeTruthy(),
    );
    fireEvent.press(tela.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalledTimes(2));
  });
});
