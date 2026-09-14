import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Input } from '@/components/Input';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { updatePassword } from '@/services/auth.service';
import {
  completeProfileOnboarding,
  finishStaffOnboarding,
} from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
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

const SCREEN_EDGES = ['bottom'] as const;

/** Etapas possíveis do onboarding, identificadas por nome (não por índice). */
type OnboardingStep = 'dados' | 'senha' | 'termos';

const STEP_LABELS: Record<OnboardingStep, string> = {
  dados: 'Dados',
  senha: 'Senha',
  termos: 'Termos',
};

const STEP_HEADINGS: Record<OnboardingStep, { title: string; subtitle: string }> = {
  dados: { title: 'Seus dados', subtitle: 'Leva menos de um minuto.' },
  senha: {
    title: 'Segurança da conta',
    subtitle: 'Crie uma senha forte para proteger seu acesso.',
  },
  termos: { title: 'Termos', subtitle: 'Quase lá — só falta o aceite.' },
};

/**
 * Onboarding obrigatório (primeiro login):
 *   1) dados pessoais (nome, celular, CPF, nascimento);
 *   2) troca da senha padrão por uma forte;
 *   3) aceite do termo LGPD.
 *
 * A etapa de dados é PULADA para quem já nasce cadastrado — professor e admin
 * criados pelo admin via `create-staff` chegam aqui com nome e CPF prontos, e
 * pedir tudo de novo seria redigitação. As outras duas etapas nunca são
 * puladas: são elas que tiram a conta da senha padrão (pública) e registram o
 * aceite LGPD, o que vale para QUALQUER papel. [#54][#55]
 *
 * A validação acontece por etapa (só avança quando a etapa está válida) e de
 * novo no envio. Ao concluir, atualiza a senha em `auth.users` e o perfil
 * (is_first_login=false). A UI mostra valores mascarados; só dígitos sanitizados
 * vão ao backend.
 */
