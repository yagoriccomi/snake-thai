import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TeacherDot } from '@/components/TeacherDot';
import { TypeBadge } from '@/components/TypeBadge';
import { useAuth } from '@/context/AuthProvider';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import {
  addClassTeacher,
  fetchTeachersForClasses,
  removeClassTeacher,
  type ClassTeacherRef,
} from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';

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
 */
export function DetalheAulaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'DetalheAula'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { isAdmin, isProfessor, profile } = useAuth();
  const { classId, title, type, dateTimeIso, groupId, groupLabel } = route.params;
  const [teachers, setTeachers] = useState<ClassTeacherRef[]>([]);
  const [working, setWorking] = useState(false);

  const loadTeachers = useCallback(() => {
    fetchTeachersForClasses([classId])
      .then((porAula) => setTeachers(porAula[classId] ?? []))
      .catch((erro: unknown) => {
        log.error('Falha ao carregar professores da aula', erro);
      });
  }, [classId]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const souProfessorDaAula = teachers.some((teacher) => teacher.id === profile?.id);

  const openEdit = useCallback(() => {
    navigation.navigate('CriarAula', { classId, title, type, dateTimeIso, groupId });
  }, [navigation, classId, title, type, dateTimeIso, groupId]);

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
    setWorking(true);
    try {
      await addClassTeacher(classId, profile.id);
      loadTeachers();
    } catch (erro) {
      log.error('Falha ao entrar na aula', erro);
    } finally {
      setWorking(false);
    }
  }, [classId, profile, loadTeachers]);

  const handleLeave = useCallback(async () => {
    if (profile === null) {
      return;
    }
    setWorking(true);
    try {
      await removeClassTeacher(classId, profile.id);
      loadTeachers();
    } catch (erro) {
      log.error('Falha ao sair da aula', erro);
    } finally {
      setWorking(false);
    }
  }, [classId, profile, loadTeachers]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.content}>
        <View style={styles.card}>
          <TypeBadge type={type} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.when}>{formatFullDateTime(dateTimeIso)}</Text>
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
      </View>
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
  });
}
