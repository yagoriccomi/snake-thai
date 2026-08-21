import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { FinanceiroStackParamList } from '@/navigation/types';
import { ComprovanteScreen } from '@/screens/financeiro/ComprovanteScreen';
import { FinanceiroHomeScreen } from '@/screens/financeiro/FinanceiroHomeScreen';
import { PagamentoScreen } from '@/screens/financeiro/PagamentoScreen';
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
        name="Pagamento"
        component={PagamentoScreen}
        options={PAGAMENTO_OPTIONS}
      />
      <Stack.Screen
        name="Comprovante"
        component={ComprovanteScreen}
        options={COMPROVANTE_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const HOME_OPTIONS: NativeStackNavigationOptions = { title: 'Financeiro' };
const PAGAMENTO_OPTIONS: NativeStackNavigationOptions = { title: 'Pagamento' };
const COMPROVANTE_OPTIONS: NativeStackNavigationOptions = { title: 'Comprovante' };