export function OnboardingScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, profile, refreshProfile } = useAuth();

  // Cadastro já veio pronto do admin: nome e CPF são exatamente o que a
  // constraint `profiles_complete_when_onboarded` exige para concluir.
  const cadastroJaCompleto =
    profile !== null && profile.name !== null && profile.cpf !== null;

  const steps = useMemo<OnboardingStep[]>(
    () => (cadastroJaCompleto ? ['senha', 'termos'] : ['dados', 'senha', 'termos']),
    [cadastroJaCompleto],
  );

  const [step, setStep] = useState(0);
  const stepAtual: OnboardingStep = steps[step] ?? 'senha';
  const ultimaEtapa = step === steps.length - 1;
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

  /** Erros da etapa 1 (dados pessoais). */
  const validateStep1 = useCallback((): OnboardingErrors => {
    const next: OnboardingErrors = {};
    if (!isValidName(name)) next.name = 'Informe seu nome completo (mín. 3 caracteres).';
    if (!isValidPhone(phone)) next.phone = 'Informe um celular válido com DDD.';
    if (!isValidCpf(cpf)) next.cpf = 'CPF inválido.';
    if (!isValidBirthDate(dob)) next.dob = 'Data de nascimento inválida.';
    return next;
  }, [name, phone, cpf, dob]);

  /** Erros da etapa 2 (senha). */
  const validateStep2 = useCallback((): OnboardingErrors => {
    const next: OnboardingErrors = {};
    const missing = describeMissingPasswordRules(password);
    if (missing !== null) next.password = missing;
    if (password !== confirmPassword) next.confirmPassword = 'As senhas não coincidem.';
    return next;
  }, [password, confirmPassword]);

  const goNext = useCallback(() => {
    const stepErrors = stepAtual === 'dados' ? validateStep1() : validateStep2();
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) {
      setStep((current) => Math.min(steps.length - 1, current + 1));
    }
  }, [stepAtual, steps.length, validateStep1, validateStep2]);

  const goBack = useCallback(() => {
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }
    // Revalida tudo antes de enviar; se algo de uma etapa anterior falhar,
    // volta para a etapa certa em vez de submeter escondido.
    let isoDob: string | null = null;
    if (!cadastroJaCompleto) {
      const step1 = validateStep1();
      if (Object.keys(step1).length > 0) {
        setErrors(step1);
        setStep(steps.indexOf('dados'));
        return;
      }
      isoDob = dateBrToIso(dob);
      if (isoDob === null) {
        setErrors({ dob: 'Data de nascimento inválida.' });
        setStep(steps.indexOf('dados'));
        return;
      }
    }
    const step2 = validateStep2();
    if (Object.keys(step2).length > 0) {
      setErrors(step2);
      setStep(steps.indexOf('senha'));
      return;
    }
    if (!lgpdAccepted) {
      setErrors({ lgpd: 'É necessário aceitar os Termos e a Política de Privacidade.' });
      return;
    }

    setSubmitting(true);
    try {
      // Conclui o PERFIL antes de trocar a senha. `updatePassword` emite o evento
      // USER_UPDATED, que dispara um reload do perfil no AuthProvider; se a senha
      // viesse primeiro, esse reload poderia reler is_first_login=true (cadastro
      // ainda não concluído) e remontar o Onboarding no passo 1 — o loop.
      if (cadastroJaCompleto || isoDob === null) {
        await finishStaffOnboarding(userId);
      } else {
        await completeProfileOnboarding(userId, {
          name,
          cpf: onlyDigits(cpf),
          phone: onlyDigits(phone),
          dob: isoDob,
        });
      }
      await updatePassword(password);
      await refreshProfile();
    } catch (submitError) {
      setErrors({ form: describeError(submitError) });
    } finally {
      setSubmitting(false);
    }
  }, [
    session,
    cadastroJaCompleto,
    steps,
    validateStep1,
    validateStep2,
    lgpdAccepted,
    dob,
    password,
    name,
    cpf,
    phone,
    refreshProfile,
  ]);

  const headings = STEP_HEADINGS[stepAtual];
  const passoLabel = `Passo ${step + 1} de ${steps.length}.`;

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <View style={styles.container}>
        {/* Indicador de etapas */}
        <View style={styles.stepper}>
          <View style={styles.bars}>
            {steps.map((nome, index) => (
              <View
                key={nome}
                style={[
                  styles.bar,
                  { backgroundColor: index <= step ? colors.primary : colors.surfaceElevated },
                ]}
              />
            ))}
          </View>
          <View style={styles.labels}>
            {steps.map((nome, index) => (
              <Text
                key={nome}
                style={[
                  styles.stepLabel,
                  { color: index === step ? colors.primaryText : colors.textSecondary },
                  index === step ? styles.stepLabelActive : null,
                ]}
              >
                {index + 1} · {STEP_LABELS[nome]}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.titleBlock}>
          <AppText variant="heading">{headings.title}</AppText>
          <AppText variant="caption" style={styles.subtitle}>
            {passoLabel} {headings.subtitle}
          </AppText>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stepAtual === 'dados' ? (
            <View style={styles.fields}>
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
            </View>
          ) : null}

          {stepAtual === 'senha' ? (
            <View style={styles.fields}>
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
            </View>
          ) : null}

          {stepAtual === 'termos' ? (
            <View style={styles.terms}>
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
                Seus dados são armazenados de forma criptografada e usados apenas
                para fins gerenciais e financeiros da academia. Você pode solicitar
                a exclusão a qualquer momento.
              </AppText>
              {errors.lgpd !== undefined ? (
                <AppText variant="caption" color={colors.error}>
                  {errors.lgpd}
                </AppText>
              ) : null}
              {errors.form !== undefined ? (
                <AppText variant="caption" color={colors.error}>
                  {errors.form}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Rodapé de navegação */}
        <View style={styles.footer}>
          {step > 0 ? (
            <Button
              title="Voltar"
              variant="secondary"
              onPress={goBack}
              style={styles.footerBack}
            />
          ) : null}
          {!ultimaEtapa ? (
            <Button title="Próximo" onPress={goNext} style={styles.footerNext} />
          ) : (
            <Button
              title="Concluir cadastro"
              onPress={handleSubmit}
              loading={submitting}
              style={styles.footerNext}
            />
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 16,
    },
    stepper: {
      gap: 8,
    },
    bars: {
      flexDirection: 'row',
      gap: 8,
    },
    bar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    stepLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
    },
    stepLabelActive: {
      fontFamily: fonts.bodySemiBold,
    },
    titleBlock: {
      marginTop: 22,
      marginBottom: 8,
    },
    subtitle: {
      marginTop: 6,
    },
    body: {
      paddingTop: 12,
      paddingBottom: 16,
      flexGrow: 1,
    },
    fields: {
      gap: 4,
    },
    terms: {
      gap: 10,
    },
    lgpdHint: {
      marginLeft: 36,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 12,
    },
    footerBack: {
      flex: 1,
    },
    footerNext: {
      flex: 2,
    },
  });
}
