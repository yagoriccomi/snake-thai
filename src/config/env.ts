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

/**
 * Lê uma variável OPCIONAL, normalizando ausência e string vazia para `null`.
 *
 * Diferente de `requireEnv` de propósito: a URL do backend próprio só é
 * necessária no fluxo de comprovantes. Derrubar o boot do app inteiro — login,
 * aulas, perfil — porque uma integração ainda não foi configurada seria
 * desproporcional. Quem depende dela falha na hora do uso, com mensagem
 * própria. [#9]
 */
const optionalEnv = (value: string | undefined): string | null => {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value.trim().replace(/\/+$/, '');
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
  /**
   * Backend próprio na Render (`docs/BACKEND.md`). `null` enquanto não houver
   * deploy — o app segue funcionando pelo caminho Supabase.
   */
  apiUrl: optionalEnv(process.env.EXPO_PUBLIC_API_URL),
} as const;
