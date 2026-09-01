import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface FabProps {
  onPress: () => void;
  accessibilityLabel: string;
  icon?: IoniconName;
  label?: string;
}

/**
 * Floating Action Button (fixo, canto inferior direito) com o verde neon da
 * marca e glow sutil — usado para a ação principal de "Criar Aula".
 */
function FabComponent({
  onPress,
  accessibilityLabel,
  icon = 'add',
  label,
}: FabProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const getStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.fab,
      pressed ? styles.pressed : null,
    ],
    [styles],
  );

  return (
    <Pressable
      onPress={onPress}
      style={getStyle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={24} color={colors.onPrimary} />
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      minHeight: 56,
      borderRadius: 28,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 8,
    },
    pressed: {
      backgroundColor: colors.primaryPressed,
    },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.onPrimary,
    },
  });
}

export const Fab = React.memo(FabComponent);
