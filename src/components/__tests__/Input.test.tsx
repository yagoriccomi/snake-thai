import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Input } from '@/components/Input';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Input — alternância de visibilidade da senha', () => {
  it('deveNascerOcultandoOTextoEmCampoDeSenha', () => {
    const { getByLabelText } = renderWithTheme(
      <Input label="Senha" secureTextEntry value="segredo" onChangeText={jest.fn()} />,
    );

    expect(getByLabelText('Senha').props.secureTextEntry).toBe(true);
    expect(getByLabelText('Mostrar senha')).toBeTruthy();
  });

  it('deveRevelarOTextoAoTocarNoBotaoEOcultarAoTocarDeNovo', () => {
    const { getByLabelText } = renderWithTheme(
      <Input label="Senha" secureTextEntry value="segredo" onChangeText={jest.fn()} />,
    );

    fireEvent.press(getByLabelText('Mostrar senha'));
    expect(getByLabelText('Senha').props.secureTextEntry).toBe(false);

    fireEvent.press(getByLabelText('Ocultar senha'));
    expect(getByLabelText('Senha').props.secureTextEntry).toBe(true);
  });

  it('naoDeveExibirOBotaoEmCampoComum', () => {
    const { queryByLabelText } = renderWithTheme(
      <Input label="E-mail" value="a@b.com" onChangeText={jest.fn()} />,
    );

    expect(queryByLabelText('Mostrar senha')).toBeNull();
  });

  it('deveRespeitarShowPasswordToggleFalse', () => {
    const { queryByLabelText } = renderWithTheme(
      <Input
        label="Senha"
        secureTextEntry
        showPasswordToggle={false}
        value="x"
        onChangeText={jest.fn()}
      />,
    );

    expect(queryByLabelText('Mostrar senha')).toBeNull();
  });

  it('deveExibirAMensagemDeErroDeFormaAcessivel', () => {
    const { getByText } = renderWithTheme(
      <Input label="Senha" secureTextEntry error="Senha fraca" onChangeText={jest.fn()} />,
    );

    expect(getByText('Senha fraca')).toBeTruthy();
  });
});
