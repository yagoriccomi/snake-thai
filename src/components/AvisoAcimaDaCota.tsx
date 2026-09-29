import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeProvider';
import { textoAcimaDaCota } from '@/utils/aulasDoAluno';

interface AvisoAcimaDaCotaProps {
  marcadas: number;
  cota: number;
  onDesfazer: () => void;
  onFechar: () => void;
}

/**
 * Aviso de acima da cota (§ 3, D4): **nunca bloqueia**. A aula já foi marcada;
 * "Desfazer" desmarca. Fica no rodapé da tela, como no mockup "Aluno livre —
 * acima da cota".
 */
export function AvisoAcimaDaCota({ marcadas, cota, onDesfazer, onFechar }: AvisoAcimaDaCotaProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="information-circle-outline" size={20} color={colors.primaryText} />
      <View style={styles.corpo}>
        <Text style={styles.titulo}>Marcada, acima do plano</Text>
        <Text style={styles.texto}>{textoAcimaDaCota(marcadas, cota)}</Text>
        <View style={styles.acoes}>
          <Pressable onPress={onDesfazer} hitSlop={8} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkTexto}>Desfazer</Text>
          </Pressable>
          <Pressable onPress={onFechar} hitSlop={8} style={styles.link} accessibilityRole="button" accessibilityLabel="Fechar o aviso">
            <Text style={styles.fecharTexto}>OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    aviso: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 16,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated,
    },
    corpo: { flex: 1, gap: 4 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    texto: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textPrimary },
    acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
    link: { minHeight: 44, justifyContent: 'center' },
    linkTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primaryText },
    fecharTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textSecondary },
  });
}
