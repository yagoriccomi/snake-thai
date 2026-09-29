import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import type { ResumoDaSemana } from '@/utils/aulasDoAluno';

interface ResumoDaSemanaCardProps {
  resumo: ResumoDaSemana;
  /** À vontade: abre a folha da meta. */
  onMudarMeta?: () => void;
}

function plural(n: number, singular: string, varias: string): string {
  return `${n} ${n === 1 ? singular : varias}`;
}

/**
 * "Esta semana" dos mockups da linha B: a cota do livre em barra (feitas +
 * marcadas) ou a meta do à vontade. O fixo não tem este cartão.
 */
export function ResumoDaSemanaCard({ resumo, onMudarMeta }: ResumoDaSemanaCardProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (resumo.modo === 'fixed' || resumo.alvo === null) return null;

  if (resumo.modo === 'unlimited') {
    return (
      <View style={styles.cartao}>
        <View style={styles.topo}>
          <Text style={styles.titulo}>{`Sua meta: ${resumo.alvo}x por semana`}</Text>
          {onMudarMeta !== undefined ? (
            <Pressable onPress={onMudarMeta} hitSlop={8} style={styles.link} accessibilityRole="button" accessibilityLabel="Mudar a meta">
              <Text style={styles.linkTexto}>Mudar</Text>
            </Pressable>
          ) : null}
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          {`${plural(resumo.feitas, 'feita', 'feitas')} nesta semana. Faltas não precisam de justificativa: só contam na sua meta.`}
        </AppText>
      </View>
    );
  }

  const total = Math.max(resumo.alvo, resumo.feitas + resumo.marcadas);
  const larguraFeitas = `${(resumo.feitas / total) * 100}%` as const;
  const larguraMarcadas = `${(resumo.marcadas / total) * 100}%` as const;

  return (
    <View style={styles.cartao}>
      <View style={styles.topo}>
        <Text style={styles.titulo}>Esta semana</Text>
        <AppText variant="caption" color={colors.textSecondary}>{`cota ${resumo.alvo}x`}</AppText>
      </View>
      <View style={styles.barra} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.feitas, { width: larguraFeitas }]} />
        <View style={[styles.marcadas, { width: larguraMarcadas }]} />
      </View>
      <AppText variant="caption" color={colors.textSecondary}>
        {`${plural(resumo.feitas, 'feita', 'feitas')} · ${plural(resumo.marcadas, 'marcada', 'marcadas')}`}
      </AppText>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    cartao: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 6,
      marginTop: 12,
    },
    topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    link: { minHeight: 44, justifyContent: 'center' },
    linkTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primaryText },
    barra: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
      flexDirection: 'row',
      gap: 2,
    },
    feitas: { height: '100%', backgroundColor: colors.primary },
    marcadas: { height: '100%', backgroundColor: colors.textSecondary },
  });
}
