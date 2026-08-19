import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';

import { AppText } from '@/components/AppText';
import {
  CLASS_CARD_TOTAL,
  ClassCard,
} from '@/components/ClassCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useStudentClasses, type StudentClassItem } from '@/hooks/useStudentClasses';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;

/** Lista de próximas aulas do aluno com ação de presença por card. */
export function StudentAulasList(): React.JSX.Element {
  const { colors } = useTheme();
  const { items, loading, error, respond, reload } = useStudentClasses();

  const renderItem = useCallback<ListRenderItem<StudentClassItem>>(
    ({ item }) => <ClassCard item={item} onRespond={respond} />,
    [respond],
  );

  // Falha com lista vazia nao pode virar "nenhuma aula": o aluno concluiria
  // que nao ha treino marcado quando, na verdade, a carga falhou.
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
      {error !== null ? (
        <AppText variant="caption" color={colors.error} style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma aula por aqui"
            message="Assim que houver aulas para a sua turma, elas aparecerão aqui."
          />
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: StudentClassItem): string => item.id;

const getItemLayout = (
  _data: ArrayLike<StudentClassItem> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: CLASS_CARD_TOTAL,
  offset: CLASS_CARD_TOTAL * index,
  index,
});

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 12,
    flexGrow: 1,
  },
  error: {
    marginTop: 8,
  },
});
