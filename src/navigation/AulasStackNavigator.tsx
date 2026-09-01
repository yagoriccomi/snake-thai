import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { AulasStackParamList } from '@/navigation/types';
import { AulasHomeScreen } from '@/screens/aulas/AulasHomeScreen';
import { CriarAulaScreen } from '@/screens/aulas/CriarAulaScreen';
import { DetalheAulaScreen } from '@/screens/aulas/DetalheAulaScreen';
import { FrequenciaScreen } from '@/screens/aulas/FrequenciaScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<AulasStackParamList>();

/** Stack da aba "Aulas": lista, criação (admin) e controle de frequência (admin). */
export function AulasStackNavigator(): React.JSX.Element {
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
      <Stack.Screen name="AulasHome" component={AulasHomeScreen} options={HOME_OPTIONS} />
      <Stack.Screen name="DetalheAula" component={DetalheAulaScreen} options={DETALHE_OPTIONS} />
      <Stack.Screen
        name="CriarAula"
        component={CriarAulaScreen}
        // Título muda conforme criar (sem params) ou editar (com a aula nos params).
        options={({ route }) => ({
          title: route.params?.classId !== undefined ? 'Editar aula' : 'Criar Aula',
        })}
      />
      <Stack.Screen
        name="Frequencia"
        component={FrequenciaScreen}
        options={FREQUENCIA_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const HOME_OPTIONS: NativeStackNavigationOptions = { title: 'Aulas' };
const DETALHE_OPTIONS: NativeStackNavigationOptions = { title: 'Aula' };
const FREQUENCIA_OPTIONS: NativeStackNavigationOptions = { title: 'Frequência' };
