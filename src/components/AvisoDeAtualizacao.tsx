import React, { useEffect, useMemo } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Portal } from '@/components/Portal';
import { env } from '@/config/env';
import { useAvisoDeAtualizacao } from '@/hooks/useAvisoDeAtualizacao';
import { useTheme, type Theme } from '@/theme/ThemeProvider';
import type { AtualizacaoDisponivel } from '@/utils/avisoDeAtualizacao';

/** Textos exatos do contrato (§ 3 e § 12.3): iguais em qualquer tela. */
export const TEXTOS_DO_AVISO = {
  titulo: 'Nova versão disponível',
  baixar: 'Baixar atualização',
  agoraNao: 'Agora não',
  nota: 'Este aviso aparece uma vez por dia até você atualizar.',
} as const;

const TAMANHO_DO_ICONE = 24;
const DIAMETRO_DO_ICONE = 48;
const TAMANHO_DO_TITULO = 19;
const TAMANHO_DA_NOTA = 12;
const RAIO_DO_CARTAO = 16;

interface CartaoDoAvisoProps {
  atualizacao: AtualizacaoDisponivel;
  onBaixar: () => void;
  onDispensar: () => void;
}

/**
 * O cartão "Nova versão disponível", centralizado sobre um véu (mockup
 * "AtualizacaoDisponivel", linha H). O véu não fecha: a escolha é pelos
 * botões, e o voltar do Android vale como **Agora não**.
 */
export function CartaoDoAvisoDeAtualizacao({
  atualizacao,
  onBaixar,
  onDispensar,
}: CartaoDoAvisoProps): React.JSX.Element {
  const tema = useTheme();
  const { colors } = tema;
  const styles = useMemo(() => makeStyles(tema), [tema]);

  useEffect(() => {
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      onDispensar();
      return true;
    });
    return () => assinatura.remove();
  }, [onDispensar]);

  return (
    <Portal>
      <View style={styles.veu}>
        <View style={styles.cartao} accessibilityViewIsModal>
          <View style={styles.icone}>
            <Ionicons name="download-outline" size={TAMANHO_DO_ICONE} color={colors.primaryText} />
          </View>
          <AppText accessibilityRole="header" style={styles.titulo}>
            {TEXTOS_DO_AVISO.titulo}
          </AppText>
          <AppText style={styles.corpo}>
            A versão {atualizacao.instalada} deste aplicativo pode apresentar mal funcionamento. Recomendamos
            atualizar para a versão <AppText style={styles.negrito}>{atualizacao.nova}</AppText>.
          </AppText>
          <Button
            title={TEXTOS_DO_AVISO.baixar}
            onPress={onBaixar}
            accessibilityHint="Abre a página de download no navegador"
          />
          <Button title={TEXTOS_DO_AVISO.agoraNao} variant="secondary" onPress={onDispensar} />
          <AppText variant="caption" style={styles.nota}>
            {TEXTOS_DO_AVISO.nota}
          </AppText>
        </View>
      </View>
    </Portal>
  );
}

/**
 * Aviso de atualização do app (contrato § 12.3). Fica na raiz, acima da
 * navegação: aparece em qualquer tela, inclusive no Login. Nada aparece no APK
 * DEV, sem rede ou sem versão nova.
 */
export function AvisoDeAtualizacao(): React.JSX.Element | null {
  const { atualizacao, baixar, dispensar } = useAvisoDeAtualizacao({
    ativo: env.appVariant !== 'development',
    versaoInstalada: Constants.expoConfig?.version,
  });

  if (atualizacao === null) return null;
  return <CartaoDoAvisoDeAtualizacao atualizacao={atualizacao} onBaixar={baixar} onDispensar={dispensar} />;
}

function makeStyles({ colors, fonts, spacing, typography }: Theme) {
  return StyleSheet.create({
    veu: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    cartao: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: RAIO_DO_CARTAO,
      padding: spacing.xl,
      gap: spacing.md,
    },
    icone: {
      width: DIAMETRO_DO_ICONE,
      height: DIAMETRO_DO_ICONE,
      borderRadius: DIAMETRO_DO_ICONE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    titulo: { fontFamily: fonts.heading, fontSize: TAMANHO_DO_TITULO, color: colors.textPrimary },
    corpo: { fontSize: typography.body.size, lineHeight: typography.body.lineHeight },
    negrito: { fontFamily: fonts.bodyBold },
    nota: { fontSize: TAMANHO_DA_NOTA, color: colors.textSecondary },
  });
}
