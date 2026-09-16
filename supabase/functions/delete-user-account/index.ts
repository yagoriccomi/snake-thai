// ============================================================================
// Edge Function: delete-user-account
// ----------------------------------------------------------------------------
// O administrador exclui a conta de um aluno ou professor (LGPD art. 18, VI),
// por exemplo a pedido feito na recepção. Mesma regra da autoexclusão
// (_shared/anonimizar-conta.ts): dados pessoais destruídos, registro financeiro
// preservado sem vínculo.
//
// Corpo: { userId: "<uuid>", confirmacao: "EXCLUIR CONTA" }
//   · só administrador chama;
//   · não exclui a si mesmo nem outro administrador (rebaixe antes);
//   · repetir é seguro.
//
// Deploy (só com aprovação, ver docs/RUNBOOK.md):
//   npx supabase functions deploy delete-user-account --project-ref <ref>
// ============================================================================
import { anonimizarConta, ErroDeExclusao } from '../_shared/anonimizar-conta.ts';
import { CORS_HEADERS, identificarChamador, json, lerAmbiente, UUID_REGEX } from '../_shared/http.ts';

const CONFIRMACAO_ESPERADA = 'EXCLUIR CONTA';

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
  try {
    const body = (await req.json()) as { userId?: unknown; confirmacao?: unknown };
    if (String(body.confirmacao ?? '') !== CONFIRMACAO_ESPERADA) {
      return json({ error: `Envie confirmacao: "${CONFIRMACAO_ESPERADA}" para prosseguir` }, 400);
    }
    userId = String(body.userId ?? '').trim();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (!UUID_REGEX.test(userId)) {
    return json({ error: 'Identificador de usuário inválido' }, 400);
  }
  if (userId === chamador.user.id) {
    return json({ error: 'Um administrador não exclui a própria conta' }, 400);
  }

  try {
    const resultado = await anonimizarConta(ambiente.adminClient, {
      userId,
      solicitanteId: chamador.user.id,
    });
    return json(
      {
        success: true,
        ja_anonimizado: resultado.ja_anonimizado,
        comprovantes: resultado.comprovantes ?? 0,
        justificativas: resultado.justificativas ?? 0,
      },
      200,
    );
  } catch (erro) {
    if (erro instanceof ErroDeExclusao) {
      return json({ error: erro.message }, erro.status);
    }
    return json({ error: 'Não foi possível excluir a conta agora. Tente novamente.' }, 500);
  }
});
