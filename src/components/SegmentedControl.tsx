import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fonts, Radius } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

/** A partir de quantos segmentos a fonte do rótulo diminui. */
const SEGMENTOS_PARA_FONTE_MENOR = 4;

/** Até quanto o rótulo pode encolher antes de cortar (nunca ilegível). */
const MENOR_ESCALA_DA_FONTE = 0.85;

/** Opção de um segmento. */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * Controle segmentado (toggle horizontal) tipado. Genérico sobre o union de
 * valores.
 *
 * O rótulo NUNCA quebra em duas linhas: com quatro segmentos e contador
 * ("Aprovar (17)"), a quebra automática espremia o número contra a palavra.
 * A partir de quatro segmentos a fonte já nasce menor, e o ajuste automático
 * entra como rede de segurança para rótulo longo em tela estreita. O texto
 * completo continua indo para o leitor de tela pelo `accessibilityLabel`,
 * mesmo que o visível encolha. [#98]
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);
  // 4 segmentos em tela estreita: ~88 dp por segmento não comportam 14 px.
  const compacto = options.length >= SEGMENTOS_PARA_FONTE_MENOR;

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            <Text
              style={[styles.label, compacto ? styles.labelCompacto : null, selected ? styles.labelSelected : null]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={MENOR_ESCALA_DA_FONTE}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 4,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentSelected: {
      backgroundColor: colors.primary,
    },
    label: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textSecondary,
    },
    labelCompacto: {
      fontSize: 12,
    },
    labelSelected: {
      color: colors.onPrimary,
    },
  });
}
