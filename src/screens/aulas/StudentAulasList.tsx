import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { AulaDoAlunoRow } from '@/components/AulaDoAlunoRow';
import { AvisoAcimaDaCota } from '@/components/AvisoAcimaDaCota';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { FrequencyCard } from '@/components/FrequencyCard';
import { JustificationSheet } from '@/components/JustificationSheet';
import { MetaSemanalSheet } from '@/components/MetaSemanalSheet';
import { ResumoDaSemanaCard } from '@/components/ResumoDaSemanaCard';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useAcoesDaAula } from '@/hooks/useAcoesDaAula';
import { useAulasDoAluno } from '@/hooks/useAulasDoAluno';
import { useFrequenciaDoAluno } from '@/hooks/useFrequenciaDoAluno';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AulaDoAluno } from '@/services/aulas.service';
import { useTheme } from '@/theme/ThemeProvider';
import { resumoDaSemana, segundaDaSemana } from '@/utils/aulasDoAluno';
import { formatDayMonth, formatWeekday } from '@/utils/datetime';

const SCREEN_EDGES = ['bottom'] as const;

/** Uma seção da agenda: as aulas de um mesmo dia. */
interface DaySection {
  title: string;
  data: AulaDoAluno[];
}

/** Chave local (ano-mês-dia) de uma data, para agrupar sem confundir fuso. */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Rótulo do dia: HOJE / AMANHÃ / dia da semana + data. */
function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const suffix = `${formatWeekday(iso)} ${formatDayMonth(iso)}`.toUpperCase();
  if (localDayKey(day) === localDayKey(today)) return `HOJE · ${suffix}`;
  if (localDayKey(day) === localDayKey(tomorrow)) return `AMANHÃ · ${suffix}`;
  return suffix;
}

/** Aulas da semana corrente (segunda a domingo, pelo calendário do aparelho). */
function daSemanaAtual(aulas: readonly AulaDoAluno[]): AulaDoAluno[] {
  const inicio = segundaDaSemana(new Date()).getTime();
  const fim = inicio + 7 * 24 * 60 * 60 * 1000;
  return aulas.filter((aula) => {
    const quando = new Date(aula.date_time).getTime();
    return quando >= inicio && quando < fim;
  });
}

interface StudentAulasListProps {
  navigation: AulasStackScreenProps<'AulasHome'>['navigation'];
}

/**
 * Aulas do aluno (contrato § 12, mockups da linha B), para as três modalidades.
 * Tudo sai das colunas de `aulas_do_aluno`: o livre marca **Vou** até acima da
 * cota (com aviso), o à vontade acompanha a meta, o fixo responde **Vou / Não
 * vou** nas aulas dele e vê as extras e as trocas. **Escolher aulas** abre o
 * menu da semana.
 */
export function StudentAulasList({ navigation }: StudentAulasListProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, profile } = useAuth();
  const { aulas, carregando, erro, erroDaAcao, declarando, recarregar, declarar } = useAulasDoAluno();
  const userId = session?.user.id ?? null;
  const acoes = useAcoesDaAula({ userId, declarar, recarregar });
  const [mudandoMeta, setMudandoMeta] = useState(false);

  const frequencia = useFrequenciaDoAluno(userId);
  const recarregarFrequencia = frequencia.reload;

  // Volta do menu de aulas ou da chamada: as colunas podem ter mudado.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        void recarregar();
      }),
    [navigation, recarregar],
  );

  const resumo = useMemo(() => resumoDaSemana(daSemanaAtual(aulas)), [aulas]);

  const sections = useMemo<DaySection[]>(() => {
    const result: DaySection[] = [];
    let currentKey: string | null = null;
    for (const aula of aulas) {
      const key = localDayKey(new Date(aula.date_time));
      if (key !== currentKey) {
        currentKey = key;
        result.push({ title: dayLabel(aula.date_time), data: [aula] });
      } else {
        result[result.length - 1]?.data.push(aula);
      }
    }
    return result;
  }, [aulas]);

  const abrirHistorico = useCallback(() => {
    if (userId === null) return;
    navigation.navigate('HistoricoFrequencia', { userId, name: profile?.name ?? 'Minha frequência' });
  }, [navigation, userId, profile]);

  const abrirMenu = useCallback(() => navigation.navigate('AulasDaSemana'), [navigation]);

  const handleRefresh = useCallback(() => {
    void recarregar();
    void recarregarFrequencia();
  }, [recarregar, recarregarFrequencia]);

  const { onVou, onNaoVou, onDesmarcar } = acoes;
  const renderItem = useCallback(
    ({ item }: { item: AulaDoAluno }) => (
      <AulaDoAlunoRow
        aula={item}
        noMenu={false}
        ocupada={declarando === item.class_id}
        onVou={(aula) => void onVou(aula)}
        onNaoVou={(aula) => void onNaoVou(aula)}
        onDesmarcar={(aula) => void onDesmarcar(aula)}
      />
    ),
    [declarando, onVou, onNaoVou, onDesmarcar],
  );

  if (erro !== null && aulas.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={erro} onRetry={() => void recarregar()} />
      </ScreenWrapper>
    );
  }

  if (carregando && aulas.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando as aulas" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.class_id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => <Text style={styles.dayHeader}>{section.title}</Text>}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.overline}>MINHAS AULAS</Text>
            <FrequencyCard
              semana={frequencia.semana}
              mes={frequencia.mes}
              loading={frequencia.loading}
              error={frequencia.error}
              onPress={abrirHistorico}
            />
            {resumo !== null ? (
              <ResumoDaSemanaCard resumo={resumo} onMudarMeta={() => setMudandoMeta(true)} />
            ) : null}
            <Pressable
              onPress={abrirMenu}
              style={styles.menu}
              accessibilityRole="button"
              accessibilityLabel="Escolher aulas"
              accessibilityHint="Abre as aulas desta semana e da próxima"
            >
              <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
              <Text style={styles.menuTexto}>Escolher aulas</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
            {erroDaAcao !== null ? (
              <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.error}>
                {erroDaAcao}
              </AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma aula por aqui"
            message="Toque em Escolher aulas para ver as aulas desta semana e da próxima."
          />
        }
      />
      {acoes.aviso !== null ? (
        <AvisoAcimaDaCota
          marcadas={acoes.aviso.marcadas}
          cota={acoes.aviso.cota}
          onDesfazer={() => void acoes.desfazerAviso()}
          onFechar={acoes.fecharAviso}
        />
      ) : null}
      {acoes.aulaDaFalta !== null ? (
        <JustificationSheet
          key={acoes.aulaDaFalta.class_id}
          visible
          classTitle={acoes.aulaDaFalta.title}
          onClose={acoes.fecharFalta}
          onSubmit={acoes.enviarJustificativa}
        />
      ) : null}
      {mudandoMeta && resumo !== null && resumo.alvo !== null ? (
        <MetaSemanalSheet
          visible
          metaAtual={resumo.alvo}
          onClose={() => setMudandoMeta(false)}
          onSalva={() => void recarregar()}
        />
      ) : null}
    </ScreenWrapper>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { paddingTop: 12, paddingBottom: 6 },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    menu: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 14,
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    menuTexto: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    error: { marginTop: 8 },
    content: { paddingBottom: 120, flexGrow: 1 },
    dayHeader: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.textSecondary,
      marginTop: 14,
      marginBottom: 2,
    },
  });
}
