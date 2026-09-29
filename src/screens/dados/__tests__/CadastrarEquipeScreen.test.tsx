import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockCreateStaff = jest.fn();

jest.mock('@/services/profile.service', () => ({
  createStaff: (...args: unknown[]): unknown => mockCreateStaff(...args),
}));

import { PortalProvider } from '@/components/Portal';
import { CadastrarEquipeScreen } from '@/screens/dados/CadastrarEquipeScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderTela() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <CadastrarEquipeScreen
            navigation={navigation as never}
            route={{ key: 'CadastrarEquipe', name: 'CadastrarEquipe' } as never}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function preencherPessoa(tela: ReturnType<typeof renderTela>): void {
  fireEvent.changeText(tela.getByLabelText('E-mail'), 'julia@exemplo.com');
  fireEvent.changeText(tela.getByLabelText('Nome completo'), 'Júlia Teste');
  fireEvent.changeText(tela.getByLabelText('CPF'), '52998224725');
}

beforeEach(() => {
  mockCreateStaff.mockReset().mockResolvedValue(undefined);
});

describe('CadastrarEquipeScreen — cor do admin (4.2, contrato § 4)', () => {
  it('deveCadastrarAdminSemCorQuandoOCampoFicaVazio', async () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('tab', { name: 'Administrador' }));
    preencherPessoa(tela);

    // O admin começa sem cor: a sugerida é só para professor.
    expect(tela.getByLabelText('Cor (opcional)').props.value).toBe('');
    fireEvent.press(tela.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() => expect(mockCreateStaff).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', color: null })));
  });

  it('deveCadastrarAdminComCorQuandoInformada', async () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('tab', { name: 'Administrador' }));
    preencherPessoa(tela);
    fireEvent.changeText(tela.getByLabelText('Cor (opcional)'), '#fb923c');
    fireEvent.press(tela.getByRole('button', { name: 'Cadastrar' }));

    await waitFor(() =>
      expect(mockCreateStaff).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', color: '#FB923C' })),
    );
  });

  it('deveRecusarCorDoAdminForaDoFormato', async () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('tab', { name: 'Administrador' }));
    preencherPessoa(tela);
    fireEvent.changeText(tela.getByLabelText('Cor (opcional)'), 'laranja');
    fireEvent.press(tela.getByRole('button', { name: 'Cadastrar' }));

    expect(await tela.findByText('Cor inválida — use o formato #RRGGBB.')).toBeTruthy();
    expect(mockCreateStaff).not.toHaveBeenCalled();
  });

  it('deveExigirACorDoProfessor', async () => {
    const tela = renderTela();
    preencherPessoa(tela);
    fireEvent.changeText(tela.getByLabelText('Cor do professor'), '');
    fireEvent.press(tela.getByRole('button', { name: 'Cadastrar' }));

    expect(await tela.findByText('Cor inválida — use o formato #RRGGBB.')).toBeTruthy();
    expect(mockCreateStaff).not.toHaveBeenCalled();
  });
});
