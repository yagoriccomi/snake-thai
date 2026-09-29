import { CATEGORIAS, type Categoria, type EstadoDaSolicitacao, type TipoDeSolicitacao } from '@/constants/solicitacoes';
import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';

/**
 * Solicitações (contrato § 9.3): "Eu estava na aula", os pedidos de professor
 * ao admin e a caixa da equipe. Quem pode o quê é decidido no banco; aqui só
 * se chama e se traduz. [#6]
 */

const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

function ehCategoria(valor: string): valor is Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

/** Cria o motivo (§ 8) e abre o pedido que o consome. */
export async function abrirSolicitacao(tipo: TipoDeSolicitacao, classId: string, texto: string): Promise<string> {
  const { data: motivoId, error: erroDoMotivo } = await supabase.rpc('criar_motivo', {
    p_kind: 'request_evidence',
    p_class_id: classId,
    p_texto: texto.trim(),
  });
  if (erroDoMotivo !== null) {
    throw lerErroDoBanco(erroDoMotivo, RECUSAS_COM_FRASE);
  }
  const { data, error } = await supabase.rpc('abrir_solicitacao', {
    p_kind: tipo,
    p_class_id: classId,
    p_motivo_id: motivoId,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data;
}

/** Aprovar ou negar, com a nota obrigatória. */
export async function decidirSolicitacao(
  id: string,
  decisao: Exclude<EstadoDaSolicitacao, 'pending'>,
  nota: string,
): Promise<void> {
  const { error } = await supabase.rpc('decidir_solicitacao', { p_id: id, p_decisao: decisao, p_nota: nota.trim() });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}

export interface MinhaSolicitacao {
  id: string;
  kind: TipoDeSolicitacao;
  classId: string;
  classTitle: string;
  classDateTime: string;
  status: EstadoDaSolicitacao;
  /** Só na aprovada (D16). */
  approvedByName: string | null;
  createdAt: string;
}

export async function fetchMinhasSolicitacoes(): Promise<MinhaSolicitacao[]> {
  const { data, error } = await supabase.rpc('minhas_solicitacoes');
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    kind: linha.kind,
    classId: linha.class_id,
    classTitle: linha.class_title,
    classDateTime: linha.class_date_time,
    status: linha.status,
    approvedByName: linha.approved_by_name ?? null,
    createdAt: linha.created_at,
  }));
}

export interface CategoriaDaCaixa {
  categoria: Categoria;
  quantidade: number;
}

export async function fetchCaixaDeSolicitacoes(): Promise<CategoriaDaCaixa[]> {
  const { data, error } = await supabase.rpc('caixa_de_solicitacoes');
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  // Uma categoria que este app não conhece (contrato futuro) fica de fora.
  return data
    .filter((linha) => ehCategoria(linha.categoria))
    .map((linha) => ({ categoria: linha.categoria as Categoria, quantidade: linha.quantidade }));
}

export type TipoDoItem = 'justificativa' | 'solicitacao' | 'retificacao_feita' | 'troca' | 'comprovante';

export interface ItemDaSolicitacao {
  tipo: TipoDoItem;
  id: string;
  classId: string | null;
  paymentId: string | null;
  userId: string | null;
  nome: string | null;
  titulo: string;
  quando: string;
  criadoEm: string;
}

export async function fetchItensDaSolicitacao(categoria: Categoria): Promise<ItemDaSolicitacao[]> {
  const { data, error } = await supabase.rpc('itens_da_solicitacao', { p_categoria: categoria });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    tipo: linha.tipo as TipoDoItem,
    id: linha.id,
    classId: linha.class_id ?? null,
    paymentId: linha.payment_id ?? null,
    userId: linha.user_id ?? null,
    nome: linha.nome ?? null,
    titulo: linha.titulo,
    quando: linha.quando,
    criadoEm: linha.criado_em,
  }));
}

export interface SolicitacaoParaDecidir {
  id: string;
  kind: TipoDeSolicitacao;
  classId: string;
  classTitle: string;
  classDateTime: string;
  subjectName: string | null;
  texto: string;
  anexos: number;
}

export async function fetchSolicitacaoParaDecidir(id: string): Promise<SolicitacaoParaDecidir> {
  const { data, error } = await supabase.rpc('solicitacao_para_decidir', { p_id: id });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  const linha = data[0];
  if (linha === undefined) {
    throw new Error('Solicitação não encontrada.');
  }
  return {
    id: linha.id,
    kind: linha.kind,
    classId: linha.class_id,
    classTitle: linha.class_title,
    classDateTime: linha.class_date_time,
    subjectName: linha.subject_name ?? null,
    texto: linha.texto,
    anexos: linha.anexos,
  };
}

/** D30 (c): o admin marca a retificação feita como conferida. */
export async function marcarRetificacaoConferida(motivoId: string): Promise<void> {
  const { error } = await supabase.rpc('marcar_retificacao_conferida', { p_motivo_id: motivoId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}
