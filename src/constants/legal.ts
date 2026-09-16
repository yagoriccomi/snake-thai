import type { Database } from '@/types/database.types';

/** Tipo de documento legal, como o banco guarda (`legal_document_kind`). */
export type TipoDeDocumentoLegal = Database['public']['Enums']['legal_document_kind'];

/** Ordem de exibição: a política vem antes dos termos em todas as telas. */
export const ORDEM_DOS_DOCUMENTOS: readonly TipoDeDocumentoLegal[] = ['privacy_policy', 'terms_of_use'];

/** Nome de cada documento na tela. */
export const TITULO_DO_DOCUMENTO: Record<TipoDeDocumentoLegal, string> = {
  privacy_policy: 'Política de Privacidade',
  terms_of_use: 'Termos de Uso',
};

/** Nome com artigo, para compor frases ("Li e concordo com a Política…"). */
export const NOME_COM_ARTIGO: Record<TipoDeDocumentoLegal, string> = {
  privacy_policy: 'a Política de Privacidade',
  terms_of_use: 'os Termos de Uso',
};

/** Texto do link que abre a leitura. */
export const ACAO_DE_LER_O_DOCUMENTO: Record<TipoDeDocumentoLegal, string> = {
  privacy_policy: 'Ler a Política de Privacidade',
  terms_of_use: 'Ler os Termos de Uso',
};

/** Rótulo curto para as abas do Perfil (o nome inteiro não cabe em meia tela). */
export const ROTULO_CURTO_DO_DOCUMENTO: Record<TipoDeDocumentoLegal, string> = {
  privacy_policy: 'Privacidade',
  terms_of_use: 'Termos de Uso',
};
