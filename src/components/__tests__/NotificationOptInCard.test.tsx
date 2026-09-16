import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { NotificationOptInCard } from '@/components/NotificationOptInCard';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderCartao(papel: 'admin' | 'professor' | 'user', ocupado = false) {
  const onAtivar = jest.fn();
  const onAgoraNao = jest.fn();
  const tela = render(
    <ThemeProvider>
      <NotificationOptInCard papel={papel} ocupado={ocupado} onAtivar={onAtivar} onAgoraNao={onAgoraNao} />
    </ThemeProvider>,
  );
  return { ...tela, onAtivar, onAgoraNao };
}

describe('NotificationOptInCard', () => {
  it('deveExplicarOPorqueConformeOPapelEAtivarSoNoToque', () => {
    const { getByText, getByRole, onAtivar } = renderCartao('user');

    expect(getByText(/vencimento da mensalidade/)).toBeTruthy();
    expect(onAtivar).not.toHaveBeenCalled();
    fireEvent.press(getByRole('button', { name: 'Ativar' }));
    expect(onAtivar).toHaveBeenCalledTimes(1);
  });

  it('deveDispensarComAgoraNao', () => {
    const { getByRole, onAgoraNao } = renderCartao('professor');

    fireEvent.press(getByRole('button', { name: 'Agora não' }));

    expect(onAgoraNao).toHaveBeenCalledTimes(1);
  });

  it('deveFalarDoQueOAdminRecebe', () => {
    const { getByText } = renderCartao('admin');
    expect(getByText(/comprovante para analisar/)).toBeTruthy();
  });
});
