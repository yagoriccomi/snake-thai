import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PedirCorSheet } from '@/components/PedirCorSheet';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { SituacaoDaAulaSheet } from '@/components/SituacaoDaAulaSheet';
import { TeacherDot } from '@/components/TeacherDot';
import { TypeBadge } from '@/components/TypeBadge';
import { useAuth } from '@/context/AuthProvider';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import { fetchMotivosDaAula, type MotivoDaAula } from '@/services/cancelamento.service';
import { fetchEstadoDaChamada } from '@/services/chamada.service';
import {
  addClassTeacher,
  fetchTeachersForClasses,
  removeClassTeacher,
  type ClassTeacherRef,
} from '@/services/classes.service';
import { updateOwnColor } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatFullDateTime, formatTime } from '@/utils/datetime';
import { describeError } from '@/utils/errors';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('DetalheAulaScreen');

/**
 * Detalhe de uma aula. As ações mudam conforme quem olha:
 * - Admin: **editar a aula** (título, data/hora, turma) e **fazer a
 *   chamada** de qualquer aula.
 * - Professor que já é um dos professores dela: só **fazer a chamada**
 *   (das suas) e a opção de **sair da aula**.
 * - Professor que ainda não é: **entrar na aula** (se incluir) — sem isso,
 *   a chamada fica só leitura, porque "veem todas as aulas" não é o mesmo
 *   que gerenciar todas. [#55]
 * - Admin também dá aula (contrato § 4): além de editar e fazer a chamada,
 *   **entra e sai** da aula. Sem cor, a folha pede a cor antes de entrar
 *   (T24), porque o trilho de cor da aula depende dela.
 */
