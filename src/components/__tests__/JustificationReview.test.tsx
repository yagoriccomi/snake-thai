import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { JustificationReview } from '@/components/JustificationReview';
import type { JustificationRow } from '@/services/justifications.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

const PENDENTE: JustificationRow = {
  id: 'just-1',
  class_id: 'aula-1',
  user_id: 'aluno-1',
  message: 'Consulta médica',
  proof_provider: 'cloudinary',
  proof_public_id: 'justificativas/aluno-1/aula-1',
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-11-03T12:00:00+00:00',
  updated_at: '2026-11-03T12:00:00+00:00',
};

function renderReview(props: Partial<React.ComponentProps<typeof JustificationReview>> = {}) {
  const onReview = jest.fn();
  const onOpenAttachment = jest.fn();
  const utils = render(
    <ThemeProvider>
      <JustificationReview
        justification={PENDENTE}
        canReview
        busy={false}
        onReview={onReview}
        onOpenAttachment={onOpenAttachment}
        {...props}
      />
    </ThemeProvider>,
  );
  return { ...utils, onReview, onOpenAttachment };
}

describe('JustificationReview', () => {
  it('deveOferecerAprovarERecusarQuandoPendente', () => {
    const { getByLabelText, onReview } = renderReview();

    fireEvent.press(getByLabelText('Aprovar justificativa'));
    fireEvent.press(getByLabelText('Recusar justificativa'));

    expect(onReview).toHaveBeenNthCalledWith(1, 'just-1', 'approved');
    expect(onReview).toHaveBeenNthCalledWith(2, 'just-1', 'rejected');
  });

  it('naoDeveOferecerDecisaoAQuemNaoGerenciaAAula', () => {
    const { queryByLabelText, getByText } = renderReview({ canReview: false });

    expect(getByText('Justificativa em análise')).toBeTruthy();
    expect(queryByLabelText('Aprovar justificativa')).toBeNull();
  });

  it('naoDeveOferecerDecisaoParaJustificativaJaRevisada', () => {
    const { queryByLabelText, getByText } = renderReview({
      justification: { ...PENDENTE, status: 'approved' },
    });

    expect(getByText('Justificativa aprovada')).toBeTruthy();
    expect(queryByLabelText('Recusar justificativa')).toBeNull();
  });

  it('deveAbrirOAnexoSoQuandoExiste', () => {
    const { getByLabelText, onOpenAttachment } = renderReview();
    fireEvent.press(getByLabelText('Ver anexo da justificativa'));
    expect(onOpenAttachment).toHaveBeenCalledWith('just-1');
  });

  it('naoDeveMostrarLinkDeAnexoQuandoAJustificativaESoTexto', () => {
    const { queryByLabelText } = renderReview({
      justification: { ...PENDENTE, proof_provider: null, proof_public_id: null },
    });
    expect(queryByLabelText('Ver anexo da justificativa')).toBeNull();
  });
});
