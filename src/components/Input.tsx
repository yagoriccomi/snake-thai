import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  /**
   * Exibe o botão de olho para revelar/ocultar o texto. Ligado por padrão em
   * campos `secureTextEntry`; passe `false` para suprimi-lo.
   */
  showPasswordToggle?: boolean;
  /**
   * Referência ao `TextInput` interno — permite encadear o foco entre campos
   * (o "próximo" do teclado). Em React 19 `ref` é uma prop comum.
   */
  ref?: React.Ref<TextInput>;
}

/** Área de toque extra do botão de olho, para chegar aos 44dp recomendados. */
const TOGGLE_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

/**
 * Campo de texto semântico do design system.
 *
 * Estados visuais:
 * - foco: borda em verde neon;
 * - erro: borda vermelha + mensagem acessível abaixo do campo.
 *
 * Em campos de senha (`secureTextEntry`), renderiza um botão que alterna entre
 * mostrar e ocultar o conteúdo — digitar senha às cegas no celular é a maior
 * fonte de erro de digitação. O botão é anunciado a leitores de tela e informa
 * o estado atual por `accessibilityState.selected`.
 *
 * Encaminha todas as props nativas de `TextInput` (value, onChangeText,
 * keyboardType, etc.) preservando `onFocus`/`onBlur` do consumidor.
 */
function InputComponent({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  showPasswordToggle,
  secureTextEntry,
  ref,
  ...rest
}: InputProps): React.JSX.Element {
  const { colors, radius, fonts, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

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

  const toggleReveal = useCallback(() => {
    setIsRevealed((previous) => !previous);
  }, []);

  const hasError = typeof error === 'string' && error.length > 0;
  const isPasswordField = secureTextEntry === true;
  const hasToggle = isPasswordField && showPasswordToggle !== false;

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
      <View style={[styles.field, borderStyle]}>
        <TextInput
          {...rest}
          ref={ref}
          secureTextEntry={isPasswordField && !isRevealed}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, hasToggle ? styles.inputWithToggle : null]}
          accessibilityLabel={label ?? rest.accessibilityLabel}
        />
        {hasToggle ? (
          <Pressable
            onPress={toggleReveal}
            hitSlop={TOGGLE_HIT_SLOP}
            style={styles.toggle}
            accessible
            accessibilityRole="button"
            accessibilityState={{ selected: isRevealed }}
            accessibilityLabel={isRevealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityHint="Alterna a exibição do texto digitado no campo de senha"
          >
            <Ionicons
              name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
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
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radius.md,
      backgroundColor: colors.inputBackground,
    },
    input: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 16,
    },
    inputWithToggle: {
      paddingRight: spacing.xs,
    },
    toggle: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: spacing.sm,
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
