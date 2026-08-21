import React, { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import type { Fonts, Radius } from '@/constants/theme';
import type { PaymentWithName } from '@/hooks/useAdminPayments';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { dateIsoToBr } from '@/utils/masks';

/** Altura fixa do card + margem — permite `getItemLayout`. */
export const ADMIN_PAYMENT_CARD_HEIGHT = 76;
export const ADMIN_PAYMENT_CARD_MARGIN = 10;
export const ADMIN_PAYMENT_CARD_TOTAL =
  ADMIN_PAYMENT_CARD_HEIGHT + ADMIN_PAYMENT_CARD_MARGIN;

interface AdminPaymentCardProps {
  item: PaymentWithName;
  onPress: (item: PaymentWithName) => void;
}

/** Iniciais do aluno para o avatar (até duas letras). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '—';
  }
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  return (first + last).toUpperCase();
}

/** Data curta dd/mm a partir do ISO. */
function shortDue(iso: string): string {
  return dateIsoToBr(iso).slice(0, 5);
}

/**
 * Item da fila de pagamentos do admin (Painel): avatar, nome, plano, valor e
 * status. Pendentes de aprovação são acionáveis e ganham a ação "Revisar".
 */
function AdminPaymentCardComponent({
  item,
  onPress,
}: AdminPaymentCardProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const reviewable = item.status === 'pending_approval';
  const handlePress = useCallback(() => onPress(item), [onPress, item]);

  const meta =
    item.planName !== null
      ? `${item.planName} · venc. ${shortDue(item.due_date)}`
      : `Venc. ${shortDue(item.due_date)}`;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!reviewable}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ disabled: !reviewable }}
      accessibilityLabel={`Pagamento de ${item.studentName}, ${formatCents(item.amount_cents)}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(item.studentName)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.studentName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.amount}>{formatCents(item.amount_cents)}</Text>
        {reviewable ? (
          <View style={styles.reviewChip}>
            <Text style={styles.reviewText}>Revisar</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.onPrimary} />
          </View>
        ) : (
          <PaymentStatusBadge status={item.status} variant="soft" />
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      height: ADMIN_PAYMENT_CARD_HEIGHT,
      marginBottom: ADMIN_PAYMENT_CARD_MARGIN,
      borderRadius: radius.lg + 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    info: {
      flex: 1,
      gap: 3,
    },
    name: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    right: {
      alignItems: 'flex-end',
      gap: 6,
    },
    amount: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.2,
    },
    reviewChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    reviewText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.onPrimary,
    },
  });
}

export const AdminPaymentCard = React.memo(AdminPaymentCardComponent);
