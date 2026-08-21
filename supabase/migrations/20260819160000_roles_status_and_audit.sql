-- ============================================================================
-- Snake Thai — Gestão de papéis, status do aluno e trilha de auditoria
-- ----------------------------------------------------------------------------
-- Hoje promover alguém a administrador exige rodar SQL no banco: o cliente que
-- compra o sistema não consegue dar acesso a um sócio sem ligar para o dev.
-- Esta migration cria a base para isso ser feito pela interface, com as duas
-- travas que a operação exige:
--
--   1. NUNCA ficar sem administrador — rebaixar o último admin trava o sistema
--      inteiro para sempre, e nenhuma tela pode permitir esse tiro no pé.
--   2. Toda mudança sensível fica registrada: quem fez, o quê e quando [#63].
--
-- Traz também o status do aluno: quem tranca a matrícula não pode ser apagado
-- (o histórico financeiro e de presença precisa sobreviver), mas também não
-- deve continuar gerando cobrança nem ocupando vaga.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Status do aluno
-- ----------------------------------------------------------------------------
create type public.profile_status as enum ('active', 'inactive');

alter table public.profiles
  add column status public.profile_status not null default 'active';

alter table public.profiles
  add column deactivated_at timestamptz;

comment on column public.profiles.status is
  'Matricula ativa ou trancada. Inativo preserva o historico, mas sai da operacao.';

-- Coerência: só perfil inativo carrega a data de desativação.
alter table public.profiles
  add constraint profiles_deactivated_at_matches_status
  check ((status = 'inactive') = (deactivated_at is not null));

-- A lista de alunos ativos é a consulta mais frequente do app [#71].
create index idx_profiles_status on public.profiles (status) where status = 'active';

-- ----------------------------------------------------------------------------
-- 2. Trava: o sistema nunca pode ficar sem administrador
-- ----------------------------------------------------------------------------
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  admins_restantes integer;
begin
  -- Só interessa quando alguém deixa de ser admin (rebaixado, desativado ou
  -- excluído). Promoções e mudanças irrelevantes passam direto.
  if tg_op = 'UPDATE'
     and old.role = 'admin'
     and (new.role <> 'admin' or new.status = 'inactive') then
    null;
  elsif tg_op = 'DELETE' and old.role = 'admin' then
    null;
  else
    return coalesce(new, old);
  end if;

  select count(*) into admins_restantes
  from public.profiles
  where role = 'admin'
    and status = 'active'
    and id <> old.id;

  if admins_restantes = 0 then
    raise exception 'Operacao negada: este e o ultimo administrador ativo. Promova outro antes.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$function$;

comment on function public.prevent_last_admin_removal() is
  'Impede rebaixar, desativar ou excluir o ultimo administrador ativo.';

create trigger trg_profiles_prevent_last_admin
  before update or delete on public.profiles
  for each row execute function public.prevent_last_admin_removal();

-- ----------------------------------------------------------------------------
-- 3. Trilha de auditoria
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- Quem agiu. ON DELETE SET NULL: apagar o autor não pode apagar a trilha.
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity text not null,
  entity_id text,
  -- Apenas o que mudou, campo a campo. Nunca o registro inteiro: guardar
  -- CPF e telefone duplicados na auditoria multiplicaria a exposição de PII.
  changes jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Trilha de auditoria das entidades sensiveis. Somente leitura para admin; ninguem edita.';

create index idx_audit_log_entity on public.audit_log (entity, entity_id);
create index idx_audit_log_created_at on public.audit_log (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Gatilho genérico de auditoria
-- ----------------------------------------------------------------------------
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  campos_alterados jsonb;
begin
  if tg_op = 'UPDATE' then
    -- Diferença campo a campo: só o que realmente mudou entra no log.
    select jsonb_object_agg(chave, jsonb_build_object('de', antigo.valor, 'para', novo.valor))
      into campos_alterados
    from jsonb_each(to_jsonb(old)) as antigo(chave, valor)
    join jsonb_each(to_jsonb(new)) as novo(chave, valor) using (chave)
    where antigo.valor is distinct from novo.valor
      and chave not in ('updated_at');
  elsif tg_op = 'INSERT' then
    campos_alterados := jsonb_build_object('criado', true);
  else
    campos_alterados := jsonb_build_object('removido', true);
  end if;

  -- UPDATE que não alterou nada de relevante não vira ruído na trilha.
  if campos_alterados is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    campos_alterados
  );

  return coalesce(new, old);
end;
$function$;

comment on function public.record_audit() is
  'Registra INSERT/UPDATE/DELETE em audit_log, guardando apenas os campos alterados.';

-- Entidades sensíveis: papel/status de pessoas, dinheiro e configuração.
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.record_audit();

create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.record_audit();

create trigger trg_audit_plans
  after insert or update or delete on public.plans
  for each row execute function public.record_audit();

create trigger trg_audit_academy_settings
  after update on public.academy_settings
  for each row execute function public.record_audit();

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table public.audit_log enable row level security;

-- Só administradores leem a trilha. E ninguém escreve pela API: as linhas
-- nascem exclusivamente do trigger (security definer), o que impede forjar
-- ou apagar registro de auditoria pelo app.
create policy "audit_log_select_admin"
  on public.audit_log for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Grants (menor privilégio) [#55]
-- ----------------------------------------------------------------------------
grant select on public.audit_log to authenticated;
