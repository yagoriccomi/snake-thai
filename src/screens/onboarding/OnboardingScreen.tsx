import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Input } from '@/components/Input';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { updatePassword } from '@/services/auth.service';
import { completeProfileOnboarding } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { dateBrToIso, maskCpf, maskDate, maskPhone, onlyDigits } from '@/utils/masks';
import {
  describeMissingPasswordRules,
  isValidBirthDate,
  isValidCpf,
  isValidName,
  isValidPhone,
} from '@/utils/validation';

/** Campos com mensagem de erro no formulário de onboarding. */
type OnboardingErrors = Partial<
  Record<
    'name' | 'phone' | 'cpf' | 'dob' | 'password' | 'confirmPassword' | 'lgpd' | 'form',
    string
  >
>;

/**
 * Onboarding obrigatório (primeiro login). Bloqueia o app até o aluno:
 * 1) informar dados pessoais (nome, celular, CPF, nascimento);
 * 2) trocar a senha padrão por uma forte;
 * 3) aceitar o termo LGPD.
 *
 * Ao concluir, atualiza a senha em `auth.users` e o perfil (is_first_login=false).
 * A UI mostra valores mascarados, mas só dígitos sanitizados vão ao backend.
 */
export function OnboardingScreen(): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { session, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleCpfChange = useCallback((value: string) => setCpf(maskCpf(value)), []);
  const handlePhoneChange = useCallback((value: string) => setPhone(maskPhone(value)), []);
  const handleDobChange = useCallback((value: string) => setDob(maskDate(value)), []);
  const handleLgpdChange = useCallback((value: boolean) => setLgpdAccepted(value), []);

  const validate = useCallback((): boolean => {
    const next: OnboardingErrors = {};
    if (!isValidName(name)) {
      next.name = 'Informe seu nome completo (mín. 3 caracteres).';
    }
    if (!isValidPhone(phone)) {
      next.phone = 'Informe um celular válido com DDD.';
    }
    if (!isValidCpf(cpf)) {
      next.cpf = 'CPF inválido.';
    }
    if (!isValidBirthDate(dob)) {
      next.dob = 'Data de nascimento inválida.';
    }
    const missingPasswordRules = describeMissingPasswordRules(password);
    if (missingPasswordRules !== null) {
      next.password = missingPasswordRules;
    }
    if (password !== confirmPassword) {
      next.confirmPassword = 'As senhas não coincidem.';
    }
    if (!lgpdAccepted) {
      next.lgpd = 'É necessário aceitar os Termos e a Política de Privacidade.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, phone, cpf, dob, password, confirmPassword, lgpdAccepted]);

  const handleSubmit = useCallback(async () => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }
    if (!validate()) {
      return;
    }
    const isoDob = dateBrToIso(dob);
    if (isoDob === null) {
      setErrors((previous) => ({ ...previous, dob: 'Data de nascimento inválida.' }));
      return;
    }

    setSubmitting(true);
    try {
      // Ordem importa: troca a senha ANTES de marcar o onboarding como concluído.
      await updatePassword(password);
      await completeProfileOnboarding(userId, {
        name,
        cpf: onlyDigits(cpf),
        phone: onlyDigits(phone),
        dob: isoDob,
      });
      await refreshProfile();
    } catch (submitError) {
      const message =
        submitError instanceof Error && /duplicate|unique/i.test(submitError.message)
          ? 'Este CPF já está cadastrado.'
          : 'Não foi possível concluir o cadastro. Tente novamente.';
      setErrors((previous) => ({ ...previous, form: message }));
    } finally {
      setSubmitting(false);
    }
  }, [session, validate, dob, password, name, cpf, phone, refreshProfile]);

  return (
    <ScreenWrapper avoidKeyboard>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={styles.title}>
          Bem-vindo!
        </AppText>
        <AppText variant="caption" style={styles.subtitle}>
          Complete seu cadastro para começar a treinar.
        </AppText>

        <AppText variant="subtitle" style={styles.section}>
          Dados pessoais
        </AppText>
        <Input
          label="Nome completo"
          placeholder="Seu nome"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        <Input
          label="Celular"
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={handlePhoneChange}
          error={errors.phone}
        />
        <Input
          label="CPF"
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          value={cpf}
          onChangeText={handleCpfChange}
          error={errors.cpf}
        />
        <Input
          label="Data de nascimento"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={dob}
          onChangeText={handleDobChange}
          error={errors.dob}
        />

        <AppText variant="subtitle" style={styles.section}>
          Segurança da conta
        </AppText>
        <Input
          label="Nova senha"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <PasswordRequirements password={password} />
        <Input
          label="Confirmar nova senha"
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
        />

        <View style={styles.lgpd}>
          <Checkbox
            checked={lgpdAccepted}
            onChange={handleLgpdChange}
            accessibilityLabel="Concordo com os Termos de Uso e a Política de Privacidade"
          >
            <AppText variant="caption" color={colors.textPrimary}>
              Concordo com os Termos de Uso e a Política de Privacidade (LGPD).
            </AppText>
          </Checkbox>
          <AppText variant="caption" style={styles.lgpdHint}>
            Seus dados são armazenados de forma criptografada e usados apenas para
            fins gerenciais e financeiros da academia.
          </AppText>
          {errors.lgpd !== undefined ? (
            <AppText variant="caption" color={colors.error}>
              {errors.lgpd}
            </AppText>
          ) : null}
        </View>

        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error} style={styles.section}>
            {errors.form}
          </AppText>
        ) : null}

        <Button
          title="Concluir cadastro"
          onPress={handleSubmit}
          loading={submitting}
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
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  lgpd: {
    marginTop: 16,
    gap: 8,
  },
  lgpdHint: {
    marginLeft: 36,
  },
  submit: {
    marginTop: 24,
  },
});
