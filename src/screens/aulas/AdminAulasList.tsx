import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TeacherDot } from '@/components/TeacherDot';
import { TeacherRail } from '@/components/TeacherRail';
import { TypeBadge } from '@/components/TypeBadge';
import { WeekStrip } from '@/components/WeekStrip';
import { useAdminClassesForDay } from '@/hooks/useAdminClassesForDay';
import { useGroups } from '@/hooks/useGroups';
import type { AulasStackScreenProps } from '@/navigation/types';
import {
  fetchTeachersForClasses,
  type ClassRow,
  type ClassTeacherRef,
} from '@/services/classes.service';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { buildDayStrip, formatTime, type DayItem } from '@/utils/datetime';

const log = createLogger('AdminAulasList');

const SCREEN_EDGES = ['bottom'] as const;
const STRIP_DAYS = 21;

interface AdminAulasListProps {
  navigation: AulasStackScreenProps<'AulasHome'>['navigation'];
}

/**
 * Gestão de aulas (admin) — Painel, agenda em timeline (mesmo desenho da visão
 * do aluno). Calendário horizontal, aulas do dia com trilho de horário, e FAB
 * para criar. Tocar numa aula abre o detalhe, de onde se edita ou faz a chamada.
 */
export function AdminAulasList({ navigation }: AdminAulasListProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const days = useMemo(() => buildDayStrip(new Date(), STRIP_DAYS), []);
  const firstDay = days[0];
  const [selectedKey, setSelectedKey] = useState(firstDay?.key ?? '');
  const [selectedDate, setSelectedDate] = useState<Date>(firstDay?.date ?? new Date());

  const { items, loading, error, reload } = useAdminClassesForDay(selectedDate);
  const { groups } = useGroups();
  const [teachersByClass, setTeachersByClass] = useState<Record<string, ClassTeacherRef[]>>({});

  // Professores das aulas do dia, para pintar trilho e bolinhas — uma
  // consulta só para todas as aulas visíveis, não uma por card. [#70]
  useEffect(() => {
    let ativo = true;
    const classIds = items.map((item) => item.id);
    fetchTeachersForClasses(classIds)
      .then((porAula) => {
        if (ativo) {
          setTeachersByClass(porAula);
        }
      })
      .catch((erro: unknown) => {
        log.error('Falha ao carregar professores das aulas', erro);
      });
    return () => {
      ativo = false;
    };
  }, [items]);

  // Mapa id→nome da turma, para exibir o nome real em vez do UUID.
  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      map.set(group.id, group.name);
    }
    return map;
  }, [groups]);

  // Recarrega ao voltar o foco (ex.: após criar ou editar uma aula).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const handleSelectDay = useCallback((day: DayItem) => {
    setSelectedKey(day.key);
    setSelectedDate(day.date);
  }, []);

  const openDetalhe = useCallback(
    (item: ClassRow, groupLabel: string) => {
      navigation.navigate('DetalheAula', {
        classId: item.id,
        title: item.title,
        type: item.type,
        dateTimeIso: item.date_time,
        groupId: item.group_id,
        groupLabel,
      });
    },
    [navigation],
  );

  const openCriarAula = useCallback(() => {
    navigation.navigate('CriarAula');
  }, [navigation]);

  const renderItem = useCallback<ListRenderItem<ClassRow>>(
    ({ item }) => {
      const groupLabel =
        item.group_id === null
          ? 'Global'
          : groupNameById.get(item.group_id) ?? 'Turma';
      const teachers = teachersByClass[item.id] ?? [];
      return (
        <Pressable
          onPress={() => openDetalhe(item, groupLabel)}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Aula ${item.title} às ${formatTime(item.date_time)}`}
          accessibilityHint="Abre o detalhe para editar ou fazer a chamada"
        >
          <View style={styles.timeCol}>
            <Text style={styles.time}>{formatTime(item.date_time)}</Text>
          </View>
          <TeacherRail teachers={teachers} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.meta}>
              <TypeBadge type={item.type} />
              <Text style={styles.group} numberOfLines={1}>
                {groupLabel}
              </Text>
            </View>
            <TeacherDot teachers={teachers} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      );
    },
    [styles, colors.textSecondary, groupNameById, openDetalhe, teachersByClass],
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <View style={styles.strip}>
        <WeekStrip days={days} selectedKey={selectedKey} onSelect={handleSelectDay} />
      </View>

      {error !== null && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="Sem aulas neste dia"
              message="Toque em “Criar Aula” para adicionar uma rotina ou evento."
            />
          }
        />
      )}

      <Fab
        onPress={openCriarAula}
        label="Criar Aula"
        accessibilityLabel="Criar nova aula"
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: ClassRow): string => item.id;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    strip: {
      paddingHorizontal: 16,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 96,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    timeCol: {
      width: 48,
      alignItems: 'flex-end',
    },
    time: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    rail: {
      width: 2,
      alignSelf: 'stretch',
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    group: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      flexShrink: 1,
    },
  });
}
