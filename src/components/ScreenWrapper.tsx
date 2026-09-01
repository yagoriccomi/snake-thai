import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  /**
   * Encolhe a tela quando o teclado abre, para que o campo em foco não fique
   * escondido atrás dele. Ligue em qualquer tela com formulário.
   */
  avoidKeyboard?: boolean;
}

const DEFAULT_EDGES: readonly Edge[] = ['top', 'bottom'];

/** Estilo constante — evita recriar o objeto a cada render. */
const FLEX_FILL: ViewStyle = { flex: 1 };

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
  avoidKeyboard = false,
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

  const content = <View style={[contentStyle, style]}>{children}</View>;

  return (
    <SafeAreaView style={safeAreaStyle} edges={edges}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {avoidKeyboard ? (
        // No Android o manifesto já usa adjustResize, então basta 'height';
        // no iOS é preciso reservar o espaço do teclado com 'padding'.
        <KeyboardAvoidingView
          style={FLEX_FILL}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export const ScreenWrapper = React.memo(ScreenWrapperComponent);
