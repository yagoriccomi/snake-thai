import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

/** Versão do build, para o suporte saber qual APK está na mão da pessoa. */
function versaoDoBuild(): string | null {
  const versao = Constants.expoConfig?.version?.trim();
  return versao === undefined || versao === '' ? null : versao;
}

/**
 * Faixa do "DEV Snake Thai", fixa **abaixo do menu inferior**.
 *
 * Existe para ninguém confundir o app de testes (banco local) com o de
 * produção — um toque no app errado grava no banco errado. Fica embaixo, e não
 * no topo, para não disputar espaço com o cabeçalho de cada tela; e mostra a
 * versão porque a pergunta de suporte é sempre "qual APK você instalou?".
 *
 * A faixa cobre a área de gestos do Android (por isso o `paddingBottom` com o
 * inset): o conteúdo do app termina logo acima dela.
 */
export function DevBanner(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const versao = versaoDoBuild();
  const rotulo = versao === null ? 'DEV' : `DEV · v${versao}`;

  return (
    <View
      style={[styles.faixa, { paddingBottom: insets.bottom }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        versao === null
          ? 'Aplicativo de desenvolvimento, conectado ao banco local'
          : `Aplicativo de desenvolvimento, versão ${versao}, conectado ao banco local`
      }
    >
      <Text style={styles.texto} numberOfLines={1}>
        {rotulo}
      </Text>
    </View>
  );
}

/**
 * Zera o inset inferior para o conteúdo: quem cobre a área de gestos é a faixa.
 * Sem isso, a barra de abas reservaria o espaço do gesto E a faixa viria
 * depois, deixando uma tira vazia entre as duas.
 */
function SemInsetInferior({ children }: { children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const semInferior = useMemo(() => ({ ...insets, bottom: 0 }), [insets]);
  return <SafeAreaInsetsContext.Provider value={semInferior}>{children}</SafeAreaInsetsContext.Provider>;
}

interface DevEnvironmentFrameProps {
  /** `true` só na variante de desenvolvimento. */
  ativo: boolean;
  children: React.ReactNode;
}

/**
 * Moldura do app DEV: o app ocupa a tela e a faixa fecha embaixo.
 *
 * O conteúdo ganha um `SafeAreaProvider` próprio de propósito: o SafeAreaView
 * nativo e o cabeçalho da navegação medem a área segura a partir do provider
 * mais próximo, e é dentro dele que o inset inferior é zerado.
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
      <SafeAreaProvider style={styles.preencher}>
        <SemInsetInferior>{children}</SemInsetInferior>
      </SafeAreaProvider>
      <DevBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  preencher: { flex: 1 },
});

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    faixa: {
      minHeight: 16,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: colors.devBanner,
    },
    texto: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 9,
      letterSpacing: 0.5,
      color: colors.onDevBanner,
    },
  });
}
