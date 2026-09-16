import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { FinanceiroStackParamList } from '@/navigation/types';
import { ComprovanteScreen } from '@/screens/financeiro/ComprovanteScreen';
import { FinanceiroHomeScreen } from '@/screens/financeiro/FinanceiroHomeScreen';
import { HistoricoPagamentosAlunoScreen } from '@/screens/financeiro/HistoricoPagamentosAlunoScreen';
import { HistoricoPagamentosAlunosScreen } from '@/screens/financeiro/HistoricoPagamentosAlunosScreen';
import { MeuPlanoScreen } from '@/screens/financeiro/MeuPlanoScreen';
import { PagamentoScreen } from '@/screens/financeiro/PagamentoScreen';
import { RelatorioInadimplenciaScreen } from '@/screens/financeiro/RelatorioInadimplenciaScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<FinanceiroStackParamList>();

/** Stack da aba "Financeiro": lista, fluxo de pagamento e validação (admin). */
export function FinanceiroStackNavigator(): React.JSX.Element {
  const { colors, fonts } = useTheme();

  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: { fontFamily: fonts.heading, color: colors.textPrimary },
      headerTintColor: colors.primary,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors, fonts],
  );

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="FinanceiroHome"
        component={FinanceiroHomeScreen}
        options={HOME_OPTIONS}
      />
      <Stack.Screen
        name="MeuPlano"
        component={MeuPlanoScreen}
        options={MEU_PLANO_OPTIONS}
      />
      <Stack.Screen
        name="Pagamento"
        component={PagamentoScreen}
        options={PAGAMENTO_OPTIONS}
      />
      <Stack.Screen
        name="Comprovante"
        component={ComprovanteScreen}
        options={COMPROVANTE_OPTIONS}
      />
      <Stack.Screen
        name="HistoricoPagamentosAlunos"
        component={HistoricoPagamentosAlunosScreen}
        options={HISTORICO_ALUNOS_OPTIONS}
      />
      <Stack.Screen
        name="HistoricoPagamentosAluno"
        component={HistoricoPagamentosAlunoScreen}
        options={HISTORICO_ALUNO_OPTIONS}
      />
      <Stack.Screen
        name="RelatorioInadimplencia"
        component={RelatorioInadimplenciaScreen}
        options={RELATORIO_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const HOME_OPTIONS: NativeStackNavigationOptions = { title: 'Financeiro' };
const MEU_PLANO_OPTIONS: NativeStackNavigationOptions = { title: 'Meu Plano' };
const PAGAMENTO_OPTIONS: NativeStackNavigationOptions = { title: 'Pagamento' };
const COMPROVANTE_OPTIONS: NativeStackNavigationOptions = { title: 'Comprovante' };
const HISTORICO_ALUNOS_OPTIONS: NativeStackNavigationOptions = { title: 'Histórico por aluno' };
const HISTORICO_ALUNO_OPTIONS: NativeStackNavigationOptions = { title: 'Pagamentos' };
const RELATORIO_OPTIONS: NativeStackNavigationOptions = { title: 'Inadimplência' };
