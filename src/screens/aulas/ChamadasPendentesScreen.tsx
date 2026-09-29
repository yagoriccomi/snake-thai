import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Selo } from '@/components/Selo';
import { useAuth } from '@/context/AuthProvider';
import { useChamadasPendentes } from '@/hooks/useChamadasPendentes';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { ChamadaPendente } from '@/services/chamada.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatTime, formatWeekday } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;

type Filtro = 'minhas' | 'todas';

const FILTROS = [
  { value: 'minhas', label: 'Minhas' },
  { value: 'todas', label: 'Todas' },
] as const;

/** "há 1 dia", "há 4 dias", "hoje". */
export function textoDeDiasEmAberto(dias: number): string {
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/**
 * Chamadas pendentes (T13, mockup da linha C): as aulas de rotina que
 * passaram sem chamada, de qualquer mês. "Todas" só aparece para o admin.
 */
export function ChamadasPendentesScreen({ navigation }: AulasStackScreenProps<'ChamadasPendentes'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { isAdmin } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('minhas');
  const pendentes = useChamadasPendentes(filtro === 'minhas');
  const recarregar = pendentes.reload;

  useFocusEffect(
    useCallback(() => {
      void recarregar();
    }, [recarregar]),
  );

  const abrir = useCallback(
    (item: ChamadaPendente) =>
      navigation.navigate('Frequencia', { classId: item.classId, title: item.title, groupId: item.groupId, canManage: true }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChamadaPendente }) => (
      <View style={styles.aula}>
        <Text style={styles.hora}>{formatTime(item.dateTime)}</Text>
        <View style={styles.corpo}>
          <Text style={styles.titulo} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.sub}>
            <Text style={styles.legenda}>
              {`${formatWeekday(item.dateTime)} ${formatDayMonth(item.dateTime)}`}
              {item.groupName !== null ? ` · ${item.groupName}` : ''}
            </Text>
            {item.audience === 'free' ? <Selo texto="Livres" tom="neutro" /> : null}
            <Selo texto={textoDeDiasEmAberto(item.diasEmAberto)} tom="aviso" />
          </View>
        </View>
        <Pressable
          onPress={() => abrir(item)}
          style={styles.fazer}
          accessibilityRole="button"
          accessibilityLabel={`Fazer a chamada de ${item.title}, ${formatDayMonth(item.dateTime)}`}
        >
          <Text style={styles.fazerTexto}>Fazer</Text>
        </Pressable>
      </View>
    ),
    [styles, abrir],
  );

  const cabecalho = (
    <View style={styles.cabecalho}>
      {isAdmin ? <SegmentedControl options={FILTROS} value={filtro} onChange={setFiltro} /> : null}
      <View style={styles.aviso}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        <AppText variant="caption" style={styles.avisoTexto}>
          Chamada feita depois do dia da aula fica marcada para sempre como "Feita X dias depois". Aula cancelada não
          entra aqui.
        </AppText>
      </View>
    </View>
  );

  if (pendentes.error !== null && pendentes.items.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        {cabecalho}
        <ErrorState message={pendentes.error} onRetry={() => void recarregar()} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <FlatList
        data={pendentes.items}
        keyExtractor={(item) => item.classId}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          pendentes.loading ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title="Nenhuma chamada pendente" message="Todas as aulas que já passaram têm chamada." />
          )
        }
        refreshControl={
          <RefreshControl refreshing={pendentes.loading && pendentes.items.length > 0} onRefresh={() => void recarregar()} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.conteudo}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
    cabecalho: { gap: 12, paddingTop: 12, paddingBottom: 4 },
    aviso: {
      flexDirection: 'row',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    avisoTexto: { flex: 1 },
    aula: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    hora: { width: 46, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textPrimary, alignSelf: 'flex-start' },
    corpo: { flex: 1, gap: 5 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    sub: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    legenda: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    fazer: {
      minHeight: 44,
      minWidth: 64,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fazerTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    carregando: { marginTop: 24 },
  });
}
