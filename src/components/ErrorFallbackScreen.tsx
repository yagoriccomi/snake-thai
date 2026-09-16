import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

interface ErrorFallbackScreenProps {
  /** Remonta o app a partir do ponto em que o erro aconteceu. */
  onTentarDeNovo: () => void;
}

/**
 * Tela mostrada quando um erro de renderização derruba o app.
 *
 * Sem navegação nem sessão (estão abaixo do ErrorBoundary) e sem detalhe
 * técnico: a stack vai para o log e para o monitoramento, e aqui fica só o que
 * a pessoa pode fazer. [#93]
 */
export function ErrorFallbackScreen({ onTentarDeNovo }: ErrorFallbackScreenProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.tela, { backgroundColor: colors.background }]}>
      <View style={styles.conteudo}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.textos}>
          <AppText variant="subtitle" style={styles.centro}>
            Algo deu errado
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} style={styles.centro}>
            O erro foi registrado. Tente de novo.
          </AppText>
        </View>
        <Button
          title="Tentar de novo"
          onPress={onTentarDeNovo}
          accessibilityHint="Recarrega o aplicativo a partir da tela inicial"
          style={styles.acao}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1 },
  conteudo: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  textos: { gap: 6 },
  centro: { textAlign: 'center' },
  acao: { alignSelf: 'stretch', marginTop: 8 },
});
