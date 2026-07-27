-- ============================================================================
-- Snake Thai — Tabela de turmas (groups)
-- ----------------------------------------------------------------------------
-- Fonte de dados para o seletor de turma (Dropdown/Picker) na UI do admin.
-- `profiles.group_id` e `classes.group_id` (text) passam a referenciar groups.id.
-- ============================================================================

create table public.groups (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  created_at timestamptz not null default now(),
  constraint groups_name_not_blank check (char_length(btrim(name)) > 0)
);

comment on table public.groups is 'Turmas da academia; alimenta o seletor de group_id.';

-- Integridade referencial das turmas (ON DELETE SET NULL: apagar a turma não
-- apaga alunos/aulas, apenas os desvincula).
alter table public.profiles
  add constraint profiles_group_id_fkey
  foreign key (group_id) references public.groups (id) on delete set null;

alter table public.classes
  add constraint classes_group_id_fkey
  foreign key (group_id) references public.groups (id) on delete set null;

-- Grants (menor privilégio) + RLS.
grant select, insert, update, delete on public.groups to authenticated;

alter table public.groups enable row level security;

-- Leitura liberada para autenticados (todos precisam resolver o nome da turma).
create policy "groups_select_authenticated"
  on public.groups for select to authenticated
  using (true);

create policy "groups_insert_admin"
  on public.groups for insert to authenticated
  with check (public.is_admin());

create policy "groups_update_admin"
  on public.groups for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "groups_delete_admin"
  on public.groups for delete to authenticated
  using (public.is_admin());
