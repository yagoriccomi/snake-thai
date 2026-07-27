import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import type { Fonts, Radius } from '@/constants/theme';
import type { PaymentRow } from '@/services/payments.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { dateIsoToBr } from '@/utils/masks';

/** Altura fixa do card + margem — permite `getItemLayout`. */
export const PAYMENT_CARD_HEIGHT = 92;
export const PAYMENT_CARD_MARGIN = 12;
export const PAYMENT_CARD_TOTAL = PAYMENT_CARD_HEIGHT + PAYMENT_CARD_MARGIN;

interface PaymentCardProps {
  item: PaymentRow;
  onPress: (item: PaymentRow) => void;
}

/**
 * Card de mensalidade (visão do aluno). Aulas open/overdue são acionáveis
 * (levam ao fluxo de pagamento); pending/paid apenas informam o estado.
 */
function PaymentCardComponent({ item, onPress }: PaymentCardProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const actionable = item.status === 'open' || item.status === 'overdue';
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  const hint =
    item.status === 'pending_approval'
      ? 'Comprovante em análise'
      : item.status === 'paid'
        ? 'Pagamento confirmado'
        : 'Toque para enviar o comprovante';

  return (
    <Pressable
      onPress={handlePress}
      disabled={!actionable}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ disabled: !actionable }}
      accessibilityLabel={`Mensalidade com vencimento em ${dateIsoToBr(item.due_date)}`}
    >
      <View style={styles.info}>
        <Text style={styles.due}>Vencimento: {dateIsoToBr(item.due_date)}</Text>
        <PaymentStatusBadge status={item.status} />
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      {actionable ? (
        <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      height: PAYMENT_CARD_HEIGHT,
      marginBottom: PAYMENT_CARD_MARGIN,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    due: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}

export const PaymentCard = React.memo(PaymentCardComponent);
