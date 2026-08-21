import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import type { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/theme/ThemeProvider';
import type { ColorScheme } from '@/theme/colors';

interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Rótulo exibido acima do campo. */
  label?: string;
  /** Mensagem de erro; quando presente, aplica o estado de erro. */
  error?: string;
  /** Estilo adicional do container externo. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Campo de texto semântico do design system.
 *
 * Estados visuais:
 * - foco: borda em verde neon;
 * - erro: borda vermelha + mensagem acessível abaixo do campo.
 *
 * Encaminha todas as props nativas de `TextInput` (value, onChangeText,
 * secureTextEntry, keyboardType, etc.) preservando `onFocus`/`onBlur` do consumidor.
 */
function InputComponent({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.JSX.Element {
  const { colors, radius, fonts, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (event) => {
      setIsFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (event) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  const hasError = typeof error === 'string' && error.length > 0;

  const styles = useMemo(
    () => makeStyles({ colors, radius, fonts, spacing }),
    [colors, radius, fonts, spacing],
  );

  const borderStyle = useMemo<ViewStyle>(() => {
    const borderColor = hasError
      ? colors.error
      : isFocused
        ? colors.primary
        : colors.border;
    return { borderColor };
  }, [hasError, isFocused, colors.error, colors.primary, colors.border]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, borderStyle]}
        accessibilityLabel={label ?? rest.accessibilityLabel}
      />
      {hasError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface StyleParams {
  colors: ColorScheme;
  radius: Radius;
  fonts: Fonts;
  spacing: Spacing;
}

/** Fábrica de estilos memoizável, dependente do tema. */
function makeStyles({ colors, radius, fonts, spacing }: StyleParams) {
  return StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: spacing.md,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 16,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.error,
      marginTop: spacing.xs,
    },
  });
}

export const Input = React.memo(InputComponent);
