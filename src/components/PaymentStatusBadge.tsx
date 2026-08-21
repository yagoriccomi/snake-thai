import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PaymentStatus } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  /**
   * Estilo do selo. `outline` (padrão) é a pílula vazada original; `soft` é a
   * pílula preenchida com o tom da cor a baixa opacidade (linguagem Painel).
   */
  variant?: 'outline' | 'soft';
}

/** Rótulo e cor semântica de cada status. */
function metaFor(status: PaymentStatus): { label: string; outline: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paga', outline: '#22C55E' };
    case 'overdue':
      return { label: 'Vencida', outline: '#F87171' };
    case 'pending_approval':
      return { label: 'Em análise', outline: '#93C5FD' };
    case 'open':
    default:
      return { label: 'Em aberto', outline: '#FBBF24' };
  }
}

/**
 * Cores da variante preenchida (soft): fundo tonalizado + texto legível. Os
 * tons foram escolhidos para passar no contraste sobre o fundo escuro — em
 * especial o "Em análise", cujo azul institucional original era ilegível.
 */
function softFor(status: PaymentStatus): { bg: string; fg: string } {
  switch (status) {
    case 'paid':
      return { bg: 'rgba(34,197,94,0.16)', fg: '#4ADE80' };
    case 'overdue':
      return { bg: 'rgba(248,113,113,0.16)', fg: '#FCA5A5' };
    case 'pending_approval':
      return { bg: 'rgba(96,165,250,0.16)', fg: '#93C5FD' };
    case 'open':
    default:
      return { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24' };
  }
}

/** Selo do status de um pagamento, com rótulo e cor semântica. */
function PaymentStatusBadgeComponent({
  status,
  variant = 'outline',
}: PaymentStatusBadgeProps): React.JSX.Element {
  const { fonts } = useTheme();
  const isSoft = variant === 'soft';

  const styles = useMemo(() => {
    if (isSoft) {
      const { bg, fg } = softFor(status);
      return StyleSheet.create({
        badge: {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: bg,
        },
        text: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: fg },
      });
    }
    const { outline } = metaFor(status);
    return StyleSheet.create({
      badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: outline,
      },
      text: {
        fontFamily: fonts.bodySemiBold,
        fontSize: 11,
        color: outline,
        textTransform: 'uppercase',
      },
    });
  }, [isSoft, status, fonts]);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{metaFor(status).label}</Text>
    </View>
  );
}

export const PaymentStatusBadge = React.memo(PaymentStatusBadgeComponent);
