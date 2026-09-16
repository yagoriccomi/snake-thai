import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { NotificationOptInCard } from '@/components/NotificationOptInCard';
import { useAuth } from '@/context/AuthProvider';
import { usePushNotifications } from '@/context/PushNotificationsProvider';
import type { AulasStackScreenProps } from '@/navigation/types';
import { AdminAulasList } from '@/screens/aulas/AdminAulasList';
import { ProfessorAulasList } from '@/screens/aulas/ProfessorAulasList';
import { StudentAulasList } from '@/screens/aulas/StudentAulasList';
import { useTheme } from '@/theme/ThemeProvider';

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
  const { colors, spacing } = useTheme();
  const notificacoes = usePushNotifications();
  const estilos = useMemo(
    () =>
      StyleSheet.create({
        tela: { flex: 1, backgroundColor: colors.background },
        convite: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
      }),
    [colors.background, spacing],
  );

  const lista = isAdmin ? (
    <AdminAulasList navigation={navigation} />
  ) : isProfessor ? (
    <ProfessorAulasList navigation={navigation} />
  ) : (
    <StudentAulasList navigation={navigation} />
  );

  // Convite só uma vez: some ao ativar, ao recusar ou em build sem push.
  const mostrarConvite = notificacoes.escolha === 'indefinido' && notificacoes.status === 'desativado';
  if (!mostrarConvite) {
    return lista;
  }
  return (
    <View style={estilos.tela}>
      <View style={estilos.convite}>
        <NotificationOptInCard
          papel={isAdmin ? 'admin' : isProfessor ? 'professor' : 'user'}
          ocupado={notificacoes.ocupado}
          onAtivar={() => void notificacoes.ativar()}
          onAgoraNao={() => void notificacoes.dispensarConvite()}
        />
      </View>
      {lista}
    </View>
  );
}
