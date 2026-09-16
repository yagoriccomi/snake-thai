import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ROTULO_DA_FAIXA } from '@/constants/painel';
import type { Fonts } from '@/constants/theme';
import type { FaixaDeInadimplencia } from '@/services/painel.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { contagem } from '@/utils/painel';

interface OverdueBucketsCardProps {
  totalCents: number;
  alunos: number;
  faixas: FaixaDeInadimplencia[];
  /** Dívida de contas excluídas (LGPD): só aparece quando há. */
  contasEncerradasCents: number;
  onVerRelatorio: () => void;
}

/**
 * Inadimplência em atraso por faixa. A faixa vai escrita, não só por cor, e
 * "Contas encerradas" aparece à parte e sem nome.
 */
function OverdueBucketsCardComponent({
  totalCents,
  alunos,
  faixas,
  contasEncerradasCents,
  onVerRelatorio,
}: OverdueBucketsCardProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.card}>
      <View style={styles.topo} accessible accessibilityLabel={`${formatCents(totalCents)} em atraso, ${contagem(alunos, 'aluno', 'alunos')}`}>
        <Text style={[styles.total, totalCents > 0 ? styles.totalEmAtraso : null]}>{formatCents(totalCents)}</Text>
        <Text style={styles.subtitulo}>em atraso · {contagem(alunos, 'aluno', 'alunos')}</Text>
      </View>

      {faixas.map((faixa) => (
        <View
          key={faixa.faixa}
          style={styles.linha}
          accessible
          accessibilityLabel={`${ROTULO_DA_FAIXA[faixa.faixa]}: ${formatCents(faixa.valorCents)}, ${contagem(faixa.mensalidades, 'mensalidade', 'mensalidades')}`}
        >
          <View style={styles.rotulos}>
            <Text style={styles.faixa}>{ROTULO_DA_FAIXA[faixa.faixa]}</Text>
            <Text style={styles.quantidade}>{contagem(faixa.mensalidades, 'mensalidade', 'mensalidades')}</Text>
          </View>
          <Text style={styles.valor}>{formatCents(faixa.valorCents)}</Text>
        </View>
      ))}

      {contasEncerradasCents > 0 ? (
        <View
          style={styles.linha}
          accessible
          accessibilityLabel={`Contas encerradas: ${formatCents(contasEncerradasCents)}, sem identificação`}
        >
          <View style={styles.rotulos}>
            <Text style={styles.faixa}>Contas encerradas</Text>
            <Text style={styles.quantidade}>Excluídas a pedido (LGPD), sem identificação</Text>
          </View>
          <Text style={styles.valor}>{formatCents(contasEncerradasCents)}</Text>
        </View>
      ) : null}

      <Button
        title="Ver relatório"
        variant="secondary"
        onPress={onVerRelatorio}
        style={styles.botao}
        accessibilityHint="Abre a lista de devedores, de onde dá para dar baixa"
      />
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    topo: {
      marginBottom: 6,
    },
    total: {
      fontFamily: fonts.bodyBold,
      fontSize: 26,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    totalEmAtraso: {
      color: colors.error,
    },
    subtitulo: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    rotulos: {
      flexShrink: 1,
    },
    faixa: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    quantidade: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    valor: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    botao: {
      marginTop: 8,
    },
  });
}

export const OverdueBucketsCard = React.memo(OverdueBucketsCardComponent);
