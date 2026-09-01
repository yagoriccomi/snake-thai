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
 */

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
 * Extrai da exceção o que é útil para depurar, sem confiar que seja um `Error`.
 */
function describeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorMessage: String(error) };
}

/** Emite o evento já formatado no transporte disponível. */
function emit(level: LogLevel, scope: string, message: string, context: LogContext): void {
  const entry = {
    level,
    scope,
    message,
    at: new Date().toISOString(),
    ...sanitize(context),
  };

  // Em produção este é o ponto único a trocar por um coletor remoto; a
  // interface de chamada permanece a mesma em todo o app.
  const serialized = JSON.stringify(entry);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
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
      emit('warn', scope, message, {
        ...context,
        ...(error === undefined ? {} : describeError(error)),
      }),

    /** Falha grave: a operação que o usuário pediu não aconteceu [#92]. */
    error: (message: string, error?: unknown, context: LogContext = {}): void =>
      emit('error', scope, message, {
        ...context,
        ...(error === undefined ? {} : describeError(error)),
      }),
  };
}

/** Logger genérico, para quando não há escopo mais específico. */
export const logger = createLogger('app');
