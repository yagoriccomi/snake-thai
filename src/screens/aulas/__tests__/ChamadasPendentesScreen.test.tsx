import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetch = jest.fn();
let mockAdmin = false;

jest.mock('@/services/chamada.service', () => ({
  fetchChamadasPendentes: (...args: unknown[]): unknown => mockFetch(...args),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ isAdmin: mockAdmin }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { ChamadasPendentesBotao } from '@/components/ChamadasPendentesBotao';
import { ChamadasPendentesScreen, textoDeDiasEmAberto } from '@/screens/aulas/ChamadasPendentesScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const PENDENTE = {
  classId: 'c-1',
  title: 'Muay Thai — Turma Noite',
  dateTime: '2030-03-08T22:00:00.000Z',
  groupId: 'g-1',
  groupName: 'Turma Noite',
  audience: 'both' as const,
  diasEmAberto: 4,
};

function renderTela() {
  const navigation = { navigate: jest.fn() };
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <ChamadasPendentesScreen navigation={navigation as never} route={{ key: 'p', name: 'ChamadasPendentes' } as never} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...utils, navigation };
}

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue([PENDENTE]);
  mockAdmin = false;
});

describe('ChamadasPendentesScreen (T13)', () => {
  it('deveListarEAbrirAChamada', async () => {
    const { getByText, getByLabelText, navigation } = renderTela();
    await waitFor(() => expect(getByText('Muay Thai — Turma Noite')).toBeTruthy());
    expect(getByText('há 4 dias')).toBeTruthy();
    fireEvent.press(getByLabelText(/^Fazer a chamada de Muay Thai/));
    expect(navigation.navigate).toHaveBeenCalledWith('Frequencia', {
      classId: 'c-1',
      title: 'Muay Thai — Turma Noite',
      groupId: 'g-1',
      canManage: true,
    });
    expect(mockFetch).toHaveBeenCalledWith(true);
  });

  it('deveMostrarTodasSoParaOAdmin', async () => {
    const professor = renderTela();
    await waitFor(() => expect(professor.getByText('Muay Thai — Turma Noite')).toBeTruthy());
    expect(professor.queryByText('Todas')).toBeNull();
    professor.unmount();

    mockAdmin = true;
    const admin = renderTela();
    await waitFor(() => expect(admin.getByText('Todas')).toBeTruthy());
    fireEvent.press(admin.getByText('Todas'));
    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith(false));
  });

  it('deveMostrarVazioEErro', async () => {
    mockFetch.mockResolvedValue([]);
    const vazio = renderTela();
    await waitFor(() => expect(vazio.getByText('Nenhuma chamada pendente')).toBeTruthy());
    vazio.unmount();

    mockFetch.mockRejectedValue(new Error('rede'));
    const erro = renderTela();
    await waitFor(() => expect(erro.getByText('Não foi possível carregar as chamadas pendentes.')).toBeTruthy());
  });

  it('deveEscreverOsDiasEmAberto', () => {
    expect(textoDeDiasEmAberto(0)).toBe('hoje');
    expect(textoDeDiasEmAberto(1)).toBe('há 1 dia');
    expect(textoDeDiasEmAberto(3)).toBe('há 3 dias');
  });
});

describe('ChamadasPendentesBotao', () => {
  it('deveSumirSemPendenteEMostrarAContagem', () => {
    const vazio = render(
      <ThemeProvider>
        <ChamadasPendentesBotao quantidade={0} onPress={jest.fn()} />
      </ThemeProvider>,
    );
    expect(vazio.queryByText('Chamadas pendentes')).toBeNull();
    const onPress = jest.fn();
    const com = render(
      <ThemeProvider>
        <ChamadasPendentesBotao quantidade={3} onPress={onPress} />
      </ThemeProvider>,
    );
    fireEvent.press(com.getByLabelText('Chamadas pendentes: 3'));
    expect(onPress).toHaveBeenCalled();
  });
});
