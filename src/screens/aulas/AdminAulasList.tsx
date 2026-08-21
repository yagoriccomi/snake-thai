import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  ADMIN_CARD_TOTAL,
  AdminClassCard,
} from '@/components/AdminClassCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Fab } from '@/components/Fab';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { WeekStrip } from '@/components/WeekStrip';
import { useAdminClassesForDay } from '@/hooks/useAdminClassesForDay';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { ClassRow } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { buildDayStrip, type DayItem } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;
const STRIP_DAYS = 21;

interface AdminAulasListProps {
  navigation: AulasStackScreenProps<'AulasHome'>['navigation'];
}

/** Gestão de aulas (admin): calendário horizontal, lista do dia e criação. */
export function AdminAulasList({ navigation }: AdminAulasListProps): React.JSX.Element {
  const { colors } = useTheme();
  const days = useMemo(() => buildDayStrip(new Date(), STRIP_DAYS), []);
  const firstDay = days[0];
  const [selectedKey, setSelectedKey] = useState(firstDay?.key ?? '');
  const [selectedDate, setSelectedDate] = useState<Date>(firstDay?.date ?? new Date());

  const { items, loading, error, reload } = useAdminClassesForDay(selectedDate);

  // Recarrega ao voltar o foco (ex.: após criar uma aula).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const handleSelectDay = useCallback((day: DayItem) => {
    setSelectedKey(day.key);
    setSelectedDate(day.date);
  }, []);

  const openFrequencia = useCallback(
    (item: ClassRow) => {
      navigation.navigate('Frequencia', {
        classId: item.id,
        title: item.title,
        groupId: item.group_id,
      });
    },
    [navigation],
  );

  const openCriarAula = useCallback(() => {
    navigation.navigate('CriarAula');
  }, [navigation]);

  const renderItem = useCallback<ListRenderItem<ClassRow>>(
    ({ item }) => <AdminClassCard item={item} onPress={openFrequencia} />,
    [openFrequencia],
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <View style={styles.strip}>
        <WeekStrip days={days} selectedKey={selectedKey} onSelect={handleSelectDay} />
      </View>

      {error !== null && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="Sem aulas neste dia"
              message="Toque em “Criar Aula” para adicionar uma rotina ou evento."
            />
          }
        />
      )}

      <Fab
        onPress={openCriarAula}
        label="Criar Aula"
        accessibilityLabel="Criar nova aula"
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: ClassRow): string => item.id;

const getItemLayout = (
  _data: ArrayLike<ClassRow> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: ADMIN_CARD_TOTAL,
  offset: ADMIN_CARD_TOTAL * index,
  index,
});

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
    flexGrow: 1,
  },
});
