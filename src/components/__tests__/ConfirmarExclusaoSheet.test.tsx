import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmarExclusaoSheet } from '@/components/ConfirmarExclusaoSheet';
import { PortalProvider } from '@/components/Portal';
import { ErroDeFuncao } from '@/lib/functionsError';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

type Props = Partial<React.ComponentProps<typeof ConfirmarExclusaoSheet>>;

function renderFolha(props: Props = {}) {
  const onConfirmar = props.onConfirmar ?? jest.fn().mockResolvedValue(undefined);
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <ConfirmarExclusaoSheet
            visible
            onClose={jest.fn()}
            modo="titular"
            mensalidadesEmAberto={0}
            {...props}
            onConfirmar={onConfirmar}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  const botao = () => tela.getByRole('button', { name: 'Excluir conta' });
  return { ...tela, onConfirmar, botao };
}

describe('ConfirmarExclusaoSheet', () => {
  it('deveManterOBotaoDesabilitadoSemAPalavraDeConfirmacao', () => {
    const { botao, getByLabelText } = renderFolha({ modo: 'administrador' });

    expect(botao().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByLabelText('Digite EXCLUIR para confirmar'), 'excluir');
    expect(botao().props.accessibilityState.disabled).toBe(false);
  });

  it('noModoTitularDeveExigirTambemASenha', () => {
    const { botao, getByLabelText } = renderFolha();

    fireEvent.changeText(getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    expect(botao().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByLabelText('Sua senha atual'), 'Senha@123');
    expect(botao().props.accessibilityState.disabled).toBe(false);
  });

  it('deveConfirmarUmaUnicaVezComASenha', async () => {
    let concluir: () => void = () => undefined;
    const onConfirmar = jest.fn(() => new Promise<void>((resolve) => { concluir = resolve; }));
    const { botao, getByLabelText } = renderFolha({ onConfirmar });
    fireEvent.changeText(getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    fireEvent.changeText(getByLabelText('Sua senha atual'), 'Senha@123');

    fireEvent.press(botao());
    fireEvent.press(botao());

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).toHaveBeenCalledWith('Senha@123');
    await act(async () => {
      concluir();
    });
  });

  it('deveMostrarOErroDoServidorEContinuarAberta', async () => {
    const onConfirmar = jest.fn().mockRejectedValue(new ErroDeFuncao('Senha incorreta', 401));
    const { botao, getByLabelText, getByText } = renderFolha({ onConfirmar });
    fireEvent.changeText(getByLabelText('Digite EXCLUIR para confirmar'), 'EXCLUIR');
    fireEvent.changeText(getByLabelText('Sua senha atual'), 'errada');

    fireEvent.press(botao());

    await waitFor(() => expect(getByText('Senha incorreta')).toBeTruthy());
    expect(getByText('Excluir minha conta')).toBeTruthy();
  });

  it('deveAvisarQueExcluirNaoQuitaMensalidadesEmAberto', () => {
    const { getByText, queryByLabelText } = renderFolha({ modo: 'administrador', nome: 'Aluna Teste', mensalidadesEmAberto: 2 });

    expect(getByText('Excluir a conta de Aluna Teste')).toBeTruthy();
    expect(getByText(/2 mensalidades em aberto/)).toBeTruthy();
    expect(queryByLabelText('Sua senha atual')).toBeNull();
  });
});
