import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { BlocoDeContato } from '@/components/BlocoDeContato';
import { EmptyState } from '@/components/EmptyState';
import { ErroAoAtualizar } from '@/components/ErroAoAtualizar';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useMinhasSolicitacoes } from '@/hooks/useSolicitacoes';
import type { AulasStackScreenProps } from '@/navigation/types';
import { ROTULO_DO_PEDIDO, type EstadoDaSolicitacao } from '@/constants/solicitacoes';
import { type MinhaSolicitacao } from '@/services/solicitacoes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;

/** Estado do pedido para a pessoa: quem negou nunca aparece (D16). */
export function rotuloDoPedido(pedido: Pick<MinhaSolicitacao, 'status' | 'approvedByName'>): string {
  if (pedido.status === 'pending') return 'Pedido em análise';
  if (pedido.status === 'approved') {
    return pedido.approvedByName !== null ? `Pedido aprovado por ${pedido.approvedByName}` : 'Pedido aprovado';
  }
  return 'Pedido negado';
}

/**
 * Meus pedidos (§ 9.3): "Eu estava na aula" do aluno e os pedidos do
 * professor ao admin. Negado leva o bloco de contato (§ 5.4). Sem reenvio (T19).
 */
export function MinhasSolicitacoesScreen(_props: AulasStackScreenProps<'MinhasSolicitacoes'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const lista = useMinhasSolicitacoes();
  const recarregar = lista.reload;

  const corDoEstado = useMemo<Record<EstadoDaSolicitacao, string>>(
    () => ({ pending: colors.warning, approved: colors.primaryText, rejected: colors.error }),
    [colors],
  );

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const renderItem = useCallback(
    ({ item }: { item: MinhaSolicitacao }) => (
      <View style={styles.cartao}>
        <Text style={styles.titulo}>{ROTULO_DO_PEDIDO[item.kind]}</Text>
        <Text style={styles.legenda}>{`${item.classTitle} · ${formatFullDateTime(item.classDateTime)}`}</Text>
        <Text style={[styles.estado, { color: corDoEstado[item.status] }]}>{rotuloDoPedido(item)}</Text>
        {item.status === 'rejected' ? <BlocoDeContato /> : null}
      </View>
    ),
    [styles, corDoEstado],
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
        ListHeaderComponent={<ErroAoAtualizar mensagem={lista.error} />}
        ListEmptyComponent={
          lista.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="paper-plane-outline" title="Nenhum pedido" message="Os pedidos que você fizer aparecem aqui." />
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
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    legenda: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    estado: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
    carregando: { marginTop: 24 },
  });
}
