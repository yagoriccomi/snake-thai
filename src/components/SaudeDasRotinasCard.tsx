import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import type { RotinaComProblema } from '@/utils/painel';

interface SaudeDasRotinasCardProps {
  rotinas: RotinaComProblema[];
}

/**
 * Aviso de rotina automática com falha (mensalidades, frequência, grade,
 * notificações). Só aparece quando há problema: rotina saudável não ocupa o
 * Painel. O texto diz o que falhou e o que fazer, sem detalhe técnico.
 */
function SaudeDasRotinasCardComponent({ rotinas }: SaudeDasRotinasCardProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (rotinas.length === 0) {
    return null;
  }

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.topo}>
        <Ionicons name="warning-outline" size={20} color={colors.warning} />
        <Text style={styles.titulo}>
          {rotinas.length === 1 ? 'Uma rotina automática falhou' : `${rotinas.length} rotinas automáticas falharam`}
        </Text>
      </View>
      {rotinas.map((rotina) => (
        <View key={rotina.rotina} style={styles.item} accessible accessibilityLabel={`${rotina.nome}: ${rotina.descricao}`}>
          <Text style={styles.nome}>{rotina.nome}</Text>
          <Text style={styles.descricao}>{rotina.descricao}</Text>
        </View>
      ))}
      <Text style={styles.orientacao}>
        Se continuar falhando, peça ao suporte técnico para olhar o registro das rotinas (RUNBOOK). Mensalidades
        e frequência podem ficar desatualizadas enquanto isso.
      </Text>
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 8,
      marginTop: 16,
    },
    topo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    titulo: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    item: {
      gap: 2,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    nome: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    descricao: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.warning,
    },
    orientacao: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}

export const SaudeDasRotinasCard = React.memo(SaudeDasRotinasCardComponent);
