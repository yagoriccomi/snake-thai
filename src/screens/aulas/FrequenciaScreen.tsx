import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BuscaParaIncluirSheet, type ResultadoDaBusca } from '@/components/BuscaParaIncluirSheet';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { ProfessorDaChamadaRow } from '@/components/ProfessorDaChamadaRow';
import { RetificarChamadaSheet } from '@/components/RetificarChamadaSheet';
import { RollCallDraftNotice } from '@/components/RollCallDraftNotice';
import { RollCallRow } from '@/components/RollCallRow';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { Selo } from '@/components/Selo';
import { useAuth } from '@/context/AuthProvider';
import { useChamada } from '@/hooks/useChamada';
import { useGroups } from '@/hooks/useGroups';
import { useRollCallDraft } from '@/hooks/useRollCallDraft';
import { createLogger } from '@/lib/logger';
import type { AulasStackScreenProps } from '@/navigation/types';
import {
  buscarAlunosParaIncluir,
  buscarEquipeParaIncluir,
  criarMotivoDeRetificacao,
  type ProfessorDaChamada,
} from '@/services/chamada.service';
import { fetchFrequenciaDoMes } from '@/services/frequency.service';
import { SCHEDULE_MODE_LABELS } from '@/services/plans.service';
import { useTheme } from '@/theme/ThemeProvider';
import {
  confirmacaoDeConclusao,
  contarDaChamada,
  detalhesDaLinha,
  diasDepoisDaAula,
  gravadoDaLista,
  montarBlocos,
  montarEnvio,
  mudancasDaChamada,
  professoresSemMarcacao,
  seloDaLinha,
  textoFeitaDepois,
  type LinhaDaChamada,
} from '@/utils/chamada';
import { formatDayMonth, formatFullDateTime, isoDateKey } from '@/utils/datetime';
import { describeError } from '@/utils/errors';
import { formatarPercentual } from '@/utils/frequency';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('FrequenciaScreen');

/** Origens que são da grade do fixo: a linha mostra a frequência do mês dele. */
const DA_GRADE: ReadonlySet<string> = new Set(['turma', 'permanente', 'troca']);

const ROTULO_DO_PUBLICO = { fixed: 'só fixos', free: 'só livres', both: 'fixos e livres' } as const;

interface Aviso {
  texto: string;
  tipo: 'erro' | 'sucesso';
}

interface Acrescentado {
  id: string;
  nome: string;
  cor: string | null;
}

/**
 * A chamada de uma aula (contrato § 7.2; mockups das linhas C e G), em blocos:
 * professores, da turma, marcaram, trocas, extras e incluídos. As marcações
 * ficam na tela e num rascunho cifrado no aparelho (v2, com os incluídos)
 * até "Concluir chamada". Depois da conclusão, toda mudança é retificação,
 * com motivo (D17), e a presença de professor só o admin corrige (D28).
 */
