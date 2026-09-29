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

import { AVISO_DE_ANEXO_QUE_FALHOU, JustificationSheet } from '@/components/JustificationSheet';
import { PortalProvider } from '@/components/Portal';
import { JustificativaInvalidaError } from '@/services/justifications.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderSheet(onSubmit = jest.fn().mockResolvedValue(undefined), onClose = jest.fn()) {
  const utils = render(
    <ThemeProvider>
      <PortalProvider>
        <JustificationSheet visible classTitle="Muay Thai" onClose={onClose} onSubmit={onSubmit} />
      </PortalProvider>
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
    expect(queryByLabelText('Motivo da falta')).toBeNull();
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

    fireEvent.changeText(getByLabelText('Motivo da falta'), 'Gripe');
    expect(getByText('5/255')).toBeTruthy();
    expect(getByLabelText('Motivo da falta').props.maxLength).toBe(255);
  });

  it('deveEnviarAMensagemEFecharQuandoDaCerto', async () => {
    const { getByRole, getByLabelText, getByText, onSubmit, onClose } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Motivo da falta'), 'Consulta médica');
    fireEvent.press(getByText('Enviar justificativa'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({ message: 'Consulta médica', attachment: null });
  });

  it('deveIncluirOAnexoEscolhido', async () => {
    const arquivo = { uri: 'file://atestado.jpg', name: 'atestado.jpg', contentType: 'image/jpeg' };
    mockPickImage.mockResolvedValue(arquivo);
    const { getByRole, getByLabelText, getByText, findByText, onSubmit } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.press(getByText('Anexar imagem'));
    await findByText('atestado.jpg');
    fireEvent.changeText(getByLabelText('Motivo da falta'), 'Atestado');
    fireEvent.press(getByText('Enviar justificativa'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: 'Atestado', attachment: arquivo }));
  });

  it('naoDeveEnviarSoComOAnexo', async () => {
    mockPickImage.mockResolvedValue({ uri: 'file://a.jpg', name: 'a.jpg', contentType: 'image/jpeg' });
    const { getByRole, getByText, findByText, onSubmit } = renderSheet();
    marcarJustificativa(getByRole);

    fireEvent.press(getByText('Anexar imagem'));
    await findByText('a.jpg');
    fireEvent.press(getByText('Enviar justificativa'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('deveMostrarOAvisoDoAnexoQueFalhouETrocarPorFechar', async () => {
    const onSubmit = jest.fn().mockResolvedValue(AVISO_DE_ANEXO_QUE_FALHOU);
    const { getByRole, getByLabelText, getByText, findByText, queryByText, onClose } = renderSheet(onSubmit);
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Motivo da falta'), 'Atestado');
    fireEvent.press(getByText('Enviar justificativa'));

    expect(await findByText(AVISO_DE_ANEXO_QUE_FALHOU)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(queryByText('Enviar justificativa')).toBeNull();
  });

  it('deveAbrirDiretoNoFormularioQuandoNaoPerguntaSeQuer', () => {
    const { getByLabelText, queryByRole, queryByText, getByText } = render(
      <ThemeProvider>
        <PortalProvider>
          <JustificationSheet
            visible
            titulo="Justificar semana"
            contexto="Semana de 28/09"
            perguntarSeQuer={false}
            permiteAnexo={false}
            onClose={jest.fn()}
            onSubmit={jest.fn()}
          />
        </PortalProvider>
      </ThemeProvider>,
    );
    expect(getByText('Justificar semana')).toBeTruthy();
    expect(queryByRole('checkbox')).toBeNull();
    expect(getByLabelText('Motivo da falta')).toBeTruthy();
    expect(queryByText('Anexar imagem')).toBeNull();
  });

  it('deveMostrarAMensagemDeValidacaoEContinuarAberta', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new JustificativaInvalidaError('Mensagem longa demais.'));
    const { getByRole, getByLabelText, getByText, findByText, onClose } = renderSheet(onSubmit);
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Motivo da falta'), 'x');
    fireEvent.press(getByText('Enviar justificativa'));

    expect(await findByText('Mensagem longa demais.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('naoDeveVazarDetalheTecnicoDeFalhaInesperada', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('JWT expired at 10.0.0.3'));
    const { getByRole, getByLabelText, getByText, findByText, queryByText } = renderSheet(onSubmit);
    marcarJustificativa(getByRole);

    fireEvent.changeText(getByLabelText('Motivo da falta'), 'x');
    fireEvent.press(getByText('Enviar justificativa'));

    expect(await findByText('Não foi possível enviar a justificativa. Tente de novo.')).toBeTruthy();
    expect(queryByText(/JWT/)).toBeNull();
  });
});
