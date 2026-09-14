import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Um mês selecionável. */
export interface MonthOption {
  /** Identificador estável — em geral a competência `AAAA-MM-DD`. */
  value: string;
  /** Rótulo curto exibido no chip ("Ago/26"). */
  label: string;
  /** Rótulo completo para leitores de tela ("Agosto de 2026"). */
  accessibilityLabel: string;
  /** Cor do marcador de situação ao lado do rótulo, se houver. */
  dotColor?: string;
}

interface MonthSelectorProps {
  options: readonly MonthOption[];
  value: string | null;
  onChange: (value: string) => void;
}

/**
 * Faixa horizontal de meses. O marcador colorido deixa ver, sem abrir cada mês,
 * onde estão os atrasos.
 */
function MonthSelectorComponent({
  options,
  value,
  onChange,
}: MonthSelectorProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.lista}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const ativo = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, ativo ? styles.chipAtivo : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={option.accessibilityLabel}
          >
            {option.dotColor !== undefined ? (
              <View style={[styles.marcador, { backgroundColor: option.dotColor }]} />
            ) : null}
            <Text style={[styles.texto, ativo ? styles.textoAtivo : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    lista: { gap: 8, paddingVertical: 4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipAtivo: { borderColor: colors.primary, backgroundColor: colors.surfaceElevated },
    marcador: { width: 8, height: 8, borderRadius: 4 },
    texto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textSecondary },
    textoAtivo: { color: colors.primaryText },
  });
}

export const MonthSelector = React.memo(MonthSelectorComponent);
