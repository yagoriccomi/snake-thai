import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import type { RootStackScreenProps } from '@/navigation/types';

/**
 * Tela de login (fluxo de autenticação).
 *
 * Provisória: demonstra os componentes do design system (Input/Button). O fluxo
 * real de autenticação com o Supabase entra na próxima fase; por ora, "Entrar"
 * apenas navega para o painel principal.
 */
export function LoginScreen({
  navigation,
}: RootStackScreenProps<'Login'>): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEnter = useCallback(() => {
    navigation.replace('Main', { screen: 'Aulas' });
  }, [navigation]);

  return (
    <ScreenWrapper>
      <View style={styles.content}>
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
        />
        <Input
          label="Senha"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          title="Entrar"
          onPress={handleEnter}
          accessibilityHint="Acessa o painel principal do aplicativo"
          style={styles.submit}
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
  brand: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 24,
  },
  submit: {
    marginTop: 8,
  },
});
