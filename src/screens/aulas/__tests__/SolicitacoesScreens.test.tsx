import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockCaixa = jest.fn();
const mockItens = jest.fn();
const mockMinhas = jest.fn();
const mockDetalhe = jest.fn();
const mockDecidir = jest.fn();
const mockConferir = jest.fn();

jest.mock('@/services/solicitacoes.service', () => ({
  fetchCaixaDeSolicitacoes: (...args: unknown[]): unknown => mockCaixa(...args),
  fetchItensDaSolicitacao: (...args: unknown[]): unknown => mockItens(...args),
  fetchMinhasSolicitacoes: (...args: unknown[]): unknown => mockMinhas(...args),
  fetchSolicitacaoParaDecidir: (...args: unknown[]): unknown => mockDetalhe(...args),
  decidirSolicitacao: (...args: unknown[]): unknown => mockDecidir(...args),
  marcarRetificacaoConferida: (...args: unknown[]): unknown => mockConferir(...args),
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
import { SolicitacoesBotao } from '@/components/SolicitacoesBotao';
import { ItensDaSolicitacaoScreen } from '@/screens/aulas/ItensDaSolicitacaoScreen';
import { MinhasSolicitacoesScreen, rotuloDoPedido } from '@/screens/aulas/MinhasSolicitacoesScreen';
import { SolicitacoesScreen } from '@/screens/aulas/SolicitacoesScreen';
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

const ITEM_PEDIDO = {
  tipo: 'solicitacao',
  id: 's-1',
  classId: 'c-1',
  paymentId: null,
  userId: 'u-1',
  nome: 'Bia',
  titulo: 'Muay Thai',
  quando: '2030-03-10T21:00:00Z',
  criadoEm: '2030-03-11T10:00:00Z',
};

beforeEach(() => {
  mockCaixa.mockReset().mockResolvedValue([
    { categoria: 'faltas_de_alunos', quantidade: 2 },
    { categoria: 'retificacao_de_chamadas', quantidade: 1 },
    { categoria: 'trocas_de_aula', quantidade: 0 },
  ]);
  mockItens.mockReset().mockResolvedValue([ITEM_PEDIDO]);
  mockMinhas.mockReset().mockResolvedValue([]);
  mockDetalhe.mockReset().mockResolvedValue({
    id: 's-1',
    kind: 'student_was_present',
    classId: 'c-1',
    classTitle: 'Muay Thai',
    classDateTime: '2030-03-10T21:00:00Z',
    subjectName: 'Bia',
    texto: 'Cheguei atrasada',
    anexos: 0,
  });
  mockDecidir.mockReset().mockResolvedValue(undefined);
  mockConferir.mockReset().mockResolvedValue(undefined);
});

describe('SolicitacoesScreen (§ 9.3)', () => {
  it('deveListarAsCategoriasNaOrdemEAbrirCadaUma', async () => {
    const navigate = jest.fn();
    const tela = comProvedores(
      <SolicitacoesScreen navigation={{ navigate } as never} route={{ key: 's', name: 'Solicitacoes' } as never} />,
    );
    fireEvent.press(await tela.findByLabelText('Faltas de alunos: 2'));
    expect(navigate).toHaveBeenCalledWith('JustificativasParaRevisar');
    fireEvent.press(tela.getByLabelText('Retificação de chamadas: 1'));
    expect(navigate).toHaveBeenCalledWith('ItensDaSolicitacao', { categoria: 'retificacao_de_chamadas' });
    fireEvent.press(tela.getByText('Meus pedidos'));
    expect(navigate).toHaveBeenCalledWith('MinhasSolicitacoes');
  });

  it('deveMostrarOErroComTentarDeNovo', async () => {
    mockCaixa.mockRejectedValue(new Error('rede'));
    const tela = comProvedores(
      <SolicitacoesScreen navigation={{ navigate: jest.fn() } as never} route={{ key: 's', name: 'Solicitacoes' } as never} />,
    );
    expect(await tela.findByText('Não foi possível carregar as solicitações.')).toBeTruthy();
  });
});

describe('ItensDaSolicitacaoScreen', () => {
  function renderItens(categoria: string) {
    return comProvedores(
      <ItensDaSolicitacaoScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: 'i', name: 'ItensDaSolicitacao', params: { categoria } } as never}
      />,
    );
  }

  it('deveDecidirOPedidoComNotaObrigatoria', async () => {
    const tela = renderItens('retificacao_de_chamadas');
    fireEvent.press(await tela.findByLabelText('Decidir o pedido de Bia'));
    expect(await tela.findByText('"Cheguei atrasada"')).toBeTruthy();
    fireEvent.press(tela.getByText('Aprovar'));
    expect(mockDecidir).not.toHaveBeenCalled();

    fireEvent.changeText(tela.getByPlaceholderText('Ex.: conferido com a recepção.'), 'Vi no tatame');
    fireEvent.press(tela.getByText('Aprovar'));
    await waitFor(() => expect(mockDecidir).toHaveBeenCalledWith('s-1', 'approved', 'Vi no tatame'));
    await waitFor(() => expect(mockItens).toHaveBeenCalledTimes(2));
  });

  it('deveMarcarARetificacaoComoConferida', async () => {
    mockItens.mockResolvedValue([{ ...ITEM_PEDIDO, tipo: 'retificacao_feita', id: 'm-1', nome: 'Rafael' }]);
    const tela = renderItens('retificacao_de_chamadas');
    fireEvent.press(await tela.findByLabelText('Conferido: retificação de Rafael'));
    await waitFor(() => expect(mockConferir).toHaveBeenCalledWith('m-1'));
  });

  it('deveMostrarOVazioDaCategoria', async () => {
    mockItens.mockResolvedValue([]);
    const tela = renderItens('trocas_de_aula');
    expect(await tela.findByText('Nenhuma troca de aula para decidir.')).toBeTruthy();
  });
});

describe('MinhasSolicitacoesScreen (D16, § 5.4)', () => {
  it('deveMostrarOContatoSoNoNegado', async () => {
    mockMinhas.mockResolvedValue([
      { id: 'a', kind: 'teacher_absence', classId: 'c', classTitle: 'Muay Thai', classDateTime: '2030-03-10T21:00:00Z', status: 'rejected', approvedByName: null, createdAt: '' },
      { id: 'b', kind: 'student_was_present', classId: 'c', classTitle: 'Muay Thai', classDateTime: '2030-03-10T21:00:00Z', status: 'approved', approvedByName: 'Ana', createdAt: '' },
    ]);
    const tela = comProvedores(<MinhasSolicitacoesScreen navigation={{} as never} route={{ key: 'm', name: 'MinhasSolicitacoes' } as never} />);
    expect(await tela.findByText('Pedido negado')).toBeTruthy();
    expect(tela.getByText('Pedido aprovado por Ana')).toBeTruthy();
    expect(tela.getAllByText('bloco de contato')).toHaveLength(1);
  });

  it('deveEscreverOEstadoSemDizerQuemNegou', () => {
    expect(rotuloDoPedido({ status: 'pending', approvedByName: null })).toBe('Pedido em análise');
    expect(rotuloDoPedido({ status: 'approved', approvedByName: null })).toBe('Pedido aprovado');
    expect(rotuloDoPedido({ status: 'rejected', approvedByName: 'Ana' })).toBe('Pedido negado');
  });
});

describe('SolicitacoesBotao', () => {
  it('deveMostrarOContadorSoComPendencia', () => {
    const vazio = comProvedores(<SolicitacoesBotao quantidade={0} onPress={jest.fn()} />);
    expect(vazio.getByLabelText('Solicitações')).toBeTruthy();
    vazio.unmount();
    const onPress = jest.fn();
    const cheio = comProvedores(<SolicitacoesBotao quantidade={3} onPress={onPress} />);
    fireEvent.press(cheio.getByLabelText('Solicitações: 3 para decidir'));
    expect(onPress).toHaveBeenCalled();
  });
});
