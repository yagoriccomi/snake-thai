import { ORDEM_DOS_DOCUMENTOS, type TipoDeDocumentoLegal } from '@/constants/legal';
import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import { ordenarDocumentosLegais } from '@/utils/legalText';

/**
 * Serviço dos documentos legais (Política de Privacidade e Termos de Uso).
 *
 * Publicar é por migration (docs/legal/README.md); o app só lê o que está
 * vigente e registra o aceite, sempre por função do banco, que confere se a
 * versão aceita ainda é a vigente.
 */

/** Documento vigente que o usuário ainda não aceitou (sem o texto). */
export interface DocumentoLegalPendente {
  id: string;
  tipo: TipoDeDocumentoLegal;
  versao: string;
  /** ISO. */
  publicadoEm: string;
}

/** Documento vigente com o texto e a data do aceite do usuário logado. */
export interface DocumentoLegalVigente extends DocumentoLegalPendente {
  conteudo: string;
  /** ISO; `null` quando o usuário ainda não aceitou esta versão. */
  aceitoEm: string | null;
}

function respostaInesperada(funcao: string, campo: string): Error {
  return new Error(`Resposta inesperada do banco (${funcao}.${campo}).`);
}

function texto(valor: unknown, funcao: string, campo: string): string {
  if (typeof valor !== 'string') {
    throw respostaInesperada(funcao, campo);
  }
  return valor;
}

function tipoDoDocumento(valor: unknown, funcao: string): TipoDeDocumentoLegal {
  const tipo = ORDEM_DOS_DOCUMENTOS.find((conhecido) => conhecido === valor);
  if (tipo === undefined) {
    throw respostaInesperada(funcao, 'tipo');
  }
  return tipo;
}

interface LinhaDeDocumento {
  id?: unknown;
  tipo?: unknown;
  versao?: unknown;
  publicado_em?: unknown;
}

function lerPendente(linha: LinhaDeDocumento, funcao: string): DocumentoLegalPendente {
  return {
    id: texto(linha.id, funcao, 'id'),
    tipo: tipoDoDocumento(linha.tipo, funcao),
    versao: texto(linha.versao, funcao, 'versao'),
    publicadoEm: texto(linha.publicado_em, funcao, 'publicado_em'),
  };
}

const PENDENTES = 'documentos_legais_pendentes';
const VIGENTES = 'documentos_legais_vigentes';

/**
 * Documentos vigentes que o usuário logado ainda não aceitou. Leve (sem o
 * texto): roda a cada abertura do app.
 */
export async function fetchPendingLegalDocuments(): Promise<DocumentoLegalPendente[]> {
  const { data, error } = await supabase.rpc(PENDENTES);
  if (error !== null) {
    throw error;
  }
  return ordenarDocumentosLegais((data ?? []).map((linha) => lerPendente(linha, PENDENTES)));
}

/** Documentos vigentes com o texto e a data do aceite do usuário logado. */
export async function fetchCurrentLegalDocuments(): Promise<DocumentoLegalVigente[]> {
  const { data, error } = await supabase.rpc(VIGENTES);
  if (error !== null) {
    throw error;
  }
  return ordenarDocumentosLegais(
    (data ?? []).map((linha) => {
      // O tipo gerado diz `string`, mas quem não aceitou recebe nulo.
      const aceitoEm: unknown = linha.aceito_em;
      return {
        ...lerPendente(linha, VIGENTES),
        conteudo: texto(linha.conteudo, VIGENTES, 'conteudo'),
        aceitoEm: aceitoEm === null ? null : texto(aceitoEm, VIGENTES, 'aceito_em'),
      };
    }),
  );
}

/**
 * Registra o aceite do usuário logado. Repetir não duplica.
 *
 * @param ids Documentos lidos na tela, todos vigentes.
 * @throws Erro com a mensagem do banco quando a versão mudou enquanto a pessoa
 *   lia ("Os documentos foram atualizados…"): a tela recarrega e pede de novo.
 */
export async function acceptLegalDocuments(ids: readonly string[]): Promise<void> {
  const { error } = await supabase.rpc('aceitar_documentos_legais', { p_documentos: [...ids] });
  if (error !== null) {
    throw lerErroDoBanco(error, ['23514', '42501']);
  }
}
