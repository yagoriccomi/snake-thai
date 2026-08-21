-- ============================================================================
-- Snake Thai — Migration inicial do esquema
-- ----------------------------------------------------------------------------
-- Cria ENUMs de domínio, tabelas (profiles, classes, attendance, payments),
-- índices, triggers e políticas de Row Level Security (RLS).
--
-- Princípios (100 Melhores Práticas):
--   * Esquema versionado em migration, nunca alterado à mão [#87].
--   * Integridade referencial explícita com ON DELETE coerente [#89].
--   * Sem magic strings: conjuntos fixos como ENUM tipado [#3].
--   * LGPD: PII (CPF/telefone/DOB) protegida por RLS estrita + triggers [#63].
--   * Índices nas colunas de JOIN/WHERE/ORDER BY [#71].
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tipos ENUM (domínio)
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.class_type as enum ('routine', 'event');
create type public.attendance_status as enum ('present', 'absent');
create type public.payment_status as enum ('pending_approval', 'open', 'overdue', 'paid');

-- ----------------------------------------------------------------------------
-- 2. Funções utilitárias
-- ----------------------------------------------------------------------------

-- Atualiza automaticamente a coluna updated_at em cada UPDATE.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Obs.: a função public.is_admin() é criada logo após a tabela profiles
-- (seção 3), pois seu corpo referencia essa tabela e é validado na criação.

-- ----------------------------------------------------------------------------
-- 3. Tabela: profiles  (PII sensível — LGPD)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'user',
  name text not null,
  cpf text not null unique,
  phone text,
  dob date,
  is_first_login boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_cpf_format check (cpf ~ '^[0-9]{11}$'),
  constraint profiles_name_not_blank check (char_length(btrim(name)) > 0)
);

comment on table public.profiles is 'Perfis de alunos e administradores. Contém PII (LGPD): cpf, phone, dob.';
comment on column public.profiles.cpf is 'PII: apenas dígitos (11). Acesso restrito por RLS.';
comment on column public.profiles.is_first_login is 'True até o aluno concluir o primeiro acesso (troca de senha inicial).';

create index idx_profiles_role on public.profiles (role);

-- Verifica se o usuário autenticado é admin.
-- SECURITY DEFINER + search_path vazio: roda como owner e BYPASSA a RLS de
-- profiles, evitando recursão infinita (política de profiles chamaria a si mesma).
-- Criada após profiles porque seu corpo referencia essa tabela.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Tabela: classes
-- ----------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type public.class_type not null default 'routine',
  date_time timestamptz not null,
  group_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_title_not_blank check (char_length(btrim(title)) > 0)
);

comment on table public.classes is 'Aulas (rotina) e eventos. group_id segmenta as turmas.';

create index idx_classes_group_id on public.classes (group_id);
create index idx_classes_date_time on public.classes (date_time);

-- ----------------------------------------------------------------------------
-- 5. Tabela: attendance
-- ----------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Sem default e nullable de propósito: exige ação explícita do aluno.
  status public.attendance_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um único registro de presença por aluno por aula.
  constraint attendance_unique_class_user unique (class_id, user_id)
);

comment on table public.attendance is 'Presença por aula. status sem default exige marcação explícita.';

create index idx_attendance_class_id on public.attendance (class_id);
create index idx_attendance_user_id on public.attendance (user_id);

-- ----------------------------------------------------------------------------
-- 6. Tabela: payments
-- ----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Referência FUTURA a public.plans (tabela de domínio recomendada). Provisório.
  plan_id uuid,
  status public.payment_status not null default 'open',
  due_date date not null,
  -- Caminho do comprovante no Storage (bucket payment_proofs). Nunca a URL pública.
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is 'Mensalidades/pagamentos. proof_url guarda o path do comprovante no Storage.';
comment on column public.payments.plan_id is 'FK futura a public.plans (ainda não criada — antihardcode recomendado).';

create index idx_payments_user_id on public.payments (user_id);
create index idx_payments_status on public.payments (status);
create index idx_payments_due_date on public.payments (due_date);

-- ----------------------------------------------------------------------------
-- 7. Triggers de updated_at
-- ----------------------------------------------------------------------------
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_classes_set_updated_at
  before update on public.classes
  for each row execute function public.handle_updated_at();

create trigger trg_attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.handle_updated_at();

create trigger trg_payments_set_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Triggers de proteção (anti-escalonamento de privilégio) — LGPD/segurança
-- ----------------------------------------------------------------------------

-- profiles: aluno NÃO pode alterar id, role ou cpf da própria linha.
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
     or new.cpf is distinct from old.cpf
     or new.created_at <> old.created_at then
    raise exception 'Operação negada: aluno não pode alterar id, role, cpf ou created_at.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_profiles_enforce_update
  before update on public.profiles
  for each row execute function public.enforce_profile_update_rules();

-- payments: aluno só pode alterar proof_url e status (e status só p/ pending_approval).
create or replace function public.enforce_payment_update_rules()
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

create trigger trg_payments_enforce_update
  before update on public.payments
  for each row execute function public.enforce_payment_update_rules();

-- ----------------------------------------------------------------------------
-- 9. Grants (menor privilégio) [#55]
--    O papel `anon` NÃO recebe acesso: todas as tabelas exigem autenticação.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security (RLS) — habilitada em TODAS as tabelas
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.attendance enable row level security;
alter table public.payments enable row level security;

-- ---- profiles ----
-- Aluno lê a própria linha; admin lê todas.
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

-- Apenas admin cria perfis (o primeiro admin é semeado via service_role — ver seed.sql).
create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

-- Aluno atualiza a própria linha; admin atualiza todas.
-- (colunas sensíveis role/cpf/id são barradas pelo trigger enforce_profile_update_rules)
create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- Apenas admin deleta perfis.
create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- ---- classes ----
-- Leitura liberada para autenticados (filtragem por group_id no app).
create policy "classes_select_authenticated"
  on public.classes for select to authenticated
  using (true);

create policy "classes_insert_admin"
  on public.classes for insert to authenticated
  with check (public.is_admin());

create policy "classes_update_admin"
  on public.classes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "classes_delete_admin"
  on public.classes for delete to authenticated
  using (public.is_admin());

-- ---- attendance ----
create policy "attendance_select_own_or_admin"
  on public.attendance for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "attendance_insert_own_or_admin"
  on public.attendance for insert to authenticated
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "attendance_update_own_or_admin"
  on public.attendance for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "attendance_delete_admin"
  on public.attendance for delete to authenticated
  using (public.is_admin());

-- ---- payments ----
create policy "payments_select_own_or_admin"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- Apenas admin cria cobranças.
create policy "payments_insert_admin"
  on public.payments for insert to authenticated
  with check (public.is_admin());

-- Aluno atualiza o próprio pagamento; admin atualiza todos.
-- (restrição de colunas/valores para o aluno é feita pelo trigger enforce_payment_update_rules)
create policy "payments_update_own_or_admin"
  on public.payments for update to authenticated
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "payments_delete_admin"
  on public.payments for delete to authenticated
  using (public.is_admin());
