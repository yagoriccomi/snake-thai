import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { MonthSelector, type MonthOption } from '@/components/MonthSelector';
import { ThemeProvider } from '@/theme/ThemeProvider';

const OPCOES: MonthOption[] = [
  { value: '2026-09-01', label: 'Set/26', accessibilityLabel: 'Setembro de 2026' },
  { value: '2026-08-01', label: 'Ago/26', accessibilityLabel: 'Agosto de 2026', dotColor: '#F87171' },
];

function renderSelector(value: string | null, onChange = jest.fn()) {
  const utils = render(
    <ThemeProvider>
      <MonthSelector options={OPCOES} value={value} onChange={onChange} />
    </ThemeProvider>,
  );
  return { ...utils, onChange };
}

describe('MonthSelector', () => {
  it('deveMarcarOMesSelecionadoParaLeitoresDeTela', () => {
    const { getByLabelText } = renderSelector('2026-08-01');

    expect(getByLabelText('Agosto de 2026').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByLabelText('Setembro de 2026').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('deveAvisarQualMesFoiEscolhido', () => {
    const { getByText, onChange } = renderSelector('2026-09-01');
    fireEvent.press(getByText('Ago/26'));
    expect(onChange).toHaveBeenCalledWith('2026-08-01');
  });
});
