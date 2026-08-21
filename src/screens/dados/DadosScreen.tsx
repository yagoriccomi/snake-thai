import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import type { DadosStackScreenProps } from '@/navigation/types';
import { updateProfile } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import {
  dateBrToIso,
  dateIsoToBr,
  maskCpf,
  maskDate,
  maskPhone,
  onlyDigits,
} from '@/utils/masks';
import { isValidBirthDate, isValidName, isValidPhone } from '@/utils/validation';

type ProfileErrors = Partial<Record<'name' | 'phone' | 'dob' | 'form', string>>;

/** Iniciais para o avatar: primeira + última palavra do nome (ou do e-mail). */
function initialsFrom(name: string, email: string): string {
  const source = name.trim() !== '' ? name.trim() : email.trim();
  const parts = source.split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0];
  if (first === undefined) return '?';
  const last = parts[parts.length - 1] ?? first;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

/**
 * Módulo "Dados" — perfil do usuário (Painel — lista agrupada).
 *
 * - Aluno: edita apenas Celular e Data de Nascimento (E-mail e CPF são read-only).
 * - Admin: edita também o próprio Nome (exceto CPF) e acessa a gestão da academia.
 *
 * Os dados aparecem em modo leitura; o botão "Editar" abre os campos e revela
 * Salvar/Cancelar — mantendo a mesma validação e persistência de antes.
 */
