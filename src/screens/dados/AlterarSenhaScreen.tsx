import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import type { DadosStackScreenProps } from '@/navigation/types';
import { changeOwnPassword } from '@/services/auth.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeMissingPasswordRules } from '@/utils/validation';

/** Campos com mensagem de erro no formulário de troca de senha. */
type PasswordErrors = Partial<
  Record<'current' | 'next' | 'confirm' | 'form', string>
>;

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Troca da própria senha, para qualquer papel.
 *
 * Exige a senha atual: a sessão sozinha não basta, senão um celular
 * desbloqueado bastaria para tomar a conta. A nova senha passa pela mesma
 * política do onboarding, com o checklist ao vivo do que ainda falta.
 */
export function AlterarSenhaScreen({
  navigation,
}: DadosStackScreenProps<'AlterarSenha'>): React.JSX.Element {
  const { colors } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(async () => {
    const validation: PasswordErrors = {};
    if (current.length === 0) {
      validation.current = 'Informe sua senha atual.';
    }
    const missing = describeMissingPasswordRules(next);
    if (missing !== null) {
      validation.next = missing;
    }
    if (next === current && current.length > 0) {
      validation.next = 'A nova senha precisa ser diferente da atual.';
    }
    if (next !== confirm) {
      validation.confirm = 'As senhas não coincidem.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await changeOwnPassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      navigation.goBack();
    } catch (changeError) {
      const isWrongPassword =
        changeError instanceof Error &&
        changeError.message === 'SENHA_ATUAL_INVALIDA';
      setErrors({
        form: isWrongPassword
          ? 'Senha atual incorreta.'
          : 'Não foi possível alterar a senha. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }, [current, next, confirm, navigation]);

  const handlePress = useCallback(() => void handleSubmit(), [handleSubmit]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="caption" style={styles.intro}>
          Para sua segurança, confirme a senha atual antes de definir a nova.
        </AppText>

        <Input
          label="Senha atual"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          value={current}
          onChangeText={setCurrent}
          error={errors.current}
        />
        <Input
          label="Nova senha"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={next}
          onChangeText={setNext}
          error={errors.next}
        />
        <PasswordRequirements password={next} />
        <Input
          label="Confirmar nova senha"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={confirm}
          onChangeText={setConfirm}
          error={errors.confirm}
        />

        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error}>
            {errors.form}
          </AppText>
        ) : null}
        {done ? (
          <AppText variant="caption" color={colors.success}>
            Senha alterada com sucesso.
          </AppText>
        ) : null}

        <Button
          title="Alterar senha"
          onPress={handlePress}
          loading={saving}
          accessibilityHint="Confirma a senha atual e grava a nova senha"
          style={styles.submit}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
  },
  intro: {
    marginBottom: 16,
  },
  submit: {
    marginTop: 16,
  },
});
