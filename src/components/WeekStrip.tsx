import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  type ListRenderItem,
} from 'react-native';

import type { Fonts, Radius } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import type { DayItem } from '@/utils/datetime';

const DAY_WIDTH = 56;
const DAY_GAP = 8;
const ITEM_WIDTH = DAY_WIDTH + DAY_GAP;

interface WeekStripProps {
  days: DayItem[];
  selectedKey: string;
  onSelect: (day: DayItem) => void;
}

/**
 * Faixa horizontal de dias (calendário leve) — FlatList otimizada com
 * `getItemLayout`/`keyExtractor` para rolagem sem perda de quadros.
 */
function WeekStripComponent({
  days,
  selectedKey,
  onSelect,
}: WeekStripProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const renderItem = useCallback<ListRenderItem<DayItem>>(
    ({ item }) => (
      <DayPill
        day={item}
        selected={item.key === selectedKey}
        styles={styles}
        onSelect={onSelect}
      />
    ),
    [selectedKey, styles, onSelect],
  );

  return (
    <FlatList
      data={days}
      horizontal
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      extraData={selectedKey}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    />
  );
}

const keyExtractor = (item: DayItem): string => item.key;

const getItemLayout = (
  _data: ArrayLike<DayItem> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: ITEM_WIDTH,
  offset: ITEM_WIDTH * index,
  index,
});

interface DayPillProps {
  day: DayItem;
  selected: boolean;
  styles: ReturnType<typeof makeStyles>;
  onSelect: (day: DayItem) => void;
}

/** Pílula de um dia — memoizada para não re-renderizar os dias não afetados. */
const DayPill = React.memo(function DayPill({
  day,
  selected,
  styles,
  onSelect,
}: DayPillProps): React.JSX.Element {
  const handlePress = useCallback(() => onSelect(day), [onSelect, day]);
  return (
    <Pressable
      onPress={handlePress}
      style={[styles.day, selected ? styles.daySelected : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${day.weekday} ${day.day}`}
    >
      <Text style={[styles.weekday, selected ? styles.textSelected : null]}>
        {day.weekday}
      </Text>
      <Text style={[styles.dayNumber, selected ? styles.textSelected : null]}>
        {day.day}
      </Text>
      {day.isToday ? <Text style={styles.todayDot}>•</Text> : null}
    </Pressable>
  );
});

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    list: {
      gap: DAY_GAP,
      paddingVertical: 8,
    },
    day: {
      width: DAY_WIDTH,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    daySelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    weekday: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    dayNumber: {
      fontFamily: fonts.bodyBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    textSelected: {
      color: colors.onPrimary,
    },
    todayDot: {
      color: colors.primary,
      fontSize: 12,
      lineHeight: 12,
    },
  });
}

export const WeekStrip = React.memo(WeekStripComponent);
