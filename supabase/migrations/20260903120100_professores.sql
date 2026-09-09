-- ============================================================================
-- Snake Thai — Professores: cor, vínculo com aulas e permissões
-- ----------------------------------------------------------------------------
-- Requisitos desta rodada:
--   · Admin cadastra professores e admins, com nome/CPF completos na hora
--     (sem onboarding — diferente do fluxo de aluno).
--   · Cada professor tem uma cor própria (bolinha ao lado do nome nas aulas;
--     borda da aula dividida em faixas quando há mais de um professor).
--   · Professor vê TODAS as aulas (já valia — RLS de leitura já é aberta).
--   · Professor cria aula para si mesmo, ou se inclui numa aula de outro
--     professor. Admin põe qualquer professor, em qualquer quantidade, em
--     qualquer aula.
--   · Professor gerencia (adiciona/edita/exclui) os ALUNOS só das aulas onde
--     ele é um dos professores. Admin, de todas.
--   · Professor não vê o bloco financeiro — isso é só gate de UI (a RLS de
--     payments já é `own_or_admin`; professor não é dono nem admin, então já
--     fica de fora por construção, sem mudança aqui).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cor do professor
-- ----------------------------------------------------------------------------
alter table public.profiles add column color text;

comment on column public.profiles.color is
  'Cor característica do professor (hex #RRGGBB). Exclusiva de role=professor.';

alter table public.profiles
  add constraint profiles_color_hex_format
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

-- Integridade por papel: professor SEMPRE tem cor; ninguém mais tem.
-- (mesmo padrão de profiles_complete_when_onboarded — integridade por estado,
-- não por confiança na aplicação.)
alter table public.profiles
  add constraint profiles_color_only_for_professor
  check ((role = 'professor') = (color is not null));

-- ----------------------------------------------------------------------------
-- 2. Trigger de autoedição: professor pode alterar a PRÓPRIA cor
--
--    A versão vigente do trigger é uma WHITELIST (ver C-3 do payments — mesmo
--    princípio aplicado aqui): só os campos listados podem ser alterados pelo
--    próprio titular. `color` não estava na lista; sem este passo, o professor
--    trocando a própria cor levaria 42501.
--
--    Segurança: um aluno "tentando" setar a própria cor esbarra na constraint
--    da seção 1 (`role = 'professor') = (color is not null)`) — a whitelist
--    autoriza o CAMPO, a constraint impede o VALOR indevido. Duas camadas. [#55]
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
set search_path = ''
as $funcao$
declare
  campo_alterado text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  select chave into campo_alterado
  from jsonb_each(to_jsonb(old)) as antigo(chave, valor)
  join jsonb_each(to_jsonb(new)) as novo(chave, valor_novo) using (chave)
  where antigo.valor is distinct from novo.valor_novo
    and chave not in ('name', 'phone', 'dob', 'is_first_login', 'updated_at', 'color')
    and not (chave = 'cpf' and old.cpf is null and new.cpf is not null)
  limit 1;

  if campo_alterado is not null then
    raise exception
      'Operação negada: o campo "%" só pode ser alterado por um administrador.',
      campo_alterado
      using errcode = '42501';
  end if;

  return new;
end;
$funcao$;

comment on function public.enforce_profile_update_rules() is
  'Restringe o que o titular altera no proprio perfil a uma lista de permitidos '
  '(name, phone, dob, is_first_login, color). O CPF pode ser definido uma unica '
  'vez no onboarding (null -> valor); depois disso, so o admin altera. Coluna '
  'nova nasce restrita ao admin.';

-- ----------------------------------------------------------------------------
-- 3. Helper: é professor?
-- ----------------------------------------------------------------------------
create or replace function public.is_professor()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'professor'
  );
$$;

