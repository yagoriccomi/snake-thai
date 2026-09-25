import AsyncStorage from '@react-native-async-storage/async-storage';

import { URL_DA_ULTIMA_RELEASE, type ReleaseDoGithub } from '@/utils/avisoDeAtualizacao';

/**
 * Consulta da última release no GitHub e memória do "dia já consultado"
 * (contrato § 12.3, T48).
 *
 * Sem token: o repositório é público. O GitHub libera 60 consultas por hora
 * por IP, e na Wi-Fi da academia vários celulares dividem o IP — por isso uma
 * consulta por dia, e 403/429 também contam o dia.
 */

/** Tempo máximo da consulta: o aviso nunca pode segurar o app. */
export const TEMPO_MAXIMO_DA_CONSULTA_MS = 5_000;

/** Respostas do limite de consultas do GitHub: contam o dia como consultado. */
const STATUS_DE_LIMITE: readonly number[] = [403, 429];

/** Dado não sensível (data e tag pública): texto puro no AsyncStorage. */
const CHAVE_DA_MEMORIA = 'snakethai.aviso_de_atualizacao';

export type ResultadoDaConsulta =
  /** Resposta 200 com JSON: o hook decide se há versão nova. */
  | { tipo: 'release'; release: ReleaseDoGithub }
  /** 403 ou 429: não mostra, mas o dia conta como consultado. */
  | { tipo: 'limite'; status: number }
  /** Sem rede, tempo esgotado, outro status ou JSON inválido: tenta de novo depois. */
  | { tipo: 'falha'; motivo: string; erro?: unknown };

/** O que o aparelho lembra entre aberturas do app. */
export interface MemoriaDoAviso {
  /** Último dia (AAAA-MM-DD, São Paulo) em que a consulta teve resposta. */
  dia: string;
  /** Última tag vista na resposta, se houve. */
  ultimaTag: string | null;
}

type Buscar = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Pergunta ao GitHub qual é a última release publicada. Nunca lança: toda
 * falha vira um resultado, para a abertura do app não depender disto.
 *
 * @param buscar `fetch` (substituível nos testes).
 * @param tempoMaximoMs Depois disso, a consulta é abortada.
 */
export async function buscarUltimaRelease(
  buscar: Buscar = fetch,
  tempoMaximoMs: number = TEMPO_MAXIMO_DA_CONSULTA_MS,
): Promise<ResultadoDaConsulta> {
  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), tempoMaximoMs);
  try {
    const resposta = await buscar(URL_DA_ULTIMA_RELEASE, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      signal: controlador.signal,
    });
    if (STATUS_DE_LIMITE.includes(resposta.status)) {
      return { tipo: 'limite', status: resposta.status };
    }
    if (!resposta.ok) {
      return { tipo: 'falha', motivo: `status ${resposta.status}` };
    }
    const corpo: unknown = await resposta.json();
    if (typeof corpo !== 'object' || corpo === null) {
      return { tipo: 'falha', motivo: 'resposta sem objeto' };
    }
    return { tipo: 'release', release: corpo as ReleaseDoGithub };
  } catch (erro) {
    const motivo = controlador.signal.aborted ? 'tempo esgotado' : 'sem rede ou resposta inválida';
    return { tipo: 'falha', motivo, erro };
  } finally {
    clearTimeout(relogio);
  }
}

/** O que foi lembrado; `null` na primeira vez ou se o armazenamento falhar. */
export async function lerMemoriaDoAviso(): Promise<MemoriaDoAviso | null> {
  const guardado = await AsyncStorage.getItem(CHAVE_DA_MEMORIA);
  if (guardado === null) return null;
  try {
    const valor: unknown = JSON.parse(guardado);
    if (typeof valor !== 'object' || valor === null) return null;
    const { dia, ultimaTag } = valor as Partial<MemoriaDoAviso>;
    if (typeof dia !== 'string') return null;
    return { dia, ultimaTag: typeof ultimaTag === 'string' ? ultimaTag : null };
  } catch {
    // Valor corrompido vale como "nunca consultou": no pior caso, uma consulta a mais.
    return null;
  }
}

export async function gravarMemoriaDoAviso(memoria: MemoriaDoAviso): Promise<void> {
  await AsyncStorage.setItem(CHAVE_DA_MEMORIA, JSON.stringify(memoria));
}
