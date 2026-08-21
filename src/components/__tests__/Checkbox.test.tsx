import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Checkbox } from '@/components/Checkbox';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Checkbox', () => {
  it('renderiza o estado desmarcado e alterna ao toque', () => {
    const onChange = jest.fn();
    const { getByRole } = renderWithTheme(
      <Checkbox checked={false} onChange={onChange} accessibilityLabel="Aceito">
        <Text>Aceito os termos</Text>
      </Checkbox>,
    );

    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );

    fireEvent.press(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('não dispara onChange quando desabilitado', () => {
    const onChange = jest.fn();
    const { getByRole } = renderWithTheme(
      <Checkbox checked={false} onChange={onChange} disabled accessibilityLabel="Aceito" />,
    );

    fireEvent.press(getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
