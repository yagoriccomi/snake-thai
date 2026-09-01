import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';

interface ErrorStateProps {
  /** Mensagem amigável, já traduzida para a linguagem do usuário. */
  message?: string;
  /** Ação de recuperação. Quando ausente, o bloco é apenas informativo. */
  onRetry?: () => void;
  /** Rótulo do botão de recuperação. */
  retryLabel?: string;
}

/** Texto padrão quando quem chama não tem nada mais específico a dizer. */
const DEFAULT_MESSAGE =
  'Não foi possível carregar estas informações. Verifique sua conexão e tente de novo.';

/**
 * Estado de erro de uma tela ou lista.
 *
 * Existe para acabar com a mentira mais comum de app mobile: quando a rede
 * falha e a lista aparece vazia, o usuário conclui que **não há dados** — que
 * não há aula marcada, que não deve nada. Informação errada apresentada com
 * confiança é pior que erro visível.
 *
 * Nunca recebe *stack trace*: o detalhe técnico vai para o log estruturado, e
 * aqui fica só o que a pessoa pode entender e resolver [#93].
 */
function ErrorStateComponent({
  message = DEFAULT_MESSAGE,
  onRetry,
  retryLabel = 'Tentar novamente',
}: ErrorStateProps): React.JSX.Element {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[styles.container, { padding: spacing.xl }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
      <AppText variant="subtitle" style={styles.title}>
        Algo não carregou
      </AppText>
      <AppText variant="caption" style={styles.message}>
        {message}
      </AppText>
      {onRetry !== undefined ? (
        <Button
          title={retryLabel}
          variant="secondary"
          onPress={onRetry}
          accessibilityHint="Tenta carregar as informações novamente"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 12,
    textAlign: 'center',
  },
  message: {
    marginTop: 4,
    textAlign: 'center',
  },
  action: {
    marginTop: 20,
    minWidth: 200,
  },
});

export const ErrorState = React.memo(ErrorStateComponent);
