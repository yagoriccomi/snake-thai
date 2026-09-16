import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/Button';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { darkColors, lightColors } from '@/theme/colors';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('dispara onPress ao ser tocado', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(<Button title="Entrar" onPress={onPress} />);

    fireEvent.press(getByRole('button', { name: 'Entrar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('não dispara onPress quando desabilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button title="Entrar" onPress={onPress} disabled />,
    );

    fireEvent.press(getByRole('button', { name: 'Entrar' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('varianteDangerDeveUsarACorDeErroDoTema', () => {
    const { getByText } = renderWithTheme(<Button title="Excluir conta" variant="danger" onPress={jest.fn()} />);

    const rotulo = getByText('Excluir conta');
    const estilo = Array.isArray(rotulo.props.style) ? Object.assign({}, ...rotulo.props.style) : rotulo.props.style;
    // O tema do teste segue o sistema; vale a cor de erro de qualquer das duas paletas.
    expect([darkColors.error, lightColors.error]).toContain(estilo.color);
  });
});
