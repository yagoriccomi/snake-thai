// ============================================================================
// Edge Function: reset-student-password
// ----------------------------------------------------------------------------
// Redefine a senha de um usuário para a padrão e o devolve ao onboarding
// (`is_first_login = true`), de modo que ele seja obrigado a escolher uma senha
// nova no próximo acesso.
//
// Segurança:
// - Só um ADMINISTRADOR pode chamar (verificado pelo JWT do chamador).
// - A service_role vive apenas aqui no servidor, nunca no app.
// - O admin não pode redefinir a própria senha por aqui: para isso existe a
//   troca de senha autenticada no app, que exige a senha atual. Isso evita que
//   um celular desbloqueado vire uma porta de entrada permanente.
//
// Deploy:  supabase functions deploy reset-student-password
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Senha inicial padrão — a mesma usada ao cadastrar um aluno. */
const DEFAULT_STUDENT_PASSWORD = 'Snake@123';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Resposta JSON com os headers de CORS. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader === null) {
    return json({ error: 'Não autenticado' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (supabaseUrl === '' || anonKey === '' || serviceRoleKey === '') {
    return json({ error: 'Configuração do servidor ausente' }, 500);
  }

  // Cliente com o JWT do chamador, apenas para identificá-lo.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError !== null || caller.user === null) {
    return json({ error: 'Sessão inválida' }, 401);
  }

  // Cliente administrativo (service_role) — ignora RLS.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Autorização: o chamador precisa ser admin.
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (
    profileError !== null ||
    callerProfile === null ||
    callerProfile.role !== 'admin'
  ) {
    return json({ error: 'Acesso restrito a administradores' }, 403);
  }

  // Validação do corpo.
  let userId = '';
  try {
    const body = (await req.json()) as { userId?: unknown };
    userId = String(body.userId ?? '').trim();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!UUID_REGEX.test(userId)) {
    return json({ error: 'Identificador de usuário inválido' }, 400);
  }
  if (userId === caller.user.id) {
    return json(
      { error: 'Use a troca de senha do seu perfil para alterar a própria senha' },
      400,
    );
  }

  // O alvo precisa existir e ser um perfil conhecido do app.
  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  if (targetError !== null || target === null) {
    return json({ error: 'Usuário não encontrado' }, 404);
  }

  // Redefine a senha para a padrão.
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: DEFAULT_STUDENT_PASSWORD,
  });
  if (updateError !== null) {
    return json({ error: updateError.message }, 400);
  }

  // Devolve ao onboarding: a senha padrão nunca pode virar senha definitiva.
  const { error: flagError } = await adminClient
    .from('profiles')
    .update({ is_first_login: true })
    .eq('id', userId);
  if (flagError !== null) {
    return json({ error: flagError.message }, 400);
  }

  return json({ success: true }, 200);
});
