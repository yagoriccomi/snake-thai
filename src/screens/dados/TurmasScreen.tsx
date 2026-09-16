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
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExcluirTurmaSheet } from '@/components/ExcluirTurmaSheet';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import type { Fonts } from '@/constants/theme';
import { useGroupsOverview } from '@/hooks/useGroupsOverview';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import {
  createGroup,
  reactivateGroup,
  renameGroup,
  type GroupOverview,
  type GroupRemovalResult,
  type GroupRow,
} from '@/services/groups.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('TurmasScreen');

const SCREEN_EDGES = ['bottom'] as const;
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;
const NOME_MINIMO = 2;

/** Folha de nome aberta: criar turma nova ou renomear uma existente. */
type FolhaDeNome = { modo: 'criar' } | { modo: 'renomear'; turma: GroupRow } | null;

function contagem(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

/**
 * Turmas (somente admin): criar, renomear, excluir/arquivar, reativar e abrir
 * a grade semanal de cada uma.
 *
 * As arquivadas ficam recolhidas no fim: existem para o histórico, não para o
 * dia a dia. Contagens recarregam ao voltar da grade.
 */
export function TurmasScreen({ navigation }: DadosStackScreenProps<'Turmas'>): React.JSX.Element {
  const { colors, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, minHitSlop), [colors, fonts, minHitSlop]);
  const { overview, loading, error, reload } = useGroupsOverview();

  const [folhaDeNome, setFolhaDeNome] = useState<FolhaDeNome>(null);
  const [nome, setNome] = useState('');
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [turmaAExcluir, setTurmaAExcluir] = useState<GroupRow | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const ativas = useMemo(() => overview.filter((item) => item.group.archived_at === null), [overview]);
  const arquivadas = useMemo(() => overview.filter((item) => item.group.archived_at !== null), [overview]);

  const destinosParaExclusao = useMemo(
    () => ativas.map((item) => item.group).filter((turma) => turma.id !== turmaAExcluir?.id),
    [ativas, turmaAExcluir],
  );

  const abrirCriacao = useCallback(() => {
    setNome('');
    setErroDoNome(null);
    setFolhaDeNome({ modo: 'criar' });
  }, []);

  const abrirRenomear = useCallback((turma: GroupRow) => {
    setNome(turma.name);
    setErroDoNome(null);
    setFolhaDeNome({ modo: 'renomear', turma });
  }, []);

  const fecharFolhaDeNome = useCallback(() => {
    if (!salvandoNome) setFolhaDeNome(null);
  }, [salvandoNome]);

  const salvarNome = useCallback(async () => {
    if (folhaDeNome === null) return;
    if (nome.trim().length < NOME_MINIMO) {
      setErroDoNome('Informe um nome com pelo menos 2 letras.');
      return;
    }
    setSalvandoNome(true);
    setErroDoNome(null);
    try {
      if (folhaDeNome.modo === 'criar') {
        await createGroup(nome);
      } else {
        await renameGroup(folhaDeNome.turma.id, nome);
      }
      setFolhaDeNome(null);
      await reload();
    } catch (falha) {
      log.error('Falha ao salvar o nome da turma', falha);
      setErroDoNome(describeError(falha));
    } finally {
      setSalvandoNome(false);
    }
  }, [folhaDeNome, nome, reload]);

  const abrirGrade = useCallback(
    (turma: GroupRow) => navigation.navigate('GradeTurma', { groupId: turma.id, groupName: turma.name }),
    [navigation],
  );

  const aoExcluir = useCallback(
    (resultado: GroupRemovalResult) => {
      const nomeDaTurma = turmaAExcluir?.name ?? 'A turma';
      setTurmaAExcluir(null);
      void reload();
      const detalhes = [
        resultado.movedStudents > 0 ? `${contagem(resultado.movedStudents, 'aluno mudou', 'alunos mudaram')} de turma.` : null,
        resultado.removedClasses > 0 ? `${contagem(resultado.removedClasses, 'aula futura saiu', 'aulas futuras saíram')} da agenda.` : null,
      ].filter((linha): linha is string => linha !== null);
      Alert.alert(
        resultado.action === 'apagada' ? 'Turma excluída' : 'Turma arquivada',
        [
          resultado.action === 'apagada'
            ? `${nomeDaTurma} foi apagada.`
            : `${nomeDaTurma} foi arquivada. O histórico continua guardado.`,
          ...detalhes,
        ].join(' '),
      );
    },
    [turmaAExcluir, reload],
  );

  const reativar = useCallback(
    (turma: GroupRow) => {
      Alert.alert(
        'Reativar turma?',
        `${turma.name} volta aos seletores e a aceitar alunos e aulas. Os horários encerrados continuam encerrados: ajuste a grade depois.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Reativar',
            onPress: () => {
              reactivateGroup(turma.id)
                .then(() => reload())
                .catch((falha: unknown) => {
                  log.error('Falha ao reativar a turma', falha);
                  Alert.alert('Não foi possível reativar', describeError(falha));
                });
            },
          },
        ],
      );
    },
    [reload],
  );

  const renderAtiva = useCallback<ListRenderItem<GroupOverview>>(
    ({ item }) => (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <AppText variant="subtitle" numberOfLines={1} style={styles.cardName}>
            {item.group.name}
          </AppText>
          <View style={styles.cardActions}>
            <Pressable
              onPress={() => abrirRenomear(item.group)}
              hitSlop={HIT_SLOP}
              style={styles.iconAction}
              accessibilityRole="button"
              accessibilityLabel={`Renomear turma ${item.group.name}`}
            >
              <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setTurmaAExcluir(item.group)}
              hitSlop={HIT_SLOP}
              style={styles.iconAction}
              accessibilityRole="button"
              accessibilityLabel={`Excluir turma ${item.group.name}`}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.cardMeta}>
          {contagem(item.studentCount, 'aluno', 'alunos')} · {contagem(item.activeScheduleCount, 'horário', 'horários')}
        </Text>
        <Pressable
          onPress={() => abrirGrade(item.group)}
          style={styles.gradeLink}
          accessibilityRole="button"
          accessibilityLabel={`Grade semanal da turma ${item.group.name}`}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primaryText} />
          <Text style={styles.gradeLinkText}>Grade semanal</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryText} />
        </Pressable>
      </View>
    ),
    [styles, colors, abrirRenomear, abrirGrade],
  );

  const cabecalho = useMemo(
    () => (
      <View style={styles.header}>
        <Button title="Nova turma" onPress={abrirCriacao} />
        {ativas.length > 0 ? (
          <Text style={styles.sectionLabel}>
            {ativas.length === 1 ? '1 TURMA ATIVA' : `${ativas.length} TURMAS ATIVAS`}
          </Text>
        ) : null}
      </View>
    ),
    [styles, abrirCriacao, ativas.length],
  );

  const rodape = useMemo(
    () =>
      arquivadas.length === 0 ? null : (
        <View style={styles.footer}>
          <Pressable
            onPress={() => setMostrarArquivadas((atual) => !atual)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: mostrarArquivadas }}
            accessibilityLabel={`Turmas arquivadas, ${arquivadas.length}`}
          >
            <Text style={styles.sectionLabelInline}>ARQUIVADAS ({arquivadas.length})</Text>
            <Ionicons
              name={mostrarArquivadas ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
          {mostrarArquivadas
            ? arquivadas.map((item) => (
                <View key={item.group.id} style={[styles.card, styles.cardArchived]}>
                  <View style={styles.cardTop}>
                    <AppText variant="body" numberOfLines={1} style={styles.cardName}>
                      {item.group.name}
                    </AppText>
                    <Pressable
                      onPress={() => reativar(item.group)}
                      style={styles.textAction}
                      accessibilityRole="button"
                      accessibilityLabel={`Reativar turma ${item.group.name}`}
                    >
                      <Text style={styles.textActionLabel}>Reativar</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            : null}
        </View>
      ),
    [arquivadas, styles, colors.textSecondary, mostrarArquivadas, reativar],
  );

  // Erro antes de lista: vazia por falha de rede diria "nenhuma turma".
  if (error !== null && overview.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  if (loading && overview.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando turmas" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={ativas}
        keyExtractor={keyExtractor}
        renderItem={renderAtiva}
        removeClippedSubviews
        ListHeaderComponent={cabecalho}
        ListFooterComponent={rodape}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Nenhuma turma ativa"
            message="Crie a primeira turma para montar a grade semanal."
          />
        }
      />

      <BottomSheet visible={folhaDeNome !== null} onClose={fecharFolhaDeNome}>
        <AppText variant="subtitle">
          {folhaDeNome?.modo === 'renomear' ? 'Renomear turma' : 'Nova turma'}
        </AppText>
        <Input
          label="Nome da turma"
          placeholder="Turma Noite"
          value={nome}
          onChangeText={setNome}
          error={erroDoNome ?? undefined}
          autoFocus
          maxLength={60}
        />
        {folhaDeNome?.modo === 'renomear' ? (
          <AppText variant="caption" color={colors.textSecondary}>
            O novo nome aparece em todas as aulas e frequências da turma, inclusive as antigas.
          </AppText>
        ) : null}
        <Button
          title={folhaDeNome?.modo === 'renomear' ? 'Salvar nome' : 'Criar turma'}
          onPress={() => void salvarNome()}
          loading={salvandoNome}
        />
        <Button title="Cancelar" variant="secondary" onPress={fecharFolhaDeNome} disabled={salvandoNome} />
      </BottomSheet>

      <ExcluirTurmaSheet
        turma={turmaAExcluir}
        destinos={destinosParaExclusao}
        onClose={() => setTurmaAExcluir(null)}
        onExcluida={aoExcluir}
      />
    </ScreenWrapper>
  );
}

const keyExtractor = (item: GroupOverview): string => item.group.id;

function makeStyles(colors: ColorScheme, fonts: Fonts, minHitSlop: number) {
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
    header: {
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
    sectionLabelInline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    cardArchived: {
      paddingVertical: 6,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
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
    cardMeta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    iconAction: {
      minWidth: minHitSlop,
      minHeight: minHitSlop,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradeLink: {
      minHeight: minHitSlop,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    gradeLinkText: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.primaryText,
    },
    footer: {
      marginTop: 12,
    },
    toggle: {
      minHeight: minHitSlop,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    textAction: {
      minHeight: minHitSlop,
      paddingHorizontal: 8,
      justifyContent: 'center',
    },
    textActionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.primaryText,
    },
  });
}
