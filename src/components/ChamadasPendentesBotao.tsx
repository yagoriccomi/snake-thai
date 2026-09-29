import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeProvider';

interface ChamadasPendentesBotaoProps {
  quantidade: number;
  onPress: () => void;
}

/**
 * O acesso às chamadas pendentes na agenda da equipe (T13), no lugar do aviso
 * antigo, que sumia na virada do mês. Some quando não há nada pendente.
 */
function ChamadasPendentesBotaoComponent({ quantidade, onPress }: ChamadasPendentesBotaoProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (quantidade === 0) {
    return null;
  }
  return (
    <Pressable
      onPress={onPress}
      style={styles.botao}
      accessibilityRole="button"
      accessibilityLabel={`Chamadas pendentes: ${quantidade}`}
      accessibilityHint="Abre as aulas que passaram sem chamada"
    >
      <Ionicons name="clipboard-outline" size={22} color={colors.warning} />
      <Text style={styles.texto}>Chamadas pendentes</Text>
      <View style={styles.contador}>
        <Text style={styles.contadorTexto}>{quantidade}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    botao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    texto: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    contador: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
    },
    contadorTexto: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.background },
  });
}

export const ChamadasPendentesBotao = React.memo(ChamadasPendentesBotaoComponent);
