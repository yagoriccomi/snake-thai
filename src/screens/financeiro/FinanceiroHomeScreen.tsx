import React from 'react';

import { useAuth } from '@/context/AuthProvider';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import { AdminFinanceView } from '@/screens/financeiro/AdminFinanceView';
import { StudentFinanceList } from '@/screens/financeiro/StudentFinanceList';

/** Home do Financeiro: gestão (admin) ou mensalidades do aluno. */
export function FinanceiroHomeScreen({
  navigation,
}: FinanceiroStackScreenProps<'FinanceiroHome'>): React.JSX.Element {
  const { isAdmin } = useAuth();
  return isAdmin ? (
    <AdminFinanceView navigation={navigation} />
  ) : (
    <StudentFinanceList navigation={navigation} />
  );
}
