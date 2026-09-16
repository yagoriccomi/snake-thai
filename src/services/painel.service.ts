import {
  FAIXAS_DE_ATRASO,
  LIMIAR_RISCO_EVASAO_PERCENT,
  MESES_DO_GRAFICO,
  MIN_AULAS_PARA_RISCO,
  type FaixaDeAtraso,
} from '@/constants/painel';
import { supabase } from '@/lib/supabase';

/**
 * Serviço do Painel do admin. A regra de cada número vive no banco
 * (docs/PAINEL.md); aqui só se chama a função e se traduz para o formato do
 * app. Nada é recalculado no aparelho.
 *
 * Os tipos gerados dizem `number` e `string` para toda coluna de função, mas
 * média sem aluno, turma vazia e percentual ausente chegam nulos: a leitura
 * abaixo confere cada campo em vez de confiar no tipo.
 */

function respostaInesperada(funcao: string, campo: string): Error {
  return new Error(`Resposta inesperada do banco (${funcao}.${campo}).`);
}

/** Inteiro obrigatório (bigint e integer chegam como número no JSON). */
function inteiro(valor: unknown, funcao: string, campo: string): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) {
    throw respostaInesperada(funcao, campo);
  }
  return numero;
}

/** Número que pode faltar (média sem alunos, percentual sem aulas). */
function numeroOuNulo(valor: unknown, funcao: string, campo: string): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  return inteiro(valor, funcao, campo);
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

function texto(valor: unknown, funcao: string, campo: string): string {
  if (typeof valor !== 'string') {
    throw respostaInesperada(funcao, campo);
  }
  return valor;
}

/** Números do topo do Painel. */
export interface PainelResumo {
  alunosAtivos: number;
  alunosInativos: number;
  alunosAtivosSemPlano: number;
  saidasNoMes: number;
  /** `AAAA-MM-01`. */
  competencia: string;
  esperadoCents: number;
  recebidoCents: number;
  emAnaliseCents: number;
  emAbertoCents: number;
  vencidoCents: number;
  mensalidadesTotal: number;
  mensalidadesPagas: number;
  inadimplenciaCents: number;
  alunosInadimplentes: number;
  /** Inadimplência de contas excluídas (LGPD), sem identificação. */
  inadimplenciaContasEncerradasCents: number;
  /** `null` quando nenhum aluno teve aula contada no mês. */
  frequenciaMediaMes: number | null;
  alunosComAulaNoMes: number;
  ultimoMesFechado: string;
  frequenciaMediaUltimoMes: number | null;
  alunosComAulaUltimoMes: number;
}

const RESUMO = 'painel_admin_resumo';

export async function fetchPainelResumo(): Promise<PainelResumo> {
  const { data, error } = await supabase.rpc(RESUMO);
  if (error !== null) {
    throw error;
  }
  const linha = data[0];
  if (linha === undefined) {
    throw new Error(`Resposta inesperada do banco (${RESUMO} sem linha).`);
  }
  const ler = (campo: keyof typeof linha): number => inteiro(linha[campo], RESUMO, campo);
  return {
    alunosAtivos: ler('alunos_ativos'),
    alunosInativos: ler('alunos_inativos'),
    alunosAtivosSemPlano: ler('alunos_ativos_sem_plano'),
    saidasNoMes: ler('saidas_no_mes'),
    competencia: texto(linha.competencia, RESUMO, 'competencia'),
    esperadoCents: ler('esperado_cents'),
    recebidoCents: ler('recebido_cents'),
    emAnaliseCents: ler('em_analise_cents'),
    emAbertoCents: ler('em_aberto_cents'),
    vencidoCents: ler('vencido_cents'),
    mensalidadesTotal: ler('mensalidades_total'),
    mensalidadesPagas: ler('mensalidades_pagas'),
    inadimplenciaCents: ler('inadimplencia_cents'),
    alunosInadimplentes: ler('alunos_inadimplentes'),
    inadimplenciaContasEncerradasCents: ler('inadimplencia_contas_encerradas_cents'),
    frequenciaMediaMes: numeroOuNulo(linha.frequencia_media_mes, RESUMO, 'frequencia_media_mes'),
    alunosComAulaNoMes: ler('alunos_com_aula_no_mes'),
    ultimoMesFechado: texto(linha.ultimo_mes_fechado, RESUMO, 'ultimo_mes_fechado'),
    frequenciaMediaUltimoMes: numeroOuNulo(linha.frequencia_media_ultimo_mes, RESUMO, 'frequencia_media_ultimo_mes'),
    alunosComAulaUltimoMes: ler('alunos_com_aula_ultimo_mes'),
  };
}

