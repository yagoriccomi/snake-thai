import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

interface ErroAoAtualizarProps {
  mensagem: string | null;
  estilo?: StyleProp<TextStyle>;
}

/**
 * A recarga falhou, mas a lista antiga continua na tela: sem este aviso, a
 * pessoa acharia que está vendo a situação de agora (REVIEW-FASE4 C4). [#93]
 */
export function ErroAoAtualizar({ mensagem, estilo }: ErroAoAtualizarProps): React.JSX.Element | null {
  const { colors } = useTheme();
  if (mensagem === null) return null;
  return (
    <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={estilo}>
      {`${mensagem} O que aparece pode estar desatualizado.`}
    </AppText>
  );
}
