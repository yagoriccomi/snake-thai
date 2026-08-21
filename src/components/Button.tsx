import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/theme/ThemeProvider';
import type { ColorScheme } from '@/theme/colors';

/** Variantes visuais do botão. */
export type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

interface StyleParams {
  colors: ColorScheme;
  radius: Radius;
  fonts: Fonts;
  minHitSlop: number;
  isPrimary: boolean;
}

/**
 * Botão do design system.
 *
 * - `primary`: fundo verde neon, texto preto em negrito e, no toque, um "glow"
 *   sutil (sombra/elevation) que reforça a estética da marca.
 * - `secondary`: fundo transparente com contorno; ao tocar, a borda acende em neon.
 *
 * Garante área de toque mínima de 44x44 dp (acessibilidade) e expõe estados
 * corretos para leitores de tela.
 */
function ButtonComponent({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
}: ButtonProps): React.JSX.Element {
  const { colors, radius, fonts, minHitSlop } = useTheme();
  const isPrimary = variant === 'primary';
  const isInactive = disabled || loading;

  const styles = useMemo(
    () => makeStyles({ colors, radius, fonts, minHitSlop, isPrimary }),
    [colors, radius, fonts, minHitSlop, isPrimary],
  );

  const getContainerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.base,
      isPrimary ? styles.primary : styles.secondary,
      pressed && !isInactive
        ? isPrimary
          ? styles.primaryPressed
          : styles.secondaryPressed
        : null,
      isInactive ? styles.disabled : null,
      style,
    ],
    [styles, isPrimary, isInactive, style],
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      style={getContainerStyle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onPrimary : colors.textPrimary} />
      ) : (
        <Text style={styles.label} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Fábrica de estilos memoizável, dependente do tema. */
function makeStyles({ colors, radius, fonts, minHitSlop, isPrimary }: StyleParams) {
  return StyleSheet.create({
    base: {
      minHeight: minHitSlop,
      minWidth: minHitSlop,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: colors.primary,
    },
    // Glow sutil apenas no toque (press/hover).
    primaryPressed: {
      backgroundColor: colors.primaryPressed,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 8,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.textPrimary,
    },
    secondaryPressed: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 16,
      color: isPrimary ? colors.onPrimary : colors.textPrimary,
    },
  });
}

export const Button = React.memo(ButtonComponent);
