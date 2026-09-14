import React, { useCallback, useMemo, useState } from 'react';
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
import { FrequencyCard } from '@/components/FrequencyCard';
import { JustificationSheet, type JustificationDraft } from '@/components/JustificationSheet';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TeacherDot } from '@/components/TeacherDot';
import { TeacherRail } from '@/components/TeacherRail';
import { useAuth } from '@/context/AuthProvider';
import { useMonthlyFrequency } from '@/hooks/useMonthlyFrequency';
import { useStudentClasses, type StudentClassItem } from '@/hooks/useStudentClasses';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AttendanceStatus } from '@/services/classes.service';
import { submitJustification } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatTime, formatWeekday } from '@/utils/datetime';
import { ROTULO_DA_JUSTIFICATIVA } from '@/utils/frequency';

const SCREEN_EDGES = ['bottom'] as const;
const SEM_ALUNO: readonly string[] = [];

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
 * Justificativa só pode ser (re)enviada enquanto ninguém a revisou: depois
 * disso o banco recusa a edição, e reabrir a folha seria convite a um erro.
 */
function aceitaJustificativa(item: StudentClassItem): boolean {
  return item.justification === null || item.justification.status === 'pending';
}

interface StudentAulasListProps {
  navigation: AulasStackScreenProps<'AulasHome'>['navigation'];
}

/**
 * Aulas do aluno (Painel — agenda cronológica). Mostra a frequência do mês,
 * agrupa as próximas aulas por dia e mantém a declaração de presença por aula.
 * Ao avisar falta, oferece anexar uma justificativa (docs/FREQUENCIA.md).
 */
export function StudentAulasList({ navigation }: StudentAulasListProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, profile } = useAuth();
  const { items, loading, error, respond, reload } = useStudentClasses();
  const [aulaDaFalta, setAulaDaFalta] = useState<StudentClassItem | null>(null);

  const userId = session?.user.id ?? null;
  const idsDoAluno = useMemo(() => (userId === null ? SEM_ALUNO : [userId]), [userId]);
  const frequencia = useMonthlyFrequency(idsDoAluno);
  const minhaFrequencia = userId !== null ? frequencia.byUser[userId] ?? null : null;
  const recarregarFrequencia = frequencia.reload;

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

  const handleRespond = useCallback(
    async (item: StudentClassItem, status: AttendanceStatus) => {
      if (status === 'present') {
        await respond(item.id, 'present');
        return;
      }
      // Tocar de novo em "não vou" reabre a justificativa sem regravar a falta.
      if (item.myStatus !== 'absent' && !(await respond(item.id, 'absent'))) {
        return;
      }
      if (aceitaJustificativa(item)) {
        setAulaDaFalta(item);
      }
    },
    [respond],
  );

  const fecharFolha = useCallback(() => setAulaDaFalta(null), []);

  const enviarJustificativa = useCallback(
    async (rascunho: JustificationDraft) => {
      if (userId === null || aulaDaFalta === null) {
        return;
      }
      await submitJustification(userId, {
        classId: aulaDaFalta.id,
        message: rascunho.message,
        attachment: rascunho.attachment,
      });
      await reload();
    },
    [userId, aulaDaFalta, reload],
  );

  const abrirHistorico = useCallback(() => {
    if (userId === null) {
      return;
    }
    navigation.navigate('HistoricoFrequencia', {
      userId,
      name: profile?.name ?? 'Minha frequência',
    });
  }, [navigation, userId, profile]);

  const handleRefresh = useCallback(() => {
    void reload();
    void recarregarFrequencia();
  }, [reload, recarregarFrequencia]);

  const renderItem = useCallback(
    ({ item }: { item: StudentClassItem }) => (
      <ClassRow item={item} onRespond={handleRespond} styles={styles} colors={colors} />
    ),
    [handleRespond, styles, colors],
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
        <FrequencyCard
          frequency={minhaFrequencia}
          loading={frequencia.loading}
          onPress={abrirHistorico}
        />
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
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma aula por aqui"
            message="Assim que houver aulas para a sua turma, elas aparecerão aqui."
          />
        }
      />
      {aulaDaFalta !== null ? (
        <JustificationSheet
          key={aulaDaFalta.id}
          visible
          classTitle={aulaDaFalta.title}
          onClose={fecharFolha}
          onSubmit={enviarJustificativa}
        />
      ) : null}
    </ScreenWrapper>
  );
}

interface ClassRowProps {
  item: StudentClassItem;
  onRespond: (item: StudentClassItem, status: AttendanceStatus) => Promise<void>;
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
  const justificativa = absent && item.justification !== null ? item.justification : null;

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
        {justificativa !== null ? (
          <Text style={styles.justificativa} numberOfLines={1}>
            {ROTULO_DA_JUSTIFICATIVA[justificativa.status]}
          </Text>
        ) : null}
        <TeacherDot teachers={item.teachers} />
      </View>

      {isEvent ? (
        <View style={styles.eventPill}>
          <Text style={styles.eventText}>Evento</Text>
        </View>
      ) : (
        <View style={styles.presence}>
          <Pressable
            onPress={() => void onRespond(item, 'present')}
            style={[styles.pBtn, { borderColor: colors.success }, present ? { backgroundColor: colors.success } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: present }}
            accessibilityLabel="Confirmar presença"
          >
            <Ionicons name="checkmark" size={18} color={present ? colors.onPrimary : colors.success} />
          </Pressable>
          <Pressable
            onPress={() => void onRespond(item, 'absent')}
            style={[styles.pBtn, { borderColor: colors.error }, absent ? { backgroundColor: colors.error } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: absent }}
            accessibilityLabel="Avisar falta"
            accessibilityHint="Registra a falta e permite acrescentar uma justificativa"
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
    info: { flex: 1 },
    title: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    justificativa: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning, marginTop: 3 },
    presence: { flexDirection: 'row', gap: 8 },
    pBtn: {
      width: 44,
      height: 44,
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
