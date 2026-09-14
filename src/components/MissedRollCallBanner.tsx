import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MissedRollCall } from '@/services/frequency.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatTime, formatWeekday } from '@/utils/datetime';

/** Quantas aulas o aviso lista antes de resumir em "e mais N". */
export const MAXIMO_DE_AULAS_NO_AVISO = 3;

interface MissedRollCallBannerProps {
  items: readonly MissedRollCall[];
  onPressItem: (item: MissedRollCall) => void;
}

/**
 * Aviso de aulas que passaram sem chamada neste mês — para o admin (todas) e
 * para os professores de cada aula (as suas); o filtro é do banco.
 *
 * Decisão de 2026-09-14: aviso dentro do app, sem push. Some sozinho quando a
 * chamada é concluída. Enquanto isso, a aula fica fora da frequência de todos
 * os alunos da turma — por isso o aviso não é discreto.
 */
function MissedRollCallBannerComponent({
  items,
  onPressItem,
}: MissedRollCallBannerProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (items.length === 0) {
    return null;
  }

  const visiveis = items.slice(0, MAXIMO_DE_AULAS_NO_AVISO);
  const restantes = items.length - visiveis.length;
  const titulo =
    items.length === 1 ? '1 aula sem chamada este mês' : `${items.length} aulas sem chamada este mês`;

  return (
    <View style={styles.aviso} accessibilityRole="alert">
      <View style={styles.cabecalho}>
        <Ionicons name="alert-circle" size={20} color={colors.warning} />
        <Text style={styles.titulo}>{titulo}</Text>
      </View>
      <Text style={styles.explicacao}>
        Até a chamada ser concluída, a aula não conta na frequência dos alunos.
      </Text>
      {visiveis.map((item) => {
        const quando = `${formatWeekday(item.dateTimeIso)} ${formatDayMonth(item.dateTimeIso)} ${formatTime(item.dateTimeIso)}`;
        return (
          <Pressable
            key={item.classId}
            onPress={() => onPressItem(item)}
            style={styles.linha}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${quando}`}
            accessibilityHint="Abre a aula para fazer a chamada"
          >
            <Text style={styles.aula} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.quando}>{quando}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        );
      })}
      {restantes > 0 ? <Text style={styles.explicacao}>e mais {restantes}</Text> : null}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    aviso: {
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
      gap: 4,
    },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    explicacao: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    linha: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    aula: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textPrimary },
    quando: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
  });
}

export const MissedRollCallBanner = React.memo(MissedRollCallBannerComponent);
