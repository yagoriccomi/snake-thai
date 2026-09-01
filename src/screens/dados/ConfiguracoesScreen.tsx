import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
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
 * Configurações da academia (somente administrador) — Painel, lista agrupada.
 *
 * É a tela que transforma o app em produto: nome, cor da marca, chave PIX,
 * senha padrão do aluno e dia de vencimento saíram do código-fonte e passaram a
 * ser editáveis aqui. Antes, mudar qualquer um deles exigia desenvolvedor,
 * build e nova instalação.
 *
 * Em leitura, os valores aparecem em grupos (igual ao Perfil); "Editar" abre os
 * campos e revela Salvar/Cancelar, preservando a mesma validação e persistência.
 */
export function ConfiguracoesScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { settings, loading, error: loadError, reload, save } = useAcademySettings();

  const [editing, setEditing] = useState(false);
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

  /** Copia a configuração carregada para os campos editáveis. */
  const syncFromSettings = useCallback(() => {
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

  // Espelha a configuração carregada nos campos, uma única vez por carga.
  useEffect(() => {
    syncFromSettings();
  }, [syncFromSettings]);

  const handlePhoneChange = useCallback((value: string) => {
    setSaved(false);
    setContactPhone(maskPhone(value));
  }, []);

  const startEditing = useCallback(() => {
    setSaved(false);
    setErrors({});
    setEditing(true);
  }, []);

  /** Descarta as edições e volta aos valores atuais. */
  const cancelEditing = useCallback(() => {
    syncFromSettings();
    setErrors({});
    setEditing(false);
  }, [syncFromSettings]);

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
      setEditing(false);
    } catch (saveError) {
      setErrors({ form: describeError(saveError) });
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

  if (loadError !== null && settings === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={loadError} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  if (loading) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const hexValid = HEX_COLOR_PATTERN.test(primaryColor.trim());
  const dash = (value: string): string => (value.trim() === '' ? '—' : value.trim());

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Configurações</Text>
          {editing ? null : (
            <Pressable
              onPress={startEditing}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Editar configurações"
            >
              <Text style={styles.editLink}>Editar</Text>
            </Pressable>
          )}
        </View>

        {editing ? (
          <>
            <Text style={styles.sectionLabel}>IDENTIDADE</Text>
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

            <Text style={styles.sectionLabel}>RECEBIMENTO</Text>
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

            <Text style={styles.sectionLabel}>CONTATO</Text>
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

            <Text style={styles.sectionLabel}>OPERAÇÃO</Text>
            <Input
              label="Senha padrão do aluno"
              autoCapitalize="none"
              value={studentPassword}
              onChangeText={setStudentPassword}
              error={errors.password}
            />
            <AppText variant="caption" style={styles.hint}>
              É a senha usada ao cadastrar um aluno novo e ao redefinir o acesso
              de quem esqueceu. O aluno é obrigado a trocá-la no primeiro acesso.
            </AppText>

            {errors.form !== undefined ? (
              <AppText variant="caption" color={colors.error}>
                {errors.form}
              </AppText>
            ) : null}

            <View style={styles.editActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={cancelEditing}
                style={styles.flex1}
              />
              <Button
                title="Salvar"
                onPress={handlePress}
                loading={saving}
                accessibilityHint="Grava as configurações da academia"
                style={styles.flex1}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>IDENTIDADE</Text>
            <View style={styles.card}>
              <ValueRow label="Nome" value={dash(academyName)} styles={styles} />
              <View style={[styles.row, styles.rowLast]}>
                <Text style={styles.rowLabel}>Cor da marca</Text>
                <View style={styles.rowRight}>
                  {hexValid ? (
                    <View
                      style={[styles.swatch, { backgroundColor: primaryColor.trim() }]}
                    />
                  ) : null}
                  <Text style={styles.rowValue}>{dash(primaryColor)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>RECEBIMENTO</Text>
            <View style={styles.card}>
              <ValueRow label="Chave PIX" value={dash(pixKey)} styles={styles} />
              <ValueRow label="Titular do PIX" value={dash(pixHolder)} styles={styles} />
              <ValueRow
                label="Vencimento padrão"
                value={dueDay.trim() === '' ? '—' : `dia ${dueDay.trim()}`}
                styles={styles}
                last
              />
            </View>

            <Text style={styles.sectionLabel}>CONTATO</Text>
            <View style={styles.card}>
              <ValueRow label="E-mail" value={dash(contactEmail)} styles={styles} />
              <ValueRow label="Telefone" value={dash(contactPhone)} styles={styles} />
              <ValueRow label="Endereço" value={dash(address)} styles={styles} last />
            </View>

            <Text style={styles.sectionLabel}>OPERAÇÃO</Text>
            <View style={styles.card}>
              <ValueRow
                label="Senha padrão do aluno"
                value={dash(studentPassword)}
                styles={styles}
                last
              />
            </View>
            <AppText variant="caption" style={styles.hint}>
              A senha padrão é usada ao cadastrar um aluno novo e ao redefinir o
              acesso de quem esqueceu. O aluno troca-a no primeiro acesso.
            </AppText>

            {saved ? (
              <AppText variant="caption" color={colors.success} style={styles.savedHint}>
                Configurações salvas.
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

interface ValueRowProps {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  last?: boolean;
}

/** Linha somente-leitura: rótulo à esquerda, valor à direita. */
function ValueRow({ label, value, styles, last }: ValueRowProps): React.JSX.Element {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Campo de texto vazio vira `null` no banco, não string vazia. */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingTop: 12,
      paddingBottom: 40,
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    pageTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 26,
      color: colors.textPrimary,
    },
    editLink: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.primaryText,
    },
    sectionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 18,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
      flexShrink: 0,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    rowValue: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      flexShrink: 1,
      textAlign: 'right',
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hint: {
      marginTop: 8,
      marginLeft: 4,
    },
    savedHint: {
      marginTop: 12,
      marginLeft: 4,
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    flex1: {
      flex: 1,
    },
  });
}
