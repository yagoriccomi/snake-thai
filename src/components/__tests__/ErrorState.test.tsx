import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ErrorState } from '@/components/ErrorState';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ErrorState', () => {
  it('deveAnunciarOErroComoAlertaParaLeitoresDeTela', () => {
    const { getByRole } = renderWithTheme(<ErrorState />);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('deveExibirAMensagemAmigavelRecebida', () => {
    const { getByText } = renderWithTheme(
      <ErrorState message="Não foi possível carregar as mensalidades." />,
    );
    expect(getByText('Não foi possível carregar as mensalidades.')).toBeTruthy();
  });

  it('deveOferecerRecuperacaoQuandoHaOnRetry', () => {
    const onRetry = jest.fn();
    const { getByRole } = renderWithTheme(<ErrorState onRetry={onRetry} />);

    fireEvent.press(getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('naoDeveMostrarBotaoQuandoNaoHaComoRecuperar', () => {
    const { queryByRole } = renderWithTheme(<ErrorState />);
    expect(queryByRole('button')).toBeNull();
  });

  it('naoDeveVazarDetalheTecnicoNaTela', () => {
    // A stack trace pertence ao log estruturado, nunca à interface [#93].
    const { queryByText } = renderWithTheme(
      <ErrorState message="Não foi possível carregar." />,
    );
    expect(queryByText(/at Object|TypeError|stack/i)).toBeNull();
  });
});
