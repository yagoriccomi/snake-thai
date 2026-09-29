import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AlunoDaChamada, EstadoDaChamada, ProfessorDaChamada } from '@/services/chamada.service';

const mockSalvar = jest.fn();
const mockReload = jest.fn();
const mockCriarMotivo = jest.fn();
let mockChamada: {
  estado: EstadoDaChamada | null;
  alunos: AlunoDaChamada[];
  professores: ProfessorDaChamada[];
  loading: boolean;
  error: string | null;
};
let mockAdmin = false;

jest.mock('@/hooks/useChamada', () => ({
  useChamada: () => ({ ...mockChamada, reload: mockReload, salvar: mockSalvar }),
}));
jest.mock('@/hooks/useGroups', () => ({ useGroups: () => ({ groups: [] }) }));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'prof-1' } }, isAdmin: mockAdmin }),
}));
jest.mock('@/services/rollCallDraft.service', () => ({
  lerRascunho: jest.fn().mockResolvedValue(null),
  guardarRascunho: jest.fn().mockResolvedValue(undefined),
  apagarRascunho: jest.fn().mockResolvedValue(undefined),
  apagarRascunhosVencidos: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/chamada.service', () => ({
  criarMotivoDeRetificacao: (...args: unknown[]): unknown => mockCriarMotivo(...args),
  buscarAlunosParaIncluir: jest.fn().mockResolvedValue([]),
  buscarEquipeParaIncluir: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/frequency.service', () => ({
  fetchFrequenciaDoMes: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/plans.service', () => ({
  SCHEDULE_MODE_LABELS: { fixed: 'Horário fixo', free: 'Horário livre', unlimited: 'À vontade' },
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { FrequenciaScreen } from '@/screens/aulas/FrequenciaScreen';
import { alunoDaChamada, professorDaChamada } from '@/test-utils/chamada';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function estado(parcial: Partial<EstadoDaChamada> = {}): EstadoDaChamada {
  return {
    type: 'routine',
    dateTimeIso: new Date(Date.now() - 3_600_000).toISOString(),
    concludedAt: null,
    edited: false,
    audience: 'both',
    cancelled: false,
    ...parcial,
  };
}

function renderTela() {
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() };
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <FrequenciaScreen
            navigation={navigation as never}
            route={{ key: 'Frequencia', name: 'Frequencia', params: { classId: 'c-1', title: 'Muay Thai', groupId: 'g', canManage: true } } as never}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockSalvar.mockReset().mockResolvedValue({ concluidaEm: 'x', retificada: false, alteracoes: 1 });
  mockCriarMotivo.mockReset().mockResolvedValue('m-1');
  mockAdmin = false;
  mockChamada = {
    estado: estado(),
    alunos: [
      alunoDaChamada({ userId: 'a-1', name: 'Ana', origem: 'turma' }),
      alunoDaChamada({ userId: 'a-2', name: 'Lucas', origem: 'troca_pendente' }),
    ],
    professores: [professorDaChamada({ teacherId: 'prof-1', name: 'Rafael' }), professorDaChamada({ teacherId: 'prof-2', name: 'Júlia' })],
    loading: false,
    error: null,
  };
});

describe('FrequenciaScreen — a chamada nova (§ 7.2)', () => {
  it('deveMostrarOsBlocosOsSelosEOsProfessores', async () => {
    const { getByText } = renderTela();
    await waitFor(() => expect(getByText('DA TURMA')).toBeTruthy());
    expect(getByText('TROCAS')).toBeTruthy();
    expect(getByText('Troca pendente')).toBeTruthy();
    expect(getByText('Marcar presença aprova a troca.')).toBeTruthy();
    expect(getByText('Escalado · fazendo a chamada')).toBeTruthy();
    expect(getByText('Escalado · confirme se deu a aula')).toBeTruthy();
  });

  it('devePedirAPresencaDeCadaProfessorAntesDeConcluir', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByText, getByLabelText } = renderTela();
    await waitFor(() => expect(getByText('Confirme se cada professor deu a aula.')).toBeTruthy());
    fireEvent.press(getByLabelText('Deu a aula: Júlia'));
    fireEvent.press(getByLabelText('Presente: Ana'));
    await waitFor(() => expect(getByText('Concluir chamada')).toBeTruthy());
    fireEvent.press(getByText('Concluir chamada'));
    expect(alerta).toHaveBeenCalled();
    const botoes = alerta.mock.calls[0]?.[2] ?? [];
    await botoes.find((b) => b.text === 'Concluir')?.onPress?.();
    await waitFor(() => expect(mockSalvar).toHaveBeenCalled());
    const envio = mockSalvar.mock.calls[0]?.[0] as { presentes: string[]; professoresPresentes: string[]; motivoId: string | null };
    expect(envio.presentes).toEqual(['a-1']);
    expect(envio.professoresPresentes.sort()).toEqual(['prof-1', 'prof-2']);
    expect(envio.motivoId).toBeNull();
    alerta.mockRestore();
  });

  it('deveRetificarComMotivoDepoisDaConclusao', async () => {
    mockChamada.estado = estado({ concludedAt: new Date().toISOString() });
    mockChamada.alunos = [alunoDaChamada({ userId: 'a-1', name: 'Ana', status: 'absent' })];
    mockChamada.professores = [professorDaChamada({ teacherId: 'prof-1', present: true })];
    const { getByText, getByLabelText, getByPlaceholderText } = renderTela();
    await waitFor(() => expect(getByLabelText('Presente: Ana')).toBeTruthy());
    fireEvent.press(getByLabelText('Presente: Ana'));
    fireEvent.press(getByText('Retificar chamada'));
    await waitFor(() => expect(getByText('ALTERAÇÕES (1)')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText(/marquei errado/), 'Ela estava na aula');
    fireEvent.press(getByText('Salvar retificação'));
    await waitFor(() => expect(mockSalvar).toHaveBeenCalled());
    expect(mockCriarMotivo).toHaveBeenCalledWith('c-1', 'Ela estava na aula');
    expect((mockSalvar.mock.calls[0]?.[0] as { motivoId: string }).motivoId).toBe('m-1');
  });

  it('naoDeveDeixarOProfessorCorrigirPresencaDeProfessorDepoisDaConclusao', async () => {
    mockChamada.estado = estado({ concludedAt: new Date().toISOString() });
    mockChamada.professores = [professorDaChamada({ teacherId: 'prof-1', present: true }), professorDaChamada({ teacherId: 'prof-2', name: 'Júlia', present: true })];
    const { getByLabelText } = renderTela();
    await waitFor(() => expect(getByLabelText('Não deu a aula: Júlia')).toBeTruthy());
    expect(getByLabelText('Não deu a aula: Júlia').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('deveMostrarOErroComTentarDeNovo', () => {
    mockChamada = { ...mockChamada, estado: null, error: 'Não foi possível carregar a chamada.' };
    const { getByText } = renderTela();
    expect(getByText('Não foi possível carregar a chamada.')).toBeTruthy();
  });
});
