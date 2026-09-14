import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';

import { AppText } from '@/components/AppText';
import type { Fonts, Radius } from '@/constants/theme';
import { createLogger } from '@/lib/logger';
import { fetchPlans, type PlanRow } from '@/services/plans.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';

const log = createLogger('PlanPicker');

interface PlanPickerProps {
  label?: string;
  /** plan_id atualmente selecionado (ou null para "Sem plano"). */
  value: string | null;
  onChange: (planId: string | null) => void;
}

/**
 * Seletor de plano. Diferente do `GroupPicker`, NÃO cria plano inline: plano
 * tem preço, periodicidade e dia de vencimento, e criar um no meio do cadastro
 * de aluno levaria a planos improvisados sendo faturados de verdade. A criação
 * fica na tela de Planos, do admin.
 *
 * "Sem plano" é uma escolha legítima e explícita — o aluno simplesmente não é
 * faturado enquanto estiver assim.
 */
export function PlanPicker({ label, value, onChange }: PlanPickerProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetchPlans(true)
      .then((lista) => {
        if (ativo) {
          setPlans(lista);
        }
      })
      .catch((erro: unknown) => {
        log.error('Falha ao carregar planos', erro);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const selectedLabel = useMemo(() => {
    if (value === null) {
      return 'Sem plano';
    }
    const encontrado = plans.find((plan) => plan.id === value);
    if (encontrado === undefined) {
      // O plano existe mas ainda não carregou, ou foi desativado.
      return 'Plano selecionado';
    }
    return `${encontrado.name} · ${formatCents(encontrado.price_cents)}`;
  }, [value, plans]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const select = useCallback(
    (planId: string | null) => {
      onChange(planId);
      close();
    },
    [onChange, close],
  );

  const renderItem = useCallback<ListRenderItem<PlanRow>>(
    ({ item }) => (
      <Pressable
        style={styles.option}
        onPress={() => select(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatCents(item.price_cents)}`}
      >
        <View style={styles.optionText}>
          <AppText variant="body">{item.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {formatCents(item.price_cents)} · vence dia {item.due_day}
          </AppText>
        </View>
        {item.id === value ? (
          <Ionicons name="checkmark" size={18} color={colors.primaryText} />
        ) : null}
      </Pressable>
    ),
    [styles, select, value, colors.primaryText, colors.textSecondary],
  );

  return (
    <View style={styles.container}>
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.field}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Plano: ${selectedLabel}`}
        accessibilityHint="Abre a lista de planos disponíveis"
      >
        <Text style={styles.fieldText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <AppText variant="subtitle" style={styles.sheetTitle}>
            Selecionar plano
          </AppText>

          <Pressable
            style={styles.option}
            onPress={() => select(null)}
            accessibilityRole="button"
            accessibilityLabel="Sem plano, o aluno não será cobrado"
          >
            <View style={styles.optionText}>
              <AppText variant="body">Sem plano</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                O aluno não recebe mensalidade
              </AppText>
            </View>
            {value === null ? (
              <Ionicons name="checkmark" size={18} color={colors.primaryText} />
            ) : null}
          </Pressable>

          <FlatList
            data={plans}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <AppText variant="caption" color={colors.textSecondary} style={styles.vazio}>
                Nenhum plano ativo. Cadastre um em Dados → Planos.
              </AppText>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const keyExtractor = (item: PlanRow): string => item.id;

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: 12,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    field: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    fieldText: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '70%',
      gap: 8,
    },
    sheetTitle: {
      marginBottom: 8,
    },
    list: {
      maxHeight: 300,
    },
    option: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    optionText: {
      flex: 1,
      gap: 2,
    },
    vazio: {
      paddingVertical: 16,
      textAlign: 'center',
    },
  });
}
