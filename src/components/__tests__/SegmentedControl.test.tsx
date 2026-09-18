import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { ThemeProvider } from '@/theme/ThemeProvider';

const DUAS: SegmentOption<'routine' | 'event'>[] = [
  { value: 'routine', label: 'Rotina' },
  { value: 'event', label: 'Evento' },
];

const QUATRO: SegmentOption<'pending' | 'open' | 'overdue' | 'paid'>[] = [
  { value: 'pending', label: 'Aprovar (17)' },
  { value: 'open', label: 'Aberto (0)' },
  { value: 'overdue', label: 'Vencidas (21)' },
  { value: 'paid', label: 'Pagas (12)' },
];

function renderizar(children: React.ReactElement) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

function tamanhoDaFonte(elemento: { props: { style: unknown } }): number | undefined {
  const estilos = ([] as unknown[]).concat(elemento.props.style).filter(Boolean) as { fontSize?: number }[];
  return estilos.reduce<number | undefined>((atual, estilo) => estilo.fontSize ?? atual, undefined);
}

describe('SegmentedControl', () => {
  it('deveTrocarOValorAoTocarNoSegmento', () => {
    const aoTrocar = jest.fn();
    const tela = renderizar(<SegmentedControl options={DUAS} value="routine" onChange={aoTrocar} />);

    fireEvent.press(tela.getByRole('tab', { name: 'Evento' }));

    expect(aoTrocar).toHaveBeenCalledWith('event');
  });

  it('naoDeveQuebrarORotuloEmDuasLinhas', () => {
    // O print do usuário mostrava "Vencidas" e "(21)" espremidos em duas linhas.
    const tela = renderizar(<SegmentedControl options={QUATRO} value="pending" onChange={jest.fn()} />);

    const rotulos = tela.UNSAFE_getAllByType(Text);
    expect(rotulos).toHaveLength(4);
    rotulos.forEach((rotulo) => {
      expect(rotulo.props.numberOfLines).toBe(1);
      expect(rotulo.props.adjustsFontSizeToFit).toBe(true);
    });
  });

  it('deveUsarFonteMenorComQuatroSegmentosEManterAMaiorComDois', () => {
    const comQuatro = renderizar(<SegmentedControl options={QUATRO} value="pending" onChange={jest.fn()} />);
    const comDois = renderizar(<SegmentedControl options={DUAS} value="routine" onChange={jest.fn()} />);

    expect(tamanhoDaFonte(comQuatro.UNSAFE_getAllByType(Text)[0])).toBe(12);
    expect(tamanhoDaFonte(comDois.UNSAFE_getAllByType(Text)[0])).toBe(14);
  });

  it('deveLevarORotuloCompletoParaOLeitorDeTela', () => {
    // A fonte pode encolher; o que o TalkBack lê não muda.
    const tela = renderizar(<SegmentedControl options={QUATRO} value="pending" onChange={jest.fn()} />);

    expect(tela.getByRole('tab', { name: 'Vencidas (21)' })).toBeTruthy();
    expect(tela.getByRole('tab', { name: 'Aprovar (17)' }).props.accessibilityState.selected).toBe(true);
  });
});
