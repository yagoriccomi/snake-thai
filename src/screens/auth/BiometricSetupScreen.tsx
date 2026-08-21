import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Convite (uma única vez) para ativar o desbloqueio por digital.
 *
 * Aparece depois que o cadastro está completo e antes de o app liberar a
 * navegação. A escolha é gravada por usuário: quem recusa não é perguntado de
 * novo e entra direto; quem aceita passa a confirmar a identidade ao abrir o
 * app e a cada retorno do segundo plano.
 */
export function BiometricSetupScreen(): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { chooseBiometric } = useAuth();
  const [submitting, setSubmitting] = useState<'enable' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChoice = useCallback(
    async (enabled: boolean) => {
      setError(null);
      setSubmitting(enabled ? 'enable' : 'skip');
      try {
        await chooseBiometric(enabled);
      } catch {
        setError('Não foi possível registrar sua escolha. Tente novamente.');
      } finally {
        setSubmitting(null);
      }
    },
    [chooseBiometric],
  );

  const handleEnable = useCallback(() => void handleChoice(true), [handleChoice]);
  const handleSkip = useCallback(() => void handleChoice(false), [handleChoice]);

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <View
          style={[styles.icon, { backgroundColor: colors.surface }]}
          accessible={false}
        >
          <Ionicons name="finger-print" size={56} color={colors.primary} />
        </View>

        <AppText variant="title" style={styles.title}>
          Usar sua digital?
        </AppText>
        <AppText variant="caption" style={styles.description}>
          Você pode exigir a impressão digital (ou o reconhecimento facial) para
          abrir o Snake Thai. É uma camada extra de proteção para seus dados
          pessoais e financeiros, sem precisar digitar a senha toda vez.
        </AppText>
        <AppText variant="caption" style={styles.description}>
          Pode mudar de ideia depois, na aba Dados.
        </AppText>

        {error !== null ? (
          <AppText
            variant="caption"
            color={colors.error}
            style={{ marginBottom: spacing.md }}
          >
            {error}
          </AppText>
        ) : null}

        <Button
          title="Ativar digital"
          onPress={handleEnable}
          loading={submitting === 'enable'}
          disabled={submitting !== null}
          accessibilityHint="Pede a confirmação da digital agora e passa a exigi-la ao abrir o app"
          style={styles.primaryAction}
        />
        <Button
          title="Agora não"
          variant="secondary"
          onPress={handleSkip}
          loading={submitting === 'skip'}
          disabled={submitting !== null}
          accessibilityHint="Entra no aplicativo sem exigir a digital"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  icon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 12,
  },
  primaryAction: {
    marginTop: 12,
    marginBottom: 8,
  },
});
