import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AcoesDaPessoaSheet, type AcaoDaPessoa } from '@/components/AcoesDaPessoaSheet';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PedirCorSheet } from '@/components/PedirCorSheet';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Selo } from '@/components/Selo';
import { TurmaOuPlanoSheet } from '@/components/TurmaOuPlanoSheet';
import { useAuth } from '@/context/AuthProvider';
import { useDefaultStudentPassword } from '@/hooks/useDefaultStudentPassword';
import { useGroups } from '@/hooks/useGroups';
import { usePlans } from '@/hooks/usePlans';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import {
  fetchPessoas,
  type Pessoa,
  resetStudentPassword,
  setStudentActive,
  updateStudentGroup,
  updateStudentPlan,
  updateUserRole,
} from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { TomDoSelo } from '@/utils/aulasDoAluno';
import { describeError } from '@/utils/errors';
import {
  contarPessoas,
  filtrarPessoas,
  iniciais,
  ROTULO_DA_SITUACAO,
  situacaoDaPessoa,
  type AbaDePessoas,
  type FiltroDeAlunos,
  type SituacaoDaPessoa,
} from '@/utils/pessoas';

const SCREEN_EDGES = ['bottom'] as const;
const log = createLogger('PessoasScreen');

const TOM_DA_SITUACAO: Readonly<Record<SituacaoDaPessoa, TomDoSelo>> = {
  ativo: 'destaque',
  primeiro_acesso: 'neutro',
  trancado: 'aviso',
};

/**
 * **Pessoas** (opção A dos mockups da linha E, aprovada em 22/09): Alunos e
 * Equipe em abas, filtros de situação (nunca de cargo), a linha limpa e as
 * ações por extenso numa folha. Promover a administrador só existe na
 * Equipe; o "+ Cadastrar" abre o cadastro da aba aberta.
 */
