import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { PaymentCard, PAYMENT_CARD_TOTAL } from '@/components/PaymentCard';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import { useMyPayments } from '@/hooks/useMyPayments';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import type {
  PaymentRow,
  StudentPaymentsMode,
} from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;

const MODE_OPTIONS: ReadonlyArray<SegmentOption<StudentPaymentsMode>> = [
  { value: 'active', label: 'Em aberto' },
  { value: 'history', label: 'Histórico' },
];

interface StudentFinanceListProps {
  navigation: FinanceiroStackScreenProps<'FinanceiroHome'>['navigation'];
}

/** Mensalidades do aluno: ativos por padrão, com alternância para o histórico. */
export function StudentFinanceList({
  navigation,
}: StudentFinanceListProps): React.JSX.Element {
  const { colors } = useTheme();
  const [mode, setMode] = useState<StudentPaymentsMode>('active');
  const { items, loading, error, reload } = useMyPayments(mode);

  // Recarrega ao voltar do fluxo de pagamento (status pode ter mudado).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const openPayment = useCallback(
    (item: PaymentRow) => {
      navigation.navigate('Pagamento', {
        paymentId: item.id,
        dueDate: item.due_date,
      });
    },
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<PaymentRow>>(
    ({ item }) => <PaymentCard item={item} onPress={openPayment} />,
    [openPayment],
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.header}>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </View>

      {error !== null ? (
        <AppText variant="caption" color={colors.error} style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="card-outline"
              title={mode === 'active' ? 'Nada em aberto' : 'Sem histórico'}
              message={
                mode === 'active'
                  ? 'Você está em dia. 🎉'
                  : 'Seus pagamentos confirmados aparecerão aqui.'
              }
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PaymentRow): string => item.id;

const getItemLayout = (
  _data: ArrayLike<PaymentRow> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: PAYMENT_CARD_TOTAL,
  offset: PAYMENT_CARD_TOTAL * index,
  index,
});

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  error: {
    marginBottom: 8,
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
