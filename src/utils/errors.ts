/**
 * Classificação de erros para mensagens claras ao usuário.
 *
 * Regra do projeto: nenhum erro deve ser genérico. Toda falha exibida precisa
 * dizer o que aconteceu e — no mínimo — a sua natureza: **banco** de dados,
 * **rede** (conexão), **autenticação** ou **interno**. Este utilitário traduz
 * os erros do Supabase (`PostgrestError`/`AuthError`), falhas de `fetch` e
 * `Error` comuns em uma mensagem pronta para a tela.
 *
 * Observação importante: o `PostgrestError` do supabase-js NÃO é instância de
 * `Error`, então checar `instanceof Error` deixa passar justamente os erros de
 * banco (ex.: CPF duplicado). Aqui a detecção é feita pelo SQLSTATE (`code`).
 */

/** Natureza do erro, para a UI comunicar a origem do problema. */
export type ErrorKind = 'banco' | 'rede' | 'auth' | 'interno';

/** Erro já classificado e com mensagem amigável. */
export interface DescribedError {
  kind: ErrorKind;
  message: string;
}

/** Mensagens amigáveis para os SQLSTATE do Postgres mais comuns neste app. */
const SQLSTATE_MESSAGES: Record<string, string> = {
  '23505': 'Já existe um cadastro com esses dados.', // unique_violation
  '23514': 'Algum dado não atende às regras de validação.', // check_violation
  '23502': 'Um campo obrigatório ficou em branco.', // not_null_violation
  '23503': 'Há uma referência inválida entre registros.', // foreign_key_violation
  '42501': 'Você não tem permissão para esta ação.', // insufficient_privilege (RLS/trigger)
};

/** Lê um campo string de um objeto de erro desconhecido, com segurança. */
function readString(error: unknown, field: string): string {
  if (typeof error === 'object' && error !== null && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : '';
  }
  return '';
}

/** True quando o objeto de erro traz a marca de erro de autenticação do GoTrue. */
function isAuthError(error: unknown, name: string): boolean {
  if (name.startsWith('Auth')) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    '__isAuthError' in error &&
    (error as { __isAuthError?: unknown }).__isAuthError === true
  );
}

/** Traduz uma mensagem de erro de autenticação (GoTrue) para português. */
function describeAuthMessage(message: string): string {
  const lower = message.toLowerCase();
  if (/weak|too short|at least|characters long|requirements|does not meet/.test(lower)) {
    return 'A senha não atende aos requisitos de segurança.';
  }
  if (/different from the old|should be different|same.*password/.test(lower)) {
    return 'A nova senha precisa ser diferente da anterior.';
  }
  if (/invalid.*credentials|invalid login/.test(lower)) {
    return 'E-mail ou senha inválidos.';
  }
  if (/email.*(already|registered|exists)/.test(lower)) {
    return 'Este e-mail já está cadastrado.';
  }
  return message !== '' ? `Falha na autenticação: ${message}` : 'Falha na autenticação. Tente novamente.';
}

/**
 * Classifica um erro e devolve `{ kind, message }`.
 *
 * @param error Qualquer valor lançado (PostgrestError, AuthError, Error, etc.).
 */
export function classifyError(error: unknown): DescribedError {
  const message = readString(error, 'message');
  const details = readString(error, 'details');
  const code = readString(error, 'code');
  const name = readString(error, 'name');
  const haystack = `${message} ${details}`.toLowerCase();

  // 1) Rede / conexão — fetch falhou, offline, timeout.
  if (
    /network request failed|failed to fetch|network error|load failed|timeout|fetch failed|econnreset|enotfound|dns/.test(
      haystack,
    ) ||
    name === 'AuthRetryableFetchError'
  ) {
    return {
      kind: 'rede',
      message: 'Falha de conexão. Verifique sua internet e tente novamente.',
    };
  }

  // 2) Banco de dados — SQLSTATE de 5 caracteres (código do Postgres).
  if (/^[0-9a-z]{5}$/i.test(code)) {
    if (code === '23505' && /cpf/.test(haystack)) {
      return { kind: 'banco', message: 'Este CPF já está cadastrado em outra conta.' };
    }
    const known = SQLSTATE_MESSAGES[code];
    return {
      kind: 'banco',
      message: known ?? `Erro no banco de dados (código ${code}). Tente novamente.`,
    };
  }

  // 3) Autenticação — GoTrue (updatePassword, signIn, etc.).
  if (isAuthError(error, name)) {
    return { kind: 'auth', message: describeAuthMessage(message) };
  }

  // 4) Interno / desconhecido — sempre diz que é interno, com a pista disponível.
  return {
    kind: 'interno',
    message:
      message !== ''
        ? `Erro interno: ${message}`
        : 'Erro interno inesperado. Tente novamente em instantes.',
  };
}

/**
 * Mensagem pronta para exibir ao usuário — específica quando possível, e nunca
 * genérica: comunica banco, conexão, autenticação ou erro interno.
 */
export function describeError(error: unknown): string {
  return classifyError(error).message;
}
