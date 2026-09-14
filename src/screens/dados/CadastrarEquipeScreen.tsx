import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import type { DadosStackScreenProps } from '@/navigation/types';
import { createStaff, type StaffRole } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { maskCpf, onlyDigits } from '@/utils/masks';
import { isValidCpf, isValidEmail, isValidName } from '@/utils/validation';

/** Cor padrão sugerida no seletor — só um ponto de partida, o admin troca. */
const DEFAULT_COLOR = '#39FF14';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

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
 * uma cor hexadecimal (identidade visual nas aulas); administrador não tem
 * cor (a constraint do banco recusaria). [#55]
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
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [errors, setErrors] = useState<CadastroErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isProfessorRole = role === 'professor';

  const handleCpfChange = useCallback((value: string) => setCpf(maskCpf(value)), []);

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
    if (isProfessorRole && !HEX_COLOR_REGEX.test(color)) {
      next.color = 'Cor inválida — use o formato #RRGGBB.';
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
        color: isProfessorRole ? color : null,
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
    setColor(DEFAULT_COLOR);
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
        <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} />

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

        {isProfessorRole && (
          <>
            <Input
              label="Cor do professor"
              placeholder="#39FF14"
              autoCapitalize="characters"
              value={color}
              onChangeText={setColor}
              error={errors.color}
            />
            <View style={styles.colorPreviewRow}>
              <View
                style={[
                  styles.colorPreview,
                  HEX_COLOR_REGEX.test(color) ? { backgroundColor: color } : null,
                ]}
              />
              <AppText variant="caption" color={colors.textSecondary}>
                Aparece ao lado do nome do professor nas aulas; a borda da aula usa
                esta cor. O professor pode trocá-la depois no próprio perfil.
              </AppText>
            </View>
          </>
        )}

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
    colorPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
    },
    colorPreview: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      marginTop: 24,
      alignSelf: 'stretch',
    },
  });
}
