import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { GroupPicker } from '@/components/GroupPicker';
import { PlanPicker } from '@/components/PlanPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import {
  fetchAllStudents,
  resetStudentPassword,
  setStudentActive,
  updateStudentGroup,
  updateStudentPlan,
  updateUserRole,
} from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const SCREEN_EDGES = ['bottom'] as const;

/** Filtro ativo da lista — atalhos para os recortes mais comuns. */
type StudentFilter = 'active' | 'inactive' | 'admin';

/** Opções de filtro, na ordem em que aparecem. */
const FILTERS: ReadonlyArray<{ key: StudentFilter; label: string }> = [
  { key: 'active', label: 'Ativos' },
  { key: 'inactive', label: 'Trancados' },
  { key: 'admin', label: 'Admins' },
];

/** Iniciais para o avatar a partir do nome (ou '•' quando pendente). */
function initialsFrom(name: string | null): string {
  if (name === null) return '•';
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0];
  if (first === undefined) return '•';
  const last = parts[parts.length - 1] ?? first;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

/**
 * Gestão de alunos (admin) — Painel, cartões de aluno.
 *
 * Lista todos os alunos com busca por nome e filtros rápidos (ativos, trancados,
 * administradores). Permite atribuir/alterar a turma (via GroupPicker, com
 * atualização otimista), promover/rebaixar papel, trancar/reativar a matrícula e
 * redefinir a senha de quem esqueceu — devolvendo a conta à senha padrão e ao
 * onboarding.
 */
