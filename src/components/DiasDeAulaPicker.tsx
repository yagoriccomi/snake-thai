import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { DIAS_DA_SEMANA, ordenarDiasDeAula } from '@/utils/diasDeAula';

interface DiasDeAulaPickerProps {
  value: readonly number[];
  onChange: (dias: number[]) => void;
}

/**
 * Chips de segunda a domingo, vários de uma vez (Configurações › Dias de aula,
 * mockup da linha A). Diferente do `WeekdayPicker`, que escolhe um dia só.
 */
export function DiasDeAulaPicker({ value, onChange }: DiasDeAulaPickerProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.chips} accessibilityRole="list" accessibilityLabel="Dias de aula">
      {DIAS_DA_SEMANA.map((dia) => {
        const marcado = value.includes(dia.valor);
        return (
          <Pressable
            key={dia.valor}
            onPress={() =>
              onChange(ordenarDiasDeAula(marcado ? value.filter((v) => v !== dia.valor) : [...value, dia.valor]))
            }
            style={[styles.chip, marcado ? styles.chipOn : null]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            accessibilityLabel={dia.rotulo}
          >
            <Text style={[styles.chipText, marcado ? styles.chipTextOn : null]}>{dia.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 44,
      minWidth: 48,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textSecondary,
    },
    chipTextOn: {
      color: colors.onPrimary,
    },
  });
}
