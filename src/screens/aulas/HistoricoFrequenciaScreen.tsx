import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/ErrorState';
import { JustificarSemanaCard, semanasParaJustificar } from '@/components/JustificarSemanaCard';
import { JustificationSheet, type JustificationDraft } from '@/components/JustificationSheet';
import { MonthSelector, type MonthOption } from '@/components/MonthSelector';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useFrequenciaDoMes } from '@/hooks/useFrequenciaDoMes';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { FrequenciaDoMes, SemanaDoMes } from '@/services/frequency.service';
import { enviarJustificativa } from '@/services/justifications.service';
import { SCHEDULE_MODE_LABELS } from '@/services/plans.service';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonthIso, formatMonthShort, formatMonthYear, isoDateKey } from '@/utils/datetime';
import {
  acumularSemanas,
  avisoDeMesAberto,
  dicaDaConta,
  explicacaoDaSemanaExtra,
  formatarPercentual,
  periodoDaSemana,
  rotulosDaFrequencia,
  textoDeContagem,
  tomDoPercentual,
  type LinhaDaSemana,
  type TomDoPercentual,
} from '@/utils/frequency';

const SCREEN_EDGES = ['bottom'] as const;

type Estilos = ReturnType<typeof makeStyles>;

function estiloDoTom(tom: TomDoPercentual, styles: Estilos) {
  if (tom === 'acima') return styles.acima;
  if (tom === 'abaixo') return styles.abaixo;
  return null;
}

