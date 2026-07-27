import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import type { Fonts, Radius } from '@/constants/theme';
import type { PaymentWithName } from '@/hooks/useAdminPayments';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { dateIsoToBr } from '@/utils/masks';

/** Altura fixa do card + margem — permite `getItemLayout`. */
export const ADMIN_PAYMENT_CARD_HEIGHT = 72;
export const ADMIN_PAYMENT_CARD_MARGIN = 10;
export const ADMIN_PAYMENT_CARD_TOTAL =
  ADMIN_PAYMENT_CARD_HEIGHT + ADMIN_PAYMENT_CARD_MARGIN;

interface AdminPaymentCardProps {
  item: PaymentWithName;
  onPress: (item: PaymentWithName) => void;
}

/** Item da lista de pagamentos do admin (nome do aluno + vencimento + status). */
function AdminPaymentCardComponent({
  item,
  onPress,
}: AdminPaymentCardProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const reviewable = item.status === 'pending_approval';
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!reviewable}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ disabled: !reviewable }}
      accessibilityLabel={`Pagamento de ${item.studentName}`}
    >
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.studentName}
        </Text>
        <View style={styles.meta}>
          <PaymentStatusBadge status={item.status} />
          <Text style={styles.due}>Venc. {dateIsoToBr(item.due_date)}</Text>
        </View>
      </View>
      {reviewable ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      height: ADMIN_PAYMENT_CARD_HEIGHT,
      marginBottom: ADMIN_PAYMENT_CARD_MARGIN,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    due: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}

export const AdminPaymentCard = React.memo(AdminPaymentCardComponent);
