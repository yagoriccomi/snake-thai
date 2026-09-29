import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockMinhas = jest.fn();
const mockParaDecidir = jest.fn();
const mockDecidir = jest.fn();

jest.mock('@/services/trocas.service', () => ({
  fetchMinhasTrocas: (...args: unknown[]): unknown => mockMinhas(...args),
  fetchTrocasParaDecidir: (...args: unknown[]): unknown => mockParaDecidir(...args),
  decidirTroca: (...args: unknown[]): unknown => mockDecidir(...args),
}));
jest.mock('@/components/BlocoDeContato', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BlocoDeContato: () => <Text>bloco de contato</Text> };
});
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { TrocarAulaSheet } from '@/components/TrocarAulaSheet';
import { MinhasTrocasScreen } from '@/screens/aulas/MinhasTrocasScreen';
import { precisaDeNota, RevisarTrocaScreen } from '@/screens/aulas/RevisarTrocaScreen';
import { aulaDoAluno } from '@/test-utils/aulaDoAluno';
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

const TROCA = {
  id: 't-1',
  kind: 'once',
  studentName: 'Bia',
  fromTitle: 'Muay Thai',
  fromDateTime: '2030-03-10T21:00:00Z',
  fromGroupName: 'Turma A',
  fromStatus: null,
  toTitle: 'Muay Thai',
  toDateTime: '2030-03-12T21:00:00Z',
  toGroupName: 'Turma B',
  toScheduleEndsOn: null,
  isMakeup: false,
  motivoTexto: null,
  anexos: 0,
};

beforeEach(() => {
  mockMinhas.mockReset().mockResolvedValue([]);
  mockParaDecidir.mockReset().mockResolvedValue([TROCA]);
  mockDecidir.mockReset().mockResolvedValue(undefined);
});

describe('TrocarAulaSheet (§ 9.4)', () => {
  const nova = aulaDoAluno({ class_id: 'nova', title: 'Treino B', date_time: '2030-03-12T21:00:00Z', is_recurring: true, schedule_ends_on: '2030-06-30' });
  const minha = aulaDoAluno({ class_id: 'minha', title: 'Treino A', date_time: '2030-03-10T21:00:00Z', can_swap_from: true, can_swap_from_permanent: true });

  it('devePedirAAvulsaEscolhendoAOriginal', async () => {
    const onPedir = jest.fn().mockResolvedValue(undefined);
    const tela = comProvedores(<TrocarAulaSheet nova={nova} aulasDaSemana={[nova, minha]} onClose={jest.fn()} onPedir={onPedir} />);
    expect(tela.getByText('Qual aula sua você quer trocar por esta?')).toBeTruthy();
    fireEvent.press(tela.getByRole('radio'));
    fireEvent.press(tela.getByText('Pedir troca'));
    await waitFor(() => expect(onPedir).toHaveBeenCalledWith('minha', 'once', null));
    expect(await tela.findByText('Pedido de troca enviado. A aula nova fica como Troca pendente até a decisão.')).toBeTruthy();
  });

  it('deveExigirAJustificativaNaPermanente', async () => {
    const onPedir = jest.fn().mockResolvedValue(undefined);
    const tela = comProvedores(<TrocarAulaSheet nova={nova} aulasDaSemana={[nova, minha]} onClose={jest.fn()} onPedir={onPedir} />);
    fireEvent.press(tela.getByText('Permanente'));
    expect(tela.getByText('Este horário termina em 30/06.')).toBeTruthy();
    fireEvent.press(tela.getByRole('radio'));
    fireEvent.press(tela.getByText('Pedir troca'));
    expect(onPedir).not.toHaveBeenCalled();
    fireEvent.changeText(tela.getByLabelText('Por que você precisa mudar de horário? (obrigatório)'), 'Mudei de emprego');
    fireEvent.press(tela.getByText('Pedir troca'));
    await waitFor(() => expect(onPedir).toHaveBeenCalledWith('minha', 'permanent', 'Mudei de emprego'));
  });

  it('deveMostrarARecusaDoBanco', async () => {
    const onPedir = jest.fn().mockRejectedValue({ name: 'ErroDeFuncao', message: 'Esta aula já é sua.' });
    const tela = comProvedores(<TrocarAulaSheet nova={nova} aulasDaSemana={[nova, minha]} onClose={jest.fn()} onPedir={onPedir} />);
    fireEvent.press(tela.getByRole('radio'));
    fireEvent.press(tela.getByText('Pedir troca'));
    expect(await tela.findByText('Esta aula já é sua.')).toBeTruthy();
  });

  it('deveAvisarQuandoNaoHaOriginal', () => {
    const tela = comProvedores(<TrocarAulaSheet nova={{ ...nova, is_recurring: false }} aulasDaSemana={[nova]} onClose={jest.fn()} onPedir={jest.fn()} />);
    expect(tela.getByText('Nenhuma aula sua nesta semana pode ser trocada por esta.')).toBeTruthy();
    expect(tela.queryByText('Permanente')).toBeNull();
  });
});

