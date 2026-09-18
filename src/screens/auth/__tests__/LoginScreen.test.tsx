import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockSignIn = jest.fn();
const mockContas = jest.fn();

jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock('@/config/contasDeTeste', () => ({ lerContasDeTeste: (): unknown => mockContas() }));

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const CONTAS = [
  { papel: 'admin' as const, rotulo: 'Admin', email: 'adm@snake.com', senha: 'senha-do-seed' },
  { papel: 'professor' as const, rotulo: 'Professor', email: 'professor@snake.com', senha: 'senha-do-seed' },
  { papel: 'aluno' as const, rotulo: 'Aluno', email: 'aluno@snake.com', senha: 'senha-do-seed' },
];

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue(undefined);
});

describe('LoginScreen — atalho de teste', () => {
  it('devePreencherOFormularioComAContaEscolhida', () => {
    mockContas.mockReturnValue(CONTAS);
    const tela = renderTela();

    fireEvent.press(tela.getByRole('tab', { name: 'Professor' }));

    expect(tela.getByLabelText('E-mail').props.value).toBe('professor@snake.com');
    expect(tela.getByLabelText('Senha').props.value).toBe('senha-do-seed');
  });

  it('naoDeveEntrarSozinho', () => {
    // Preencher é conveniência; entrar continua sendo um toque de quem testa.
    mockContas.mockReturnValue(CONTAS);
    const tela = renderTela();

    fireEvent.press(tela.getByRole('tab', { name: 'Aluno' }));

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('naoDeveMostrarOAtalhoQuandoNaoHaContas', () => {
    // É o caso do app de produção, onde lerContasDeTeste devolve lista vazia.
    mockContas.mockReturnValue([]);
    const tela = renderTela();

    expect(tela.queryByText('Atalho de teste — preenche o login do banco local:')).toBeNull();
    expect(tela.queryByRole('tab', { name: 'Admin' })).toBeNull();
    expect(tela.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('deveEntrarComOQueFoiPreenchido', async () => {
    mockContas.mockReturnValue(CONTAS);
    const tela = renderTela();

    fireEvent.press(tela.getByRole('tab', { name: 'Admin' }));
    fireEvent.press(tela.getByRole('button', { name: 'Entrar' }));

    expect(mockSignIn).toHaveBeenCalledWith('adm@snake.com', 'senha-do-seed');
  });
});
