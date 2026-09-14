import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPickImage = jest.fn();
const mockPickDocument = jest.fn();

jest.mock('@/services/filePicker.service', () => ({
  pickImageProof: (...args: unknown[]): unknown => mockPickImage(...args),
  pickDocumentProof: (...args: unknown[]): unknown => mockPickDocument(...args),
}));

// O serviço real carrega o cliente do Supabase; a folha só precisa do limite
// e das classes de erro que ela reconhece.
jest.mock('@/services/justifications.service', () => {
  class JustificativaInvalidaError extends Error {}
  class AnexoIndisponivelError extends Error {}
  return { JUSTIFICATION_MESSAGE_MAX: 255, JustificativaInvalidaError, AnexoIndisponivelError };
});

import { JustificationSheet } from '@/components/JustificationSheet';
import { JustificativaInvalidaError } from '@/services/justifications.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderSheet(onSubmit = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) {
  const utils = render(
    <ThemeProvider>
      <JustificationSheet visible classTitle="Muay Thai" onClose={onClose} onSubmit={onSubmit} />
    </ThemeProvider>,
  );
  return { ...utils, onSubmit, onClose };
}

function marcarJustificativa(getByRole: ReturnType<typeof render>['getByRole']) {
  fireEvent.press(getByRole('checkbox'));
}

beforeEach(() => {
  mockPickImage.mockReset();
  mockPickDocument.mockReset();
});

describe('JustificationSheet', () => {
  it('naoDeveMostrarOFormularioAntesDeMarcarAcrescentarJustificativa', () => {
    const { getByText, queryByLabelText } = renderSheet();

    expect(getByText('Acrescentar justificativa?')).toBeTruthy();
    expect(queryByLabelText('Mensagem da justificativa')).toBeNull();
    expect(getByText('Fechar')).toBeTruthy();
  });

  it('naoDeveEnviarJustificativaVazia', () => {
    const { getByRole, getByText, onSubmit } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.press(getByText('Enviar justificativa'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('deveContarOsCaracteresContraOLimiteDe255', () => {
    const { getByRole, getByLabelText, getByText } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Mensagem da justificativa'), 'Gripe');
    expect(getByText('5/255')).toBeTruthy();
    expect(getByLabelText('Mensagem da justificativa').props.maxLength).toBe(255);
  });

  it('deveEnviarAMensagemEFecharQuandoDaCerto', async () => {
    const { getByRole, getByLabelText, getByText, onSubmit, onClose } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Mensagem da justificativa'), 'Consulta médica');
    fireEvent.press(getByText('Enviar justificativa'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({ message: 'Consulta médica', attachment: null });
  });

  it('deveIncluirOAnexoEscolhido', async () => {
    const arquivo = { uri: 'file://atestado.jpg', name: 'atestado.jpg', contentType: 'image/jpeg' };
    mockPickImage.mockResolvedValue(arquivo);
    const { getByRole, getByText, findByText, onSubmit } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.press(getByText('Anexar imagem'));
    await findByText('atestado.jpg');
    fireEvent.press(getByText('Enviar justificativa'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '', attachment: arquivo }));
  });

  it('deveMostrarAMensagemDeValidacaoEContinuarAberta', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new JustificativaInvalidaError('Mensagem longa demais.'));
    const { getByRole, getByLabelText, getByText, findByText, onClose } = renderSheet(onSubmit);
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Mensagem da justificativa'), 'x');
    fireEvent.press(getByText('Enviar justificativa'));

    expect(await findByText('Mensagem longa demais.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('naoDeveVazarDetalheTecnicoDeFalhaInesperada', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('JWT expired at 10.0.0.3'));
    const { getByRole, getByLabelText, getByText, findByText, queryByText } = renderSheet(onSubmit);
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Mensagem da justificativa'), 'x');
    fireEvent.press(getByText('Enviar justificativa'));

    expect(await findByText('Não foi possível enviar a justificativa. Tente de novo.')).toBeTruthy();
    expect(queryByText(/JWT/)).toBeNull();
  });
});
