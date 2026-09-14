import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FrequencyCard } from '@/components/FrequencyCard';
import type { MonthlyFrequency } from '@/services/frequency.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

const FREQUENCIA: MonthlyFrequency = {
  userId: 'aluno-1',
  referenceMonth: '2026-11-01',
  totalClasses: 12,
  countedClasses: 4,
  attended: 3,
  justified: 0,
  frequencyPercent: 75,
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('FrequencyCard', () => {
  it('deveMostrarPresencaSobreOTotalDoMesEPercentual', () => {
    const { getByText } = renderWithTheme(
      <FrequencyCard frequency={FREQUENCIA} loading={false} onPress={jest.fn()} />,
    );

    // O total é o mês inteiro (12), não só as aulas com chamada (4).
    expect(getByText('3/12')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy();
  });

  it('deveMostrarTracoQuandoAFrequenciaNaoCarregou', () => {
    const { getAllByText } = renderWithTheme(
      <FrequencyCard frequency={null} loading={false} onPress={jest.fn()} />,
    );
    // "0%" seria mentira: o aluno leria que faltou a tudo.
    expect(getAllByText('—')).toHaveLength(2);
  });

  it('deveAbrirOHistoricoAoToque', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <FrequencyCard frequency={FREQUENCIA} loading={false} onPress={onPress} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
