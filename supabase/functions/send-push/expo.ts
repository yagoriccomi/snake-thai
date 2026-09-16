// ============================================================================
// Conversa com o serviço de push da Expo — funções puras e chamadas HTTP com
// `fetch` injetável, para os testes não saírem para a rede.
// Referência: docs.expo.dev/push-notifications/sending-notifications
// ============================================================================
import { conteudoDaNotificacao, type NotificacaoDaFila } from './mensagens.ts';

/** Limites da Expo: 100 mensagens por envio, 1000 ids por consulta de recibo. */
export const MENSAGENS_POR_ENVIO = 100;
export const RECIBOS_POR_CONSULTA = 1000;

export const EXPO_API_PADRAO = 'https://exp.host/--/api/v2/push';

/** Erros que indicam credencial do FCM/EAS errada: nada vai sair até corrigir. */
export const ERROS_DE_CONFIGURACAO = new Set(['InvalidCredentials', 'MismatchSenderId']);

export function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/** Compara o segredo em tempo constante (não vaza o tamanho do prefixo certo). */
export function compararSegredo(recebido: string, esperado: string): boolean {
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  let diferenca = a.length ^ b.length;
  const tamanho = Math.max(a.length, b.length);
  for (let i = 0; i < tamanho; i += 1) {
    diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diferenca === 0 && esperado.length > 0;
}

export interface Ticket {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ResultadoDoTicket {
  ok: boolean;
  ticketId: string | null;
  errorCode: string | null;
}

export function classificarTicket(ticket: Ticket | undefined): ResultadoDoTicket {
  if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
    return { ok: true, ticketId: ticket.id, errorCode: null };
  }
  return { ok: false, ticketId: null, errorCode: ticket?.details?.error ?? 'SemTicket' };
}

export interface Recibo {
  status?: string;
  details?: { error?: string };
}

export function classificarRecibo(recibo: Recibo): { ok: boolean; errorCode: string | null } {
  if (recibo.status === 'ok') {
    return { ok: true, errorCode: null };
  }
  return { ok: false, errorCode: recibo.details?.error ?? 'ErroDesconhecido' };
}

/** Uma linha de reivindicar_notificacoes. */
export interface LinhaReivindicada extends NotificacaoDaFila {
  outbox_id: string;
  recipient_id: string;
  device_id: string;
  expo_token: string;
}

export interface MensagemExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channelId: string;
  priority: 'high';
  ttl: number;
}

/** Uma mensagem para um aparelho e as notificações da fila que ela atende. */
export interface Envio {
  mensagem: MensagemExpo;
  outboxIds: string[];
  deviceId: string;
}

const UM_DIA = 24 * 60 * 60;
const DOZE_HORAS = 12 * 60 * 60;

/**
 * Transforma as linhas reivindicadas em mensagens. Comprovantes enviados para o
 * mesmo admin viram UMA mensagem ("3 comprovantes para analisar"), para um
 * lote de envios não disparar 3 alertas seguidos.
 */
export function montarEnvios(linhas: readonly LinhaReivindicada[]): Envio[] {
  const grupos = new Map<string, LinhaReivindicada[]>();
  for (const linha of linhas) {
    const chave = linha.kind === 'comprovante_enviado'
      ? `${linha.recipient_id}|comprovante_enviado|${linha.device_id}`
      : `${linha.outbox_id}|${linha.device_id}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(linha);
    grupos.set(chave, grupo);
  }

  const envios: Envio[] = [];
  for (const grupo of grupos.values()) {
    const primeira = grupo[0];
    if (primeira === undefined) continue;
    const outboxIds = [...new Set(grupo.map((linha) => linha.outbox_id))];
    const conteudo = conteudoDaNotificacao(primeira, outboxIds.length);
    envios.push({
      deviceId: primeira.device_id,
      outboxIds,
      mensagem: {
        to: primeira.expo_token,
        title: conteudo.title,
        body: conteudo.body,
        data: conteudo.data,
        channelId: conteudo.channelId,
        priority: 'high',
        ttl: conteudo.channelId === 'financeiro' ? UM_DIA : DOZE_HORAS,
      },
    });
  }
  return envios;
}

export interface OpcoesDaExpo {
  baseUrl: string;
  accessToken: string | null;
  fetch: typeof fetch;
}

function cabecalhos(opcoes: OpcoesDaExpo): Record<string, string> {
  return {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(opcoes.accessToken ? { Authorization: `Bearer ${opcoes.accessToken}` } : {}),
  };
}

/** Envia um lote; devolve os tickets na mesma ordem, ou o erro HTTP do lote inteiro. */
export async function enviarLote(
  mensagens: readonly MensagemExpo[],
  opcoes: OpcoesDaExpo,
): Promise<{ tickets: Ticket[] } | { erro: string }> {
  try {
    const resposta = await opcoes.fetch(`${opcoes.baseUrl}/send`, {
      method: 'POST',
      headers: cabecalhos(opcoes),
      body: JSON.stringify(mensagens),
    });
    if (!resposta.ok) {
      return { erro: `HTTP_${resposta.status}` };
    }
    const corpo = (await resposta.json()) as { data?: Ticket[] };
    return { tickets: Array.isArray(corpo.data) ? corpo.data : [] };
  } catch {
    return { erro: 'REDE' };
  }
}

/** Consulta recibos; ids ainda sem recibo simplesmente não vêm na resposta. */
export async function buscarRecibos(
  ticketIds: readonly string[],
  opcoes: OpcoesDaExpo,
): Promise<{ recibos: Record<string, Recibo> } | { erro: string }> {
  try {
    const resposta = await opcoes.fetch(`${opcoes.baseUrl}/getReceipts`, {
      method: 'POST',
      headers: cabecalhos(opcoes),
      body: JSON.stringify({ ids: ticketIds }),
    });
    if (!resposta.ok) {
      return { erro: `HTTP_${resposta.status}` };
    }
    const corpo = (await resposta.json()) as { data?: Record<string, Recibo> };
    return { recibos: corpo.data ?? {} };
  } catch {
    return { erro: 'REDE' };
  }
}
