import React, { useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortalProvider } from '@/components/Portal';
import { AuthProvider } from '@/context/AuthProvider';
import { useAppFonts } from '@/hooks/useAppFonts';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Mantém a splash screen visível até as fontes carregarem.
void SplashScreen.preventAutoHideAsync();

/**
 * Componente raiz do aplicativo Snake Thai.
 *
 * Composição: área segura → tema → autenticação → navegação. As fontes da marca
 * carregam antes da UI (a splash só some quando a navegação está pronta).
 */
export default function App(): React.JSX.Element | null {
  const { fontsLoaded, fontError } = useAppFonts();

  const handleNavigationReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          {/* Folhas com campo de texto vivem aqui, e não em Modal: ver Portal.tsx. */}
          <PortalProvider>
            <RootNavigator onReady={handleNavigationReady} />
          </PortalProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
