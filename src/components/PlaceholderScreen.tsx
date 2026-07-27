import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ScreenWrapper } from '@/components/ScreenWrapper';

interface PlaceholderScreenProps {
  title: string;
  message?: string;
}

/**
 * Tela provisória reutilizável (DRY): título + mensagem centralizados sobre o
 * fundo do tema. Usada pelas abas ainda não implementadas.
 */
function PlaceholderScreenComponent({
  title,
  message = 'Em breve.',
}: PlaceholderScreenProps): React.JSX.Element {
  return (
    <ScreenWrapper>
      <View style={styles.center}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption">{message}</AppText>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export const PlaceholderScreen = React.memo(PlaceholderScreenComponent);
