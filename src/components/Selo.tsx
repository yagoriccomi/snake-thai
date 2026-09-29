import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { SeloDaAula, TomDoSelo } from '@/utils/aulasDoAluno';

/**
 * Selo de texto com contorno (Troca, Extra, Editada, Cancelada…). A cor sai do
 * tom, que vira token do tema: o mesmo selo fica legível no claro e no escuro. [#3][#6]
 */
export const Selo = React.memo(function Selo({ texto, tom }: SeloDaAula): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const cor = useMemo<Record<TomDoSelo, string>>(
    () => ({
      neutro: colors.textSecondary,
      destaque: colors.primaryText,
      aviso: colors.warning,
      erro: colors.error,
    }),
    [colors],
  );
  return (
    <View style={[styles.selo, { borderColor: cor[tom] }]}>
      <Text style={[styles.texto, { color: cor[tom], fontFamily: fonts.bodySemiBold }]}>{texto}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  selo: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  texto: {
    fontSize: 10.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
