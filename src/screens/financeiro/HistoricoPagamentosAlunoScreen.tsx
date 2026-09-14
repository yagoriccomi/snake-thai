import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { MonthSelector, type MonthOption } from '@/components/MonthSelector';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { usePaymentHistory } from '@/hooks/usePaymentHistory';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import type { PaymentStatus } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { formatMonthShort, formatMonthYear } from '@/utils/datetime';
import { dateIsoToBr } from '@/utils/masks';
import { descreverPagamento, resumirPagamentos } from '@/utils/payments';

const SCREEN_EDGES = ['bottom'] as const;

type Estilos = ReturnType<typeof makeStyles>;

/** Uma linha rótulo → valor do cartão da competência. */
function Linha({
  rotulo,
  valor,
  styles,
}: {
  rotulo: string;
  valor: string;
  styles: Estilos;
}): React.JSX.Element {
  return (
    <View style={styles.linha} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

/**
 * Histórico de pagamentos de UM aluno (admin): escolhe-se o mês na faixa de
 * competências e o cartão mostra valor, vencimento, quando pagou (e com
 * quantos dias de atraso) e se há comprovante.
 *
 * "Validar comprovante" só aparece para mensalidade em análise: a tela de
 * comprovante sempre oferece aprovar e recusar, e recusar uma mensalidade já
 * paga a reabriria.
 */
export function HistoricoPagamentosAlunoScreen({
  navigation,
  route,
}: FinanceiroStackScreenProps<'HistoricoPagamentosAluno'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { userId, name } = route.params;
  const { payments, loading, error, reload } = usePaymentHistory(userId);
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Sem escolha, a competência mais recente — é a que quase sempre se procura.
  const selecionado =
    payments.find((payment) => payment.reference_month === mesEscolhido) ?? payments[0] ?? null;

  const corDaSituacao = useMemo<Record<PaymentStatus, string>>(
    () => ({
      paid: colors.success,
      overdue: colors.error,
      pending_approval: '#93C5FD',
      open: colors.warning,
    }),
    [colors],
  );

  const opcoes = useMemo<MonthOption[]>(
    () =>
      payments.map((payment) => ({
        value: payment.reference_month,
        label: formatMonthShort(payment.reference_month),
        accessibilityLabel: formatMonthYear(payment.reference_month),
        dotColor: corDaSituacao[payment.status],
      })),
    [payments, corDaSituacao],
  );

  const resumo = useMemo(() => resumirPagamentos(payments), [payments]);

  const validarComprovante = useCallback(() => {
    if (selecionado === null) {
      return;
    }
    navigation.navigate('Comprovante', {
      paymentId: selecionado.id,
      comprovante: selecionado,
      studentName: name,
    });
  }, [navigation, selecionado, name]);

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

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={styles.sobrescrito}>HISTÓRICO DE PAGAMENTOS</Text>
        <AppText variant="heading" numberOfLines={2}>
          {name}
        </AppText>

        {selecionado === null ? (
          <EmptyState
            icon="cash-outline"
            title="Nenhuma mensalidade"
            message="Este aluno ainda não tem cobranças registradas."
          />
        ) : (
          <>
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

            <Text style={styles.tituloSecao}>MÊS</Text>
            <MonthSelector
              options={opcoes}
              value={selecionado.reference_month}
              onChange={setMesEscolhido}
            />

            <View style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <Text style={styles.mes}>{formatMonthYear(selecionado.reference_month)}</Text>
                <PaymentStatusBadge status={selecionado.status} variant="soft" />
              </View>
              <Linha rotulo="Valor" valor={formatCents(selecionado.amount_cents)} styles={styles} />
              <Linha rotulo="Vencimento" valor={dateIsoToBr(selecionado.due_date)} styles={styles} />
              <Linha rotulo="Pagamento" valor={descreverPagamento(selecionado)} styles={styles} />
              <Linha
                rotulo="Comprovante"
                valor={selecionado.proof_provider !== null ? 'Enviado' : 'Não enviado'}
                styles={styles}
              />
              {selecionado.status === 'pending_approval' && selecionado.proof_provider !== null ? (
                <Button
                  title="Validar comprovante"
                  onPress={validarComprovante}
                  style={styles.botao}
                  accessibilityHint="Abre o comprovante para aprovar ou recusar"
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    conteudo: { paddingTop: 12, paddingBottom: 32, gap: 4 },
    sobrescrito: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    resumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
    resumoItem: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textSecondary },
    tituloSecao: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 20,
      marginBottom: 4,
    },
    cartao: {
      marginTop: 12,
      padding: 16,
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cartaoTopo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    mes: { flex: 1, fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    rotulo: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
    valor: {
      flexShrink: 1,
      textAlign: 'right',
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    botao: { marginTop: 4 },
  });
}
