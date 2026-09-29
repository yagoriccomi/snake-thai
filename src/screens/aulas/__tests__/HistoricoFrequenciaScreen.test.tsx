import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { FrequenciaDoMes, SemanaDoMes } from '@/services/frequency.service';

const mockReload = jest.fn();
let mockEstado: {
  mes: FrequenciaDoMes | null;
  semanas: SemanaDoMes[];
  historico: { reference_month: string }[];
  loading: boolean;
  error: string | null;
};
const mockUseFrequenciaDoMes = jest.fn();

jest.mock('@/hooks/useFrequenciaDoMes', () => ({
  useFrequenciaDoMes: (...args: unknown[]): unknown => {
    mockUseFrequenciaDoMes(...args);
    return { ...mockEstado, reload: mockReload };
  },
}));
jest.mock('@/services/plans.service', () => ({
  SCHEDULE_MODE_LABELS: { fixed: 'Horário fixo', free: 'Horário livre', unlimited: 'À vontade' },
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));
const mockEnviar = jest.fn();
let mockProfileId = 'outra-pessoa';
jest.mock('@/services/justifications.service', () => {
  class JustificativaInvalidaError extends Error {}
  class AnexoIndisponivelError extends Error {}
  return {
    JUSTIFICATION_MESSAGE_MAX: 255,
    JustificativaInvalidaError,
    AnexoIndisponivelError,
    enviarJustificativa: (...args: unknown[]): unknown => mockEnviar(...args),
  };
});
jest.mock('@/services/filePicker.service', () => ({ pickImageProof: jest.fn(), pickDocumentProof: jest.fn() }));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ profile: { id: mockProfileId } }) }));

import { PortalProvider } from '@/components/Portal';
import { HistoricoFrequenciaScreen } from '@/screens/aulas/HistoricoFrequenciaScreen';
import { mesDeFrequencia, semanaDoMes } from '@/test-utils/frequencia';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderTela(navigate = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>
          <HistoricoFrequenciaScreen
            navigation={{ navigate } as never}
            route={{ key: 'HistoricoFrequencia', name: 'HistoricoFrequencia', params: { userId: 'aluno-1', name: 'Ana' } } as never}
          />
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Setembro/2026: Semana extra no começo e no fim (T2). */
const SETEMBRO: SemanaDoMes[] = [
  semanaDoMes({ weekStart: '2026-08-31', weekEnd: '2026-09-06', label: 'Semana extra', isSplit: true, attendedWeek: 2, expectedWeek: 2, weekPercent: 100, attendedInMonth: 1, expectedInMonth: 1 }),
  semanaDoMes({ weekStart: '2026-09-07', weekEnd: '2026-09-13', label: 'S1', attendedWeek: 3, weekPercent: 150, attendedInMonth: 3 }),
  semanaDoMes({ weekStart: '2026-09-14', weekEnd: '2026-09-20', label: 'S2', attendedWeek: 1, weekPercent: 50, attendedInMonth: 1 }),
  semanaDoMes({ weekStart: '2026-09-28', weekEnd: '2026-10-04', label: 'Semana extra', isSplit: true, attendedWeek: 0, expectedWeek: 2, weekPercent: 0, attendedInMonth: 0, expectedInMonth: 1 }),
];

beforeEach(() => {
  mockProfileId = 'outra-pessoa';
  mockEnviar.mockReset().mockResolvedValue({ id: 'j-1', anexoFalhou: false });
  mockReload.mockReset();
  mockUseFrequenciaDoMes.mockReset();
  mockEstado = {
    mes: mesDeFrequencia({ referenceMonth: '2026-09-01', expected: 6, attended: 5, frequencyPercent: 83.33, closesOn: '2026-10-04' }),
    semanas: SETEMBRO,
    historico: [{ reference_month: '2026-08-01' }],
    loading: false,
    error: null,
  };
});

describe('HistoricoFrequenciaScreen (a tela Frequência, § 11 e § 3)', () => {
  it('deveMostrarOMesAsSemanasEOAcumulado', () => {
    const { getByText, getAllByText } = renderTela();
    expect(getByText('SETEMBRO DE 2026 · HORÁRIO LIVRE')).toBeTruthy();
    expect(getByText('83,33%')).toBeTruthy();
    expect(getByText('S1 · 07–13')).toBeTruthy();
    // Acumulado sobre o esperado do mês inteiro (D8): 1 + 3 = 4 de 6.
    expect(getByText('4 de 6 · 66,67%')).toBeTruthy();
    expect(getAllByText('Semana extra').length).toBeGreaterThanOrEqual(2);
    expect(getByText('COMO A SEMANA EXTRA SE DIVIDE')).toBeTruthy();
  });

  it('deveMostrarAParteDaSemanaExtraQueFicaNesteMes', () => {
    const { getAllByText } = renderTela();
    expect(getAllByText('neste mês: 1 de 1').length).toBe(1);
    expect(getAllByText('neste mês: 0 de 1').length).toBe(1);
  });

  it('deveFalarDeMetaNoAVontade', () => {
    mockEstado.mes = mesDeFrequencia({ scheduleMode: 'unlimited' });
    const { getByText } = renderTela();
    expect(getByText('Meta do mês')).toBeTruthy();
  });

  it('deveMostrarOErroComTentarDeNovo', () => {
    mockEstado = { ...mockEstado, mes: null, semanas: [], error: 'Não foi possível carregar a frequência.' };
    const { getByText } = renderTela();
    expect(getByText('Não foi possível carregar a frequência.')).toBeTruthy();
  });

  it('deveTrocarDeMesPeloSeletor', () => {
    const { getByLabelText } = renderTela();
    fireEvent.press(getByLabelText('Agosto de 2026'));
    const ultimaChamada = mockUseFrequenciaDoMes.mock.calls[mockUseFrequenciaDoMes.mock.calls.length - 1];
    expect(ultimaChamada).toEqual(['aluno-1', '2026-08-01']);
  });

  it('deveJustificarASemanaSoNaPropriaFrequencia', async () => {
    mockEstado.semanas = [
      semanaDoMes({ weekStart: '2026-09-14', weekEnd: '2026-09-20', label: 'S2', canJustify: true, justifyUntil: '2026-09-25T15:00:00Z', justificationsLeft: 2 }),
      semanaDoMes({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-13',
        label: 'S1',
        justificativas: [{ id: 'j-0', status: 'approved', attempt: 1, approvedByName: 'Ana' }],
      }),
    ];
    const daEquipe = renderTela();
    expect(daEquipe.queryByText('Justificar semana')).toBeNull();
    expect(daEquipe.queryByText('Minhas justificativas')).toBeNull();
    daEquipe.unmount();

    mockProfileId = 'aluno-1';
    const navigate = jest.fn();
    const propria = renderTela(navigate);
    expect(propria.getByText('Até 25/09 · restam 2 justificativas')).toBeTruthy();
    expect(propria.getByText('Justificativa aprovada por Ana')).toBeTruthy();

    fireEvent.press(propria.getByText('Justificar semana'));
    fireEvent.changeText(propria.getByLabelText('Motivo da falta'), 'Viagem');
    fireEvent.press(propria.getByText('Enviar justificativa'));
    await waitFor(() =>
      expect(mockEnviar).toHaveBeenCalledWith({ scope: 'week', classId: null, weekStart: '2026-09-14', texto: 'Viagem', anexo: null }),
    );
    await waitFor(() => expect(mockReload).toHaveBeenCalled());

    fireEvent.press(propria.getByText('Minhas justificativas'));
    expect(navigate).toHaveBeenCalledWith('MinhasJustificativas');
  });
});
