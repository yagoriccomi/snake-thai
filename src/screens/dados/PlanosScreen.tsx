import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
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
  MAX_WEEKLY_QUOTA,
  MIN_DUE_DAY,
  MIN_WEEKLY_QUOTA,
  SCHEDULE_MODE_LABELS,
  resumoDaModalidade,
  type BillingPeriod,
  type PlanInput,
  type PlanRow,
  type ScheduleMode,
} from '@/services/plans.service';
import { useTheme } from '@/theme/ThemeProvider';
import { centsToInput, formatCents, parseCurrencyToCents } from '@/utils/currency';
import { describeError } from '@/utils/errors';
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

/** Modalidades na ordem do mockup (linha A): fixo, livre, à vontade. */
const MODE_OPTIONS: ReadonlyArray<SegmentOption<ScheduleMode>> = (['fixed', 'free', 'unlimited'] as const).map(
  (mode) => ({ value: mode, label: SCHEDULE_MODE_LABELS[mode] }),
);

/** Cota sugerida ao escolher "Horário livre" (o admin ajusta de 1 a 6). */
const COTA_SUGERIDA = 3;

export const TEXTOS_DA_MODALIDADE = {
  dica: 'Fixo: segue a grade da turma. Livre: escolhe as aulas até a cota da semana. À vontade: vai quando quiser; a frequência é só a meta que ele mesmo define.',
  planoEmUso:
    'Plano com aluno ativo não muda de modalidade nem de cota. Para mudar, crie outro plano e mova os alunos.',
} as const;

/**
 * Gestão de planos (somente administrador) — Painel, vitrine de cartões.
 *
 * É aqui que o preço da mensalidade deixa de ser assunto do desenvolvedor.
 * Planos desativados somem das novas contratações mas continuam existindo, para
 * não quebrar o vínculo dos pagamentos já emitidos.
 *
 * O formulário fica recolhido atrás de "Novo plano" e reaparece ao criar ou ao
 * editar um cartão; cada plano é um cartão com o valor em destaque.
 */
