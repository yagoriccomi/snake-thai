import type { TipoDeDocumentoLegal } from '@/constants/legal';
import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';

/**
 * Serviço dos dados que a academia preenche para montar a Política e os Termos
 * (`legal_field_values`). Só o admin alcança — garantido pela RLS.
 *
 * O texto final é montado pelo banco; aqui só se guardam os valores e se pede
 * a prévia.
 */

/** Prévia de um documento, com o que ainda falta preencher. */
export interface PreviaDoDocumento {
  conteudo: string;
  /** Chaves sem valor; o marcador delas continua no texto. */
  faltando: string[];
}

const TABELA = 'legal_field_values';

/** Valores já preenchidos, por chave. */
export async function fetchLegalFieldValues(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from(TABELA).select('id, value');
  if (error !== null) {
    throw error;
  }
  const valores: Record<string, string> = {};
  for (const linha of data ?? []) {
    if (typeof linha.id === 'string' && typeof linha.value === 'string') {
      valores[linha.id] = linha.value;
    }
  }
  return valores;
}

/**
 * Grava os valores informados e apaga os que ficaram em branco.
 *
 * Campo vazio é apagado em vez de gravado como '': assim o banco continua
 * sabendo que ele falta, e a publicação segue recusada até alguém preencher.
 */
export async function saveLegalFieldValues(valores: Record<string, string>): Promise<void> {
  const paraGravar = Object.entries(valores)
    .map(([id, value]) => ({ id, value: value.trim() }))
    .filter((linha) => linha.value !== '');
  const paraApagar = Object.entries(valores)
    .filter(([, value]) => value.trim() === '')
    .map(([id]) => id);

  if (paraApagar.length > 0) {
    const { error } = await supabase.from(TABELA).delete().in('id', paraApagar);
    if (error !== null) {
      throw lerErroDoBanco(error, ['23514', '42501']);
    }
  }
  if (paraGravar.length > 0) {
    const { error } = await supabase.from(TABELA).upsert(paraGravar, { onConflict: 'id' });
    if (error !== null) {
      throw lerErroDoBanco(error, ['23514', '42501']);
    }
  }
}

/** Texto do documento como ficaria hoje, com os valores já preenchidos. */
export async function previewLegalDocument(tipo: TipoDeDocumentoLegal): Promise<PreviaDoDocumento> {
  const { data, error } = await supabase.rpc('renderizar_documento_legal', { p_tipo: tipo });
  if (error !== null) {
    throw lerErroDoBanco(error, ['23503', '42501']);
  }
  const linha = (data ?? [])[0];
  if (linha === undefined || typeof linha.conteudo !== 'string') {
    throw new Error('Resposta inesperada do banco (renderizar_documento_legal).');
  }
  return {
    conteudo: linha.conteudo,
    faltando: Array.isArray(linha.faltando) ? linha.faltando.filter((c): c is string => typeof c === 'string') : [],
  };
}
