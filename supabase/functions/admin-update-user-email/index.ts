// ============================================================================
// Edge Function: admin-update-user-email
// ----------------------------------------------------------------------------
// O administrador corrige o e-mail de login de um aluno ou professor. O e-mail
// vive só no Auth (auth.users), que o app não altera sem a service_role — sem
// isto, um e-mail digitado errado no cadastro deixava a conta inacessível.
//
// Corpo: { userId: "<uuid>", email: "novo@exemplo.com" }
//   · só administrador; conta anonimizada não recebe e-mail novo;
//   · o e-mail já confirmado: o próprio admin cadastrou;
//   · e-mail já usado por outra conta → 409.
//
// Deploy (só com aprovação, ver docs/RUNBOOK.md):
//   npx supabase functions deploy admin-update-user-email --project-ref <ref>
// ============================================================================
import { CORS_HEADERS, identificarChamador, json, lerAmbiente, UUID_REGEX } from '../_shared/http.ts';

/** Mesma regra do app (src/utils/validation.ts): simples e sem ambiguidade. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  const ambiente = lerAmbiente();
  if (ambiente === null) {
    return json({ error: 'Configuração do servidor ausente' }, 500);
  }

  const chamador = await identificarChamador(req, ambiente);
  if (chamador === null) {
    return json({ error: 'Sessão inválida' }, 401);
  }
  if (chamador.role !== 'admin') {
    return json({ error: 'Acesso restrito a administradores' }, 403);
  }

  let userId = '';
  let email = '';
  try {
    const body = (await req.json()) as { userId?: unknown; email?: unknown };
    userId = String(body.userId ?? '').trim();
    email = String(body.email ?? '').trim().toLowerCase();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!UUID_REGEX.test(userId)) {
    return json({ error: 'Identificador de usuário inválido' }, 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    return json({ error: 'E-mail inválido' }, 400);
  }

  const { data: alvo } = await ambiente.adminClient
    .from('profiles')
    .select('id, anonymized_at')
    .eq('id', userId)
    .maybeSingle();
  if (alvo === null) {
    return json({ error: 'Usuário não encontrado' }, 404);
  }
  if (alvo.anonymized_at !== null) {
    return json({ error: 'Esta conta foi excluída' }, 409);
  }

  // Confere antes: o Auth responde e-mail duplicado com um 500 genérico, que o
  // supabase-js não distingue de uma falha real.
  const { data: jaCadastrado, error: consultaError } = await ambiente.adminClient.rpc('email_ja_cadastrado', {
    p_email: email,
    p_exceto: userId,
  });
  if (consultaError !== null) {
    return json({ error: 'Não foi possível alterar o e-mail agora. Tente novamente.' }, 500);
  }
  if (jaCadastrado === true) {
    return json({ error: 'Este e-mail já está cadastrado em outra conta' }, 409);
  }

  const { error } = await ambiente.adminClient.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (error !== null) {
    return json({ error: 'Não foi possível alterar o e-mail agora. Tente novamente.' }, 500);
  }

  return json({ success: true, email }, 200);
});
