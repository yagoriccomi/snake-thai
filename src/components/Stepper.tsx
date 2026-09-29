import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
  /** O que o número conta, para o leitor de tela ("aula por semana"). */
  unidade: string;
  /** Texto ao lado (ex.: "3x por semana · de 1 a 6"). */
  legenda?: string;
}

/**
 * Número com − e + entre `min` e `max` (a cota do plano livre e a meta do à
 * vontade, mockups das linhas A e B). Nos limites, o botão fica desativado.
 */
export function Stepper({ value, min, max, onChange, unidade, legenda }: StepperProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const noMinimo = value <= min;
  const noMaximo = value >= max;

  return (
    <View style={styles.linha}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={noMinimo}
        style={[styles.botao, noMinimo ? styles.botaoDesligado : null]}
        accessibilityRole="button"
        accessibilityLabel={`Menos uma ${unidade}`}
        accessibilityState={{ disabled: noMinimo }}
      >
        <Ionicons name="remove" size={20} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.valor} accessibilityLiveRegion="polite">
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={noMaximo}
        style={[styles.botao, noMaximo ? styles.botaoDesligado : null]}
        accessibilityRole="button"
        accessibilityLabel={`Mais uma ${unidade}`}
        accessibilityState={{ disabled: noMaximo }}
      >
        <Ionicons name="add" size={20} color={colors.textPrimary} />
      </Pressable>
      {legenda !== undefined ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {legenda}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    botao: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoDesligado: {
      opacity: 0.4,
    },
    valor: {
      fontFamily: fonts.bodyBold,
      fontSize: 28,
      minWidth: 32,
      textAlign: 'center',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
}
