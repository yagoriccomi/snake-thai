import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

const ROTULO = 'DEV · banco local';
const ROTULO_ACESSIVEL = 'Aplicativo de desenvolvimento, conectado ao banco local';

/**
 * Faixa fixa no topo do "DEV Snake Thai". Existe para ninguém confundir o app
 * de testes (banco local) com o de produção — um toque no app errado grava no
 * banco errado.
 *
 * A área da barra de status fica na cor do fundo, e não no âmbar: os ícones do
 * sistema continuam legíveis.
 */
export function DevBanner(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={[styles.areaDoStatus, { paddingTop: insets.top }]}>
      <View
        style={styles.faixa}
        accessible
        accessibilityRole="text"
        accessibilityLabel={ROTULO_ACESSIVEL}
      >
        <Text style={styles.texto}>{ROTULO}</Text>
      </View>
    </View>
  );
}

interface DevEnvironmentFrameProps {
  /** `true` só na variante de desenvolvimento. */
  ativo: boolean;
  children: React.ReactNode;
}

/**
 * Moldura do app DEV: a faixa no topo e o app logo abaixo.
 *
 * O conteúdo ganha um `SafeAreaProvider` próprio de propósito. O SafeAreaView
 * nativo e o cabeçalho da navegação medem a área segura a partir do provider
 * mais próximo; como este começa abaixo da faixa, a altura da barra de status
 * não é somada de novo — nada fica escondido nem sobra espaço vazio.
 *
 * Na variante de produção não renderiza nada além dos filhos.
 */
export function DevEnvironmentFrame({ ativo, children }: DevEnvironmentFrameProps): React.JSX.Element {
  const { colors } = useTheme();

  if (!ativo) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.preencher, { backgroundColor: colors.background }]}>
      <DevBanner />
      <SafeAreaProvider style={styles.preencher}>{children}</SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  preencher: { flex: 1 },
});

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    areaDoStatus: { backgroundColor: colors.background },
    faixa: {
      minHeight: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.devBanner,
    },
    texto: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.onDevBanner,
    },
  });
}
