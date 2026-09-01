import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TypeBadge } from '@/components/TypeBadge';
import type { Fonts, Radius } from '@/constants/theme';
import type { ClassRow } from '@/services/classes.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatTime } from '@/utils/datetime';

/** Altura fixa do card + margem — permite `getItemLayout` na FlatList. */
export const ADMIN_CARD_HEIGHT = 76;
export const ADMIN_CARD_MARGIN = 10;
export const ADMIN_CARD_TOTAL = ADMIN_CARD_HEIGHT + ADMIN_CARD_MARGIN;

interface AdminClassCardProps {
  item: ClassRow;
  onPress: (item: ClassRow) => void;
}

/**
 * Item da lista de aulas do admin: horário, título, tipo e turma. Ao tocar,
 * abre o controle de frequência. Memoizado para rolagem eficiente.
 */
function AdminClassCardComponent({ item, onPress }: AdminClassCardProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  const groupLabel = item.group_id !== null ? `Turma ${item.group_id}` : 'Global';

  return (
    <Pressable
      onPress={handlePress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Aula ${item.title} às ${formatTime(item.date_time)}`}
    >
      <View style={styles.timeBox}>
        <Text style={styles.time}>{formatTime(item.date_time)}</Text>
      </View>
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
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      height: ADMIN_CARD_HEIGHT,
      marginBottom: ADMIN_CARD_MARGIN,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    timeBox: {
      minWidth: 52,
      alignItems: 'center',
    },
    time: {
      fontFamily: fonts.bodyBold,
      fontSize: 16,
      color: colors.primaryText,
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

export const AdminClassCard = React.memo(AdminClassCardComponent);
