// ============================================================================
// Edge Function: create-staff
// ----------------------------------------------------------------------------
// Cria a conta de PROFESSOR ou ADMIN. Diferente de `create-student`: aqui o
// cadastro é COMPLETO na hora (nome e CPF informados pelo admin), sem etapa
// de onboarding depois — decisão de produto, não técnica.
//
// Segurança:
// - Usa a service_role APENAS no servidor (jamais no app) para criar o usuário.
// - Verifica, pelo JWT do chamador, que quem invoca é um ADMINISTRADOR.
// - Em caso de falha ao criar o perfil, faz rollback do usuário de auth.
//
// Deploy:  supabase functions deploy create-staff
// Segredos: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são
//           injetados automaticamente pelo runtime das Edge Functions.
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Senha inicial padrão. Mesmo valor literal usado em `create-student` — não
 * é lida de `academy_settings.default_student_password` porque aquela
 * função também não a lê (inconsistência pré-existente: o campo configurável
 * na tela de Configurações nunca foi conectado à criação de conta de
 * verdade). Replicar aqui mantém as duas funções coerentes ENTRE SI; corrigir
 * a leitura de `academy_settings` é uma mudança à parte, não pedida agora.
 */
const DEFAULT_PASSWORD = 'Snake@123';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_REGEX = /^[0-9]{11}$/;
const COR_HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const CARGOS_VALIDOS = ['professor', 'admin'] as const;
type Cargo = (typeof CARGOS_VALIDOS)[number];

function ehCargoValido(valor: unknown): valor is Cargo {
  return typeof valor === 'string' && (CARGOS_VALIDOS as readonly string[]).includes(valor);
}

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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError !== null || caller.user === null) {
    return json({ error: 'Sessão inválida' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (profileError !== null || callerProfile === null || callerProfile.role !== 'admin') {
    return json({ error: 'Acesso restrito a administradores' }, 403);
  }

  // Validação do corpo — cada campo com a mensagem que diz exatamente o que
  // está errado, na borda, antes de qualquer escrita. [#51]
  let email = '';
  let name = '';
  let cpf = '';
  let role: Cargo = 'professor';
  let color: string | null = null;
  try {
    const body = (await req.json()) as {
      email?: unknown;
      name?: unknown;
      cpf?: unknown;
      role?: unknown;
      color?: unknown;
    };
    email = String(body.email ?? '').trim().toLowerCase();
    name = String(body.name ?? '').trim();
    cpf = String(body.cpf ?? '').replace(/\D/g, '');
    if (!ehCargoValido(body.role)) {
      return json({ error: 'Cargo inválido: use "professor" ou "admin"' }, 400);
    }
    role = body.role;
    if (typeof body.color === 'string' && body.color.trim() !== '') {
      color = body.color.trim();
    }
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }

  if (!EMAIL_REGEX.test(email)) {
    return json({ error: 'E-mail inválido' }, 400);
  }
  if (name.length === 0) {
    return json({ error: 'Nome é obrigatório' }, 400);
  }
  if (!CPF_REGEX.test(cpf)) {
    return json({ error: 'CPF precisa ter 11 dígitos' }, 400);
  }

  // A cor é OBRIGATÓRIA para professor e PROIBIDA para admin — mesma regra
  // que a constraint `profiles_color_only_for_professor` no banco. Validar
  // aqui devolve uma mensagem legível; sem isto, o erro apareceria como um
  // 500 genérico de violação de constraint. [#51]
  if (role === 'professor') {
    if (color === null || !COR_HEX_REGEX.test(color)) {
      return json({ error: 'Professor precisa de uma cor no formato #RRGGBB' }, 400);
    }
  } else if (color !== null) {
    return json({ error: 'Administrador não tem cor — remova o campo' }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });
  if (createError !== null || created.user === null) {
    return json({ error: createError?.message ?? 'Falha ao criar usuário' }, 400);
  }

  // Nome e CPF já entram preenchidos (o admin os informou) — o funcionário
  // não redigita cadastro. Mas `is_first_login` continua TRUE de propósito:
  // é o único gatilho do onboarding, e o onboarding é o que força trocar a
  // senha padrão (pública, literal neste arquivo) e registrar o aceite LGPD.
  // Marcá-lo false aqui deixaria um admin permanentemente acessível por
  // `Snake@123` e sem termo aceito. Com os dados já preenchidos, o app pula
  // a etapa de Dados e pede só senha + termos. [#54][#55]
  const { error: insertError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    role,
    name,
    cpf,
    color,
    is_first_login: true,
  });
  if (insertError !== null) {
    // Rollback: remove o usuário de auth para não deixar conta órfã.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: insertError.message }, 400);
  }

  return json({ success: true, userId: created.user.id }, 200);
});
