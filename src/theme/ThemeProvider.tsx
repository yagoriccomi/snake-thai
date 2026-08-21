import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { fonts, MIN_HIT_SLOP, radius, spacing } from '@/constants/theme';
import { darkColors, lightColors, type ColorScheme } from '@/theme/colors';

/** Modos de tema suportados. */
export type ThemeMode = 'light' | 'dark';

/** Formato do tema exposto pelo contexto. */
export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  minHitSlop: number;
}

/** Valor completo do contexto (tema + ações de troca). */
export interface ThemeContextValue extends Theme {
  /** Alterna entre claro e escuro. */
  toggleTheme: () => void;
  /** Define explicitamente o modo. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provedor global de tema.
 *
 * Segue o princípio "Dark Mode First": se o sistema operacional não indicar
 * preferência, o app inicia em modo escuro. O valor do contexto é memoizado
 * para evitar re-renderizações desnecessárias nos consumidores.
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(
    systemScheme === 'light' ? 'light' : 'dark',
  );

  const toggleTheme = useCallback(() => {
    setMode((previous) => (previous === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'dark';
    return {
      mode,
      isDark,
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      fonts,
      minHitSlop: MIN_HIT_SLOP,
      toggleTheme,
      setMode,
    };
  }, [mode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Acessa o tema atual. Lança erro se usado fora de um `<ThemeProvider>`,
 * evitando bugs silenciosos de cor indefinida.
 *
 * @returns O tema e as ações de troca.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um <ThemeProvider>.');
  }
  return context;
}
