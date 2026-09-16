/** Tipos do módulo CommonJS `regrasDeAmbiente.js` (compartilhado com o build em Node). */

export type VarianteDoApp = 'development' | 'production';

export const VARIANTES: readonly VarianteDoApp[];

export const VARIANTE_PADRAO: VarianteDoApp;

export function problemaDeAmbiente(entrada: {
  variante: string;
  supabaseUrl: string;
  apiUrl?: string | null;
}): string | null;
