import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PaymentCard } from '@/components/PaymentCard';
import type { PaymentRow } from '@/services/payments.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function makePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'pay-1',
    user_id: 'user-1',
    plan_id: null,
    status: 'open',
    due_date: '2030-12-10',
    reference_month: '2030-12-01',
    // Valor em centavos: 12990 = R$ 129,90.
    amount_cents: 12990,
    paid_at: null,
    proof_provider: null,
    proof_public_id: null,
    proof_storage_path: null,
    proof_url: null,
    created_at: '2030-01-01T00:00:00.000Z',
    updated_at: '2030-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('PaymentCard', () => {
  it('é acionável quando a mensalidade está em aberto', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <PaymentCard item={makePayment({ status: 'open' })} onPress={onPress} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fica desabilitado quando já está pago', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <PaymentCard item={makePayment({ status: 'paid' })} onPress={onPress} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
