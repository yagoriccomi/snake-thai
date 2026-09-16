import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

/**
 * Filtros de dado pessoal para tudo que sai do aparelho rumo ao monitoramento.
 *
 * Funções puras (só tipos do Sentry): o logger também as usa, e elas precisam
 * de teste sem SDK nenhum. [#2][#63]
 *
 * O mascaramento do logger olha o NOME da chave (`cpf`, `email`…), mas o dado
 * também chega dentro de TEXTO — um erro do PostgREST por CPF duplicado traz
 * `Key (cpf)=(12345678900) already exists.` na mensagem. Por isso o texto
 * também passa por aqui.
 */

export const TEXTO_REMOVIDO = '[removido]';

const PADROES_DE_DADO_PESSOAL: readonly RegExp[] = [
  // JWT (sessão do Supabase) e cabeçalho Authorization.
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  // E-mail.
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // CPF com ou sem pontuação.
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  // Telefone brasileiro com DDD, formatado.
  /\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b/g,
  // Sequências longas de dígitos (CPF ou telefone sem máscara).
  /\b\d{10,}\b/g,
];

/** Troca CPF, e-mail, telefone, JWT e `Bearer …` por `[removido]`. */
export function scrubText(texto: string): string {
  return PADROES_DE_DADO_PESSOAL.reduce((resultado, padrao) => resultado.replace(padrao, TEXTO_REMOVIDO), texto);
}

/**
 * URL sem query string nem fragmento. URLs assinadas (Cloudinary, backend)
 * levam a assinatura na query; host e caminho bastam para depurar.
 */
export function scrubUrl(url: string): string {
  const fim = url.search(/[?#]/);
  return fim === -1 ? url : url.slice(0, fim);
}

/** Aplica `scrubText` em todo texto de um valor qualquer, em qualquer profundidade. */
export function scrubValue(valor: unknown, profundidade = 0): unknown {
  const PROFUNDIDADE_MAXIMA = 8;
  if (typeof valor === 'string') return scrubText(valor);
  if (valor === null || typeof valor !== 'object' || profundidade >= PROFUNDIDADE_MAXIMA) return valor;
  if (Array.isArray(valor)) return valor.map((item) => scrubValue(item, profundidade + 1));
  const limpo: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor)) {
    limpo[chave] = scrubValue(item, profundidade + 1);
  }
  return limpo;
}

/**
 * Último filtro antes de o evento sair do aparelho (`beforeSend`): texto das
 * exceções e da mensagem, extras e contextos filtrados; do usuário, só o id
 * pseudônimo; da requisição, só a URL sem query.
 */
export function scrubEvent(evento: ErrorEvent): ErrorEvent {
  const limpo: ErrorEvent = { ...evento };

  if (limpo.message !== undefined) {
    limpo.message = scrubText(limpo.message);
  }
  if (limpo.exception?.values !== undefined) {
    limpo.exception = {
      ...limpo.exception,
      values: limpo.exception.values.map((excecao) => ({
        ...excecao,
        value: excecao.value === undefined ? undefined : scrubText(excecao.value),
      })),
    };
  }
  if (limpo.extra !== undefined) {
    limpo.extra = scrubValue(limpo.extra) as ErrorEvent['extra'];
  }
  if (limpo.contexts !== undefined) {
    limpo.contexts = scrubValue(limpo.contexts) as ErrorEvent['contexts'];
  }
  if (limpo.user !== undefined) {
    limpo.user = limpo.user.id === undefined ? {} : { id: limpo.user.id };
  }
  if (limpo.request !== undefined) {
    limpo.request = limpo.request.url === undefined ? {} : { url: scrubUrl(limpo.request.url) };
  }
  if (limpo.breadcrumbs !== undefined) {
    limpo.breadcrumbs = limpo.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((migalha): migalha is Breadcrumb => migalha !== null);
  }
  return limpo;
}

/**
 * Filtro das trilhas (`beforeBreadcrumb`). As de console são descartadas: o
 * logger já deixa a própria trilha, mascarada — a do console repetiria o JSON
 * com stack. URLs perdem a query string.
 */
export function scrubBreadcrumb(migalha: Breadcrumb): Breadcrumb | null {
  if (migalha.category === 'console') {
    return null;
  }
  const limpa: Breadcrumb = { ...migalha };
  if (limpa.message !== undefined) {
    limpa.message = scrubText(limpa.message);
  }
  if (limpa.data !== undefined) {
    const dados = scrubValue(limpa.data) as Record<string, unknown>;
    if (typeof dados.url === 'string') {
      dados.url = scrubUrl(dados.url);
    }
    limpa.data = dados;
  }
  return limpa;
}

const CODIGOS_DE_FALHA_DE_REDE: readonly string[] = ['falha_de_rede', 'sem_resposta'];

/**
 * Falha de rede esperada (aparelho sem internet, servidor acordando). Não vira
 * evento: não é defeito do app e esgotaria a cota gratuita num dia de sinal ruim.
 */
export function isExpectedNetworkError(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) {
    return false;
  }
  const { name, message, code } = erro as { name?: unknown; message?: unknown; code?: unknown };
  return (
    name === 'AbortError' ||
    (typeof message === 'string' && message.includes('Network request failed')) ||
    (typeof code === 'string' && CODIGOS_DE_FALHA_DE_REDE.includes(code))
  );
}
