-- ============================================================================
-- Contrato v3 — históricos de plano, trancamento, meta e turma
-- (bloco 4.1, fatia 5; § 4, § 5.2, § 5.3, D58, T4, T8, T51–T53)
--
-- A conta nova (4.5) precisa saber, para cada data, em que plano, turma e
-- situação o aluno estava. Hoje o banco só guarda o estado ATUAL, e reativar
-- apaga a data do trancamento. Estas tabelas guardam a história.
--
-- Aqui nascem as tabelas, os backfills, o gatilho do histórico de turma (que
-- precisa valer para o APK 1.8, que muda a turma por `update` direto) e a
-- exclusão de turma que passa a arquivar. Os gatilhos de plano e de
-- trancamento (`registrar_periodo_de_plano`, `registrar_periodo_inativo`) são
-- do bloco 4.3.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. is_staff() (§ 4): quem dá aula. Nasce aqui porque as políticas abaixo
--    já a usam; o resto do § 4 (admin como professor) é o bloco 4.2.
-- ----------------------------------------------------------------------------
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = (select auth.uid()) and role in ('professor', 'admin')
  );
$$;

comment on function public.is_staff() is
  'Professor ou admin (D33: admin também dá aula). Toda regra nova de "quem dá aula" usa esta função; is_professor() não muda.';

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Histórico de plano (T3, T4)
-- ----------------------------------------------------------------------------
create table public.plan_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz null,
  constraint plan_periods_fim_coerente check (ended_at is null or ended_at >= started_at)
);

create unique index plan_periods_um_aberto on public.plan_periods (user_id) where ended_at is null;
create index plan_periods_por_aluno on public.plan_periods (user_id, started_at);
create index plan_periods_por_plano on public.plan_periods (plan_id);

-- Backfill: quem tem plano hoje, desde o cadastro. O que veio antes não é
-- reconstruído (mesmo critério da T52).
insert into public.plan_periods (user_id, plan_id, started_at)
select p.id, p.plan_id, p.created_at
  from public.profiles p
 where p.plan_id is not null;

-- Plano com histórico não muda de modalidade nem de cota e não é apagado
-- (T4): mudar reescreveria a frequência passada.
create function public.enforce_plan_in_use_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.schedule_mode is not distinct from old.schedule_mode
     and new.weekly_quota is not distinct from old.weekly_quota then
    return new;
  end if;

  if exists (select 1 from public.plan_periods pp where pp.plan_id = old.id) then
    raise exception 'Plano com histórico: crie outro plano e mova os alunos.' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.enforce_plan_in_use_rules() from public, anon, authenticated;

create trigger enforce_plan_in_use_rules
  before update of schedule_mode, weekly_quota or delete on public.plans
  for each row execute function public.enforce_plan_in_use_rules();

-- ----------------------------------------------------------------------------
-- 3. Histórico de trancamento (T8)
-- ----------------------------------------------------------------------------
create table public.inactive_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz null,
  constraint inactive_periods_fim_coerente check (ended_at is null or ended_at >= started_at)
);

create unique index inactive_periods_um_aberto on public.inactive_periods (user_id) where ended_at is null;
create index inactive_periods_por_aluno on public.inactive_periods (user_id, started_at);

-- Backfill: quem está trancado hoje, desde o trancamento.
insert into public.inactive_periods (user_id, started_at)
select p.id, p.deactivated_at
  from public.profiles p
 where p.status = 'inactive' and p.deactivated_at is not null;

-- ----------------------------------------------------------------------------
-- 4. Meta semanal do à vontade (§ 5.3, D35–D38)
-- ----------------------------------------------------------------------------
create table public.weekly_goals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_week_start date not null,
  goal smallint not null,
  set_by uuid null references public.profiles (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (user_id, effective_week_start),
  constraint weekly_goals_meta_valida check (goal between 1 and 6)
);

-- ----------------------------------------------------------------------------
-- 5. Histórico de turma (§ 5.2, D58, T51–T53)
-- ----------------------------------------------------------------------------
create table public.student_group_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Turma com histórico é arquivada, nunca apagada.
  group_id text not null references public.groups (id) on delete restrict,
  started_at timestamptz not null,
  start_reason text not null,
  ended_at timestamptz null,
  end_reason text null,
  constraint student_group_periods_inicio_valido check (start_reason in ('signup', 'group_changed', 'backfill')),
  constraint student_group_periods_fim_coerente check (
    (ended_at is null) = (end_reason is null) and (ended_at is null or ended_at > started_at)
  ),
  constraint student_group_periods_motivo_valido check (end_reason in ('group_changed', 'group_closed'))
);

comment on table public.student_group_periods is
  'Turma do aluno em cada período (D58). A aula c é da turma do período se started_at <= c.date_time e (ended_at nulo ou c.date_time < ended_at). Gravada só pelo gatilho registrar_periodo_de_turma; um período fechado não muda mais.';

