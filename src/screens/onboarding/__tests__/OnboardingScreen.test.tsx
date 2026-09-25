import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchCurrent = jest.fn();
const mockAccept = jest.fn();
const mockFinish = jest.fn();
const mockSaveProfile = jest.fn();
const mockUpdatePassword = jest.fn();
const mockRefreshProfile = jest.fn();
const mockOrdem: string[] = [];

jest.mock('@/services/legalDocuments.service', () => ({
  fetchCurrentLegalDocuments: (...args: unknown[]): unknown => mockFetchCurrent(...args),
  acceptLegalDocuments: (...args: unknown[]): unknown => mockAccept(...args),
}));
jest.mock('@/services/profile.service', () => ({
  saveOnboardingProfile: (...args: unknown[]): unknown => mockSaveProfile(...args),
  finishOnboarding: (...args: unknown[]): unknown => mockFinish(...args),
}));
jest.mock('@/services/auth.service', () => ({
  updatePassword: (...args: unknown[]): unknown => mockUpdatePassword(...args),
}));
interface PerfilDoTeste {
  id: string;
  name: string | null;
  cpf: string | null;
  is_first_login: boolean;
}
/** Professor criado pelo admin: cadastro pronto, só senha e termos. */
const PROFESSOR: PerfilDoTeste = { id: 'professor-1', name: 'Professor Teste', cpf: '52998224725', is_first_login: true };
/** Aluno criado pela academia: nome e CPF vêm no primeiro acesso. */
const ALUNO: PerfilDoTeste = { id: 'aluno-1', name: null, cpf: null, is_first_login: true };
let mockPerfil: PerfilDoTeste = PROFESSOR;
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: mockPerfil.id } },
    profile: mockPerfil,
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
  mockPerfil = PROFESSOR;
  mockSaveProfile.mockImplementation(async () => {
    mockOrdem.push('dados');
  });
  mockFinish.mockImplementation(async () => {
    mockOrdem.push('flag');
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
    // A flag por último: antes da senha, uma troca que falhasse deixaria a senha padrão valendo.
    expect(mockOrdem).toEqual(['aceite', 'senha', 'flag']);
  });

  it('naoDeveConcluirQuandoOAceiteFalha', async () => {
    mockFetchCurrent.mockResolvedValue([POLITICA]);
    mockAccept.mockRejectedValue(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await waitFor(() => expect(tela.getByText('Ler a Política de Privacidade')).toBeTruthy());
    fireEvent.press(tela.getByLabelText('Li e concordo com a Política de Privacidade.'));
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalledTimes(2));
    expect(mockFinish).not.toHaveBeenCalled();
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

function renderizarAluno() {
  mockPerfil = ALUNO;
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <OnboardingScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function alunoChegarAosTermos() {
  const tela = renderizarAluno();
  fireEvent.changeText(tela.getByLabelText('Nome completo'), 'Aluna Teste');
  fireEvent.changeText(tela.getByLabelText('Celular'), '11987654321');
  fireEvent.changeText(tela.getByLabelText('CPF'), '52998224725');
  fireEvent.changeText(tela.getByLabelText('Data de nascimento'), '31012000');
  fireEvent.press(tela.getByRole('button', { name: 'Próximo' }));
  await waitFor(() => expect(tela.getByLabelText('Nova senha')).toBeTruthy());
  fireEvent.changeText(tela.getByLabelText('Nova senha'), SENHA);
  fireEvent.changeText(tela.getByLabelText('Confirmar nova senha'), SENHA);
  fireEvent.press(tela.getByRole('button', { name: 'Próximo' }));
  await waitFor(() => expect(tela.getByRole('button', { name: 'Concluir cadastro' })).toBeTruthy());
  return tela;
}

type Tela = ReturnType<typeof render>;

async function concluir(tela: Tela): Promise<void> {
  await waitFor(() => expect(mockFetchCurrent).toHaveBeenCalled());
  fireEvent.press(tela.getByLabelText('Concordo com os Termos de Uso e a Política de Privacidade (LGPD).'));
  fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));
}

describe('OnboardingScreen — a flag só cai depois da senha (ROADMAP-thai 2.4)', () => {
  beforeEach(() => {
    mockFetchCurrent.mockResolvedValue([]);
  });

  it('naoDeveConcluirOPrimeiroAcessoQuandoATrocaDeSenhaFalha', async () => {
    mockUpdatePassword.mockRejectedValue(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await concluir(tela);

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(tela.getByRole('button', { name: 'Concluir cadastro' })).toBeEnabled());
    // A flag continua true: no próximo login, a pessoa volta a ter de trocar a senha padrão.
    expect(mockFinish).not.toHaveBeenCalled();
    expect(mockRefreshProfile).not.toHaveBeenCalled();
  });

  it('deveMostrarOErroQuandoATrocaDeSenhaFalha', async () => {
    mockUpdatePassword.mockRejectedValue(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await concluir(tela);

    await waitFor(() => expect(tela.getByText(/conex/i)).toBeTruthy());
  });

  it('naoDeveTrocarASenhaDeNovoQuandoSoAConclusaoFalhou', async () => {
    mockFinish.mockRejectedValueOnce(new TypeError('Network request failed'));
    const tela = await chegarAosTermos();

    await concluir(tela);
    await waitFor(() => expect(mockFinish).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(tela.getByRole('button', { name: 'Concluir cadastro' })).toBeEnabled());
    fireEvent.press(tela.getByRole('button', { name: 'Concluir cadastro' }));

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
    // A senha já valia: repetir daria "senha igual" no Supabase e travaria a pessoa.
    expect(mockUpdatePassword).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(2);
  });

  it('naoDeveGravarDadosDeQuemJaNasceuComCadastroCompleto', async () => {
    const tela = await chegarAosTermos();

    await concluir(tela);

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(mockFinish).toHaveBeenCalledWith('professor-1');
  });

  it('deveGravarOsDadosDoAlunoAntesDaSenhaEAFlagPorUltimo', async () => {
    const tela = await alunoChegarAosTermos();

    await concluir(tela);

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled());
    expect(mockOrdem).toEqual(['dados', 'senha', 'flag']);
    expect(mockSaveProfile).toHaveBeenCalledWith('aluno-1', {
      name: 'Aluna Teste',
      cpf: '52998224725',
      phone: '11987654321',
      dob: '2000-01-31',
    });
  });

  it('naoDeveConcluirOAlunoQuandoASenhaFalhaDepoisDosDados', async () => {
    mockUpdatePassword.mockRejectedValue({ message: 'Password should be at least 8 characters', code: 'weak_password' });
    const tela = await alunoChegarAosTermos();

    await concluir(tela);

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalled());
    await waitFor(() => expect(tela.getByRole('button', { name: 'Concluir cadastro' })).toBeEnabled());
    // Os dados ficam gravados, mas a flag continua true: a senha padrão não conta como concluída.
    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
    expect(mockFinish).not.toHaveBeenCalled();
  });
});
