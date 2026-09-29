import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockUpdateOwnColor = jest.fn();
const mockRefreshProfile = jest.fn();
let mockAuth: Record<string, unknown> = {};

jest.mock('@/services/profile.service', () => ({
  updateOwnColor: (...args: unknown[]): unknown => mockUpdateOwnColor(...args),
  updateProfile: jest.fn(),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/PushNotificationsProvider', () => ({
  usePushNotifications: () => ({
    status: 'desativado',
    motivo: null,
    ocupado: false,
    podePerguntar: true,
    erro: null,
    ativar: jest.fn(),
    desativar: jest.fn(),
    abrirConfiguracoes: jest.fn(),
  }),
}));
jest.mock('@/hooks/useDiagnosticoDeErros', () => ({
  useDiagnosticoDeErros: () => ({ visivel: false, erroDeTela: false, abrir: jest.fn() }),
  ErroDeTelaProposital: () => null,
}));
jest.mock('@/hooks/useExportarMeusDados', () => ({
  useExportarMeusDados: () => ({ exportar: jest.fn(), exportando: false, erro: null }),
}));
jest.mock('@/components/AppVersionFooter', () => ({ AppVersionFooter: () => null }));
jest.mock('@/services/contato.service', () => ({
  fetchContatoDaAcademia: jest.fn().mockResolvedValue({ whatsapp: null, email: null }),
}));

import { PortalProvider } from '@/components/Portal';
import { DadosScreen } from '@/screens/dados/DadosScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const EU = 'a0000000-0000-4000-8000-000000000001';

function com(role: 'admin' | 'professor' | 'user', color: string | null): void {
  mockAuth = {
    profile: { id: EU, role, name: 'Pessoa Teste', color, cpf: '52998224725', phone: null, dob: null },
    session: { user: { id: EU, email: 'pessoa@exemplo.com' } },
    isAdmin: role === 'admin',
    isProfessor: role === 'professor',
    isStaff: role !== 'user',
    signOut: jest.fn(),
    refreshProfile: mockRefreshProfile,
    biometricEnabled: false,
    biometricAvailable: false,
    chooseBiometric: jest.fn(),
  };
}

function renderTela() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <DadosScreen navigation={navigation as never} route={{ key: 'Perfil', name: 'Perfil' } as never} />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockUpdateOwnColor.mockReset().mockResolvedValue(undefined);
  mockRefreshProfile.mockReset().mockResolvedValue(undefined);
});

describe('DadosScreen — MINHA COR (4.2, contrato § 4)', () => {
  it('deveMostrarMinhaCorParaOAdminComOCampoOpcional', () => {
    com('admin', null);
    const { getByText, getByLabelText } = renderTela();
    expect(getByText('MINHA COR')).toBeTruthy();
    expect(getByLabelText('Cor hexadecimal (opcional)')).toBeTruthy();
  });

  it('naoDeveMostrarMinhaCorParaOAluno', () => {
    com('user', null);
    const { queryByText } = renderTela();
    expect(queryByText('MINHA COR')).toBeNull();
  });

  it('deveDeixarOAdminApagarACor', async () => {
    com('admin', '#FB923C');
    const { getByLabelText, getByRole, findByText } = renderTela();

    fireEvent.changeText(getByLabelText('Cor hexadecimal (opcional)'), '');
    fireEvent.press(getByRole('button', { name: 'Salvar cor' }));

    await waitFor(() => expect(mockUpdateOwnColor).toHaveBeenCalledWith(EU, null));
    expect(await findByText('Cor atualizada com sucesso.')).toBeTruthy();
  });

  it('naoDeveDeixarOProfessorApagarACor', async () => {
    com('professor', '#38BDF8');
    const { getByLabelText, getByRole, findByText } = renderTela();

    fireEvent.changeText(getByLabelText('Cor hexadecimal'), '');
    fireEvent.press(getByRole('button', { name: 'Salvar cor' }));

    expect(await findByText('Cor inválida — use o formato #RRGGBB.')).toBeTruthy();
    expect(mockUpdateOwnColor).not.toHaveBeenCalled();
  });

  it('deveMostrarARecusaDoBancoQuandoOAdminEscaladoApagaACor', async () => {
    com('admin', '#FB923C');
    const frase = 'Você está em aulas que ainda vão acontecer. Saia delas antes de apagar a sua cor.';
    mockUpdateOwnColor.mockRejectedValue(Object.assign(new Error(frase), { name: 'ErroDeFuncao' }));
    const { getByLabelText, getByRole, findByText } = renderTela();

    fireEvent.changeText(getByLabelText('Cor hexadecimal (opcional)'), '');
    fireEvent.press(getByRole('button', { name: 'Salvar cor' }));

    expect(await findByText(frase)).toBeTruthy();
  });
});
