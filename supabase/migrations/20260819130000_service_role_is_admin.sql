-- ============================================================================
-- Permite que operações de SISTEMA atualizem `profiles`
-- ----------------------------------------------------------------------------
-- O trigger `enforce_profile_update_rules` já previa o contexto de sistema
-- (`auth.uid() is null`), mas avaliava `public.is_admin()` ANTES dessa checagem.
-- Como o EXECUTE de `is_admin()` foi revogado de todos os papéis exceto
-- `authenticated`, qualquer UPDATE feito pela `service_role` — por exemplo a
-- Edge Function `reset-student-password` marcando `is_first_login` — morria com
-- "permission denied for function is_admin", antes de chegar à cláusula que o
-- teria liberado.
--
-- Duas correções complementares:
--   1. Inverter a ordem no trigger: contexto de sistema sai por curto-circuito
--      e nem chama a função — mais barato por linha e sem depender de GRANT.
--   2. Conceder EXECUTE à `service_role` mesmo assim, para que qualquer outro
--      caminho que dependa de `is_admin()` não volte a quebrar.
-- ============================================================================

create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  -- Operação de sistema (service_role, pg_cron): não há usuário para checar.
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_admin() then
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

grant execute on function public.is_admin() to service_role;
