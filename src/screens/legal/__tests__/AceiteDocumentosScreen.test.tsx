import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchCurrent = jest.fn();
const mockAccept = jest.fn();
const mockVerificar = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/services/legalDocuments.service', () => ({
  fetchCurrentLegalDocuments: (...args: unknown[]): unknown => mockFetchCurrent(...args),
  acceptLegalDocuments: (...args: unknown[]): unknown => mockAccept(...args),
}));
jest.mock('@/context/LegalConsentProvider', () => ({
  useLegalConsent: () => ({ verificar: mockVerificar, precisaAceitar: true, status: 'pendente' }),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { ErroDeFuncao } from '@/lib/functionsError';
import { AceiteDocumentosScreen } from '@/screens/legal/AceiteDocumentosScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const POLITICA_NOVA = {
  id: 'politica-2',
  tipo: 'privacy_policy',
  versao: '2.0',
  publicadoEm: '2026-10-01T12:00:00Z',
  conteudo: '# Política de Privacidade\n\n## 1. Novidade\n- push',
  aceitoEm: null,
};
const TERMOS_JA_ACEITOS = {
  id: 'termos-1',
  tipo: 'terms_of_use',
  versao: '1.0',
  publicadoEm: '2026-09-16T12:00:00Z',
  conteudo: '# Termos de Uso',
  aceitoEm: '2026-09-17T12:00:00Z',
};

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <AceiteDocumentosScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchCurrent.mockReset();
  mockAccept.mockReset();
  mockVerificar.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});

describe('AceiteDocumentosScreen', () => {
  it('deveListarSoOQueFaltaAceitarELiberarOBotaoComACaixaMarcada', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA_NOVA, TERMOS_JA_ACEITOS]);
    mockAccept.mockResolvedValue(undefined);
    const tela = renderTela();

    await waitFor(() => expect(tela.getByText('Política de Privacidade')).toBeTruthy());
    expect(tela.getByText('Versão 2.0 · publicada em 01/10/2026')).toBeTruthy();
    expect(tela.queryByText('Termos de Uso')).toBeNull();

    const botao = (): ReturnType<typeof tela.getByRole> => tela.getByRole('button', { name: 'Aceitar e continuar' });
    expect(botao().props.accessibilityState.disabled).toBe(true);

    fireEvent.press(tela.getByLabelText('Li e concordo com a Política de Privacidade.'));
    expect(botao().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(botao());

    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith(['politica-2']));
    await waitFor(() => expect(mockVerificar).toHaveBeenCalled());
  });

  it('deveAbrirOTextoCompletoParaLer', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA_NOVA]);
    const tela = renderTela();

    await waitFor(() => expect(tela.getByText('Política de Privacidade')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Ler a Política de Privacidade, Versão 2.0 · publicada em 01/10/2026'));

    await waitFor(() => expect(tela.getByText('1. Novidade')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Fechar documento'));
  });

  it('deveMostrarARecusaDoBancoERecarregarQuandoAVersaoMudou', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA_NOVA]);
    // É o que `lerErroDoBanco` entrega para o 23514 da função do banco.
    mockAccept.mockRejectedValue(
      new ErroDeFuncao('Os documentos foram atualizados. Leia a versão nova antes de aceitar.', null),
    );
    const tela = renderTela();

    await waitFor(() => expect(tela.getByText('Política de Privacidade')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Li e concordo com a Política de Privacidade.'));
    fireEvent.press(tela.getByRole('button', { name: 'Aceitar e continuar' }));

    await waitFor(() =>
      expect(tela.getByText('Os documentos foram atualizados. Leia a versão nova antes de aceitar.')).toBeTruthy(),
    );
    expect(mockVerificar).not.toHaveBeenCalled();
    await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalledTimes(2));
  });

  it('deveOferecerTentarDeNovoQuandoOsDocumentosNaoCarregam', async () => {
    mockFetchCurrent.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce([POLITICA_NOVA]);
    const tela = renderTela();

    await waitFor(() =>
      expect(tela.getByText('Não foi possível carregar os documentos. Verifique a conexão e tente de novo.')).toBeTruthy(),
    );
    fireEvent.press(tela.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(tela.getByText('Política de Privacidade')).toBeTruthy());
  });

  it('deveSairDaContaQuandoAPessoaNaoConcorda', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA_NOVA]);
    const tela = renderTela();

    fireEvent.press(tela.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('deveLiberarQuandoNadaMaisFaltaAceitar', async () => {
    mockFetchCurrent.mockResolvedValue([TERMOS_JA_ACEITOS]);
    renderTela();
    await waitFor(() => expect(mockVerificar).toHaveBeenCalled());
  });
});
