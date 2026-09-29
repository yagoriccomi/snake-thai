import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FrequencyCard } from '@/components/FrequencyCard';
import { mesDeFrequencia, semanaDeFrequencia } from '@/test-utils/frequencia';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('FrequencyCard (contrato § 3)', () => {
  it('deveMostrarSemanaEMesComPercentualEContagem', () => {
    const { getByText } = renderWithTheme(
      <FrequencyCard semana={semanaDeFrequencia()} mes={mesDeFrequencia()} loading={false} error={null} onPress={jest.fn()} />,
    );
    expect(getByText('Semana')).toBeTruthy();
    expect(getByText('150%')).toBeTruthy();
    expect(getByText('3 de 2')).toBeTruthy();
    expect(getByText('Mês')).toBeTruthy();
    expect(getByText('37,5%')).toBeTruthy();
    expect(getByText('3 de 8')).toBeTruthy();
  });

  it('deveFalarDeMetaNoAVontade', () => {
    const { getByText } = renderWithTheme(
      <FrequencyCard
        semana={semanaDeFrequencia({ scheduleMode: 'unlimited' })}
        mes={mesDeFrequencia({ scheduleMode: 'unlimited' })}
        loading={false}
        error={null}
        onPress={jest.fn()}
      />,
    );
    expect(getByText('Meta da semana')).toBeTruthy();
    expect(getByText('Meta do mês')).toBeTruthy();
  });

  it('deveMostrarTracoComEsperadoZero', () => {
    const { getAllByText } = renderWithTheme(
      <FrequencyCard
        semana={semanaDeFrequencia({ expected: 0, attended: 0, frequencyPercent: null })}
        mes={mesDeFrequencia({ expected: 0, attended: 0, frequencyPercent: null })}
        loading={false}
        error={null}
        onPress={jest.fn()}
      />,
    );
    // "0%" seria mentira: sem aula esperada, não houve falta.
    expect(getAllByText('—')).toHaveLength(2);
  });

  it('deveMostrarOErroEmVezDeNumerosInventados', () => {
    const { getByText, queryByText } = renderWithTheme(
      <FrequencyCard semana={null} mes={null} loading={false} error="Não foi possível carregar a frequência." onPress={jest.fn()} />,
    );
    expect(getByText('Não foi possível carregar a frequência.')).toBeTruthy();
    expect(queryByText('0%')).toBeNull();
  });

  it('deveAbrirATelaFrequenciaAoToque', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <FrequencyCard semana={semanaDeFrequencia()} mes={mesDeFrequencia()} loading={false} error={null} onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
