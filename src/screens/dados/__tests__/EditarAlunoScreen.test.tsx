import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Profile } from '@/types/models';

const mockFetchProfile = jest.fn();
const mockFetchUserEmail = jest.fn();
const mockUpdateStudentByAdmin = jest.fn();
const mockFetchStudentPayments = jest.fn();

jest.mock('@/services/profile.service', () => ({
  fetchProfile: (...args: unknown[]): unknown => mockFetchProfile(...args),
  fetchUserEmail: (...args: unknown[]): unknown => mockFetchUserEmail(...args),
  updateStudentByAdmin: (...args: unknown[]): unknown => mockUpdateStudentByAdmin(...args),
  updateUserEmail: jest.fn(),
  deleteUserAccount: jest.fn(),
}));
jest.mock('@/services/payments.service', () => ({
  fetchStudentPayments: (...args: unknown[]): unknown => mockFetchStudentPayments(...args),
}));
// Os seletores buscam turmas e planos no banco; aqui só importa que existem.
jest.mock('@/components/GroupPicker', () => ({ GroupPicker: () => null }));
jest.mock('@/components/PlanPicker', () => ({ PlanPicker: () => null }));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { EditarAlunoScreen } from '@/screens/dados/EditarAlunoScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const ID = '219ce3c9-5ad7-4319-9cde-7dbe07e1a573';

function perfil(parcial: Partial<Profile> = {}): Profile {
  return {
    id: ID,
    role: 'user',
    name: 'Aluna Teste',
    cpf: '52998224725',
    phone: '11912345678',
    dob: '2000-01-31',
    is_first_login: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    group_id: null,
    group_since: null,
    access_channel: 'app',
    plan_id: null,
    status: 'active',
    deactivated_at: null,
    anonymized_at: null,
    color: null,
    ...parcial,
  };
}

function renderTela() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <EditarAlunoScreen
            navigation={navigation as never}
            route={{ key: 'EditarAluno', name: 'EditarAluno', params: { userId: ID } } as never}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...tela, navigation };
}

beforeEach(() => {
  mockFetchProfile.mockReset().mockResolvedValue(perfil());
  mockFetchUserEmail.mockReset().mockResolvedValue('aluna@exemplo.com');
  mockFetchStudentPayments.mockReset().mockResolvedValue([{ status: 'open' }]);
  mockUpdateStudentByAdmin.mockReset().mockResolvedValue(true);
});

describe('EditarAlunoScreen', () => {
  it('deveCarregarOsDadosDoAlunoComMascaraEOEmail', async () => {
    const { getByDisplayValue, getByText } = renderTela();

    await waitFor(() => expect(getByDisplayValue('529.982.247-25')).toBeTruthy());
    expect(getByDisplayValue('(11) 91234-5678')).toBeTruthy();
    expect(getByDisplayValue('31/01/2000')).toBeTruthy();
    expect(getByText('aluna@exemplo.com')).toBeTruthy();
    expect(getByText('Excluir conta')).toBeTruthy();
  });

  it('deveTravarNomeECpfDeAlunoPendente', async () => {
    mockFetchProfile.mockResolvedValue(perfil({ is_first_login: true, name: null, cpf: null }));
    const { getByLabelText, getByText } = renderTela();

    await waitFor(() => expect(getByText(/ainda não fez o primeiro acesso/)).toBeTruthy());
    expect(getByLabelText('Nome').props.editable).toBe(false);
    expect(getByLabelText('CPF').props.editable).toBe(false);
  });

  it('naoDeveOferecerExclusaoParaAdministrador', async () => {
    mockFetchProfile.mockResolvedValue(perfil({ role: 'admin' }));
    const { queryByText, getByText } = renderTela();

    await waitFor(() => expect(getByText(/Contas de administrador não são excluídas/)).toBeTruthy());
    expect(queryByText('Excluir conta')).toBeNull();
  });

  it('naoDeveGravarComCpfInvalidoEGravarQuandoCorrigido', async () => {
    const { getByLabelText, getByText, findByText } = renderTela();
    await waitFor(() => expect(getByLabelText('CPF').props.value).toBe('529.982.247-25'));

    fireEvent.changeText(getByLabelText('CPF'), '52998224726');
    fireEvent.press(getByText('Salvar alterações'));
    expect(await findByText('CPF inválido. Confira os números.')).toBeTruthy();
    expect(mockUpdateStudentByAdmin).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('Celular (opcional)'), '11987654321');
    fireEvent.changeText(getByLabelText('CPF'), '52998224725');
    fireEvent.press(getByText('Salvar alterações'));

    await waitFor(() => expect(mockUpdateStudentByAdmin).toHaveBeenCalledTimes(1));
    expect(mockUpdateStudentByAdmin.mock.calls[0]?.[2]).toMatchObject({ phone: '11987654321', cpf: '52998224725' });
    expect(await findByText('Alterações salvas.')).toBeTruthy();
  });

  it('deveMostrarContaExcluida', async () => {
    mockFetchProfile.mockResolvedValue(perfil({ anonymized_at: '2026-09-16T00:00:00Z', name: 'Usuário removido' }));
    const { findByText } = renderTela();

    expect(await findByText('Conta excluída')).toBeTruthy();
  });
});
