import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FinanceTotals } from '@/hooks/useAdminPayments';
import type { ColorScheme } from '@/theme/colors';
import type { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';

interface FinanceSummaryProps {
  totals: FinanceTotals;
}

/**
 * Resumo financeiro do mês (visão do admin): recebido, em aberto e vencidas.
 *
 * É a função exclusiva do administrador — o aluno nunca vê os totais da
 * academia. Valores em `tabular-nums` para alinharem em coluna, com o desenho
 * sóbrio que dinheiro pede.
 */
function FinanceSummaryComponent({ totals }: FinanceSummaryProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Recebido</Text>
        <Text style={[styles.value, { color: colors.primaryText }]} numberOfLines={1}>
          {formatCents(totals.receivedCents)}
        </Text>
      </View>
      <View style={[styles.row, styles.rowDivider]}>
        <Text style={styles.label}>{totals.openCount} em aberto</Text>
        <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>
          {formatCents(totals.openCents)}
        </Text>
      </View>
      <View style={[styles.row, styles.rowDivider]}>
        <Text style={styles.label}>{totals.overdueCount} vencidas</Text>
        <Text style={[styles.value, { color: colors.error }]} numberOfLines={1}>
          {formatCents(totals.overdueCents)}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg + 6,
      paddingHorizontal: 18,
      paddingVertical: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 15,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    label: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      flexShrink: 1,
    },
    value: {
      fontFamily: fonts.bodyBold,
      fontSize: 19,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
      textAlign: 'right',
    },
  });
}

export const FinanceSummary = React.memo(FinanceSummaryComponent);
