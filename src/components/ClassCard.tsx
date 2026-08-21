import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { TypeBadge } from '@/components/TypeBadge';
import type { Fonts, Radius } from '@/constants/theme';
import type { AttendanceStatus } from '@/services/classes.service';
import type { StudentClassItem } from '@/hooks/useStudentClasses';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';

/** Altura fixa do card + margem — permite `getItemLayout` na FlatList. */
export const CLASS_CARD_HEIGHT = 150;
export const CLASS_CARD_MARGIN = 12;
export const CLASS_CARD_TOTAL = CLASS_CARD_HEIGHT + CLASS_CARD_MARGIN;

interface ClassCardProps {
  item: StudentClassItem;
  onRespond: (classId: string, status: AttendanceStatus) => void;
}

/**
 * Card de aula (visão do aluno). Exibe data/horário/tipo e os botões de resposta.
 * O status só é gravado no toque; a escolha atual fica destacada e pode ser trocada.
 * Memoizado para não re-renderizar em rolagens que não o alteram.
 */
function ClassCardComponent({ item, onRespond }: ClassCardProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const handleConfirm = useCallback(
    () => onRespond(item.id, 'present'),
    [onRespond, item.id],
  );
  const handleAbsent = useCallback(
    () => onRespond(item.id, 'absent'),
    [onRespond, item.id],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.datetime}>{formatFullDateTime(item.date_time)}</Text>
        <TypeBadge type={item.type} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <View style={styles.actions}>
        <AttendanceButton
          label="Confirmar Presença"
          icon="checkmark-circle-outline"
          accent={colors.primary}
          onAccent={colors.onPrimary}
          selected={item.myStatus === 'present'}
          styles={styles}
          onPress={handleConfirm}
        />
        <AttendanceButton
          label="Avisar Falta"
          icon="close-circle-outline"
          accent={colors.error}
          onAccent={colors.textPrimary}
          selected={item.myStatus === 'absent'}
          styles={styles}
          onPress={handleAbsent}
        />
      </View>
    </View>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface AttendanceButtonProps {
  label: string;
  icon: IoniconName;
  accent: string;
  onAccent: string;
  selected: boolean;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}

/** Botão de presença/falta com contorno colorido; preenche quando selecionado. */
const AttendanceButton = React.memo(function AttendanceButton({
  label,
  icon,
  accent,
  onAccent,
  selected,
  styles,
  onPress,
}: AttendanceButtonProps): React.JSX.Element {
  const getStyle = useCallback(
    ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
      styles.actionBtn,
      { borderColor: accent },
      selected ? { backgroundColor: accent } : null,
      pressed ? styles.actionPressed : null,
    ],
    [styles, accent, selected],
  );

  return (
    <Pressable
      onPress={onPress}
      style={getStyle}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={selected ? onAccent : accent} />
      <Text
        style={[styles.actionLabel, { color: selected ? onAccent : accent }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      height: CLASS_CARD_HEIGHT,
      marginBottom: CLASS_CARD_MARGIN,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    datetime: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.textPrimary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 8,
    },
    actionPressed: {
      opacity: 0.7,
    },
    actionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
    },
  });
}

export const ClassCard = React.memo(ClassCardComponent);
