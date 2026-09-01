import React from 'react';

import { useAuth } from '@/context/AuthProvider';
import type { AulasStackScreenProps } from '@/navigation/types';
import { AdminAulasList } from '@/screens/aulas/AdminAulasList';
import { StudentAulasList } from '@/screens/aulas/StudentAulasList';

/**
 * Tela inicial da aba "Aulas". Decide a visão pelo papel: administrador vê a
 * gestão (calendário + criação + frequência); aluno vê suas próximas aulas.
 */
export function AulasHomeScreen({
  navigation,
}: AulasStackScreenProps<'AulasHome'>): React.JSX.Element {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminAulasList navigation={navigation} /> : <StudentAulasList />;
}
