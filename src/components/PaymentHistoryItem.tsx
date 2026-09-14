import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { PaymentStatusBadge } from '@/components/PaymentStatusBadge';
import type { PaymentRow } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { formatMonthYear } from '@/utils/datetime';
import { dateIsoToBr } from '@/utils/masks';
import { descreverPagamento, ROTULO_DA_SITUACAO, temComprovante } from '@/utils/payments';

interface PaymentHistoryItemProps {
  payment: PaymentRow;
  expanded: boolean;
  /** Uma ação sobre ESTA mensalidade está em andamento. */
  busy: boolean;
  onToggle: (paymentId: string) => void;
  onOpenAttachment: (payment: PaymentRow) => void;
  onMarkPaid: (payment: PaymentRow) => void;
  onMarkUnpaid: (payment: PaymentRow) => void;
}

/**
 * Uma mensalidade no histórico do aluno (admin). Fechada, mostra o mês, a
 * situação e se há anexo; aberta, os detalhes, o anexo e as ações manuais.
 *
 * Marcar como paga não exige anexo: é o registro do admin (pagamento em
 * dinheiro, acerto combinado). O aluno continua obrigado a anexar — isso é
 * garantido no banco, não aqui.
 */
function PaymentHistoryItemComponent({
  payment,
  expanded,
  busy,
  onToggle,
  onOpenAttachment,
  onMarkPaid,
  onMarkUnpaid,
}: PaymentHistoryItemProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const mes = formatMonthYear(payment.reference_month);
  const anexo = temComprovante(payment);

  return (
    <View style={styles.item}>
      <Pressable
        onPress={() => onToggle(payment.id)}
        style={styles.cabecalho}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${mes}, ${ROTULO_DA_SITUACAO[payment.status]}, ${anexo ? 'com anexo' : 'sem anexo'}`}
        accessibilityHint={expanded ? 'Recolhe os detalhes' : 'Mostra os detalhes e as ações'}
      >
        <View style={styles.titulo}>
          <Text style={styles.mes}>{mes}</Text>
          <View style={styles.anexo}>
            <Ionicons
              name={anexo ? 'attach' : 'close-circle-outline'}
              size={14}
              color={anexo ? colors.primaryText : colors.textSecondary}
            />
            <Text style={[styles.anexoTexto, anexo ? { color: colors.primaryText } : null]}>
              {anexo ? 'Com anexo' : 'Sem anexo'}
            </Text>
          </View>
        </View>
        <PaymentStatusBadge status={payment.status} variant="soft" />
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.corpo}>
          <Linha rotulo="Valor" valor={formatCents(payment.amount_cents)} styles={styles} />
          <Linha rotulo="Vencimento" valor={dateIsoToBr(payment.due_date)} styles={styles} />
          <Linha rotulo="Pagamento" valor={descreverPagamento(payment)} styles={styles} />

          {anexo ? (
            <Button
              title="Abrir anexo"
              variant="secondary"
              onPress={() => onOpenAttachment(payment)}
              accessibilityHint="Mostra o comprovante enviado pelo aluno"
            />
          ) : null}

          {payment.status === 'paid' ? (
            <Button
              title="Marcar como não paga"
              variant="secondary"
              onPress={() => onMarkUnpaid(payment)}
              loading={busy}
              accessibilityHint="Desfaz o pagamento; o anexo, se houver, é mantido"
            />
          ) : (
            <Button
              title="Marcar como paga"
              onPress={() => onMarkPaid(payment)}
              loading={busy}
              accessibilityHint="Registra o pagamento agora, sem exigir anexo"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

type Estilos = ReturnType<typeof makeStyles>;

function Linha({
  rotulo,
  valor,
  styles,
}: {
  rotulo: string;
  valor: string;
  styles: Estilos;
}): React.JSX.Element {
  return (
    <View style={styles.linha} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    item: {
      marginBottom: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    titulo: { flex: 1, gap: 3 },
    mes: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    anexo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    anexoTexto: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    corpo: {
      gap: 12,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
    rotulo: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
    valor: {
      flexShrink: 1,
      textAlign: 'right',
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
  });
}

export const PaymentHistoryItem = React.memo(PaymentHistoryItemComponent);
