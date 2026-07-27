import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '@/components/Button';
import { ThemeProvider } from '@/theme/ThemeProvider';

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
});
