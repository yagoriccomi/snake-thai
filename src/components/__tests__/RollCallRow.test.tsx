import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { RollCallRow } from '@/components/RollCallRow';
import { ThemeProvider } from '@/theme/ThemeProvider';

const ALUNO = { id: 'aluno-1', name: 'Ana Souza' };

type Props = React.ComponentProps<typeof RollCallRow>;

function renderRow(props: Partial<Props> = {}) {
  const handlers = {
    onMarcar: jest.fn(),
    onAbrirHistorico: jest.fn(),
    onRevisar: jest.fn(),
    onAbrirAnexo: jest.fn(),
  };
  const utils = render(
    <ThemeProvider>
      <RollCallRow
        student={ALUNO}
        marcacao={null}
        declarado={undefined}
        frequencia={undefined}
        justificativa={undefined}
        editavel
        podeRevisar
        revisando={false}
        {...handlers}
        {...props}
      />
    </ThemeProvider>,
  );
  return { ...utils, ...handlers };
}

describe('RollCallRow', () => {
  it('deveAvisarAMarcacaoSemGravarNada', () => {
    const { getByLabelText, onMarcar } = renderRow();
    fireEvent.press(getByLabelText('Presente: Ana Souza'));
    expect(onMarcar).toHaveBeenCalledWith('aluno-1', 'present');
  });

  it('deveIndicarQualSimboloEstaSelecionado', () => {
    const { getByLabelText } = renderRow({ marcacao: 'absent' });

    expect(getByLabelText('Falta: Ana Souza').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(getByLabelText('Presente: Ana Souza').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('naoDeveMarcarQuandoNaoEditavel', () => {
    const { getByLabelText, onMarcar } = renderRow({ editavel: false });
    fireEvent.press(getByLabelText('Falta: Ana Souza'));
    expect(onMarcar).not.toHaveBeenCalled();
  });

  it('deveAbrirOHistoricoAoTocarNoNome', () => {
    const { getByLabelText, onAbrirHistorico } = renderRow();
    fireEvent.press(getByLabelText('Frequência de Ana Souza'));
    expect(onAbrirHistorico).toHaveBeenCalledWith(ALUNO);
  });
});
