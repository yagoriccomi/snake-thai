import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { RollCallRow } from '@/components/RollCallRow';
import { alunoDaChamada } from '@/test-utils/chamada';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { LinhaDaChamada } from '@/utils/chamada';

function linha(parcial: Parameters<typeof alunoDaChamada>[0] = {}): LinhaDaChamada {
  const aluno = alunoDaChamada(parcial);
  return { userId: aluno.userId, nome: aluno.name ?? '', origem: aluno.origem, aluno };
}

function renderLinha(props: Partial<React.ComponentProps<typeof RollCallRow>> = {}) {
  const onMarcar = jest.fn();
  const utils = render(
    <ThemeProvider>
      <RollCallRow
        linha={linha()}
        marcacao={null}
        selo={null}
        detalhes={[]}
        editada={false}
        editavel
        onMarcar={onMarcar}
        onAbrirFrequencia={jest.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
  return { ...utils, onMarcar };
}

describe('RollCallRow (chamada nova)', () => {
  it('deveMarcarPresencaEFalta', () => {
    const { getByLabelText, onMarcar } = renderLinha();
    fireEvent.press(getByLabelText('Presente: Ana'));
    fireEvent.press(getByLabelText('Falta: Ana'));
    expect(onMarcar.mock.calls).toEqual([
      ['aluno-1', 'present'],
      ['aluno-1', 'absent'],
    ]);
  });

  it('deveMostrarSeloDetalhesEEditada', () => {
    const { getByText } = renderLinha({
      selo: { texto: 'Troca pendente', tom: 'aviso' },
      detalhes: ['Marcar presença aprova a troca.'],
      editada: true,
    });
    expect(getByText('Troca pendente')).toBeTruthy();
    expect(getByText('Marcar presença aprova a troca.')).toBeTruthy();
    expect(getByText('Editada')).toBeTruthy();
  });

  it('naoDeveTerMarcacaoParaQuemTrocouAAula', () => {
    const { queryByLabelText } = renderLinha({ linha: linha({ origem: 'trocou' }) });
    expect(queryByLabelText('Presente: Ana')).toBeNull();
  });

  it('naoDeveMarcarQuandoNaoEditavel', () => {
    const { getByLabelText, onMarcar } = renderLinha({ editavel: false });
    fireEvent.press(getByLabelText('Presente: Ana'));
    expect(onMarcar).not.toHaveBeenCalled();
  });

  it('deveOferecerRetirarSoParaIncluido', () => {
    const onRetirar = jest.fn();
    const { getByLabelText } = renderLinha({ linha: linha({ origem: 'incluido' }), onRetirar });
    fireEvent.press(getByLabelText('Retirar Ana da chamada'));
    expect(onRetirar).toHaveBeenCalledWith('aluno-1');
  });
});
