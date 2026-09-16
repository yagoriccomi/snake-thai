import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fonts, Radius } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { DIAS_DA_SEMANA } from '@/utils/gradeSemanal';

interface WeekdayPickerProps {
  /** 0 = domingo … 6 = sábado; `null` enquanto nada foi escolhido. */
  value: number | null;
  onChange: (weekday: number) => void;
  /** Na edição de um horário o dia não muda (encerre e crie outro). */
  disabled?: boolean;
}

/**
 * Escolha de UM dia da semana em chips Dom…Sáb. Sete botões de rádio: o leitor
 * de tela anuncia o dia por extenso e qual está marcado.
 */
export function WeekdayPicker({ value, onChange, disabled = false }: WeekdayPickerProps): React.JSX.Element {
  const { colors, radius, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts, minHitSlop), [colors, radius, fonts, minHitSlop]);

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Dia da semana">
      {DIAS_DA_SEMANA.map((dia) => {
        const selecionado = dia.value === value;
        return (
          <Pressable
            key={dia.value}
            onPress={() => onChange(dia.value)}
            disabled={disabled}
            style={[styles.chip, selecionado ? styles.chipSelected : null, disabled ? styles.chipDisabled : null]}
            accessibilityRole="radio"
            accessibilityLabel={dia.longo}
            accessibilityState={{ checked: selecionado, disabled }}
          >
            <Text style={[styles.chipText, selecionado ? styles.chipTextSelected : null]}>{dia.curto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts, minHitSlop: number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      minWidth: minHitSlop,
      minHeight: minHitSlop,
      paddingHorizontal: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipDisabled: {
      opacity: 0.6,
    },
    chipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.onPrimary,
    },
  });
}
