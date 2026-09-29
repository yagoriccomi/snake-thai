import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BotoesDeContato } from '@/components/BotoesDeContato';
import { useContatoDaAcademia } from '@/hooks/useContatoDaAcademia';
import { useTheme } from '@/theme/ThemeProvider';
import { temContato } from '@/utils/contato';

/** Texto da § 3 (bloco de contato dos pedidos negados). */
export const CHAMADA_DO_BLOCO_DE_CONTATO = 'Para mais informações, fale com a academia:';

/**
 * Bloco de contato dos pedidos negados (contrato § 5.4): troca negada, "Eu
 * estava na aula" negado, pedido de professor negado e a justificativa negada
 * pela 2ª vez. **Nunca na tela de login nem em push.** Sem contato cadastrado,
 * mostra só a frase, sem botões (§ 5.4).
 */
export function BlocoDeContato(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { contato, carregando, erro, recarregar } = useContatoDaAcademia();

  return (
    <View style={styles.bloco}>
      <AppText variant="caption" color={colors.textSecondary}>
        {CHAMADA_DO_BLOCO_DE_CONTATO}
      </AppText>
      {carregando ? <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando o contato" /> : null}
      {erro !== null ? (
        <Pressable onPress={recarregar} accessibilityRole="button" hitSlop={8}>
          <AppText variant="caption" color={colors.error}>
            {`${erro} Tocar para tentar de novo.`}
          </AppText>
        </Pressable>
      ) : null}
      {contato !== null && temContato(contato) ? <BotoesDeContato contato={contato} arranjo="lado-a-lado" /> : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    bloco: {
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
}
