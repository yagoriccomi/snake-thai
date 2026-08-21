-- ============================================================================
-- Snake Thai — Ajuste de profiles para o fluxo de Onboarding obrigatório
-- ----------------------------------------------------------------------------
-- O admin cria a conta do aluno informando apenas o e-mail; a linha em profiles
-- nasce "pendente" (is_first_login = true) com name/cpf ainda nulos, que o aluno
-- preenche no onboarding. Aqui relaxamos os NOT NULL e garantimos a integridade
-- por estado (um perfil já onboarded precisa ter name e cpf).
-- ============================================================================

-- 1. name e cpf passam a ser opcionais enquanto o perfil está pendente.
alter table public.profiles alter column name drop not null;
alter table public.profiles alter column cpf drop not null;

-- 2. Integridade por estado: perfil concluído (is_first_login=false) exige name e cpf.
--    (o UNIQUE de cpf permite múltiplos NULL — vários perfis pendentes coexistem.)
alter table public.profiles
  add constraint profiles_complete_when_onboarded
  check (is_first_login or (name is not null and cpf is not null));

-- 3. Ajusta o trigger anti-escalonamento: PERMITE a definição inicial do cpf
--    (null → valor) no onboarding, mas segue bloqueando a troca de um cpf já
--    existente, além de id/role/created_at.
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
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

comment on constraint profiles_complete_when_onboarded on public.profiles is
  'Garante que perfis já onboarded tenham name e cpf preenchidos (LGPD/integridade).';
