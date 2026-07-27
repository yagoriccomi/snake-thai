import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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

/**
 * Módulo "Dados" — perfil do usuário.
 *
 * - Aluno: edita apenas Celular e Data de Nascimento (E-mail e CPF são read-only).
 * - Admin: edita também o próprio Nome (exceto CPF) e acessa o cadastro de alunos.
 */
export function DadosScreen({
  navigation,
}: DadosStackScreenProps<'Perfil'>): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { profile, session, isAdmin, signOut, refreshProfile } = useAuth();

  const email = session?.user.email ?? '';
  const cpfDisplay = profile?.cpf !== null && profile?.cpf !== undefined
    ? maskCpf(profile.cpf)
    : '—';

  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(
    profile?.phone !== null && profile?.phone !== undefined
      ? maskPhone(profile.phone)
      : '',
  );
  const [dob, setDob] = useState(
    profile?.dob !== null && profile?.dob !== undefined
      ? dateIsoToBr(profile.dob)
      : '',
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
    } catch {
      setErrors({ form: 'Não foi possível salvar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }, [session, isAdmin, name, phone, dob, refreshProfile]);

  const goToCreateStudent = useCallback(() => {
    navigation.navigate('CadastrarAluno');
  }, [navigation]);

  const goToManageStudents = useCallback(() => {
    navigation.navigate('GerenciarAlunos');
  }, [navigation]);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isAdmin ? (
          <View style={styles.adminActions}>
            <Button title="Cadastrar Novo Aluno" onPress={goToCreateStudent} />
            <Button
              title="Gerenciar Alunos"
              variant="secondary"
              onPress={goToManageStudents}
              style={styles.adminSecondary}
            />
          </View>
        ) : null}

        <AppText variant="subtitle" style={styles.section}>
          Meus dados
        </AppText>

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
        {savedAt ? (
          <AppText variant="caption" color={colors.success}>
            Dados atualizados com sucesso.
          </AppText>
        ) : null}

        <Button
          title="Salvar alterações"
          onPress={handleSave}
          loading={saving}
          style={styles.save}
        />
        <Button
          title="Sair da conta"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.signOut}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 16,
  },
  adminActions: {
    marginBottom: 16,
  },
  adminSecondary: {
    marginTop: 12,
  },
  section: {
    marginBottom: 8,
  },
  save: {
    marginTop: 16,
  },
  signOut: {
    marginTop: 12,
  },
});
