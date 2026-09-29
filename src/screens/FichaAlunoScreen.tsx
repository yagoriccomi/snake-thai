import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { createLogger } from '@/lib/logger';
import {
  fetchHistoricoDoAluno,
  fetchPerfilDoAluno,
  type AulaDoHistorico,
  type FrequenciaDoPerfil,
  type HorarioDaTroca,
  type PerfilDoAluno,
} from '@/services/perfis.service';
import { SCHEDULE_MODE_LABELS } from '@/services/plans.service';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonthIso, isoDateKey } from '@/utils/datetime';
import { diaEHora } from '@/utils/aulasDoAluno';
import { formatarPercentual, textoDeContagem } from '@/utils/frequency';
import { ROTULO_DA_SITUACAO, rotuloDaAulaDoAluno, turmaPorPeriodo } from '@/utils/pessoas';

const log = createLogger('FichaAlunoScreen');

const SCREEN_EDGES = ['bottom'] as const;

/** O histórico da ficha: os últimos 60 dias (o completo fica na tela Frequência). */
const DIAS_DO_HISTORICO = 60;

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

function horario(h: HorarioDaTroca): string {
  return `${DIAS_DA_SEMANA[h.weekday] ?? ''} ${h.startTime.slice(0, 5)}${h.groupName !== null ? ` (${h.groupName})` : ''}`;
}

function frequencia(f: FrequenciaDoPerfil | null): string {
  if (f === null) return '—';
  return `${formatarPercentual(f.percentual)} · ${textoDeContagem(f.feitas, f.esperadas)}`;
}

interface FichaAlunoScreenProps {
  route: { params: { userId: string } };
}

/**
 * A **ficha do aluno** (§ 12, D32): turma por período do mês (D58),
 * modalidade, situação, frequência, trocas permanentes vigentes e o histórico
 * de aulas. O plano e o financeiro chegam só para o admin (o banco decide).
 * Registrada nas abas Dados (Pessoas) e Aulas (toque no nome, na chamada).
 */
export function FichaAlunoScreen({ route }: FichaAlunoScreenProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const navigation = useNavigation();
  const { userId } = route.params;
  const [perfil, setPerfil] = useState<PerfilDoAluno | null>(null);
  const [historico, setHistorico] = useState<AulaDoHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - DIAS_DO_HISTORICO);
      const [dados, aulas] = await Promise.all([
        fetchPerfilDoAluno(userId),
        fetchHistoricoDoAluno(userId, isoDateKey(inicio), isoDateKey(hoje)),
      ]);
      setPerfil(dados);
      setHistorico(aulas);
    } catch (falha) {
      log.error('Falha ao carregar a ficha do aluno', falha, { userId });
      setErro('Não foi possível carregar a ficha.');
    } finally {
      setCarregando(false);
    }
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && perfil === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ActivityIndicator color={colors.primary} style={styles.carregando} accessibilityLabel="Carregando a ficha" />
      </ScreenWrapper>
    );
  }
  if (perfil === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={erro ?? 'Não foi possível carregar a ficha.'} onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }

  const turmas = turmaPorPeriodo(perfil.turmasNoMes, currentMonthIso()) ?? perfil.turma ?? 'Sem turma';
  const cota =
    perfil.cotaOuMeta === null ? null : perfil.modalidade === 'free' ? `cota ${perfil.cotaOuMeta}x` : `meta ${perfil.cotaOuMeta}x`;
  const nome = perfil.nome ?? 'Aluno pendente';

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => void carregar()} tintColor={colors.primary} />}
      >
        <View style={styles.cartao}>
          <View style={styles.topo}>
            <AppText variant="subtitle" style={styles.flex} numberOfLines={2}>
              {nome}
            </AppText>
            <Selo texto={ROTULO_DA_SITUACAO[perfil.situacao]} tom={perfil.situacao === 'trancado' ? 'aviso' : 'destaque'} />
          </View>
          <Text style={styles.linha}>{turmas}</Text>
          <Text style={styles.sub}>
            {[SCHEDULE_MODE_LABELS[perfil.modalidade], cota, perfil.planoNome].filter((parte) => parte !== null).join(' · ')}
          </Text>
          {perfil.naAcademiaDesde !== '' ? (
            <Text style={styles.sub}>{`Na academia desde ${perfil.naAcademiaDesde.slice(8, 10)}/${perfil.naAcademiaDesde.slice(5, 7)}/${perfil.naAcademiaDesde.slice(0, 4)}`}</Text>
          ) : null}
        </View>

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>FREQUÊNCIA</Text>
          <Text style={styles.linha}>{`Semana: ${frequencia(perfil.frequenciaSemana)}`}</Text>
          <Text style={styles.linha}>{`Mês: ${frequencia(perfil.frequenciaMes)}`}</Text>
          <Button
            title="Ver frequência"
            variant="secondary"
            onPress={() =>
              navigation.getParent()?.navigate('Aulas', { screen: 'HistoricoFrequencia', params: { userId, name: nome } })
            }
          />
        </View>

        {perfil.trocasPermanentes.length > 0 ? (
          <View style={styles.cartao}>
            <Text style={styles.rotulo}>TROCAS PERMANENTES</Text>
            {perfil.trocasPermanentes.map((troca) => (
              <Text key={`${troca.desde}-${troca.de.weekday}-${troca.de.startTime}`} style={styles.linha}>
                {`${horario(troca.de)} → ${horario(troca.para)}`}
              </Text>
            ))}
          </View>
        ) : null}

        {perfil.financeiro !== null ? (
          <View style={styles.cartao}>
            <Text style={styles.rotulo}>FINANCEIRO</Text>
            <View style={styles.marcadores}>
              <Selo texto={`${perfil.financeiro.pagas} pagas`} tom="destaque" />
              <Selo texto={`${perfil.financeiro.pagasComAtraso} com atraso`} tom="aviso" />
              <Selo texto={`${perfil.financeiro.inadimplentes} vencidas`} tom="erro" />
              <Selo texto={`${perfil.financeiro.emAberto} em aberto`} tom="neutro" />
            </View>
            <Text style={styles.sub}>
              {perfil.financeiro.mesesNaAcademia === 1 ? '1 mês na academia' : `${perfil.financeiro.mesesNaAcademia} meses na academia`}
            </Text>
          </View>
        ) : null}

        <View style={styles.cartao}>
          <Text style={styles.rotulo}>HISTÓRICO DE AULAS</Text>
          {historico.length === 0 ? (
            <Text style={styles.sub}>Nenhuma aula nos últimos 60 dias.</Text>
          ) : (
            historico.map((aula) => (
              <View key={aula.classId} style={styles.aula}>
                <Text style={[styles.linha, styles.flex]} numberOfLines={1}>
                  {`${diaEHora(aula.dateTime)} · ${aula.title}`}
                </Text>
                <Text style={styles.sub}>{rotuloDaAulaDoAluno(aula)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 12, paddingBottom: 32, gap: 12 },
    carregando: { marginTop: 24 },
    cartao: {
      gap: 6,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    flex: { flex: 1 },
    rotulo: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
    linha: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
    sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
    marcadores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    aula: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
}
