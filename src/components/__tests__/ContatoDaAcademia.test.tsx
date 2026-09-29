import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchContato = jest.fn();

jest.mock('@/services/contato.service', () => ({
  fetchContatoDaAcademia: (...args: unknown[]): unknown => mockFetchContato(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { BlocoDeContato } from '@/components/BlocoDeContato';
import { FalarComAcademiaSheet } from '@/components/FalarComAcademiaSheet';
import { PortalProvider } from '@/components/Portal';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function comTema(elemento: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{elemento}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

let abrirUrl: jest.SpyInstance;

beforeEach(() => {
  mockFetchContato.mockReset();
  abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => {
  abrirUrl.mockRestore();
});

describe('FalarComAcademiaSheet (contrato § 5.4)', () => {
  it('deveAbrirOWhatsappEOEmailPelosLinksDoContrato', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: '5511912345678', email: 'contato@exemplo.com' });
    const { findByRole, getByRole, getByText } = comTema(<FalarComAcademiaSheet visible onClose={jest.fn()} />);

    expect(getByText('Dúvidas sobre aulas, frequência, trocas ou mensalidade.')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'WhatsApp' }));
    fireEvent.press(getByRole('button', { name: 'E-mail' }));

    expect(abrirUrl).toHaveBeenCalledWith('https://wa.me/5511912345678');
    expect(abrirUrl).toHaveBeenCalledWith('mailto:contato@exemplo.com');
  });

  it('deveMostrarSoOBotaoDoQueEstaPreenchido', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: null, email: 'contato@exemplo.com' });
    const { findByRole, queryByRole } = comTema(<FalarComAcademiaSheet visible onClose={jest.fn()} />);

    expect(await findByRole('button', { name: 'E-mail' })).toBeTruthy();
    expect(queryByRole('button', { name: 'WhatsApp' })).toBeNull();
  });

  it('deveMostrarAReservaQuandoNaoHaContato', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: null, email: null });
    const { findByText } = comTema(<FalarComAcademiaSheet visible onClose={jest.fn()} />);

    expect(await findByText('A academia ainda não cadastrou um contato. Procure a recepção.')).toBeTruthy();
  });

  it('deveAvisarETentarDeNovoQuandoOContatoNaoCarrega', async () => {
    mockFetchContato.mockRejectedValueOnce(new Error('Network request failed'));
    mockFetchContato.mockResolvedValueOnce({ whatsapp: '5511912345678', email: null });
    const { findByText, getByRole, findByRole } = comTema(<FalarComAcademiaSheet visible onClose={jest.fn()} />);

    expect(await findByText(/Não foi possível carregar o contato da academia/)).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Tentar de novo' }));

    expect(await findByRole('button', { name: 'WhatsApp' })).toBeTruthy();
  });

  it('deveAvisarNaTelaQuandoOWhatsappNaoAbre', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: '5511912345678', email: null });
    abrirUrl.mockRejectedValue(new Error('No Activity found'));
    const { findByRole, findByText } = comTema(<FalarComAcademiaSheet visible onClose={jest.fn()} />);

    fireEvent.press(await findByRole('button', { name: 'WhatsApp' }));

    expect(await findByText('Não foi possível abrir o WhatsApp.')).toBeTruthy();
  });

  it('naoDeveCarregarOContatoComAFolhaFechada', () => {
    comTema(<FalarComAcademiaSheet visible={false} onClose={jest.fn()} />);
    expect(mockFetchContato).not.toHaveBeenCalled();
  });
});

describe('BlocoDeContato (pedidos negados, § 5.4)', () => {
  it('deveMostrarAFraseEOsBotoes', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: '5511912345678', email: 'contato@exemplo.com' });
    const { getByText, findByRole } = comTema(<BlocoDeContato />);

    expect(getByText('Para mais informações, fale com a academia:')).toBeTruthy();
    expect(await findByRole('button', { name: 'WhatsApp' })).toBeTruthy();
  });

  it('deveMostrarSoAFraseSemContatoCadastrado', async () => {
    mockFetchContato.mockResolvedValue({ whatsapp: null, email: null });
    const { getByText, queryByRole } = comTema(<BlocoDeContato />);

    await waitFor(() => expect(mockFetchContato).toHaveBeenCalled());
    expect(getByText('Para mais informações, fale com a academia:')).toBeTruthy();
    expect(queryByRole('button', { name: 'WhatsApp' })).toBeNull();
    expect(queryByRole('button', { name: 'E-mail' })).toBeNull();
  });
});
