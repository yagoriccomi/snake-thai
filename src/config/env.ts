/**
 * Acesso tipado e validado às variáveis de ambiente públicas do Expo.
 *
 * Variáveis com prefixo `EXPO_PUBLIC_` são embutidas no bundle em tempo de
 * build. Aqui aplicamos uma validação fail-fast: se uma variável obrigatória
 * faltar, o app quebra imediatamente no boot com uma mensagem clara — em vez
 * de falhar silenciosamente numa requisição de rede mais tarde.
 */

/**
 * Garante que uma variável de ambiente obrigatória esteja presente.
 *
 * @param key   Nome da variável (para a mensagem de erro).
 * @param value Valor lido de `process.env`.
 * @returns O valor validado, garantidamente não vazio.
 * @throws {Error} Se a variável estiver ausente ou vazia.
 */
const requireEnv = (key: string, value: string | undefined): string => {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Variável de ambiente ausente: "${key}". ` +
        'Copie ".env.example" para ".env" e preencha os valores.',
    );
  }
  return value;
};

/** Configuração pública validada, consumida pelo restante do app. */
export const env = {
  supabaseUrl: requireEnv(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: requireEnv(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const;