/** "dd/mm" de uma data `AAAA-MM-DD`, lida como texto (sem fuso). */
function diaMes(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

function rodapeDoMes(mes: FrequenciaDoMes): string {
  const contagem = textoDeContagem(mes.attended, mes.expected);
  return mes.isClosed ? `${contagem} · fechou em ${diaMes(mes.closesOn)}` : contagem;
}

interface LinhaProps {
  linha: LinhaDaSemana;
  esperadoDoMes: number;
  styles: Estilos;
}

/** Uma semana da tabela: período, feitas, % da semana e o acumulado do mês. */
function LinhaDaTabela({ linha, esperadoDoMes, styles }: LinhaProps): React.JSX.Element {
  const { semana, feitasAteAqui, percentualAteAqui } = linha;
  const titulo = semana.isSplit ? semana.label : `${semana.label} · ${periodoDaSemana(semana)}`;
  const acumulado = `${textoDeContagem(feitasAteAqui, esperadoDoMes)} · ${formatarPercentual(percentualAteAqui)}`;
  return (
    <View
      style={styles.linha}
      accessible
      accessibilityLabel={
        `${titulo}${semana.isSplit ? `, ${periodoDaSemana(semana)}` : ''}: ` +
        `${textoDeContagem(semana.attendedWeek, semana.expectedWeek)} na semana, ${formatarPercentual(semana.weekPercent)}. ` +
        `No mês, ${acumulado}.`
      }
    >
      <View style={styles.colSemana}>
        <Text style={styles.celula}>{titulo}</Text>
        {semana.isSplit ? <Text style={styles.dica}>{periodoDaSemana(semana)}</Text> : null}
      </View>
      <Text style={[styles.celula, styles.num, styles.colFeitas]}>
        {textoDeContagem(semana.attendedWeek, semana.expectedWeek)}
      </Text>
      <Text style={[styles.celula, styles.num, styles.colPct, estiloDoTom(tomDoPercentual(semana.weekPercent), styles)]}>
        {formatarPercentual(semana.weekPercent)}
      </Text>
      <View style={styles.colMes}>
        <Text style={styles.celula}>{acumulado}</Text>
        {semana.isSplit ? (
          <Text style={styles.dica}>neste mês: {textoDeContagem(semana.attendedInMonth, semana.expectedInMonth)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Frequência de um aluno (contrato § 11 e § 3; mockup "Frequência — semanas e
 * semana extra"): o mês escolhido, cada semana com a parte dela no mês, a
 * Semana extra e o aviso de mês que ainda vai fechar. A conta é toda do
 * banco; a tela só soma as parcelas na ordem para o acumulado. [#6]
 */
export function HistoricoFrequenciaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'HistoricoFrequencia'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { userId, name } = route.params;

  const mesCorrente = currentMonthIso();
  const [mesIso, setMesIso] = useState(mesCorrente);
  const { mes, semanas, historico, loading, error, reload } = useFrequenciaDoMes(userId, mesIso);
  // Justificar é do próprio aluno (§ 9.1 e): a equipe só lê a frequência dele.
  const { profile } = useAuth();
  const proprio = profile?.id === userId;
  const [semanaAJustificar, setSemanaAJustificar] = useState<SemanaDoMes | null>(null);

  const justificarSemana = useCallback(
    async (draft: JustificationDraft): Promise<void> => {
      if (semanaAJustificar === null) return;
      await enviarJustificativa({
        scope: 'week',
        classId: null,
        weekStart: semanaAJustificar.weekStart,
        texto: draft.message,
        anexo: null,
      });
      void reload();
    },
    [semanaAJustificar, reload],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const opcoes = useMemo<MonthOption[]>(() => {
    const meses = new Set<string>([mesCorrente, mesIso, ...historico.map((linha) => linha.reference_month)]);
    return [...meses]
      .sort((a, b) => b.localeCompare(a))
      .map((valor) => ({ value: valor, label: formatMonthShort(valor), accessibilityLabel: formatMonthYear(valor) }));
  }, [historico, mesCorrente, mesIso]);

  const linhas = useMemo(() => acumularSemanas(semanas, mes?.expected ?? 0), [semanas, mes]);
  const semanaExtra = useMemo(() => [...semanas].reverse().find((semana) => semana.isSplit) ?? null, [semanas]);
  const aviso = mes !== null ? avisoDeMesAberto(mes, isoDateKey(new Date())) : null;

  const conteudo = (): React.JSX.Element => {
    if (loading && mes === null) {
      return <ActivityIndicator color={colors.primary} style={styles.carregando} />;
    }
    if (error !== null || mes === null) {
      return <ErrorState message={error ?? 'Não foi possível carregar a frequência.'} onRetry={() => void reload()} />;
    }
    const rotulos = rotulosDaFrequencia(mes.scheduleMode);
    return (
      <>
        <Text style={styles.overline}>
          {formatMonthYear(mes.referenceMonth).toUpperCase()} · {SCHEDULE_MODE_LABELS[mes.scheduleMode].toUpperCase()}
        </Text>

        <View style={styles.cartoes}>
          <View style={styles.cartao} accessible accessibilityLabel={`${rotulos.mes}: ${formatarPercentual(mes.frequencyPercent)}, ${rodapeDoMes(mes)}`}>
            <Text style={styles.rotulo}>{rotulos.mes}</Text>
            <Text style={[styles.valor, tomDoPercentual(mes.frequencyPercent) === 'acima' && styles.acima]}>
              {formatarPercentual(mes.frequencyPercent)}
            </Text>
            <Text style={styles.dica}>{rodapeDoMes(mes)}</Text>
          </View>
          {semanaExtra !== null ? (
            <View
              style={styles.cartao}
              accessible
              accessibilityLabel={`Semana extra: ${formatarPercentual(semanaExtra.weekPercent)}, ${textoDeContagem(semanaExtra.attendedWeek, semanaExtra.expectedWeek)}`}
            >
              <Text style={styles.rotulo}>Semana extra</Text>
              <Text style={[styles.valor, tomDoPercentual(semanaExtra.weekPercent) === 'acima' && styles.acima]}>
                {formatarPercentual(semanaExtra.weekPercent)}
              </Text>
              <Text style={styles.dica}>
                {textoDeContagem(semanaExtra.attendedWeek, semanaExtra.expectedWeek)} · {periodoDaSemana(semanaExtra)}
              </Text>
            </View>
          ) : null}
        </View>

        <View accessibilityRole="list" accessibilityLabel={`Semanas de ${formatMonthYear(mes.referenceMonth)}`}>
          <View style={[styles.linha, styles.linhaCabecalho]} importantForAccessibility="no-hide-descendants">
            <Text style={[styles.cabecalho, styles.colSemana]}>SEMANA</Text>
            <Text style={[styles.cabecalho, styles.colFeitas]}>FEITAS</Text>
            <Text style={[styles.cabecalho, styles.colPct]}>{rotulos.semana.toUpperCase()}</Text>
            <Text style={[styles.cabecalho, styles.colMes]}>NO MÊS (ACUMULADO)</Text>
          </View>
          {linhas.map((linha) => (
            <LinhaDaTabela key={linha.semana.weekStart} linha={linha} esperadoDoMes={mes.expected} styles={styles} />
          ))}
        </View>

        {semanaExtra !== null ? (
          <View style={styles.cartaoTexto}>
            <Text style={styles.overline}>COMO A SEMANA EXTRA SE DIVIDE</Text>
            <AppText variant="caption" color={colors.textSecondary}>
              {explicacaoDaSemanaExtra(mes.scheduleMode)}
            </AppText>
          </View>
        ) : null}

        {aviso !== null ? (
          <View style={styles.aviso} accessibilityRole="alert">
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <AppText variant="caption" style={styles.avisoTexto}>
              {aviso}
            </AppText>
          </View>
        ) : null}

        {proprio && semanasParaJustificar(semanas).length > 0 ? (
          <JustificarSemanaCard
            semanas={semanas}
            onJustificar={setSemanaAJustificar}
          />
        ) : null}

        <Text style={styles.dica}>{dicaDaConta(mes.scheduleMode)}</Text>
      </>
    );
  };

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && mes !== null} onRefresh={() => void reload()} tintColor={colors.primary} />}
      >
        <Text style={styles.overline}>FREQUÊNCIA</Text>
        <AppText variant="heading" numberOfLines={1}>
          {name}
        </AppText>
        <MonthSelector options={opcoes} value={mesIso} onChange={setMesIso} />
        {conteudo()}
        {proprio ? (
          <Pressable
            onPress={() => navigation.navigate('MinhasJustificativas')}
            style={styles.link}
            accessibilityRole="button"
          >
            <Text style={styles.linkTexto}>Minhas justificativas</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {proprio ? (
          <Pressable
            onPress={() => navigation.navigate('MinhasSolicitacoes')}
            style={styles.link}
            accessibilityRole="button"
          >
            <Text style={styles.linkTexto}>Meus pedidos</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {proprio && mes?.scheduleMode === 'fixed' ? (
          <Pressable onPress={() => navigation.navigate('MinhasTrocas')} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkTexto}>Minhas trocas</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </ScrollView>
      {semanaAJustificar !== null ? (
        <JustificationSheet
          key={semanaAJustificar.weekStart}
          visible
          titulo="Justificar semana"
          contexto={`${semanaAJustificar.label} · ${periodoDaSemana(semanaAJustificar)}. Cada justificativa aprovada devolve uma aula.`}
          perguntarSeQuer={false}
          permiteAnexo={false}
          onClose={() => setSemanaAJustificar(null)}
          onSubmit={justificarSemana}
        />
      ) : null}
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 12, paddingBottom: 32, gap: 12, flexGrow: 1 },
    carregando: { marginTop: 24 },
    overline: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
    },
    cartoes: { flexDirection: 'row', gap: 10 },
    cartao: {
      flex: 1,
      gap: 2,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cartaoTexto: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rotulo: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
    valor: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    dica: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    acima: { color: colors.primaryText },
    abaixo: { color: colors.warning },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linhaCabecalho: { paddingTop: 0 },
    cabecalho: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.6, color: colors.textSecondary },
    celula: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textPrimary },
    num: { fontFamily: fonts.bodyBold, fontVariant: ['tabular-nums'] },
    colSemana: { width: 86 },
    colFeitas: { width: 58 },
    colPct: { width: 58 },
    colMes: { flex: 1 },
    aviso: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    avisoTexto: { flex: 1 },
    link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
    linkTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
  });
}
