import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { DecidirSolicitacaoSheet } from '@/components/DecidirSolicitacaoSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { useItensDaSolicitacao } from '@/hooks/useSolicitacoes';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import { ROTULO_DA_CATEGORIA, type Categoria } from '@/constants/solicitacoes';
import { marcarRetificacaoConferida, type ItemDaSolicitacao } from '@/services/solicitacoes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';
import { describeError } from '@/utils/errors';

const log = createLogger('ItensDaSolicitacaoScreen');

const SCREEN_EDGES = ['bottom'] as const;

const VAZIO: Readonly<Record<Categoria, string>> = {
  faltas_de_alunos: 'Nenhuma falta de aluno para decidir.',
  faltas_de_professores: 'Nenhuma falta de professor para decidir.',
  retificacao_de_chamadas: 'Nenhuma retificação para decidir ou conferir.',
  trocas_de_aula: 'Nenhuma troca de aula para decidir.',
  pagamentos_de_mensalidade: 'Nenhum comprovante para conferir.',
};

/**
 * Os itens de uma categoria da caixa (§ 9.3). Cada um leva ao lugar de
 * decidir: a folha da solicitação, o Conferido da retificação feita (D30 c)
 * ou o Financeiro, no comprovante.
 */
export function ItensDaSolicitacaoScreen({
  navigation,
  route,
}: AulasStackScreenProps<'ItensDaSolicitacao'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { categoria } = route.params;
  const itens = useItensDaSolicitacao(categoria);
  const recarregar = itens.reload;
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const conferir = useCallback(
    async (id: string) => {
      setConferindo(id);
      setErro(null);
      try {
        await marcarRetificacaoConferida(id);
        void recarregar();
      } catch (falha) {
        log.error('Falha ao marcar a retificação como conferida', falha, { motivoId: id });
        setErro(describeError(falha));
      } finally {
        setConferindo(null);
      }
    },
    [recarregar],
  );

  const verChamada = useCallback(
    (item: ItemDaSolicitacao) => {
      if (item.classId === null) return;
      navigation.navigate('Frequencia', { classId: item.classId, title: item.titulo, groupId: null, canManage: true });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ItemDaSolicitacao }) => (
      <View style={styles.cartao}>
        <View style={styles.topo}>
          <Text style={styles.nome} numberOfLines={1}>
            {item.nome ?? 'Pessoa'}
          </Text>
          {item.tipo === 'retificacao_feita' ? <Selo texto="Retificação feita" tom="neutro" /> : null}
        </View>
        <Text style={styles.legenda}>
          {item.tipo === 'comprovante' ? item.titulo : `${item.titulo} · ${formatFullDateTime(item.quando)}`}
        </Text>
        <View style={styles.acoes}>
          {item.tipo === 'solicitacao' ? (
            <Pressable
              onPress={() => setDecidindo(item.id)}
              style={[styles.botao, styles.botaoPrincipal]}
              accessibilityRole="button"
              accessibilityLabel={`Decidir o pedido de ${item.nome ?? 'pessoa'}`}
            >
              <Text style={styles.botaoTexto}>Decidir</Text>
            </Pressable>
          ) : null}
          {item.tipo === 'retificacao_feita' ? (
            <>
              <Pressable onPress={() => verChamada(item)} style={styles.botao} accessibilityRole="button">
                <Text style={styles.botaoTexto}>Ver chamada</Text>
              </Pressable>
              <Pressable
                onPress={() => void conferir(item.id)}
                disabled={conferindo !== null}
                style={[styles.botao, styles.botaoPrincipal]}
                accessibilityRole="button"
                accessibilityLabel={`Conferido: retificação de ${item.nome ?? 'alguém da equipe'}`}
              >
                {conferindo === item.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.botaoTexto}>Conferido</Text>
                )}
              </Pressable>
            </>
          ) : null}
          {item.tipo === 'comprovante' ? (
            <Pressable
              onPress={() => navigation.navigate('Financeiro', { screen: 'FinanceiroHome' })}
              style={[styles.botao, styles.botaoPrincipal]}
              accessibilityRole="button"
              accessibilityHint="Abre o Financeiro, onde o comprovante é aprovado"
            >
              <Text style={styles.botaoTexto}>Abrir no Financeiro</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    ),
    [styles, colors.primary, conferir, conferindo, verChamada, navigation],
  );

  if (itens.error !== null && itens.items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={itens.error} onRetry={() => void recarregar()} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <FlatList
        data={itens.items}
        keyExtractor={(item) => `${item.tipo}:${item.id}`}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.cabecalho}>
            <AppText variant="subtitle" accessibilityRole="header">
              {ROTULO_DA_CATEGORIA[categoria]}
            </AppText>
            {erro !== null ? (
              <AppText variant="caption" color={colors.error} accessibilityRole="alert">
                {erro}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          itens.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title="Nada por aqui" message={VAZIO[categoria]} />
          )
        }
        refreshControl={
          <RefreshControl refreshing={itens.loading && itens.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.conteudo}
      />
      <DecidirSolicitacaoSheet id={decidindo} onClose={() => setDecidindo(null)} onDecidida={() => void recarregar()} />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
    cabecalho: { gap: 6, paddingTop: 12, paddingBottom: 4 },
    cartao: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    topo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nome: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    legenda: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
    botao: {
      minHeight: 44,
      minWidth: 88,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoPrincipal: { borderColor: colors.primaryText },
    botaoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    carregando: { marginTop: 24 },
  });
}
