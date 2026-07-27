import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /** Estilo adicional aplicado ao container de conteúdo. */
  style?: StyleProp<ViewStyle>;
  /** Bordas seguras a respeitar (padrão: topo e base). */
  edges?: readonly Edge[];
  /** Aplica padding horizontal padrão ao conteúdo. */
  padded?: boolean;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

/**
 * Container base de tela: aplica área segura (notch/gestos) e o fundo dinâmico
 * do tema, além de ajustar a StatusBar ao modo claro/escuro. Toda tela deve
 * ser envolvida por ele para herdar a identidade visual e a acessibilidade.
 */
function ScreenWrapperComponent({
  children,
  style,
  edges = DEFAULT_EDGES,
  padded = true,
}: ScreenWrapperProps): React.JSX.Element {
  const { colors, spacing, isDark } = useTheme();

  const safeAreaStyle = useMemo<ViewStyle>(
    () => ({ flex: 1, backgroundColor: colors.background }),
    [colors.background],
  );

  const contentStyle = useMemo<ViewStyle>(
    () => ({ flex: 1, paddingHorizontal: padded ? spacing.lg : 0 }),
    [padded, spacing.lg],
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={edges}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[contentStyle, style]}>{children}</View>
    </SafeAreaView>
  );
}

export const ScreenWrapper = React.memo(ScreenWrapperComponent);
