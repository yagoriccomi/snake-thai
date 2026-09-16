import { NOME_COM_ARTIGO, ORDEM_DOS_DOCUMENTOS, type TipoDeDocumentoLegal } from '@/constants/legal';
import { formatFullDate } from '@/utils/datetime';

/** Pedaço de um documento legal já pronto para a tela. */
export interface BlocoDeTextoLegal {
  tipo: 'titulo' | 'secao' | 'paragrafo' | 'item';
  texto: string;
}

// O marcador sozinho ("#", "-") conta como vazio; colado no texto ("#tag"), não é marcador.
const TITULO = /^#(?:\s+(.*))?$/;
const SECAO = /^#{2,}(?:\s+(.*))?$/;
const ITEM = /^[-*](?:\s+(.*))?$/;

/**
 * Converte o texto de um documento legal em blocos.
 *
 * O texto vem de `docs/legal/` com uma marcação mínima (`#`, `##`, `- ` e linha
 * em branco entre parágrafos). Um parser de quatro regras evita uma dependência
 * de Markdown só para isso; o resto (negrito, links) aparece como texto puro.
 * Linhas seguidas sem linha em branco formam um único parágrafo.
 *
 * @param conteudo Texto publicado em `legal_documents.content`.
 * @returns Blocos na ordem do texto; vazio para texto em branco.
 */
export function parseLegalText(conteudo: string): BlocoDeTextoLegal[] {
  const blocos: BlocoDeTextoLegal[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = (): void => {
    if (paragrafo.length > 0) {
      blocos.push({ tipo: 'paragrafo', texto: paragrafo.join(' ') });
      paragrafo = [];
    }
  };

  for (const linhaCrua of conteudo.split(/\r?\n/)) {
    const linha = linhaCrua.trim();
    if (linha === '') {
      fecharParagrafo();
      continue;
    }
    const secao = SECAO.exec(linha);
    const titulo = secao === null ? TITULO.exec(linha) : null;
    const item = ITEM.exec(linha);
    const marcado = secao ?? titulo ?? item;
    if (marcado === null) {
      paragrafo.push(linha);
      continue;
    }
    fecharParagrafo();
    const texto = (marcado[1] ?? '').trim();
    if (texto === '') {
      continue;
    }
    blocos.push({ tipo: secao !== null ? 'secao' : titulo !== null ? 'titulo' : 'item', texto });
  }
  fecharParagrafo();
  return blocos;
}

/**
 * Ordena documentos pela ordem fixa das telas (política antes dos termos).
 * O banco ordena pelo enum, que declara os termos primeiro.
 */
export function ordenarDocumentosLegais<T extends { tipo: TipoDeDocumentoLegal }>(documentos: readonly T[]): T[] {
  return [...documentos].sort((a, b) => ORDEM_DOS_DOCUMENTOS.indexOf(a.tipo) - ORDEM_DOS_DOCUMENTOS.indexOf(b.tipo));
}

/** "Versão 1.0 · publicada em 16/09/2026". */
export function descreverVersaoDoDocumento(documento: { versao: string; publicadoEm: string }): string {
  return `Versão ${documento.versao} · publicada em ${formatFullDate(documento.publicadoEm)}`;
}

/** Situação do aceite do usuário logado para a versão vigente. */
export function descreverAceite(aceitoEm: string | null): string {
  return aceitoEm === null ? 'Você ainda não aceitou esta versão.' : `Você aceitou em ${formatFullDate(aceitoEm)}.`;
}

/**
 * Texto da caixa de concordância. Sem documento publicado, mantém a frase de
 * antes da L4; com documentos, cita exatamente os que estão sendo aceitos.
 */
export function rotuloDoAceite(documentos: readonly { tipo: TipoDeDocumentoLegal }[]): string {
  if (documentos.length === 0) {
    return 'Concordo com os Termos de Uso e a Política de Privacidade (LGPD).';
  }
  const nomes = ordenarDocumentosLegais(documentos).map((documento) => NOME_COM_ARTIGO[documento.tipo]);
  return `Li e concordo com ${nomes.join(' e ')}.`;
}
