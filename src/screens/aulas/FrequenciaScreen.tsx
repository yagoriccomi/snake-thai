import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { JustificationReview } from '@/components/JustificationReview';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import { useMonthlyFrequency } from '@/hooks/useMonthlyFrequency';
import { useRollCallReview } from '@/hooks/useRollCallReview';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AttendanceStatus, StudentRef } from '@/services/classes.service';
import {
  fetchJustificationAttachmentUrl,
  type JustificationStatus,
} from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';
import { formatarPercentual } from '@/utils/frequency';

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
 * Chamada de uma aula: lista os alunos elegíveis separados pela CHAMADA do
 * professor em Presentes / Faltaram / Sem chamada. O que cada aluno declarou
 * no app aparece abaixo do nome só como referência — não conta como presença
 * (docs/FREQUENCIA.md).
 *
 * Marcar presenças não basta: a aula só entra na frequência quando alguém
 * toca em "Concluir chamada". Cada aluno mostra ainda a frequência do mês e,
 * se houver, a justificativa de falta a revisar.
 *
 * Quando `canManage` é `true` (admin sempre; professor só nas próprias
 * aulas — decidido por quem navegou até aqui), a tela oferece as ações. Sem
 * `canManage`, é só leitura — o que o professor vê numa aula que não é dele.
 */
