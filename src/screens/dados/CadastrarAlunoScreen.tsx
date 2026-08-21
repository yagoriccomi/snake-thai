import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GroupPicker } from '@/components/GroupPicker';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import type { DadosStackScreenProps } from '@/navigation/types';
import { createStudent } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { isValidEmail } from '@/utils/validation';

/**
 * Cadastro de novo aluno (admin). Cria a conta com a senha padrão e inicializa
 * o perfil pendente — via Edge Function `create-student` (service_role, nunca
 * no cliente). O aluno troca a senha no onboarding do primeiro acesso.
 */
export function CadastrarAlunoScreen({
  navigation,
}: DadosStackScreenProps<'CadastrarAluno'>): React.JSX.Element {
  const { colors } = useTheme();
  const { settings } = useAcademySettings();

  // Senha inicial definida pelo admin nas configuracoes da academia.
  const defaultPassword = settings?.default_student_password ?? 'Snake@123';

  const [email, setEmail] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setSubmitting(true);
    try {
      await createStudent(email, groupId);
      setSuccess(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error &&
        /already|exist|registered|duplicate/i.test(submitError.message)
          ? 'Já existe um usuário com este e-mail.'
          : 'Não foi possível cadastrar o aluno. Tente novamente.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [email, groupId]);

  const handleReset = useCallback(() => {
    setEmail('');
    setGroupId(null);
    setSuccess(false);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (success) {
    return (
      <ScreenWrapper avoidKeyboard>
        <View style={styles.center}>
          <AppText variant="heading">Aluno cadastrado! ✅</AppText>
          <AppText variant="caption" style={styles.message}>
            A conta foi criada com a senha padrão{' '}
            <AppText variant="caption" color={colors.primaryText}>
              {defaultPassword}
            </AppText>
            . O aluno deverá trocá-la no primeiro acesso.
          </AppText>
          <Button title="Cadastrar outro" onPress={handleReset} style={styles.button} />
          <Button
            title="Voltar"
            variant="secondary"
            onPress={handleBack}
            style={styles.button}
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper avoidKeyboard>
      <View style={styles.form}>
        <AppText variant="caption" style={styles.message}>
          Informe o e-mail do aluno. A conta será criada com a senha padrão{' '}
          <AppText variant="caption" color={colors.primaryText}>
            {defaultPassword}
          </AppText>
          , exigindo troca no primeiro acesso.
        </AppText>

        <Input
          label="E-mail do aluno"
          placeholder="aluno@exemplo.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={error ?? undefined}
        />

        <GroupPicker label="Turma (opcional)" value={groupId} onChange={setGroupId} />

        <Button
          title="Cadastrar aluno"
          onPress={handleSubmit}
          loading={submitting}
          style={styles.button}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
    paddingTop: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  message: {
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
