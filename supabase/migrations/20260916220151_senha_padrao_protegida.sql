-- ============================================================================
-- Senha de primeiro acesso protegida — lacuna L1
--
-- Duas falhas:
--   1. academy_settings tem RLS "select using (true)": QUALQUER usuário logado
--      lia a senha padrão e, com o e-mail de alguém recém-cadastrado, entrava
--      na conta dela antes do primeiro acesso;
--   2. as Edge Functions de conta nem liam essa coluna: usavam um literal
--      público no repositório, e trocar a senha em Configurações não fazia nada.
--
-- Agora a senha vive em academy_secrets, que só o servidor lê; o admin lê e
-- troca por função. A coluna antiga fica (o APK 1.6.0 ainda a lê e grava), mas
-- só guarda a máscara: o que o app antigo gravar ali vai para a tabela
-- protegida. Remover a coluna fica para quando não houver mais APK antigo.
-- ============================================================================

create table public.academy_secrets (
  id                       boolean primary key default true
                           constraint academy_secrets_linha_unica check (id),
  default_student_password text not null
                           constraint academy_secrets_senha_minima check (length(default_student_password) >= 8),
  updated_at               timestamptz not null default now()
);

comment on table public.academy_secrets is
  'L1: segredos operacionais da academia (senha de primeiro acesso). Só service_role lê; admin usa senha_padrao_da_academia()/definir_senha_padrao_da_academia(). Sem auditoria de propósito: o audit_log guardaria a senha.';

alter table public.academy_secrets enable row level security;
revoke all on public.academy_secrets from anon, authenticated;
grant select, insert, update on public.academy_secrets to service_role;

create trigger trg_academy_secrets_set_updated_at
  before update on public.academy_secrets
  for each row execute function public.handle_updated_at();

-- Copia a senha vigente antes de mascarar a coluna antiga.
insert into public.academy_secrets (id, default_student_password)
select true, s.default_student_password
  from public.academy_settings s
 where s.id = true
on conflict (id) do nothing;

comment on column public.academy_settings.default_student_password is
  'OBSOLETA (L1): guarda só "********". A senha real está em academy_secrets. Mantida porque o APK 1.6.0 lê e grava esta coluna.';

-- ----------------------------------------------------------------------------
-- O app antigo grava a senha aqui: leva para a tabela protegida e mascara.
-- BEFORE: o gatilho de auditoria (AFTER) já vê só a máscara.
-- ----------------------------------------------------------------------------
create or replace function public.proteger_senha_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if new.default_student_password is distinct from '********' then
    insert into public.academy_secrets (id, default_student_password)
    values (true, new.default_student_password)
    on conflict (id) do update set default_student_password = excluded.default_student_password;
  end if;
  new.default_student_password := '********';
  return new;
end;
$funcao$;

revoke execute on function public.proteger_senha_padrao() from public, anon, authenticated;

create trigger trg_academy_settings_proteger_senha_padrao
  before insert or update of default_student_password on public.academy_settings
  for each row execute function public.proteger_senha_padrao();

-- Mascara o valor atual. A máscara tem 8 caracteres (respeita a check antiga)
-- e o gatilho não a copia para academy_secrets.
update public.academy_settings set default_student_password = '********' where id = true;

-- ----------------------------------------------------------------------------
-- Admin lê e troca a senha
-- ----------------------------------------------------------------------------
create or replace function public.senha_padrao_da_academia()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador vê a senha de primeiro acesso.' using errcode = '42501';
  end if;
  return (select s.default_student_password from public.academy_secrets s where s.id = true);
end;
$funcao$;

revoke execute on function public.senha_padrao_da_academia() from public, anon;
grant execute on function public.senha_padrao_da_academia() to authenticated;

create or replace function public.definir_senha_padrao_da_academia(p_senha text)
returns void
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador troca a senha de primeiro acesso.' using errcode = '42501';
  end if;
  if p_senha is null or length(p_senha) < 8 or p_senha = '********' then
    raise exception 'A senha de primeiro acesso precisa de ao menos 8 caracteres.' using errcode = '23514';
  end if;

  insert into public.academy_secrets (id, default_student_password)
  values (true, p_senha)
  on conflict (id) do update set default_student_password = excluded.default_student_password;
end;
$funcao$;

revoke execute on function public.definir_senha_padrao_da_academia(text) from public, anon;
grant execute on function public.definir_senha_padrao_da_academia(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Quantas contas ainda não fizeram o primeiro acesso (seguem com a senha
-- padrão): ao trocar a senha, vale redefinir as antigas.
-- ----------------------------------------------------------------------------
create or replace function public.contas_sem_primeiro_acesso()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador consulta as contas.' using errcode = '42501';
  end if;
  return (
    select count(*)::integer from public.profiles p
     where p.is_first_login and p.anonymized_at is null and p.status = 'active'
  );
end;
$funcao$;

revoke execute on function public.contas_sem_primeiro_acesso() from public, anon;
grant execute on function public.contas_sem_primeiro_acesso() to authenticated;
