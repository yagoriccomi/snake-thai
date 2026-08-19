import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { elevation, type ElevationLevel } from '@/constants/theme';
import { useTheme } from '@/theme/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  /** Profundidade visual. `flat` para itens de lista, `raised` para destaque. */
  level?: ElevationLevel;
  /** Torna o cartão tocável, com estado de pressionado. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * Superfície padrão do aplicativo.
 *
 * Cartão é o que dá hierarquia a uma tela: sem uma camada acima do fundo, todo
 * conteúdo tem o mesmo peso e o olho não sabe por onde começar. Aqui a
 * profundidade vem de tokens (`elevation`), não de sombras improvisadas caso a
 * caso — e a sombra é discreta de propósito, porque no tema escuro sombra forte
 * vira sujeira em vez de relevo [#3][#6][#7].
 */
function CardComponent({
  children,
  level = 'flat',
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
}: CardProps): React.JSX.Element {
  const { colors, radius, spacing, isDark } = useTheme();

  const surfaceStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: level === 'flat' ? colors.surface : colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      // No claro a sombra dá relevo; no escuro, a borda já separa a superfície
      // do fundo e a sombra só suja a composição.
      ...(isDark ? {} : elevation[level]),
    }),
    [colors, radius.lg, spacing.lg, level, isDark],
  );

  if (onPress === undefined) {
    return <View style={[surfaceStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        surfaceStyle,
        pressed ? styles.pressed : null,
        style,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
});

export const Card = React.memo(CardComponent);
