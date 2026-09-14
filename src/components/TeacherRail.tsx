import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ClassTeacherRef } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';

interface TeacherRailProps {
  teachers: ClassTeacherRef[];
}

/**
 * Trilho vertical à esquerda do card da aula, na cor do(s) professor(es).
 *
 * Sem professor vinculado, cai na cor neutra de borda (aula "solta", sem
 * responsável). Com 2+ professores, a borda vira faixas — uma por professor,
 * na ordem de quem entrou na aula primeiro — em vez de escolher arbitrariamente
 * a cor de só um deles. [#55]
 */
export function TeacherRail({ teachers }: TeacherRailProps): React.JSX.Element {
  const { colors } = useTheme();

  if (teachers.length === 0) {
    return <View style={[styles.rail, { backgroundColor: colors.border }]} />;
  }

  return (
    <View style={styles.rail}>
      {teachers.map((teacher) => (
        <View
          key={teacher.id}
          style={[styles.band, { backgroundColor: teacher.color ?? colors.border }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  band: {
    flex: 1,
    width: '100%',
  },
});
