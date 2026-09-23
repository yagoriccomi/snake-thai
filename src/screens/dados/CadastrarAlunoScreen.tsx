import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GroupPicker } from '@/components/GroupPicker';
import { Input } from '@/components/Input';
import { PlanPicker } from '@/components/PlanPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useDefaultStudentPassword } from '@/hooks/useDefaultStudentPassword';
import type { DadosStackScreenProps } from '@/navigation/types';
import { createStudent, type CanalDeAcesso } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { dateBrToIso, maskCpf, maskDate, maskPhone, onlyDigits } from '@/utils/masks';
import { isValidCpf, isValidEmail, isValidName } from '@/utils/validation';

/**
 * Cadastro de novo aluno (admin). Cria a conta com a senha padrão e inicializa
 * o perfil pendente — via Edge Function `create-student` (service_role, nunca
 * no cliente). O aluno troca a senha no onboarding do primeiro acesso.
 */
/** Como a pessoa vai acessar. Ainda não existe aplicativo para iPhone. */
type CanalEscolhido = CanalDeAcesso;

const CANAIS: readonly SegmentOption<CanalEscolhido>[] = [
  { value: 'app', label: 'Usa o app' },
  { value: 'none', label: 'Não usa' },
] as const;

export function CadastrarAlunoScreen({
  navigation,
}: DadosStackScreenProps<'CadastrarAluno'>): React.JSX.Element {
  const { colors } = useTheme();
  const { settings } = useAcademySettings();

  // Senha inicial definida pelo admin nas configuracoes da academia.
  const { password: defaultPassword } = useDefaultStudentPassword();

  const [email, setEmail] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  // Nasce no plano padrão da academia; o admin troca aqui se for o caso.
  const [planId, setPlanId] = useState<string | null>(null);
  // As configurações chegam depois da primeira renderização, então o padrão só
  // pode ser aplicado quando elas carregam — e apenas enquanto o admin ainda
  // não escolheu nada, para não desfazer a escolha dele.
  const [planoTocado, setPlanoTocado] = useState(false);
  const defaultPlanId = settings?.default_plan_id ?? null;
  useEffect(() => {
    if (!planoTocado) {
      setPlanId(defaultPlanId);
    }
  }, [defaultPlanId, planoTocado]);

  const handlePlanChange = useCallback((value: string | null) => {
    setPlanoTocado(true);
    setPlanId(value);
  }, []);
  /**
   * Quem não usa o aplicativo (não há versão para iPhone) precisa vir com os
   * dados preenchidos: ninguém mais vai preencher, e sem nome o professor não
   * sabe quem marcar na chamada.
   */
  const [usaOApp, setUsaOApp] = useState<CanalEscolhido>('app');
  const semAcesso = usaOApp === 'none';
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [celular, setCelular] = useState('');
  const [nascimento, setNascimento] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (semAcesso && !isValidName(nome)) {
      setError('Informe o nome completo do aluno (pelo menos 3 letras).');
      return;
    }
    if (semAcesso && !isValidCpf(cpf)) {
      setError('CPF inválido. Confira os números.');
      return;
    }
    const nascimentoIso = nascimento.trim() === '' ? undefined : dateBrToIso(nascimento) ?? null;
    if (nascimentoIso === null) {
      setError('Data de nascimento inválida. Use DD/MM/AAAA.');
      return;
    }
    setSubmitting(true);
    try {
      await createStudent(email, groupId, planId, {
        canal: usaOApp,
        dados: semAcesso
          ? {
              name: nome.trim(),
              cpf: onlyDigits(cpf),
              phone: celular.trim() === '' ? undefined : onlyDigits(celular),
              dob: nascimentoIso,
            }
          : undefined,
      });
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
  }, [email, groupId, planId, usaOApp, semAcesso, nome, cpf, celular, nascimento]);

  const handleReset = useCallback(() => {
    setEmail('');
    setNome('');
    setCpf('');
    setCelular('');
    setNascimento('');
    setUsaOApp('app');
    setGroupId(null);
    setPlanId(defaultPlanId);
    setPlanoTocado(false);
    setSuccess(false);
    setError(null);
  }, [defaultPlanId]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (success) {
    return (
      <ScreenWrapper avoidKeyboard>
        <View style={styles.center}>
          <AppText variant="heading">Aluno cadastrado! ✅</AppText>
          <AppText variant="caption" style={styles.message}>
            {defaultPassword !== null ? (
              <>
                A conta foi criada com a senha de primeiro acesso{' '}
                <AppText variant="caption" color={colors.primaryText}>
                  {defaultPassword}
                </AppText>
                . O aluno deverá trocá-la no primeiro acesso.
              </>
            ) : (
              'A conta foi criada com a senha de primeiro acesso definida em Configurações. O aluno deverá trocá-la no primeiro acesso.'
            )}
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
          {defaultPassword !== null ? (
            <>
              Informe o e-mail do aluno. A conta será criada com a senha de primeiro acesso{' '}
              <AppText variant="caption" color={colors.primaryText}>
                {defaultPassword}
              </AppText>
              , exigindo troca no primeiro acesso.
            </>
          ) : (
            'Informe o e-mail do aluno. A conta será criada com a senha de primeiro acesso definida em Configurações, exigindo troca no primeiro acesso.'
          )}
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

        <AppText variant="label" style={styles.rotuloAcesso}>
          Acesso ao aplicativo
        </AppText>
        <SegmentedControl options={CANAIS} value={usaOApp} onChange={setUsaOApp} />
        <AppText variant="caption" style={styles.ajudaAcesso}>
          {semAcesso
            ? 'Ainda não há aplicativo para iPhone. Você preenche os dados agora; o aluno entra na chamada e no financeiro normalmente.'
            : 'O aluno entra com a senha de primeiro acesso e preenche os próprios dados.'}
        </AppText>

        {semAcesso ? (
          <>
            <Input
              label="Nome completo"
              placeholder="Nome do aluno"
              autoCapitalize="words"
              value={nome}
              onChangeText={setNome}
            />
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              value={cpf}
              onChangeText={(texto) => setCpf(maskCpf(texto))}
            />
            <Input
              label="Celular (opcional)"
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
              value={celular}
              onChangeText={(texto) => setCelular(maskPhone(texto))}
            />
            <Input
              label="Nascimento (opcional)"
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              value={nascimento}
              onChangeText={(texto) => setNascimento(maskDate(texto))}
            />
          </>
        ) : null}

        <GroupPicker label="Turma (opcional)" value={groupId} onChange={setGroupId} />

        <PlanPicker label="Plano" value={planId} onChange={handlePlanChange} />

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
  rotuloAcesso: {
    marginTop: 16,
    marginBottom: 6,
  },
  ajudaAcesso: {
    marginTop: 6,
  },
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
