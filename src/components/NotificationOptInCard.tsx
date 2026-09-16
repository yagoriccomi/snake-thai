import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import type { Fonts } from '@/constants/theme';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface NotificationOptInCardProps {
  /** Papel de quem vê: o texto diz o que ESSA pessoa vai receber. */
  papel: 'admin' | 'professor' | 'user';
  ocupado: boolean;
  onAtivar: () => void;
  onAgoraNao: () => void;
}

const MOTIVO_POR_PAPEL: Record<NotificationOptInCardProps['papel'], string> = {
  user: 'Lembramos do vencimento da mensalidade e avisamos quando o comprovante for aprovado.',
  professor: 'Avisamos quando chegar justificativa de falta e quando uma aula sua ficar sem chamada.',
  admin: 'Avisamos quando chegar comprovante para analisar e quando aulas ficarem sem chamada.',
};

/**
 * Convite para ativar notificações, antes do pedido do Android. No Android 13+
 * uma recusa no pedido do sistema é difícil de desfazer: o pedido só aparece
 * depois de a pessoa entender o porquê e tocar em "Ativar".
 */
function NotificationOptInCardComponent({ papel, ocupado, onAtivar, onAgoraNao }: NotificationOptInCardProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.topo}>
        <Ionicons name="notifications-outline" size={22} color={colors.primaryText} />
        <Text style={styles.titulo} accessibilityRole="header">
          Ativar notificações?
        </Text>
      </View>
      <Text style={styles.texto}>{MOTIVO_POR_PAPEL[papel]}</Text>
      <Text style={styles.detalhe}>Sem nomes nem valores na tela bloqueada. Dá para desligar no Perfil.</Text>
      <View style={styles.acoes}>
        <Button title="Agora não" variant="secondary" onPress={onAgoraNao} disabled={ocupado} style={styles.acao} />
        <Button
          title="Ativar"
          onPress={onAtivar}
          loading={ocupado}
          style={styles.acao}
          accessibilityHint="Mostra o pedido de permissão do Android"
        />
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    topo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    titulo: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      color: colors.textPrimary,
    },
    texto: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textPrimary,
    },
    detalhe: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    acoes: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    acao: {
      flex: 1,
    },
  });
}

export const NotificationOptInCard = React.memo(NotificationOptInCardComponent);
