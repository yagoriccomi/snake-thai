import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  elevation,
  fonts,
  MIN_HIT_SLOP,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
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
  typography: typeof typography;
  elevation: typeof elevation;
  minHitSlop: number;
}

/** Valor completo do contexto (tema + ações de troca). */
export interface ThemeContextValue extends Theme {
  /** Alterna entre claro e escuro. */
  toggleTheme: () => void;
  /** Define explicitamente o modo. */
  setMode: (mode: ThemeMode) => void;
  /**
   * Aplica a cor da marca da academia (white-label).
   *
   * Chamado quando `academy_settings` chega do servidor. Cor inválida é
   * ignorada em silêncio — a paleta padrão continua valendo, porque uma cor
   * quebrada não pode tornar o app ilegível.
   */
  applyBrandColor: (color: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

/** Cor de marca aceita: hexadecimal de 6 dígitos, como o banco valida. */
const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

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

  const [brandColor, setBrandColor] = useState<string | null>(null);

  const toggleTheme = useCallback(() => {
    setMode((previous) => (previous === 'dark' ? 'light' : 'dark'));
  }, []);

  const applyBrandColor = useCallback((color: string | null) => {
    if (color !== null && !BRAND_COLOR_PATTERN.test(color)) {
      return;
    }
    setBrandColor(color);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'dark';
    const base = isDark ? darkColors : lightColors;
    // A marca sobrescreve apenas a cor de ação; fundo, texto e semânticas
    // (erro, sucesso) continuam da paleta, para não quebrar contraste.
    const colors =
      brandColor === null ? base : { ...base, primary: brandColor };
    return {
      mode,
      isDark,
      colors,
      spacing,
      radius,
      fonts,
      typography,
      elevation,
      minHitSlop: MIN_HIT_SLOP,
      toggleTheme,
      setMode,
      applyBrandColor,
    };
  }, [mode, brandColor, toggleTheme, applyBrandColor]);

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
