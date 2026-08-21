import React, { useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppFonts } from '@/hooks/useAppFonts';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

// Mantém a splash screen visível até as fontes carregarem.
void SplashScreen.preventAutoHideAsync();

/**
 * Componente raiz do aplicativo Snake Thai.
 *
 * Ordem de composição: área segura → tema → navegação. As fontes da marca são
 * carregadas antes de renderizar a UI (a splash só é escondida quando o
 * container de navegação está pronto), evitando flash de fonte incorreta.
 */
export default function App(): React.JSX.Element | null {
  const { fontsLoaded, fontError } = useAppFonts();

  const handleNavigationReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  // Segura a renderização enquanto as fontes carregam (a menos que haja erro).
  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator onReady={handleNavigationReady} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
