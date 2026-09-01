import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/ErrorState';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useMyPayments } from '@/hooks/useMyPayments';
import { usePlans } from '@/hooks/usePlans';
import { useAuth } from '@/context/AuthProvider';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import type { PaymentRow } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { dateIsoToBr } from '@/utils/masks';

const SCREEN_EDGES = ['bottom'] as const;

interface StudentFinanceListProps {
  navigation: FinanceiroStackScreenProps<'FinanceiroHome'>['navigation'];
}

/** Primeiro nome, para o cumprimento pessoal. */
function firstNameOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed === '' ? 'aluno' : (trimmed.split(/\s+/)[0] ?? 'aluno');
}

/** Nome do mês da data de vencimento, capitalizado. */
function monthLabel(iso: string): string {
  const raw = new Date(iso).toLocaleDateString('pt-BR', { month: 'long' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Mensalidades do aluno (Painel — versão do usuário). Diferente do admin: mostra
 * apenas a própria conta — a mensalidade em aberto em destaque, com a chave PIX
 * e o envio do comprovante — e o histórico das que já foram pagas. Nunca vê
 * totais da academia nem pagamentos de outros alunos.
 */
export function StudentFinanceList({
  navigation,
}: StudentFinanceListProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { profile } = useAuth();
  const { settings } = useAcademySettings();
  const { plans } = usePlans();

  const active = useMyPayments('active');
  const history = useMyPayments('history');

  // Depende das funções `reload` (estáveis), não dos objetos do hook (recriados
  // a cada render) — senão o efeito de foco re-dispararia sem parar, num loop
  // de recarga que fazia a tela "piscar" e travava a JS thread.
  const reloadActive = active.reload;
  const reloadHistory = history.reload;
  useFocusEffect(
    useCallback(() => {
      void reloadActive();
      void reloadHistory();
    }, [reloadActive, reloadHistory]),
  );

  // A mensalidade em destaque é a de vencimento mais próximo entre as abertas.
  const nextPayment = useMemo<PaymentRow | null>(() => {
    if (active.items.length === 0) {
      return null;
    }
    return [...active.items].sort((a, b) =>
      a.due_date.localeCompare(b.due_date),
    )[0] ?? null;
  }, [active.items]);

  const planNameOf = useCallback(
    (planId: string | null): string | null =>
      planId === null ? null : plans.find((plan) => plan.id === planId)?.name ?? null,
    [plans],
  );

  const openPayment = useCallback(() => {
    if (nextPayment === null) {
      return;
    }
    navigation.navigate('Pagamento', {
      paymentId: nextPayment.id,
      dueDate: nextPayment.due_date,
    });
  }, [navigation, nextPayment]);

  const greeting = `Olá, ${firstNameOf(profile?.name)}`;
  const pixKey = settings?.pix_key ?? null;

  if (active.error !== null && active.items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={active.error} onRetry={() => void active.reload()} />
      </ScreenWrapper>
    );
  }

  if (active.loading && active.items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho pessoal */}
        <View style={styles.header}>
          <View>
            <Text style={styles.overline}>MINHAS MENSALIDADES</Text>
            <AppText variant="heading">{greeting}</AppText>
          </View>
        </View>

        {/* Hero: a próxima mensalidade */}
        {nextPayment !== null ? (
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <AppText variant="caption">Próxima mensalidade</AppText>
              <PaymentStatusBadge status={nextPayment.status} variant="soft" />
            </View>

            <View>
              <Text style={styles.amount}>{formatCents(nextPayment.amount_cents)}</Text>
              <AppText variant="caption" style={styles.amountMeta}>
                {planNameOf(nextPayment.plan_id) !== null
                  ? `${planNameOf(nextPayment.plan_id)} · vence em ${dateIsoToBr(nextPayment.due_date).slice(0, 5)}`
                  : `Vence em ${dateIsoToBr(nextPayment.due_date).slice(0, 5)}`}
              </AppText>
            </View>

            {pixKey !== null ? (
              <View style={styles.pixRow}>
                <View style={styles.pixInfo}>
                  <Text style={styles.pixLabel}>CHAVE PIX</Text>
                  <Text style={styles.pixKey} numberOfLines={1}>
                    {pixKey}
                  </Text>
                </View>
              </View>
            ) : null}

            {nextPayment.status === 'pending_approval' ? (
              <View style={styles.analysing}>
                <Ionicons name="time-outline" size={18} color="#93C5FD" />
                <AppText variant="caption" color="#93C5FD">
                  Comprovante em análise
                </AppText>
              </View>
            ) : (
              <Pressable
                onPress={openPayment}
                style={styles.cta}
                accessibilityRole="button"
                accessibilityLabel="Enviar comprovante de pagamento"
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.ctaText}>Enviar comprovante</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.hero}>
            <View style={styles.emptyOk}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.success} />
              <AppText variant="subtitle" style={styles.emptyOkTitle}>
                Você está em dia
              </AppText>
              <AppText variant="caption" style={styles.emptyOkMsg}>
                Nenhuma mensalidade em aberto no momento.
              </AppText>
            </View>
          </View>
        )}

        {/* Histórico das próprias mensalidades pagas */}
        <View style={styles.historyHeader}>
          <AppText variant="caption">Histórico</AppText>
          {history.items.length > 0 ? (
            <AppText variant="caption" color={colors.textSecondary}>
              {history.items.length} paga{history.items.length > 1 ? 's' : ''}
            </AppText>
          ) : null}
        </View>

        {history.items.length === 0 ? (
          <AppText variant="caption" style={styles.historyEmpty}>
            Seus pagamentos confirmados aparecerão aqui.
          </AppText>
        ) : (
          <View>
            {history.items.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <View style={styles.historyInfo}>
                  <Text style={styles.historyMonth}>{monthLabel(item.due_date)}</Text>
                  <Text style={styles.historyDate}>
                    {item.paid_at !== null
                      ? `Pago em ${dateIsoToBr(item.paid_at.slice(0, 10)).slice(0, 5)}`
                      : 'Pago'}
                  </Text>
                </View>
                <Text style={styles.historyAmount}>{formatCents(item.amount_cents)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    content: {
      paddingTop: 16,
      paddingBottom: 24,
      gap: 18,
      flexGrow: 1,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    hero: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 20,
      padding: 18,
      gap: 14,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    amount: {
      fontFamily: fonts.bodyBold,
      fontSize: 40,
      lineHeight: 44,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.5,
    },
    amountMeta: {
      marginTop: 8,
    },
    pixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pixInfo: {
      flex: 1,
    },
    pixLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10,
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
    pixKey: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textPrimary,
      marginTop: 2,
    },
    analysing: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
    },
    ctaText: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.onPrimary,
    },
    emptyOk: {
      alignItems: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    emptyOkTitle: {
      marginTop: 4,
    },
    emptyOkMsg: {
      textAlign: 'center',
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    historyEmpty: {
      paddingVertical: 8,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    historyInfo: {
      flex: 1,
    },
    historyMonth: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    historyDate: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    historyAmount: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
}
