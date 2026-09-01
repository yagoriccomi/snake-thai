-- ============================================================================
-- Snake Thai — Pagamentos: o aluno passa a ter uma LISTA DE PERMISSÕES
-- ----------------------------------------------------------------------------
-- Corrige o achado C-3 do REVIEW.md.
--
-- O QUE ESTAVA ERRADO: `enforce_payment_update_rules` era uma lista de
-- PROIBIÇÕES — negava `id`, `user_id`, `plan_id`, `due_date` e `created_at`.
-- Toda coluna criada depois nasceu, por omissão, gravável pelo aluno.
--
-- Foi o que aconteceu com `amount_cents` (migration 20260819140000): a RLS
-- libera o UPDATE porque a linha é do próprio aluno, e o trigger não tinha o
-- que dizer sobre uma coluna que ele não conhecia. Na prática:
--
--   PATCH /rest/v1/payments?id=eq.<pagamento-do-proprio-aluno>
--   { "amount_cents": 1 }
--
-- e a mensalidade de R$ 129,90 vira R$ 0,01 — refletindo no painel do admin e
-- no indicador "recebido no mês", que soma essa coluna.
--
-- A CORREÇÃO: inverter a lógica. O aluno só pode tocar no que está declarado
-- abaixo; qualquer outra diferença entre `old` e `new` é negada. A comparação
-- é feita sobre a linha inteira convertida em JSON, então uma coluna
-- acrescentada amanhã já nasce protegida, sem ninguém precisar lembrar de
-- voltar aqui. Falha fechado, que é a postura correta numa tabela financeira.
-- [#55]
-- ============================================================================

create or replace function public.enforce_payment_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $funcao$
declare
  /*
   * O que o fluxo do aluno legitimamente altera:
   *   · status              — só para 'pending_approval' (checado abaixo)
   *   · proof_*             — o envio do comprovante, nos dois provedores
   *   · updated_at          — escrito pelo gatilho de timestamp, não por ele
   */
  colunas_do_aluno constant text[] := array[
    'status',
    'proof_provider',
    'proof_public_id',
    'proof_storage_path',
    'proof_url',
    'updated_at'
  ];
  linha_antes  jsonb := to_jsonb(old);
  linha_depois jsonb := to_jsonb(new);
  coluna       text;
begin
  -- Admin e contexto de sistema (uid nulo — cron, service_role) seguem livres.
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  for coluna in select jsonb_object_keys(linha_depois) loop
    if (linha_antes -> coluna) is distinct from (linha_depois -> coluna)
       and not (coluna = any (colunas_do_aluno)) then
      raise exception
        'Operação negada: aluno não pode alterar a coluna "%" do pagamento.', coluna
        using errcode = '42501';
    end if;
  end loop;

  if new.status is distinct from old.status and new.status <> 'pending_approval' then
    raise exception 'Operação negada: aluno só pode definir o status como pending_approval.'
      using errcode = '42501';
  end if;

  return new;
end;
$funcao$;

comment on function public.enforce_payment_update_rules() is
  'Lista de PERMISSÕES do aluno sobre payments. Coluna nova nasce negada — ver C-3 no REVIEW.md.';
