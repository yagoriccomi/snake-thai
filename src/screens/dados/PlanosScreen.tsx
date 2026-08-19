import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import { usePlans } from '@/hooks/usePlans';
import {
  BILLING_PERIOD_LABELS,
  MAX_DUE_DAY,
  MIN_DUE_DAY,
  type BillingPeriod,
  type PlanInput,
  type PlanRow,
} from '@/services/plans.service';
import { useTheme } from '@/theme/ThemeProvider';
import { centsToInput, formatCents, parseCurrencyToCents } from '@/utils/currency';
import { onlyDigits } from '@/utils/masks';

/** Campos com mensagem de erro no formulário de plano. */
type PlanErrors = Partial<Record<'name' | 'price' | 'dueDay' | 'form', string>>;

const SCREEN_EDGES = ['bottom'] as const;

/** Periodicidades na ordem em que aparecem no seletor. */
const PERIOD_ORDER: readonly BillingPeriod[] = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
];

/** Opções do seletor, tipadas pelo próprio enum do banco. */
const PERIOD_OPTIONS: ReadonlyArray<SegmentOption<BillingPeriod>> = PERIOD_ORDER.map(
  (period) => ({ value: period, label: BILLING_PERIOD_LABELS[period] }),
);

/** Altura fixa de cada item — permite getItemLayout na lista (CLAUDE.md §4). */
const ITEM_HEIGHT = 92;

/**
 * Gestão de planos (somente administrador).
 *
 * É aqui que o preço da mensalidade deixa de ser assunto do desenvolvedor.
 * Planos desativados somem das novas contratações mas continuam existindo, para
 * não quebrar o vínculo dos pagamentos já emitidos.
 */
export function PlanosScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { plans, loading, add, edit, deactivate } = usePlans();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [dueDay, setDueDay] = useState('10');
  const [errors, setErrors] = useState<PlanErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setPeriod('monthly');
    setDueDay('10');
    setErrors({});
  }, []);

  const startEditing = useCallback((plan: PlanRow) => {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description ?? '');
    setPrice(centsToInput(plan.price_cents));
    setPeriod(plan.billing_period);
    setDueDay(String(plan.due_day));
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    const validation: PlanErrors = {};
    if (name.trim().length < 2) {
      validation.name = 'Informe o nome do plano.';
    }
    const priceCents = parseCurrencyToCents(price);
    if (priceCents === null) {
      validation.price = 'Informe o valor da mensalidade.';
    }
    const parsedDueDay = Number(onlyDigits(dueDay));
    if (
      !Number.isInteger(parsedDueDay) ||
      parsedDueDay < MIN_DUE_DAY ||
      parsedDueDay > MAX_DUE_DAY
    ) {
      validation.dueDay = `Escolha um dia entre ${MIN_DUE_DAY} e ${MAX_DUE_DAY}.`;
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0 || priceCents === null) {
      return;
    }

    const input: PlanInput = {
      name,
      description: description.trim() === '' ? null : description,
      priceCents,
      billingPeriod: period,
      dueDay: parsedDueDay,
      isActive: true,
    };

    setSubmitting(true);
    try {
      if (editingId === null) {
        await add(input);
      } else {
        await edit(editingId, input);
      }
      resetForm();
    } catch {
      setErrors({ form: 'Não foi possível salvar o plano. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    price,
    dueDay,
    period,
    description,
    editingId,
    add,
    edit,
    resetForm,
  ]);

  const handlePress = useCallback(() => void handleSubmit(), [handleSubmit]);

  const handleDeactivate = useCallback(
    (plan: PlanRow) => {
      Alert.alert(
        'Desativar plano?',
        `"${plan.name}" deixa de aparecer para novas contratações. As cobranças já emitidas continuam intactas.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desativar',
            style: 'destructive',
            onPress: () => void deactivate(plan.id),
          },
        ],
      );
    },
    [deactivate],
  );

  const renderItem = useCallback<ListRenderItem<PlanRow>>(
    ({ item }) => (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.rowInfo}>
          <AppText variant="subtitle" numberOfLines={1}>
            {item.name}
          </AppText>
          <AppText variant="caption">
            {formatCents(item.price_cents)} ·{' '}
            {BILLING_PERIOD_LABELS[item.billing_period]} · vence dia {item.due_day}
          </AppText>
          {!item.is_active ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Desativado
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={() => startEditing(item)}
          hitSlop={HIT_SLOP}
          style={styles.action}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Editar plano ${item.name}`}
        >
          <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
        </Pressable>
        {item.is_active ? (
          <Pressable
            onPress={() => handleDeactivate(item)}
            hitSlop={HIT_SLOP}
            style={styles.action}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Desativar plano ${item.name}`}
          >
            <Ionicons name="archive-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    ),
    [colors.border, colors.textSecondary, startEditing, handleDeactivate],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.form}>
        <AppText variant="subtitle" style={styles.formTitle}>
          {editingId === null ? 'Novo plano' : 'Editando plano'}
        </AppText>
        <Input
          label="Nome"
          placeholder="Mensal 3x por semana"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />
        <Input
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
        />
        <Input
          label="Valor"
          placeholder="129,90"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          error={errors.price}
        />
        <AppText variant="caption" style={styles.label}>
          Periodicidade
        </AppText>
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
        />
        <Input
          label="Dia de vencimento"
          placeholder="10"
          keyboardType="number-pad"
          value={dueDay}
          onChangeText={setDueDay}
          error={errors.dueDay}
          containerStyle={styles.dueDay}
        />
        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error}>
            {errors.form}
          </AppText>
        ) : null}
        <Button
          title={editingId === null ? 'Criar plano' : 'Salvar alterações'}
          onPress={handlePress}
          loading={submitting}
        />
        {editingId !== null ? (
          <Button
            title="Cancelar edição"
            variant="secondary"
            onPress={resetForm}
            style={styles.cancel}
          />
        ) : null}
      </View>
    ),
    [
      editingId,
      name,
      description,
      price,
      period,
      dueDay,
      errors,
      colors.error,
      handlePress,
      submitting,
      resetForm,
    ],
  );

  if (loading && plans.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <FlatList
        data={plans}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title="Nenhum plano"
            message="Cadastre o primeiro plano para começar a cobrar mensalidades."
          />
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PlanRow): string => item.id;

/** Altura fixa conhecida — evita medição por item na rolagem (CLAUDE.md §4). */
const getItemLayout = (
  _data: ArrayLike<PlanRow> | null | undefined,
  index: number,
): { length: number; offset: number; index: number } => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 16,
    flexGrow: 1,
  },
  form: {
    marginBottom: 16,
  },
  formTitle: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 8,
  },
  dueDay: {
    marginTop: 16,
  },
  cancel: {
    marginTop: 12,
  },
  row: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
