-- ============================================================================
-- Snake Thai — Triggers de proteção cientes do contexto de sistema
-- ----------------------------------------------------------------------------
-- Os triggers anti-escalonamento tratavam qualquer chamador não-admin como
-- "aluno". Porém operações de SISTEMA (pg_cron, service_role) rodam sem usuário
-- autenticado (auth.uid() = null) e precisam poder atualizar status (ex.: a
-- Regra A marca pagamentos como overdue). Um ALUNO real SEMPRE tem auth.uid();
-- portanto liberar apenas quando o uid é nulo é seguro.
-- ============================================================================

-- payments: aluno só altera proof_url e status(=pending_approval); admin e
-- sistema (uid nulo) podem tudo.
create or replace function public.enforce_payment_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  if new.id <> old.id
     or new.user_id <> old.user_id
     or new.plan_id is distinct from old.plan_id
     or new.due_date <> old.due_date
     or new.created_at <> old.created_at then
    raise exception 'Operação negada: aluno só pode alterar proof_url e status do próprio pagamento.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status and new.status <> 'pending_approval' then
    raise exception 'Operação negada: aluno só pode definir o status como pending_approval.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- profiles: mesma proteção; libera admin e contexto de sistema (uid nulo).
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  if new.id <> old.id
     or new.role <> old.role
     or (old.cpf is not null and new.cpf is distinct from old.cpf)
     or new.created_at <> old.created_at then
    raise exception 'Operação negada: aluno não pode alterar id, role, cpf ou created_at.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
