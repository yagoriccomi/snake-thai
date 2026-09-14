import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useMyPayments } from '@/hooks/useMyPayments';
import { createLogger } from '@/lib/logger';
import { BILLING_PERIOD_LABELS, fetchPlanById, type PlanRow } from '@/services/plans.service';
import type { PaymentRow } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { dateIsoToBr } from '@/utils/masks';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('MeuPlanoScreen');

/**
 * "Meu plano" (aluno). Reúne numa página só o que o aluno contratou — plano,
 * benefício e valor — e o estado da mensalidade do mês.
 *
 * É uma tela de LEITURA por completo: criar e editar plano e mensalidade é
 * exclusivo do admin (garantido pela RLS de `plans` e `payments`, não só pela
 * ausência de botões aqui).
 */
export function MeuPlanoScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { profile } = useAuth();
  const { items, loading: loadingPagamentos } = useMyPayments('active');

  const planId = profile?.plan_id ?? null;
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(planId !== null);

  useEffect(() => {
    if (planId === null) {
      setPlan(null);
      setLoadingPlano(false);
      return;
    }
    let ativo = true;
    setLoadingPlano(true);
    fetchPlanById(planId)
      .then((encontrado) => {
        if (ativo) {
          setPlan(encontrado);
        }
      })
      .catch((erro: unknown) => {
        log.error('Falha ao carregar o plano do aluno', erro);
      })
      .finally(() => {
        if (ativo) {
          setLoadingPlano(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [planId]);

  // A mensalidade "do momento" é a aberta de vencimento mais próximo.
  const mensalidade = useMemo<PaymentRow | null>(() => {
    if (items.length === 0) {
      return null;
    }
    return [...items].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;
  }, [items]);

  const renderLinha = useCallback(
    (rotulo: string, valor: string, ultima = false) => (
      <View style={[styles.linha, ultima ? null : styles.linhaDivisor]}>
        <Text style={styles.linhaRotulo}>{rotulo}</Text>
        <Text style={styles.linhaValor}>{valor}</Text>
      </View>
    ),
    [styles],
  );

  if (loadingPlano || loadingPagamentos) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (plan === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <EmptyState
          icon="pricetags-outline"
          title="Nenhum plano ativo"
          message="Você ainda não tem um plano vinculado. Fale com a recepção da academia para escolher o seu."
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        {/* Destaque: o plano contratado */}
        <View style={styles.destaque}>
          <Text style={styles.sobrescrito}>MEU PLANO</Text>
          <AppText variant="heading">{plan.name}</AppText>
          <Text style={styles.valor}>{formatCents(plan.price_cents)}</Text>
          <AppText variant="caption" color={colors.textSecondary}>
            {BILLING_PERIOD_LABELS[plan.billing_period]} · vence todo dia {plan.due_day}
          </AppText>
        </View>

        {/* Benefício do plano */}
        <View style={styles.grupo}>
          <Text style={styles.tituloSecao}>O QUE ESTÁ INCLUÍDO</Text>
          <View style={styles.cartao}>
            {plan.description !== null && plan.description.trim() !== '' ? (
              <View style={styles.beneficio}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.beneficioTexto}>{plan.description}</Text>
              </View>
            ) : (
              <View style={styles.beneficio}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.beneficioVazio}>
                  A academia ainda não detalhou os benefícios deste plano.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Mensalidade do mês */}
        <View style={styles.grupo}>
          <Text style={styles.tituloSecao}>MINHA MENSALIDADE</Text>
          <View style={styles.cartao}>
            {mensalidade !== null ? (
              <>
                <View style={[styles.linha, styles.linhaDivisor]}>
                  <Text style={styles.linhaRotulo}>Situação</Text>
                  <PaymentStatusBadge status={mensalidade.status} variant="soft" />
                </View>
                {renderLinha('Valor', formatCents(mensalidade.amount_cents))}
                {renderLinha('Vencimento', dateIsoToBr(mensalidade.due_date), true)}
              </>
            ) : (
              <View style={styles.beneficio}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.beneficioTexto}>
                  Nenhuma mensalidade em aberto. A próxima será gerada no início do mês
                  que vem.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    centro: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    conteudo: {
      paddingTop: 12,
      paddingBottom: 32,
    },
    destaque: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      gap: 4,
      marginBottom: 20,
    },
    sobrescrito: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    valor: {
      fontFamily: fonts.headingBold,
      fontSize: 32,
      color: colors.primaryText,
      marginTop: 6,
    },
    grupo: {
      marginBottom: 20,
    },
    tituloSecao: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    cartao: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    beneficio: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
    },
    beneficioTexto: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    beneficioVazio: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      minHeight: 52,
    },
    linhaDivisor: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linhaRotulo: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    linhaValor: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
}
