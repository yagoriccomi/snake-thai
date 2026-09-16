import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TeacherDot } from '@/components/TeacherDot';
import type { Fonts } from '@/constants/theme';
import { useGroupSchedules } from '@/hooks/useGroupSchedules';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import type { ClassTeacherRef } from '@/services/classes.service';
import { endSchedule, type ScheduleWithTeachers } from '@/services/schedules.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDate, isoDateKey } from '@/utils/datetime';
import { describeError } from '@/utils/errors';
import {
  dataBrValidaParaIso,
  horaCurta,
  horarioEstaAtivo,
  nomeDoDia,
  vigenciaEmTexto,
} from '@/utils/gradeSemanal';
import { maskDate } from '@/utils/masks';

const log = createLogger('GradeTurmaScreen');

const SCREEN_EDGES = ['bottom'] as const;
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;

/** Linha da lista: horário vigente ou encerrado, com o cabeçalho da seção. */
interface LinhaDaGrade {
  item: ScheduleWithTeachers;
  ativo: boolean;
  /** Primeiro encerrado: a lista mostra o rótulo "ENCERRADOS" antes dele. */
  abreEncerrados: boolean;
}

/** `TeacherDot` desenha professores de aula; na grade não há ordem de entrada. */
function comoProfessoresDaAula(item: ScheduleWithTeachers): ClassTeacherRef[] {
  return item.teachers.map((professor) => ({ ...professor, joinedAt: '' }));
}

/**
 * Grade semanal de uma turma (somente admin).
 *
 * Cada cartão é um horário fixo; as aulas saem dele sozinhas até o fim do mês
 * seguinte. Encerrar pede o último dia e diz o que sai da agenda. Os
 * encerrados ficam no fim, esmaecidos, e ainda podem ser editados (para
 * reabrir a vigência).
 */
