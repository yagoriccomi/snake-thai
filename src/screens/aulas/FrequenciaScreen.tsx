import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { RollCallRow } from '@/components/RollCallRow';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import { useMonthlyFrequency } from '@/hooks/useMonthlyFrequency';
import { useRollCallReview } from '@/hooks/useRollCallReview';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import type { AttendanceStatus, StudentRef } from '@/services/classes.service';
import {
  fetchJustificationAttachmentUrl,
  type JustificationStatus,
} from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';
import {
  alternarMarcacao,
  contarMarcacoes,
  houveAlteracao,
  montarEnvioDaChamada,
  type RascunhoDeChamada,
} from '@/utils/rollCall';

const SCREEN_EDGES = ['bottom'] as const;

const log = createLogger('FrequenciaScreen');

interface Aviso {
  texto: string;
  tipo: 'erro' | 'sucesso';
}

/**
 * Chamada de uma aula (docs/FREQUENCIA.md).
 *
 * Uma lista só, em ordem alfabética, com os dois símbolos por aluno. As
 * marcações ficam NA TELA: nada vai ao banco até "Concluir chamada", que grava
 * tudo de uma vez (`salvar_chamada`) e conclui a aula. Antes, cada toque
 * gravava e recarregava a lista, que voltava ao topo.
 *
 * Quem sai com marcações não salvas é avisado. Aluno sem marcação vai como
 * falta — a tela diz isso antes de enviar.
 *
 * Sem `canManage` (professor numa aula que não é dele), só leitura.
 */
