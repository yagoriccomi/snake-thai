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
      <View style={styles.cell}>
        <Text style={[styles.value, { color: colors.primaryText }]}>
          {formatCents(totals.receivedCents)}
        </Text>
        <Text style={styles.label}>recebido</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>
          {formatCents(totals.openCents)}
        </Text>
        <Text style={styles.label}>{totals.openCount} em aberto</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={[styles.value, { color: colors.error }]}>
          {formatCents(totals.overdueCents)}
        </Text>
        <Text style={styles.label}>{totals.overdueCount} vencidas</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg + 6,
      paddingVertical: 18,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    value: {
      fontFamily: fonts.bodyBold,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.3,
    },
    label: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 5,
    },
    divider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
  });
}

export const FinanceSummary = React.memo(FinanceSummaryComponent);
