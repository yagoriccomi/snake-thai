import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Tela de bloqueio biométrico do administrador. Exigida na abertura do app e a
 * cada retorno ao foreground: sem confirmar a identidade, o admin não navega.
 */
export function BiometricLockScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { unlockAdmin, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const attemptUnlock = useCallback(async () => {
    setError(null);
    const unlocked = await unlockAdmin();
    if (!unlocked) {
      setError('Não foi possível confirmar sua identidade. Tente novamente.');
    }
  }, [unlockAdmin]);

  // Dispara a biometria automaticamente ao abrir a tela.
  useEffect(() => {
    void attemptUnlock();
  }, [attemptUnlock]);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Ionicons name="finger-print" size={72} color={colors.primary} />
        <AppText variant="heading" style={styles.title}>
          Acesso protegido
        </AppText>
        <AppText variant="caption" style={styles.message}>
          Confirme sua biometria para acessar o painel de administrador.
        </AppText>
        {error !== null ? (
          <AppText variant="caption" color={colors.error} style={styles.message}>
            {error}
          </AppText>
        ) : null}
        <Button title="Desbloquear" onPress={attemptUnlock} style={styles.button} />
        <Button
          title="Sair"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.button}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    marginTop: 16,
  },
  message: {
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