export function DadosScreen({
  navigation,
}: DadosStackScreenProps<'Perfil'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const {
    profile,
    session,
    isAdmin,
    signOut,
    refreshProfile,
    biometricEnabled,
    biometricAvailable,
    chooseBiometric,
  } = useAuth();
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const email = session?.user.email ?? '';
  const cpfDisplay =
    profile?.cpf !== null && profile?.cpf !== undefined ? maskCpf(profile.cpf) : '—';

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(
    profile?.phone !== null && profile?.phone !== undefined ? maskPhone(profile.phone) : '',
  );
  const [dob, setDob] = useState(
    profile?.dob !== null && profile?.dob !== undefined ? dateIsoToBr(profile.dob) : '',
  );
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  const handlePhoneChange = useCallback((value: string) => {
    setSavedAt(false);
    setPhone(maskPhone(value));
  }, []);
  const handleDobChange = useCallback((value: string) => {
    setSavedAt(false);
    setDob(maskDate(value));
  }, []);
  const handleNameChange = useCallback((value: string) => {
    setSavedAt(false);
    setName(value);
  }, []);

  const startEdit = useCallback(() => {
    setSavedAt(false);
    setErrors({});
    setEditing(true);
  }, []);

  /** Descarta as edições e volta aos valores atuais do perfil. */
  const cancelEdit = useCallback(() => {
    setName(profile?.name ?? '');
    setPhone(
      profile?.phone !== null && profile?.phone !== undefined ? maskPhone(profile.phone) : '',
    );
    setDob(profile?.dob !== null && profile?.dob !== undefined ? dateIsoToBr(profile.dob) : '');
    setErrors({});
    setEditing(false);
  }, [profile]);

  const handleSave = useCallback(async () => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }

    const next: ProfileErrors = {};
    if (isAdmin && !isValidName(name)) {
      next.name = 'Informe um nome válido.';
    }
    if (!isValidPhone(phone)) {
      next.phone = 'Informe um celular válido com DDD.';
    }
    const hasDob = dob.trim().length > 0;
    if (hasDob && !isValidBirthDate(dob)) {
      next.dob = 'Data de nascimento inválida.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await updateProfile(userId, {
        name: isAdmin ? name : undefined,
        phone: onlyDigits(phone),
        dob: hasDob ? dateBrToIso(dob) : null,
      });
      await refreshProfile();
      setSavedAt(true);
      setEditing(false);
    } catch {
      setErrors({ form: 'Não foi possível salvar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }, [session, isAdmin, name, phone, dob, refreshProfile]);

  const goToCreateStudent = useCallback(
    () => navigation.navigate('CadastrarAluno'),
    [navigation],
  );
  const goToManageStudents = useCallback(
    () => navigation.navigate('GerenciarAlunos'),
    [navigation],
  );
  const goToPlans = useCallback(() => navigation.navigate('Planos'), [navigation]);
  const goToSettings = useCallback(() => navigation.navigate('Configuracoes'), [navigation]);
  const goToChangePassword = useCallback(
    () => navigation.navigate('AlterarSenha'),
    [navigation],
  );
  const handleSignOut = useCallback(() => void signOut(), [signOut]);

  /**
   * Liga/desliga o desbloqueio biométrico. Ativar dispara a confirmação da
   * digital na hora; se o usuário cancelar, o switch volta ao estado anterior
   * (a preferência só muda quando a identidade é confirmada).
   */
  const handleToggleBiometric = useCallback(
    (value: boolean) => {
      setBiometricError(null);
      setBiometricBusy(true);
      void chooseBiometric(value)
        .catch(() => setBiometricError('Não foi possível alterar essa configuração.'))
        .finally(() => setBiometricBusy(false));
    },
    [chooseBiometric],
  );

  const initials = initialsFrom(name !== '' ? name : profile?.name ?? '', email);
  const roleLabel = isAdmin ? 'Administrador' : 'Aluno';
  const phoneDisplay = phone.trim() !== '' ? phone : '—';
  const dobDisplay = dob.trim() !== '' ? dob : '—';

  return (
    <ScreenWrapper avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Perfil</Text>

        {/* Mini-perfil */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name !== '' ? name : profile?.name ?? 'Sem nome'}
            </Text>
            <Text style={styles.profileRole}>{roleLabel}</Text>
          </View>
        </View>

        {/* Gestão da academia (somente admin) */}
        {isAdmin ? (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>GESTÃO DA ACADEMIA</Text>
            <View style={styles.card}>
              <NavRow
                icon="person-add-outline"
                label="Cadastrar novo aluno"
                onPress={goToCreateStudent}
                styles={styles}
                colors={colors}
              />
              <NavRow
                icon="people-outline"
                label="Gerenciar alunos"
                onPress={goToManageStudents}
                styles={styles}
                colors={colors}
              />
              <NavRow
                icon="pricetags-outline"
                label="Planos e mensalidades"
                onPress={goToPlans}
                styles={styles}
                colors={colors}
              />
              <NavRow
                icon="business-outline"
                label="Configurações da academia"
                onPress={goToSettings}
                styles={styles}
                colors={colors}
                last
              />
            </View>
          </View>
        ) : null}

        {/* Meus dados */}
        <View style={styles.group}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>MEUS DADOS</Text>
            {editing ? null : (
              <Pressable
                onPress={startEdit}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Editar meus dados"
              >
                <Text style={styles.editLink}>Editar</Text>
              </Pressable>
            )}
          </View>

          {editing ? (
            <View style={styles.editForm}>
              <Input label="E-mail" value={email} editable={false} />
              <Input label="CPF" value={cpfDisplay} editable={false} />
              <Input
                label="Nome completo"
                value={name}
                onChangeText={handleNameChange}
                editable={isAdmin}
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
                label="Data de nascimento"
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                value={dob}
                onChangeText={handleDobChange}
                error={errors.dob}
              />
              {errors.form !== undefined ? (
                <AppText variant="caption" color={colors.error}>
                  {errors.form}
                </AppText>
              ) : null}
              <View style={styles.editActions}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={cancelEdit}
                  style={styles.editCancel}
                />
                <Button
                  title="Salvar"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.editSave}
                />
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <ValueRow label="Celular" value={phoneDisplay} styles={styles} />
              <ValueRow label="Nascimento" value={dobDisplay} styles={styles} />
              <ValueRow label="E-mail" value={email} muted styles={styles} />
              <ValueRow label="CPF" value={cpfDisplay} muted last styles={styles} />
            </View>
          )}
          {savedAt && !editing ? (
            <AppText variant="caption" color={colors.success} style={styles.savedHint}>
              Dados atualizados com sucesso.
            </AppText>
          ) : null}
        </View>

        {/* Segurança */}
        <View style={styles.group}>
          <Text style={styles.sectionLabel}>SEGURANÇA</Text>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={styles.rowTextBlock}>
                <Text style={styles.rowLabel}>Desbloqueio por digital</Text>
                <Text style={styles.rowHint}>
                  {biometricAvailable
                    ? 'Pede a digital ao abrir e ao voltar do segundo plano.'
                    : 'Cadastre uma digital no aparelho para usar.'}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                disabled={!biometricAvailable || biometricBusy}
                trackColor={TRACK_COLOR}
                thumbColor={biometricEnabled ? colors.primary : colors.textSecondary}
                accessibilityLabel="Desbloqueio por digital"
                accessibilityHint="Ativa ou desativa a exigência da digital para abrir o aplicativo"
              />
            </View>
            <NavRow
              icon="key-outline"
              label="Alterar minha senha"
              onPress={goToChangePassword}
              styles={styles}
              colors={colors}
              last
            />
          </View>
          {biometricError !== null ? (
            <AppText variant="caption" color={colors.error} style={styles.savedHint}>
              {biometricError}
            </AppText>
          ) : null}
        </View>

        {/* Conta */}
        <View style={styles.group}>
          <Text style={styles.sectionLabel}>CONTA</Text>
          <View style={styles.card}>
            <Pressable
              onPress={handleSignOut}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
            >
              <View style={styles.rowLeft}>
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <Text style={[styles.rowLabel, { color: colors.error }]}>Sair da conta</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

interface NavRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
  last?: boolean;
}

/** Linha navegável: ícone + rótulo + chevron. */
function NavRow({ icon, label, onPress, styles, colors, last }: NavRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, last ? null : styles.rowDivider]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

interface ValueRowProps {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  muted?: boolean;
  last?: boolean;
}

/** Linha somente-leitura: rótulo à esquerda, valor à direita. */
function ValueRow({ label, value, styles, muted, last }: ValueRowProps): React.JSX.Element {
  return (
    <View style={[styles.row, last ? null : styles.rowDivider]}>
      <Text style={[styles.rowLabel, muted ? styles.rowLabelMuted : null]}>{label}</Text>
      <Text style={[styles.rowValue, muted ? styles.rowValueMuted : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Cores da trilha do switch — constante, para não recriar objeto por render. */
const TRACK_COLOR = { false: '#3A3A3C', true: 'rgba(57, 255, 20, 0.4)' } as const;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    content: {
      paddingTop: 12,
      paddingBottom: 40,
    },
    pageTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 26,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    profileRole: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    group: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginBottom: 8,
      marginLeft: 4,
    },
    editLink: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.primaryText,
      marginBottom: 8,
      marginRight: 4,
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
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexShrink: 1,
    },
    rowTextBlock: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    rowLabelMuted: {
      color: colors.textSecondary,
    },
    rowHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    rowValue: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      flexShrink: 1,
      textAlign: 'right',
    },
    rowValueMuted: {
      color: colors.textSecondary,
      opacity: 0.7,
    },
    editForm: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    editCancel: {
      flex: 1,
    },
    editSave: {
      flex: 1,
    },
    savedHint: {
      marginTop: 8,
      marginLeft: 4,
    },
  });
}
