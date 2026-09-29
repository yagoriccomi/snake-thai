import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CampoDeCor } from '@/components/CampoDeCor';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import type { DadosStackScreenProps } from '@/navigation/types';
import { createStaff, type StaffRole } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { COR_SUGERIDA, MENSAGEM_COR_INVALIDA, ehCorValida } from '@/utils/cor';
import { maskCpf, onlyDigits } from '@/utils/masks';
import { isValidCpf, isValidEmail, isValidName } from '@/utils/validation';

const ROLE_OPTIONS: ReadonlyArray<SegmentOption<StaffRole>> = [
  { value: 'professor', label: 'Professor' },
  { value: 'admin', label: 'Administrador' },
];

type CadastroErrors = Partial<
  Record<'email' | 'name' | 'cpf' | 'color' | 'form', string>
>;

/**
 * Cadastro de professor ou administrador (admin).
 *
 * Diferente do cadastro de aluno: nasce COMPLETO (nome e CPF já informados
 * aqui) — não há onboarding depois, por decisão do usuário. Professor exige
 * uma cor hexadecimal (identidade visual nas aulas); para o administrador a
 * cor é opcional: com cor, ele também dá aula (contrato § 4). [#55]
 */
export function CadastrarEquipeScreen({
  navigation,
}: DadosStackScreenProps<'CadastrarEquipe'>): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [role, setRole] = useState<StaffRole>('professor');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [color, setColor] = useState(COR_SUGERIDA);
  const [errors, setErrors] = useState<CadastroErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isProfessorRole = role === 'professor';

  const handleCpfChange = useCallback((value: string) => setCpf(maskCpf(value)), []);

  // O admin começa sem cor (é opcional); o professor, com a sugerida.
  const handleRoleChange = useCallback((novo: StaffRole) => {
    setRole(novo);
    setColor((atual) => {
      if (novo === 'admin') return atual === COR_SUGERIDA ? '' : atual;
      return atual === '' ? COR_SUGERIDA : atual;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const next: CadastroErrors = {};
    if (!isValidEmail(email)) {
      next.email = 'Informe um e-mail válido.';
    }
    if (!isValidName(name)) {
      next.name = 'Informe o nome completo.';
    }
    if (!isValidCpf(cpf)) {
      next.cpf = 'CPF inválido.';
    }
    const corDigitada = color.trim().toUpperCase();
    if ((isProfessorRole || corDigitada !== '') && !ehCorValida(corDigitada)) {
      next.color = MENSAGEM_COR_INVALIDA;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await createStaff({
        email,
        name,
        cpf: onlyDigits(cpf),
        role,
        color: corDigitada === '' ? null : corDigitada,
      });
      setSuccess(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error &&
        /already|exist|registered|duplicate/i.test(submitError.message)
          ? 'Já existe um usuário com este e-mail.'
          : 'Não foi possível cadastrar. Tente novamente.';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  }, [email, name, cpf, role, color, isProfessorRole]);

  const handleReset = useCallback(() => {
    setEmail('');
    setName('');
    setCpf('');
    setColor(COR_SUGERIDA);
    setRole('professor');
    setSuccess(false);
    setErrors({});
  }, []);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  if (success) {
    return (
      <ScreenWrapper avoidKeyboard>
        <View style={styles.center}>
          <AppText variant="heading">Cadastro concluído! ✅</AppText>
          <AppText variant="caption" style={styles.message}>
            {isProfessorRole ? 'O professor' : 'O administrador'} já pode entrar com a
            senha padrão e o e-mail informado.
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
        <AppText variant="label" style={styles.label}>
          Cargo
        </AppText>
        <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={handleRoleChange} />

        <Input
          label="E-mail"
          placeholder="professor@exemplo.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          containerStyle={styles.spaced}
        />

        <Input
          label="Nome completo"
          placeholder="Nome do funcionário"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />

        <Input
          label="CPF"
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          value={cpf}
          onChangeText={handleCpfChange}
          error={errors.cpf}
        />

        <CampoDeCor
          label={isProfessorRole ? 'Cor do professor' : 'Cor (opcional)'}
          value={color}
          onChangeText={setColor}
          error={errors.color}
        />
        <AppText variant="caption" color={colors.textSecondary} style={styles.colorHint}>
          {isProfessorRole
            ? 'Aparece ao lado do nome do professor nas aulas; a borda da aula usa esta cor. O professor pode trocá-la depois no próprio perfil.'
            : 'Com uma cor, o administrador também dá aula; sem cor, ele só administra. Dá para escolher depois em Dados › Minha cor.'}
        </AppText>

        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error} style={styles.spaced}>
            {errors.form}
          </AppText>
        ) : null}

        <Button
          title="Cadastrar"
          onPress={() => void handleSubmit()}
          loading={submitting}
          style={styles.button}
        />
      </View>
    </ScreenWrapper>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    form: {
      flex: 1,
      paddingTop: 16,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    label: {
      marginBottom: 8,
    },
    spaced: {
      marginTop: 16,
    },
    message: {
      marginBottom: 16,
      textAlign: 'center',
    },
    colorHint: {
      marginTop: 6,
    },
    button: {
      marginTop: 24,
      alignSelf: 'stretch',
    },
  });
}
