import { apiDisponivel, chamarApi } from '@/lib/api';
import { lerErroDoBanco } from '@/lib/functionsError';
import { createLogger } from '@/lib/logger';
import { enviarArquivoAssinado, type ArquivoParaEnvio } from '@/lib/cloudinaryUpload';
import { supabase } from '@/lib/supabase';
import type { ComprovanteVisualizavel } from '@/services/proofs.service';
import type { Database } from '@/types/database.types';

const log = createLogger('justifications.service');

/**
 * Justificativas de falta (docs/FREQUENCIA.md).
 *
 * As REGRAS — quem pode enviar, quem revisa, o que cada um altera, o limite de
 * 255 caracteres — vivem no banco. As validações daqui existem só para dar ao
 * aluno uma mensagem legível antes da ida à rede; se forem burladas, o banco
 * recusa do mesmo jeito. [#51]
 */

export type JustificationRow = Database['public']['Tables']['absence_justifications']['Row'];
export type JustificationStatus = Database['public']['Enums']['justification_status'];

/** Mesmo teto da constraint `absence_justifications_mensagem_limite`. */
export const JUSTIFICATION_MESSAGE_MAX = 255;

export type EscopoDaJustificativa = Database['public']['Enums']['justification_scope'];

export interface NovaJustificativa {
  scope: EscopoDaJustificativa;
  /** De aula (fixo). */
  classId: string | null;
  /** De semana (livre): a segunda-feira, `AAAA-MM-DD`. */
  weekStart: string | null;
  texto: string;
  anexo: ArquivoParaEnvio | null;
}

/** Esta versão do app não tem backend configurado para receber anexos. */
export class AnexoIndisponivelError extends Error {
  constructor() {
    super('O envio de anexos não está disponível nesta versão. Envie só a mensagem.');
    this.name = 'AnexoIndisponivelError';
  }
}

/** Mensagem ou anexo inválidos, detectados antes de ir à rede. */
export class JustificativaInvalidaError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'JustificativaInvalidaError';
  }
}

/** Recusas que o banco escreve para a pessoa (§ 9.1). */
const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

function validarTexto(texto: string): string {
  const limpo = texto.trim();
  if (limpo === '') {
    throw new JustificativaInvalidaError('Escreva o motivo da falta.');
  }
  if (limpo.length > JUSTIFICATION_MESSAGE_MAX) {
    throw new JustificativaInvalidaError(`A justificativa pode ter até ${JUSTIFICATION_MESSAGE_MAX} caracteres.`);
  }
  return limpo;
}

/**
 * Envia a justificativa (contrato § 9.1): o texto é obrigatório, e o banco
 * confere grade, prazo (D13), troca (T38) e cota (T17).
 *
 * O anexo vai depois, pela rota que o servidor tem hoje (por aula); até o G2
 * a justificativa da semana vai sem anexo. Se o anexo falhar, a justificativa
 * fica só com o texto (§ 9.1, fluxo) e a função devolve `anexoFalhou`.
 *
 * @throws JustificativaInvalidaError texto vazio ou longo, ou anexo na semana.
 * @throws AnexoIndisponivelError     anexo pedido num build sem backend.
 */
