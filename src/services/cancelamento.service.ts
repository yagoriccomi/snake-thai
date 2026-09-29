import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * Cancelar e reativar aula (contrato § 6.1). Quem é avisado, as trocas e o
 * abono são decididos no banco; aqui só se chama e se traduz. [#6]
 */

type Enums = Database['public']['Enums'];

/** A prévia da folha "Cancelar aula" (`quem_sera_avisado`). */
export interface PreviaDosAvisos {
  antesDaAula: boolean;
  fixos: number;
  livres: number;
  alunosDoEvento: number;
  /** Os outros professores da aula (quem cancela fica de fora). */
  professores: string[];
  admins: number;
}

export interface MotivoDaAula {
  id: string;
  kind: Enums['action_reason_kind'];
  authorName: string | null;
  createdAt: string;
  body: string;
}

const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

export async function fetchPreviaDosAvisos(classId: string): Promise<PreviaDosAvisos> {
  const { data, error } = await supabase.rpc('quem_sera_avisado', { p_class_id: classId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  const linha = data[0];
  return {
    antesDaAula: linha?.antes_da_aula === true,
    fixos: linha?.fixos ?? 0,
    livres: linha?.livres ?? 0,
    alunosDoEvento: linha?.alunos_evento ?? 0,
    professores: linha?.professores ?? [],
    admins: linha?.admins ?? 0,
  };
}

/** Os motivos da aula que quem chama pode ler (a mesma regra da RLS, § 8). */
export async function fetchMotivosDaAula(classId: string): Promise<MotivoDaAula[]> {
  const { data, error } = await supabase.rpc('motivos_da_aula', { p_class_id: classId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    kind: linha.kind,
    authorName: linha.author_name ?? null,
    createdAt: linha.created_at,
    body: linha.body,
  }));
}

/** Cancela ou reativa: cria o motivo (§ 8) e chama a RPC que o consome. */
export async function mudarSituacaoDaAula(classId: string, acao: 'cancelar' | 'reativar', texto: string): Promise<void> {
  const { data: motivoId, error: erroDoMotivo } = await supabase.rpc('criar_motivo', {
    p_kind: acao === 'cancelar' ? 'class_cancel' : 'class_reactivate',
    p_class_id: classId,
    p_texto: texto,
  });
  if (erroDoMotivo !== null) {
    throw lerErroDoBanco(erroDoMotivo, RECUSAS_COM_FRASE);
  }
  const { error } = await supabase.rpc(acao === 'cancelar' ? 'cancelar_aula' : 'reativar_aula', {
    p_class_id: classId,
    p_motivo_id: motivoId,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}
