import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { MAXIMO_DE_AULAS_NO_AVISO, MissedRollCallBanner } from '@/components/MissedRollCallBanner';
import type { MissedRollCall } from '@/services/frequency.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function aula(indice: number): MissedRollCall {
  return {
    classId: `aula-${indice}`,
    title: `Aula ${indice}`,
    dateTimeIso: '2026-11-03T22:00:00+00:00',
    groupId: 'turma-1',
  };
}

function renderBanner(items: MissedRollCall[], onPressItem = jest.fn()) {
  const utils = render(
    <ThemeProvider>
      <MissedRollCallBanner items={items} onPressItem={onPressItem} />
    </ThemeProvider>,
  );
  return { ...utils, onPressItem };
}

describe('MissedRollCallBanner', () => {
  it('naoDeveOcuparEspacoQuandoNaoHaAulasSemChamada', () => {
    const { queryByText } = renderBanner([]);
    expect(queryByText(/sem chamada/)).toBeNull();
  });

  it('deveUsarOSingularParaUmaAula', () => {
    const { getByText } = renderBanner([aula(1)]);
    expect(getByText('1 aula sem chamada este mês')).toBeTruthy();
  });

  it('deveListarAsPrimeirasEResumirORestante', () => {
    const itens = [1, 2, 3, 4, 5].map(aula);
    const { getByText, queryByText } = renderBanner(itens);

    expect(getByText('5 aulas sem chamada este mês')).toBeTruthy();
    expect(getByText('Aula 3')).toBeTruthy();
    expect(queryByText('Aula 4')).toBeNull();
    expect(getByText(`e mais ${itens.length - MAXIMO_DE_AULAS_NO_AVISO}`)).toBeTruthy();
  });

  it('deveAbrirAAulaTocada', () => {
    const itens = [aula(1), aula(2)];
    const { getByText, onPressItem } = renderBanner(itens);

    fireEvent.press(getByText('Aula 2'));
    expect(onPressItem).toHaveBeenCalledWith(itens[1]);
  });
});
