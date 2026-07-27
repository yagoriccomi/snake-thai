import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { GroupPicker } from '@/components/GroupPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { fetchAllStudents, updateStudentGroup } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Gestão de alunos (admin): lista todos os alunos e permite atribuir/alterar a
 * turma de cada um diretamente pela UI (via GroupPicker), com atualização otimista.
 */
export function GerenciarAlunosScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderItem = useCallback<ListRenderItem<Profile>>(
    ({ item }) => (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <AppText variant="subtitle" numberOfLines={1}>
          {item.name ?? 'Aluno pendente'}
        </AppText>
        <GroupPicker
          value={item.group_id}
          onChange={(groupId) => void handleChangeGroup(item.id, groupId)}
        />
      </View>
    ),
    [colors.border, handleChangeGroup],
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

const styles = StyleSheet.create({
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
