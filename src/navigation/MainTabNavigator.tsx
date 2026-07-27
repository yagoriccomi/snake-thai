import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';

import type { Fonts } from '@/constants/theme';
import { AulasStackNavigator } from '@/navigation/AulasStackNavigator';
import { DadosStackNavigator } from '@/navigation/DadosStackNavigator';
import type { MainTabParamList } from '@/navigation/types';
import { FinanceiroScreen } from '@/screens/financeiro/FinanceiroScreen';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Ícone de cada aba (mapa constante — sem magic strings soltas). */
const TAB_ICONS: Record<keyof MainTabParamList, IoniconName> = {
  Aulas: 'calendar-outline',
  Financeiro: 'card-outline',
  Dados: 'person-outline',
};

// As abas com stack própria escondem o header do tab (evita header duplicado).
const NESTED_STACK_TAB_OPTIONS: BottomTabNavigationOptions = { headerShown: false };

function makeScreenOptions(colors: ColorScheme, fonts: Fonts) {
  return ({
    route,
  }: {
    route: RouteProp<MainTabParamList, keyof MainTabParamList>;
  }): BottomTabNavigationOptions => ({
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { fontFamily: fonts.heading, color: colors.textPrimary },
    headerShadowVisible: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSecondary,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
    },
    tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
    tabBarIcon: ({ color, size }) => (
      <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
    ),
  });
}

/** Navegador de abas do painel logado: Aulas, Financeiro e Dados. */
export function MainTabNavigator(): React.JSX.Element {
  const { colors, fonts } = useTheme();

  const screenOptions = useMemo(
    () => makeScreenOptions(colors, fonts),
    [colors, fonts],
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Aulas"
        component={AulasStackNavigator}
        options={NESTED_STACK_TAB_OPTIONS}
      />
      <Tab.Screen name="Financeiro" component={FinanceiroScreen} />
      <Tab.Screen
        name="Dados"
        component={DadosStackNavigator}
        options={NESTED_STACK_TAB_OPTIONS}
      />
    </Tab.Navigator>
  );
}
