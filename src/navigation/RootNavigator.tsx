import React, { useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/context/AuthProvider';
import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import type { RootStackParamList } from '@/navigation/types';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { BiometricLockScreen } from '@/screens/auth/BiometricLockScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface RootNavigatorProps {
  onReady?: () => void;
}

/**
 * Navegador raiz orientado pelo estado de autenticação:
 *   inicializando/carregando → Loading
 *   sem sessão               → Login
 *   primeiro login           → Onboarding (bloqueante)
 *   lock biométrico ativo    → BiometricLock
 *   caso contrário           → Main (abas)
 *
 * A biometria é 100% opt-in: nunca é sugerida proativamente. O usuário a ativa,
 * se quiser, pela aba Perfil (switch "Desbloqueio por digital").
 *
 * Não há navegação manual entre esses estados: mudanças em `useAuth` remontam
 * a rota apropriada automaticamente.
 */
export function RootNavigator({ onReady }: RootNavigatorProps): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const {
    initializing,
    loadingProfile,
    session,
    profile,
    adminLocked,
  } = useAuth();

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

  const renderScreen = (): React.JSX.Element => {
    if (initializing) {
      return <Stack.Screen name="Loading" component={LoadingScreen} />;
    }
    if (session === null) {
      return <Stack.Screen name="Login" component={LoginScreen} />;
    }
    if (loadingProfile || profile === null) {
      return <Stack.Screen name="Loading" component={LoadingScreen} />;
    }
    if (profile.is_first_login) {
      return <Stack.Screen name="Onboarding" component={OnboardingScreen} />;
    }
    if (adminLocked) {
      return <Stack.Screen name="BiometricLock" component={BiometricLockScreen} />;
    }
    return <Stack.Screen name="Main" component={MainTabNavigator} />;
  };

  return (
    <NavigationContainer theme={navigationTheme} onReady={onReady}>
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>{renderScreen()}</Stack.Navigator>
    </NavigationContainer>
  );
}

/** Opções estáticas da stack (constante — não recriada a cada render). */
const SCREEN_OPTIONS = { headerShown: false } as const;
