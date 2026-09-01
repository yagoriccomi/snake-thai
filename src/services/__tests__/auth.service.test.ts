const mockGetSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]): unknown => mockGetSession(...args),
      signInWithPassword: (...args: unknown[]): unknown =>
        mockSignInWithPassword(...args),
      updateUser: (...args: unknown[]): unknown => mockUpdateUser(...args),
    },
  },
}));

import { changeOwnPassword } from '@/services/auth.service';

const EMAIL = 'aluno@exemplo.test';

/** Sessão válida no formato que o supabase-js devolve. */
function sessaoValida() {
  return { data: { session: { user: { email: EMAIL } } }, error: null };
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockSignInWithPassword.mockReset();
  mockUpdateUser.mockReset();
});

describe('changeOwnPassword — reautenticação obrigatória', () => {
  it('naoDeveTrocarASenhaQuandoASenhaAtualEstaErrada', async () => {
    mockGetSession.mockResolvedValue(sessaoValida());
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    await expect(
      changeOwnPassword('senha-errada', 'NovaSenha@2026'),
    ).rejects.toThrow('SENHA_ATUAL_INVALIDA');

    // O ponto central: sem reautenticação NÃO pode haver troca. Se esta linha
    // falhar, um celular desbloqueado é suficiente para tomar a conta.
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('deveReautenticarComOEmailDaSessaoENaoComUmInformadoPeloChamador', async () => {
    mockGetSession.mockResolvedValue(sessaoValida());
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });

    await changeOwnPassword('SenhaAtual@1', 'NovaSenha@2026');

    // Aceitar e-mail de fora permitiria trocar a senha de outra conta.
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: 'SenhaAtual@1',
    });
  });

  it('deveRecusarQuandoNaoHaSessaoValida', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(
      changeOwnPassword('SenhaAtual@1', 'NovaSenha@2026'),
    ).rejects.toThrow('Sessão inválida.');

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('devePropagarOErroQuandoAAtualizacaoFalhaAposReautenticar', async () => {
    mockGetSession.mockResolvedValue(sessaoValida());
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: 'Password should be at least 6 characters' },
    });

    await expect(
      changeOwnPassword('SenhaAtual@1', 'curta'),
    ).rejects.toEqual({ message: 'Password should be at least 6 characters' });
  });

  it('deveGravarANovaSenhaSomenteDepoisDeConfirmarAAtual', async () => {
    const ordem: string[] = [];
    mockGetSession.mockResolvedValue(sessaoValida());
    mockSignInWithPassword.mockImplementation(async () => {
      ordem.push('reautenticou');
      return { data: {}, error: null };
    });
    mockUpdateUser.mockImplementation(async () => {
      ordem.push('atualizou');
      return { data: {}, error: null };
    });

    await changeOwnPassword('SenhaAtual@1', 'NovaSenha@2026');

    expect(ordem).toEqual(['reautenticou', 'atualizou']);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NovaSenha@2026' });
  });
});
