import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Fonts } from '@/constants/theme';
import type { MesDeFaturamento } from '@/services/painel.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatMonthShort } from '@/utils/datetime';
import { alturasDasBarras, rotuloAcessivelDoMes } from '@/utils/painel';

const ALTURA_DO_GRAFICO = 120;

interface RevenueBarChartProps {
  meses: MesDeFaturamento[];
}

/**
 * Esperado × recebido por mês, só com View (sem biblioteca de gráfico nem
 * módulo nativo novo).
 *
 * Cada coluna é o contorno do ESPERADO com o RECEBIDO preenchido por dentro.
 * O contorno usa o texto secundário e o preenchimento a cor primária: os dois
 * passam de 3:1 contra a superfície nos dois temas (WCAG 1.4.11). Cor não é o
 * único sinal: cada coluna diz os valores ao leitor de tela.
 */
function RevenueBarChartComponent({ meses }: RevenueBarChartProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const alturas = useMemo(() => {
    // A escala é a mesma para as duas medidas: recebido nunca "passa" do esperado na tela.
    const escala = alturasDasBarras(
      meses.flatMap((mes) => [mes.esperadoCents, mes.recebidoCents]),
      ALTURA_DO_GRAFICO,
    );
    return meses.map((_mes, indice) => ({
      esperado: escala[indice * 2] ?? 0,
      recebido: Math.min(escala[indice * 2 + 1] ?? 0, escala[indice * 2] ?? 0),
    }));
  }, [meses]);

  return (
    <View style={styles.container}>
      <View style={styles.colunas} accessibilityLabel={`Faturamento dos últimos ${meses.length} meses`}>
        {meses.map((mes, indice) => {
          const altura = alturas[indice] ?? { esperado: 0, recebido: 0 };
          return (
            <View
              key={mes.referenceMonth}
              style={styles.coluna}
              accessible
              accessibilityLabel={rotuloAcessivelDoMes(mes.referenceMonth, mes.esperadoCents, mes.recebidoCents)}
            >
              <View style={styles.area}>
                <View style={[styles.esperado, { height: Math.max(altura.esperado, mes.esperadoCents > 0 ? 2 : 0) }]}>
                  <View style={[styles.recebido, { height: altura.recebido }]} />
                </View>
              </View>
              <Text style={styles.mes} numberOfLines={1}>
                {formatMonthShort(mes.referenceMonth).slice(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legenda} importantForAccessibility="no-hide-descendants">
        <View style={styles.itemDaLegenda}>
          <View style={[styles.amostra, styles.amostraEsperado]} />
          <Text style={styles.textoDaLegenda}>Esperado</Text>
        </View>
        <View style={styles.itemDaLegenda}>
          <View style={[styles.amostra, styles.amostraRecebido]} />
          <Text style={styles.textoDaLegenda}>Recebido</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    container: {
      gap: 10,
    },
    colunas: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    coluna: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    area: {
      height: ALTURA_DO_GRAFICO,
      width: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    esperado: {
      width: '80%',
      maxWidth: 22,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    recebido: {
      width: '100%',
      backgroundColor: colors.primary,
    },
    mes: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.textSecondary,
    },
    legenda: {
      flexDirection: 'row',
      gap: 16,
    },
    itemDaLegenda: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    amostra: {
      width: 12,
      height: 12,
      borderRadius: 2,
    },
    amostraEsperado: {
      borderWidth: 1,
      borderColor: colors.textSecondary,
    },
    amostraRecebido: {
      backgroundColor: colors.primary,
    },
    textoDaLegenda: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}

export const RevenueBarChart = React.memo(RevenueBarChartComponent);
