import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetch = jest.fn();
const mockSave = jest.fn();
const mockPreview = jest.fn();

jest.mock('@/services/legalFields.service', () => ({
  fetchLegalFieldValues: (...args: unknown[]): unknown => mockFetch(...args),
  saveLegalFieldValues: (...args: unknown[]): unknown => mockSave(...args),
  previewLegalDocument: (...args: unknown[]): unknown => mockPreview(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { CAMPOS_LEGAIS } from '@/constants/legalFields';
import { ErroDeFuncao } from '@/lib/functionsError';
import { DadosDosTermosScreen } from '@/screens/dados/DadosDosTermosScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// O primeiro render monta 15 campos; com a suíte inteira em paralelo passa dos 5 s.
jest.setTimeout(20000);

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <DadosDosTermosScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Todos preenchidos, menos o CNPJ. */
function valoresQuaseCompletos(): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of CAMPOS_LEGAIS) {
    if (campo.id !== 'cnpj') valores[campo.id] = `valor de ${campo.id}`;
  }
  return valores;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(undefined);
});

describe('DadosDosTermosScreen', () => {
  it('deveDizerQuantosCamposFaltam', async () => {
    mockFetch.mockResolvedValue({});
    const tela = renderTela();

    await waitFor(() =>
      expect(tela.getByText(`Faltam ${CAMPOS_LEGAIS.length} de ${CAMPOS_LEGAIS.length} campos. Sem todos, os documentos não podem ser publicados.`)).toBeTruthy(),
    );
  });

  it('deveAvisarQuandoTudoEstaPreenchido', async () => {
    const completos: Record<string, string> = {};
    CAMPOS_LEGAIS.forEach((campo) => {
      completos[campo.id] = `valor de ${campo.id}`;
    });
    mockFetch.mockResolvedValue(completos);
    const tela = renderTela();

    await waitFor(() =>
      expect(tela.getByText('Tudo preenchido. A equipe técnica já pode publicar os documentos.')).toBeTruthy(),
    );
  });

  it('deveSalvarOQueFoiDigitado', async () => {
    mockFetch.mockResolvedValue(valoresQuaseCompletos());
    const tela = renderTela();
    await waitFor(() => expect(tela.getByLabelText('CNPJ')).toBeTruthy());

    fireEvent.changeText(tela.getByLabelText('CNPJ'), '12.345.678/0001-90');
    fireEvent.press(tela.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(tela.getByText('Dados salvos.')).toBeTruthy());
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ cnpj: '12.345.678/0001-90' }));
  });

  it('deveMostrarAMensagemDoBancoQuandoOValorERecusado', async () => {
    mockFetch.mockResolvedValue({});
    mockSave.mockRejectedValue(new ErroDeFuncao('O valor não pode conter marcador.', null));
    const tela = renderTela();
    await waitFor(() => expect(tela.getByLabelText('CNPJ')).toBeTruthy());

    fireEvent.press(tela.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(tela.getByText('O valor não pode conter marcador.')).toBeTruthy());
  });

  it('deveAbrirAPreviaComALacunaVisivel', async () => {
    mockFetch.mockResolvedValue(valoresQuaseCompletos());
    mockPreview.mockResolvedValue({
      conteudo: '# Termos de Uso\n\nAcademia valor de razao_social, CNPJ {{cnpj}}.',
      faltando: ['cnpj'],
    });
    const tela = renderTela();
    await waitFor(() => expect(tela.getByRole('button', { name: 'Ver Termos de Uso' })).toBeTruthy());

    fireEvent.press(tela.getByRole('button', { name: 'Ver Termos de Uso' }));

    // Salva antes de pedir a prévia: quem monta o texto é o banco.
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    await waitFor(() => expect(tela.getByText('Academia valor de razao_social, CNPJ {{cnpj}}.')).toBeTruthy());
  });

  it('deveExplicarQuePublicarNaoAcontecePorAqui', async () => {
    mockFetch.mockResolvedValue({});
    const tela = renderTela();

    await waitFor(() =>
      expect(
        tela.getByText(/Publicar é passo da equipe técnica, e faz todos os alunos, professores e administradores/),
      ).toBeTruthy(),
    );
  });

  it('deveOferecerTentarDeNovoQuandoACargaFalha', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    const tela = renderTela();

    await waitFor(() =>
      expect(tela.getByText('Não foi possível carregar os dados. Verifique a conexão e tente de novo.')).toBeTruthy(),
    );
  });
});
