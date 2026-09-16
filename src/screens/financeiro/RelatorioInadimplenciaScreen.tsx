import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ALTURA_DA_LINHA_DE_DEVEDOR, DelinquentStudentRow } from '@/components/PainelStudentRows';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import type { Fonts } from '@/constants/theme';
import { useDelinquencyReport, type FiltroDeFaixa } from '@/hooks/useDelinquencyReport';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import type { Devedor } from '@/services/painel.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { contagem } from '@/utils/painel';

const SCREEN_EDGES = ['bottom'] as const;

const FILTROS: ReadonlyArray<SegmentOption<FiltroDeFaixa>> = [
  { value: 'todas', label: 'Todas' },
  { value: '1-30', label: '1–30' },
  { value: '31-60', label: '31–60' },
  { value: '60+', label: '60+' },
];

/**
 * Relatório de inadimplência (admin): quem deve, quanto e há quanto tempo,
 * do maior atraso para o menor. Tocar num aluno abre o histórico de
 * pagamentos, onde se dá baixa; ao voltar, a lista recarrega.
 *
 * Só nome, turma e valores saem do banco. Nada é guardado no aparelho.
 */
export function RelatorioInadimplenciaScreen({
  navigation,
}: FinanceiroStackScreenProps<'RelatorioInadimplencia'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [filtro, setFiltro] = useState<FiltroDeFaixa>('todas');
  const { linhas, totalCents, totalDeDevedores, loading, error, reload } = useDelinquencyReport(filtro);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const abrirHistorico = useCallback(
    (devedor: Devedor) => navigation.navigate('HistoricoPagamentosAluno', { userId: devedor.userId, name: devedor.nome }),
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<Devedor>>(
    ({ item }) => <DelinquentStudentRow devedor={item} onPress={abrirHistorico} />,
    [abrirHistorico],
  );

  const cabecalho = (
    <View style={styles.cabecalho}>
      <View
        accessible
        accessibilityLabel={`${formatCents(totalCents)} em atraso, ${contagem(linhas.length, 'aluno', 'alunos')}`}
      >
        <Text style={[styles.total, totalCents > 0 ? styles.totalEmAtraso : null]}>{formatCents(totalCents)}</Text>
        <Text style={styles.subtitulo}>em atraso · {contagem(linhas.length, 'aluno', 'alunos')}</Text>
      </View>
      <SegmentedControl options={FILTROS} value={filtro} onChange={setFiltro} />
      <AppText variant="caption" color={colors.textSecondary}>
        Mensalidades em aberto ou vencidas com vencimento antes de hoje. Comprovante em análise não entra. A faixa é
        a do maior atraso do aluno.
      </AppText>
      {loading && linhas.length > 0 ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Atualizando" />
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={error !== null ? [] : linhas}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        initialNumToRender={12}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          error !== null ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.carregando} accessibilityLabel="Carregando" />
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title={totalDeDevedores === 0 ? 'Ninguém em atraso' : 'Ninguém nesta faixa'}
              message={
                totalDeDevedores === 0
                  ? 'Todas as mensalidades vencidas foram pagas ou estão em análise.'
                  : 'Escolha outra faixa de atraso.'
              }
            />
          )
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: Devedor): string => item.userId;

const getItemLayout = (_data: ArrayLike<Devedor> | null | undefined, index: number) => ({
  length: ALTURA_DA_LINHA_DE_DEVEDOR,
  offset: ALTURA_DA_LINHA_DE_DEVEDOR * index,
  index,
});

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    content: {
      paddingBottom: 24,
      flexGrow: 1,
    },
    cabecalho: {
      paddingTop: 12,
      paddingBottom: 12,
      gap: 12,
    },
    total: {
      fontFamily: fonts.bodyBold,
      fontSize: 28,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    totalEmAtraso: {
      color: colors.error,
    },
    subtitulo: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    carregando: {
      marginTop: 32,
    },
  });
}
