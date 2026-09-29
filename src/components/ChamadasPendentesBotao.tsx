import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface AtalhoDaAgendaProps {
  icone: IoniconName;
  titulo: string;
  /** O que o toque abre, para o leitor de tela. */
  dica: string;
  quantidade: number;
  onPress: () => void;
}

/**
 * Um atalho da agenda da equipe com contador: chamadas pendentes (T13) e
 * justificativas para revisar (§ 9.1). Some quando não há nada pendente.
 */
function AtalhoDaAgendaComponent({ icone, titulo, dica, quantidade, onPress }: AtalhoDaAgendaProps): React.JSX.Element | null {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (quantidade === 0) {
    return null;
  }
  return (
    <Pressable
      onPress={onPress}
      style={styles.botao}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}: ${quantidade}`}
      accessibilityHint={dica}
    >
      <Ionicons name={icone} size={22} color={colors.warning} />
      <Text style={styles.texto}>{titulo}</Text>
      <View style={styles.contador}>
        <Text style={styles.contadorTexto}>{quantidade}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export const AtalhoDaAgenda = React.memo(AtalhoDaAgendaComponent);

interface ChamadasPendentesBotaoProps {
  quantidade: number;
  onPress: () => void;
}

/** O acesso às chamadas pendentes (T13), no lugar do aviso antigo, que sumia na virada do mês. */
export const ChamadasPendentesBotao = React.memo(function ChamadasPendentesBotao({
  quantidade,
  onPress,
}: ChamadasPendentesBotaoProps): React.JSX.Element {
  return (
    <AtalhoDaAgenda
      icone="clipboard-outline"
      titulo="Chamadas pendentes"
      dica="Abre as aulas que passaram sem chamada"
      quantidade={quantidade}
      onPress={onPress}
    />
  );
});

/** As justificativas que quem abre a agenda pode decidir (§ 9.1, D14). */
export const JustificativasParaRevisarBotao = React.memo(function JustificativasParaRevisarBotao({
  quantidade,
  onPress,
}: ChamadasPendentesBotaoProps): React.JSX.Element {
  return (
    <AtalhoDaAgenda
      icone="document-text-outline"
      titulo="Justificativas para revisar"
      dica="Abre as justificativas que você pode aprovar ou negar"
      quantidade={quantidade}
      onPress={onPress}
    />
  );
});

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    botao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    texto: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    contador: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
    },
    contadorTexto: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.background },
  });
}
