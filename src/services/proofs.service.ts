/**
 * Comprovantes de pagamento — envio e visualização.
 *
 * Extraído de `payments.service.ts`, que passou a acumular duas coisas
 * distintas: o CRUD financeiro (linhas da tabela `payments`) e o ciclo de vida
 * do ARQUIVO do comprovante, que agora envolve dois provedores e um backend
 * próprio. São eixos de mudança diferentes, então são arquivos diferentes. [#2][#16]
 *
 * REGRA CENTRAL DESTE MÓDULO — por que ele existe:
 * durante a migração para a Cloudinary existem comprovantes nos DOIS lugares.
 * Um APK antigo, ainda instalado, continua gravando no Supabase Storage. Quem
 * decide de onde ler cada arquivo é `proof_provider`, gravado na própria linha
 * do pagamento — nunca um palpite do app. É esta função que impede um admin de
 * receber link quebrado ao abrir um comprovante antigo. [#1]
 */

import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { PROOF_BUCKET } from '@/constants/payments';
import { apiDisponivel, chamarApi } from '@/lib/api';
import { enviarArquivoAssinado, sanitizeFileName } from '@/lib/cloudinaryUpload';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

type PaymentRow = Database['public']['Tables']['payments']['Row'];

/** Identifica o arquivo de um comprovante, seja qual for o provedor. */
export type ReferenciaDeComprovante = Pick<
  PaymentRow,
  'id' | 'proof_provider' | 'proof_public_id' | 'proof_storage_path' | 'proof_url'
>;

/** Validade da URL assinada do Storage, em segundos (comprovante legado). */
const VALIDADE_URL_LEGADA_SEGUNDOS = 600;

/** Resposta de `POST /v1/<módulo>/view-url`. */
export interface ComprovanteVisualizavel {
  url: string;
  /** Total de páginas do documento. `1` para imagem comum. */
  paginas: number;
  /** Qual página a `url` mostra. */
  pagina: number;
}

export interface ProofUpload {
  userId: string;
  paymentId: string;
  fileUri: string;
  fileName: string;
  contentType: string;
  /** base64 já lido (ex.: expo-image-picker) — evita reler o arquivo. */
  base64?: string;
}

/**
 * Envia o comprovante à Cloudinary. O caminho (assinatura no backend, arquivo
 * direto ao provedor, Blob exigido pelo SDK 57) vive em `@/lib/cloudinaryUpload`,
 * compartilhado com o anexo de justificativa de falta.
 */
async function enviarParaCloudinary(upload: ProofUpload): Promise<string> {
  return enviarArquivoAssinado(
    '/v1/proofs/sign-upload',
    { paymentId: upload.paymentId },
    { uri: upload.fileUri, name: upload.fileName },
  );
}

/** Caminho do comprovante legado no bucket privado: `<userId>/<arquivo>`. */
async function enviarParaStorage(upload: ProofUpload): Promise<string> {
  const path = `${upload.userId}/${upload.paymentId}_${sanitizeFileName(upload.fileName)}`;

  const raw =
    upload.base64 ??
    (await FileSystem.readAsStringAsync(upload.fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, decode(raw), { contentType: upload.contentType, upsert: true });
  if (error !== null) {
    throw error;
  }
  return path;
}

/**
 * Envia o comprovante e marca o pagamento como `pending_approval`.
 *
 * Sem backend configurado, cai no Supabase Storage — o caminho que sempre
 * funcionou. Um build sem `EXPO_PUBLIC_API_URL` continua enviando comprovante
 * em vez de exibir erro. [#9]
 */
export async function submitProof(upload: ProofUpload): Promise<void> {
  const campos = apiDisponivel()
    ? {
        proof_provider: 'cloudinary' as const,
        proof_public_id: await enviarParaCloudinary(upload),
        proof_storage_path: null,
      }
    : {
        proof_provider: 'supabase_storage' as const,
        proof_public_id: null,
        proof_storage_path: await enviarParaStorage(upload),
      };

  const { error } = await supabase
    .from('payments')
    .update({ status: 'pending_approval', ...campos })
    .eq('id', upload.paymentId);
  if (error !== null) {
    throw error;
  }
}

/**
 * URL para visualizar o comprovante, respeitando onde ele está guardado.
 *
 * `proof_provider` é a fonte da verdade. O `proof_url` só é consultado como
 * último recurso, para linhas gravadas antes da migration que introduziu as
 * colunas novas. [#15]
 */
export async function createSignedProofUrl(
  pagamento: ReferenciaDeComprovante,
  pagina = 1,
): Promise<ComprovanteVisualizavel> {
  if (pagamento.proof_provider === 'cloudinary') {
    return chamarApi<ComprovanteVisualizavel>('/v1/proofs/view-url', {
      paymentId: pagamento.id,
      pagina,
    });
  }

  const caminho = pagamento.proof_storage_path ?? pagamento.proof_url;
  if (caminho === null) {
    throw new Error('Este pagamento não tem comprovante.');
  }

  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(caminho, VALIDADE_URL_LEGADA_SEGUNDOS);
  if (error !== null) {
    throw error;
  }

  /*
   * O comprovante legado é entregue como está: o Storage não converte nem
   * pagina documentos. Declarar 1 página aqui não é um palpite — é o que a
   * tela pode oferecer para um arquivo que o app nunca soube dividir. O
   * caminho antigo continua exatamente como sempre foi. [#15]
   */
  return { url: data.signedUrl, paginas: 1, pagina: 1 };
}

/**
 * Remove o arquivo do comprovante do provedor onde ele estiver.
 *
 * Para a Cloudinary não há chamada aqui: limpar as colunas do pagamento
 * dispara o gatilho `trg_payments_enfileirar_exclusao_comprovante`, e o
 * servidor consome a fila. Uma exclusão que depende de o app estar aberto e
 * com rede não é uma exclusão confiável — e a LGPD não aceita "quase
 * apagado". [#25]
 */
export async function removerArquivoDoComprovante(
  pagamento: ReferenciaDeComprovante,
): Promise<void> {
  if (pagamento.proof_provider === 'cloudinary') {
    return;
  }

  const caminho = pagamento.proof_storage_path ?? pagamento.proof_url;
  if (caminho === null) {
    return;
  }
  await supabase.storage.from(PROOF_BUCKET).remove([caminho]);
}