describe('MinhasTrocasScreen (§ 3)', () => {
  it('deveMostrarOsRotulosEOContatoSoNaNegada', async () => {
    mockMinhas.mockResolvedValue([
      { ...TROCA, status: 'rejected', decidedVia: 'review', approvedByName: null, canCancel: false, createdAt: '' },
      { ...TROCA, id: 't-2', status: 'approved', decidedVia: 'review', approvedByName: 'Ana', canCancel: true, createdAt: '' },
    ]);
    const tela = comProvedores(<MinhasTrocasScreen navigation={{} as never} route={{ key: 'm', name: 'MinhasTrocas' } as never} />);
    expect(await tela.findByText('Troca negada')).toBeTruthy();
    expect(tela.getByText('Troca aprovada por Ana')).toBeTruthy();
    expect(tela.getAllByText('bloco de contato')).toHaveLength(1);
  });

  it('deveMostrarOVazio', async () => {
    const tela = comProvedores(<MinhasTrocasScreen navigation={{} as never} route={{ key: 'm', name: 'MinhasTrocas' } as never} />);
    expect(await tela.findByText('Nenhuma troca')).toBeTruthy();
  });
});

describe('RevisarTrocaScreen (T41)', () => {
  function renderRevisar(goBack = jest.fn()) {
    return comProvedores(
      <RevisarTrocaScreen
        navigation={{ goBack } as never}
        route={{ key: 'r', name: 'RevisarTroca', params: { swapId: 't-1' } } as never}
      />,
    );
  }

  it('deveAprovarAAvulsaSemNotaENegarSoComNota', async () => {
    const goBack = jest.fn();
    const tela = renderRevisar(goBack);
    fireEvent.press(await tela.findByText('Negar'));
    expect(mockDecidir).not.toHaveBeenCalled();
    fireEvent.press(tela.getByText('Aprovar'));
    await waitFor(() => expect(mockDecidir).toHaveBeenCalledWith('t-1', 'approved', ''));
    expect(goBack).toHaveBeenCalled();
  });

  it('deveMostrarAJustificativaDaPermanente', async () => {
    mockParaDecidir.mockResolvedValue([{ ...TROCA, kind: 'permanent', motivoTexto: 'Mudei de emprego', anexos: 1 }]);
    const tela = renderRevisar();
    expect(await tela.findByText('Mudei de emprego')).toBeTruthy();
    expect(tela.getByText('1 anexo (abre quando o servidor novo for publicado)')).toBeTruthy();
  });

  it('deveAvisarQuandoATrocaSaiuDaFila', async () => {
    mockParaDecidir.mockResolvedValue([]);
    const tela = renderRevisar();
    expect(await tela.findByText('Esta troca não está mais pendente, ou não é você quem decide.')).toBeTruthy();
  });

  it('deveSeguirATabelaDaNota', () => {
    expect(precisaDeNota('once', 'approved')).toBe(false);
    expect(precisaDeNota('once', 'rejected')).toBe(true);
    expect(precisaDeNota('permanent', 'approved')).toBe(true);
  });
});
