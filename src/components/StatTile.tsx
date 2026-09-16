import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface StatTileProps {
  label: string;
  value: string;
  /** Linha pequena de contexto ("de 48 alunos com aula"). */
  hint?: string;
  /** Cor do número; padrão é o texto principal. Use um token do tema. */
  valueColor?: string;
}

/**
 * Um número do Painel com o rótulo acima. O leitor de tela lê rótulo, valor e
 * contexto de uma vez, como uma frase.
 */
function StatTileComponent({ label, value, hint, valueColor }: StatTileProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={hint !== undefined ? `${label}: ${value}, ${hint}` : `${label}: ${value}`}
    >
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.value, valueColor !== undefined ? { color: valueColor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint !== undefined ? (
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 2,
    },
    label: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    value: {
      fontFamily: fonts.bodyBold,
      fontSize: 24,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}

export const StatTile = React.memo(StatTileComponent);
