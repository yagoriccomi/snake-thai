import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeProvider';

interface SolicitacoesBotaoProps {
  quantidade: number;
  onPress: () => void;
}

/**
 * O atalho Solicitações no cabeçalho da primeira aba da equipe (§ 9.3):
 * a caixa, com o contador do que falta decidir. Sem nada pendente, a caixa
 * continua lá, sem o contador: é também o caminho para Meus pedidos.
 */
export const SolicitacoesBotao = React.memo(function SolicitacoesBotao({
  quantidade,
  onPress,
}: SolicitacoesBotaoProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.botao}
      accessibilityRole="button"
      accessibilityLabel={quantidade > 0 ? `Solicitações: ${quantidade} para decidir` : 'Solicitações'}
    >
      <Ionicons name="file-tray-outline" size={24} color={colors.textPrimary} />
      {quantidade > 0 ? (
        <View style={styles.contador}>
          <Text style={styles.contadorTexto}>{quantidade > 99 ? '99+' : quantidade}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    botao: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    contador: {
      position: 'absolute',
      top: 4,
      right: 0,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
    },
    contadorTexto: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.background },
  });
}
