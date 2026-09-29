import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockMinhas = jest.fn();
const mockParaRevisar = jest.fn();
const mockReenviar = jest.fn();
const mockDecidir = jest.fn();
const mockUrlDoAnexo = jest.fn();

jest.mock('@/services/justifications.service', () => {
  class JustificativaInvalidaError extends Error {}
  class AnexoIndisponivelError extends Error {}
  return {
    JUSTIFICATION_MESSAGE_MAX: 255,
    JustificativaInvalidaError,
    AnexoIndisponivelError,
    fetchMinhasJustificativas: (...args: unknown[]): unknown => mockMinhas(...args),
    fetchJustificativasParaRevisar: (...args: unknown[]): unknown => mockParaRevisar(...args),
    reenviarJustificativa: (...args: unknown[]): unknown => mockReenviar(...args),
    decidirJustificativa: (...args: unknown[]): unknown => mockDecidir(...args),
    fetchJustificationAttachmentUrl: (...args: unknown[]): unknown => mockUrlDoAnexo(...args),
  };
});
jest.mock('@/services/filePicker.service', () => ({ pickImageProof: jest.fn(), pickDocumentProof: jest.fn() }));
jest.mock('@/components/BlocoDeContato', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BlocoDeContato: () => <Text>bloco de contato</Text> };
});
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { JustificativasParaRevisarScreen } from '@/screens/aulas/JustificativasParaRevisarScreen';
import { MinhasJustificativasScreen } from '@/screens/aulas/MinhasJustificativasScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function comProvedores(tela: React.JSX.Element) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{tela}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const PROPS = { navigation: { navigate: jest.fn() } as never, route: { key: 'j', name: 'x' } as never };

const MINHA = {
  id: 'j-1',
  scope: 'week' as const,
  classId: null,
  classTitle: null,
  classDateTime: null,
  weekStart: '2026-09-21',
  message: 'Viagem a trabalho',
  hasAttachment: false,
  status: 'rejected' as const,
  attempt: 1,
  approvedByName: null,
  canResend: true,
  resendUntil: '2026-10-05T15:00:00Z',
  createdAt: '2026-09-28T12:00:00Z',
};

const PARA_REVISAR = {
  id: 'j-2',
  scope: 'week' as const,
  userId: 'u-1',
  studentName: 'Bia',
  classId: null,
  classTitle: null,
  classDateTime: null,
  weekStart: '2026-09-21',
  message: 'Gripe',
  hasAttachment: true,
  attempt: 2,
  createdAt: '2026-09-28T12:00:00Z',
};

beforeEach(() => {
  mockMinhas.mockReset().mockResolvedValue([MINHA]);
  mockParaRevisar.mockReset().mockResolvedValue([PARA_REVISAR]);
  mockReenviar.mockReset().mockResolvedValue(undefined);
  mockDecidir.mockReset().mockResolvedValue(undefined);
  mockUrlDoAnexo.mockReset();
});

describe('MinhasJustificativasScreen (§ 3, D42)', () => {
  it('deveMostrarOPrazoEReenviar', async () => {
    const tela = comProvedores(<MinhasJustificativasScreen {...PROPS} />);
    expect(await tela.findByText('Justificativa negada · você pode reenviar até 05/10')).toBeTruthy();
    expect(tela.getByText('Semana de 21/09')).toBeTruthy();

    fireEvent.press(tela.getByText('Reenviar'));
    fireEvent.changeText(tela.getByLabelText('Motivo da falta'), 'Segue o comprovante da viagem');
    fireEvent.press(tela.getByText('Enviar justificativa'));

    await waitFor(() => expect(mockReenviar).toHaveBeenCalledWith('j-1', 'Segue o comprovante da viagem'));
    await waitFor(() => expect(mockMinhas).toHaveBeenCalledTimes(2));
  });

  it('deveMostrarOContatoNaSegundaNegadaSemReenvio', async () => {
    mockMinhas.mockResolvedValue([{ ...MINHA, attempt: 2, canResend: false, resendUntil: null }]);
    const tela = comProvedores(<MinhasJustificativasScreen {...PROPS} />);
    expect(await tela.findByText('bloco de contato')).toBeTruthy();
    expect(tela.queryByText('Reenviar')).toBeNull();
  });

  it('deveMostrarVazioEErro', async () => {
    mockMinhas.mockResolvedValue([]);
    const vazio = comProvedores(<MinhasJustificativasScreen {...PROPS} />);
    expect(await vazio.findByText('Nenhuma justificativa')).toBeTruthy();
    vazio.unmount();

    mockMinhas.mockRejectedValue(new Error('rede'));
    const erro = comProvedores(<MinhasJustificativasScreen {...PROPS} />);
    expect(await erro.findByText('Não foi possível carregar as suas justificativas.')).toBeTruthy();
  });
});

