import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TeacherDot } from '@/components/TeacherDot';
import { TeacherRail } from '@/components/TeacherRail';
import { useStudentClasses, type StudentClassItem } from '@/hooks/useStudentClasses';
import type { AttendanceStatus } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatTime, formatWeekday } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;

/** Uma seção da agenda: as aulas de um mesmo dia. */
interface DaySection {
  title: string;
  data: StudentClassItem[];
}

/** Chave local (ano-mês-dia) de uma data, para agrupar sem confundir fuso. */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Rótulo do dia: HOJE / AMANHÃ / dia da semana + data. */
function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const suffix = `${formatWeekday(iso)} ${formatDayMonth(iso)}`.toUpperCase();
  if (localDayKey(day) === localDayKey(today)) return `HOJE · ${suffix}`;
  if (localDayKey(day) === localDayKey(tomorrow)) return `AMANHÃ · ${suffix}`;
  return suffix;
}

/**
 * Aulas do aluno (Painel — agenda cronológica). Agrupa as próximas aulas por
 * dia, com trilho de horário à esquerda, e mantém a marcação de presença
 * (confirmar/avisar falta) por aula.
 */
export function StudentAulasList(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { items, loading, error, respond, reload } = useStudentClasses();

  // Agrupa as aulas (já ordenadas por data) em seções por dia, preservando a ordem.
  const sections = useMemo<DaySection[]>(() => {
    const result: DaySection[] = [];
    let currentKey: string | null = null;
    for (const item of items) {
      const key = localDayKey(new Date(item.date_time));
      if (key !== currentKey) {
        currentKey = key;
        result.push({ title: dayLabel(item.date_time), data: [item] });
      } else {
        result[result.length - 1]?.data.push(item);
      }
    }
    return result;
  }, [items]);

  const renderItem = useCallback(
    ({ item }: { item: StudentClassItem }) => (
      <ClassRow item={item} onRespond={respond} styles={styles} colors={colors} />
    ),
    [respond, styles, colors],
  );

  if (error !== null && items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  if (loading && items.length === 0) {
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
      <View style={styles.header}>
        <Text style={styles.overline}>MINHAS AULAS</Text>
        <AppText variant="heading">Próximas</AppText>
      </View>
      {error !== null ? (
        <AppText variant="caption" color={colors.error} style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma aula por aqui"
            message="Assim que houver aulas para a sua turma, elas aparecerão aqui."
          />
        }
      />
    </ScreenWrapper>
  );
}

interface ClassRowProps {
  item: StudentClassItem;
  onRespond: (classId: string, status: AttendanceStatus) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}

/** Linha da timeline: horário à esquerda, aula ao centro, presença à direita. */
const ClassRow = React.memo(function ClassRow({
  item,
  onRespond,
  styles,
  colors,
}: ClassRowProps): React.JSX.Element {
  const isEvent = item.type === 'event';
  const present = item.myStatus === 'present';
  const absent = item.myStatus === 'absent';

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{formatTime(item.date_time)}</Text>
      </View>
      <TeacherRail teachers={item.teachers} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isEvent ? 'Evento · aberto a todas as turmas' : 'Sua turma'}
        </Text>
        <TeacherDot teachers={item.teachers} />
      </View>

      {isEvent ? (
        <View style={styles.eventPill}>
          <Text style={styles.eventText}>Evento</Text>
        </View>
      ) : (
        <View style={styles.presence}>
          <Pressable
            onPress={() => onRespond(item.id, 'present')}
            style={[styles.pBtn, { borderColor: colors.success }, present ? { backgroundColor: colors.success } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: present }}
            accessibilityLabel="Confirmar presença"
          >
            <Ionicons name="checkmark" size={18} color={present ? colors.onPrimary : colors.success} />
          </Pressable>
          <Pressable
            onPress={() => onRespond(item.id, 'absent')}
            style={[styles.pBtn, { borderColor: colors.error }, absent ? { backgroundColor: colors.error } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: absent }}
            accessibilityLabel="Avisar falta"
          >
            <Ionicons name="close" size={18} color={absent ? colors.onPrimary : colors.error} />
          </Pressable>
        </View>
      )}
    </View>
  );
});

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { paddingTop: 12, paddingBottom: 6 },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    error: { marginTop: 4 },
    content: { paddingBottom: 24, flexGrow: 1 },
    dayHeader: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.textSecondary,
      marginTop: 14,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    timeCol: { width: 48, alignItems: 'flex-end' },
    time: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    rail: { width: 2, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.border },
    info: { flex: 1 },
    title: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    presence: { flexDirection: 'row', gap: 8 },
    pBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventPill: {
      borderWidth: 1,
      borderColor: '#93C5FD',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    eventText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: '#93C5FD' },
  });
}
