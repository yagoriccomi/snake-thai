import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useMonthlyFrequency } from '@/hooks/useMonthlyFrequency';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import { fetchMonthlyHistory, type MonthlyHistoryRow } from '@/services/frequency.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatarPercentual } from '@/utils/frequency';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('HistoricoFrequenciaScreen');

/** "Agosto de 2026" a partir de `AAAA-MM-DD`. Meio-dia evita virar o dia por fuso. */
function rotuloDoMes(referenceMonth: string): string {
  const texto = new Date(`${referenceMonth}T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Frequência de um aluno: o mês corrente, calculado ao vivo, e os meses já
 * fechados, congelados (docs/FREQUENCIA.md).
 *
 * O mesmo aluno pode ter "3/12" no contador e "100%" na frequência — o total
 * é o mês inteiro, o percentual só conta as aulas que já tiveram chamada. A
 * tela explica isso em vez de deixar parecer contradição.
 */
export function HistoricoFrequenciaScreen({
  route,
}: AulasStackScreenProps<'HistoricoFrequencia'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { userId, name } = route.params;

  const ids = useMemo(() => [userId], [userId]);
  const atual = useMonthlyFrequency(ids);
  const mesAtual = atual.byUser[userId] ?? null;

  const [historico, setHistorico] = useState<MonthlyHistoryRow[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      setHistorico(await fetchMonthlyHistory(userId));
    } catch (erro) {
      log.error('Falha ao carregar o histórico mensal', erro);
      setErroHistorico('Não foi possível carregar o histórico.');
    } finally {
      setCarregandoHistorico(false);
    }
  }, [userId]);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const recarregarAtual = atual.reload;
  useFocusEffect(
    useCallback(() => {
      void recarregarAtual();
    }, [recarregarAtual]),
  );

  const renderItem = useCallback<ListRenderItem<MonthlyHistoryRow>>(
    ({ item }) => (
      <View
        style={styles.linha}
        accessible
        accessibilityLabel={`${rotuloDoMes(item.reference_month)}: ${item.attended} de ${item.total_classes} aulas, frequência ${formatarPercentual(Number(item.frequency_percent))}`}
      >
        <View style={styles.linhaTexto}>
          <Text style={styles.mes}>{rotuloDoMes(item.reference_month)}</Text>
          <Text style={styles.detalhe}>
            {item.attended}/{item.total_classes} aulas
            {item.justified > 0 ? ` · ${item.justified} justificada(s)` : ''}
          </Text>
        </View>
        <Text style={styles.percentual}>{formatarPercentual(Number(item.frequency_percent))}</Text>
      </View>
    ),
    [styles],
  );

  const cabecalho = (
    <View style={styles.cabecalho}>
      <Text style={styles.sobrescrito}>FREQUÊNCIA</Text>
      <AppText variant="heading" numberOfLines={1}>
        {name}
      </AppText>

      <View style={styles.cartao}>
        <Text style={styles.cartaoTitulo}>Mês atual</Text>
        {atual.loading && mesAtual === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : atual.error !== null ? (
          <AppText variant="caption" color={colors.error}>
            {atual.error}
          </AppText>
        ) : mesAtual !== null ? (
          <>
            <View style={styles.numeros}>
              <View style={styles.numero}>
                <Text style={styles.numeroValor}>
                  {mesAtual.attended}/{mesAtual.totalClasses}
                </Text>
                <Text style={styles.numeroRotulo}>Presença em aulas</Text>
              </View>
              <View style={styles.numero}>
                <Text style={styles.numeroValor}>{formatarPercentual(mesAtual.frequencyPercent)}</Text>
                <Text style={styles.numeroRotulo}>Frequência</Text>
              </View>
            </View>
            <AppText variant="caption" color={colors.textSecondary}>
              A frequência considera só as aulas que já tiveram chamada concluída
              {mesAtual.justified > 0
                ? `, sem contar ${mesAtual.justified} falta(s) justificada(s).`
                : '.'}
            </AppText>
          </>
        ) : (
          <AppText variant="caption" color={colors.textSecondary}>
            Sem dados de frequência para este mês.
          </AppText>
        )}
      </View>

      <Text style={styles.tituloSecao}>MESES FECHADOS</Text>
    </View>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={historico}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          carregandoHistorico ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : erroHistorico !== null ? (
            <ErrorState message={erroHistorico} onRetry={() => void carregarHistorico()} />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhum mês fechado ainda"
              message="O mês é fechado no dia 1º seguinte e fica guardado aqui."
            />
          )
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: MonthlyHistoryRow): string => item.id;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 12, paddingBottom: 32, flexGrow: 1 },
    cabecalho: { gap: 4, marginBottom: 8 },
    sobrescrito: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    cartao: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      marginTop: 12,
    },
    cartaoTitulo: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textSecondary },
    numeros: { flexDirection: 'row', gap: 12 },
    numero: { flex: 1, gap: 2 },
    numeroValor: { fontFamily: fonts.headingBold, fontSize: 26, color: colors.textPrimary },
    numeroRotulo: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    tituloSecao: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 20,
      marginBottom: 4,
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 14,
      minHeight: 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linhaTexto: { flex: 1, gap: 2 },
    mes: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    detalhe: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    percentual: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.textPrimary },
    carregando: { marginTop: 24 },
  });
}
