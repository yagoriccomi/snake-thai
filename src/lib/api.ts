/**
 * Cliente HTTP único do backend próprio (Render) — `docs/BACKEND.md` §11.
 *
 * Existe para que nenhuma feature fale com `fetch` cru. Tudo que é comum a
 * qualquer chamada ao servidor mora aqui e em nenhum outro lugar: a base URL,
 * o `Authorization` com o JWT da sessão, o timeout longo, o retry e o
 * pré-aquecimento. [#6][#13]
 *
 * O QUE TORNA ESTE CLIENTE DIFERENTE DE UM WRAPPER QUALQUER: o plano free da
 * Render HIBERNA após ~15 min sem tráfego, e a primeira chamada depois disso
 * pode levar 30–60 s. Um cliente HTTP com timeout normal (10 s) transformaria
 * toda primeira chamada do dia num erro. Por isso o timeout é longo, há um
 * retry, e existe `preAquecer()`. [#82]
 */

import { env } from '@/config/env';
import { supabase } from '@/lib/supabase';

/**
 * Teto de espera por resposta. Dimensionado pelo cold start da Render
 * (30–60 s), não pela latência normal da rota (que é de milissegundos). [#3]
 */
const TIMEOUT_MS = 65_000;

/** Uma única retentativa: cobre o cold start sem virar tempestade de requisições. */
const TENTATIVAS = 2;

/** Espera entre a falha e a retentativa — dá tempo do contêiner terminar de subir. */
const ESPERA_ENTRE_TENTATIVAS_MS = 1_500;

/** Erro de negócio devolvido pelo servidor: `{ error, code }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(mensagem: string, status: number, code: string) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** O backend não foi configurado neste build (falta `EXPO_PUBLIC_API_URL`). */
export class ApiNaoConfiguradaError extends Error {
  constructor() {
    super(
      'O servidor do aplicativo não está configurado nesta versão. ' +
        'Fale com o administrador.',
    );
    this.name = 'ApiNaoConfiguradaError';
  }
}

/** `true` quando há backend configurado — deixa o chamador escolher o caminho. */
export function apiDisponivel(): boolean {
  return env.apiUrl !== null;
}

function baseUrlObrigatoria(): string {
  if (env.apiUrl === null) {
    throw new ApiNaoConfiguradaError();
  }
  return env.apiUrl;
}

async function tokenDaSessao(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token === undefined) {
    throw new ApiError('Sessão expirada. Entre novamente.', 401, 'no_session');
  }
  return token;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Uma tentativa isolada, com timeout próprio.
 *
 * O `AbortController` é criado por tentativa e não fora do laço: um controller
 * já abortado permanece abortado, e reaproveitá-lo faria a segunda tentativa
 * falhar instantaneamente — um retry que nunca tenta de verdade.
 */
async function tentar(url: string, init: RequestInit): Promise<Response> {
  const controlador = new AbortController();
  const cronometro = setTimeout(() => {
    controlador.abort();
  }, TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controlador.signal });
  } finally {
    clearTimeout(cronometro);
  }
}

/**
 * Requisição autenticada ao backend.
 *
 * Só repete em falha de REDE (servidor hibernando, conexão instável). Um 4xx
 * é resposta do servidor, não falha de transporte: repetir um 403 não muda o
 * resultado e só faz o usuário esperar o dobro. [#9]
 */
export async function chamarApi<T>(
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<T> {
  const url = `${baseUrlObrigatoria()}${caminho}`;
  const token = await tokenDaSessao();

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(corpo),
  };

  let ultimaFalhaDeRede: unknown = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    let resposta: Response;
    try {
      resposta = await tentar(url, init);
    } catch (erro) {
      ultimaFalhaDeRede = erro;
      if (tentativa < TENTATIVAS) {
        await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
        continue;
      }
      break;
    }

    if (resposta.ok) {
      return (await resposta.json()) as T;
    }

    // Resposta do servidor: é a palavra final, não se repete.
    const detalhe = (await resposta.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;

    throw new ApiError(
      detalhe?.error ?? 'Não foi possível concluir a operação.',
      resposta.status,
      detalhe?.code ?? 'erro_desconhecido',
    );
  }

  throw new ApiError(
    'O servidor não respondeu. Verifique sua conexão e tente novamente.',
    503,
    ultimaFalhaDeRede === null ? 'sem_resposta' : 'falha_de_rede',
  );
}

/**
 * Acorda o servidor sem bloquear a interface (`docs/BACKEND.md` §5).
 *
 * Dispare ao ABRIR a tela que vai usar o backend, não no momento do envio:
 * enquanto o usuário lê a tela e escolhe o arquivo, o contêiner sobe, e o
 * cold start acontece fora da espera dele.
 *
 * Deliberadamente sem `await` interno e sem propagar erro: se o
 * pré-aquecimento falhar, a chamada real ainda vai tentar — e é ela que tem
 * o direito de mostrar erro ao usuário. [#93]
 */
export function preAquecer(): void {
  if (env.apiUrl === null) return;

  void fetch(`${env.apiUrl}/health`, { method: 'GET' }).catch(() => {
    // Silêncio proposital: pré-aquecimento é otimização, não requisito.
  });
}