export interface FaixaDeInadimplencia {
  faixa: FaixaDeAtraso;
  mensalidades: number;
  valorCents: number;
}

const FAIXAS = 'painel_inadimplencia_faixas';

function comoFaixa(valor: unknown): FaixaDeAtraso {
  const faixa = FAIXAS_DE_ATRASO.find((conhecida) => conhecida === valor);
  if (faixa === undefined) {
    throw respostaInesperada(FAIXAS, 'faixa');
  }
  return faixa;
}

export async function fetchInadimplenciaFaixas(): Promise<FaixaDeInadimplencia[]> {
  const { data, error } = await supabase.rpc(FAIXAS);
  if (error !== null) {
    throw error;
  }
  return [...data]
    .sort((a, b) => a.ordem - b.ordem)
    .map((linha) => ({
      faixa: comoFaixa(linha.faixa),
      mensalidades: inteiro(linha.mensalidades, FAIXAS, 'mensalidades'),
      valorCents: inteiro(linha.valor_cents, FAIXAS, 'valor_cents'),
    }));
}

export interface MesDeFaturamento {
  /** `AAAA-MM-01`. */
  referenceMonth: string;
  esperadoCents: number;
  recebidoCents: number;
  pendenteCents: number;
}

const FATURAMENTO = 'painel_faturamento_mensal';

/** Faturamento por competência, do mês mais antigo ao atual. */
export async function fetchFaturamentoMensal(meses: number = MESES_DO_GRAFICO): Promise<MesDeFaturamento[]> {
  const { data, error } = await supabase.rpc(FATURAMENTO, { p_meses: meses });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    referenceMonth: texto(linha.reference_month, FATURAMENTO, 'reference_month'),
    esperadoCents: inteiro(linha.esperado_cents, FATURAMENTO, 'esperado_cents'),
    recebidoCents: inteiro(linha.recebido_cents, FATURAMENTO, 'recebido_cents'),
    pendenteCents: inteiro(linha.pendente_cents, FATURAMENTO, 'pendente_cents'),
  }));
}

export interface AlunoEmRisco {
  userId: string;
  nome: string;
  turma: string | null;
  /** `null` quando o mês atual ainda não tem aulas suficientes. */
  frequenciaMesAtual: number | null;
  frequenciaUltimoMes: number | null;
}

const EM_RISCO = 'painel_alunos_em_risco';

export async function fetchAlunosEmRisco(
  limitePercent: number = LIMIAR_RISCO_EVASAO_PERCENT,
  minAulas: number = MIN_AULAS_PARA_RISCO,
): Promise<AlunoEmRisco[]> {
  const { data, error } = await supabase.rpc(EM_RISCO, { p_limite_percent: limitePercent, p_min_aulas: minAulas });
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    userId: texto(linha.user_id, EM_RISCO, 'user_id'),
    nome: texto(linha.nome, EM_RISCO, 'nome'),
    turma: textoOuNulo(linha.turma),
    frequenciaMesAtual: numeroOuNulo(linha.frequencia_mes_atual, EM_RISCO, 'frequencia_mes_atual'),
    frequenciaUltimoMes: numeroOuNulo(linha.frequencia_ultimo_mes, EM_RISCO, 'frequencia_ultimo_mes'),
  }));
}

/** Um devedor do relatório de inadimplência. */
export interface Devedor {
  userId: string;
  nome: string;
  turma: string | null;
  alunoAtivo: boolean;
  mensalidades: number;
  totalDevidoCents: number;
  maiorAtrasoDias: number;
  /** `AAAA-MM-DD`. */
  vencimentoMaisAntigo: string;
}

const RELATORIO = 'relatorio_inadimplencia';

/** Devedores, do maior atraso para o menor. */
export async function fetchRelatorioInadimplencia(): Promise<Devedor[]> {
  const { data, error } = await supabase.rpc(RELATORIO);
  if (error !== null) {
    throw error;
  }
  return data.map((linha) => ({
    userId: texto(linha.user_id, RELATORIO, 'user_id'),
    nome: texto(linha.nome, RELATORIO, 'nome'),
    turma: textoOuNulo(linha.turma),
    alunoAtivo: linha.aluno_ativo === true,
    mensalidades: inteiro(linha.mensalidades, RELATORIO, 'mensalidades'),
    totalDevidoCents: inteiro(linha.total_devido_cents, RELATORIO, 'total_devido_cents'),
    maiorAtrasoDias: inteiro(linha.maior_atraso_dias, RELATORIO, 'maior_atraso_dias'),
    vencimentoMaisAntigo: texto(linha.vencimento_mais_antigo, RELATORIO, 'vencimento_mais_antigo'),
  }));
}