export function FrequenciaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors } = useTheme();
  const { classId, title, groupId, canManage } = route.params;
  const {
    present,
    absent,
    pending,
    declaredByStudent,
    loading,
    setStudentStatus,
    clearStudentStatus,
  } = useClassAttendance(classId, groupId);
  const chamada = useRollCallReview(classId);
  const { conclude, review } = chamada;

  // Ordenados para a chave do hook não mudar quando um aluno troca de seção.
  const idsDosAlunos = useMemo(
    () => [...present, ...absent, ...pending].map((aluno) => aluno.id).sort(),
    [present, absent, pending],
  );
  const frequencia = useMonthlyFrequency(idsDosAlunos);
  const recarregarFrequencia = frequencia.reload;

  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const estado = chamada.state;
  const aulaComecou = estado !== null && Date.parse(estado.dateTimeIso) <= Date.now();
  const podeConcluir = canManage && estado !== null && estado.concludedAt === null && aulaComecou;

  const handleSetStatus = useCallback(
    async (userId: string, status: AttendanceStatus) => {
      setAlterandoId(userId);
      try {
        await setStudentStatus(userId, status);
        await recarregarFrequencia();
      } catch (erro) {
        log.error('Falha ao definir presença', erro, { classId });
      } finally {
        setAlterandoId(null);
      }
    },
    [setStudentStatus, recarregarFrequencia, classId],
  );

  const handleClear = useCallback(
    async (userId: string) => {
      setAlterandoId(userId);
      try {
        await clearStudentStatus(userId);
        await recarregarFrequencia();
      } catch (erro) {
        log.error('Falha ao limpar presença', erro, { classId });
      } finally {
        setAlterandoId(null);
      }
    },
    [clearStudentStatus, recarregarFrequencia, classId],
  );

  const concluir = useCallback(async () => {
    setConcluindo(true);
    setAviso(null);
    try {
      await conclude();
      await recarregarFrequencia();
    } catch (erro) {
      log.error('Falha ao concluir a chamada', erro, { classId });
      setAviso('Não foi possível concluir a chamada. Tente de novo.');
    } finally {
      setConcluindo(false);
    }
  }, [conclude, recarregarFrequencia, classId]);

  const handleConcluir = useCallback(() => {
    // Quem ficou sem chamada conta como falta a partir daqui — isso precisa
    // ser dito ANTES, não descoberto no fim do mês.
    const alerta =
      pending.length > 0
        ? `${pending.length} aluno(s) ainda sem chamada vão contar como falta.`
        : 'As presenças marcadas passam a contar na frequência.';
    Alert.alert('Concluir chamada', `${alerta} Você ainda pode corrigir a chamada depois.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Concluir', onPress: () => void concluir() },
    ]);
  }, [pending.length, concluir]);

  const handleReview = useCallback(
    async (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => {
      setAlterandoId(justificationId);
      setAviso(null);
      try {
        await review(justificationId, status);
        await recarregarFrequencia();
      } catch (erro) {
        log.error('Falha ao revisar justificativa', erro, { classId });
        setAviso('Não foi possível registrar a revisão. Tente de novo.');
      } finally {
        setAlterandoId(null);
      }
    },
    [review, recarregarFrequencia, classId],
  );

  const handleAbrirAnexo = useCallback(
    async (justificationId: string) => {
      setAviso(null);
      try {
        const anexo = await fetchJustificationAttachmentUrl(justificationId);
        await Linking.openURL(anexo.url);
      } catch (erro) {
        log.error('Falha ao abrir anexo da justificativa', erro, { classId });
        setAviso('Não foi possível abrir o anexo. Tente de novo.');
      }
    },
    [classId],
  );

  const abrirHistorico = useCallback(
    (aluno: StudentRef) => {
      navigation.navigate('HistoricoFrequencia', {
        userId: aluno.id,
        name: aluno.name ?? 'Aluno',
      });
    },
    [navigation],
  );

  const sections = useMemo<AttendanceSection[]>(
    () => [
      { key: 'present', title: 'Presentes', accent: colors.success, data: present },
      { key: 'absent', title: 'Faltaram', accent: colors.error, data: absent },
      { key: 'pending', title: 'Sem chamada', accent: colors.textSecondary, data: pending },
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
      const doMes = frequencia.byUser[item.id];
      const justificativa = chamada.justificationsByUser[item.id];
      return (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowName}>
            <Pressable
              onPress={() => abrirHistorico(item)}
              accessibilityRole="button"
              accessibilityLabel={`Frequência de ${item.name ?? 'aluno'}`}
              accessibilityHint="Abre o histórico mensal do aluno"
              style={styles.nameButton}
            >
              <AppText variant="body">{item.name ?? 'Aluno pendente'}</AppText>
              {doMes !== undefined ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  Frequência {formatarPercentual(doMes.frequencyPercent)} · {doMes.attended}/
                  {doMes.totalClasses} no mês
                </AppText>
              ) : null}
              {declaredByStudent[item.id] !== undefined ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  {declaredByStudent[item.id] === 'present'
                    ? 'Declarou que vem'
                    : 'Declarou que não vem'}
                </AppText>
              ) : null}
            </Pressable>
            {justificativa !== undefined ? (
              <JustificationReview
                justification={justificativa}
                canReview={canManage}
                busy={alterandoId === justificativa.id}
                onReview={(id, status) => void handleReview(id, status)}
                onOpenAttachment={(id) => void handleAbrirAnexo(id)}
              />
            ) : null}
          </View>
          {canManage && (
            <View style={styles.actions}>
              {section.key !== 'present' && (
                <Pressable
                  onPress={() => void handleSetStatus(item.id, 'present')}
                  disabled={emAlteracao}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmar presença de ${item.name ?? 'aluno'}`}
                  hitSlop={11}
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
                  hitSlop={11}
                >
                  <Ionicons name="close-circle-outline" size={TAMANHO_ICONE_ACAO} color={colors.error} />
                </Pressable>
              )}
              {section.key !== 'pending' && (
                <Pressable
                  onPress={() => void handleClear(item.id)}
                  disabled={emAlteracao}
                  accessibilityRole="button"
                  accessibilityLabel={`Desfazer chamada de ${item.name ?? 'aluno'}`}
                  hitSlop={11}
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
    [
      colors,
      canManage,
      alterandoId,
      handleSetStatus,
      handleClear,
      handleReview,
      handleAbrirAnexo,
      abrirHistorico,
      declaredByStudent,
      frequencia.byUser,
      chamada.justificationsByUser,
    ],
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

  const cabecalho = (
    <>
      <AppText variant="heading" style={styles.title} numberOfLines={2}>
        {title}
      </AppText>
      {!canManage && (
        <AppText variant="caption" color={colors.textSecondary} style={styles.notice}>
          Você está vendo esta aula, mas só os professores dela podem alterar a
          presença.
        </AppText>
      )}
      {estado !== null && estado.concludedAt !== null ? (
        <View style={styles.concluded}>
          <Ionicons name="checkmark-done" size={18} color={colors.success} />
          <AppText variant="caption" color={colors.success}>
            Chamada concluída · {formatFullDateTime(estado.concludedAt)}
          </AppText>
        </View>
      ) : null}
      {podeConcluir ? (
        <Button
          title="Concluir chamada"
          onPress={handleConcluir}
          loading={concluindo}
          style={styles.conclude}
          accessibilityHint="Faz esta aula contar na frequência dos alunos"
        />
      ) : null}
      {canManage && estado !== null && estado.concludedAt === null && !aulaComecou ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.notice}>
          A chamada poderá ser concluída quando a aula começar.
        </AppText>
      ) : null}
      {estado?.type === 'event' ? (
        <AppText variant="caption" color={colors.textSecondary} style={styles.notice}>
          Eventos não contam na frequência.
        </AppText>
      ) : null}
      {aviso !== null || chamada.error !== null ? (
        <AppText variant="caption" color={colors.error} style={styles.notice}>
          {aviso ?? chamada.error}
        </AppText>
      ) : null}
    </>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        ListHeaderComponent={cabecalho}
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
  notice: {
    marginBottom: 12,
  },
  concluded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  conclude: {
    marginVertical: 12,
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
  nameButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
  },
});
