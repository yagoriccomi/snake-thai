/**
 * Log estruturado do aplicativo.
 *
 * Existe por dois motivos:
 *
 * 1. **Rastreabilidade** — eventos saem como JSON com nível, mensagem, escopo e
 *    horário, de modo que possam ser filtrados e agrupados por qualquer coletor
 *    (Datadog, Sentry, ELK) sem parsing frágil de texto livre [#91].
 * 2. **Privacidade** — dado pessoal nunca entra no log. CPF, telefone, e-mail e
 *    token são mascarados antes de sair, porque log vaza: ele é copiado,
 *    exportado e lido por gente que não precisaria ver aquilo (LGPD) [#63].
 *
 * A *stack trace* fica aqui, no log — jamais na tela. O usuário recebe uma
 * mensagem limpa e acionável; o detalhe técnico é para quem vai depurar [#93].
 *
 * Um coletor remoto (o monitoramento de erros, `src/lib/monitoring`) entra por
 * `setLogSink`: o logger não conhece o Sentry, só entrega os eventos já
 * mascarados.
 */

import { scrubText } from '@/lib/monitoring/scrub';

/** Níveis de severidade, do mais verboso ao mais grave [#92]. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Dados adicionais anexados ao evento (sempre serializáveis). */
export type LogContext = Record<string, unknown>;

/** Chaves cujo valor é sempre mascarado, não importa de onde venham. */
const SENSITIVE_KEYS = [
  'cpf',
  'phone',
  'telefone',
  'email',
  'password',
  'senha',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'authorization',
  'pix_key',
  'name',
  'nome',
  'dob',
  'nascimento',
];

/** Quantos caracteres do fim do valor permanecem visíveis ao mascarar. */
const VISIBLE_TAIL = 2;

/**
 * Substitui o valor sensível por uma forma irreconhecível, mas ainda útil para
 * correlacionar registros (ex.: `***21`).
 */
function maskValue(value: unknown): string {
  const text = String(value);
  if (text.length <= VISIBLE_TAIL) {
    return '***';
  }
  return `***${text.slice(-VISIBLE_TAIL)}`;
}

/**
 * Percorre o contexto mascarando PII em qualquer profundidade.
 *
 * @param context Dados a anexar ao evento de log.
 * @returns Uma cópia segura para persistir.
 */
function sanitize(context: LogContext): LogContext {
  const safe: LogContext = {};
  Object.entries(context).forEach(([key, value]) => {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      safe[key] = maskValue(value);
      return;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = sanitize(value as LogContext);
      return;
    }
    safe[key] = value;
  });
  return safe;
}

/**
 * Serializa um valor sem deixar uma referência circular derrubar o log — um
 * log que lança exceção esconde justamente o erro que ia explicar a falha.
 */
function safeJson(value: unknown): string {
  const vistos = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_chave, valor: unknown) => {
      if (typeof valor === 'object' && valor !== null) {
        if (vistos.has(valor)) {
          return '[circular]';
        }
        vistos.add(valor);
      }
      return valor;
    }) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Extrai da exceção o que é útil para depurar, sem confiar que seja um `Error`.
 *
 * O ramo dos objetos existe porque `String({...})` devolve `"[object Object]"`,
 * e foi exatamente o que aconteceu na prática: uma falha real de envio de
 * comprovante chegou ao log sem NENHUMA informação sobre a causa. Erro de
 * PostgREST (`{ message, code, details }`) e objeto passado por engano no
 * lugar do erro caem aqui — em ambos os casos é melhor ter o conteúdo.
 */
function describeError(error: unknown): LogContext {
  // O texto da mensagem também é filtrado: o PostgREST devolve o valor que
  // violou a regra (ex.: o CPF duplicado) dentro dela.
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: scrubText(error.message), stack: error.stack };
  }
  if (typeof error === 'object' && error !== null) {
    return { errorMessage: scrubText(safeJson(error)) };
  }
  return { errorMessage: scrubText(String(error)) };
}

/** Evento entregue ao coletor remoto; o contexto já vem mascarado. */
export interface LogSinkEvent {
  level: LogLevel;
  scope: string;
  message: string;
  context: LogContext;
}

/**
 * Coletor remoto de eventos. `error` recebe o erro ORIGINAL (a stack que o
 * coletor simboliza); `breadcrumb` recebe warn/info como trilha, sem stack.
 */
export interface LogSink {
  error(evento: LogSinkEvent & { error?: unknown }): void;
  breadcrumb(evento: LogSinkEvent): void;
}

let sink: LogSink | null = null;

/** Liga (ou desliga, com `null`) o coletor remoto. */
export function setLogSink(novo: LogSink | null): void {
  sink = novo;
}

/** Entrega ao coletor sem nunca deixar uma falha dele derrubar o log. */
function entregarAoSink(level: LogLevel, scope: string, message: string, context: LogContext, error: unknown): void {
  if (sink === null || level === 'debug') {
    return;
  }
  try {
    // A stack vai no próprio erro; repetida no contexto só pesaria.
    const { stack: _stack, ...semStack } = context;
    const evento = { level, scope, message, context: semStack };
    if (level === 'error') {
      sink.error({ ...evento, error });
    } else {
      sink.breadcrumb(evento);
    }
  } catch {
    // O coletor é acessório: o app e o log seguem sem ele.
  }
}

/** Emite o evento já formatado no transporte disponível. */
function emit(
  level: LogLevel,
  scope: string,
  message: string,
  context: LogContext,
  error?: unknown,
): void {
  const safeContext = sanitize(context);
  const entry = {
    level,
    scope,
    message,
    at: new Date().toISOString(),
    ...safeContext,
  };

  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
  } else if (level === 'warn') {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
  entregarAoSink(level, scope, message, safeContext, error);
}

/**
 * Cria um logger amarrado a um escopo (normalmente o módulo que o usa).
 *
 * @param scope Identificador curto da origem, ex.: `'usePlans'`.
 */
export function createLogger(scope: string) {
  return {
    /** Detalhe de desenvolvimento; não deve guiar decisão de negócio [#92]. */
    debug: (message: string, context: LogContext = {}): void =>
      emit('debug', scope, message, context),

    /** Fluxo de negócio esperado (ex.: aluno concluiu o onboarding) [#92]. */
    info: (message: string, context: LogContext = {}): void =>
      emit('info', scope, message, context),

    /** Situação inesperada, porém contornável — o app segue funcionando [#92]. */
    warn: (message: string, error?: unknown, context: LogContext = {}): void =>
      emit(
        'warn',
        scope,
        message,
        { ...context, ...(error === undefined ? {} : describeError(error)) },
        error,
      ),

    /** Falha grave: a operação que o usuário pediu não aconteceu [#92]. */
    error: (message: string, error?: unknown, context: LogContext = {}): void =>
      emit(
        'error',
        scope,
        message,
        { ...context, ...(error === undefined ? {} : describeError(error)) },
        error,
      ),
  };
}

/** Logger genérico, para quando não há escopo mais específico. */
export const logger = createLogger('app');
