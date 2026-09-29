/**
 * Os anexos (atestados e motivos) moram no Cloudinary e chegam por URL
 * assinada do servidor. Antes de abrir no navegador, confere o esquema e o
 * host: uma URL inesperada não é aberta (REVIEW-FASE4 S3). [#51]
 */
const ANEXO_CONFIAVEL = /^https:\/\/([a-z0-9-]+\.)*cloudinary\.com\//i;

export function ehUrlDeAnexoConfiavel(url: string): boolean {
  return ANEXO_CONFIAVEL.test(url);
}
