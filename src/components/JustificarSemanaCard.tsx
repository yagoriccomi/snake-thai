import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { SemanaDoMes } from '@/services/frequency.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth } from '@/utils/datetime';
import { periodoDaSemana } from '@/utils/frequency';
import { rotuloDaJustificativa, tomDaJustificativa } from '@/utils/justificativas';

/** "resta 1 justificativa", "restam 2 justificativas" (T17). */
export function textoDasQueRestam(restam: number): string {
  return restam === 1 ? 'resta 1 justificativa' : `restam ${restam} justificativas`;
}

/** Semanas que merecem linha: dá para justificar ou já há justificativa. */
export function semanasParaJustificar(semanas: readonly SemanaDoMes[]): SemanaDoMes[] {
  return semanas.filter((semana) => semana.canJustify || semana.justificativas.length > 0);
}

interface JustificarSemanaCardProps {
  semanas: readonly SemanaDoMes[];
  onJustificar: (semana: SemanaDoMes) => void;
}

/**
 * Justificativas da semana do livre (D12, T17, § 9.1): o prazo, quantas
 * restam e o estado das que já foram. O banco decide `can_justify`; a tela
 * só mostra. Os reenvios ficam em Minhas justificativas.
 */
export function JustificarSemanaCard({ semanas, onJustificar }: JustificarSemanaCardProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const cor = { aviso: colors.warning, destaque: colors.primaryText, erro: colors.error, neutro: colors.textSecondary };
  const linhas = semanasParaJustificar(semanas);

  return (
    <View style={styles.cartao}>
      <Text style={styles.overline}>JUSTIFICATIVAS</Text>
      {linhas.map((semana) => (
        <View key={semana.weekStart} style={styles.semana}>
          <Text style={styles.titulo}>{`${semana.label} · ${periodoDaSemana(semana)}`}</Text>
          {semana.justificativas.map((j) => (
            <Text key={j.id} style={[styles.estado, { color: cor[tomDaJustificativa(j.status)] }]}>
              {rotuloDaJustificativa(j)}
            </Text>
          ))}
          {semana.canJustify ? (
            <View style={styles.acao}>
              <Text style={styles.dica}>
                {[
                  semana.justifyUntil !== null ? `Até ${formatDayMonth(semana.justifyUntil)}` : null,
                  semana.justificationsLeft !== null ? textoDasQueRestam(semana.justificationsLeft) : null,
                ]
                  .filter((parte): parte is string => parte !== null)
                  .join(' · ')}
              </Text>
              <Button
                title="Justificar semana"
                variant="secondary"
                onPress={() => onJustificar(semana)}
                accessibilityHint={`Justifica uma falta da semana ${semana.label}`}
              />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    cartao: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    overline: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
    semana: {
      gap: 4,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    estado: { fontFamily: fonts.body, fontSize: 13 },
    acao: { gap: 8, marginTop: 2 },
    dica: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  });
}
