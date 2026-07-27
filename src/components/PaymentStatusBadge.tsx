import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PaymentStatus } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

/** Selo do status de um pagamento, com rótulo e cor semântica. */
function PaymentStatusBadgeComponent({ status }: PaymentStatusBadgeProps): React.JSX.Element {
  const { colors, fonts } = useTheme();

  const { label, accent } = useMemo(() => {
    switch (status) {
      case 'paid':
        return { label: 'Paga', accent: colors.success };
      case 'overdue':
        return { label: 'Vencida', accent: colors.error };
      case 'pending_approval':
        return { label: 'Em análise', accent: colors.info };
      case 'open':
      default:
        return { label: 'Em aberto', accent: colors.warning };
    }
  }, [status, colors]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: accent,
        },
        text: {
          fontFamily: fonts.bodySemiBold,
          fontSize: 11,
          color: accent,
          textTransform: 'uppercase',
        },
      }),
    [accent, fonts],
  );

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export const PaymentStatusBadge = React.memo(PaymentStatusBadgeComponent);
