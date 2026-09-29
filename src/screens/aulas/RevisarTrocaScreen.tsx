import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { TEXTO_MAXIMO } from '@/constants/solicitacoes';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import { decidirTroca, fetchTrocasParaDecidir, type TrocaParaDecidir } from '@/services/trocas.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
import { avisoDeFimDoHorario, descricaoDaAulaDaTroca, ROTULO_DO_TIPO } from '@/utils/trocas';

const log = createLogger('RevisarTrocaScreen');

const SCREEN_EDGES = ['bottom'] as const;

type Decisao = 'approved' | 'rejected';

/** A nota da T41: obrigatória para negar e na permanente; opcional para aprovar a avulsa. */
export function precisaDeNota(tipo: TrocaParaDecidir['kind'], decisao: Decisao): boolean {
  return decisao === 'rejected' || tipo === 'permanent';
}

/**
 * **Revisar troca** (§ 9.4, § 3, mockups da linha G), aberta pela caixa de
 * Solicitações: a aula que sai, a que entra, a justificativa da permanente e
 * **Aprovar / Negar** com o Motivo da decisão. A nota fica só para o admin (D16).
 */
export function RevisarTrocaScreen({ navigation, route }: AulasStackScreenProps<'RevisarTroca'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { swapId } = route.params;
  const [troca, setTroca] = useState<TrocaParaDecidir | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDaCarga, setErroDaCarga] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState<Decisao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroDaCarga(null);
    try {
      const pendentes = await fetchTrocasParaDecidir();
      setTroca(pendentes.find((item) => item.id === swapId) ?? null);
    } catch (falha) {
      log.error('Falha ao carregar a troca', falha, { swapId });
      setErroDaCarga('Não foi possível carregar a troca.');
    } finally {
      setCarregando(false);
    }
  }, [swapId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const decidir = async (decisao: Decisao): Promise<void> => {
    setSalvando(decisao);
    setErro(null);
    try {
      await decidirTroca(swapId, decisao, nota);
      navigation.goBack();
    } catch (falha) {
      log.error('Falha ao decidir a troca', falha, { swapId });
      setErro(describeError(falha));
    } finally {
      setSalvando(null);
    }
  };

  if (carregando) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ActivityIndicator color={colors.primary} style={styles.carregando} accessibilityLabel="Carregando a troca" />
      </ScreenWrapper>
    );
  }
  if (erroDaCarga !== null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={erroDaCarga} onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }
  if (troca === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message="Esta troca não está mais pendente, ou não é você quem decide." onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }

  const semNota = nota.trim() === '';

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.cartao}>
          <View style={styles.topo}>
            <AppText variant="subtitle">{troca.studentName ?? 'Aluno'}</AppText>
            <Selo texto={ROTULO_DO_TIPO[troca.kind]} tom="neutro" />
            {troca.isMakeup ? <Selo texto="Reposição" tom="aviso" /> : null}
          </View>
          <Text style={styles.rotulo}>SAI</Text>
          <Text style={styles.linha}>{descricaoDaAulaDaTroca(troca.fromTitle, troca.fromDateTime)}</Text>
          <Text style={styles.rotulo}>ENTRA</Text>
          <Text style={styles.linha}>{descricaoDaAulaDaTroca(troca.toTitle, troca.toDateTime)}</Text>
          {troca.toScheduleEndsOn !== null ? (
            <AppText variant="caption" color={colors.warning}>
              {avisoDeFimDoHorario(troca.toScheduleEndsOn)}
            </AppText>
          ) : null}
        </View>

        {troca.motivoTexto !== null ? (
          <View style={styles.cartao}>
            <Text style={styles.rotulo}>JUSTIFICATIVA</Text>
            <AppText variant="body">{troca.motivoTexto}</AppText>
            {troca.anexos > 0 ? (
              <AppText variant="caption" color={colors.textSecondary}>
                {`${troca.anexos === 1 ? '1 anexo' : `${troca.anexos} anexos`} (abre quando o servidor novo for publicado)`}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <Input
          label={troca.kind === 'permanent' ? 'Motivo da decisão (obrigatório)' : 'Motivo da decisão (obrigatório para negar)'}
          value={nota}
          onChangeText={setNota}
          multiline
          maxLength={TEXTO_MAXIMO}
        />
        {erro !== null ? (
          <AppText variant="caption" color={colors.error} accessibilityRole="alert">
            {erro}
          </AppText>
        ) : null}
        <View style={styles.acoes}>
          <Button
            title="Negar"
            variant="danger"
            onPress={() => void decidir('rejected')}
            loading={salvando === 'rejected'}
            disabled={salvando !== null || (precisaDeNota(troca.kind, 'rejected') && semNota)}
            style={styles.metade}
          />
          <Button
            title="Aprovar"
            onPress={() => void decidir('approved')}
            loading={salvando === 'approved'}
            disabled={salvando !== null || (precisaDeNota(troca.kind, 'approved') && semNota)}
            style={styles.metade}
          />
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
    topo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    rotulo: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary, marginTop: 4 },
    linha: { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
    acoes: { flexDirection: 'row', gap: 12 },
    metade: { flex: 1 },
  });
}
