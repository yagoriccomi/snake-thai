import React, { useMemo } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Variações semânticas de texto do design system. */
export type AppTextVariant =
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'body'
  | 'label'
  | 'caption';

interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  /** Sobrescreve a cor da variante quando necessário. */
  color?: string;
}

/**
 * Texto temático da marca. Aplica a fonte correta (Syne em títulos, Inter no
 * corpo) e a cor do tema conforme a variante, evitando estilos soltos na UI.
 */
function AppTextComponent({
  variant = 'body',
  color,
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { colors, fonts } = useTheme();

  const variantStyle = useMemo<TextStyle>(() => {
    switch (variant) {
      case 'title':
        return { fontFamily: fonts.headingBold, fontSize: 32, color: colors.primary };
      case 'heading':
        return { fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary };
      case 'subtitle':
        return { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.textPrimary };
      case 'label':
        return { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary };
      case 'caption':
        return { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary };
      case 'body':
      default:
        return { fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary };
    }
  }, [variant, colors, fonts]);

  const colorOverride = useMemo<TextStyle | null>(
    () => (color !== undefined ? { color } : null),
    [color],
  );

  return (
    <Text {...rest} style={StyleSheet.flatten([variantStyle, colorOverride, style])}>
      {children}
    </Text>
  );
}

export const AppText = React.memo(AppTextComponent);
