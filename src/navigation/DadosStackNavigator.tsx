import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { DadosStackParamList } from '@/navigation/types';
import { CadastrarAlunoScreen } from '@/screens/dados/CadastrarAlunoScreen';
import { DadosScreen } from '@/screens/dados/DadosScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<DadosStackParamList>();

/** Stack da aba "Dados": perfil do usuário e (para admin) cadastro de aluno. */
export function DadosStackNavigator(): React.JSX.Element {
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
      <Stack.Screen name="Perfil" component={DadosScreen} options={PERFIL_OPTIONS} />
      <Stack.Screen
        name="CadastrarAluno"
        component={CadastrarAlunoScreen}
        options={CADASTRO_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const PERFIL_OPTIONS: NativeStackNavigationOptions = { title: 'Dados' };
const CADASTRO_OPTIONS: NativeStackNavigationOptions = { title: 'Cadastrar Aluno' };
