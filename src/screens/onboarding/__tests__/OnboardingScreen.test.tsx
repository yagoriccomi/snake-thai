import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchCurrent = jest.fn();
const mockAccept = jest.fn();
const mockFinishStaff = jest.fn();
const mockUpdatePassword = jest.fn();
const mockRefreshProfile = jest.fn();
const mockOrdem: string[] = [];

jest.mock('@/services/legalDocuments.service', () => ({
  fetchCurrentLegalDocuments: (...args: unknown[]): unknown => mockFetchCurrent(...args),
  acceptLegalDocuments: (...args: unknown[]): unknown => mockAccept(...args),
}));
jest.mock('@/services/profile.service', () => ({
  completeProfileOnboarding: jest.fn(),
  finishStaffOnboarding: (...args: unknown[]): unknown => mockFinishStaff(...args),
}));
jest.mock('@/services/auth.service', () => ({
  updatePassword: (...args: unknown[]): unknown => mockUpdatePassword(...args),
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'professor-1' } },
    // Professor criado pelo admin: cadastro pronto, só senha e termos.
    profile: { id: 'professor-1', name: 'Professor Teste', cpf: '52998224725', is_first_login: true },
    refreshProfile: mockRefreshProfile,
  }),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const SENHA = 'Forte#2026abc';

// Cada caso percorre duas etapas do formulário; com a suíte inteira em paralelo,
// o primeiro render da tela passa dos 5 s padrão.
jest.setTimeout(20000);

const POLITICA = {
  id: 'politica-1',
  tipo: 'privacy_policy',
  versao: '1.0',
  publicadoEm: '2026-09-16T12:00:00Z',
  conteudo: '# Política de Privacidade\n\nTexto.',
  aceitoEm: null,
};
const TERMOS = { ...POLITICA, id: 'termos-1', tipo: 'terms_of_use', conteudo: '# Termos de Uso' };

async function chegarAosTermos() {
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <OnboardingScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  fireEvent.changeText(tela.getByLabelText('Nova senha'), SENHA);
  fireEvent.changeText(tela.getByLabelText('Confirmar nova senha'), SENHA);
  fireEvent.press(tela.getByRole('button', { name: 'Próximo' }));
  await waitFor(() => expect(tela.getByRole('button', { name: 'Concluir cadastro' })).toBeTruthy());
  return tela;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchCurrent.mockReset();
  mockOrdem.length = 0;
  mockAccept.mockImplementation(async () => {
    mockOrdem.push('aceite');
  });
  mockFinishStaff.mockImplementation(async () => {
    mockOrdem.push('perfil');
  });
  mockUpdatePassword.mockImplementation(async () => {
    mockOrdem.push('senha');
  });
  mockRefreshProfile.mockResolvedValue(undefined);
});

describe('OnboardingScreen — termos', () => {
  it('deveRegistrarOAceiteDosDocumentosPublicadosAntesDeConcluir', async () => {
    mockFetchCurrent.mockResolvedValue([TERMOS, POLITICA]);
    const tela = await chegarAosTermos();

    await waitFor(() => expect(tela.getByText('Ler a Política de Privacidade')).toBeTruthy());
    expect(tela.getByText('Ler os Termos de Uso')).toBeTruthy();

    fireEvent.press(tela.getByLabelText('Li e concordo com a Política de Privacidade e os Termos de Uso.'));
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockAccept).toHaveBeenCalledWith(['termos-1', 'politica-1']);
    expect(mockOrdem).toEqual(['aceite', 'perfil', 'senha']);
  });

  it('naoDeveConcluirQuandoOAceiteFalha', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA]);
    mockAccept.mockRejectedValue(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await waitFor(() => expect(tela.getByText('Ler a Política de Privacidade')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Li e concordo com a Política de Privacidade.'));
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalledTimes(2));
    expect(mockFinishStaff).not.toHaveBeenCalled();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('deveSeguirComoAntesQuandoNadaFoiPublicado', async () => {
    mockFetchCurrent.mockResolvedValue([]);
    const tela = await chegarAosTermos();

    await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalled());
    fireEvent.press(tela.getByLabelText('Concordo com os Termos de Uso e a Política de Privacidade (LGPD).'));
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('naoDeveBloquearOCadastroQuandoOsDocumentosNaoCarregam', async () => {
    mockFetchCurrent.mockRejectedValue(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await waitFor(() =>
      expect(
        tela.getByText('Não foi possível carregar os documentos agora. Você poderá lê-los e aceitá-los ao entrar no app.'),
      ).toBeTruthy(),
    );
    fireEvent.press(tela.getByLabelText('Concordo com os Termos de Uso e a Política de Privacidade (LGPD).'));
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockAccept).not.toHaveBeenCalled();
  });
});
