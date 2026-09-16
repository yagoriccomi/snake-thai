// ============================================================================
// Utilidades HTTP compartilhadas pelas Edge Functions de conta.
// ============================================================================
import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resposta JSON com os headers de CORS. */
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export interface Ambiente {
  supabaseUrl: string;
  anonKey: string;
  adminClient: SupabaseClient;
}

/** Variáveis injetadas pelo runtime; `null` se faltar alguma. */
export function lerAmbiente(): Ambiente | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (supabaseUrl === '' || anonKey === '' || serviceRoleKey === '') {
    return null;
  }
  return { supabaseUrl, anonKey, adminClient: createClient(supabaseUrl, serviceRoleKey) };
}

export interface Chamador {
  user: User;
  /** O JWT da sessão, sem o prefixo "Bearer ". */
  token: string;
  role: string | null;
}

/**
 * Identifica quem chama pelo próprio JWT (ninguém se passa por outro) e lê o
 * papel no perfil. `null` = sessão inválida.
 */
export async function identificarChamador(req: Request, ambiente: Ambiente): Promise<Chamador | null> {
  const authHeader = req.headers.get('Authorization');
  if (authHeader === null || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const callerClient = createClient(ambiente.supabaseUrl, ambiente.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error !== null || data.user === null) {
    return null;
  }
  const { data: perfil } = await ambiente.adminClient
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  return { user: data.user, token: authHeader.slice('Bearer '.length), role: perfil?.role ?? null };
}
