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
import { RollCallDraftNotice } from '@/components/RollCallDraftNotice';
import { RollCallRow } from '@/components/RollCallRow';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useClassAttendance } from '@/hooks/useClassAttendance';
import { useMonthlyFrequency } from '@/hooks/useMonthlyFrequency';
import { useRollCallDraft } from '@/hooks/useRollCallDraft';
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
import { contarMarcacoes, houveAlteracao, montarEnvioDaChamada } from '@/utils/rollCall';

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
 * marcações ficam na tela E num rascunho cifrado no aparelho
 * (`useRollCallDraft`): nada vai ao banco até "Concluir chamada", que grava
 * tudo de uma vez (`salvar_chamada`) e conclui a aula. Se o Android fechar o
 * app no meio, a chamada é recuperada ao reabrir.
 *
 * Quem sai com marcações não salvas escolhe entre continuar, descartar ou
 * sair e guardar. Aluno sem marcação vai como falta — a tela diz isso antes
 * de enviar.
 *
 * Sem `canManage` (professor numa aula que não é dele), só leitura.
 */
export function FrequenciaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors } = useTheme();
  const { session } = useAuth();
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

  const [salvando, setSalvando] = useState(false);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const estado = chamada.state;
  const concluida = estado !== null && estado.concludedAt !== null;
  const aulaComecou = estado !== null && Date.parse(estado.dateTimeIso) <= Date.now();
  const editavel = canManage && aulaComecou;

  // Recomeça do que está gravado a cada recarga (abertura e depois de salvar)
  // e recupera o rascunho guardado no aparelho, se houver.
  const rascunhoDaChamada = useRollCallDraft({
    userId: session?.user.id ?? null,
    classId,
    alunoIds: idsDosAlunos,
    gravado: officialByStudent,
    concluidaEm: estado?.concludedAt ?? null,
    ativo: editavel && !loading && erroDaLista === null,
  });
  const { rascunho, descartar, esquecer, usarMeuRascunho } = rascunhoDaChamada;
  const emConflito = rascunhoDaChamada.aviso?.tipo === 'conflito';
  const podeMarcar = editavel && !salvando && rascunhoDaChamada.pronto && !emConflito;

  const contagem = useMemo(
    () => contarMarcacoes(idsDosAlunos, rascunho),
    [idsDosAlunos, rascunho],
  );
  const alterada = useMemo(
    () => houveAlteracao(idsDosAlunos, rascunho, officialByStudent),
    [idsDosAlunos, rascunho, officialByStudent],
  );

  const marcarNoRascunho = rascunhoDaChamada.marcar;
  const marcar = useCallback(
    (userId: string, status: AttendanceStatus) => {
      setAviso(null);
      marcarNoRascunho(userId, status);
    },
    [marcarNoRascunho],
  );

  const salvar = useCallback(async () => {
    setSalvando(true);
    setAviso(null);
    try {
      await save(montarEnvioDaChamada(idsDosAlunos, rascunho));
      // Gravada no banco: o rascunho do aparelho não serve mais.
      await esquecer();
      await Promise.all([reload(), recarregarFrequencia()]);
      setAviso({ texto: 'Chamada salva.', tipo: 'sucesso' });
    } catch (erro) {
      log.error('Falha ao salvar a chamada', erro, { classId });
      setAviso({
        texto:
          'Não foi possível salvar a chamada. Suas marcações continuam na tela e guardadas neste aparelho — tente de novo.',
        tipo: 'erro',
      });
    } finally {
      setSalvando(false);
    }
  }, [save, idsDosAlunos, rascunho, esquecer, reload, recarregarFrequencia, classId]);

  const confirmarDescarte = useCallback(() => {
    Alert.alert('Descartar o rascunho?', 'A lista volta para o que está salvo.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => void descartar() },
    ]);
  }, [descartar]);

  const manterSalvo = useCallback(() => {
    void descartar();
  }, [descartar]);

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

  // Sair com marcações não salvas: continuar, jogar fora ou guardar para depois
  // (o rascunho é gravado quando a tela fecha).
  useEffect(() => {
    if (!alterada || salvando) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', (evento) => {
      evento.preventDefault();
      Alert.alert('Chamada não concluída', 'As marcações ainda não foram salvas no sistema.', [
        { text: 'Continuar marcando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            void descartar().then(() => navigation.dispatch(evento.data.action));
          },
        },
        { text: 'Sair e guardar', onPress: () => navigation.dispatch(evento.data.action) },
      ]);
    });
  }, [navigation, alterada, salvando, descartar]);

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
          editavel={podeMarcar}
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
      podeMarcar,
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
      {rascunhoDaChamada.aviso !== null ? (
        <RollCallDraftNotice
          aviso={rascunhoDaChamada.aviso}
          onDescartar={confirmarDescarte}
          onUsarMeuRascunho={usarMeuRascunho}
          onManterSalvo={manterSalvo}
        />
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
            disabled={(concluida && !alterada) || !rascunhoDaChamada.pronto || emConflito}
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
