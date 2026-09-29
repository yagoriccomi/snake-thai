import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockAdd = jest.fn();
const mockEdit = jest.fn();
let mockPlans: unknown[] = [];

// A tela só usa as constantes do serviço; o cliente não é chamado.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/hooks/usePlans', () => ({
  usePlans: () => ({
    plans: mockPlans,
    loading: false,
    error: null,
    reload: jest.fn(),
    add: mockAdd,
    edit: mockEdit,
    deactivate: jest.fn(),
  }),
}));

import { PortalProvider } from '@/components/Portal';
import { PlanosScreen } from '@/screens/dados/PlanosScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function plano(parcial: Record<string, unknown>) {
  return {
    id: 'p-1',
    name: 'Livre 3x',
    description: null,
    price_cents: 15000,
    billing_period: 'monthly',
    due_day: 10,
    is_active: true,
    schedule_mode: 'free',
    weekly_quota: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...parcial,
  };
}

function renderTela() {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <PlanosScreen />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

function preencherBase(tela: ReturnType<typeof renderTela>): void {
  fireEvent.changeText(tela.getByLabelText('Nome'), 'Livre 4x');
  fireEvent.changeText(tela.getByLabelText('Valor'), '150,00');
}

beforeEach(() => {
  mockPlans = [];
  mockAdd.mockReset().mockResolvedValue(undefined);
  mockEdit.mockReset().mockResolvedValue(undefined);
});

describe('PlanosScreen — modalidade e cota (4.3, contrato § 5)', () => {
  it('deveCriarPlanoLivreComACotaEscolhidaNosBotoes', async () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('button', { name: 'Novo plano' }));
    preencherBase(tela);
    fireEvent.press(tela.getByRole('tab', { name: 'Horário livre' }));
    fireEvent.press(tela.getByRole('button', { name: 'Mais uma aula por semana' }));

    expect(tela.getByText('4x por semana · de 1 a 6')).toBeTruthy();
    fireEvent.press(tela.getByRole('button', { name: 'Criar plano' }));

    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ scheduleMode: 'free', weeklyQuota: 4 })),
    );
  });

  it('naoDevePassarDe6NemDe1', () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('button', { name: 'Novo plano' }));
    fireEvent.press(tela.getByRole('tab', { name: 'Horário livre' }));
    for (let i = 0; i < 10; i += 1) fireEvent.press(tela.getByRole('button', { name: 'Mais uma aula por semana' }));
    expect(tela.getByText('6x por semana · de 1 a 6')).toBeTruthy();
    for (let i = 0; i < 10; i += 1) fireEvent.press(tela.getByRole('button', { name: 'Menos uma aula por semana' }));
    expect(tela.getByText('1x por semana · de 1 a 6')).toBeTruthy();
  });

  it('deveEsconderACotaForaDoLivreEMandarNula', async () => {
    const tela = renderTela();
    fireEvent.press(tela.getByRole('button', { name: 'Novo plano' }));
    preencherBase(tela);
    fireEvent.press(tela.getByRole('tab', { name: 'À vontade' }));

    expect(tela.queryByRole('button', { name: 'Mais uma aula por semana' })).toBeNull();
    fireEvent.press(tela.getByRole('button', { name: 'Criar plano' }));

    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ scheduleMode: 'unlimited', weeklyQuota: null })),
    );
  });

  it('deveMostrarAFraseDoBancoQuandoOPlanoTemHistorico', async () => {
    mockPlans = [plano({})];
    mockEdit.mockRejectedValue(
      Object.assign(new Error('Plano com histórico: crie outro plano e mova os alunos.'), { name: 'ErroDeFuncao' }),
    );
    const tela = renderTela();
    fireEvent.press(tela.getByRole('button', { name: 'Editar plano Livre 3x' }));
    fireEvent.press(tela.getByRole('tab', { name: 'Horário fixo' }));
    fireEvent.press(tela.getByRole('button', { name: 'Salvar alterações' }));

    expect(await tela.findByText('Plano com histórico: crie outro plano e mova os alunos.')).toBeTruthy();
  });

  it('deveMostrarModalidadeEResumoNaLista', () => {
    mockPlans = [plano({}), plano({ id: 'p-2', name: 'Mensal 2x', schedule_mode: 'fixed', weekly_quota: null })];
    const tela = renderTela();

    expect(tela.getByText('Horário livre')).toBeTruthy();
    expect(tela.getByText('3x por semana')).toBeTruthy();
    expect(tela.getByText('Horário fixo')).toBeTruthy();
    expect(tela.getByText('Segue a grade da turma')).toBeTruthy();
  });
});
