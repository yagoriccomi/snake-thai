import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { OverdueBucketsCard } from '@/components/OverdueBucketsCard';
import { AtRiskStudentRow } from '@/components/PainelStudentRows';
import { RevenueBarChart } from '@/components/RevenueBarChart';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { StatTile } from '@/components/StatTile';
import { ALUNOS_EM_RISCO_VISIVEIS, LIMIAR_RISCO_EVASAO_PERCENT, MESES_DO_GRAFICO } from '@/constants/painel';
import type { Fonts } from '@/constants/theme';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import type { PainelStackScreenProps } from '@/navigation/types';
import type { AlunoEmRisco, PainelResumo } from '@/services/painel.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { formatMonthYear } from '@/utils/datetime';
import { formatarPercentual } from '@/utils/frequency';
import { contagem, percentualRecebido } from '@/utils/painel';

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Painel do administrador: alunos, mês atual, inadimplência, faturamento de 12
 * meses e frequência com os alunos em risco de evasão.
 *
 * Os números vêm prontos do banco (docs/PAINEL.md). Recarrega no foco — dar
 * baixa no Financeiro e voltar já mostra o valor novo — e ao puxar para baixo.
 * Com os dados na tela, uma falha de recarga vira aviso, não tela de erro.
 */
export function PainelScreen({ navigation }: PainelStackScreenProps<'PainelHome'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { dados, loading, error, reload } = useAdminDashboard();
  const [verTodosEmRisco, setVerTodosEmRisco] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const abrirRelatorio = useCallback(() => {
    navigation.navigate('Financeiro', { screen: 'RelatorioInadimplencia', initial: false });
  }, [navigation]);

  const abrirFrequencia = useCallback(
    (aluno: AlunoEmRisco) => {
      navigation.navigate('Aulas', {
        screen: 'HistoricoFrequencia',
        params: { userId: aluno.userId, name: aluno.nome },
        initial: false,
      });
    },
    [navigation],
  );

  if (dados === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        {error !== null ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando o painel" />
          </View>
        )}
      </ScreenWrapper>
    );
  }

  const { resumo, faixas, faturamento, emRisco } = dados;
  const alunosEmRiscoVisiveis = verTodosEmRisco ? emRisco : emRisco.slice(0, ALUNOS_EM_RISCO_VISIVEIS);

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void reload()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.overlineRow}>
            <Text style={styles.overline}>PAINEL</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>ADMIN</Text>
            </View>
          </View>
          <AppText variant="heading">{formatMonthYear(resumo.competencia)}</AppText>
        </View>

        {error !== null ? (
          <View style={styles.aviso} accessibilityLiveRegion="polite">
            <AppText variant="caption" color={colors.error}>
              {error} Os números abaixo podem estar desatualizados.
            </AppText>
            <Button title="Tentar de novo" variant="secondary" onPress={() => void reload()} />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>ALUNOS</Text>
        <View style={styles.grade}>
          <StatTile label="Ativos" value={String(resumo.alunosAtivos)} />
          <StatTile label="Inativos" value={String(resumo.alunosInativos)} hint="matrícula trancada" />
          <StatTile label="Ativos sem plano" value={String(resumo.alunosAtivosSemPlano)} hint="não geram mensalidade" />
          <StatTile label="Saídas no mês" value={String(resumo.saidasNoMes)} />
        </View>

        <Text style={styles.sectionLabel}>MÊS ATUAL</Text>
        <MesAtual resumo={resumo} styles={styles} colors={colors} />

        <Text style={styles.sectionLabel}>INADIMPLÊNCIA</Text>
        <OverdueBucketsCard
          totalCents={resumo.inadimplenciaCents}
          alunos={resumo.alunosInadimplentes}
          faixas={faixas}
          contasEncerradasCents={resumo.inadimplenciaContasEncerradasCents}
          onVerRelatorio={abrirRelatorio}
        />

        <Text style={styles.sectionLabel}>FATURAMENTO · {MESES_DO_GRAFICO} MESES</Text>
        <View style={styles.card}>
          <RevenueBarChart meses={faturamento} />
          <AppText variant="caption" color={colors.textSecondary}>
            Por competência: um pagamento atrasado conta no mês a que a mensalidade se refere.
          </AppText>
        </View>

        <Text style={styles.sectionLabel}>FREQUÊNCIA</Text>
        <View style={styles.grade}>
          <StatTile
            label="Média deste mês"
            value={resumo.frequenciaMediaMes === null ? '—' : formatarPercentual(resumo.frequenciaMediaMes)}
            hint={`de ${contagem(resumo.alunosComAulaNoMes, 'aluno', 'alunos')} com aula`}
          />
          <StatTile
            label={`Média de ${formatMonthYear(resumo.ultimoMesFechado).split(' ')[0]?.toLowerCase() ?? 'mês passado'}`}
            value={resumo.frequenciaMediaUltimoMes === null ? '—' : formatarPercentual(resumo.frequenciaMediaUltimoMes)}
            hint={`de ${contagem(resumo.alunosComAulaUltimoMes, 'aluno', 'alunos')} com aula`}
          />
        </View>

        <Text style={styles.subsectionLabel}>
          Em risco de evasão (abaixo de {LIMIAR_RISCO_EVASAO_PERCENT}%)
        </Text>
        {emRisco.length === 0 ? (
          <View style={styles.card}>
            <AppText variant="body" color={colors.textSecondary}>
              Nenhum aluno abaixo de {LIMIAR_RISCO_EVASAO_PERCENT}% neste mês ou no mês passado.
            </AppText>
          </View>
        ) : (
          <View style={styles.lista}>
            {alunosEmRiscoVisiveis.map((aluno) => (
              <AtRiskStudentRow key={aluno.userId} aluno={aluno} onPress={abrirFrequencia} />
            ))}
            {emRisco.length > ALUNOS_EM_RISCO_VISIVEIS ? (
              <Pressable
                onPress={() => setVerTodosEmRisco((atual) => !atual)}
                style={styles.verTodos}
                accessibilityRole="button"
                accessibilityState={{ expanded: verTodosEmRisco }}
              >
                <Text style={styles.verTodosTexto}>
                  {verTodosEmRisco ? 'Mostrar menos' : `Ver todos (${emRisco.length})`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

interface MesAtualProps {
  resumo: PainelResumo;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}

/** Recebido x esperado da competência, com barra de progresso e o restante por situação. */
function MesAtual({ resumo, styles, colors }: MesAtualProps): React.JSX.Element {
  const percentual = percentualRecebido(resumo.recebidoCents, resumo.esperadoCents);
  return (
    <View style={styles.card}>
      <View
        accessible
        accessibilityLabel={`Recebido ${formatCents(resumo.recebidoCents)} de ${formatCents(resumo.esperadoCents)} esperados${percentual === null ? '' : `, ${percentual}%`}`}
      >
        <Text style={styles.recebido}>{formatCents(resumo.recebidoCents)}</Text>
        <Text style={styles.deEsperado}>
          recebido de {formatCents(resumo.esperadoCents)}
          {percentual === null ? '' : ` · ${percentual}%`}
        </Text>
        <View style={styles.trilho}>
          <View style={[styles.progresso, { width: `${percentual ?? 0}%` }]} />
        </View>
      </View>
      <Linha rotulo="Em análise" valor={resumo.emAnaliseCents} styles={styles} />
      <Linha rotulo="Em aberto" valor={resumo.emAbertoCents} styles={styles} />
      <Linha rotulo="Vencidas" valor={resumo.vencidoCents} styles={styles} cor={colors.error} />
      <AppText variant="caption" color={colors.textSecondary}>
        {resumo.mensalidadesPagas} de {contagem(resumo.mensalidadesTotal, 'mensalidade paga', 'mensalidades pagas')}
      </AppText>
    </View>
  );
}

function Linha({
  rotulo,
  valor,
  styles,
  cor,
}: {
  rotulo: string;
  valor: number;
  styles: ReturnType<typeof makeStyles>;
  cor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.linha} accessible accessibilityLabel={`${rotulo}: ${formatCents(valor)}`}>
      <Text style={styles.linhaRotulo}>{rotulo}</Text>
      <Text style={[styles.linhaValor, cor !== undefined && valor > 0 ? { color: cor } : null]}>{formatCents(valor)}</Text>
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingTop: 12,
      paddingBottom: 32,
    },
    header: {
      marginBottom: 4,
    },
    overlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3,
    },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    roleChip: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    roleChipText: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.primaryText,
    },
    aviso: {
      gap: 8,
      marginTop: 8,
    },
    sectionLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 24,
      marginBottom: 8,
      marginLeft: 4,
    },
    subsectionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 8,
      marginLeft: 4,
    },
    grade: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 8,
    },
    recebido: {
      fontFamily: fonts.bodyBold,
      fontSize: 26,
      fontVariant: ['tabular-nums'],
      color: colors.primaryText,
    },
    deEsperado: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    trilho: {
      height: 8,
      borderRadius: 4,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      overflow: 'hidden',
    },
    progresso: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    linha: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    linhaRotulo: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
    },
    linhaValor: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    lista: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    verTodos: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    verTodosTexto: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.primaryText,
    },
  });
}
