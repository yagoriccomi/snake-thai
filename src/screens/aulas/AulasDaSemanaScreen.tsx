import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AulaDoAlunoRow } from '@/components/AulaDoAlunoRow';
import { AvisoAcimaDaCota } from '@/components/AvisoAcimaDaCota';
import { ErrorState } from '@/components/ErrorState';
import { JustificationSheet } from '@/components/JustificationSheet';
import { ResumoDaSemanaCard } from '@/components/ResumoDaSemanaCard';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { useAuth } from '@/context/AuthProvider';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useAcoesDaAula } from '@/hooks/useAcoesDaAula';
import { useMenuDeAulas } from '@/hooks/useAulasDoAluno';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AulaDoAluno } from '@/services/aulas.service';
import { useTheme } from '@/theme/ThemeProvider';
import { resumoDaSemana, segundaDaSemana } from '@/utils/aulasDoAluno';
import { formatDayMonth, formatWeekday } from '@/utils/datetime';
import { DIAS_DE_AULA_PADRAO } from '@/utils/diasDeAula';

const SCREEN_EDGES = ['bottom'] as const;

type QualSemana = 'esta' | 'proxima';

const OPCOES_DE_SEMANA: ReadonlyArray<SegmentOption<QualSemana>> = [
  { value: 'esta', label: 'Esta semana' },
  { value: 'proxima', label: 'Próxima semana' },
];

export const TEXTOS_DO_MENU = {
  extraDoFixo:
    'Vou (extra): aula a mais, sem pedir a ninguém, em qualquer aula. Conta acima de 100% e, se você não for, não vira falta.',
  rodape: 'Os dias que já passaram aparecem para você conferir. Marcar é intenção: a presença vale pela chamada do professor.',
  diaVazio: 'Nenhuma aula neste dia.',
} as const;

interface BlocoDoDia {
  title: string;
  data: AulaDoAluno[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dataLocalIso(data: Date): string {
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

/**
 * Os blocos da semana: um por dia de aula configurado (`class_weekdays`) e
 * mais qualquer dia que tenha aula (§ 12.2: "aula num dia não configurado
 * aparece no dia dela").
 */
function blocosDaSemana(segunda: Date, aulas: readonly AulaDoAluno[], diasDeAula: readonly number[]): BlocoDoDia[] {
  const hoje = dataLocalIso(new Date());
  const blocos: BlocoDoDia[] = [];
  for (let deslocamento = 0; deslocamento < 7; deslocamento += 1) {
    const dia = new Date(segunda);
    dia.setDate(segunda.getDate() + deslocamento);
    const chave = dataLocalIso(dia);
    const doDia = aulas.filter((aula) => dataLocalIso(new Date(aula.date_time)) === chave);
    if (doDia.length === 0 && !diasDeAula.includes(dia.getDay())) continue;
    const iso = dia.toISOString();
    const rotulo = `${formatWeekday(iso)} ${formatDayMonth(iso)}`.toUpperCase();
    blocos.push({ title: chave < hoje ? `${rotulo} · JÁ PASSOU` : rotulo, data: doDia });
  }
  return blocos;
}

/**
 * **Aulas da semana** (contrato § 12.2, mockups da linha G): esta semana e a
 * próxima, um bloco por dia de aula, a mesma tela para livre, à vontade e fixo.
 * As ações de troca (**Trocar para esta**, **Desistir da troca**) chegam no
 * bloco 4.9b; as colunas já vêm do banco.
 */
export function AulasDaSemanaScreen(_props: AulasStackScreenProps<'AulasDaSemana'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session } = useAuth();
  const { settings } = useAcademySettings();
  const [qual, setQual] = useState<QualSemana>('esta');

  const segunda = useMemo(() => {
    const inicio = segundaDaSemana(new Date());
    if (qual === 'proxima') inicio.setDate(inicio.getDate() + 7);
    return inicio;
  }, [qual]);

  const { aulas, carregando, erro, erroDaAcao, declarando, recarregar, declarar } = useMenuDeAulas(
    dataLocalIso(segunda),
  );
  const acoes = useAcoesDaAula({ userId: session?.user.id ?? null, declarar, recarregar });
  const diasDeAula = settings?.class_weekdays ?? DIAS_DE_AULA_PADRAO;
  const blocos = useMemo(() => blocosDaSemana(segunda, aulas, diasDeAula), [segunda, aulas, diasDeAula]);
  const resumo = useMemo(() => resumoDaSemana(aulas), [aulas]);

  const { onVou, onNaoVou, onDesmarcar } = acoes;
  const renderItem = useCallback(
    ({ item }: { item: AulaDoAluno }) => (
      <AulaDoAlunoRow
        aula={item}
        noMenu
        ocupada={declarando === item.class_id}
        onVou={(aula) => void onVou(aula)}
        onNaoVou={(aula) => void onNaoVou(aula)}
        onDesmarcar={(aula) => void onDesmarcar(aula)}
      />
    ),
    [declarando, onVou, onNaoVou, onDesmarcar],
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.abas}>
        <SegmentedControl options={OPCOES_DE_SEMANA} value={qual} onChange={setQual} />
      </View>

      {erro !== null && aulas.length === 0 ? (
        <ErrorState message={erro} onRetry={() => void recarregar()} />
      ) : carregando && aulas.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Carregando as aulas da semana" />
        </View>
      ) : (
        <SectionList
          sections={blocos}
          keyExtractor={(item) => item.class_id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View>
              <Text style={styles.dia}>{section.title}</Text>
              {section.data.length === 0 ? <Text style={styles.vazio}>{TEXTOS_DO_MENU.diaVazio}</Text> : null}
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => void recarregar()} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              {resumo !== null && resumo.modo === 'fixed' ? (
                <AppText variant="caption" color={colors.textSecondary} style={styles.dica}>
                  {TEXTOS_DO_MENU.extraDoFixo}
                </AppText>
              ) : resumo !== null ? (
                <ResumoDaSemanaCard resumo={resumo} />
              ) : null}
              {erroDaAcao !== null ? (
                <AppText variant="caption" color={colors.error} accessibilityRole="alert" style={styles.dica}>
                  {erroDaAcao}
                </AppText>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <AppText variant="caption" color={colors.textSecondary} style={styles.dica}>
              {TEXTOS_DO_MENU.rodape}
            </AppText>
          }
        />
      )}

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
    </ScreenWrapper>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    abas: { paddingTop: 12, paddingBottom: 4 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingBottom: 120, flexGrow: 1 },
    dia: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 2,
    },
    vazio: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, paddingVertical: 8 },
    dica: { marginTop: 12 },
  });
}