export function FrequenciaScreen({ navigation, route }: AulasStackScreenProps<'Frequencia'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, isAdmin } = useAuth();
  const uid = session?.user.id ?? null;
  const { classId, title, groupId, canManage } = route.params;

  // Turma arquivada congela a chamada: o banco recusa salvar.
  const { groups } = useGroups();
  const turmaArquivada = groupId !== null && groups.some((group) => group.id === groupId && group.archived_at !== null);

  const chamada = useChamada(classId, canManage);
  const { estado, alunos, professores } = chamada;
  const concluida = estado !== null && estado.concludedAt !== null;
  const aulaComecou = estado !== null && Date.parse(estado.dateTimeIso) <= Date.now();
  const bloqueada = turmaArquivada || estado?.cancelled === true;
  const euSemPresenca = !isAdmin && professores.some((p) => p.teacherId === uid && p.present === false);
  const editavel = canManage && aulaComecou && !bloqueada && !euSemPresenca;
  const professoresEditaveis = editavel && (!concluida || isAdmin);

  const alunoIds = useMemo(() => alunos.map((aluno) => aluno.userId), [alunos]);
  const gravado = useMemo(() => gravadoDaLista(alunos), [alunos]);
  const rascunhoDaChamada = useRollCallDraft({
    userId: uid,
    classId,
    alunoIds,
    gravado,
    concluidaEm: estado?.concludedAt ?? null,
    ativo: editavel && !chamada.loading && chamada.error === null,
  });
  const { rascunho, incluidos, incluir, retirarIncluido, descartar, esquecer, usarMeuRascunho } = rascunhoDaChamada;
  const emConflito = rascunhoDaChamada.aviso?.tipo === 'conflito';
  const podeMarcar = editavel && rascunhoDaChamada.pronto && !emConflito;

  // Professores na tela: começam pelo gravado; quem faz a chamada começa presente.
  const [presencaProf, setPresencaProf] = useState<Record<string, boolean>>({});
  const [acrescentados, setAcrescentados] = useState<Acrescentado[]>([]);
  const [retirados, setRetirados] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const inicial: Record<string, boolean> = {};
    for (const professor of professores) {
      if (professor.present !== null) inicial[professor.teacherId] = professor.present;
    }
    if (!concluida && uid !== null && professores.some((p) => p.teacherId === uid) && inicial[uid] === undefined) {
      inicial[uid] = true;
    }
    setPresencaProf(inicial);
    setAcrescentados([]);
    setRetirados(new Set());
  }, [professores, concluida, uid]);

  // A frequência do mês dos fixos, para a linha (mockup: "Mês 88%").
  const [mesPorAluno, setMesPorAluno] = useState<Record<string, number | null>>({});
  const [erroDoMes, setErroDoMes] = useState(false);
  const idsDaGrade = useMemo(
    () => alunos.filter((aluno) => DA_GRADE.has(aluno.origem)).map((aluno) => aluno.userId).join(','),
    [alunos],
  );
  useEffect(() => {
    if (idsDaGrade === '' || estado === null) return;
    let cancelado = false;
    fetchFrequenciaDoMes(idsDaGrade.split(','), isoDateKey(new Date(estado.dateTimeIso)))
      .then((meses) => {
        if (cancelado) return;
        setErroDoMes(false);
        setMesPorAluno(Object.fromEntries(meses.map((mes) => [mes.userId, mes.frequencyPercent])));
      })
      .catch((falha: unknown) => {
        log.warn('Falha ao carregar a frequência do mês na chamada', falha, { classId });
        if (!cancelado) setErroDoMes(true);
      });
    return () => {
      cancelado = true;
    };
  }, [idsDaGrade, estado, classId]);

  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [retificando, setRetificando] = useState(false);
  const [erroDaRetificacao, setErroDaRetificacao] = useState<string | null>(null);
  const [buscandoAluno, setBuscandoAluno] = useState(false);
  const [buscandoProfessor, setBuscandoProfessor] = useState(false);

  const blocos = useMemo(() => montarBlocos(alunos, incluidos), [alunos, incluidos]);
  const linhas = useMemo(() => blocos.flatMap((bloco) => bloco.linhas), [blocos]);
  const todosOsProfessores = useMemo<ProfessorDaChamada[]>(
    () => [
      ...professores,
      ...acrescentados.map((a) => ({
        teacherId: a.id,
        name: a.nome,
        color: a.cor,
        scheduled: false,
        present: null,
        addedInRollCall: true,
        edited: false,
      })),
    ],
    [professores, acrescentados],
  );
  const envio = useMemo(
    () =>
      montarEnvio({
        linhas,
        rascunho,
        retirados,
        professores,
        presencaDosProfessores: presencaProf,
        motivoId: null,
      }),
    [linhas, rascunho, retirados, professores, presencaProf],
  );
  const nomesAcrescentados = useMemo(() => Object.fromEntries(acrescentados.map((a) => [a.id, a.nome])), [acrescentados]);
  const mudancas = useMemo(
    () => mudancasDaChamada(linhas, envio, professores, nomesAcrescentados),
    [linhas, envio, professores, nomesAcrescentados],
  );
  const alterada = mudancas.alunos.length + mudancas.professores.length > 0;
  const contagem = useMemo(() => contarDaChamada(linhas, rascunho), [linhas, rascunho]);
  const faltamProfessores = professoresSemMarcacao(todosOsProfessores, presencaProf);

  const salvar = useCallback(
    async (motivoId: string | null) => {
      setSalvando(true);
      setAviso(null);
      try {
        const resultado = await chamada.salvar({ ...envio, motivoId });
        await esquecer();
        setAviso({
          texto: resultado.retificada ? 'Retificação salva. O aluno afetado é avisado.' : 'Chamada salva.',
          tipo: 'sucesso',
        });
        return true;
      } catch (erro) {
        log.error('Falha ao salvar a chamada', erro, { classId });
        const mensagem = describeError(erro);
        setAviso({ texto: `${mensagem} Suas marcações continuam na tela e guardadas neste aparelho.`, tipo: 'erro' });
        setErroDaRetificacao(mensagem);
        return false;
      } finally {
        setSalvando(false);
      }
    },
    [chamada, envio, esquecer, classId],
  );

  const salvarRetificacao = useCallback(
    (motivo: string) => {
      void (async () => {
        setErroDaRetificacao(null);
        setSalvando(true);
        let motivoId: string;
        try {
          motivoId = await criarMotivoDeRetificacao(classId, motivo);
        } catch (erro) {
          log.error('Falha ao registrar o motivo da retificação', erro, { classId });
          setErroDaRetificacao(describeError(erro));
          setSalvando(false);
          return;
        }
        if (await salvar(motivoId)) setRetificando(false);
      })();
    },
    [classId, salvar],
  );

  const handleSalvar = useCallback(() => {
    if (concluida) {
      setErroDaRetificacao(null);
      setRetificando(true);
      return;
    }
    Alert.alert('Concluir chamada', confirmacaoDeConclusao(contagem), [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Concluir', onPress: () => void salvar(null) },
    ]);
  }, [concluida, contagem, salvar]);

  // Sair com marcações não salvas: continuar, descartar ou guardar para depois.
  useEffect(() => {
    if (!alterada || salvando || !editavel) return undefined;
    return navigation.addListener('beforeRemove', (evento) => {
      evento.preventDefault();
      Alert.alert('Chamada não salva', 'As marcações ainda não foram salvas no sistema.', [
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
  }, [navigation, alterada, salvando, editavel, descartar]);

  const confirmarDescarte = useCallback(() => {
    Alert.alert('Descartar o rascunho?', 'A lista volta para o que está salvo.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => void descartar() },
    ]);
  }, [descartar]);

  const abrirFrequencia = useCallback(
    (userId: string, nome: string) => navigation.navigate('HistoricoFrequencia', { userId, name: nome }),
    [navigation],
  );

  const retirar = useCallback(
    (userId: string) => {
      if (incluidos.some((incluido) => incluido.id === userId)) {
        retirarIncluido(userId);
        return;
      }
      setRetirados((anteriores) => {
        const proximos = new Set(anteriores);
        if (proximos.has(userId)) proximos.delete(userId);
        else proximos.add(userId);
        return proximos;
      });
    },
    [incluidos, retirarIncluido],
  );

  const marcarProfessor = useCallback((teacherId: string, presente: boolean) => {
    setPresencaProf((anterior) => ({ ...anterior, [teacherId]: presente }));
  }, []);

  const buscarAlunos = useCallback(
    async (texto: string): Promise<ResultadoDaBusca[]> =>
      (await buscarAlunosParaIncluir(classId, texto))
        .filter((aluno) => !incluidos.some((incluido) => incluido.id === aluno.userId))
        .map((aluno) => ({
          id: aluno.userId,
          titulo: aluno.name ?? 'Aluno pendente',
          subtitulo: [SCHEDULE_MODE_LABELS[aluno.scheduleMode], aluno.groupName].filter(Boolean).join(' · '),
          cor: null,
        })),
    [classId, incluidos],
  );

  const buscarProfessores = useCallback(
    async (texto: string): Promise<ResultadoDaBusca[]> =>
      (await buscarEquipeParaIncluir(classId, texto))
        .filter((professor) => !acrescentados.some((a) => a.id === professor.teacherId))
        .map((professor) => ({ id: professor.teacherId, titulo: professor.name ?? 'Professor', subtitulo: null, cor: professor.color })),
    [classId, acrescentados],
  );

  const renderLinha = useCallback(
    ({ item }: { item: LinhaDaChamada }) => {
      const detalhes = detalhesDaLinha(item);
      const doMes = mesPorAluno[item.userId];
      const comMes = doMes !== undefined ? [`Mês ${formatarPercentual(doMes)}`, ...detalhes] : detalhes;
      const podeRetirar = item.origem === 'incluido';
      return (
        <View style={retirados.has(item.userId) ? styles.retirado : null}>
          <RollCallRow
            linha={item}
            marcacao={rascunho[item.userId] ?? null}
            selo={seloDaLinha(item)}
            detalhes={retirados.has(item.userId) ? ['Sai da chamada ao salvar'] : comMes}
            editada={item.aluno?.edited === true}
            editavel={podeMarcar && !retirados.has(item.userId)}
            onMarcar={rascunhoDaChamada.marcar}
            onAbrirFrequencia={abrirFrequencia}
            onRetirar={podeRetirar ? retirar : undefined}
          />
        </View>
      );
    },
    [mesPorAluno, retirados, rascunho, podeMarcar, rascunhoDaChamada.marcar, abrirFrequencia, retirar, styles.retirado],
  );

  if (chamada.loading && estado === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (chamada.error !== null && estado === null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={chamada.error} onRetry={() => void chamada.reload()} />
      </ScreenWrapper>
    );
  }

  const feitaDepois =
    estado !== null && estado.concludedAt !== null
      ? textoFeitaDepois(diasDepoisDaAula(estado.dateTimeIso, estado.concludedAt))
      : null;

  const cabecalho = (
    <View style={styles.cabecalho}>
      <AppText variant="heading" style={styles.titulo} numberOfLines={2}>
        {title}
      </AppText>
      {estado !== null ? (
        <Text style={styles.legenda}>
          {formatFullDateTime(estado.dateTimeIso)} · {estado.type === 'event' ? 'evento' : ROTULO_DO_PUBLICO[estado.audience]}
        </Text>
      ) : null}
      {estado !== null && (concluida || estado.edited) ? (
        <View style={styles.selos}>
          {estado.concludedAt !== null ? (
            <Selo texto={`Concluída ${formatDayMonth(estado.concludedAt)}`} tom="destaque" />
          ) : null}
          {feitaDepois !== null ? <Selo texto={feitaDepois} tom="aviso" /> : null}
          {estado.edited ? <Selo texto="Editada" tom="aviso" /> : null}
        </View>
      ) : null}
      {estado?.cancelled ? (
        <AppText variant="caption" color={colors.error}>
          Aula cancelada não tem chamada.
        </AppText>
      ) : turmaArquivada ? (
        <AppText variant="caption" color={colors.warning}>
          A turma desta aula foi arquivada: a chamada ficou congelada como estava e continua valendo na frequência.
        </AppText>
      ) : !canManage ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Você está vendo esta aula, mas só os professores dela podem fazer a chamada.
        </AppText>
      ) : euSemPresenca ? (
        <AppText variant="caption" color={colors.warning}>
          Você está sem presença nesta aula. Para corrigir, peça em Solicitações.
        </AppText>
      ) : !aulaComecou ? (
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
          onManterSalvo={() => void descartar()}
        />
      ) : null}
      <Text style={styles.contagem}>
        {`${contagem.presentes} presentes · ${contagem.faltas} faltas · ${contagem.semMarcacaoFalta + contagem.semMarcacaoSemRegistro} sem marcação`}
      </Text>
      {erroDoMes ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Não foi possível carregar a frequência do mês dos alunos.
        </AppText>
      ) : null}
      {aviso !== null ? (
        <AppText
          variant="caption"
          color={aviso.tipo === 'sucesso' ? colors.success : colors.error}
          accessibilityLiveRegion="polite"
        >
          {aviso.texto}
        </AppText>
      ) : null}

      {canManage && todosOsProfessores.length > 0 ? (
        <View style={styles.bloco}>
          <Text style={styles.tituloDoBloco}>PROFESSORES</Text>
          {todosOsProfessores.map((professor) => (
            <ProfessorDaChamadaRow
              key={professor.teacherId}
              teacherId={professor.teacherId}
              nome={professor.name ?? 'Professor'}
              cor={professor.color}
              legenda={
                professor.addedInRollCall
                  ? 'Acrescentado na chamada'
                  : professor.teacherId === uid
                    ? 'Escalado · fazendo a chamada'
                    : 'Escalado · confirme se deu a aula'
              }
              presente={presencaProf[professor.teacherId] ?? professor.present}
              editado={professor.edited}
              editavel={professoresEditaveis}
              onMarcar={marcarProfessor}
            />
          ))}
          {professoresEditaveis ? (
            <Pressable
              onPress={() => setBuscandoProfessor(true)}
              style={styles.acao}
              accessibilityRole="button"
              accessibilityLabel="Acrescentar professor que não estava previsto"
            >
              <Ionicons name="person-add-outline" size={20} color={colors.primaryText} />
              <Text style={styles.acaoTexto}>Acrescentar professor que não estava previsto</Text>
            </Pressable>
          ) : null}
          <AppText variant="caption" color={colors.textSecondary}>
            Depois de concluída a chamada, a presença de professor só o admin corrige (o professor pede em Solicitações).
          </AppText>
        </View>
      ) : null}
    </View>
  );

  const rodapeDaLista = podeMarcar ? (
    <Pressable
      onPress={() => setBuscandoAluno(true)}
      style={styles.acao}
      accessibilityRole="button"
      accessibilityLabel="Incluir aluno que apareceu"
    >
      <Ionicons name="person-add-outline" size={20} color={colors.primaryText} />
      <Text style={styles.acaoTexto}>Incluir aluno que apareceu</Text>
    </Pressable>
  ) : null;

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false}>
      <SectionList
        sections={blocos.map((bloco) => ({ key: bloco.chave, title: bloco.titulo, data: bloco.linhas }))}
        keyExtractor={(item) => item.userId}
        renderItem={renderLinha}
        renderSectionHeader={({ section }) => <Text style={styles.tituloDoBloco}>{section.title.toUpperCase()}</Text>}
        ListHeaderComponent={cabecalho}
        ListFooterComponent={rodapeDaLista}
        ListEmptyComponent={
          <AppText variant="caption" color={colors.textSecondary}>
            Ninguém nesta aula ainda. Inclua quem apareceu.
          </AppText>
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.conteudo}
        initialNumToRender={15}
        windowSize={11}
      />
      {editavel ? (
        <View style={[styles.rodape, { borderTopColor: colors.border }]}>
          {faltamProfessores > 0 ? (
            <AppText variant="caption" color={colors.warning} style={styles.centralizado}>
              Confirme se cada professor deu a aula.
            </AppText>
          ) : alterada && concluida ? (
            <AppText variant="caption" color={colors.warning} style={styles.centralizado}>
              Alterações ainda não salvas
            </AppText>
          ) : null}
          <Button
            title={concluida ? 'Retificar chamada' : 'Concluir chamada'}
            onPress={handleSalvar}
            loading={salvando && !retificando}
            disabled={(concluida && !alterada) || !rascunhoDaChamada.pronto || emConflito || faltamProfessores > 0}
            accessibilityHint={concluida ? 'Abre a retificação, com o motivo' : 'Grava a chamada de todos de uma vez'}
          />
        </View>
      ) : null}

      <RetificarChamadaSheet
        visible={retificando}
        alunos={mudancas.alunos}
        professores={mudancas.professores}
        salvando={salvando}
        erro={erroDaRetificacao}
        onSalvar={salvarRetificacao}
        onClose={() => setRetificando(false)}
      />
      <BuscaParaIncluirSheet
        visible={buscandoAluno}
        titulo="Incluir aluno"
        explicacao="Para quem apareceu e não está na lista. Ele entra como presente."
        rotuloDoCampo="Nome do aluno"
        buscar={buscarAlunos}
        onEscolher={(resultado) => {
          incluir({ id: resultado.id, nome: resultado.titulo });
          setBuscandoAluno(false);
        }}
        onClose={() => setBuscandoAluno(false)}
      />
      <BuscaParaIncluirSheet
        visible={buscandoProfessor}
        titulo="Acrescentar professor"
        explicacao="Para quem deu a aula sem estar previsto. Ele entra como presente."
        rotuloDoCampo="Nome do professor"
        buscar={buscarProfessores}
        onEscolher={(resultado) => {
          setAcrescentados((anteriores) => [...anteriores, { id: resultado.id, nome: resultado.titulo, cor: resultado.cor }]);
          setPresencaProf((anterior) => ({ ...anterior, [resultado.id]: true }));
          setBuscandoProfessor(false);
        }}
        onClose={() => setBuscandoProfessor(false)}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    conteudo: { paddingHorizontal: 16, paddingBottom: 24 },
    cabecalho: { gap: 6, paddingBottom: 8 },
    titulo: { marginTop: 12 },
    legenda: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
    selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    contagem: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    bloco: { gap: 4, marginTop: 8 },
    tituloDoBloco: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 2,
    },
    acao: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
    acaoTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primaryText },
    retirado: { opacity: 0.5 },
    rodape: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 6,
    },
    centralizado: { textAlign: 'center' },
  });
}
