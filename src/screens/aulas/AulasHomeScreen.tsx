import React from 'react';

import { useAuth } from '@/context/AuthProvider';
import type { AulasStackScreenProps } from '@/navigation/types';
import { AdminAulasList } from '@/screens/aulas/AdminAulasList';
import { ProfessorAulasList } from '@/screens/aulas/ProfessorAulasList';
import { StudentAulasList } from '@/screens/aulas/StudentAulasList';

/**
 * Tela inicial da aba "Aulas". Decide a visão pelo papel: administrador vê a
 * gestão (calendário + criação + frequência de todas as aulas); professor vê
 * a mesma agenda da academia inteira, mas só gerencia as aulas onde é um dos
 * professores; aluno vê suas próximas aulas.
 */
export function AulasHomeScreen({
  navigation,
}: AulasStackScreenProps<'AulasHome'>): React.JSX.Element {
  const { isAdmin, isProfessor } = useAuth();
  if (isAdmin) {
    return <AdminAulasList navigation={navigation} />;
  }
  if (isProfessor) {
    return <ProfessorAulasList navigation={navigation} />;
  }
  return <StudentAulasList />;
}
