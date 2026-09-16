import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPreview = jest.fn();
const mockRemove = jest.fn();
const mockLogError = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]): unknown => mockLogError(...args),
  }),
}));

jest.mock('@/services/groups.service', () => ({
  previewGroupRemoval: (...args: unknown[]): unknown => mockPreview(...args),
  removeGroup: (...args: unknown[]): unknown => mockRemove(...args),
}));

import { ExcluirTurmaSheet } from '@/components/ExcluirTurmaSheet';
import { PortalProvider } from '@/components/Portal';
import { ErroDeFuncao } from '@/lib/functionsError';
import type { GroupRemovalPreview, GroupRow } from '@/services/groups.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const TURMA: GroupRow = { id: 'turma-a', name: 'Turma A', created_at: '2026-01-01T00:00:00Z', archived_at: null };
const DESTINO: GroupRow = { ...TURMA, id: 'turma-b', name: 'Turma B' };

const COM_HISTORICO: GroupRemovalPreview = {
  archived: false,
  students: 8,
  futureClassesWithoutRollCall: 5,
  pastClasses: 30,
  activeSchedules: 2,
  frozenMonths: 1,
  canDeleteForGood: false,
};

function renderFolha(onExcluida = jest.fn()) {
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <ExcluirTurmaSheet turma={TURMA} destinos={[DESTINO]} onClose={jest.fn()} onExcluida={onExcluida} />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...tela, onExcluida };
}

beforeEach(() => {
  mockPreview.mockReset();
  mockRemove.mockReset();
  mockLogError.mockReset();
});

describe('ExcluirTurmaSheet', () => {
  it('deveMostrarQueATurmaComHistoricoSeraArquivadaEOQueSaiDaAgenda', async () => {
    mockPreview.mockResolvedValue(COM_HISTORICO);
    const { findByText, getByText, getByRole } = renderFolha();

    await findByText(/será arquivada/);
    expect(getByText(/5 aulas futuras sem chamada saem da agenda/)).toBeTruthy();
    expect(getByText(/2 horários da grade são encerrados hoje/)).toBeTruthy();
    expect(getByRole('button', { name: 'Arquivar turma' })).toBeTruthy();
  });

  it('deveExigirODestinoDosAlunosAntesDeLiberar', async () => {
    mockPreview.mockResolvedValue(COM_HISTORICO);
    mockRemove.mockResolvedValue({ action: 'arquivada', movedStudents: 8, removedClasses: 5, deletedSchedules: 0 });
    const { findByRole, getByRole, onExcluida } = renderFolha();

    const botao = await findByRole('button', { name: 'Arquivar turma' });
    expect(botao.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByRole('radio', { name: 'Turma B' }));
    expect(getByRole('button', { name: 'Arquivar turma' }).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByRole('button', { name: 'Arquivar turma' }));

    await waitFor(() => expect(onExcluida).toHaveBeenCalled());
    expect(mockRemove).toHaveBeenCalledWith({ groupId: 'turma-a', destinationGroupId: 'turma-b', leaveWithoutGroup: false });
  });

  it('deveAvisarQuandoOsAlunosFicamSemTurma', async () => {
    mockPreview.mockResolvedValue(COM_HISTORICO);
    const { findByRole, getByText } = renderFolha();

    fireEvent.press(await findByRole('radio', { name: 'Sem turma' }));

    expect(getByText(/só vê eventos e fica com 100% de frequência/)).toBeTruthy();
  });

  it('deveLiberarDeCaraATurmaSemAlunosEApagarDeVez', async () => {
    mockPreview.mockResolvedValue({ ...COM_HISTORICO, students: 0, pastClasses: 0, frozenMonths: 0, canDeleteForGood: true });
    const { findByRole, getByText } = renderFolha();

    const botao = await findByRole('button', { name: 'Excluir turma' });
    expect(botao.props.accessibilityState.disabled).toBe(false);
    expect(getByText(/será apagada de vez/)).toBeTruthy();
  });

  it('deveMostrarARecusaDoBancoSemFechar', async () => {
    mockPreview.mockResolvedValue({ ...COM_HISTORICO, students: 0 });
    mockRemove.mockRejectedValue(new ErroDeFuncao('A turma já está arquivada.', null));
    const { findByRole, findByText, onExcluida } = renderFolha();

    fireEvent.press(await findByRole('button', { name: 'Arquivar turma' }));

    expect(await findByText('A turma já está arquivada.')).toBeTruthy();
    expect(onExcluida).not.toHaveBeenCalled();
    // Na tela e no log: falha nunca é silenciosa.
    expect(mockLogError).toHaveBeenCalledWith('Falha ao excluir a turma', expect.any(Error));
  });

  it('deveOferecerNovaTentativaQuandoAPreviaFalha', async () => {
    mockPreview.mockRejectedValueOnce({ message: 'TypeError: Network request failed' }).mockResolvedValueOnce(COM_HISTORICO);
    const { findByRole, findByText } = renderFolha();

    fireEvent.press(await findByRole('button', { name: 'Tentar de novo' }));

    expect(await findByText(/será arquivada/)).toBeTruthy();
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });
});