export function DetalheAulaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'DetalheAula'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { isAdmin, isProfessor, profile, refreshProfile } = useAuth();
  const { classId, title, type, dateTimeIso, groupId, scheduleId, groupLabel } = route.params;
  const [teachers, setTeachers] = useState<ClassTeacherRef[]>([]);
  const [working, setWorking] = useState(false);
  const [erroDaEquipe, setErroDaEquipe] = useState<string | null>(null);
  const [pedindoCor, setPedindoCor] = useState(false);
  // Cancelamento (§ 6.1): a situação vem do banco, não dos parâmetros da rota.
  const [cancelada, setCancelada] = useState(false);
  const [cancelamento, setCancelamento] = useState<MotivoDaAula | null>(null);
  const [erroDaSituacao, setErroDaSituacao] = useState<string | null>(null);
  const [mudandoSituacao, setMudandoSituacao] = useState<'cancelar' | 'reativar' | null>(null);

  const loadTeachers = useCallback(() => {
    fetchTeachersForClasses([classId])
      .then((porAula) => {
        setTeachers(porAula[classId] ?? []);
        setErroDaEquipe(null);
      })
      .catch((erro: unknown) => {
        log.error('Falha ao carregar professores da aula', erro);
        setErroDaEquipe(`Não foi possível carregar os professores da aula. ${describeError(erro)}`);
      });
  }, [classId]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const carregarSituacao = useCallback(async () => {
    try {
      const estado = await fetchEstadoDaChamada(classId);
      setCancelada(estado.cancelled);
      setErroDaSituacao(null);
      if (!estado.cancelled || !(isAdmin || isProfessor)) {
        setCancelamento(null);
        return;
      }
      // O motivo só chega para a equipe da aula e os admins (T21).
      const motivos = await fetchMotivosDaAula(classId);
      setCancelamento([...motivos].reverse().find((motivo) => motivo.kind === 'class_cancel') ?? null);
    } catch (erro) {
      log.error('Falha ao carregar a situação da aula', erro, { classId });
      setErroDaSituacao('Não foi possível ver se a aula está cancelada.');
    }
  }, [classId, isAdmin, isProfessor]);

  useEffect(() => {
    void carregarSituacao();
  }, [carregarSituacao]);

  const souProfessorDaAula = teachers.some((teacher) => teacher.id === profile?.id);
  // D24: a equipe da aula ou um admin cancela e reativa.
  const podeCancelar = isAdmin || souProfessorDaAula;

  const openEdit = useCallback(() => {
    navigation.navigate('CriarAula', { classId, title, type, dateTimeIso, groupId, scheduleId });
  }, [navigation, classId, title, type, dateTimeIso, groupId, scheduleId]);

  const openChamada = useCallback(
    (canManage: boolean) => {
      navigation.navigate('Frequencia', { classId, title, groupId, canManage });
    },
    [navigation, classId, title, groupId],
  );

  const handleJoin = useCallback(async () => {
    if (profile === null) {
      return;
    }
    // Só o admin fica sem cor (o professor sempre tem): pede a cor antes (T24).
    if (profile.color === null) {
      setPedindoCor(true);
      return;
    }
    setWorking(true);
    setErroDaEquipe(null);
    try {
      await addClassTeacher(classId, profile.id);
      loadTeachers();
    } catch (erro) {
      log.error('Falha ao entrar na aula', erro);
      setErroDaEquipe(describeError(erro));
    } finally {
      setWorking(false);
    }
  }, [classId, profile, loadTeachers]);

  /** Folha da cor: salva a cor, recarrega o perfil e só então entra na aula. */
  const salvarCorEEntrar = useCallback(
    async (cor: string) => {
      if (profile === null) {
        return;
      }
      await updateOwnColor(profile.id, cor);
      await refreshProfile();
      await addClassTeacher(classId, profile.id);
      setPedindoCor(false);
      setErroDaEquipe(null);
      loadTeachers();
    },
    [classId, profile, refreshProfile, loadTeachers],
  );

  const handleLeave = useCallback(async () => {
    if (profile === null) {
      return;
    }
    setWorking(true);
    setErroDaEquipe(null);
    try {
      await removeClassTeacher(classId, profile.id);
      loadTeachers();
    } catch (erro) {
      log.error('Falha ao sair da aula', erro);
      setErroDaEquipe(describeError(erro));
    } finally {
      setWorking(false);
    }
  }, [classId, profile, loadTeachers]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.badges}>
            <TypeBadge type={type} />
            {cancelada ? <Selo texto="Cancelada" tom="erro" /> : null}
            {scheduleId !== null ? (
              <View style={styles.gradeBadge} accessibilityLabel="Aula da grade semanal">
                <Text style={styles.gradeBadgeText}>Grade semanal</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.title, cancelada ? styles.riscado : null]}>{title}</Text>
          <Text style={[styles.when, cancelada ? styles.riscado : null]}>{formatFullDateTime(dateTimeIso)}</Text>
          <View style={styles.divider} />
          <Text style={styles.group}>{groupLabel}</Text>
          {teachers.length > 0 && (
            <View style={styles.teachers}>
              <TeacherDot teachers={teachers} />
            </View>
          )}
        </View>

        {isAdmin && (
          <View style={styles.actions}>
            <Button
              title="Editar aula"
              variant="secondary"
              onPress={openEdit}
              style={styles.actionBtn}
              accessibilityHint="Abre o formulário para alterar título, data/hora e turma"
            />
            <Button
              title="Fazer chamada"
              onPress={() => openChamada(true)}
              style={styles.actionBtn}
              accessibilityHint="Abre o controle de presença desta aula"
            />
          </View>
        )}

        {isAdmin && (
          <Button
            title={souProfessorDaAula ? 'Sair da aula' : 'Entrar nesta aula'}
            variant="secondary"
            onPress={() => void (souProfessorDaAula ? handleLeave() : handleJoin())}
            loading={working}
            style={styles.equipeBtn}
            accessibilityHint={
              souProfessorDaAula
                ? 'Remove você dos professores desta aula'
                : 'Inclui você como um dos professores desta aula'
            }
          />
        )}

        {isProfessor && souProfessorDaAula && (
          <View style={styles.actions}>
            <Button
              title="Sair da aula"
              variant="secondary"
              onPress={() => void handleLeave()}
              loading={working}
              style={styles.actionBtn}
              accessibilityHint="Remove seu vínculo como professor desta aula"
            />
            <Button
              title="Fazer chamada"
              onPress={() => openChamada(true)}
              style={styles.actionBtn}
              accessibilityHint="Abre o controle de presença desta aula"
            />
          </View>
        )}

        {isProfessor && !souProfessorDaAula && (
          <View style={styles.actions}>
            <Button
              title="Ver chamada"
              variant="secondary"
              onPress={() => openChamada(false)}
              style={styles.actionBtn}
              accessibilityHint="Abre a lista de presença desta aula, só leitura"
            />
            <Button
              title="Entrar nesta aula"
              onPress={() => void handleJoin()}
              loading={working}
              style={styles.actionBtn}
              accessibilityHint="Inclui você como um dos professores desta aula"
            />
          </View>
        )}

        {cancelada && cancelamento !== null ? (
          <View style={styles.cartao} accessible>
            <Text style={styles.overline}>CANCELAMENTO</Text>
            <AppText variant="body">
              {`Por ${cancelamento.authorName ?? 'alguém da equipe'} em ${formatDayMonth(cancelamento.createdAt)} às ${formatTime(cancelamento.createdAt)}`}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {`Motivo: ${cancelamento.body}`}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Visto só por professores da aula e admins.
            </AppText>
          </View>
        ) : null}
        {cancelada ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.explicacao}>
            Fixos da turma: aula abonada, o mês fica com uma aula a menos. Livres que tinham marcado: uma aula a menos no
            esperado da semana. Ninguém se inclui nem faz chamada numa aula cancelada; ela continua na grade, riscada.
          </AppText>
        ) : null}
        {erroDaSituacao !== null ? (
          <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.erro}>
            {erroDaSituacao}
          </AppText>
        ) : null}
        {podeCancelar ? (
          <Button
            title={cancelada ? 'Reativar aula' : 'Cancelar aula'}
            variant={cancelada ? 'secondary' : 'danger'}
            onPress={() => setMudandoSituacao(cancelada ? 'reativar' : 'cancelar')}
            style={styles.equipeBtn}
            accessibilityHint={
              cancelada ? 'Pede o motivo e avisa as mesmas pessoas' : 'Pede o motivo e avisa os alunos e a equipe'
            }
          />
        ) : null}
        {podeCancelar && cancelada ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.explicacao}>
            Reativar também pede motivo e avisa as mesmas pessoas, respeitando o silêncio das 22h às 7h.
          </AppText>
        ) : null}

        {erroDaEquipe !== null ? (
          <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.erro}>
            {erroDaEquipe}
          </AppText>
        ) : null}
      </View>

      <SituacaoDaAulaSheet
        visible={mudandoSituacao !== null}
        classId={classId}
        acao={mudandoSituacao ?? 'cancelar'}
        onClose={() => setMudandoSituacao(null)}
        onFeito={() => void carregarSituacao()}
      />
      <PedirCorSheet
        visible={pedindoCor}
        onClose={() => setPedindoCor(false)}
        onConfirmar={salvarCorEEntrar}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      gap: 8,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    gradeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.textSecondary,
    },
    gradeBadgeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    title: {
      fontFamily: fonts.headingBold,
      fontSize: 24,
      color: colors.textPrimary,
      marginTop: 2,
    },
    when: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    group: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    teachers: {
      marginTop: 4,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    actionBtn: {
      flex: 1,
    },
    equipeBtn: {
      marginTop: 12,
    },
    erro: {
      marginTop: 12,
    },
    riscado: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    cartao: {
      marginTop: 16,
      gap: 6,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
    },
    explicacao: {
      marginTop: 12,
    },
  });
}
