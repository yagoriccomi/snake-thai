import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchAulas = jest.fn();
const mockFetchMenu = jest.fn();
const mockDeclarar = jest.fn();
const mockSubmitJustification = jest.fn();
const mockAbrirSolicitacao = jest.fn();
const mockPedirTroca = jest.fn();
const mockDesistir = jest.fn();

jest.mock('@/services/aulas.service', () => ({
  fetchAulasDoAluno: (...args: unknown[]): unknown => mockFetchAulas(...args),
  fetchMenuDeAulas: (...args: unknown[]): unknown => mockFetchMenu(...args),
  declararAula: (...args: unknown[]): unknown => mockDeclarar(...args),
  definirMetaSemanal: jest.fn(),
}));
jest.mock('@/services/justifications.service', () => ({
  enviarJustificativa: (...args: unknown[]): unknown => mockSubmitJustification(...args),
}));
jest.mock('@/services/solicitacoes.service', () => ({
  abrirSolicitacao: (...args: unknown[]): unknown => mockAbrirSolicitacao(...args),
}));
jest.mock('@/services/trocas.service', () => ({
  pedirTroca: (...args: unknown[]): unknown => mockPedirTroca(...args),
  desistirDaTroca: (...args: unknown[]): unknown => mockDesistir(...args),
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'aluno-1' } }, profile: { id: 'aluno-1', name: 'Aluno' } }),
}));
jest.mock('@/hooks/useFrequenciaDoAluno', () => ({
  useFrequenciaDoAluno: () => ({ semana: null, mes: null, loading: false, error: null, reload: jest.fn() }),
}));
jest.mock('@/hooks/useAcademySettings', () => ({
  useAcademySettings: () => ({ settings: { class_weekdays: [1, 2, 3, 4, 5, 6] } }),
}));
jest.mock('@/components/FrequencyCard', () => ({ FrequencyCard: () => null }));
jest.mock('@/components/JustificationSheet', () => {
  const { Text } = jest.requireActual('react-native');
  return { JustificationSheet: ({ classTitle }: { classTitle: string }) => <Text>{`Justificar: ${classTitle}`}</Text> };
});
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { AulasDaSemanaScreen } from '@/screens/aulas/AulasDaSemanaScreen';
import { StudentAulasList } from '@/screens/aulas/StudentAulasList';
import { aulaDoAluno } from '@/test-utils/aulaDoAluno';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** Amanhã às 19h: sempre uma aula que ainda não começou. */
function amanha(hora = 19): string {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  data.setHours(hora, 0, 0, 0);
  return data.toISOString();
}

function comTema(elemento: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{elemento}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function navegacao() {
  return { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
}

// As telas montam a semana pelo relógio, e "amanhã" precisa cair nela. Com o
// relógio real, a cota sumia aos domingos (amanhã já é a semana seguinte) e, no
// menu, a SectionList do teste, que só desenha os primeiros itens, deixava as
// aulas de amanhã de fora de quinta a domingo (C8, D22). Só o Date é fixo: os
// timers continuam reais para o waitFor.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date(2026, 8, 29, 12), // uma terça
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  mockFetchAulas.mockReset();
  mockFetchMenu.mockReset().mockResolvedValue([]);
  mockDeclarar.mockReset().mockResolvedValue({ marcadasNaSemana: 1, cota: 3, acimaDaCota: false });
  mockSubmitJustification.mockReset().mockResolvedValue(undefined);
  mockAbrirSolicitacao.mockReset().mockResolvedValue('s-1');
  mockPedirTroca.mockReset().mockResolvedValue('t-1');
  mockDesistir.mockReset().mockResolvedValue(undefined);
});

