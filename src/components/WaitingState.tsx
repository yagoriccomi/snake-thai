import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

interface WaitingStateProps {
  /** O que está acontecendo agora, na linguagem do usuário. */
  message: string;
  /**
   * Explicação exibida quando a espera passa de `patienceMs`. Só faz sentido
   * quando a demora tem uma causa que o usuário consegue entender.
   */
  longWaitMessage?: string;
  /** A partir de quando a espera deixa de ser normal. */
  patienceMs?: number;
}

/**
 * Depois disto, uma espera deixa de parecer "carregando" e passa a parecer
 * "travou". É o momento de explicar, não de continuar girando calado. [#3]
 */
const DEFAULT_PATIENCE_MS = 4_000;

/**
 * Estado de espera de uma operação que pode demorar.
 *
 * Existe por causa de um problema concreto: o backend na Render hiberna no
 * plano free, e a primeira chamada depois disso leva 30–60 s
 * (`docs/BACKEND.md` §5). Um spinner mudo durante um minuto é
 * indistinguível de aplicativo travado — e o usuário fecha o app no meio do
 * envio do comprovante, justamente na hora em que ele mais precisa que dê
 * certo.
 *
 * A solução não é esconder a demora: é ser honesto sobre ela. Passados alguns
 * segundos, a tela explica o motivo e diz que a espera é esperada. Usuário
 * informado espera; usuário no escuro desiste. [#98]
 */
function WaitingStateComponent({
  message,
  longWaitMessage,
  patienceMs = DEFAULT_PATIENCE_MS,
}: WaitingStateProps): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const [demorando, setDemorando] = useState(false);

  useEffect(() => {
    if (longWaitMessage === undefined) {
      return;
    }
    const cronometro = setTimeout(() => {
      setDemorando(true);
    }, patienceMs);

    return () => {
      clearTimeout(cronometro);
    };
  }, [longWaitMessage, patienceMs]);

  return (
    <View
      style={[styles.container, { padding: spacing.xl }]}
      accessible
      accessibilityRole="progressbar"
      // `polite` para o leitor de tela anunciar a explicação quando ela
      // aparecer, sem atropelar o que o usuário estiver ouvindo.
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color={colors.primaryText} />

      <AppText variant="subtitle" style={styles.message}>
        {message}
      </AppText>

      {demorando && longWaitMessage !== undefined ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.detail}>
          {longWaitMessage}
        </AppText>
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
  message: {
    marginTop: 16,
    textAlign: 'center',
  },
  detail: {
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 300,
  },
});

export const WaitingState = React.memo(WaitingStateComponent);
