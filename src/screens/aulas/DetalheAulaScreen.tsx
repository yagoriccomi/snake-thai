import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { TypeBadge } from '@/components/TypeBadge';
import type { AulasStackScreenProps } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Detalhe de uma aula (admin). A partir dele o administrador decide entre
 * **editar a aula** (título, data/hora, turma) ou **fazer a chamada** de
 * presença — mantendo as duas ações a um toque uma da outra.
 */
export function DetalheAulaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'DetalheAula'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { classId, title, type, dateTimeIso, groupId, groupLabel } = route.params;

  const openEdit = useCallback(() => {
    navigation.navigate('CriarAula', { classId, title, type, dateTimeIso, groupId });
  }, [navigation, classId, title, type, dateTimeIso, groupId]);

  const openChamada = useCallback(() => {
    navigation.navigate('Frequencia', { classId, title, groupId });
  }, [navigation, classId, title, groupId]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.content}>
        <View style={styles.card}>
          <TypeBadge type={type} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.when}>{formatFullDateTime(dateTimeIso)}</Text>
          <View style={styles.divider} />
          <Text style={styles.group}>{groupLabel}</Text>
        </View>

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
            onPress={openChamada}
            style={styles.actionBtn}
            accessibilityHint="Abre o controle de presença desta aula"
          />
        </View>
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
