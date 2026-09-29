import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockSave = jest.fn();
const mockEnd = jest.fn();
const mockContarTrocas = jest.fn();
const mockFetchSchedules = jest.fn();

jest.mock('@/services/schedules.service', () => {
  const real = jest.requireActual('@/services/schedules.service');
  return {
    ...real,
    saveSchedule: (...args: unknown[]): unknown => mockSave(...args),
    endSchedule: (...args: unknown[]): unknown => mockEnd(...args),
    countPermanentSwapsForSchedule: (...args: unknown[]): unknown => mockContarTrocas(...args),
    fetchSchedulesForGroup: (...args: unknown[]): unknown => mockFetchSchedules(...args),
  };
});
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/ProfessorMultiPicker', () => ({ ProfessorMultiPicker: () => null }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => {
  const ReactReal = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    // A grade recarrega no foco; no teste, uma vez ao montar.
    useFocusEffect: (efeito: () => void) => ReactReal.useEffect(efeito, []),
  };
});

import { PortalProvider } from '@/components/Portal';
import { GradeTurmaScreen } from '@/screens/dados/GradeTurmaScreen';
import { HorarioFormScreen } from '@/screens/dados/HorarioFormScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const RESPOSTA = { scheduleId: 'h-1', adjusted: 0, removed: 0, created: 4 };

function comTema(elemento: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{elemento}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function formulario(params: Record<string, unknown>) {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  return comTema(
    <HorarioFormScreen navigation={navigation as never} route={{ key: 'HorarioForm', name: 'HorarioForm', params } as never} />,
  );
}

function preencher(tela: ReturnType<typeof formulario>): void {
  fireEvent.changeText(tela.getByLabelText('Título da aula'), 'Treino livre');
  fireEvent.press(tela.getByRole('radio', { name: 'Quarta' }));
  fireEvent.changeText(tela.getByLabelText('Hora de início'), '1200');
}

const HORARIO = {
  id: 'h-1',
  title: 'Muay Thai',
  weekday: 3,
  startTime: '19:00',
  validFrom: '2030-03-01',
  validUntil: null,
  teacherIds: [],
  audience: 'both',
};

let alerta: jest.SpyInstance;

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue(RESPOSTA);
  mockEnd.mockReset().mockResolvedValue({ action: 'encerrado', removed: 0 });
  mockContarTrocas.mockReset().mockResolvedValue(0);
  mockFetchSchedules.mockReset().mockResolvedValue([]);
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alerta.mockRestore();
});

describe('HorarioFormScreen — quem pode participar (4.3, § 6)', () => {
  it('deveCriarComOPublicoEscolhido', async () => {
    const tela = formulario({ groupId: 'turma-a', groupName: 'Turma A' });
    preencher(tela);
    fireEvent.press(tela.getByRole('tab', { name: 'Livres' }));
    fireEvent.press(tela.getByRole('button', { name: 'Criar horário' }));

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'turma-a', audience: 'free' })),
    );
  });

  it('deveCriarFixosELivresPorPadrao', async () => {
    const tela = formulario({ groupId: 'turma-a', groupName: 'Turma A' });
    preencher(tela);
    fireEvent.press(tela.getByRole('button', { name: 'Criar horário' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ audience: 'both' })));
  });

  it('deveTravarSoLivresNoHorarioSemTurma', async () => {
    const tela = formulario({ groupId: null, groupName: 'Aulas só para livres' });

    expect(tela.getByText('Turma: Sem turma — só livres')).toBeTruthy();
    expect(tela.queryByRole('tab', { name: 'Fixos' })).toBeNull();
    preencher(tela);
    fireEvent.press(tela.getByRole('button', { name: 'Criar horário' }));

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ groupId: null, audience: 'free' })),
    );
  });

  it('deveAvisarDasTrocasPermanentesAntesDeSalvarAEdicao', async () => {
    mockContarTrocas.mockResolvedValue(2);
    const tela = formulario({ groupId: 'turma-a', groupName: 'Turma A', schedule: HORARIO });

    expect(await tela.findByText('2 aluno(s) têm troca permanente com este horário.')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Salvar alterações' }));

    expect(alerta).toHaveBeenCalledWith(
      'Atualizar as próximas aulas?',
      expect.stringContaining('2 aluno(s) têm troca permanente com este horário.'),
      expect.anything(),
    );
  });

  it('deveDizerQuandoNaoDeuParaConferirAsTrocas', async () => {
    mockContarTrocas.mockRejectedValue(new Error('Network request failed'));
    const tela = formulario({ groupId: 'turma-a', groupName: 'Turma A', schedule: HORARIO });

    await waitFor(() => expect(mockContarTrocas).toHaveBeenCalled());
    fireEvent.press(tela.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith(
        'Atualizar as próximas aulas?',
        expect.stringContaining('Não foi possível conferir se há alunos com troca permanente'),
        expect.anything(),
      ),
    );
  });
});

describe('GradeTurmaScreen — selo do público e aviso ao encerrar (4.3, § 6)', () => {
  const LINHA = {
    schedule: {
      id: 'h-1',
      group_id: 'turma-a',
      title: 'Treino funcional',
      weekday: 3,
      start_time: '12:00:00',
      valid_from: '2030-03-01',
      valid_until: null,
      audience: 'free',
      created_by: null,
      created_at: '2030-01-01T00:00:00Z',
      updated_at: '2030-01-01T00:00:00Z',
    },
    teachers: [],
  };

  function grade(groupId: string | null) {
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const tela = comTema(
      <GradeTurmaScreen
        navigation={navigation as never}
        route={{ key: 'GradeTurma', name: 'GradeTurma', params: { groupId, groupName: 'Turma A' } } as never}
      />,
    );
    return { ...tela, navigation };
  }

  it('deveMostrarOSeloLivresNoHorario', async () => {
    mockFetchSchedules.mockResolvedValue([LINHA]);
    const tela = grade('turma-a');

    expect(await tela.findByText('Livres')).toBeTruthy();
  });

  it('deveAvisarDasTrocasPermanentesNaFolhaDeEncerrar', async () => {
    mockFetchSchedules.mockResolvedValue([LINHA]);
    mockContarTrocas.mockResolvedValue(1);
    const tela = grade('turma-a');

    fireEvent.press(await tela.findByRole('button', { name: 'Encerrar horário de Quarta · 12:00' }));

    expect(await tela.findByText('1 aluno(s) têm troca permanente com este horário.')).toBeTruthy();
    expect(mockContarTrocas).toHaveBeenCalledWith('h-1');
  });

  it('deveBuscarOsHorariosSemTurma', async () => {
    grade(null);
    await waitFor(() => expect(mockFetchSchedules).toHaveBeenCalledWith(null));
  });
});
