import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';

import { AppText } from '@/components/AppText';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { descreverVersaoDoApp } from '@/utils/versaoDoApp';

const log = createLogger('AppVersionFooter');

const TEXTO_SEM_VERSAO = 'Versão indisponível';

/**
 * Rodapé discreto com a versão instalada ("Versão 1.7.0 (1007000)").
 *
 * O texto é selecionável para o suporte poder copiar. Sem versão no build, a
 * linha diz isso em vez de sumir, e o motivo vai para o log. [#92][#93]
 */
export function AppVersionFooter(): React.JSX.Element {
  const { colors } = useTheme();
  const versao = useMemo(() => descreverVersaoDoApp(Constants.expoConfig), []);

  useEffect(() => {
    if (versao === null) {
      log.warn('Build sem versão em Constants.expoConfig: o Perfil mostra "Versão indisponível".');
    }
  }, [versao]);

  return (
    <AppText
      variant="caption"
      color={colors.textSecondary}
      style={styles.texto}
      selectable
      accessibilityRole="text"
      accessibilityLabel={versao?.rotuloAcessivel ?? TEXTO_SEM_VERSAO}
    >
      {versao?.texto ?? TEXTO_SEM_VERSAO}
    </AppText>
  );
}

const styles = StyleSheet.create({
  texto: {
    textAlign: 'center',
    marginTop: 8,
  },
});
