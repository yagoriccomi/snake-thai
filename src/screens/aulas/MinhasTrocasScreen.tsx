import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { BlocoDeContato } from '@/components/BlocoDeContato';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { useListaRemota } from '@/hooks/useListaRemota';
import type { AulasStackScreenProps } from '@/navigation/types';
import { fetchMinhasTrocas, type MinhaTroca } from '@/services/trocas.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { TomDoSelo } from '@/utils/aulasDoAluno';
import { descricaoDaAulaDaTroca, ROTULO_DO_TIPO, rotuloDaTroca, tomDaTroca } from '@/utils/trocas';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Minhas trocas (§ 9.4, § 3): os pedidos do fixo, dos últimos 60 dias e os
 * futuros, com o estado de cada um. A negada leva o bloco de contato (§ 5.4);
 * quem negou nunca aparece (D16). Desistir fica na linha da aula.
 */
export function MinhasTrocasScreen(_props: AulasStackScreenProps<'MinhasTrocas'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const lista = useListaRemota(fetchMinhasTrocas, 'Não foi possível carregar as suas trocas.');
  const recarregar = lista.reload;

  const cor = useMemo<Record<TomDoSelo, string>>(
    () => ({ neutro: colors.textSecondary, destaque: colors.primaryText, aviso: colors.warning, erro: colors.error }),
    [colors],
  );

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const renderItem = useCallback(
    ({ item }: { item: MinhaTroca }) => (
      <View style={styles.cartao}>
        <View style={styles.topo}>
          <Selo texto={ROTULO_DO_TIPO[item.kind]} tom="neutro" />
          {item.isMakeup ? <Selo texto="Reposição" tom="aviso" /> : null}
        </View>
        <Text style={styles.linha}>{`Sai: ${descricaoDaAulaDaTroca(item.fromTitle, item.fromDateTime)}`}</Text>
        <Text style={styles.linha}>{`Entra: ${descricaoDaAulaDaTroca(item.toTitle, item.toDateTime)}`}</Text>
        <Text style={[styles.estado, { color: cor[tomDaTroca(item.status)] }]}>{rotuloDaTroca(item)}</Text>
        {item.status === 'rejected' ? <BlocoDeContato /> : null}
      </View>
    ),
    [styles, cor],
  );

  if (lista.error !== null && lista.items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={lista.error} onRetry={() => void recarregar()} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <FlatList
        data={lista.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          lista.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="swap-horizontal-outline" title="Nenhuma troca" message="As trocas que você pedir aparecem aqui." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={lista.loading && lista.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.conteudo}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10, flexGrow: 1 },
    cartao: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    topo: { flexDirection: 'row', gap: 6 },
    linha: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
    estado: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
    carregando: { marginTop: 24 },
  });
}
