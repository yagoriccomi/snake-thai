import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import type { AulasStackScreenProps } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const SCREEN_EDGES = ['bottom'] as const;

interface AttendanceSection {
  key: string;
  title: string;
  accent: string;
  data: Profile[];
}

/**
 * Controle de frequência de uma aula (admin): lista os alunos elegíveis
 * separados em Confirmaram / Faltarão / Pendentes (não responderam).
 */
export function FrequenciaScreen({
  route,
}: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors } = useTheme();
  const { classId, title, groupId } = route.params;
  const { present, absent, pending, loading } = useClassAttendance(classId, groupId);

  const sections = useMemo<AttendanceSection[]>(
    () => [
      { key: 'present', title: 'Confirmaram', accent: colors.success, data: present },
      { key: 'absent', title: 'Faltarão', accent: colors.error, data: absent },
      { key: 'pending', title: 'Pendentes', accent: colors.textSecondary, data: pending },
    ],
    [present, absent, pending, colors],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Profile, AttendanceSection> }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <View style={[styles.dot, { backgroundColor: section.accent }]} />
        <AppText variant="subtitle">
          {section.title} ({section.data.length})
        </AppText>
      </View>
    ),
    [colors.background],
  );

  const renderItem = useCallback<SectionListRenderItem<Profile, AttendanceSection>>(
    ({ item }) => (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <AppText variant="body">{item.name ?? 'Aluno pendente'}</AppText>
      </View>
    ),
    [colors.border],
  );

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
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <AppText variant="heading" style={styles.title} numberOfLines={2}>
            {title}
          </AppText>
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    marginTop: 12,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
