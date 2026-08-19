import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { GroupPicker } from '@/components/GroupPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { DEFAULT_STUDENT_PASSWORD } from '@/constants/auth';
import {
  fetchAllStudents,
  resetStudentPassword,
  updateStudentGroup,
} from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Gestão de alunos (admin): lista todos os alunos, permite atribuir/alterar a
 * turma de cada um (via GroupPicker, com atualização otimista) e redefinir a
 * senha de quem esqueceu — devolvendo a conta à senha padrão e ao onboarding.
 */
export function GerenciarAlunosScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStudents(await fetchAllStudents());
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChangeGroup = useCallback(
    async (studentId: string, groupId: string | null) => {
      setStudents((previous) =>
        previous.map((student) =>
          student.id === studentId ? { ...student, group_id: groupId } : student,
        ),
      );
      try {
        await updateStudentGroup(studentId, groupId);
      } catch {
        void load();
      }
    },
    [load],
  );

  /**
   * Redefine a senha do aluno para a padrão. Pede confirmação antes: é uma ação
   * que invalida o acesso atual da pessoa, então não pode acontecer por toque
   * acidental na lista.
   */
  const handleResetPassword = useCallback((student: Profile) => {
    const label = student.name ?? 'este aluno';
    Alert.alert(
      'Redefinir senha?',
      `A senha de ${label} voltará para a padrão (${DEFAULT_STUDENT_PASSWORD}) e ele precisará criar uma nova no próximo acesso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: () => {
            setResettingId(student.id);
            void resetStudentPassword(student.id)
              .then(() => {
                Alert.alert(
                  'Senha redefinida',
                  `Informe a senha padrão ${DEFAULT_STUDENT_PASSWORD} para ${label}.`,
                );
              })
              .catch(() => {
                Alert.alert(
                  'Não foi possível redefinir',
                  'Tente novamente em instantes.',
                );
              })
              .finally(() => {
                setResettingId(null);
              });
          },
        },
      ],
    );
  }, []);

  const renderItem = useCallback<ListRenderItem<Profile>>(
    ({ item }) => (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <View style={styles.rowHeader}>
          <AppText variant="subtitle" numberOfLines={1} style={styles.rowName}>
            {item.name ?? 'Aluno pendente'}
          </AppText>
          <Pressable
            onPress={() => handleResetPassword(item)}
            disabled={resettingId === item.id}
            hitSlop={RESET_HIT_SLOP}
            style={styles.resetButton}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Redefinir senha de ${item.name ?? 'aluno pendente'}`}
            accessibilityHint="Volta a senha para a padrão e exige nova senha no próximo acesso"
          >
            {resettingId === item.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="key-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>
        <GroupPicker
          value={item.group_id}
          onChange={(groupId) => void handleChangeGroup(item.id, groupId)}
        />
      </View>
    ),
    [colors.border, colors.primary, colors.textSecondary, handleChangeGroup, handleResetPassword, resettingId],
  );

  if (loading && students.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={students}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Nenhum aluno"
            message="Cadastre alunos para gerenciá-los aqui."
          />
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: Profile): string => item.id;

/** Área de toque extra do botão de redefinir senha (alvo de 44dp). */
const RESET_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const styles = StyleSheet.create({
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowName: {
    flex: 1,
  },
  resetButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 12,
    flexGrow: 1,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
});
