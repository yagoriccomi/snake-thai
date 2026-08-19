// ============================================================================
// Edge Function: delete-my-account
// ----------------------------------------------------------------------------
// Atende ao direito de eliminação dos dados do titular (LGPD art. 18, VI).
//
// Não é um DELETE simples. Existe uma tensão real entre dois deveres:
//
//   · o titular tem direito à eliminação dos seus dados pessoais;
//   · a academia tem obrigação de guardar o registro fiscal das transações
//     (Código Civil art. 206 e legislação tributária).
//
// A saída é ANONIMIZAR em vez de apagar tudo: os dados que identificam a pessoa
// (nome, CPF, telefone, nascimento, e-mail) são destruídos; os lançamentos
// financeiros permanecem, já desvinculados de qualquer identidade. O que resta
// não é dado pessoal — é histórico contábil.
//
// ATENÇÃO ao motivo de NÃO usarmos auth.admin.deleteUser aqui: a cadeia de
// chaves estrangeiras é
//     auth.users → profiles → payments / attendance,  toda ON DELETE CASCADE.
// Apagar a conta de autenticação derrubaria em cascata o perfil e, com ele,
// TODO o histórico financeiro — exatamente o que a obrigação fiscal proíbe.
//
// Em vez disso, o acesso é encerrado de forma definitiva: o e-mail (que também
// é dado pessoal) vira um identificador aleatório sem relação com a pessoa, a
// senha é trocada por outra aleatória que ninguém conhece, e a conta é banida.
// Não sobra dado pessoal nem porta de entrada.
//
// Deploy:  supabase functions deploy delete-my-account
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

/** Confirmação exigida no corpo — evita exclusão por chamada acidental. */
const CONFIRMACAO_ESPERADA = 'EXCLUIR MINHA CONTA';

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

  // O titular é identificado pelo próprio JWT: ninguém exclui a conta de outro.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError !== null || caller.user === null) {
    return json({ error: 'Sessão inválida' }, 401);
  }
  const userId = caller.user.id;

  // Confirmação explícita: excluir conta é irreversível.
  try {
    const body = (await req.json()) as { confirmacao?: unknown };
    if (String(body.confirmacao ?? '') !== CONFIRMACAO_ESPERADA) {
      return json(
        { error: `Envie confirmacao: "${CONFIRMACAO_ESPERADA}" para prosseguir` },
        400,
      );
    }
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Um administrador não pode se autoexcluir: o trigger do banco recusaria se
  // fosse o último, mas mesmo não sendo, a saída da administração deve passar
  // por outro admin — evita perder o controle do sistema por um toque.
  const { data: perfil, error: perfilError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (perfilError !== null || perfil === null) {
    return json({ error: 'Perfil não encontrado' }, 404);
  }
  if (perfil.role === 'admin') {
    return json(
      { error: 'Contas administrativas devem ser removidas por outro administrador' },
      403,
    );
  }

  // 1. Anonimiza o perfil: destrói o que identifica, preserva a linha para que
  //    os lançamentos financeiros continuem íntegros.
  const { error: anonError } = await adminClient
    .from('profiles')
    .update({
      name: 'Usuário removido',
      cpf: null,
      phone: null,
      dob: null,
      group_id: null,
      plan_id: null,
      status: 'inactive',
      deactivated_at: new Date().toISOString(),
      // Marca o estado "encerrada por pedido do titular" — distinto de
      // "aguardando onboarding" e de "matrícula trancada".
      anonymized_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (anonError !== null) {
    return json({ error: anonError.message }, 400);
  }

  // 2. Encerra o acesso sem apagar a linha de autenticação (ver comentário do
  //    cabeçalho: deleteUser derrubaria o financeiro em cascata).
  const descartavel = crypto.randomUUID();
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: `removido-${descartavel}@anonimizado.invalid`,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: {},
    // Banimento longo o suficiente para ser permanente na prática.
    ban_duration: '876000h',
  });
  if (authError !== null) {
    return json({ error: authError.message }, 400);
  }

  // 3. Remove os consentimentos: eles registram aceite de uma pessoa que não
  //    existe mais no sistema e não têm valor fiscal.
  await adminClient.from('consents').delete().eq('user_id', userId);

  return json(
    {
      success: true,
      message:
        'Conta excluída. Dados pessoais anonimizados; registros financeiros ' +
        'preservados por obrigação legal, sem vínculo com sua identidade.',
    },
    200,
  );
});
