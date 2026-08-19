import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useTheme } from '@/theme/ThemeProvider';
import { maskPhone, onlyDigits } from '@/utils/masks';
import { isValidEmail } from '@/utils/validation';

/** Campos com mensagem de erro no formulário de configuração. */
type SettingsErrors = Partial<
  Record<'name' | 'color' | 'dueDay' | 'password' | 'email' | 'form', string>
>;

const SCREEN_EDGES = ['bottom'] as const;

/** Faixa aceita para o dia de vencimento — 28 existe em todo mês. */
const MIN_DUE_DAY = 1;
const MAX_DUE_DAY = 28;

/** Tamanho mínimo da senha padrão, espelhando a constraint do banco. */
const MIN_PASSWORD_LENGTH = 8;

/** Cor em hexadecimal de 6 dígitos, como o banco exige. */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * Configurações da academia (somente administrador).
 *
 * É a tela que transforma o app em produto: nome, cor da marca, chave PIX,
 * senha padrão do aluno e dia de vencimento saíram do código-fonte e passaram a
 * ser editáveis aqui. Antes, mudar qualquer um deles exigia desenvolvedor,
 * build e nova instalação.
 */
export function ConfiguracoesScreen(): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { settings, loading, save } = useAcademySettings();

  const [academyName, setAcademyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixHolder, setPixHolder] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  const [errors, setErrors] = useState<SettingsErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Espelha a configuração carregada nos campos, uma única vez por carga.
  useEffect(() => {
    if (settings === null) {
      return;
    }
    setAcademyName(settings.academy_name);
    setPrimaryColor(settings.primary_color);
    setPixKey(settings.pix_key ?? '');
    setPixHolder(settings.pix_holder_name ?? '');
    setContactEmail(settings.contact_email ?? '');
    setContactPhone(
      settings.contact_phone !== null ? maskPhone(settings.contact_phone) : '',
    );
    setAddress(settings.address ?? '');
    setDueDay(String(settings.default_due_day));
    setStudentPassword(settings.default_student_password);
  }, [settings]);

  const handlePhoneChange = useCallback((value: string) => {
    setSaved(false);
    setContactPhone(maskPhone(value));
  }, []);

  const handleSave = useCallback(async () => {
    const validation: SettingsErrors = {};
    if (academyName.trim().length < 2) {
      validation.name = 'Informe o nome da academia.';
    }
    if (!HEX_COLOR_PATTERN.test(primaryColor.trim())) {
      validation.color = 'Use uma cor em hexadecimal, como #39FF14.';
    }
    const parsedDueDay = Number(onlyDigits(dueDay));
    if (
      !Number.isInteger(parsedDueDay) ||
      parsedDueDay < MIN_DUE_DAY ||
      parsedDueDay > MAX_DUE_DAY
    ) {
      validation.dueDay = `Escolha um dia entre ${MIN_DUE_DAY} e ${MAX_DUE_DAY}.`;
    }
    if (studentPassword.length < MIN_PASSWORD_LENGTH) {
      validation.password = `A senha padrão precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (contactEmail.trim() !== '' && !isValidEmail(contactEmail)) {
      validation.email = 'E-mail de contato inválido.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await save({
        academy_name: academyName.trim(),
        primary_color: primaryColor.trim(),
        pix_key: emptyToNull(pixKey),
        pix_holder_name: emptyToNull(pixHolder),
        contact_email: emptyToNull(contactEmail),
        contact_phone:
          contactPhone.trim() === '' ? null : onlyDigits(contactPhone),
        address: emptyToNull(address),
        default_due_day: parsedDueDay,
        default_student_password: studentPassword,
      });
      setSaved(true);
    } catch {
      setErrors({ form: 'Não foi possível salvar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }, [
    academyName,
    primaryColor,
    pixKey,
    pixHolder,
    contactEmail,
    contactPhone,
    address,
    dueDay,
    studentPassword,
    save,
  ]);

  const handlePress = useCallback(() => void handleSave(), [handleSave]);

  if (loading) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="subtitle" style={styles.section}>
          Identidade
        </AppText>
        <Input
          label="Nome da academia"
          value={academyName}
          onChangeText={setAcademyName}
          error={errors.name}
        />
        <Input
          label="Cor principal (hexadecimal)"
          placeholder="#39FF14"
          autoCapitalize="none"
          value={primaryColor}
          onChangeText={setPrimaryColor}
          error={errors.color}
        />

        <AppText variant="subtitle" style={styles.section}>
          Recebimento
        </AppText>
        <Input
          label="Chave PIX"
          placeholder="CNPJ, e-mail ou telefone"
          autoCapitalize="none"
          value={pixKey}
          onChangeText={setPixKey}
        />
        <Input
          label="Nome do titular do PIX"
          value={pixHolder}
          onChangeText={setPixHolder}
        />
        <Input
          label="Dia de vencimento padrão"
          placeholder="10"
          keyboardType="number-pad"
          value={dueDay}
          onChangeText={setDueDay}
          error={errors.dueDay}
        />

        <AppText variant="subtitle" style={styles.section}>
          Contato
        </AppText>
        <Input
          label="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={contactEmail}
          onChangeText={setContactEmail}
          error={errors.email}
        />
        <Input
          label="Telefone"
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          value={contactPhone}
          onChangeText={handlePhoneChange}
        />
        <Input label="Endereço" value={address} onChangeText={setAddress} />

        <AppText variant="subtitle" style={styles.section}>
          Operação
        </AppText>
        <Input
          label="Senha padrão do aluno"
          autoCapitalize="none"
          value={studentPassword}
          onChangeText={setStudentPassword}
          error={errors.password}
        />
        <AppText variant="caption" style={styles.hint}>
          É a senha usada ao cadastrar um aluno novo e ao redefinir o acesso de
          quem esqueceu. O aluno é obrigado a trocá-la no primeiro acesso.
        </AppText>

        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error}>
            {errors.form}
          </AppText>
        ) : null}
        {saved ? (
          <AppText variant="caption" color={colors.success}>
            Configurações salvas.
          </AppText>
        ) : null}

        <Button
          title="Salvar configurações"
          onPress={handlePress}
          loading={saving}
          accessibilityHint="Grava as configurações da academia"
          style={styles.save}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

/** Campo de texto vazio vira `null` no banco, não string vazia. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 16,
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  hint: {
    marginTop: -8,
    marginBottom: 8,
  },
  save: {
    marginTop: 16,
  },
});
