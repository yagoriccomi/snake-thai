import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import type { AvisoDoRascunho } from '@/hooks/useRollCallDraft';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';

interface RollCallDraftNoticeProps {
  aviso: AvisoDoRascunho;
  /** "Descartar rascunho" (a tela confirma antes). */
  onDescartar: () => void;
  /** Conflito: aplicar o rascunho sobre o que está salvo. */
  onUsarMeuRascunho: () => void;
  /** Conflito: ficar com o que está salvo e apagar o rascunho. */
  onManterSalvo: () => void;
}

/**
 * Aviso do rascunho da chamada guardado no aparelho (docs/FREQUENCIA.md).
 *
 * - `recuperado`: informativo — as marcações voltaram e ainda não foram salvas.
 * - `conflito`: pede decisão — outra pessoa salvou a chamada depois do
 *   rascunho. A lista fica travada até a escolha; "Manter o que está salvo" é
 *   o botão principal porque é o que não desfaz o trabalho de ninguém.
 */
function RollCallDraftNoticeComponent({
  aviso,
  onDescartar,
  onUsarMeuRascunho,
  onManterSalvo,
}: RollCallDraftNoticeProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const quando = formatFullDateTime(aviso.salvoEm);
  const conflito = aviso.tipo === 'conflito';

  return (
    <View
      style={[styles.aviso, { borderColor: conflito ? colors.warning : colors.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.cabecalho}>
        <Ionicons
          name={conflito ? 'git-compare-outline' : 'document-text-outline'}
          size={20}
          color={conflito ? colors.warning : colors.primaryText}
        />
        <Text style={styles.titulo}>{conflito ? 'Chamada alterada por outra pessoa' : 'Rascunho recuperado'}</Text>
      </View>

      {conflito ? (
        <>
          <Text style={styles.explicacao}>
            Esta chamada foi salva por outra pessoa depois do seu rascunho de {quando}. A lista
            mostra o que está salvo.
          </Text>
          <View style={styles.acoes}>
            <Button
              title="Manter o que está salvo"
              onPress={onManterSalvo}
              accessibilityHint="Apaga o seu rascunho e libera a lista como está salva"
            />
            <Button
              title="Usar meu rascunho"
              variant="secondary"
              onPress={onUsarMeuRascunho}
              accessibilityHint="Coloca as suas marcações na lista; elas só valem depois de salvar"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.explicacao}>Marcações de {quando} ainda não foram salvas.</Text>
          <View style={styles.acoes}>
            <Button
              title="Descartar rascunho"
              variant="secondary"
              onPress={onDescartar}
              accessibilityHint="Volta a lista para o que está salvo"
            />
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    aviso: {
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: 6,
    },
    cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    titulo: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    explicacao: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    acoes: { gap: 8, marginTop: 4 },
  });
}

export const RollCallDraftNotice = React.memo(RollCallDraftNoticeComponent);
