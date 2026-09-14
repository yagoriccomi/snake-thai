import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PaymentHistoryItem } from '@/components/PaymentHistoryItem';
import type { PaymentRow } from '@/services/payments.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

const ABERTA: PaymentRow = {
  id: 'pag-1',
  user_id: 'aluno-1',
  plan_id: null,
  amount_cents: 10000,
  due_date: '2026-08-10',
  reference_month: '2026-08-01',
  status: 'overdue',
  paid_at: null,
  proof_provider: null,
  proof_public_id: null,
  proof_storage_path: null,
  proof_url: null,
  created_at: '2026-08-01T03:00:00+00:00',
  updated_at: '2026-08-01T03:00:00+00:00',
};

const PAGA_COM_ANEXO: PaymentRow = {
  ...ABERTA,
  status: 'paid',
  paid_at: '2026-08-09T13:00:00+00:00',
  proof_provider: 'cloudinary',
  proof_public_id: 'comprovantes/aluno-1/pag-1',
};

function renderItem(props: Partial<React.ComponentProps<typeof PaymentHistoryItem>> = {}) {
  const handlers = {
    onToggle: jest.fn(),
    onOpenAttachment: jest.fn(),
    onMarkPaid: jest.fn(),
    onMarkUnpaid: jest.fn(),
  };
  const utils = render(
    <ThemeProvider>
      <PaymentHistoryItem payment={ABERTA} expanded={false} busy={false} {...handlers} {...props} />
    </ThemeProvider>,
  );
  return { ...utils, ...handlers };
}

describe('PaymentHistoryItem', () => {
  it('deveMostrarSeTemAnexoMesmoFechado', () => {
    const { getByText, queryByText } = renderItem();
    expect(getByText('Sem anexo')).toBeTruthy();
    expect(queryByText('Marcar como paga')).toBeNull();
  });

  it('deveExpandirAoTocar', () => {
    const { getByLabelText, onToggle } = renderItem();
    fireEvent.press(getByLabelText('Agosto de 2026, Vencida, sem anexo'));
    expect(onToggle).toHaveBeenCalledWith('pag-1');
  });

  it('deveDeixarOAdminMarcarComoPagaSemAnexo', () => {
    const { getByText, queryByText, onMarkPaid } = renderItem({ expanded: true });

    expect(queryByText('Abrir anexo')).toBeNull();
    fireEvent.press(getByText('Marcar como paga'));
    expect(onMarkPaid).toHaveBeenCalledWith(ABERTA);
  });

  it('deveAbrirOAnexoEPermitirDesfazerOPagamento', () => {
    const { getByText, onOpenAttachment, onMarkUnpaid } = renderItem({
      payment: PAGA_COM_ANEXO,
      expanded: true,
    });

    expect(getByText('Com anexo')).toBeTruthy();
    fireEvent.press(getByText('Abrir anexo'));
    fireEvent.press(getByText('Marcar como não paga'));

    expect(onOpenAttachment).toHaveBeenCalledWith(PAGA_COM_ANEXO);
    expect(onMarkUnpaid).toHaveBeenCalledWith(PAGA_COM_ANEXO);
  });
});
