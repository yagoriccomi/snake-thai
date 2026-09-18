import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]): unknown => mockSetStringAsync(...args),
}));

const mockSettings = jest.fn();
jest.mock('@/hooks/useAcademySettings', () => ({
  useAcademySettings: (): unknown => ({ settings: mockSettings(), loading: false, error: null }),
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'aluno-1' } } }),
}));
jest.mock('@/lib/api', () => ({ preAquecer: jest.fn() }));
jest.mock('@/services/payments.service', () => ({ submitProof: jest.fn() }));
jest.mock('@/services/filePicker.service', () => ({
  pickImageProof: jest.fn(),
  pickDocumentProof: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PagamentoScreen } from '@/screens/financeiro/PagamentoScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// Primeiro render da tela com a suíte inteira em paralelo passa dos 5 s padrão.
jest.setTimeout(20000);

const ROTA = { params: { paymentId: 'pag-1', dueDate: '2026-09-10' } };
const NAVEGACAO = { goBack: jest.fn() };

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        {/* A tela só usa route.params e navigation.goBack. */}
        <PagamentoScreen
          route={ROTA as never}
          navigation={NAVEGACAO as never}
        />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetStringAsync.mockResolvedValue(undefined);
});

describe('PagamentoScreen — chave PIX', () => {
  it('deveCopiarAChaveCadastradaEConfirmarNaTela', async () => {
    mockSettings.mockReturnValue({ pix_key: '12.345.678/0001-90' });
    const tela = renderTela();

    fireEvent.press(tela.getByRole('button', { name: 'Copiar chave PIX' }));

    await waitFor(() => expect(mockSetStringAsync).toHaveBeenCalledWith('12.345.678/0001-90'));
    await waitFor(() => expect(tela.getByRole('button', { name: 'Chave copiada ✓' })).toBeTruthy());
  });

  it('naoDeveOferecerCopiarQuandoNaoHaChaveCadastrada', () => {
    // Copiar o aviso levaria o aluno a colar texto inútil no app do banco.
    mockSettings.mockReturnValue({ pix_key: null });
    const tela = renderTela();

    expect(tela.queryByRole('button', { name: 'Copiar chave PIX' })).toBeNull();
    expect(tela.getByText('Chave PIX não configurada')).toBeTruthy();
  });

  it('deveAvisarQuandoNaoConseguirCopiar', async () => {
    mockSetStringAsync.mockRejectedValue(new Error('sem área de transferência'));
    mockSettings.mockReturnValue({ pix_key: 'chave@academia.com' });
    const tela = renderTela();

    fireEvent.press(tela.getByRole('button', { name: 'Copiar chave PIX' }));

    await waitFor(() =>
      expect(
        tela.getByText('Não conseguimos copiar. Toque na chave acima e segure para copiar à mão.'),
      ).toBeTruthy(),
    );
  });
});
