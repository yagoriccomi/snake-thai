import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ClassTeacherRef } from '@/services/classes.service';
import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface TeacherDotProps {
  teachers: ClassTeacherRef[];
}

/**
 * Lista horizontal de bolinhas coloridas + nome, uma por professor da aula —
 * a mesma cor usada na `TeacherRail` da borda, para o vínculo visual ficar
 * óbvio. Sem professor vinculado, não renderiza nada (não há o que mostrar). [#55]
 */
export function TeacherDot({ teachers }: TeacherDotProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (teachers.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {teachers.map((teacher) => (
        <View key={teacher.id} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: teacher.color ?? colors.border }]} />
          <Text style={styles.name} numberOfLines={1}>
            {teacher.name ?? 'Professor'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    name: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      maxWidth: 100,
    },
  });
}
