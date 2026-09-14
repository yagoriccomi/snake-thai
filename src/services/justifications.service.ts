import { apiDisponivel, chamarApi } from '@/lib/api';
import { enviarArquivoAssinado, type ArquivoParaEnvio } from '@/lib/cloudinaryUpload';
import { supabase } from '@/lib/supabase';
import type { ComprovanteVisualizavel } from '@/services/proofs.service';
import type { Database } from '@/types/database.types';

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

export interface JustificationInput {
  classId: string;
  message: string | null;
  attachment: ArquivoParaEnvio | null;
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

/**
 * Envia a justificativa de falta do aluno — ou a substitui, enquanto ainda
 * estiver pendente de revisão.
 *
 * Pré-condição: a declaração de ausência já precisa estar gravada
 * (`declareAttendance(..., 'absent')`); sem ela o banco recusa, porque não há
 * falta declarada a justificar.
 *
 * Reenviar sem anexo REMOVE o anexo anterior — o gatilho do banco o manda para
 * a fila de eliminação (LGPD). É intencional: a justificativa enviada é a que
 * vale.
 *
 * @throws JustificativaInvalidaError mensagem vazia sem anexo, ou acima do limite.
 * @throws AnexoIndisponivelError     anexo pedido num build sem backend.
 */
export async function submitJustification(
  userId: string,
  input: JustificationInput,
): Promise<void> {
  const mensagem = input.message?.trim() ?? '';

  if (mensagem.length > JUSTIFICATION_MESSAGE_MAX) {
    throw new JustificativaInvalidaError(
      `A justificativa pode ter até ${JUSTIFICATION_MESSAGE_MAX} caracteres.`,
    );
  }
  if (mensagem === '' && input.attachment === null) {
    throw new JustificativaInvalidaError('Escreva uma mensagem ou anexe um arquivo.');
  }

  let anexo: { proof_provider: 'cloudinary' | null; proof_public_id: string | null } = {
    proof_provider: null,
    proof_public_id: null,
  };

  if (input.attachment !== null) {
    if (!apiDisponivel()) {
      throw new AnexoIndisponivelError();
    }
    // Sobe ANTES de gravar a linha: gravar primeiro deixaria no banco uma
    // justificativa apontando para um arquivo que talvez nunca chegue.
    const publicId = await enviarArquivoAssinado(
      '/v1/justifications/sign-upload',
      { classId: input.classId },
      input.attachment,
    );
    anexo = { proof_provider: 'cloudinary', proof_public_id: publicId };
  }

  const { error } = await supabase.from('absence_justifications').upsert(
    {
      class_id: input.classId,
      user_id: userId,
      message: mensagem === '' ? null : mensagem,
      ...anexo,
    },
    { onConflict: 'class_id,user_id' },
  );
  if (error !== null) {
    throw error;
  }
}

/** Justificativas do próprio aluno. */
export async function fetchOwnJustifications(userId: string): Promise<JustificationRow[]> {
  const { data, error } = await supabase
    .from('absence_justifications')
    .select('*')
    .eq('user_id', userId);
  if (error !== null) {
    throw error;
  }
  return data;
}

/** Justificativas de uma aula — visão do professor da aula e do admin (RLS). */
export async function fetchJustificationsForClass(classId: string): Promise<JustificationRow[]> {
  const { data, error } = await supabase
    .from('absence_justifications')
    .select('*')
    .eq('class_id', classId);
  if (error !== null) {
    throw error;
  }
  return data;
}

/**
 * Aprova ou recusa uma justificativa. Só o professor da aula ou o admin; quem
 * revisou e quando são carimbados pelo banco, não enviados daqui — o app não
 * escolhe em nome de quem a revisão ficou registrada.
 */
export async function reviewJustification(
  justificationId: string,
  status: Exclude<JustificationStatus, 'pending'>,
): Promise<void> {
  const { error } = await supabase
    .from('absence_justifications')
    .update({ status })
    .eq('id', justificationId);
  if (error !== null) {
    throw error;
  }
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