create unique index student_group_periods_um_aberto on public.student_group_periods (user_id) where ended_at is null;
-- A chamada procura quem estava na turma da aula.
create index student_group_periods_por_turma on public.student_group_periods (group_id, started_at);

-- Backfill (T52), ANTES do gatilho: um período aberto por aluno com turma,
-- desde a data mais antiga em que a turma atual é certa.
insert into public.student_group_periods (user_id, group_id, started_at, start_reason)
select p.id, p.group_id, coalesce(p.group_since, p.created_at), 'backfill'
  from public.profiles p
 where p.group_id is not null;

-- O gatilho: grava o histórico em QUALQUER caminho que muda a turma (app
-- novo, APK 1.8 com update direto, create-student, excluir_turma,
-- anonimizar_titular) e aplica a T53 às trocas do aluno. Roda depois do
-- `marcar_entrada_na_turma` (BEFORE), que continua mantendo `group_since`.
create function public.registrar_periodo_de_turma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_aberto public.student_group_periods%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.group_id is not null then
      insert into public.student_group_periods (user_id, group_id, started_at, start_reason)
      values (new.id, new.group_id, coalesce(new.group_since, new.created_at), 'signup');
    end if;
    return new;
  end if;

  if new.group_id is not distinct from old.group_id then
    return new;
  end if;

  select * into v_aberto
    from public.student_group_periods
   where user_id = new.id and ended_at is null
   for update;

  if found then
    if v_aberto.started_at >= v_agora then
      -- Mudança desfeita antes de valer (duas mudanças no mesmo instante):
      -- o período nunca teve aula nenhuma.
      delete from public.student_group_periods where id = v_aberto.id;
    else
      update public.student_group_periods
         set ended_at = v_agora, end_reason = 'group_changed'
       where id = v_aberto.id;
    end if;
  end if;

  if new.group_id is not null then
    insert into public.student_group_periods (user_id, group_id, started_at, start_reason)
    values (new.id, new.group_id, v_agora, 'group_changed');
  end if;

  -- T53: a troca avulsa que sai de uma aula da turma antiga AINDA POR VIR
  -- perde o objeto (a aula deixa de ser dele); a que sai de aula que já
  -- começou segue (a aula passada continua sendo dele, e cancelar a
  -- reposição devolveria uma falta causada pela academia).
  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
   where s.user_id = new.id
     and s.kind = 'once'
     and s.status in ('pending', 'approved')
     and exists (select 1 from public.classes c where c.id = s.from_class_id and c.date_time > v_agora);

  -- A permanente é de um horário da turma antiga ou para dentro da nova:
  -- não sobrevive à mudança (P10). Vigente = começou e não terminou (T37),
  -- inclusive a que já tinha fim marcado no futuro.
  update public.class_swap_periods sp
     set ended_at = v_agora, end_reason = 'group_changed'
   where sp.user_id = new.id
     and sp.started_at <= v_agora
     and (sp.ended_at is null or sp.ended_at > v_agora);

  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
   where s.user_id = new.id
     and s.kind = 'permanent'
     and s.status = 'pending';

  return new;
end;
$$;

revoke execute on function public.registrar_periodo_de_turma() from public, anon, authenticated;

create trigger registrar_periodo_de_turma
  after insert or update of group_id on public.profiles
  for each row execute function public.registrar_periodo_de_turma();