export function GerenciarAlunosScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { settings } = useAcademySettings();

  // Senha inicial definida pelo admin nas configuracoes da academia.
  const defaultPassword = settings?.default_student_password ?? 'Snake@123';

  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StudentFilter>('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStudents(await fetchAllStudents());
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recorte da lista pelo filtro ativo e pela busca por nome (tudo em memória).
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesFilter =
        filter === 'admin' ? student.role === 'admin' : student.status === filter;
      const matchesQuery =
        q === '' || (student.name ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [students, filter, query]);

  const handleChangeGroup = useCallback(
    async (studentId: string, groupId: string | null) => {
      setStudents((previous) =>
        previous.map((student) =>
          student.id === studentId ? { ...student, group_id: groupId } : student,
        ),
      );
      try {
        await updateStudentGroup(studentId, groupId);
      } catch {
        void load();
      }
    },
    [load],
  );

  /** Troca o plano do aluno — é o que o inclui (ou tira) do faturamento. */
  const handleChangePlan = useCallback(
    async (studentId: string, planId: string | null) => {
      setStudents((previous) =>
        previous.map((student) =>
          student.id === studentId ? { ...student, plan_id: planId } : student,
        ),
      );
      try {
        await updateStudentPlan(studentId, planId);
      } catch {
        void load();
      }
    },
    [load],
  );

  /**
   * Redefine a senha do aluno para a padrão. Pede confirmação antes: é uma ação
   * que invalida o acesso atual da pessoa, então não pode acontecer por toque
   * acidental na lista.
   */
  const handleResetPassword = useCallback((student: Profile) => {
    const label = student.name ?? 'este aluno';
    Alert.alert(
      'Redefinir senha?',
      `A senha de ${label} voltará para a padrão (${defaultPassword}) e ele precisará criar uma nova no próximo acesso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Redefinir',
          style: 'destructive',
          onPress: () => {
            setResettingId(student.id);
            void resetStudentPassword(student.id)
              .then(() => {
                Alert.alert(
                  'Senha redefinida',
                  `Informe a senha padrão ${defaultPassword} para ${label}.`,
                );
              })
              .catch(() => {
                Alert.alert(
                  'Não foi possível redefinir',
                  'Tente novamente em instantes.',
                );
              })
              .finally(() => {
                setResettingId(null);
              });
          },
        },
      ],
    );
  }, [defaultPassword]);

  /**
   * Tranca ou reativa a matricula. Trancar preserva historico de presenca e
   * financeiro — apagar aluno destruiria a contabilidade do periodo.
   */
  const handleToggleActive = useCallback(
    (student: Profile) => {
      const isActive = student.status === 'active';
      const label = student.name ?? 'este aluno';
      Alert.alert(
        isActive ? 'Trancar matricula?' : 'Reativar matricula?',
        isActive
          ? `${label} deixa de constar entre os alunos ativos. O historico e mantido e a matricula pode ser reativada depois.`
          : `${label} volta a constar entre os alunos ativos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: isActive ? 'Trancar' : 'Reativar',
            style: isActive ? 'destructive' : 'default',
            onPress: () => {
              void setStudentActive(student.id, !isActive)
                .then(load)
                .catch(() => {
                  Alert.alert('Nao foi possivel alterar', 'Tente novamente.');
                });
            },
          },
        ],
      );
    },
    [load],
  );

  /**
   * Promove a administrador ou rebaixa a aluno. A trava contra ficar sem
   * administrador vive no banco; aqui apenas traduzimos a recusa.
   */
  const handleToggleRole = useCallback(
    (student: Profile) => {
      const willPromote = student.role !== 'admin';
      const label = student.name ?? 'este aluno';
      Alert.alert(
        willPromote ? 'Promover a administrador?' : 'Rebaixar a aluno?',
        willPromote
          ? `${label} passa a gerenciar alunos, planos, aulas e configuracoes.`
          : `${label} perde o acesso administrativo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: willPromote ? 'Promover' : 'Rebaixar',
            style: willPromote ? 'default' : 'destructive',
            onPress: () => {
              void updateUserRole(student.id, willPromote ? 'admin' : 'user')
                .then(load)
                .catch(() => {
                  Alert.alert(
                    'Nao foi possivel alterar',
                    'Se este e o ultimo administrador ativo, promova outro antes de rebaixa-lo.',
                  );
                });
            },
          },
        ],
      );
    },
    [load],
  );

  const renderItem = useCallback<ListRenderItem<Profile>>(
    ({ item }) => {
      const isAdmin = item.role === 'admin';
      const isActive = item.status === 'active';
      return (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsFrom(item.name)}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name ?? 'Aluno pendente'}
                </Text>
                {isAdmin ? (
                  <View style={styles.adminPill}>
                    <Text style={styles.adminPillText}>Admin</Text>
                  </View>
                ) : null}
              </View>
              <View style={[styles.statusPill, isActive ? styles.statusOk : styles.statusOff]}>
                <Text style={[styles.statusText, { color: isActive ? colors.success : colors.warning }]}>
                  {isActive ? 'Ativo' : 'Trancado'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => handleToggleRole(item)}
                hitSlop={HIT_SLOP}
                style={styles.action}
                accessibilityRole="button"
                accessibilityState={{ selected: isAdmin }}
                accessibilityLabel={
                  isAdmin
                    ? `Rebaixar ${item.name ?? 'aluno'} a aluno`
                    : `Promover ${item.name ?? 'aluno'} a administrador`
                }
              >
                <Ionicons
                  name={isAdmin ? 'shield-checkmark' : 'shield-outline'}
                  size={20}
                  color={isAdmin ? colors.primary : colors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={() => handleToggleActive(item)}
                hitSlop={HIT_SLOP}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={
                  isActive
                    ? `Trancar matricula de ${item.name ?? 'aluno'}`
                    : `Reativar matricula de ${item.name ?? 'aluno'}`
                }
              >
                <Ionicons
                  name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
              <Pressable
                onPress={() => handleResetPassword(item)}
                disabled={resettingId === item.id}
                hitSlop={HIT_SLOP}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={`Redefinir senha de ${item.name ?? 'aluno pendente'}`}
                accessibilityHint="Volta a senha para a padrão e exige nova senha no próximo acesso"
              >
                {resettingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
          </View>
          <View style={styles.pickerWrap}>
            <GroupPicker
              value={item.group_id}
              onChange={(groupId) => void handleChangeGroup(item.id, groupId)}
            />
            <PlanPicker
              value={item.plan_id}
              onChange={(planId) => void handleChangePlan(item.id, planId)}
            />
          </View>
        </View>
      );
    },
    [
      styles,
      colors.primary,
      colors.textSecondary,
      colors.success,
      colors.warning,
      handleChangeGroup,
      handleChangePlan,
      handleResetPassword,
      handleToggleActive,
      handleToggleRole,
      resettingId,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar aluno"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar aluno pelo nome"
          />
        </View>
        <View style={styles.chips}>
          {FILTERS.map((option) => {
            const active = filter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={[styles.chip, active ? styles.chipOn : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrar por ${option.label}`}
              >
                <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [styles, colors.textSecondary, query, filter],
  );

  if (loading && students.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={filteredStudents}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Nenhum aluno"
              message="Cadastre alunos para gerenciá-los aqui."
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Nenhum resultado"
              message="Nenhum aluno corresponde ao filtro ou à busca."
            />
          )
        }
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: Profile): string => item.id;

/** Área de toque extra dos botões de ação (alvo de 44dp). */
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
      paddingTop: 12,
      paddingBottom: 24,
      flexGrow: 1,
    },
    header: {
      gap: 12,
      marginBottom: 12,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 14,
      padding: 0,
    },
    chips: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.textSecondary,
    },
    chipTextOn: {
      color: colors.onPrimary,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 13,
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
      minWidth: 0,
      gap: 4,
    },
    nameLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    name: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    adminPill: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    adminPillText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10,
      color: colors.primaryText,
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 2,
    },
    statusOk: {
      backgroundColor: 'rgba(34,197,94,0.14)',
    },
    statusOff: {
      backgroundColor: 'rgba(245,158,11,0.14)',
    },
    statusText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
    },
    actions: {
      flexDirection: 'row',
      gap: 2,
    },
    action: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerWrap: {
      marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
  });
}
