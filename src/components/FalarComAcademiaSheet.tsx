import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { BotoesDeContato } from '@/components/BotoesDeContato';
import { Button } from '@/components/Button';
import { useContatoDaAcademia } from '@/hooks/useContatoDaAcademia';
import { useTheme } from '@/theme/ThemeProvider';
import { SEM_CONTATO, temContato } from '@/utils/contato';

export const TEXTOS_FALAR_COM_A_ACADEMIA = {
  titulo: 'Falar com a academia',
  explicacao: 'Dúvidas sobre aulas, frequência, trocas ou mensalidade.',
} as const;

interface FalarComAcademiaSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Dados › **Falar com a academia** (contrato § 5.4, mockup da linha H): o
 * contato é lido ao abrir a folha, pela RPC `contato_da_academia`.
 */
export function FalarComAcademiaSheet({ visible, onClose }: FalarComAcademiaSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const { contato, carregando, erro, recarregar } = useContatoDaAcademia(visible);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        {TEXTOS_FALAR_COM_A_ACADEMIA.titulo}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {TEXTOS_FALAR_COM_A_ACADEMIA.explicacao}
      </AppText>

      {carregando ? (
        <View style={styles.estado}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando o contato" />
        </View>
      ) : null}

      {!carregando && erro !== null ? (
        <View style={styles.estado}>
          <AppText variant="body" color={colors.error} accessibilityRole="alert">
            {erro}
          </AppText>
          <Button title="Tentar de novo" variant="secondary" onPress={recarregar} />
        </View>
      ) : null}

      {!carregando && erro === null && contato !== null ? (
        temContato(contato) ? (
          <BotoesDeContato contato={contato} arranjo="empilhados" />
        ) : (
          <AppText variant="body">{SEM_CONTATO}</AppText>
        )
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  estado: {
    gap: 12,
    paddingVertical: 8,
  },
});
