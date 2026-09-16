// ============================================================================
// Edge Function: delete-my-account
// ----------------------------------------------------------------------------
// O titular exclui a própria conta (LGPD art. 18, VI).
//
// Não é um DELETE: a academia precisa guardar o registro das transações
// (art. 16, I). Os dados que identificam a pessoa são destruídos e os
// lançamentos financeiros ficam, sem vínculo com ela — regra inteira em
// _shared/anonimizar-conta.ts e public.anonimizar_titular().
//
// Corpo: { confirmacao: "EXCLUIR MINHA CONTA", senha: "<senha atual>" }
//   · a senha é conferida aqui, no servidor: um celular desbloqueado na mão de
//     outra pessoa não apaga a conta;
//   · administrador não se autoexclui (outro administrador rebaixa e remove);
//   · repetir é seguro.
//
// Deploy (só com aprovação, ver docs/RUNBOOK.md):
//   npx supabase functions deploy delete-my-account --project-ref <ref>
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { anonimizarConta, ErroDeExclusao } from '../_shared/anonimizar-conta.ts';
import { CORS_HEADERS, identificarChamador, json, lerAmbiente } from '../_shared/http.ts';

const CONFIRMACAO_ESPERADA = 'EXCLUIR MINHA CONTA';

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

  let senha = '';
  try {
    const body = (await req.json()) as { confirmacao?: unknown; senha?: unknown };
    if (String(body.confirmacao ?? '') !== CONFIRMACAO_ESPERADA) {
      return json({ error: `Envie confirmacao: "${CONFIRMACAO_ESPERADA}" para prosseguir` }, 400);
    }
    senha = String(body.senha ?? '');
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }

  if (chamador.role === 'admin') {
    return json({ error: 'Contas de administrador são removidas por outro administrador' }, 403);
  }
  if (chamador.role === null) {
    return json({ error: 'Perfil não encontrado' }, 404);
  }

  // Reautenticação: a mesma exigência da troca de senha.
  const email = chamador.user.email ?? '';
  const clienteDeConferencia = createClient(ambiente.supabaseUrl, ambiente.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: senhaError } = await clienteDeConferencia.auth.signInWithPassword({ email, password: senha });
  if (email === '' || senha === '' || senhaError !== null) {
    return json({ error: 'Senha incorreta' }, 401);
  }

  try {
    const resultado = await anonimizarConta(ambiente.adminClient, {
      userId: chamador.user.id,
      solicitanteId: chamador.user.id,
    });

    // Derruba as sessões em todos os aparelhos. A conta já está fechada; uma
    // falha aqui só deixa o token atual valer até expirar.
    await ambiente.adminClient.auth.admin.signOut(chamador.token, 'global').catch(() => undefined);

    return json(
      {
        success: true,
        comprovantes: resultado.comprovantes ?? 0,
        justificativas: resultado.justificativas ?? 0,
        message:
          'Conta excluída. Dados pessoais anonimizados; registros financeiros preservados por obrigação legal, sem vínculo com sua identidade.',
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
