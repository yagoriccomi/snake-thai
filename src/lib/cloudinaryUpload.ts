import { chamarApi } from '@/lib/api';

/**
 * Envio de arquivo à Cloudinary com assinatura emitida pelo backend.
 *
 * Existe como módulo próprio porque há dois consumidores — comprovante de
 * pagamento e anexo de justificativa de falta — e o caminho tem armadilhas
 * que já custaram caro (o `Blob` exigido pelo `fetch` do SDK 57, a resposta
 * de erro da Cloudinary descartada). Duas cópias disso divergiriam na
 * primeira correção. [#6]
 */

/** Resposta dos endpoints `POST /v1/<módulo>/sign-upload` do backend. */
export interface UploadAssinado {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  public_id: string;
  type: string;
  uploadUrl: string;
}

/** O arquivo escolhido pelo usuário, como chega do seletor. */
export interface ArquivoParaEnvio {
  uri: string;
  name: string;
}

/** Remove caracteres perigosos do nome do arquivo antes de compor o caminho. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Pede a assinatura ao backend e envia o arquivo DIRETO à Cloudinary.
 *
 * O arquivo não passa pelo nosso servidor: ele só assina (JSON pequeno), o que
 * permite ao backend limitar o corpo a 32kb sem impedir arquivos de vários
 * megabytes. A pasta e o nome vêm NA RESPOSTA, derivados do token verificado —
 * o app não escolhe onde grava, e é isso que impede um aluno de gravar na
 * pasta de outro. [#55][#65]
 *
 * @param rotaDeAssinatura Ex.: `/v1/proofs/sign-upload`.
 * @param corpo            Corpo da requisição de assinatura (ex.: `{ paymentId }`).
 * @param arquivo          O arquivo local a enviar.
 * @returns O `public_id` definitivo devolvido pela Cloudinary.
 */
export async function enviarArquivoAssinado(
  rotaDeAssinatura: string,
  corpo: Record<string, unknown>,
  arquivo: ArquivoParaEnvio,
): Promise<string> {
  const assinatura = await chamarApi<UploadAssinado>(rotaDeAssinatura, corpo);

  // O arquivo vai como Blob de verdade, e não como o `{ uri, name, type }`
  // que o React Native aceitava: o `fetch` do Expo SDK 57 rejeita aquele
  // formato com "Unsupported FormDataPart implementation" — e a falha
  // acontece ao MONTAR o corpo, antes de qualquer byte sair do aparelho. [#9]
  const conteudo = await fetch(arquivo.uri).then(async (r) => r.blob());

  const formulario = new FormData();
  formulario.append('file', conteudo, sanitizeFileName(arquivo.name));
  formulario.append('api_key', assinatura.apiKey);
  formulario.append('timestamp', String(assinatura.timestamp));
  formulario.append('signature', assinatura.signature);
  formulario.append('folder', assinatura.folder);
  formulario.append('public_id', assinatura.public_id);
  formulario.append('type', assinatura.type);

  const resposta = await fetch(assinatura.uploadUrl, { method: 'POST', body: formulario });
  if (!resposta.ok) {
    // A Cloudinary explica a recusa no corpo. Descartá-lo transforma qualquer
    // problema de upload num "falha ao enviar" sem causa. O texto vai para o
    // LOG; a tela continua com a mensagem amigável. [#93]
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(
      `Cloudinary recusou o upload (HTTP ${resposta.status}): ${detalhe.slice(0, 300)}`,
    );
  }

  const enviado = (await resposta.json()) as { public_id?: string };
  // O esperado é o public_id que o servidor assinou, mas quem manda é a
  // resposta do provedor.
  return enviado.public_id ?? `${assinatura.folder}/${assinatura.public_id}`;
}
