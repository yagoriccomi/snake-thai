/**
 * Tipos do banco de dados do Supabase.
 *
 * ⚠️ PLACEHOLDER — este arquivo DEVE ser substituído pela saída do Supabase CLI
 * assim que o esquema (migrations) for aplicado a um projeto:
 *
 *   # produção (projeto remoto)
 *   npx supabase gen types typescript --project-id <PROJECT_ID> \
 *     > src/types/database.types.ts
 *
 *   # desenvolvimento local (com `supabase start`)
 *   npx supabase gen types typescript --local > src/types/database.types.ts
 *
 * A estrutura mínima abaixo mantém o cliente do Supabase tipado (sem `any`)
 * enquanto os tipos reais não são gerados.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Esquema mínimo válido do banco. Será sobrescrito pelo arquivo gerado,
 * que trará `Tables`, `Views`, `Functions` e `Enums` completos.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