export function FrequenciaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors } = useTheme();
  const { classId, title, groupId, canManage } = route.params;
  const {
    students,
    officialByStudent,
    declaredByStudent,
    loading,
    error: erroDaLista,
    reload,
  } = useClassAttendance(classId, groupId);
  const chamada = useRollCallReview(classId);
  const { save, review, justificationsByUser } = chamada;

  const idsDosAlunos = useMemo(() => students.map((aluno) => aluno.id), [students]);
  const frequencia = useMonthlyFrequency(idsDosAlunos);
  const recarregarFrequencia = frequencia.reload;

  // Recomeça do que está gravado sempre que a lista é (re)carregada: na
  // abertura e logo depois de salvar.
  const [rascunho, setRascunho] = useState<RascunhoDeChamada>({});
  useEffect(() => {
    setRascunho(officialByStudent);
  }, [officialByStudent]);

  const [salvando, setSalvando] = useState(false);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const estado = chamada.state;
  const concluida = estado !== null && estado.concludedAt !== null;
  const aulaComecou = estado !== null && Date.parse(estado.dateTimeIso) <= Date.now();
  const editavel = canManage && aulaComecou;

  const contagem = useMemo(
    () => contarMarcacoes(idsDosAlunos, rascunho),
    [idsDosAlunos, rascunho],
  );
  const alterada = useMemo(
    () => houveAlteracao(idsDosAlunos, rascunho, officialByStudent),
    [idsDosAlunos, rascunho, officialByStudent],
  );

  const marcar = useCallback((userId: string, status: AttendanceStatus) => {
    setAviso(null);
    setRascunho((anterior) => ({
      ...anterior,
      [userId]: alternarMarcacao(anterior[userId] ?? null, status),
    }));
  }, []);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setAviso(null);
    try {
      await save(montarEnvioDaChamada(idsDosAlunos, rascunho));
      await Promise.all([reload(), recarregarFrequencia()]);
      setAviso({ texto: 'Chamada salva.', tipo: 'sucesso' });
    } catch (erro) {
      log.error('Falha ao salvar a chamada', erro, { classId });
      setAviso({
        texto: 'Não foi possível salvar a chamada. Suas marcações continuam na tela — tente de novo.',
        tipo: 'erro',
      });
    } finally {
      setSalvando(false);
    }
  }, [save, idsDosAlunos, rascunho, reload, recarregarFrequencia, classId]);

  const handleConcluir = useCallback(() => {
    const faltas = contagem.ausentes + contagem.semMarcacao;
    const semMarcacao =
      contagem.semMarcacao > 0
        ? `\n\n${contagem.semMarcacao} aluno(s) sem marcação serão registrados como falta.`
        : '';
    Alert.alert(
      concluida ? 'Salvar alterações' : 'Concluir chamada',
      `Serão registradas ${contagem.presentes} presença(s) e ${faltas} falta(s).${semMarcacao}`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: concluida ? 'Salvar' : 'Concluir', onPress: () => void salvar() },
      ],
    );
  }, [contagem, concluida, salvar]);

  // Sair com marcações não salvas perderia a chamada em silêncio.
  useEffect(() => {
    if (!alterada || salvando) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', (evento) => {
      evento.preventDefault();
      Alert.alert('Descartar a chamada?', 'As marcações feitas ainda não foram salvas.', [
        { text: 'Continuar marcando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => navigation.dispatch(evento.data.action),
        },
      ]);
    });
  }, [navigation, alterada, salvando]);

  const revisar = useCallback(
    (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => {
      void (async () => {
        setRevisandoId(justificationId);
        setAviso(null);
        try {
          await review(justificationId, status);
          await recarregarFrequencia();
        } catch (erro) {
          log.error('Falha ao revisar justificativa', erro, { classId });
          setAviso({ texto: 'Não foi possível registrar a revisão. Tente de novo.', tipo: 'erro' });
        } finally {
          setRevisandoId(null);
        }
      })();
    },
    [review, recarregarFrequencia, classId],
  );

  const abrirAnexo = useCallback(
    (justificationId: string) => {
      void (async () => {
        setAviso(null);
        try {
          const anexo = await fetchJustificationAttachmentUrl(justificationId);
          await Linking.openURL(anexo.url);
        } catch (erro) {
          log.error('Falha ao abrir anexo da justificativa', erro, { classId });
          setAviso({ texto: 'Não foi possível abrir o anexo. Tente de novo.', tipo: 'erro' });
        }
      })();
    },
    [classId],
  );

  const abrirHistorico = useCallback(
    (aluno: StudentRef) => {
      navigation.navigate('HistoricoFrequencia', {
        userId: aluno.id,
        name: aluno.name ?? 'Aluno',
      });
    },
    [navigation],
  );

  const renderItem = useCallback<ListRenderItem<StudentRef>>(
    ({ item }) => {
      const justificativa = justificationsByUser[item.id];
      return (
        <RollCallRow
          student={item}
          marcacao={rascunho[item.id] ?? null}
          declarado={declaredByStudent[item.id]}
          frequencia={frequencia.byUser[item.id]}
          justificativa={justificativa}
          editavel={editavel && !salvando}
          podeRevisar={canManage}
          revisando={justificativa !== undefined && revisandoId === justificativa.id}
          onMarcar={marcar}
          onAbrirHistorico={abrirHistorico}
          onRevisar={revisar}
          onAbrirAnexo={abrirAnexo}
        />
      );
    },
    [
      rascunho,
      declaredByStudent,
      frequencia.byUser,
      justificationsByUser,
      editavel,
      salvando,
      canManage,
      revisandoId,
      marcar,
      abrirHistorico,
      revisar,
      abrirAnexo,
    ],
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

  if (erroDaLista !== null && students.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={erroDaLista} onRetry={() => void reload()} />
      </ScreenWrapper>
    );
  }

  const cabecalho = (
    <View style={styles.cabecalho}>
      <AppText variant="heading" style={styles.title} numberOfLines={2}>
        {title}
      </AppText>
      {!canManage ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Você está vendo esta aula, mas só os professores dela podem fazer a chamada.
        </AppText>
      ) : null}
      {concluida && estado?.concludedAt ? (
        <View style={styles.concluida}>
          <Ionicons name="checkmark-done" size={18} color={colors.success} />
          <AppText variant="caption" color={colors.success}>
            Chamada concluída · {formatFullDateTime(estado.concludedAt)}
          </AppText>
        </View>
      ) : null}
      {canManage && estado !== null && !aulaComecou ? (
        <AppText variant="caption" color={colors.textSecondary}>
          As marcações ficam liberadas quando a aula começar.
        </AppText>
      ) : null}
      {estado?.type === 'event' ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Eventos não contam na frequência.
        </AppText>
      ) : null}
      <AppText variant="caption" color={colors.textSecondary} style={styles.contagem}>
        Presentes {contagem.presentes} · Faltas {contagem.ausentes} · Sem marcação{' '}
        {contagem.semMarcacao}
      </AppText>
      {aviso !== null || chamada.error !== null ? (
        <AppText
          variant="caption"
          color={aviso?.tipo === 'sucesso' ? colors.success : colors.error}
          accessibilityLiveRegion="polite"
        >
          {aviso?.texto ?? chamada.error}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <FlatList
        data={students}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        windowSize={11}
      />
      {editavel ? (
        <View style={[styles.rodape, { borderTopColor: colors.border }]}>
          {alterada ? (
            <AppText variant="caption" color={colors.warning} style={styles.naoSalvo}>
              Marcações ainda não salvas
            </AppText>
          ) : null}
          <Button
            title={concluida ? 'Salvar alterações' : 'Concluir chamada'}
            onPress={handleConcluir}
            loading={salvando}
            disabled={concluida && !alterada}
            accessibilityHint="Grava a chamada de todos os alunos de uma vez"
          />
        </View>
      ) : null}
    </ScreenWrapper>
  );
}

const keyExtractor = (item: StudentRef): string => item.id;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cabecalho: {
    gap: 6,
    paddingBottom: 8,
  },
  title: {
    marginTop: 12,
  },
  concluida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contagem: {
    marginTop: 4,
  },
  rodape: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  naoSalvo: {
    textAlign: 'center',
    marginBottom: 6,
  },
});
