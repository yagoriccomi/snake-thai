import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MonthlyFrequency } from '@/services/frequency.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatarPercentual } from '@/utils/frequency';

interface FrequencyCardProps {
  /** `null` enquanto carrega ou quando a carga falhou. */
  frequency: MonthlyFrequency | null;
  loading: boolean;
  /** Abre o histórico mensal. */
  onPress: () => void;
}

/**
 * Resumo da frequência do aluno no mês: "Presença em Aulas: X/Y" e
 * "Frequência: N%" (docs/FREQUENCIA.md).
 *
 * Os dois números medem coisas diferentes — o total é o mês inteiro, o
 * percentual só as aulas que já tiveram chamada — por isso o card leva ao
 * histórico, onde isso é explicado.
 */
function FrequencyCardComponent({
  frequency,
  loading,
  onPress,
}: FrequencyCardProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const presenca =
    frequency !== null ? `${frequency.attended}/${frequency.totalClasses}` : '—';
  const percentual = frequency !== null ? formatarPercentual(frequency.frequencyPercent) : '—';

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Presença em aulas: ${presenca}. Frequência: ${percentual}`}
      accessibilityHint="Abre o histórico de frequência"
    >
      {loading && frequency === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Presença em Aulas</Text>
            <Text style={styles.valor}>{presenca}</Text>
          </View>
          <View style={styles.divisor} />
          <View style={styles.bloco}>
            <Text style={styles.rotulo}>Frequência</Text>
            <Text style={styles.valor}>{percentual}</Text>
          </View>
        </>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loading: { flex: 1 },
    bloco: { flex: 1, gap: 2 },
    rotulo: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    valor: {
      fontFamily: fonts.headingBold,
      fontSize: 22,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    divisor: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  });
}

export const FrequencyCard = React.memo(FrequencyCardComponent);
