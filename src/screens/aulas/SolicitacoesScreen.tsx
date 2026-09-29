import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useCaixaDeSolicitacoes } from '@/hooks/useSolicitacoes';
import type { AulasStackScreenProps } from '@/navigation/types';
import { ROTULO_DA_CATEGORIA, type Categoria } from '@/constants/solicitacoes';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Solicitações (§ 9.3 e § 3, mockups da linha D): as categorias que quem abre
 * vê, na ordem da § 3, com o que falta decidir; e os pedidos da própria pessoa.
 */
export function SolicitacoesScreen({ navigation }: AulasStackScreenProps<'Solicitacoes'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const caixa = useCaixaDeSolicitacoes();
  const recarregar = caixa.reload;

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const abrir = useCallback(
    (categoria: Categoria) => {
      // As faltas de alunos já têm a tela de revisão do 4.8.
      if (categoria === 'faltas_de_alunos') {
        navigation.navigate('JustificativasParaRevisar');
        return;
      }
      navigation.navigate('ItensDaSolicitacao', { categoria });
    },
    [navigation],
  );

  const conteudo = (): React.JSX.Element => {
    if (caixa.loading && caixa.items.length === 0) {
      return <ActivityIndicator color={colors.primary} style={styles.carregando} />;
    }
    if (caixa.error !== null && caixa.items.length === 0) {
      return <ErrorState message={caixa.error} onRetry={() => void recarregar()} />;
    }
    return (
      <View style={styles.lista} accessibilityRole="list">
        {caixa.items.map(({ categoria, quantidade }) => (
          <Pressable
            key={categoria}
            onPress={() => abrir(categoria)}
            style={styles.linha}
            accessibilityRole="button"
            accessibilityLabel={`${ROTULO_DA_CATEGORIA[categoria]}: ${quantidade}`}
          >
            <Text style={styles.titulo}>{ROTULO_DA_CATEGORIA[categoria]}</Text>
            {quantidade > 0 ? (
              <View style={styles.contador}>
                <Text style={styles.contadorTexto}>{quantidade}</Text>
              </View>
            ) : (
              <Text style={styles.zero}>0</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl refreshing={caixa.loading && caixa.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
      >
        {conteudo()}
        <Pressable
          onPress={() => navigation.navigate('MinhasSolicitacoes')}
          style={styles.linha}
          accessibilityRole="button"
          accessibilityHint="Abre os pedidos que você fez ao admin"
        >
          <Ionicons name="paper-plane-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.titulo}>Meus pedidos</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 12, paddingBottom: 24, gap: 16, flexGrow: 1 },
    carregando: { marginTop: 24 },
    lista: { gap: 8 },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    titulo: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    zero: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
    contador: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
    },
    contadorTexto: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.background },
  });
}
