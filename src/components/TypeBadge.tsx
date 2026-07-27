import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ClassType } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';

interface TypeBadgeProps {
  type: ClassType;
}

/** Selo visual do tipo da aula: Rotina (neon) ou Evento (amarelo). */
function TypeBadgeComponent({ type }: TypeBadgeProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const isEvent = type === 'event';

  const styles = useMemo(() => {
    const accent = isEvent ? colors.warning : colors.primary;
    return StyleSheet.create({
      badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: 'transparent',
      },
      text: {
        fontFamily: fonts.bodySemiBold,
        fontSize: 11,
        color: accent,
        textTransform: 'uppercase',
      },
    });
  }, [isEvent, colors, fonts]);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{isEvent ? 'Evento' : 'Rotina'}</Text>
    </View>
  );
}

export const TypeBadge = React.memo(TypeBadgeComponent);
