import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useGroups } from '@/hooks/useGroups';
import { createLogger } from '@/lib/logger';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import { fetchAllStudents } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('HistoricoPagamentosAlunosScreen');

/** Minúsculas e sem acento: "joão" encontra "Joao". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Primeiro passo do histórico de pagamentos (admin): escolher o aluno. Inclui
 * os inativos — é justamente de quem saiu que costuma faltar averiguar um mês.
 */
export function HistoricoPagamentosAlunosScreen({
  navigation,
}: FinanceiroStackScreenProps<'HistoricoPagamentosAlunos'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { groups } = useGroups();
  const [alunos, setAlunos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlunos(await fetchAllStudents());
    } catch (erro) {
      log.error('Falha ao carregar alunos', erro);
      setError('Não foi possível carregar os alunos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomeDaTurma = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (termo === '') {
      return alunos;
    }
    return alunos.filter((aluno) => normalizar(aluno.name ?? '').includes(termo));
  }, [alunos, busca]);

  const abrir = useCallback(
    (aluno: Profile) => {
      navigation.navigate('HistoricoPagamentosAluno', {
        userId: aluno.id,
        name: aluno.name ?? 'Aluno',
      });
    },
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<Profile>>(
    ({ item }) => {
      const turma =
        item.group_id !== null ? nomeDaTurma.get(item.group_id) ?? 'Turma' : 'Sem turma';
      const detalhe = item.status === 'inactive' ? `${turma} · Inativo` : turma;
      return (
        <Pressable
          onPress={() => abrir(item)}
          style={styles.linha}
          accessibilityRole="button"
          accessibilityLabel={`Histórico de pagamentos de ${item.name ?? 'aluno'}`}
        >
          <View style={styles.linhaTexto}>
            <Text style={styles.nome} numberOfLines={1}>
              {item.name ?? 'Aluno pendente'}
            </Text>
            <Text style={styles.detalhe} numberOfLines={1}>
              {detalhe}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      );
    },
    [styles, colors.textSecondary, nomeDaTurma, abrir],
  );

  if (error !== null && alunos.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <View style={styles.busca}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar aluno"
          placeholderTextColor={colors.textSecondary}
          style={styles.buscaCampo}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar aluno pelo nome"
        />
      </View>
      {loading && alunos.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.carregando} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={15}
          removeClippedSubviews
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Nenhum aluno encontrado"
              message="Confira o nome digitado."
            />
          }
        />
      )}
    </ScreenWrapper>
  );
}

const keyExtractor = (item: Profile): string => item.id;

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    busca: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      marginTop: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    buscaCampo: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
    carregando: { marginTop: 32 },
    conteudo: { paddingTop: 8, paddingBottom: 32, flexGrow: 1 },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linhaTexto: { flex: 1, gap: 2 },
    nome: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    detalhe: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  });
}
