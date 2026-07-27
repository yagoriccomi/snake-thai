import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IoniconName;
}

/** Estado vazio reutilizável para listas sem itens. */
function EmptyStateComponent({
  title,
  message,
  icon = 'calendar-outline',
}: EmptyStateProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textSecondary} />
      <AppText variant="subtitle" style={styles.title}>
        {title}
      </AppText>
      {message !== undefined ? (
        <AppText variant="caption" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 6,
  },
  title: {
    marginTop: 8,
  },
  message: {
    textAlign: 'center',
  },
});

export const EmptyState = React.memo(EmptyStateComponent);
