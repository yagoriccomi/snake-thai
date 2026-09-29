import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockSave = jest.fn();
let mockSettings: Record<string, unknown> = {};

jest.mock('@/hooks/useAcademySettings', () => ({
  useAcademySettings: () => ({ settings: mockSettings, loading: false, error: null, reload: jest.fn(), save: mockSave }),
}));
jest.mock('@/hooks/useDefaultStudentPassword', () => ({
  useDefaultStudentPassword: () => ({ password: 'senha-padrao-1', loading: false, error: null, reload: jest.fn() }),
}));
jest.mock('@/hooks/usePlans', () => ({ usePlans: () => ({ plans: [] }) }));
jest.mock('@/components/PlanPicker', () => ({ PlanPicker: () => null }));
jest.mock('@/services/settings.service', () => ({
  countAccountsWithoutFirstAccess: jest.fn().mockResolvedValue(0),
  updateDefaultStudentPassword: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { ConfiguracoesScreen } from '@/screens/dados/ConfiguracoesScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <ConfiguracoesScreen />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue(undefined);
  mockSettings = {
    academy_name: 'Academia Teste',
    primary_color: '#39FF14',
    pix_key: null,
    pix_holder_name: null,
    contact_email: 'contato@exemplo.com',
    contact_whatsapp: '5511912345678',
    contact_phone: '1131234567',
    address: null,
    default_due_day: 10,
    default_plan_id: null,
    class_weekdays: [1, 2, 3, 4, 5, 6],
  };
});

describe('ConfiguracoesScreen — dias de aula e WhatsApp (4.3, contrato § 5.2 e § 5.4)', () => {
  it('deveMostrarOWhatsappEOsDiasNaLeitura', () => {
    const { getByText } = renderTela();
    expect(getByText('+55 (11) 91234-5678')).toBeTruthy();
    expect(getByText('Seg a Sáb')).toBeTruthy();
  });

  it('deveGravarOWhatsappCom55EOsDiasOrdenados', async () => {
    const { getByRole, getByLabelText } = renderTela();
    fireEvent.press(getByRole('button', { name: 'Editar configurações' }));

    fireEvent.changeText(getByLabelText('WhatsApp, DDD e número'), '21987654321');
    fireEvent.press(getByRole('checkbox', { name: 'Sáb' }));
    fireEvent.press(getByRole('checkbox', { name: 'Dom' }));
    fireEvent.press(getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ contact_whatsapp: '5521987654321', class_weekdays: [1, 2, 3, 4, 5, 0] }),
      ),
    );
  });

  it('deveGravarWhatsappNuloQuandoOCampoFicaVazio', async () => {
    const { getByRole, getByLabelText } = renderTela();
    fireEvent.press(getByRole('button', { name: 'Editar configurações' }));
    fireEvent.changeText(getByLabelText('WhatsApp, DDD e número'), '');
    fireEvent.press(getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ contact_whatsapp: null })));
  });

  it('deveRecusarWhatsappSemDdd', async () => {
    const { getByRole, getByLabelText, findByText } = renderTela();
    fireEvent.press(getByRole('button', { name: 'Editar configurações' }));
    fireEvent.changeText(getByLabelText('WhatsApp, DDD e número'), '91234-5678');
    fireEvent.press(getByRole('button', { name: 'Salvar' }));

    expect(await findByText('WhatsApp inválido: informe o DDD e o número.')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('deveExigirPeloMenosUmDiaDeAula', async () => {
    mockSettings = { ...mockSettings, class_weekdays: [3] };
    const { getByRole, findByText } = renderTela();
    fireEvent.press(getByRole('button', { name: 'Editar configurações' }));
    fireEvent.press(getByRole('checkbox', { name: 'Qua' }));
    fireEvent.press(getByRole('button', { name: 'Salvar' }));

    expect(await findByText('Escolha pelo menos um dia de aula.')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
