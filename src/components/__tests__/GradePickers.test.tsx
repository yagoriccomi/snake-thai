import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchGroups = jest.fn();
const mockFetchProfessors = jest.fn();

jest.mock('@/services/groups.service', () => ({
  fetchGroups: (...args: unknown[]): unknown => mockFetchGroups(...args),
  createGroup: jest.fn(),
}));

jest.mock('@/services/profile.service', () => ({
  fetchAllProfessors: (...args: unknown[]): unknown => mockFetchProfessors(...args),
}));

import { GroupPicker } from '@/components/GroupPicker';
import { PortalProvider } from '@/components/Portal';
import { ProfessorMultiPicker } from '@/components/ProfessorMultiPicker';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function comTema(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{ui}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const TURMAS = [
  { id: 'ativa', name: 'Turma Ativa', created_at: '2026-01-01T00:00:00Z', archived_at: null },
  { id: 'velha', name: 'Turma Velha', created_at: '2026-01-01T00:00:00Z', archived_at: '2026-06-01T00:00:00Z' },
];

function professor(id: string, name: string, extra: Record<string, unknown> = {}) {
  return { id, name, color: '#123456', status: 'active', anonymized_at: null, ...extra };
}

beforeEach(() => {
  mockFetchGroups.mockReset();
  mockFetchProfessors.mockReset();
});

describe('GroupPicker', () => {
  it('naoDeveOferecerTurmaArquivada', async () => {
    mockFetchGroups.mockResolvedValue(TURMAS);
    const { getByRole, findByRole, queryByRole } = comTema(<GroupPicker value={null} onChange={jest.fn()} />);

    fireEvent.press(getByRole('button', { name: 'Turma: Sem turma' }));

    expect(await findByRole('button', { name: 'Turma Ativa' })).toBeTruthy();
    expect(queryByRole('button', { name: /Turma Velha/ })).toBeNull();
  });

  it('deveManterAArquivadaQuandoJaEAEscolhida', async () => {
    mockFetchGroups.mockResolvedValue(TURMAS);
    const { findByRole, getByLabelText } = comTema(<GroupPicker value="velha" onChange={jest.fn()} />);

    fireEvent.press(await findByRole('button', { name: 'Turma: Turma Velha (arquivada)' }));

    // Por rótulo exato: o campo também contém o texto "Turma Velha (arquivada)".
    expect(getByLabelText('Turma Velha (arquivada)')).toBeTruthy();
  });
});

describe('WeekdayPicker', () => {
  it('deveAnunciarODiaPorExtensoEMarcarOEscolhido', () => {
    const onChange = jest.fn();
    const { getByRole } = comTema(<WeekdayPicker value={1} onChange={onChange} />);

    expect(getByRole('radio', { name: 'Segunda' }).props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByRole('radio', { name: 'Sábado' }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('naoDeveTrocarODiaQuandoDesabilitado', () => {
    const onChange = jest.fn();
    const { getByRole } = comTema(<WeekdayPicker value={1} onChange={onChange} disabled />);

    fireEvent.press(getByRole('radio', { name: 'Terça' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ProfessorMultiPicker', () => {
  it('deveListarSoProfessoresAtivosEAlternarAMarcacao', async () => {
    mockFetchProfessors.mockResolvedValue([
      professor('p-1', 'Ana'),
      professor('p-2', 'Bruno', { status: 'inactive' }),
      professor('p-3', 'Usuário removido', { anonymized_at: '2026-01-01T00:00:00Z' }),
    ]);
    const onChange = jest.fn();
    const { findByRole, queryByRole, getByRole } = comTema(<ProfessorMultiPicker label="Professores" value={[]} onChange={onChange} />);

    fireEvent.press(await findByRole('button', { name: 'Professores: Nenhum professor' }));
    fireEvent.press(getByRole('checkbox', { name: 'Ana' }));

    expect(onChange).toHaveBeenCalledWith(['p-1']);
    expect(queryByRole('checkbox', { name: 'Bruno' })).toBeNull();
  });

  it('deveTirarDaSelecaoEAvisarQuandoUmProfessorSaiu', async () => {
    mockFetchProfessors.mockResolvedValue([professor('p-1', 'Ana')]);
    const onChange = jest.fn();
    const { findByText } = comTema(<ProfessorMultiPicker value={['p-1', 'p-antigo']} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['p-1']));
    expect(await findByText(/não está mais ativo saiu da seleção/)).toBeTruthy();
  });
});
