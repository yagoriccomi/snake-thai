import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { DecidirJustificativaSheet } from '@/components/DecidirJustificativaSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErroAoAtualizar } from '@/components/ErroAoAtualizar';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { useJustificativasParaRevisar } from '@/hooks/useJustificativas';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import { fetchJustificationAttachmentUrl, type JustificativaParaRevisar } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
import { assuntoDaJustificativa } from '@/utils/justificativas';
import { ehUrlDeAnexoConfiavel } from '@/utils/url';

const log = createLogger('JustificativasParaRevisarScreen');

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Justificativas para revisar (§ 9.1, D14, mockup da linha D): só as
 * pendentes que quem abre pode decidir. Depois da decisão, a linha some
 * daqui e só o dono e o admin voltam a vê-la (D22).
 */
export function JustificativasParaRevisarScreen(_props: AulasStackScreenProps<'JustificativasParaRevisar'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const lista = useJustificativasParaRevisar();
  const recarregar = lista.reload;
  const [emRevisao, setEmRevisao] = useState<JustificativaParaRevisar | null>(null);
  const [abrindoAnexo, setAbrindoAnexo] = useState<string | null>(null);
  const [erroDoAnexo, setErroDoAnexo] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const verAnexo = useCallback(async (id: string) => {
    setAbrindoAnexo(id);
    setErroDoAnexo(null);
    try {
      const { url } = await fetchJustificationAttachmentUrl(id);
      // O atestado só abre de onde ele mora: nada de esquema ou host inesperado.
      if (!ehUrlDeAnexoConfiavel(url)) {
        throw new Error('Endereço de anexo inesperado.');
      }
      await Linking.openURL(url);
    } catch (falha) {
      log.warn('Falha ao abrir o anexo da justificativa', falha, { justificationId: id });
      setErroDoAnexo(describeError(falha));
    } finally {
      setAbrindoAnexo(null);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: JustificativaParaRevisar }) => (
      <View style={styles.cartao}>
        <View style={styles.topo}>
          <Text style={styles.nome} numberOfLines={1}>
            {item.studentName ?? 'Aluno'}
          </Text>
          <Selo texto={item.scope === 'week' ? 'Semana' : 'Aula'} tom="neutro" />
          {item.attempt >= 2 ? <Selo texto="2ª tentativa" tom="aviso" /> : null}
        </View>
        <Text style={styles.legenda}>{assuntoDaJustificativa(item)}</Text>
        {item.message !== null ? (
          <Text style={styles.mensagem} numberOfLines={4}>
            {item.message}
          </Text>
        ) : null}
        <View style={styles.acoes}>
          {item.hasAttachment ? (
            <Pressable
              onPress={() => void verAnexo(item.id)}
              disabled={abrindoAnexo !== null}
              style={styles.botao}
              accessibilityRole="button"
              accessibilityLabel={`Ver o anexo da justificativa de ${item.studentName ?? 'aluno'}`}
            >
              {abrindoAnexo === item.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.botaoTexto}>Ver anexo</Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setEmRevisao(item)}
            style={[styles.botao, styles.botaoPrincipal]}
            accessibilityRole="button"
            accessibilityLabel={`Revisar a justificativa de ${item.studentName ?? 'aluno'}`}
          >
            <Text style={styles.botaoTexto}>Revisar</Text>
          </Pressable>
        </View>
      </View>
    ),
    [styles, colors.primary, verAnexo, abrindoAnexo],
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
        ListHeaderComponent={
          <>
            <ErroAoAtualizar mensagem={lista.error} />
            {erroDoAnexo !== null ? (
              <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.erro}>
                {erroDoAnexo}
              </AppText>
            ) : null}
          </>
        }
        ListEmptyComponent={
          lista.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title="Nada para revisar" message="Quando um aluno justificar uma falta, ela aparece aqui." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={lista.loading && lista.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.conteudo}
      />
      <DecidirJustificativaSheet justificativa={emRevisao} onClose={() => setEmRevisao(null)} onDecidida={() => void recarregar()} />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 10, flexGrow: 1 },
    erro: { paddingBottom: 4 },
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
    mensagem: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
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
