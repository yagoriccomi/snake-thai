import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useGroups } from '@/hooks/useGroups';
import { useTheme } from '@/theme/ThemeProvider';
import { avisoDeMudancaDeTurma } from '@/utils/pessoas';

interface AvisoDeMudancaDeTurmaProps {
  turmaAtual: string | null;
  turmaNova: string | null;
}

/**
 * O aviso da § 3 (D58) antes de salvar a turma nova: o passado não muda e as
 * trocas que dependiam da turma antiga caem (T53). Some quando a turma não muda.
 */
export function AvisoDeMudancaDeTurma({ turmaAtual, turmaNova }: AvisoDeMudancaDeTurmaProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groups } = useGroups();

  const nome = (id: string | null): string | null => {
    if (id === null) return null;
    // Turma arquivada não vem na lista: o aviso continua fazendo sentido sem o nome.
    return groups.find((grupo) => grupo.id === id)?.name ?? 'turma atual';
  };

  if (turmaAtual === turmaNova) return null;
  const texto = avisoDeMudancaDeTurma(nome(turmaAtual), nome(turmaNova));
  if (texto === null) return null;

  return (
    <View style={styles.aviso} accessibilityRole="alert">
      <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
      <AppText variant="caption" style={styles.texto}>
        {texto}
      </AppText>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    aviso: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    texto: { flex: 1 },
  });
}
