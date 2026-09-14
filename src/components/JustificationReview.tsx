import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { JustificationRow, JustificationStatus } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { ROTULO_DA_JUSTIFICATIVA } from '@/utils/frequency';

interface JustificationReviewProps {
  justification: JustificationRow;
  /** Professor da aula ou admin. Sem isso, o bloco é só leitura. */
  canReview: boolean;
  busy: boolean;
  onReview: (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => void;
  onOpenAttachment: (justificationId: string) => void;
}

/**
 * Justificativa de falta de um aluno, dentro da chamada. Aprovar tira a falta
 * do denominador da frequência, mas não vira presença (docs/FREQUENCIA.md).
 *
 * Só as pendentes oferecem decisão: revisar de novo uma já decidida é raro e,
 * se virar botão permanente, vira clique acidental.
 */
function JustificationReviewComponent({
  justification,
  canReview,
  busy,
  onReview,
  onOpenAttachment,
}: JustificationReviewProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { id, status, message, proof_public_id: anexo } = justification;

  const corDoEstado =
    status === 'approved' ? colors.success : status === 'rejected' ? colors.error : colors.warning;

  return (
    <View style={styles.bloco}>
      <Text style={[styles.estado, { color: corDoEstado }]}>{ROTULO_DA_JUSTIFICATIVA[status]}</Text>
      {message !== null ? <Text style={styles.mensagem}>“{message}”</Text> : null}

      <View style={styles.acoes}>
        {anexo !== null ? (
          <Pressable
            onPress={() => onOpenAttachment(id)}
            style={styles.acao}
            accessibilityRole="link"
            accessibilityLabel="Ver anexo da justificativa"
          >
            <Text style={[styles.acaoTexto, { color: colors.primaryText }]}>Ver anexo</Text>
          </Pressable>
        ) : null}
        {canReview && status === 'pending' ? (
          <>
            <Pressable
              onPress={() => onReview(id, 'approved')}
              disabled={busy}
              style={styles.acao}
              accessibilityRole="button"
              accessibilityLabel="Aprovar justificativa"
              accessibilityState={{ disabled: busy }}
            >
              <Text style={[styles.acaoTexto, { color: colors.success }]}>Aprovar</Text>
            </Pressable>
            <Pressable
              onPress={() => onReview(id, 'rejected')}
              disabled={busy}
              style={styles.acao}
              accessibilityRole="button"
              accessibilityLabel="Recusar justificativa"
              accessibilityState={{ disabled: busy }}
            >
              <Text style={[styles.acaoTexto, { color: colors.error }]}>Recusar</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    bloco: { marginTop: 6, gap: 2 },
    estado: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
    mensagem: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
    acoes: { flexDirection: 'row', gap: 4, marginLeft: -10 },
    // Texto pequeno, alvo de toque grande: 44dp de altura. [A11y]
    acao: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
    acaoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  });
}

export const JustificationReview = React.memo(JustificationReviewComponent);
