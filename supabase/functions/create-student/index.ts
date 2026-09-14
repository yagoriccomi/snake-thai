// ============================================================================
// Edge Function: create-student
// ----------------------------------------------------------------------------
// Cria a conta de autenticação de um novo aluno (com senha padrão) e inicializa
// a linha correspondente em `profiles` (pendente de onboarding).
//
// Segurança:
// - Usa a service_role APENAS no servidor (jamais no app) para criar o usuário.
// - Verifica, pelo JWT do chamador, que quem invoca é um ADMINISTRADOR.
// - Em caso de falha ao criar o perfil, faz rollback do usuário de auth.
//
// Deploy:  supabase functions deploy create-student
// Segredos: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são
//           injetados automaticamente pelo runtime das Edge Functions.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Senha inicial padrão — o aluno é obrigado a trocá-la no onboarding. */
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Cliente com o JWT do chamador para identificá-lo.
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
  if (profileError !== null || callerProfile === null || callerProfile.role !== 'admin') {
    return json({ error: 'Acesso restrito a administradores' }, 403);
  }

  // Validação do corpo.
  let email = '';
  let groupId: string | null = null;
  let planId: string | null = null;
  try {
    const body = (await req.json()) as {
      email?: unknown;
      groupId?: unknown;
      planId?: unknown;
    };
    email = String(body.email ?? '').trim().toLowerCase();
    if (typeof body.groupId === 'string' && body.groupId.trim() !== '') {
      groupId = body.groupId.trim();
    }
    if (typeof body.planId === 'string' && body.planId.trim() !== '') {
      planId = body.planId.trim();
    }
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    return json({ error: 'E-mail inválido' }, 400);
  }

  // Cria o usuário de autenticação com a senha padrão.
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_STUDENT_PASSWORD,
    email_confirm: true,
  });
  if (createError !== null || created.user === null) {
    return json({ error: createError?.message ?? 'Falha ao criar usuário' }, 400);
  }

  // Inicializa o perfil pendente de onboarding (com turma e plano, se
  // informados). O `plan_id` é o que liga o aluno ao faturamento: um trigger
  // no banco cria a mensalidade proporcional de entrada quando o cadastro
  // acontece até o dia 10, e a recorrência mensal só cobra quem tem plano.
  const { error: insertError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    role: 'user',
    is_first_login: true,
    group_id: groupId,
    plan_id: planId,
  });
  if (insertError !== null) {
    // Rollback: remove o usuário de auth para não deixar conta órfã.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  return json({ success: true, userId: created.user.id }, 200);
});