-- ----------------------------------------------------------------------------
-- 6. Exclusão de turma: com histórico, arquiva (assinaturas iguais)
-- ----------------------------------------------------------------------------
create or replace function public.excluir_turma(
  p_group_id text,
  p_destino text default null,
  p_deixar_sem_turma boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma             public.groups%rowtype;
  v_hoje              date := (now() at time zone 'America/Sao_Paulo')::date;
  v_alunos            integer;
  v_aulas_removidas   integer;
  v_horarios_apagados integer;
  v_acao              text;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador exclui turma.' using errcode = '42501';
  end if;

  select * into v_turma from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0002';
  end if;

  if v_turma.archived_at is not null then
    raise exception 'A turma já está arquivada.' using errcode = '22023';
  end if;

  if p_destino is not null and coalesce(p_deixar_sem_turma, false) then
    raise exception 'Escolha uma turma de destino ou "sem turma", não os dois.' using errcode = '22023';
  end if;

  if p_destino is not null and (
    p_destino = p_group_id
    or not exists (select 1 from public.groups g where g.id = p_destino and g.archived_at is null)
  ) then
    raise exception 'A turma de destino não existe ou está arquivada.' using errcode = '22023';
  end if;

  select count(*) into v_alunos from public.profiles p where p.group_id = p_group_id;

  if v_alunos > 0 and p_destino is null and not coalesce(p_deixar_sem_turma, false) then
    raise exception 'Escolha para qual turma vão os alunos, ou marque "sem turma".' using errcode = '22023';
  end if;

  update public.profiles set group_id = p_destino where group_id = p_group_id;

  -- O gatilho registrar_periodo_de_turma fechou os períodos como
  -- 'group_changed'; aqui o motivo certo é a turma ter acabado (§ 5.2).
  update public.student_group_periods
     set end_reason = 'group_closed'
   where group_id = p_group_id
     and ended_at = now()
     and end_reason = 'group_changed';

  -- Aulas futuras sem chamada (da grade e avulsas): turma encerrada não tem
  -- aula futura. Declarações e justificativas pendentes vão junto; o anexo
  -- entra na fila de eliminação LGPD pelo gatilho da justificativa.
  perform set_config('snake.ajuste_da_grade', 'on', true);
  with removidas as (
    delete from public.classes c
     where c.group_id = p_group_id
       and c.date_time > now()
       and c.attendance_taken_at is null
    returning 1
  )
  select count(*) into v_aulas_removidas from removidas;
  perform set_config('snake.ajuste_da_grade', 'off', true);

  with apagados as (
    delete from public.class_schedules s
     where s.group_id = p_group_id
       and not exists (select 1 from public.classes c where c.schedule_id = s.id)
    returning 1
  )
  select count(*) into v_horarios_apagados from apagados;

  update public.class_schedules
     set valid_until = greatest(v_hoje, valid_from)
   where group_id = p_group_id
     and (valid_until is null or valid_until > greatest(v_hoje, valid_from));

  -- Turma com histórico de aluno é arquivada: a frequência continua contando
  -- as aulas dela até agora (D58), e a FK do histórico é restrict.
  if not exists (select 1 from public.classes c where c.group_id = p_group_id)
     and not exists (select 1 from public.attendance_monthly m where m.group_id = p_group_id)
     and not exists (select 1 from public.class_schedules s where s.group_id = p_group_id)
     and not exists (select 1 from public.student_group_periods g where g.group_id = p_group_id) then
    delete from public.groups where id = p_group_id;
    v_acao := 'apagada';
  else
    update public.groups set archived_at = now() where id = p_group_id;
    v_acao := 'arquivada';
  end if;

  return jsonb_build_object(
    'acao', v_acao,
    'alunos_movidos', v_alunos,
    'aulas_removidas', v_aulas_removidas,
    'horarios_apagados', v_horarios_apagados
  );
end;
$$;

create or replace function public.previa_exclusao_turma(p_group_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_turma public.groups%rowtype;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador exclui turma.' using errcode = '42501';
  end if;

  select * into v_turma from public.groups where id = p_group_id;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'arquivada', v_turma.archived_at is not null,
    'alunos', (select count(*) from public.profiles p where p.group_id = p_group_id),
    'aulas_futuras_sem_chamada', (
      select count(*) from public.classes c
       where c.group_id = p_group_id and c.date_time > now() and c.attendance_taken_at is null
    ),
    'aulas_passadas', (
      select count(*) from public.classes c
       where c.group_id = p_group_id and (c.date_time <= now() or c.attendance_taken_at is not null)
    ),
    'horarios_ativos', (
      select count(*) from public.class_schedules s
       where s.group_id = p_group_id and (s.valid_until is null or s.valid_until >= v_hoje)
    ),
    'meses_congelados', (
      select count(distinct m.reference_month) from public.attendance_monthly m where m.group_id = p_group_id
    ),
    -- Mesma condição que excluir_turma usa para apagar em vez de arquivar.
    'pode_apagar_de_vez', not exists (
      select 1 from public.classes c
       where c.group_id = p_group_id and (c.date_time <= now() or c.attendance_taken_at is not null)
    ) and not exists (
      select 1 from public.attendance_monthly m where m.group_id = p_group_id
    ) and not exists (
      select 1 from public.student_group_periods g where g.group_id = p_group_id
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS e grants (§ 0.1; § 5.2: quem lê). Escrita direta: nenhuma.
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['plan_periods', 'inactive_periods', 'weekly_goals', 'student_group_periods'] loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format('revoke all on public.%I from anon, authenticated', v_tabela);
    execute format('grant all on public.%I to service_role', v_tabela);
    execute format('grant select on public.%I to authenticated', v_tabela);
  end loop;
end $$;

-- O plano leva ao preço: a equipe toda não lê, só o admin (§ 5.2).
create policy plan_periods_select_proprio_ou_admin on public.plan_periods
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy inactive_periods_select_proprio_ou_equipe on public.inactive_periods
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy weekly_goals_select_proprio_ou_equipe on public.weekly_goals
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- A turma não leva a dado sensível, e o professor já vê a turma de todos (D32).
create policy student_group_periods_select_proprio_ou_equipe on public.student_group_periods
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
