// ============================================================================
// Exclusão de conta (LGPD art. 18, VI): a parte do banco e a parte do Auth.
// ----------------------------------------------------------------------------
// A regra de dados inteira está em public.anonimizar_titular() — numa
// transação: perfil, imagens de comprovante, justificativas, consentimentos,
// aulas futuras do professor e auditoria.
//
// Aqui fica só o que o banco não alcança: fechar a porta de entrada. NÃO se usa
// auth.admin.deleteUser: auth.users → profiles → payments é ON DELETE CASCADE,
// e apagar a conta levaria o histórico financeiro que a lei manda guardar. Em
// vez disso, o e-mail vira um identificador aleatório, a senha vira uma que
// ninguém conhece e a conta é banida.
//
// Repetir é seguro: se o passo do Auth falhar, a próxima chamada encontra o
// perfil já anonimizado e refaz só o Auth.
// ============================================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Banimento longo o suficiente para ser permanente na prática (~100 anos). */
const BANIMENTO_PERMANENTE = '876000h';

export class ErroDeExclusao extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
  }
}

export interface ResultadoDaExclusao {
  ja_anonimizado: boolean;
  comprovantes?: number;
  justificativas?: number;
  aulas_futuras?: number;
}

export async function anonimizarConta(
  adminClient: SupabaseClient,
  { userId, solicitanteId }: { userId: string; solicitanteId: string },
): Promise<ResultadoDaExclusao> {
  const { data, error } = await adminClient.rpc('anonimizar_titular', {
    p_user_id: userId,
    p_solicitante: solicitanteId,
  });
  if (error !== null) {
    if (error.code === '42501') {
      throw new ErroDeExclusao('Rebaixe o administrador antes de excluir a conta.', 403);
    }
    if (error.code === 'P0002') {
      throw new ErroDeExclusao('Usuário não encontrado.', 404);
    }
    throw new ErroDeExclusao('Não foi possível excluir a conta agora. Tente novamente.', 500);
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: `removido-${crypto.randomUUID()}@anonimizado.invalid`,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: {},
    ban_duration: BANIMENTO_PERMANENTE,
  });
  if (authError !== null) {
    // Os dados já foram anonimizados; repetir refaz só esta etapa.
    throw new ErroDeExclusao('Não foi possível concluir a exclusão agora. Tente novamente.', 500);
  }

  return data as ResultadoDaExclusao;
}
