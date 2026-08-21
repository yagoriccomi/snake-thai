import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { isValidEmail } from '@/utils/validation';

/**
 * Tela de login. A mesma tela atende administradores e alunos — o roteamento
 * pós-login (onboarding, lock de admin, painel) é decidido pelo estado de auth.
 */
export function LoginScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  /** "Próximo" no teclado do e-mail leva direto ao campo de senha. */
  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (password.length === 0) {
      setError('Informe sua senha.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signIn]);

  return (
    <ScreenWrapper avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.brand}>
          Snake Thai
        </AppText>
        <AppText variant="caption" style={styles.subtitle}>
          Acesse sua conta para continuar.
        </AppText>

        <Input
          label="E-mail"
          placeholder="voce@exemplo.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          onSubmitEditing={focusPassword}
          submitBehavior="submit"
        />
        <Input
          ref={passwordRef}
          label="Senha"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {error !== null ? (
          <AppText variant="caption" color={colors.error} style={styles.error}>
            {error}
          </AppText>
        ) : null}

        <Button
          title="Entrar"
          onPress={handleSubmit}
          loading={submitting}
          accessibilityHint="Autentica e acessa o aplicativo"
          style={styles.submit}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  brand: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  error: {
    marginBottom: 8,
  },
  submit: {
    marginTop: 8,
  },
});