describe('JustificativasParaRevisarScreen (§ 9.1, D15)', () => {
  it('deveExigirANotaParaDecidir', async () => {
    const tela = comProvedores(<JustificativasParaRevisarScreen {...PROPS} />);
    expect(await tela.findByText('Bia')).toBeTruthy();
    expect(tela.getByText('2ª tentativa')).toBeTruthy();

    fireEvent.press(tela.getByLabelText('Revisar a justificativa de Bia'));
    fireEvent.press(tela.getByText('Negar'));
    expect(mockDecidir).not.toHaveBeenCalled();

    fireEvent.changeText(tela.getByLabelText('Nota da decisão (obrigatória)'), 'Sem comprovante');
    fireEvent.press(tela.getByText('Negar'));
    await waitFor(() => expect(mockDecidir).toHaveBeenCalledWith('j-2', 'rejected', 'Sem comprovante'));
    await waitFor(() => expect(mockParaRevisar).toHaveBeenCalledTimes(2));
  });

  it('deveMostrarARecusaDoBancoNaFolha', async () => {
    mockDecidir.mockRejectedValue({ name: 'ErroDeFuncao', message: 'Esta justificativa já foi decidida.' });
    const tela = comProvedores(<JustificativasParaRevisarScreen {...PROPS} />);
    fireEvent.press(await tela.findByLabelText('Revisar a justificativa de Bia'));
    fireEvent.changeText(tela.getByLabelText('Nota da decisão (obrigatória)'), 'Ok');
    fireEvent.press(tela.getByText('Aprovar'));
    expect(await tela.findByText('Esta justificativa já foi decidida.')).toBeTruthy();
  });

  it('deveAbrirOAnexoEAvisarQuandoFalha', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUrlDoAnexo.mockResolvedValueOnce({ url: 'https://res.cloudinary.com/snake/assinada', paginas: 1, pagina: 1 });
    const tela = comProvedores(<JustificativasParaRevisarScreen {...PROPS} />);
    fireEvent.press(await tela.findByLabelText('Ver o anexo da justificativa de Bia'));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://res.cloudinary.com/snake/assinada'));

    mockUrlDoAnexo.mockResolvedValueOnce({ url: 'http://outro-lugar.io/x', paginas: 1, pagina: 1 });
    fireEvent.press(tela.getByLabelText('Ver o anexo da justificativa de Bia'));
    expect(await tela.findByText('Erro interno: Endereço de anexo inesperado.')).toBeTruthy();
    expect(abrir).toHaveBeenCalledTimes(1);

    mockUrlDoAnexo.mockRejectedValueOnce(new TypeError('Network request failed'));
    fireEvent.press(tela.getByLabelText('Ver o anexo da justificativa de Bia'));
    expect(await tela.findByText('Falha de conexão. Verifique sua internet e tente novamente.')).toBeTruthy();
    abrir.mockRestore();
  });

  it('deveMostrarVazio', async () => {
    mockParaRevisar.mockResolvedValue([]);
    const tela = comProvedores(<JustificativasParaRevisarScreen {...PROPS} />);
    expect(await tela.findByText('Nada para revisar')).toBeTruthy();
  });
});
