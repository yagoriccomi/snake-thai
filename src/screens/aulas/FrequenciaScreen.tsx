import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AttendanceStatus, StudentRef } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;
const TAMANHO_ICONE_ACAO = 22;

const log = createLogger('FrequenciaScreen');

interface AttendanceSection {
  key: string;
  title: string;
  accent: string;
  data: StudentRef[];
}

/**
 * Controle de frequência de uma aula: lista os alunos elegíveis separados em
 * Confirmaram / Faltarão / Pendentes.
 *
 * Quando `canManage` é `true` (admin sempre; professor só nas próprias
 * aulas — decidido por quem navegou até aqui), cada aluno ganha ações para
 * confirmar, marcar falta ou limpar a resposta em nome dele. Sem
 * `canManage`, a tela é só leitura — é o que o professor vê ao abrir uma
 * aula onde ele NÃO é professor ("veem todas as aulas", mas não gerenciam
 * as que não são suas).
 */
export function FrequenciaScreen({
  route,
}: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors } = useTheme();
  const { classId, title, groupId, canManage } = route.params;
  const { present, absent, pending, loading, setStudentStatus, clearStudentStatus } =
    useClassAttendance(classId, groupId);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  const handleSetStatus = useCallback(
    async (userId: string, status: AttendanceStatus) => {
      setAlterandoId(userId);
      try {
        await setStudentStatus(userId, status);
      } catch (erro) {
        log.error('Falha ao definir presença', {
          classId,
          motivo: erro instanceof Error ? erro.message : 'desconhecido',
        });
      } finally {
        setAlterandoId(null);
      }
    },
    [setStudentStatus, classId],
  );

  const handleClear = useCallback(
    async (userId: string) => {
      setAlterandoId(userId);
      try {
        await clearStudentStatus(userId);
      } catch (erro) {
        log.error('Falha ao limpar presença', {
          classId,
          motivo: erro instanceof Error ? erro.message : 'desconhecido',
        });
      } finally {
        setAlterandoId(null);
      }
    },
    [clearStudentStatus, classId],
  );

  const sections = useMemo<AttendanceSection[]>(
    () => [
      { key: 'present', title: 'Confirmaram', accent: colors.success, data: present },
      { key: 'absent', title: 'Faltarão', accent: colors.error, data: absent },
      { key: 'pending', title: 'Pendentes', accent: colors.textSecondary, data: pending },
    ],
    [present, absent, pending, colors],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<StudentRef, AttendanceSection> }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
        <View style={[styles.dot, { backgroundColor: section.accent }]} />
        <AppText variant="subtitle">
          {section.title} ({section.data.length})
        </AppText>
      </View>
    ),
    [colors.background],
  );

  const renderItem = useCallback<SectionListRenderItem<StudentRef, AttendanceSection>>(
    ({ item, section }) => {
      const emAlteracao = alterandoId === item.id;
      return (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <AppText variant="body" style={styles.rowName}>
            {item.name ?? 'Aluno pendente'}
          </AppText>
          {canManage && (
            <View style={styles.actions}>
              {section.key !== 'present' && (
                <Pressable
                  onPress={() => void handleSetStatus(item.id, 'present')}
                  disabled={emAlteracao}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmar presença de ${item.name ?? 'aluno'}`}
                  hitSlop={8}
                >
                  <Ionicons name="checkmark-circle-outline" size={TAMANHO_ICONE_ACAO} color={colors.success} />
                </Pressable>
              )}
              {section.key !== 'absent' && (
                <Pressable
                  onPress={() => void handleSetStatus(item.id, 'absent')}
                  disabled={emAlteracao}
                  accessibilityRole="button"
                  accessibilityLabel={`Marcar falta de ${item.name ?? 'aluno'}`}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle-outline" size={TAMANHO_ICONE_ACAO} color={colors.error} />
                </Pressable>
              )}
              {section.key !== 'pending' && (
                <Pressable
                  onPress={() => void handleClear(item.id)}
                  disabled={emAlteracao}
                  accessibilityRole="button"
                  accessibilityLabel={`Limpar resposta de ${item.name ?? 'aluno'}`}
                  hitSlop={8}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={TAMANHO_ICONE_ACAO}
                    color={colors.textSecondary}
                  />
                </Pressable>
              )}
            </View>
          )}
        </View>
      );
    },
    [colors, canManage, alterandoId, handleSetStatus, handleClear],
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
          <>
            <AppText variant="heading" style={styles.title} numberOfLines={2}>
              {title}
            </AppText>
            {!canManage && (
              <AppText variant="caption" color={colors.textSecondary} style={styles.readOnlyNotice}>
                Você está vendo esta aula, mas só os professores dela podem alterar a
                presença.
              </AppText>
            )}
          </>
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: StudentRef): string => item.id;

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
  readOnlyNotice: {
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
  },
});
