import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn();
const mockFetchPending = jest.fn();
const mockWarn = jest.fn();
const mockAppStateListeners: ((estado: string) => void)[] = [];

jest.mock('@/context/AuthProvider', () => ({ useAuth: (): unknown => mockUseAuth() }));
jest.mock('@/services/legalDocuments.service', () => ({
  fetchPendingLegalDocuments: (...args: unknown[]): unknown => mockFetchPending(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: (...args: unknown[]): unknown => mockWarn(...args),
    error: jest.fn(),
  }),
}));

import { LegalConsentProvider, useLegalConsent } from '@/context/LegalConsentProvider';

const PENDENTE = { id: 'doc-1', tipo: 'privacy_policy', versao: '1.0', publicadoEm: '2026-09-16T15:00:00Z' };

function sessao(primeiroAcesso = false) {
  return {
    session: { user: { id: 'usuario-1' } },
    profile: { id: 'usuario-1', is_first_login: primeiroAcesso },
  };
}

let verificarAgora: () => Promise<void> = async () => undefined;

function Estado(): React.JSX.Element {
  const { status, precisaAceitar, verificar } = useLegalConsent();
  verificarAgora = verificar;
  return <Text>{`${status}|${String(precisaAceitar)}`}</Text>;
}

function renderizar() {
  return render(
    <LegalConsentProvider>
      <Estado />
    </LegalConsentProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchPending.mockReset();
  mockAppStateListeners.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_evento, ouvinte) => {
    mockAppStateListeners.push(ouvinte as (estado: string) => void);
    return { remove: jest.fn() } as never;
  });
});

describe('LegalConsentProvider', () => {
  it('naoDeveConsultarNoPrimeiroAcessoNemSemSessao', async () => {
    mockUseAuth.mockReturnValue(sessao(true));
    const tela = renderizar();
    await act(async () => {
      await Promise.resolve();
    });
    expect(tela.getByText('inativo|false')).toBeTruthy();

    mockUseAuth.mockReturnValue({ session: null, profile: null });
    tela.rerender(
      <LegalConsentProvider>
        <Estado />
      </LegalConsentProvider>,
    );
    expect(tela.getByText('inativo|false')).toBeTruthy();
    expect(mockFetchPending).not.toHaveBeenCalled();
  });

  it('devePedirAceiteQuandoHaVersaoNovaEDeixarDePedirDepoisDeAceitar', async () => {
    mockUseAuth.mockReturnValue(sessao());
    mockFetchPending.mockResolvedValueOnce([PENDENTE]).mockResolvedValueOnce([]);
    const tela = renderizar();

    await waitFor(() => expect(tela.getByText('pendente|true')).toBeTruthy());

    await act(async () => {
      await verificarAgora();
    });
    expect(tela.getByText('em_dia|false')).toBeTruthy();
  });

  it('naoDeveTravarOAppSemRedeEDeveConferirDeNovoAoVoltar', async () => {
    mockUseAuth.mockReturnValue(sessao());
    mockFetchPending.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce([PENDENTE]);
    const tela = renderizar();

    await waitFor(() => expect(tela.getByText('falhou|false')).toBeTruthy());
    expect(mockWarn).toHaveBeenCalledWith(
      'Não foi possível conferir o aceite dos documentos legais',
      expect.any(TypeError),
    );

    await act(async () => {
      mockAppStateListeners.forEach((ouvinte) => ouvinte('active'));
      await Promise.resolve();
    });
    await waitFor(() => expect(tela.getByText('pendente|true')).toBeTruthy());
  });

  it('naoDeveConferirDeNovoAoVoltarQuandoJaEstaEmDia', async () => {
    mockUseAuth.mockReturnValue(sessao());
    mockFetchPending.mockResolvedValue([]);
    const tela = renderizar();
    await waitFor(() => expect(tela.getByText('em_dia|false')).toBeTruthy());

    await act(async () => {
      mockAppStateListeners.forEach((ouvinte) => ouvinte('active'));
      await Promise.resolve();
    });
    expect(mockFetchPending).toHaveBeenCalledTimes(1);
  });
});
