import React, { useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface RootNavigatorProps {
  /** Chamado quando o container de navegação está pronto (esconde o splash). */
  onReady?: () => void;
}

/**
 * Navegador raiz. Aplica o tema da marca ao React Navigation (cores de fundo,
 * header e destaque) e define o fluxo: Login (auth) → Main (abas).
 */
export function RootNavigator({ onReady }: RootNavigatorProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationContainer theme={navigationTheme} onReady={onReady}>
      <Stack.Navigator initialRouteName="Login" screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** Opções estáticas da stack (constante — não recriada a cada render). */
const SCREEN_OPTIONS = { headerShown: false } as const;
