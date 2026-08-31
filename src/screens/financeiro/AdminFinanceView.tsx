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

import {
  ADMIN_PAYMENT_CARD_TOTAL,
  AdminPaymentCard,
} from '@/components/AdminPaymentCard';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { FinanceSummary } from '@/components/FinanceSummary';
import { ErrorState } from '@/components/ErrorState';
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

const SCREEN_EDGES = ['bottom'] as const;

type Category = 'pending' | 'open' | 'overdue';

interface AdminFinanceViewProps {
  navigation: FinanceiroStackScreenProps<'FinanceiroHome'>['navigation'];
}

/**
 * Gestão financeira (admin) dividida em três categorias: Aguardando Aprovação,
 * Em Aberto e Vencidos. Tocar num "Aguardando" abre a validação do comprovante.
 */
export function AdminFinanceView({ navigation }: AdminFinanceViewProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const { pending, open, overdue, totals, loading, error, reload } =
    useAdminPayments();

  // Mês corrente capitalizado ("Agosto") para o cabeçalho gerencial.
  const monthLabel = useMemo(() => {
    const raw = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);
  const [category, setCategory] = useState<Category>('pending');

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const options = useMemo<ReadonlyArray<SegmentOption<Category>>>(
    () => [
      { value: 'pending', label: `Aprovar (${pending.length})` },
      { value: 'open', label: `Aberto (${open.length})` },
      { value: 'overdue', label: `Vencidos (${overdue.length})` },
    ],
    [pending.length, open.length, overdue.length],
  );

  const data =
    category === 'pending' ? pending : category === 'open' ? open : overdue;

  const openComprovante = useCallback(
    (item: PaymentWithName) => {
      navigation.navigate('Comprovante', {
        paymentId: item.id,
        comprovante: item,
        studentName: item.studentName,
      });
    },
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<PaymentWithName>>(
    ({ item }) => <AdminPaymentCard item={item} onPress={openComprovante} />,
    [openComprovante],
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
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
          <AppText variant="heading">{monthLabel}</AppText>
        </View>

        <FinanceSummary totals={totals} />

        <SegmentedControl options={options} value={category} onChange={setCategory} />
      </View>

      {error !== null && data.length === 0 ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : loading && data.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={11}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="cash-outline"
              title="Nada por aqui"
              message="Não há pagamentos nesta categoria."
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PaymentWithName): string => item.id;

const getItemLayout = (
  _data: ArrayLike<PaymentWithName> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: ADMIN_PAYMENT_CARD_TOTAL,
  offset: ADMIN_PAYMENT_CARD_TOTAL * index,
  index,
});

const styles = StyleSheet.create({
  headerBlock: {
    paddingTop: 12,
    paddingBottom: 8,
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 8,
    flexGrow: 1,
  },
});