export async function enviarJustificativa(input: NovaJustificativa): Promise<{ id: string; anexoFalhou: boolean }> {
  const texto = validarTexto(input.texto);
  if (input.anexo !== null) {
    if (input.scope === 'week' || input.classId === null) {
      throw new JustificativaInvalidaError('O anexo na justificativa da semana chega numa próxima versão. Envie só a mensagem.');
    }
    if (!apiDisponivel()) {
      throw new AnexoIndisponivelError();
    }
  }

  const { data: id, error } = await supabase.rpc('enviar_justificativa', {
    p_scope: input.scope,
    // O banco usa só o campo do escopo; o outro vai nulo.
    p_class_id: input.classId as string,
    p_week_start: input.weekStart as string,
    p_texto: texto,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }

  if (input.anexo === null || input.classId === null) {
    return { id, anexoFalhou: false };
  }
  try {
    const publicId = await enviarArquivoAssinado('/v1/justifications/sign-upload', { classId: input.classId }, input.anexo);
    // O dono troca o anexo da própria justificativa pendente (§ 9.1 f).
    const { error: erroDoAnexo } = await supabase
      .from('absence_justifications')
      .update({ proof_provider: 'cloudinary', proof_public_id: publicId })
      .eq('id', id);
    if (erroDoAnexo !== null) {
      throw erroDoAnexo;
    }
    return { id, anexoFalhou: false };
  } catch (falha) {
    log.warn('Justificativa enviada sem o anexo', falha);
    return { id, anexoFalhou: true };
  }
}

/** Reenvio da primeira negada, em até 7 dias (D42). */
export async function reenviarJustificativa(id: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('reenviar_justificativa', { p_id: id, p_texto: validarTexto(texto) });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}

/** Aprovar ou negar, com a nota obrigatória (D15). */
export async function decidirJustificativa(
  id: string,
  decisao: Exclude<JustificationStatus, 'pending'>,
  nota: string,
): Promise<void> {
  const { error } = await supabase.rpc('decidir_justificativa', { p_id: id, p_decisao: decisao, p_nota: nota.trim() });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
}

/** Uma linha de `minhas_justificativas` (§ 9.1). */
export interface MinhaJustificativa {
  id: string;
  scope: EscopoDaJustificativa;
  classId: string | null;
  classTitle: string | null;
  classDateTime: string | null;
  weekStart: string;
  message: string | null;
  hasAttachment: boolean;
  status: JustificationStatus;
  attempt: number;
  /** Só na aprovada (D16). */
  approvedByName: string | null;
  canResend: boolean;
  resendUntil: string | null;
  createdAt: string;
}

export async function fetchMinhasJustificativas(): Promise<MinhaJustificativa[]> {
  const { data, error } = await supabase.rpc('minhas_justificativas');
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    scope: linha.scope,
    classId: linha.class_id ?? null,
    classTitle: linha.class_title ?? null,
    classDateTime: linha.class_date_time ?? null,
    weekStart: linha.week_start,
    message: linha.message ?? null,
    hasAttachment: linha.has_attachment,
    status: linha.status,
    attempt: linha.attempt,
    approvedByName: linha.approved_by_name ?? null,
    canResend: linha.can_resend,
    resendUntil: linha.resend_until ?? null,
    createdAt: linha.created_at,
  }));
}

/** Uma linha de `justificativas_para_revisar` (§ 9.1). */
export interface JustificativaParaRevisar {
  id: string;
  scope: EscopoDaJustificativa;
  userId: string;
  studentName: string | null;
  classId: string | null;
  classTitle: string | null;
  classDateTime: string | null;
  weekStart: string;
  message: string | null;
  hasAttachment: boolean;
  attempt: number;
  createdAt: string;
}

export async function fetchJustificativasParaRevisar(): Promise<JustificativaParaRevisar[]> {
  const { data, error } = await supabase.rpc('justificativas_para_revisar');
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    id: linha.id,
    scope: linha.scope,
    userId: linha.user_id,
    studentName: linha.student_name ?? null,
    classId: linha.class_id ?? null,
    classTitle: linha.class_title ?? null,
    classDateTime: linha.class_date_time ?? null,
    weekStart: linha.week_start,
    message: linha.message ?? null,
    hasAttachment: linha.has_attachment,
    attempt: linha.attempt,
    createdAt: linha.created_at,
  }));
}

/** URL assinada do anexo (dono, professor da aula ou admin — decide a RLS). */
export async function fetchJustificationAttachmentUrl(
  justificationId: string,
  pagina = 1,
): Promise<ComprovanteVisualizavel> {
  return chamarApi<ComprovanteVisualizavel>('/v1/justifications/view-url', {
    justificationId,
    pagina,
  });
}