export function PlanosScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { plans, loading, error, reload, add, edit, deactivate } = usePlans();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [dueDay, setDueDay] = useState('10');
  const [mode, setMode] = useState<ScheduleMode>('fixed');
  const [quota, setQuota] = useState(COTA_SUGERIDA);
  const [errors, setErrors] = useState<PlanErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setPeriod('monthly');
    setDueDay('10');
    setMode('fixed');
    setQuota(COTA_SUGERIDA);
    setErrors({});
  }, []);

  /** Abre o formulário em branco para cadastrar um plano novo. */
  const openNewForm = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [resetForm]);

  const startEditing = useCallback((plan: PlanRow) => {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description ?? '');
    setPrice(centsToInput(plan.price_cents));
    setPeriod(plan.billing_period);
    setDueDay(String(plan.due_day));
    setMode(plan.schedule_mode);
    setQuota(plan.weekly_quota ?? COTA_SUGERIDA);
    setErrors({});
    setFormOpen(true);
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
      scheduleMode: mode,
      weeklyQuota: mode === 'free' ? quota : null,
    };

    setSubmitting(true);
    try {
      if (editingId === null) {
        await add(input);
      } else {
        await edit(editingId, input);
      }
      resetForm();
    } catch (saveError) {
      setErrors({ form: describeError(saveError) });
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    price,
    dueDay,
    period,
    description,
    mode,
    quota,
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
    ({ item }) => {
      const inactive = !item.is_active;
      return (
        <View style={[styles.card, inactive ? styles.cardInactive : null]}>
          <View style={styles.cardTop}>
            <AppText variant="subtitle" numberOfLines={1} style={styles.cardName}>
              {item.name}
            </AppText>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => startEditing(item)}
                hitSlop={HIT_SLOP}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={`Editar plano ${item.name}`}
              >
                <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
              </Pressable>
              {item.is_active ? (
                <Pressable
                  onPress={() => handleDeactivate(item)}
                  hitSlop={HIT_SLOP}
                  style={styles.action}
                  accessibilityRole="button"
                  accessibilityLabel={`Desativar plano ${item.name}`}
                >
                  <Ionicons name="archive-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={styles.cardPrice}>{formatCents(item.price_cents)}</Text>

          <View style={styles.cardMeta}>
            {inactive ? (
              <View style={styles.pillOff}>
                <Text style={styles.pillOffText}>Desativado</Text>
              </View>
            ) : (
              <View style={styles.pillPeriod}>
                <Text style={styles.pillPeriodText}>
                  {BILLING_PERIOD_LABELS[item.billing_period]}
                </Text>
              </View>
            )}
            <View style={styles.pillMode}>
              <Text style={styles.pillModeText}>{SCHEDULE_MODE_LABELS[item.schedule_mode]}</Text>
            </View>
            <Text style={styles.cardDue}>
              {inactive
                ? BILLING_PERIOD_LABELS[item.billing_period]
                : `vence dia ${item.due_day}`}
            </Text>
          </View>
          <Text style={styles.cardDue}>{resumoDaModalidade(item)}</Text>
        </View>
      );
    },
    [styles, colors.textSecondary, startEditing, handleDeactivate],
  );

  const listHeader = useMemo(
    () =>
      formOpen ? (
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
          <AppText variant="caption" style={styles.label}>
            Modalidade
          </AppText>
          <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <AppText variant="caption" color={colors.textSecondary} style={styles.hint}>
            {TEXTOS_DA_MODALIDADE.dica}
          </AppText>
          {mode === 'free' ? (
            <View style={styles.quotaBlock}>
              <AppText variant="caption" style={styles.label}>
                Aulas por semana
              </AppText>
              <View style={styles.quotaRow}>
                <Pressable
                  onPress={() => setQuota((atual) => Math.max(MIN_WEEKLY_QUOTA, atual - 1))}
                  disabled={quota <= MIN_WEEKLY_QUOTA}
                  style={[styles.quotaButton, quota <= MIN_WEEKLY_QUOTA ? styles.quotaButtonOff : null]}
                  accessibilityRole="button"
                  accessibilityLabel="Menos uma aula por semana"
                  accessibilityState={{ disabled: quota <= MIN_WEEKLY_QUOTA }}
                >
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.quotaValue} accessibilityLiveRegion="polite">
                  {quota}
                </Text>
                <Pressable
                  onPress={() => setQuota((atual) => Math.min(MAX_WEEKLY_QUOTA, atual + 1))}
                  disabled={quota >= MAX_WEEKLY_QUOTA}
                  style={[styles.quotaButton, quota >= MAX_WEEKLY_QUOTA ? styles.quotaButtonOff : null]}
                  accessibilityRole="button"
                  accessibilityLabel="Mais uma aula por semana"
                  accessibilityState={{ disabled: quota >= MAX_WEEKLY_QUOTA }}
                >
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </Pressable>
                <AppText variant="caption" color={colors.textSecondary}>
                  {`${quota}x por semana · de ${MIN_WEEKLY_QUOTA} a ${MAX_WEEKLY_QUOTA}`}
                </AppText>
              </View>
            </View>
          ) : null}
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <AppText variant="caption" color={colors.textSecondary} style={styles.noticeText}>
              {TEXTOS_DA_MODALIDADE.planoEmUso}
            </AppText>
          </View>
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
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={resetForm}
            style={styles.cancel}
          />
        </View>
      ) : (
        <View style={styles.headerActions}>
          <Button title="Novo plano" onPress={openNewForm} />
          {plans.length > 0 ? (
            <Text style={styles.sectionLabel}>
              {plans.length === 1 ? '1 PLANO' : `${plans.length} PLANOS`}
            </Text>
          ) : null}
        </View>
      ),
    [
      formOpen,
      styles,
      editingId,
      name,
      description,
      price,
      period,
      dueDay,
      mode,
      quota,
      errors,
      colors.error,
      colors.textPrimary,
      colors.textSecondary,
      handlePress,
      submitting,
      resetForm,
      openNewForm,
      plans.length,
    ],
  );

  // Erro antes de lista: uma lista vazia por falha de rede faria o admin
  // concluir que nao ha planos cadastrados.
  if (error !== null && plans.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

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
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          formOpen ? null : (
            <EmptyState
              icon="pricetags-outline"
              title="Nenhum plano"
              message="Cadastre o primeiro plano para começar a cobrar mensalidades."
            />
          )
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: PlanRow): string => item.id;

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingTop: 16,
      paddingBottom: 24,
      flexGrow: 1,
    },
    headerActions: {
      marginBottom: 8,
    },
    sectionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 20,
      marginLeft: 4,
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
    hint: {
      marginTop: 6,
      marginBottom: 12,
    },
    quotaBlock: {
      marginBottom: 12,
    },
    quotaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    quotaButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quotaButtonOff: {
      opacity: 0.4,
    },
    quotaValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 28,
      minWidth: 32,
      textAlign: 'center',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    notice: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    noticeText: {
      flex: 1,
    },
    cancel: {
      marginTop: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    cardInactive: {
      opacity: 0.55,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardName: {
      flex: 1,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 4,
    },
    cardPrice: {
      fontFamily: fonts.bodyBold,
      fontSize: 26,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      marginTop: 6,
      marginBottom: 8,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pillPeriod: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    pillPeriodText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: colors.primaryText,
    },
    pillMode: {
      borderWidth: 1,
      borderColor: colors.textSecondary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    pillModeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    pillOff: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 2,
    },
    pillOffText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    cardDue: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    action: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
