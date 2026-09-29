import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

/**
 * Troca de aula (contrato § 9.4): o fixo pede, a equipe da aula nova decide,
 * o aluno desiste. Todas as regras (T33–T50) ficam no banco. [#6]
 */

type Enums = Database['public']['Enums'];

export type TipoDeTroca = Enums['class_swap_kind'];
export type EstadoDaTroca = Enums['class_swap_status'];

const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

const SEM_AULA = null as unknown as string;

/**
 * Pede a troca. Na permanente, o texto vira o motivo (§ 8) antes do pedido;
 * os anexos entram depois do G2.
 */
export async function pedirTroca(de: string, para: string, tipo: TipoDeTroca, texto: string | null): Promise<string> {
  let motivoId: string | undefined;
  if (tipo === 'permanent') {
    const { data, error } = await supabase.rpc('criar_motivo', {
      p_kind: 'class_swap_evidence',
      // A justificativa da troca pertence à troca, não a uma aula (§ 8): a
      // coluna é nula, mas o gerador de tipos não sabe que o argumento aceita null.
      p_class_id: SEM_AULA,
      p_texto: (texto ?? '').trim(),
    });
    if (error !== null) {
      throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
    }
    motivoId = data;
  }
  const { data, error } = await supabase.rpc('pedir_troca_de_aula', {
    p_de: de,
    p_para: para,
    p_tipo: tipo,
    p_motivo_id: motivoId,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data;
}

/** Aprovar ou negar (T41: a nota é obrigatória para negar e na permanente). */
export async function decidirTroca(id: string, decisao: 'approved' | 'rejected', nota: string): Promise<void> {
  const limpa = nota.trim();
  const { error } = await supabase.rpc('decidir_troca_de_aula', {
    p_id: id,
    p_decisao: decisao,
    p_nota: limpa === '' ? undefined : limpa,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}

export async function desistirDaTroca(id: string): Promise<void> {
  const { error } = await supabase.rpc('desistir_da_troca', { p_id: id });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}

/** Uma linha de `minhas_trocas`. */
export interface MinhaTroca {
  id: string;
  kind: TipoDeTroca;
  status: EstadoDaTroca;
  decidedVia: string | null;
  fromTitle: string | null;
  fromDateTime: string | null;
  toTitle: string | null;
  toDateTime: string | null;
  isMakeup: boolean;
  motivoTexto: string | null;
  /** Só na aprovada, e nunca na aprovada pelo sistema (D16, T50). */
  approvedByName: string | null;
  canCancel: boolean;
  createdAt: string;
}

export async function fetchMinhasTrocas(): Promise<MinhaTroca[]> {
  const { data, error } = await supabase.rpc('minhas_trocas', {});
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    kind: linha.kind,
    status: linha.status,
    decidedVia: linha.decided_via ?? null,
    fromTitle: linha.from_title ?? null,
    fromDateTime: linha.from_date_time ?? null,
    toTitle: linha.to_title ?? null,
    toDateTime: linha.to_date_time ?? null,
    isMakeup: linha.is_makeup,
    motivoTexto: linha.motivo_texto ?? null,
    approvedByName: linha.approved_by_name ?? null,
    canCancel: linha.can_cancel,
    createdAt: linha.created_at,
  }));
}

/** Uma linha de `trocas_para_decidir`. */
export interface TrocaParaDecidir {
  id: string;
  kind: TipoDeTroca;
  studentName: string | null;
  fromTitle: string | null;
  fromDateTime: string | null;
  fromGroupName: string | null;
  fromStatus: Enums['attendance_status'] | null;
  toTitle: string | null;
  toDateTime: string | null;
  toGroupName: string | null;
  toScheduleEndsOn: string | null;
  isMakeup: boolean;
  motivoTexto: string | null;
  anexos: number;
}

export async function fetchTrocasParaDecidir(): Promise<TrocaParaDecidir[]> {
  const { data, error } = await supabase.rpc('trocas_para_decidir');
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    kind: linha.kind,
    studentName: linha.student_name ?? null,
    fromTitle: linha.from_title ?? null,
    fromDateTime: linha.from_date_time ?? null,
    fromGroupName: linha.from_group_name ?? null,
    fromStatus: linha.from_status ?? null,
    toTitle: linha.to_title ?? null,
    toDateTime: linha.to_date_time ?? null,
    toGroupName: linha.to_group_name ?? null,
    toScheduleEndsOn: linha.to_schedule_ends_on ?? null,
    isMakeup: linha.is_makeup,
    motivoTexto: linha.motivo_texto ?? null,
    anexos: Array.isArray(linha.anexos) ? linha.anexos.length : 0,
  }));
}