export function GradeTurmaScreen({ navigation, route }: DadosStackScreenProps<'GradeTurma'>): React.JSX.Element {
  const { groupId, groupName } = route.params;
  const { colors, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, minHitSlop), [colors, fonts, minHitSlop]);
  const { schedules, loading, error, reload } = useGroupSchedules(groupId);

  const [aEncerrar, setAEncerrar] = useState<ScheduleWithTeachers | null>(null);
  const [ultimoDia, setUltimoDia] = useState('');
  const [erroDoEncerramento, setErroDoEncerramento] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const linhas = useMemo<LinhaDaGrade[]>(() => {
    const hoje = isoDateKey(new Date());
    const ativos = schedules.filter((item) => horarioEstaAtivo(item.schedule.valid_until, hoje));
    const encerrados = schedules.filter((item) => !horarioEstaAtivo(item.schedule.valid_until, hoje));
    return [
      ...ativos.map((item) => ({ item, ativo: true, abreEncerrados: false })),
      ...encerrados.map((item, indice) => ({ item, ativo: false, abreEncerrados: indice === 0 })),
    ];
  }, [schedules]);

  const novoHorario = useCallback(
    () => navigation.navigate('HorarioForm', { groupId, groupName }),
    [navigation, groupId, groupName],
  );

  const editar = useCallback(
    ({ schedule, teachers }: ScheduleWithTeachers) =>
      navigation.navigate('HorarioForm', {
        groupId,
        groupName,
        schedule: {
          id: schedule.id,
          title: schedule.title,
          weekday: schedule.weekday,
          startTime: horaCurta(schedule.start_time),
          validFrom: schedule.valid_from,
          validUntil: schedule.valid_until,
          teacherIds: teachers.map((professor) => professor.id),
        },
      }),
    [navigation, groupId, groupName],
  );

  const abrirEncerramento = useCallback((item: ScheduleWithTeachers) => {
    setUltimoDia(formatFullDate(new Date().toISOString()));
    setErroDoEncerramento(null);
    setAEncerrar(item);
  }, []);

  const fecharEncerramento = useCallback(() => {
    if (!encerrando) setAEncerrar(null);
  }, [encerrando]);

  const encerrar = useCallback(async () => {
    if (aEncerrar === null) return;
    const ultimoDiaIso = dataBrValidaParaIso(ultimoDia);
    if (ultimoDiaIso === null) {
      setErroDoEncerramento('Informe o último dia no formato DD/MM/AAAA.');
      return;
    }
    setEncerrando(true);
    setErroDoEncerramento(null);
    try {
      const resultado = await endSchedule(aEncerrar.schedule.id, ultimoDiaIso);
      setAEncerrar(null);
      void reload();
      Alert.alert(
        resultado.action === 'apagado' ? 'Horário apagado' : 'Horário encerrado',
        resultado.action === 'apagado'
          ? 'O horário ainda não tinha começado e foi apagado.'
          : resultado.removed === 0
            ? 'Nenhuma aula precisou sair da agenda.'
            : resultado.removed === 1
              ? '1 aula sem chamada saiu da agenda.'
              : `${resultado.removed} aulas sem chamada saíram da agenda.`,
      );
    } catch (falha) {
      log.error('Falha ao encerrar o horário', falha);
      setErroDoEncerramento(describeError(falha));
    } finally {
      setEncerrando(false);
    }
  }, [aEncerrar, ultimoDia, reload]);

  const renderLinha = useCallback<ListRenderItem<LinhaDaGrade>>(
    ({ item: { item, ativo, abreEncerrados } }) => {
      const { schedule } = item;
      const quando = `${nomeDoDia(schedule.weekday)} · ${horaCurta(schedule.start_time)}`;
      return (
        <View>
          {abreEncerrados ? <Text style={styles.sectionLabel}>ENCERRADOS</Text> : null}
          <View style={[styles.card, ativo ? null : styles.cardEnded]}>
            <View style={styles.cardTop}>
              <View style={styles.cardInfo}>
                <Text style={styles.when}>{quando}</Text>
                <AppText variant="subtitle" numberOfLines={2}>
                  {schedule.title}
                </AppText>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => editar(item)}
                  hitSlop={HIT_SLOP}
                  style={styles.iconAction}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar horário de ${quando}`}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                </Pressable>
                {ativo ? (
                  <Pressable
                    onPress={() => abrirEncerramento(item)}
                    hitSlop={HIT_SLOP}
                    style={styles.iconAction}
                    accessibilityRole="button"
                    accessibilityLabel={`Encerrar horário de ${quando}`}
                  >
                    <Ionicons name="stop-circle-outline" size={20} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {item.teachers.length > 0 ? (
              <TeacherDot teachers={comoProfessoresDaAula(item)} />
            ) : (
              <Text style={styles.meta}>Sem professor escalado</Text>
            )}
            <Text style={styles.meta}>{vigenciaEmTexto(schedule.valid_from, schedule.valid_until)}</Text>
          </View>
        </View>
      );
    },
    [styles, colors, editar, abrirEncerramento],
  );

  const cabecalho = useMemo(
    () => (
      <View style={styles.header}>
        <AppText variant="heading" numberOfLines={2}>
          {groupName}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          As aulas de cada horário entram na agenda sozinhas, até o fim do mês seguinte. Aulas com chamada nunca
          são alteradas pela grade.
        </AppText>
      </View>
    ),
    [styles, groupName, colors.textSecondary],
  );

  if (error !== null && schedules.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  if (loading && schedules.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando a grade" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={linhas}
        keyExtractor={keyExtractor}
        renderItem={renderLinha}
        removeClippedSubviews
        ListHeaderComponent={cabecalho}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="Nenhum horário"
            message="Toque em Novo horário para montar a grade semanal desta turma."
          />
        }
      />
      <Fab onPress={novoHorario} accessibilityLabel="Novo horário" label="Novo horário" />

      <BottomSheet visible={aEncerrar !== null} onClose={fecharEncerramento}>
        <AppText variant="subtitle">Encerrar horário</AppText>
        {aEncerrar !== null ? (
          <AppText variant="body" color={colors.textSecondary}>
            {`${nomeDoDia(aEncerrar.schedule.weekday)} · ${horaCurta(aEncerrar.schedule.start_time)} — ${aEncerrar.schedule.title}`}
          </AppText>
        ) : null}
        <AppText variant="body">
          As aulas depois do último dia que ainda não tiveram chamada saem da agenda, com as declarações e
          justificativas delas. Aulas com chamada ficam.
        </AppText>
        <Input
          label="Último dia com aula"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={ultimoDia}
          onChangeText={(valor) => setUltimoDia(maskDate(valor))}
          error={erroDoEncerramento ?? undefined}
        />
        <Button title="Encerrar horário" variant="danger" onPress={() => void encerrar()} loading={encerrando} />
        <Button title="Cancelar" variant="secondary" onPress={fecharEncerramento} disabled={encerrando} />
      </BottomSheet>
    </ScreenWrapper>
  );
}

const keyExtractor = (linha: LinhaDaGrade): string => linha.item.schedule.id;

function makeStyles(colors: ColorScheme, fonts: Fonts, minHitSlop: number) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingTop: 16,
      // Espaço para o botão flutuante não cobrir o último cartão.
      paddingBottom: 96,
      flexGrow: 1,
    },
    header: {
      gap: 6,
      marginBottom: 16,
    },
    sectionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      gap: 6,
    },
    cardEnded: {
      opacity: 0.7,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    cardInfo: {
      flex: 1,
      gap: 2,
    },
    cardActions: {
      flexDirection: 'row',
    },
    when: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.primaryText,
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    iconAction: {
      minWidth: minHitSlop,
      minHeight: minHitSlop,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