revoke execute on function public.is_professor() from public, anon;
grant execute on function public.is_professor() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Tabela: class_teachers — vínculo N:N entre aulas e professores
--
--    Uma aula pode ter vários professores (co-docência) — é o que permite
--    "aulas simultâneas de professores diferentes" (nenhuma exclusividade de
--    horário aqui) e "se incluir na aula de outro professor" (o professor
--    adiciona a si mesmo a uma aula já existente).
-- ----------------------------------------------------------------------------
create table public.class_teachers (
  class_id   uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

comment on table public.class_teachers is
  'Professores de cada aula (N:N). Ordem de created_at define a ordem das faixas de cor na borda da aula.';

create index idx_class_teachers_teacher on public.class_teachers (teacher_id);

-- Integridade que uma CHECK simples não expressa (referencia outra tabela):
-- só um profile com role='professor' pode ser vinculado como professor de
-- uma aula. Vale para QUALQUER inserção — inclusive as feitas pelo admin: a
-- regra é sobre o DADO ("isto é um professor?"), não sobre quem está inserindo.
create or replace function public.enforce_class_teacher_is_professor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = new.teacher_id;

  if v_role is distinct from 'professor' then
    raise exception 'teacher_id % não corresponde a um professor.', new.teacher_id
      using errcode = '23514'; -- mesmo código de violação de CHECK
  end if;

  return new;
end;
$$;

create trigger trg_class_teachers_enforce_professor
  before insert or update on public.class_teachers
  for each row execute function public.enforce_class_teacher_is_professor();

-- RLS
alter table public.class_teachers enable row level security;

-- Leitura aberta: a bolinha e a borda colorida aparecem para QUALQUER pessoa
-- que veja a aula (aluno incluso) — mesmo espírito de `classes_select_authenticated`.
create policy "class_teachers_select_authenticated"
  on public.class_teachers for select to authenticated
  using (true);

-- Inserção: admin insere qualquer professor em qualquer aula, em qualquer
-- quantidade. Professor só insere A SI MESMO — criar sua própria aula, ou se
-- incluir na aula de outro professor.
create policy "class_teachers_insert_admin_or_self"
  on public.class_teachers for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_professor() and teacher_id = (select auth.uid()))
  );

-- Remoção: admin remove qualquer vínculo. Professor só sai de uma aula por
-- conta própria (remove A SI MESMO) — não pode expulsar outro professor.
create policy "class_teachers_delete_admin_or_self"
  on public.class_teachers for delete to authenticated
  using (
    public.is_admin()
    or (public.is_professor() and teacher_id = (select auth.uid()))
  );

-- ----------------------------------------------------------------------------
-- 5. classes — professor passa a poder CRIAR (não editar/excluir a aula em
--    si; isso continua exclusivo do admin, fora do escopo pedido aqui).
-- ----------------------------------------------------------------------------
drop policy "classes_insert_admin" on public.classes;

create policy "classes_insert_admin_or_professor"
  on public.classes for insert to authenticated
  with check (public.is_admin() or public.is_professor());

-- update/delete de classes permanecem admin-only (classes_update_admin,
-- classes_delete_admin) — não tocadas.

-- ----------------------------------------------------------------------------
-- 6. attendance — professor gerencia o roster das aulas em que É professor.
--    Reescreve as 4 policies para acrescentar essa terceira via, ao lado de
--    "própria presença" (aluno) e "admin".
-- ----------------------------------------------------------------------------
drop policy "attendance_select_own_or_admin" on public.attendance;
drop policy "attendance_insert_own_or_admin" on public.attendance;
drop policy "attendance_update_own_or_admin" on public.attendance;
drop policy "attendance_delete_admin" on public.attendance;

create policy "attendance_select_own_admin_or_teacher"
  on public.attendance for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = attendance.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

create policy "attendance_insert_own_admin_or_teacher"
  on public.attendance for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = attendance.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

create policy "attendance_update_own_admin_or_teacher"
  on public.attendance for update to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = attendance.class_id
        and ct.teacher_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = attendance.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- DELETE nunca foi liberado para o próprio aluno (só admin) — agora também
-- para o professor daquela aula, cobrindo "excluir aluno da aula".
create policy "attendance_delete_admin_or_teacher"
  on public.attendance for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
      where ct.class_id = attendance.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Grants (menor privilégio — mesmo padrão das demais tabelas)
-- ----------------------------------------------------------------------------
grant select, insert, delete on public.class_teachers to authenticated;
