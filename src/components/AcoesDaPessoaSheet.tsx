import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { useTheme } from '@/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface AcaoDaPessoa {
  rotulo: string;
  icone: IoniconName;
  /** Ação sem volta (excluir): em vermelho. */
  perigo?: boolean;
  onPress: () => void;
}

interface AcoesDaPessoaSheetProps {
  nome: string;
  acoes: readonly AcaoDaPessoa[];
  onClose: () => void;
}

/**
 * A folha de ações da opção A (mockups da linha E): o nome e cada ação
 * escrita por extenso, no lugar dos quatro ícones sem rótulo da lista antiga.
 */
export function AcoesDaPessoaSheet({ nome, acoes, onClose }: AcoesDaPessoaSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <BottomSheet visible onClose={onClose}>
      <AppText variant="subtitle" accessibilityRole="header" numberOfLines={1}>
        {nome}
      </AppText>
      {acoes.map((acao) => {
        const cor = acao.perigo === true ? colors.error : colors.textPrimary;
        return (
          <Pressable
            key={acao.rotulo}
            onPress={() => {
              onClose();
              acao.onPress();
            }}
            style={styles.acao}
            accessibilityRole="button"
          >
            <Ionicons name={acao.icone} size={20} color={cor} />
            <Text style={[styles.rotulo, { color: cor }]}>{acao.rotulo}</Text>
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    acao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rotulo: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  });
}