export function PessoasScreen({ navigation }: DadosStackScreenProps<'Pessoas'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { profile } = useAuth();
  const { groups } = useGroups();
  const { plans } = usePlans();
  const { password: senhaPadrao } = useDefaultStudentPassword();

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaDePessoas>('alunos');
  const [filtro, setFiltro] = useState<FiltroDeAlunos>('ativos');
  const [busca, setBusca] = useState('');
  const [escolhida, setEscolhida] = useState<Pessoa | null>(null);
  const [trocandoTurma, setTrocandoTurma] = useState<Pessoa | null>(null);
  const [pedindoCorDe, setPedindoCorDe] = useState<Pessoa | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPessoas(await fetchPessoas());
    } catch (falha) {
      log.error('Falha ao carregar as pessoas', falha);
      setErro('Não foi possível carregar as pessoas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const contagem = useMemo(() => contarPessoas(pessoas), [pessoas]);
  const lista = useMemo(() => filtrarPessoas(pessoas, { aba, filtro, busca }), [pessoas, aba, filtro, busca]);
  const nomeDaTurma = useMemo(() => new Map(groups.map((grupo) => [grupo.id, grupo.name])), [groups]);
  const nomeDoPlano = useMemo(() => new Map(plans.map((plano) => [plano.id, plano.name])), [plans]);

  /** Roda uma ação e mostra a falha no topo da lista, sem detalhe técnico. [#93] */
  const executar = useCallback(
    async (descricao: string, acao: () => Promise<unknown>) => {
      setErroDaAcao(null);
      try {
        await acao();
        await carregar();
      } catch (falha) {
        log.error(descricao, falha);
        setErroDaAcao(describeError(falha));
      }
    },
    [carregar],
  );

  const confirmar = useCallback((titulo: string, texto: string, botao: string, acao: () => void) => {
    Alert.alert(titulo, texto, [
      { text: 'Cancelar', style: 'cancel' },
      { text: botao, style: 'destructive', onPress: acao },
    ]);
  }, []);

  const acoesDoAluno = useCallback(
    (aluno: Pessoa): AcaoDaPessoa[] => {
      const nome = aluno.name ?? 'este aluno';
      const ativo = aluno.status === 'active';
      const senha = senhaPadrao !== null ? ` (${senhaPadrao})` : '';
      return [
        { rotulo: 'Ver ficha', icone: 'id-card-outline', onPress: () => navigation.navigate('FichaAluno', { userId: aluno.id }) },
        { rotulo: 'Editar cadastro', icone: 'create-outline', onPress: () => navigation.navigate('EditarAluno', { userId: aluno.id }) },
        { rotulo: 'Trocar turma ou plano', icone: 'swap-horizontal-outline', onPress: () => setTrocandoTurma(aluno) },
        {
          rotulo: ativo ? 'Trancar matrícula' : 'Reativar matrícula',
          icone: ativo ? 'pause-circle-outline' : 'play-circle-outline',
          onPress: () =>
            confirmar(
              ativo ? 'Trancar matrícula?' : 'Reativar matrícula?',
              ativo
                ? `${nome} deixa de constar entre os alunos ativos. O histórico fica, e a matrícula pode ser reativada depois.`
                : `${nome} volta a constar entre os alunos ativos.`,
              ativo ? 'Trancar' : 'Reativar',
              () => void executar('Falha ao trancar ou reativar', () => setStudentActive(aluno.id, !ativo)),
            ),
        },
        {
          rotulo: 'Redefinir senha de acesso',
          icone: 'key-outline',
          onPress: () =>
            confirmar(
              'Redefinir senha?',
              `A senha de ${nome} volta para a de primeiro acesso${senha}, e uma nova será pedida no próximo acesso.`,
              'Redefinir',
              () => void executar('Falha ao redefinir a senha', () => resetStudentPassword(aluno.id)),
            ),
        },
        {
          rotulo: 'Excluir conta',
          icone: 'trash-outline',
          perigo: true,
          onPress: () => navigation.navigate('EditarAluno', { userId: aluno.id, excluir: true }),
        },
      ];
    },
    [navigation, confirmar, executar, senhaPadrao],
  );

  const acoesDaEquipe = useCallback(
    (pessoa: Pessoa): AcaoDaPessoa[] => {
      const nome = pessoa.name ?? 'esta pessoa';
      const acoes: AcaoDaPessoa[] = [
        {
          rotulo: 'Ver ficha',
          icone: 'id-card-outline',
          onPress: () => navigation.navigate('FichaProfessor', { teacherId: pessoa.id, name: nome }),
        },
      ];
      if (pessoa.id === profile?.id) return acoes;
      if (pessoa.role === 'professor') {
        acoes.push({
          rotulo: 'Promover a administrador',
          icone: 'shield-checkmark-outline',
          onPress: () =>
            confirmar(
              'Promover a administrador?',
              `${nome} passa a ver e mudar tudo na academia, inclusive o financeiro. Continua dando aula com a mesma cor.`,
              'Promover',
              () => void executar('Falha ao promover', () => updateUserRole(pessoa.id, 'admin')),
            ),
        });
      } else if (pessoa.color === null) {
        // Professor precisa de cor (T24): pede a cor antes de rebaixar.
        acoes.push({ rotulo: 'Tornar professor', icone: 'school-outline', onPress: () => setPedindoCorDe(pessoa) });
      } else {
        const cor = pessoa.color;
        acoes.push({
          rotulo: 'Tornar professor',
          icone: 'school-outline',
          onPress: () =>
            confirmar(
              'Tornar professor?',
              `${nome} deixa de ser administrador e continua dando aula.`,
              'Confirmar',
              () => void executar('Falha ao tornar professor', () => updateUserRole(pessoa.id, 'professor', cor)),
            ),
        });
      }
      return acoes;
    },
    [navigation, confirmar, executar, profile?.id],
  );

  const renderItem = useCallback<ListRenderItem<Pessoa>>(
    ({ item }) => {
      const daEquipe = aba === 'equipe';
      const situacao = situacaoDaPessoa(item);
      const sub = daEquipe
        ? item.role === 'admin'
          ? 'Administrador'
          : 'Professor'
        : `${item.group_id !== null ? nomeDaTurma.get(item.group_id) ?? 'Turma' : 'Sem turma'} · ${
            item.plan_id !== null ? nomeDoPlano.get(item.plan_id) ?? 'Plano' : 'sem plano'
          }`;
      const nome = item.name ?? (item.access_channel === 'none' ? 'Sem nome' : 'Aluno pendente');
      return (
        <Pressable
          onPress={() => setEscolhida(item)}
          style={styles.linha}
          accessibilityRole="button"
          accessibilityLabel={`${nome}, ${sub}`}
          accessibilityHint="Abre as ações"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>{iniciais(item.name)}</Text>
            {daEquipe && item.color !== null ? <View style={[styles.cor, { backgroundColor: item.color }]} /> : null}
          </View>
          <View style={styles.texto}>
            <Text style={styles.nome} numberOfLines={1}>
              {nome}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {sub}
            </Text>
          </View>
          {daEquipe ? (
            item.role === 'admin' ? <Selo texto="Admin" tom="destaque" /> : null
          ) : (
            <Selo texto={ROTULO_DA_SITUACAO[situacao]} tom={TOM_DA_SITUACAO[situacao]} />
          )}
        </Pressable>
      );
    },
    [aba, styles, nomeDaTurma, nomeDoPlano],
  );

  const abas = useMemo(
    () => [
      { value: 'alunos' as const, label: `Alunos · ${contagem.alunos}` },
      { value: 'equipe' as const, label: `Equipe · ${contagem.equipe}` },
    ],
    [contagem],
  );

  const filtros: ReadonlyArray<{ chave: FiltroDeAlunos; rotulo: string }> = [
    { chave: 'ativos', rotulo: 'Ativos' },
    { chave: 'pendentes', rotulo: `Pendentes ${contagem.pendentes}` },
    { chave: 'trancados', rotulo: `Trancados ${contagem.trancados}` },
  ];

  const cabecalho = (
    <View style={styles.cabecalho}>
      <SegmentedControl options={abas} value={aba} onChange={setAba} />
      <View style={styles.busca}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Nome ou CPF"
          placeholderTextColor={colors.textSecondary}
          style={styles.buscaTexto}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar pelo nome ou pelo CPF"
        />
      </View>
      {aba === 'alunos' ? (
        <View style={styles.chips}>
          {filtros.map(({ chave, rotulo }) => {
            const ligado = filtro === chave;
            return (
              <Pressable
                key={chave}
                onPress={() => setFiltro(chave)}
                style={[styles.chip, ligado ? styles.chipLigado : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: ligado }}
              >
                <Text style={[styles.chipTexto, ligado ? styles.chipTextoLigado : null]}>{rotulo}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {erroDaAcao !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erroDaAcao}
        </AppText>
      ) : null}
    </View>
  );

  if (erro !== null && pessoas.length === 0) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={erro} onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          carregando ? (
            <ActivityIndicator color={colors.primary} style={styles.carregando} />
          ) : (
            <EmptyState icon="people-outline" title="Ninguém por aqui" message="Nenhuma pessoa corresponde à busca ou ao filtro." />
          )
        }
      />
      <Pressable
        onPress={() => navigation.navigate(aba === 'equipe' ? 'CadastrarEquipe' : 'CadastrarAluno')}
        style={styles.cadastrar}
        accessibilityRole="button"
        accessibilityLabel={aba === 'equipe' ? 'Cadastrar professor ou administrador' : 'Cadastrar aluno'}
      >
        <Ionicons name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.cadastrarTexto}>Cadastrar</Text>
      </Pressable>

      {escolhida !== null ? (
        <AcoesDaPessoaSheet
          nome={escolhida.name ?? 'Aluno pendente'}
          acoes={escolhida.role === 'user' ? acoesDoAluno(escolhida) : acoesDaEquipe(escolhida)}
          onClose={() => setEscolhida(null)}
        />
      ) : null}
      {trocandoTurma !== null ? (
        <TurmaOuPlanoSheet
          nome={trocandoTurma.name}
          turmaAtual={trocandoTurma.group_id}
          planoAtual={trocandoTurma.plan_id}
          onClose={() => setTrocandoTurma(null)}
          onSalvar={async (turma, plano) => {
            if (turma !== trocandoTurma.group_id) await updateStudentGroup(trocandoTurma.id, turma);
            if (plano !== trocandoTurma.plan_id) await updateStudentPlan(trocandoTurma.id, plano);
            await carregar();
          }}
        />
      ) : null}
      <PedirCorSheet
        visible={pedindoCorDe !== null}
        onClose={() => setPedindoCorDe(null)}
        onConfirmar={async (cor) => {
          if (pedindoCorDe === null) return;
          await updateUserRole(pedindoCorDe.id, 'professor', cor);
          setPedindoCorDe(null);
          await carregar();
        }}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 12, paddingBottom: 96, gap: 8, flexGrow: 1 },
    carregando: { marginTop: 24 },
    cabecalho: { gap: 12, marginBottom: 4 },
    busca: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buscaTexto: { flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, padding: 0 },
    chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    chipLigado: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textSecondary },
    chipTextoLigado: { color: colors.onPrimary },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primaryText },
    cor: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    texto: { flex: 1, minWidth: 0, gap: 2 },
    nome: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
    cadastrar: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    cadastrarTexto: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  });
}
