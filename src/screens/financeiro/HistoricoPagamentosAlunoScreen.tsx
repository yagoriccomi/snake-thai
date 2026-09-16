import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PaymentHistoryItem } from '@/components/PaymentHistoryItem';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { usePaymentHistory } from '@/hooks/usePaymentHistory';
import { createLogger } from '@/lib/logger';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import {
  approvePayment,
  markPaymentAsUnpaid,
  type PaymentRow,
} from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatMonthYear } from '@/utils/datetime';
import { resumirPagamentos } from '@/utils/payments';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('HistoricoPagamentosAlunoScreen');

/**
 * Histórico de pagamentos de UM aluno (admin), em lista expansível: cada
 * mensalidade mostra fechada o mês, a situação e se tem anexo; aberta, os
 * detalhes, o anexo e as ações "Marcar como paga" / "Marcar como não paga".
 *
 * O anexo de mensalidade já decidida abre só para visualizar: a tela de
 * comprovante oferece "Recusar", e recusar uma mensalidade paga a reabriria
 * apagando o arquivo.
 */
export function HistoricoPagamentosAlunoScreen({
  navigation,
  route,
}: FinanceiroStackScreenProps<'HistoricoPagamentosAluno'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { userId, name } = route.params;
  const { payments, loading, error, reload } = usePaymentHistory(userId);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const resumo = useMemo(() => resumirPagamentos(payments), [payments]);

  const alternar = useCallback((paymentId: string) => {
    setExpandido((atual) => (atual === paymentId ? null : paymentId));
  }, []);

  const abrirAnexo = useCallback(
    (payment: PaymentRow) => {
      navigation.navigate('Comprovante', {
        paymentId: payment.id,
        comprovante: payment,
        studentName: name,
        somenteLeitura: payment.status !== 'pending_approval',
      });
    },
    [navigation, name],
  );

  const executar = useCallback(
    async (payment: PaymentRow, acao: () => Promise<void>, falha: string) => {
      setProcessandoId(payment.id);
      try {
        await acao();
        await reload();
      } catch (erro) {
        log.error(falha, erro, { paymentId: payment.id });
        Alert.alert('Erro', `${falha}. Tente de novo.`);
      } finally {
        setProcessandoId(null);
      }
    },
    [reload],
  );

  const marcarComoPaga = useCallback(
    (payment: PaymentRow) => {
      Alert.alert(
        'Marcar como paga',
        `${formatMonthYear(payment.reference_month)} de ${name} será registrada como paga hoje, sem exigir anexo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Marcar como paga',
            onPress: () =>
              void executar(
                payment,
                () => approvePayment(payment.id),
                'Não foi possível marcar a mensalidade como paga',
              ),
          },
        ],
      );
    },
    [name, executar],
  );

  const marcarComoNaoPaga = useCallback(
    (payment: PaymentRow) => {
      Alert.alert(
        'Marcar como não paga',
        `${formatMonthYear(payment.reference_month)} de ${name} volta a ficar pendente. O anexo, se houver, continua guardado.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Marcar como não paga',
            style: 'destructive',
            onPress: () =>
              void executar(
                payment,
                () => markPaymentAsUnpaid(payment),
                'Não foi possível desfazer o pagamento',
              ),
          },
        ],
      );
    },
    [name, executar],
  );

  const renderItem = useCallback<ListRenderItem<PaymentRow>>(
    ({ item }) => (
      <PaymentHistoryItem
        payment={item}
        expanded={expandido === item.id}
        busy={processandoId === item.id}
        onToggle={alternar}
        onOpenAttachment={abrirAnexo}
        onMarkPaid={marcarComoPaga}
        onMarkUnpaid={marcarComoNaoPaga}
      />
    ),
    [expandido, processandoId, alternar, abrirAnexo, marcarComoPaga, marcarComoNaoPaga],
  );

  if (error !== null && payments.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  if (loading && payments.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const cabecalho = (
    <View style={styles.cabecalho}>
      <Text style={styles.sobrescrito}>HISTÓRICO DE PAGAMENTOS</Text>
      <AppText variant="heading" numberOfLines={2}>
        {name}
      </AppText>
      <View style={styles.resumo}>
        <Text style={styles.resumoItem}>
          <Text style={{ color: colors.success }}>{resumo.pagas}</Text> pagas
        </Text>
        <Text style={styles.resumoItem}>
          <Text style={{ color: colors.error }}>{resumo.emAtraso}</Text> em atraso
        </Text>
        <Text style={styles.resumoItem}>
          <Text style={{ color: colors.warning }}>{resumo.emAberto + resumo.emAnalise}</Text>{' '}
          em aberto
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={payments}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="cash-outline"
            title="Nenhuma mensalidade"
            message="Este aluno ainda não tem cobranças registradas."
          />
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PaymentRow): string => item.id;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    conteudo: { paddingTop: 12, paddingBottom: 32, flexGrow: 1 },
    cabecalho: { gap: 4, marginBottom: 16 },
    sobrescrito: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    resumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
    resumoItem: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textSecondary },
  });
}