describe('StudentAulasList (4.4, contrato § 12)', () => {
  it('deveAvisarAcimaDaCotaSemBloquearEDesfazerNoAviso', async () => {
    mockFetchAulas.mockResolvedValue([aulaDoAluno({ class_id: 'a-1', title: 'Treino funcional', date_time: amanha() })]);
    mockDeclarar.mockResolvedValueOnce({ marcadasNaSemana: 4, cota: 3, acimaDaCota: true });
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    fireEvent.press(await tela.findByRole('button', { name: 'Vou: Treino funcional' }));

    expect(
      await tela.findByText('Você marcou 4 aulas nesta semana e seu plano é 3x. Pode ir: fica registrado acima do plano.'),
    ).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(mockDeclarar).toHaveBeenLastCalledWith('a-1', false));
  });

  it('deveGravarAFaltaDoFixoEAbrirAJustificativaQuandoAAulaAceita', async () => {
    mockFetchAulas.mockResolvedValue([
      aulaDoAluno({
        class_id: 'a-1',
        title: 'Muay Thai — Turma Noite',
        date_time: amanha(),
        schedule_mode: 'fixed',
        weekly_target: null,
        origem: 'turma',
        can_justify: true,
      }),
    ]);
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    fireEvent.press(await tela.findByRole('button', { name: 'Não vou' }));

    await waitFor(() => expect(mockDeclarar).toHaveBeenCalledWith('a-1', false));
    expect(await tela.findByText('Justificar: Muay Thai — Turma Noite')).toBeTruthy();
  });

  it('devePedirEuEstavaNaAulaQuandoOBancoAceita', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    mockFetchAulas.mockResolvedValue([
      aulaDoAluno({ class_id: 'a-1', title: 'Muay Thai', date_time: ontem.toISOString(), can_contest: true }),
      aulaDoAluno({ class_id: 'a-2', title: 'Treino antigo', date_time: ontem.toISOString(), can_contest: false }),
    ]);
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    fireEvent.press(await tela.findByRole('button', { name: 'Eu estava na aula: Muay Thai' }));
    expect(tela.queryByRole('button', { name: 'Eu estava na aula: Treino antigo' })).toBeNull();
    fireEvent.changeText(tela.getByPlaceholderText('Conte o que aconteceu.'), 'Cheguei atrasado');
    fireEvent.press(tela.getByRole('button', { name: 'Enviar pedido' }));

    await waitFor(() => expect(mockAbrirSolicitacao).toHaveBeenCalledWith('student_was_present', 'a-1', 'Cheguei atrasado'));
    expect(await tela.findByText('Pedido enviado. Acompanhe a resposta em Meus pedidos.')).toBeTruthy();
  });

  it('deveDesistirDaTrocaComConfirmacao', async () => {
    mockFetchAulas.mockResolvedValue([
      aulaDoAluno({ class_id: 'a-1', title: 'Muay Thai', date_time: amanha(), swap_id: 't-9', can_cancel_swap: true }),
    ]);
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    fireEvent.press(await tela.findByRole('button', { name: 'Desistir da troca: Muay Thai' }));
    const botoes = tela.getAllByRole('button', { name: 'Desistir da troca' });
    fireEvent.press(botoes[botoes.length - 1]!);
    await waitFor(() => expect(mockDesistir).toHaveBeenCalledWith('t-9'));
  });

  it('deveMostrarARecusaDoBancoNaTela', async () => {
    mockFetchAulas.mockResolvedValue([aulaDoAluno({ class_id: 'a-1', title: 'Treino funcional', date_time: amanha() })]);
    mockDeclarar.mockRejectedValue(Object.assign(new Error('Esta aula já começou.'), { name: 'ErroDeFuncao' }));
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    fireEvent.press(await tela.findByRole('button', { name: 'Vou: Treino funcional' }));

    expect(await tela.findByText('Esta aula já começou.')).toBeTruthy();
  });

  it('deveMostrarACotaDaSemanaEAbrirOMenu', async () => {
    mockFetchAulas.mockResolvedValue([
      aulaDoAluno({ class_id: 'a-1', date_time: amanha(), declared_status: 'present', origem: 'marcou' }),
    ]);
    const navigation = navegacao();
    const tela = comTema(<StudentAulasList navigation={navigation as never} />);

    expect(await tela.findByText('cota 3x')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Escolher aulas' }));
    expect(navigation.navigate).toHaveBeenCalledWith('AulasDaSemana');
  });

  it('deveAvisarQuandoAsAulasNaoCarregam', async () => {
    mockFetchAulas.mockRejectedValue(new Error('Network request failed'));
    const tela = comTema(<StudentAulasList navigation={navegacao() as never} />);

    expect(await tela.findByText('Não foi possível carregar as aulas. Verifique sua conexão.')).toBeTruthy();
  });
});

describe('AulasDaSemanaScreen (4.4, contrato § 12.2)', () => {
  function menu() {
    return comTema(
      <AulasDaSemanaScreen
        navigation={navegacao() as never}
        route={{ key: 'AulasDaSemana', name: 'AulasDaSemana' } as never}
      />,
    );
  }

  it('deveTrocarParaEstaEscolhendoAAulaDaSemana', async () => {
    mockFetchMenu.mockResolvedValue([
      aulaDoAluno({ class_id: 'minha', title: 'Treino A', date_time: amanha(10), schedule_mode: 'fixed', origem: 'turma', can_swap_from: true }),
      aulaDoAluno({ class_id: 'nova', title: 'Treino B', date_time: amanha(19), schedule_mode: 'fixed', can_swap_to: true }),
    ]);
    const tela = menu();

    fireEvent.press(await tela.findByRole('button', { name: 'Trocar para esta: Treino B' }));
    fireEvent.press(tela.getByRole('radio'));
    fireEvent.press(tela.getByRole('button', { name: 'Pedir troca' }));
    await waitFor(() => expect(mockPedirTroca).toHaveBeenCalledWith('minha', 'nova', 'once', null));
  });

  it('deveOferecerVouExtraAoFixoEMarcarPelaRpc', async () => {
    mockFetchMenu.mockResolvedValue([
      aulaDoAluno({
        class_id: 'a-9',
        title: 'Treino livre — noite',
        date_time: amanha(),
        audience: 'free',
        schedule_mode: 'fixed',
        weekly_target: null,
        can_mark_extra: true,
      }),
    ]);
    const tela = menu();

    fireEvent.press(await tela.findByRole('button', { name: 'Vou (extra): Treino livre — noite' }));

    await waitFor(() => expect(mockDeclarar).toHaveBeenCalledWith('a-9', true));
    expect(tela.getByText(/Vou \(extra\): aula a mais, sem pedir a ninguém/)).toBeTruthy();
  });

  it('deveBuscarAProximaSemanaAoTrocarDeAba', async () => {
    const tela = menu();
    await waitFor(() => expect(mockFetchMenu).toHaveBeenCalledTimes(1));
    const estaSemana = mockFetchMenu.mock.calls[0]?.[0] as string;

    fireEvent.press(tela.getByRole('tab', { name: 'Próxima semana' }));

    await waitFor(() => expect(mockFetchMenu).toHaveBeenCalledTimes(2));
    const proxima = mockFetchMenu.mock.calls[1]?.[0] as string;
    const dias = (new Date(`${proxima}T12:00:00`).getTime() - new Date(`${estaSemana}T12:00:00`).getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(7);
  });

  it('deveMostrarOsDiasDeAulaMesmoSemAula', async () => {
    const tela = menu();
    // A SectionList renderiza aos poucos; basta o dia de aula vazio aparecer como bloco.
    expect((await tela.findAllByText('Nenhuma aula neste dia.')).length).toBeGreaterThanOrEqual(1);
  });
});
