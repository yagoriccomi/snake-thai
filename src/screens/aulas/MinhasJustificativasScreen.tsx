import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { BlocoDeContato } from '@/components/BlocoDeContato';
import { EmptyState } from '@/components/EmptyState';
import { ErroAoAtualizar } from '@/components/ErroAoAtualizar';
import { ErrorState } from '@/components/ErrorState';
import { JustificationSheet, type JustificationDraft } from '@/components/JustificationSheet';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useMinhasJustificativas } from '@/hooks/useJustificativas';
import type { AulasStackScreenProps } from '@/navigation/types';
import { reenviarJustificativa, type MinhaJustificativa } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { TomDoSelo } from '@/utils/aulasDoAluno';
import {
  assuntoDaJustificativa,
  negadaPelaSegundaVez,
  rotuloDaJustificativa,
  tomDaJustificativa,
} from '@/utils/justificativas';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Minhas justificativas (§ 9.1 e § 3, D42): cada uma com o rótulo do estado.
 * A 1ª negada pode ser reenviada em até 7 dias; a 2ª negada encerra o caminho
 * e mostra o contato da academia (§ 5.4). A nota da decisão nunca aparece (D16).
 */
export function MinhasJustificativasScreen(_props: AulasStackScreenProps<'MinhasJustificativas'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const lista = useMinhasJustificativas();
  const recarregar = lista.reload;
  const [reenviando, setReenviando] = useState<MinhaJustificativa | null>(null);

  const corDoTom = useMemo<Record<TomDoSelo, string>>(
    () => ({ neutro: colors.textSecondary, destaque: colors.primaryText, aviso: colors.warning, erro: colors.error }),
    [colors],
  );

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const reenviar = useCallback(
    async (draft: JustificationDraft): Promise<void> => {
      if (reenviando === null) return;
      await reenviarJustificativa(reenviando.id, draft.message);
      void recarregar();
    },
    [reenviando, recarregar],
  );

  const renderItem = useCallback(
    ({ item }: { item: MinhaJustificativa }) => (
      <View style={styles.cartao}>
        <Text style={styles.assunto}>{assuntoDaJustificativa(item)}</Text>
        {item.message !== null ? (
          <Text style={styles.mensagem} numberOfLines={3}>
            {item.message}
          </Text>
        ) : null}
        <Text style={[styles.estado, { color: corDoTom[tomDaJustificativa(item.status)] }]}>{rotuloDaJustificativa(item)}</Text>
        {item.canResend ? (
          <Pressable
            onPress={() => setReenviando(item)}
            style={styles.botao}
            accessibilityRole="button"
            accessibilityLabel={`Reenviar a justificativa de ${assuntoDaJustificativa(item)}`}
          >
            <Text style={styles.botaoTexto}>Reenviar</Text>
          </Pressable>
        ) : null}
        {negadaPelaSegundaVez(item) ? <BlocoDeContato /> : null}
      </View>
    ),
    [styles, corDoTom],
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
            <EmptyState icon="document-text-outline" title="Nenhuma justificativa" message="As justificativas que você enviar aparecem aqui." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={lista.loading && lista.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.conteudo}
      />
      {reenviando !== null ? (
        <JustificationSheet
          key={reenviando.id}
          visible
          titulo="Reenviar justificativa"
          contexto={`${assuntoDaJustificativa(reenviando)} · é a última tentativa.`}
          perguntarSeQuer={false}
          permiteAnexo={false}
          onClose={() => setReenviando(null)}
          onSubmit={reenviar}
        />
      ) : null}
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
    assunto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    mensagem: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
    estado: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
    botao: {
      alignSelf: 'flex-start',
      minHeight: 44,
      minWidth: 88,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    carregando: { marginTop: 24 },
  });
}
