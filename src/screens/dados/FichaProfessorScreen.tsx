import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/ErrorState';
import { MonthSelector, type MonthOption } from '@/components/MonthSelector';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import {
  fetchHistoricoDoProfessor,
  fetchPerfilDoProfessor,
  type AulaDoProfessor,
  type PerfilDoProfessor,
} from '@/services/perfis.service';
import { useTheme } from '@/theme/ThemeProvider';
import { diaEHora } from '@/utils/aulasDoAluno';
import { currentMonthIso, formatMonthShort, formatMonthYear, isoDateKey } from '@/utils/datetime';
import { formatarPercentual } from '@/utils/frequency';
import { rotuloDaAulaDoProfessor } from '@/utils/pessoas';

const log = createLogger('FichaProfessorScreen');

const SCREEN_EDGES = ['bottom'] as const;

/** Os meses que a ficha oferece: o corrente e os 5 anteriores. */
const MESES_NO_SELETOR = 6;

function mesesAnteriores(atual: string, quantos: number): string[] {
  const [ano, mes] = atual.split('-').map(Number) as [number, number];
  return Array.from({ length: quantos }, (_, i) => {
    const data = new Date(ano, mes - 1 - i, 1);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`;
  });
}

function ultimoDia(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number) as [number, number];
  return isoDateKey(new Date(ano, mes, 0));
}

/**
 * A **ficha do professor** (§ 12, D31, T32), só para o admin: o mês com as
 * esperadas, dadas, canceladas, faltas, abonadas e pendentes, o percentual
 * sem teto e as aulas do mês com a situação dele em cada uma.
 */
export function FichaProfessorScreen({ route }: DadosStackScreenProps<'FichaProfessor'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { teacherId, name } = route.params;
  const mesCorrente = currentMonthIso();
  const [mes, setMes] = useState(mesCorrente);
  const [perfil, setPerfil] = useState<PerfilDoProfessor | null>(null);
  const [aulas, setAulas] = useState<AulaDoProfessor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo<MonthOption[]>(
    () =>
      mesesAnteriores(mesCorrente, MESES_NO_SELETOR).map((valor) => ({
        value: valor,
        label: formatMonthShort(valor),
        accessibilityLabel: formatMonthYear(valor),
      })),
    [mesCorrente],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [dados, historico] = await Promise.all([
        fetchPerfilDoProfessor(teacherId, mes),
        fetchHistoricoDoProfessor(teacherId, mes, ultimoDia(mes)),
      ]);
      setPerfil(dados);
      setAulas(historico);
    } catch (falha) {
      log.error('Falha ao carregar a ficha do professor', falha, { teacherId });
      setErro('Não foi possível carregar a ficha.');
    } finally {
      setCarregando(false);
    }
  }, [teacherId, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const numeros: ReadonlyArray<[string, number]> =
    perfil === null
      ? []
      : [
          ['Esperadas', perfil.esperadas],
          ['Dadas', perfil.dadas],
          ['Fora da escala', perfil.dadasForaDaEscala],
          ['Canceladas', perfil.canceladas],
          ['Faltas', perfil.faltas],
          ['Abonadas', perfil.abonadas],
          ['Sem chamada', perfil.pendentes],
        ];

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={<RefreshControl refreshing={carregando && perfil !== null} onRefresh={() => void carregar()} tintColor={colors.primary} />}
      >
        <AppText variant="heading" numberOfLines={1}>
          {name}
        </AppText>
        <MonthSelector options={opcoes} value={mes} onChange={setMes} />
        {carregando && perfil === null ? (
          <ActivityIndicator color={colors.primary} style={styles.carregando} accessibilityLabel="Carregando a ficha" />
        ) : perfil === null ? (
          <ErrorState message={erro ?? 'Não foi possível carregar a ficha.'} onRetry={() => void carregar()} />
        ) : (
          <>
            <View style={styles.cartao} accessible accessibilityLabel={`Percentual do mês: ${formatarPercentual(perfil.percentual)}`}>
              <Text style={styles.rotulo}>DADAS ÷ (ESPERADAS − ABONADAS)</Text>
              <Text style={styles.valor}>{formatarPercentual(perfil.percentual)}</Text>
            </View>
            <View style={styles.grade}>
              {numeros.map(([rotulo, valor]) => (
                <View key={rotulo} style={styles.numero} accessible accessibilityLabel={`${rotulo}: ${valor}`}>
                  <Text style={styles.valorPequeno}>{valor}</Text>
                  <Text style={styles.sub}>{rotulo}</Text>
                </View>
              ))}
            </View>
            <View style={styles.cartao}>
              <Text style={styles.rotulo}>AULAS DO MÊS</Text>
              {aulas.length === 0 ? (
                <Text style={styles.sub}>Nenhuma aula neste mês.</Text>
              ) : (
                aulas.map((aula) => (
                  <View key={aula.classId} style={styles.aula}>
                    <Text style={[styles.linha, styles.flex]} numberOfLines={1}>
                      {`${diaEHora(aula.dateTime)} · ${aula.title}`}
                    </Text>
                    <Text style={styles.sub}>{rotuloDaAulaDoProfessor(aula)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
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
    grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    numero: {
      width: '31%',
      flexGrow: 1,
      gap: 2,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rotulo: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
    valor: { fontFamily: fonts.bodyBold, fontSize: 26, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    valorPequeno: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    linha: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
    sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
    flex: { flex: 1 },
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
