import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchTeachers = jest.fn();
const mockAddTeacher = jest.fn();
const mockRemoveTeacher = jest.fn();
const mockUpdateOwnColor = jest.fn();
const mockRefreshProfile = jest.fn();
let mockAuth: Record<string, unknown> = {};

jest.mock('@/services/classes.service', () => ({
  fetchTeachersForClasses: (...args: unknown[]): unknown => mockFetchTeachers(...args),
  addClassTeacher: (...args: unknown[]): unknown => mockAddTeacher(...args),
  removeClassTeacher: (...args: unknown[]): unknown => mockRemoveTeacher(...args),
}));
jest.mock('@/services/profile.service', () => ({
  updateOwnColor: (...args: unknown[]): unknown => mockUpdateOwnColor(...args),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { DetalheAulaScreen } from '@/screens/aulas/DetalheAulaScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const AULA = 'c0000000-0000-4000-8000-000000000001';
const EU = 'a0000000-0000-4000-8000-000000000001';

function comoAdmin(color: string | null): void {
  mockAuth = {
    isAdmin: true,
    isProfessor: false,
    isStaff: true,
    profile: { id: EU, role: 'admin', name: 'Júlia', color },
    refreshProfile: mockRefreshProfile,
  };
}

function renderTela() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const params = {
    classId: AULA,
    title: 'Muay Thai',
    type: 'routine',
    dateTimeIso: '2030-03-10T21:00:00Z',
    groupId: 'turma-a',
    scheduleId: null,
    groupLabel: 'Turma A',
  };
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <DetalheAulaScreen
            navigation={navigation as never}
            route={{ key: 'DetalheAula', name: 'DetalheAula', params } as never}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockFetchTeachers.mockReset().mockResolvedValue({ [AULA]: [] });
  mockAddTeacher.mockReset().mockResolvedValue(undefined);
  mockRemoveTeacher.mockReset().mockResolvedValue(undefined);
  mockUpdateOwnColor.mockReset().mockResolvedValue(undefined);
  mockRefreshProfile.mockReset().mockResolvedValue(undefined);
});

describe('DetalheAulaScreen — admin é professor (4.2, contrato § 4)', () => {
  it('deveDeixarOAdminComCorEntrarNaAulaDireto', async () => {
    comoAdmin('#FB923C');
    const { findByRole, getByRole } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Entrar nesta aula' }));

    await waitFor(() => expect(mockAddTeacher).toHaveBeenCalledWith(AULA, EU));
    expect(mockUpdateOwnColor).not.toHaveBeenCalled();
    // Continua podendo editar e fazer a chamada, como antes.
    expect(getByRole('button', { name: 'Editar aula' })).toBeTruthy();
  });

  it('devePedirACorAntesQuandoOAdminNaoTemCor', async () => {
    comoAdmin(null);
    const { findByRole, getByText, getByLabelText, getByRole } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Entrar nesta aula' }));

    // T24: a folha pede a cor; nada foi gravado ainda.
    expect(getByText('Escolha a sua cor')).toBeTruthy();
    expect(mockAddTeacher).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('Cor hexadecimal'), '#fb923c');
    fireEvent.press(getByRole('button', { name: 'Salvar e entrar' }));

    await waitFor(() => expect(mockAddTeacher).toHaveBeenCalledWith(AULA, EU));
    expect(mockUpdateOwnColor).toHaveBeenCalledWith(EU, '#FB923C');
    expect(mockRefreshProfile).toHaveBeenCalled();
    // A cor é salva antes do vínculo: sem ela, o banco recusaria.
    expect(mockUpdateOwnColor.mock.invocationCallOrder[0]).toBeLessThan(
      mockAddTeacher.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('deveRecusarCorForaDoFormatoSemGravarNada', async () => {
    comoAdmin(null);
    const { findByRole, getByLabelText, getByRole, findByText } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Entrar nesta aula' }));
    fireEvent.changeText(getByLabelText('Cor hexadecimal'), 'laranja');
    fireEvent.press(getByRole('button', { name: 'Salvar e entrar' }));

    expect(await findByText('Cor inválida — use o formato #RRGGBB.')).toBeTruthy();
    expect(mockUpdateOwnColor).not.toHaveBeenCalled();
    expect(mockAddTeacher).not.toHaveBeenCalled();
  });

  it('deveMostrarAFalhaNaFolhaEDeixarElaAbertaQuandoEntrarFalha', async () => {
    comoAdmin(null);
    mockAddTeacher.mockRejectedValue(new Error('Aula cancelada.'));
    const { findByRole, getByLabelText, getByRole, findByText, getByText } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Entrar nesta aula' }));
    fireEvent.changeText(getByLabelText('Cor hexadecimal'), '#FB923C');
    fireEvent.press(getByRole('button', { name: 'Salvar e entrar' }));

    expect(await findByText(/Aula cancelada\./)).toBeTruthy();
    expect(getByText('Escolha a sua cor')).toBeTruthy();
  });

  it('deveMostrarSairDaAulaParaOAdminQueJaEhProfessorDela', async () => {
    comoAdmin('#FB923C');
    mockFetchTeachers.mockResolvedValue({ [AULA]: [{ id: EU, name: 'Júlia', color: '#FB923C' }] });
    const { findByRole } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Sair da aula' }));

    await waitFor(() => expect(mockRemoveTeacher).toHaveBeenCalledWith(AULA, EU));
  });

  it('deveAvisarNaTelaQuandoSairDaAulaFalha', async () => {
    comoAdmin('#FB923C');
    mockFetchTeachers.mockResolvedValue({ [AULA]: [{ id: EU, name: 'Júlia', color: '#FB923C' }] });
    mockRemoveTeacher.mockRejectedValue(new Error('A equipe de uma aula que já começou só muda pela chamada.'));
    const { findByRole, findByText } = renderTela();

    fireEvent.press(await findByRole('button', { name: 'Sair da aula' }));

    // Antes, a falha só ia para o log e a tela não dizia nada.
    expect(await findByText(/só muda pela chamada/)).toBeTruthy();
  });

  it('deveAvisarNaTelaQuandoOsProfessoresDaAulaNaoCarregam', async () => {
    comoAdmin('#FB923C');
    mockFetchTeachers.mockRejectedValue(new Error('Network request failed'));
    const { findByText } = renderTela();

    expect(await findByText(/Não foi possível carregar os professores da aula/)).toBeTruthy();
  });
});
