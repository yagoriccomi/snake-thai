import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { FrequenciaDaSemana, FrequenciaDoMes } from '@/services/frequency.service';
import { useTheme } from '@/theme/ThemeProvider';
import {
  formatarPercentual,
  rotulosDaFrequencia,
  textoDeContagem,
  tomDoPercentual,
} from '@/utils/frequency';

interface FrequencyCardProps {
  semana: FrequenciaDaSemana | null;
  mes: FrequenciaDoMes | null;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou. */
  error: string | null;
  /** Abre a tela Frequência. */
  onPress: () => void;
}

type Estilos = ReturnType<typeof makeStyles>;

interface BlocoProps {
  rotulo: string;
  percentual: number | null;
  feitas: number | null;
  esperadas: number | null;
  styles: Estilos;
}

function Bloco({ rotulo, percentual, feitas, esperadas, styles }: BlocoProps): React.JSX.Element {
  return (
    <View style={styles.bloco}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={[styles.valor, tomDoPercentual(percentual) === 'acima' && styles.valorAcima]}>
        {formatarPercentual(percentual)}
      </Text>
      <Text style={styles.rotulo}>{feitas !== null && esperadas !== null ? textoDeContagem(feitas, esperadas) : ' '}</Text>
    </View>
  );
}

/**
 * A frequência do aluno na tela Aulas (contrato § 3, mockups da linha B):
 * "Semana · {p}%" e "Mês · {p}%", cada um com "{a} de {e}". No à vontade, a
 * meta. O percentual passa de 100% (D7) e ganha o acento; esperado 0 é "—".
 */
function FrequencyCardComponent({ semana, mes, loading, error, onPress }: FrequencyCardProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const rotulos = rotulosDaFrequencia(mes?.scheduleMode ?? semana?.scheduleMode ?? 'fixed');

  const descricao =
    semana !== null && mes !== null
      ? `${rotulos.semana}: ${formatarPercentual(semana.frequencyPercent)}, ${textoDeContagem(semana.attended, semana.expected)}. ` +
        `${rotulos.mes}: ${formatarPercentual(mes.frequencyPercent)}, ${textoDeContagem(mes.attended, mes.expected)}.`
      : 'Frequência';

  const carregando = loading && semana === null && mes === null;

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={error ?? descricao}
      accessibilityHint="Abre a sua frequência, semana a semana"
    >
      {carregando ? (
        <ActivityIndicator color={colors.primary} style={styles.cheio} />
      ) : error !== null ? (
        <Text style={[styles.rotulo, styles.cheio, styles.erro]}>{error}</Text>
      ) : (
        <>
          <Bloco
            rotulo={rotulos.semana}
            percentual={semana?.frequencyPercent ?? null}
            feitas={semana?.attended ?? null}
            esperadas={semana?.expected ?? null}
            styles={styles}
          />
          <View style={styles.divisor} />
          <Bloco
            rotulo={rotulos.mes}
            percentual={mes?.frequencyPercent ?? null}
            feitas={mes?.attended ?? null}
            esperadas={mes?.expected ?? null}
            styles={styles}
          />
        </>
      )}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cheio: { flex: 1 },
    bloco: { flex: 1, gap: 2 },
    rotulo: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    erro: { color: colors.error, fontSize: 13 },
    valor: {
      fontFamily: fonts.headingBold,
      fontSize: 22,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    valorAcima: { color: colors.primaryText },
    divisor: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  });
}

export const FrequencyCard = React.memo(FrequencyCardComponent);
