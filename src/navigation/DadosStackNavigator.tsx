import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { DadosStackParamList } from '@/navigation/types';
import { AlterarSenhaScreen } from '@/screens/dados/AlterarSenhaScreen';
import { CadastrarAlunoScreen } from '@/screens/dados/CadastrarAlunoScreen';
import { CadastrarEquipeScreen } from '@/screens/dados/CadastrarEquipeScreen';
import { ConfiguracoesScreen } from '@/screens/dados/ConfiguracoesScreen';
import { PlanosScreen } from '@/screens/dados/PlanosScreen';
import { DadosScreen } from '@/screens/dados/DadosScreen';
import { GerenciarAlunosScreen } from '@/screens/dados/GerenciarAlunosScreen';
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
      <Stack.Screen
        name="CadastrarEquipe"
        component={CadastrarEquipeScreen}
        options={CADASTRO_EQUIPE_OPTIONS}
      />
      <Stack.Screen
        name="GerenciarAlunos"
        component={GerenciarAlunosScreen}
        options={GERENCIAR_OPTIONS}
      />
      <Stack.Screen
        name="AlterarSenha"
        component={AlterarSenhaScreen}
        options={SENHA_OPTIONS}
      />
      <Stack.Screen name="Planos" component={PlanosScreen} options={PLANOS_OPTIONS} />
      <Stack.Screen
        name="Configuracoes"
        component={ConfiguracoesScreen}
        options={CONFIG_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const PERFIL_OPTIONS: NativeStackNavigationOptions = { title: 'Dados' };
const CADASTRO_OPTIONS: NativeStackNavigationOptions = { title: 'Cadastrar Aluno' };
const CADASTRO_EQUIPE_OPTIONS: NativeStackNavigationOptions = {
  title: 'Cadastrar Equipe',
};
const GERENCIAR_OPTIONS: NativeStackNavigationOptions = { title: 'Gerenciar Alunos' };
const SENHA_OPTIONS: NativeStackNavigationOptions = { title: 'Alterar Senha' };
const PLANOS_OPTIONS: NativeStackNavigationOptions = { title: 'Planos' };
const CONFIG_OPTIONS: NativeStackNavigationOptions = { title: 'Configurações' };
