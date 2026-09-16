import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AdminPaymentCard } from '@/components/AdminPaymentCard';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FinanceSummary } from '@/components/FinanceSummary';
import { MonthSelector, type MonthOption } from '@/components/MonthSelector';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import {
  useAdminPayments,
  type PaymentWithName,
} from '@/hooks/useAdminPayments';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonthIso, formatMonthShort, formatMonthYear } from '@/utils/datetime';
import { coresDasSituacoes } from '@/utils/payments';

const SCREEN_EDGES = ['bottom'] as const;

type Category = 'pending' | 'open' | 'overdue' | 'paid';

interface AdminFinanceViewProps {
  navigation: FinanceiroStackScreenProps<'FinanceiroHome'>['navigation'];
}

/**
 * Financeiro geral (admin) de uma competência escolhida no seletor de meses: o
 * resumo do mês e as mensalidades em quatro categorias — aguardando aprovação,
 * em aberto, vencidas e pagas.
 *
 * Tocar numa mensalidade em análise abre o comprovante; nas demais, abre o
 * histórico do aluno, onde o admin pode marcar como paga ou não paga.
 */
export function AdminFinanceView({ navigation }: AdminFinanceViewProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const [mes, setMes] = useState(() => currentMonthIso());
  const [category, setCategory] = useState<Category>('pending');
  const { pending, open, overdue, paid, totals, months, loading, error, reload } =
    useAdminPayments(mes);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const cores = useMemo(() => coresDasSituacoes(colors), [colors]);

  const opcoesDeMes = useMemo<MonthOption[]>(
    () =>
      months.map((item) => ({
        value: item.referenceMonth,
        label: formatMonthShort(item.referenceMonth),
        accessibilityLabel: formatMonthYear(item.referenceMonth),
        ...(item.situacao !== null ? { dotColor: cores[item.situacao] } : {}),
      })),
    [months, cores],
  );

  const options = useMemo<ReadonlyArray<SegmentOption<Category>>>(
    () => [
      { value: 'pending', label: `Aprovar (${pending.length})` },
      { value: 'open', label: `Aberto (${open.length})` },
      { value: 'overdue', label: `Vencidas (${overdue.length})` },
      { value: 'paid', label: `Pagas (${paid.length})` },
    ],
    [pending.length, open.length, overdue.length, paid.length],
  );

  const data =
    category === 'pending'
      ? pending
      : category === 'open'
        ? open
        : category === 'overdue'
          ? overdue
          : paid;

  const abrirPagamento = useCallback(
    (item: PaymentWithName) => {
      if (item.status === 'pending_approval') {
        navigation.navigate('Comprovante', {
          paymentId: item.id,
          comprovante: item,
          studentName: item.studentName,
        });
        return;
      }
      navigation.navigate('HistoricoPagamentosAluno', {
        userId: item.user_id,
        name: item.studentName,
      });
    },
    [navigation],
  );

  const abrirHistorico = useCallback(() => {
    navigation.navigate('HistoricoPagamentosAlunos');
  }, [navigation]);

  const abrirInadimplencia = useCallback(() => {
    navigation.navigate('RelatorioInadimplencia');
  }, [navigation]);

  const renderItem = useCallback<ListRenderItem<PaymentWithName>>(
    ({ item }) => <AdminPaymentCard item={item} onPress={abrirPagamento} />,
    [abrirPagamento],
  );

  const cabecalho = (
    <View style={styles.headerBlock}>
      <View>
        <View style={styles.overlineRow}>
          <Text style={[styles.overline, { color: colors.textSecondary, fontFamily: fonts.bodySemiBold }]}>
            FINANCEIRO
          </Text>
          <View style={[styles.roleChip, { borderColor: colors.primary }]}>
            <Text style={[styles.roleChipText, { color: colors.primaryText, fontFamily: fonts.bodyBold }]}>
              ADMIN
            </Text>
          </View>
        </View>
        <AppText variant="heading">{formatMonthYear(mes)}</AppText>
      </View>

      <MonthSelector options={opcoesDeMes} value={mes} onChange={setMes} />

      <FinanceSummary totals={totals} />

      <View style={styles.acoes}>
        <Button
          title="Histórico por aluno"
          variant="secondary"
          onPress={abrirHistorico}
          style={styles.acao}
          accessibilityHint="Escolha um aluno para ver e ajustar as mensalidades dele"
        />
        <Button
          title="Inadimplência"
          variant="secondary"
          onPress={abrirInadimplencia}
          style={styles.acao}
          accessibilityHint="Lista quem está com mensalidade atrasada, por faixa de atraso"
        />
      </View>

      <SegmentedControl options={options} value={category} onChange={setCategory} />

      {loading && data.length > 0 ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Atualizando" />
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={error !== null ? [] : data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={11}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          error !== null ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
          ) : (
            <EmptyState
              icon="cash-outline"
              title="Nada por aqui"
              message="Não há mensalidades nesta categoria neste mês."
            />
          )
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PaymentWithName): string => item.id;

const styles = StyleSheet.create({
  acoes: {
    flexDirection: 'row',
    gap: 10,
  },
  acao: {
    flex: 1,
  },
  headerBlock: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 16,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  overline: {
    fontSize: 11,
    letterSpacing: 1.5,
  },
  roleChip: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  roleChipText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  loading: {
    marginTop: 24,
  },
  content: {
    paddingBottom: 24,
    flexGrow: 1,
  },
});
