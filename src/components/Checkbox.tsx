import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Radius } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Conteúdo do rótulo (texto simples ou nós ricos). */
  children?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Rótulo acessível quando o conteúdo visual não é textual. */
  accessibilityLabel?: string;
}

/**
 * Checkbox acessível do design system. Marca/desmarca ao toque, com área de
 * toque adequada e estado exposto a leitores de tela.
 */
function CheckboxComponent({
  checked,
  onChange,
  children,
  disabled = false,
  style,
  accessibilityLabel,
}: CheckboxProps): React.JSX.Element {
  const { colors, radius, minHitSlop } = useTheme();

  const handlePress = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);

  const styles = useMemo(
    () => makeStyles({ colors, radius, minHitSlop }),
    [colors, radius, minHitSlop],
  );

  const getContainerStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.container,
      pressed && !disabled ? styles.pressed : null,
      disabled ? styles.disabled : null,
      style,
    ],
    [styles, disabled, style],
  );

  const boxStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: checked ? colors.primary : 'transparent',
      borderColor: checked ? colors.primary : colors.borderStrong,
    }),
    [checked, colors.primary, colors.borderStrong],
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={getContainerStyle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <View style={[styles.box, boxStyle]}>
        {checked ? (
          <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
        ) : null}
      </View>
      {children !== undefined ? <View style={styles.label}>{children}</View> : null}
    </Pressable>
  );
}

interface StyleParams {
  colors: ColorScheme;
  radius: Radius;
  minHitSlop: number;
}

function makeStyles({ colors, radius, minHitSlop }: StyleParams) {
  return StyleSheet.create({
    container: {
      minHeight: minHitSlop,
      flexDirection: 'row',
      alignItems: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.5,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      marginLeft: 12,
    },
  });
}

export const Checkbox = React.memo(CheckboxComponent);
