-- ============================================================================
-- 4.3 — Planos, grade, dias de aula e contato (contrato v4, § 5, § 5.4, § 6,
-- T3, T4, T7, T37, T39, T44)
--
-- O esquema (colunas, constraints e a trava de plano com histórico) veio no
-- 4.1. Aqui entram os comportamentos:
--   - histórico de plano e de trancamento mantidos por gatilho, com os
--     encerramentos de troca da T39 (deixar de ser fixo; trancamento);
--   - o público da grade (`p_audience`) e o horário "só livres" sem turma;
--   - o fim de horário que encerra as trocas permanentes de destino, nunca
--     com data passada (T37, T39, § 6);
--   - `trocas_permanentes_do_horario` e `contato_da_academia`.
-- O recálculo do mês fechado (T31) que esses encerramentos pedem é ligado
-- com a conta nova, no bloco 4.5: até lá não há mês fechado pela conta nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Primeiro instante de aula da semana (T3), num lugar só
-- ----------------------------------------------------------------------------
create function public.inicio_da_semana_de_aula(p_segunda date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  -- 0 = domingo; a semana vai de segunda (0 dias) a domingo (6 dias).
  select (p_segunda + min(((d + 6) % 7))::int)::timestamp at time zone 'America/Sao_Paulo'
    from unnest(
      coalesce((select s.class_weekdays from public.academy_settings s limit 1), '{1,2,3,4,5,6}'::smallint[])
    ) as d;
$$;

comment on function public.inicio_da_semana_de_aula(date) is
  '00:00 (SP) do primeiro dia de aula (academy_settings.class_weekdays) da semana que começa em p_segunda. É o instante em que a modalidade da semana é decidida (T3). Interna.';

revoke execute on function public.inicio_da_semana_de_aula(date) from public, anon, authenticated;

-- plano_da_semana passa a ler o instante daqui (mesma assinatura e regra).
create or replace function public.plano_da_semana(p_user_id uuid, p_segunda date)
returns table (plan_id uuid, schedule_mode public.plan_schedule_mode, weekly_quota smallint, inicio_na_semana timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_instante timestamptz := public.inicio_da_semana_de_aula(p_segunda);
  v_inicio_da_semana timestamptz := p_segunda::timestamp at time zone 'America/Sao_Paulo';
begin
  -- O plano aberto às 00:00 do primeiro dia de aula vale para a semana inteira.
  return query
    select pp.plan_id, p.schedule_mode, p.weekly_quota, null::timestamptz
      from public.plan_periods pp
      join public.plans p on p.id = pp.plan_id
     where pp.user_id = p_user_id
       and pp.started_at <= v_instante
       and (pp.ended_at is null or pp.ended_at > v_instante)
     order by pp.started_at desc
     limit 1;
  if found then
    return;
  end if;

  -- Sem plano nesse instante: o primeiro que começou dentro da semana.
  return query
    select pp.plan_id, p.schedule_mode, p.weekly_quota, pp.started_at
      from public.plan_periods pp
      join public.plans p on p.id = pp.plan_id
     where pp.user_id = p_user_id
       and pp.started_at >= v_inicio_da_semana
       and pp.started_at < v_inicio_da_semana + interval '7 days'
     order by pp.started_at
     limit 1;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Histórico de plano (T3) e a T39 de "deixar de ser fixo"
-- ----------------------------------------------------------------------------
create function public.registrar_periodo_de_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora       timestamptz := now();
  v_aberto      public.plan_periods%rowtype;
  v_era_fixo    boolean;
  v_fica_fixo   boolean;
  v_segunda     date;
  v_inicio      timestamptz;
  v_fim         timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.plan_id is not null then
      insert into public.plan_periods (user_id, plan_id, started_at)
      values (new.id, new.plan_id, coalesce(new.created_at, v_agora));
    end if;
    return new;
  end if;

  if new.plan_id is not distinct from old.plan_id then
    return new;
  end if;

  select * into v_aberto
    from public.plan_periods
   where user_id = new.id and ended_at is null
   for update;

  if found then
    if v_aberto.started_at >= v_agora then
      -- Mudança desfeita antes de valer: o período nunca valeu para nada.
      delete from public.plan_periods where id = v_aberto.id;
    else
      update public.plan_periods set ended_at = v_agora where id = v_aberto.id;
    end if;
  end if;

  if new.plan_id is not null then
    insert into public.plan_periods (user_id, plan_id, started_at)
    values (new.id, new.plan_id, v_agora);
  end if;

  -- Sem plano conta como fixo (T5).
  v_era_fixo := coalesce((select p.schedule_mode from public.plans p where p.id = old.plan_id), 'fixed') = 'fixed';
  v_fica_fixo := coalesce((select p.schedule_mode from public.plans p where p.id = new.plan_id), 'fixed') = 'fixed';

  if v_era_fixo = v_fica_fixo then
    return new;
  end if;

  -- A 1ª semana alcançada pela mudança: a atual, se o primeiro dia de aula
  -- dela ainda não começou; senão, a seguinte (T3).
  v_segunda := date_trunc('week', v_agora at time zone 'America/Sao_Paulo')::date;
  v_inicio := public.inicio_da_semana_de_aula(v_segunda);
  if v_inicio < v_agora then
    v_segunda := v_segunda + 7;
    v_inicio := public.inicio_da_semana_de_aula(v_segunda);
  end if;

  if v_fica_fixo then
    -- Voltou a fixo antes de a semana não fixa começar: os períodos
    -- encerrados por aquela mudança voltam a valer (T39).
    update public.class_swap_periods
       set ended_at = null, end_reason = null
     where user_id = new.id
       and end_reason = 'plan_changed'
       and ended_at > v_agora;
    return new;
  end if;

  -- Deixou de ser fixo (T39, § 9.4). O fim nunca vai para o passado (T37).
  v_fim := greatest(v_agora, v_inicio);

  update public.class_swap_periods
     set ended_at = v_fim, end_reason = 'plan_changed'
   where user_id = new.id
     and started_at <= v_agora
     and (ended_at is null or ended_at > v_fim);

  update public.class_swaps
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
   where user_id = new.id
     and kind = 'permanent'
     and status = 'pending';

  -- A avulsa cai se a semana dela (a da aula original) deixa de ser fixa.
  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
   where s.user_id = new.id
     and s.kind = 'once'
     and s.status in ('pending', 'approved')
     and exists (
       select 1 from public.classes c
        where c.id = s.from_class_id
          and date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date >= v_segunda
     );

  return new;
end;
$$;

revoke execute on function public.registrar_periodo_de_plano() from public, anon, authenticated;

create trigger registrar_periodo_de_plano
  after insert or update of plan_id on public.profiles
  for each row execute function public.registrar_periodo_de_plano();

-- ----------------------------------------------------------------------------
-- 3. Histórico de trancamento e a T39 do trancamento
-- ----------------------------------------------------------------------------
create function public.registrar_periodo_inativo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora  timestamptz := now();
  v_aberto public.inactive_periods%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.status = 'inactive' then
      insert into public.inactive_periods (user_id, started_at)
      values (new.id, coalesce(new.deactivated_at, v_agora));
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'inactive' then
    insert into public.inactive_periods (user_id, started_at) values (new.id, v_agora);

    -- As pendentes caem; a avulsa aprovada e os períodos seguem (as aulas
    -- trancadas já não contam, e o período volta a valer ao reativar).
    update public.class_swaps
       set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
     where user_id = new.id
       and status = 'pending';
    return new;
  end if;

  select * into v_aberto
    from public.inactive_periods
   where user_id = new.id and ended_at is null
   for update;

  if found then
    if v_aberto.started_at >= v_agora then
      delete from public.inactive_periods where id = v_aberto.id;
    else
      update public.inactive_periods set ended_at = v_agora where id = v_aberto.id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.registrar_periodo_inativo() from public, anon, authenticated;

create trigger registrar_periodo_inativo
  after insert or update of status on public.profiles
  for each row execute function public.registrar_periodo_inativo();

-- ----------------------------------------------------------------------------
-- 4. Fim de horário e as trocas permanentes (§ 6, T37, T39)
--    Um lugar só para as três funções que mexem no fim de um horário.
-- ----------------------------------------------------------------------------
create function public.ajustar_trocas_ao_fim_do_horario(p_schedule_id uuid, p_ultimo_dia date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_fim   timestamptz;
begin
  if p_ultimo_dia is null then
    -- Fim retirado: o que este fim encerrou e ainda não chegou volta a valer.
    update public.class_swap_periods
       set ended_at = null, end_reason = null
     where to_schedule_id = p_schedule_id
       and end_reason = 'schedule_ended'
       and ended_at > v_agora;
    return;
  end if;

  -- 00:00 (SP) do dia seguinte ao último dia, nunca no passado (D49).
  v_fim := greatest(v_agora, (p_ultimo_dia + 1)::timestamp at time zone 'America/Sao_Paulo');

  -- Fim adiado ou antecipado: o encerramento que ainda não chegou acompanha.
  update public.class_swap_periods
     set ended_at = v_fim
   where to_schedule_id = p_schedule_id
     and end_reason = 'schedule_ended'
     and ended_at > v_agora;

  -- Vigentes (T37, inclusive os com fim marcado depois do novo fim).
  update public.class_swap_periods
     set ended_at = v_fim, end_reason = 'schedule_ended'
   where to_schedule_id = p_schedule_id
     and started_at <= v_agora
     and (ended_at is null or ended_at > v_fim);

  update public.class_swaps
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = v_agora
   where kind = 'permanent'
     and status = 'pending'
     and (from_schedule_id = p_schedule_id or to_schedule_id = p_schedule_id);
end;
$$;

comment on function public.ajustar_trocas_ao_fim_do_horario(uuid, date) is
  'Fim de horário (§ 6, T37, T39): encerra os períodos permanentes de destino às 00:00 (SP) do dia seguinte ao último dia (nunca no passado), acompanha fim adiado ou retirado e cancela as permanentes pendentes do horário. Interna.';

revoke execute on function public.ajustar_trocas_ao_fim_do_horario(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Ocorrências: o horário "só livres" sem turma também gera aula (§ 6, T7)
--    Mudou o retorno (audience): DROP + CREATE (§ 0.1, regra 5).
-- ----------------------------------------------------------------------------
drop function public.ocorrencias_da_grade(uuid, timestamptz);

create function public.ocorrencias_da_grade(p_schedule_id uuid, p_agora timestamptz)
returns table (
  schedule_id uuid, group_id text, title text, audience public.class_audience,
  occurrence_date date, date_time timestamptz
)
language sql
stable
set search_path = ''
as $funcao$
  with limites as (
    select (p_agora at time zone 'America/Sao_Paulo')::date as hoje,
           (date_trunc('month', (p_agora at time zone 'America/Sao_Paulo')::date) + interval '2 months' - interval '1 day')::date as horizonte
  ), dias as (
    select s.id, s.group_id, s.title, s.audience, s.weekday, s.start_time,
           greatest(s.valid_from, l.hoje) + n as dia
      from public.class_schedules s
      left join public.groups g on g.id = s.group_id
      cross join limites l
      -- Série de inteiros: date + integer = date, sem depender do fuso da sessão.
      cross join lateral generate_series(
        0,
        least(coalesce(s.valid_until, l.horizonte), l.horizonte) - greatest(s.valid_from, l.hoje)
      ) as n
     where (p_schedule_id is null or s.id = p_schedule_id)
       and (s.group_id is null or g.archived_at is null)
  )
  select d.id, d.group_id, d.title, d.audience, d.dia, (d.dia + d.start_time) at time zone 'America/Sao_Paulo'
    from dias d
   where extract(dow from d.dia) = d.weekday
     and ((d.dia + d.start_time) at time zone 'America/Sao_Paulo') > p_agora
     and not exists (
       select 1 from public.class_schedule_skips k
        where k.schedule_id = d.id and k.occurrence_date = d.dia
     );
$funcao$;

revoke execute on function public.ocorrencias_da_grade(uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Geração das aulas: copia o público; o horário sem turma adota a aula
--    avulsa sem turma; aula cancelada nunca é adotada (§ 6)
-- ----------------------------------------------------------------------------

create or replace function public.gerar_aulas_da_grade(
  p_schedule_id uuid default null,
  p_agora timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_adotadas uuid[];
  v_criadas  uuid[];
begin
  -- Cron e salvamento ao mesmo tempo disputariam a mesma aula avulsa.
  perform pg_advisory_xact_lock(hashtext('public.gerar_aulas_da_grade'));

  -- 1. Aula avulsa da mesma turma no mesmo instante é ADOTADA, não duplicada:
  --    preserva declarações e justificativas já feitas.
  with adotaveis as (
    select distinct on (o.schedule_id, o.occurrence_date)
           c.id as class_id, o.schedule_id, o.occurrence_date
      from public.ocorrencias_da_grade(p_schedule_id, p_agora) o
      join public.classes c
        on c.group_id is not distinct from o.group_id
       and c.type = 'routine'
       and c.schedule_id is null
       and c.cancelled_at is null
       and c.date_time = o.date_time
     where not exists (
       select 1 from public.classes x
        where x.schedule_id = o.schedule_id and x.occurrence_date = o.occurrence_date
     )
     order by o.schedule_id, o.occurrence_date, c.created_at, c.id
  ), adotadas as (
    update public.classes c
       set schedule_id = a.schedule_id,
           occurrence_date = a.occurrence_date
      from adotaveis a
     where c.id = a.class_id
       and c.schedule_id is null
    returning c.id
  )
  select coalesce(array_agg(id), '{}') into v_adotadas from adotadas;

  -- 2. O resto é criado; a ocorrência que já existe fica como está.
  with criadas as (
    insert into public.classes (title, type, date_time, group_id, audience, schedule_id, occurrence_date)
    select o.title, 'routine', o.date_time, o.group_id, o.audience, o.schedule_id, o.occurrence_date
      from public.ocorrencias_da_grade(p_schedule_id, p_agora) o
    on conflict (schedule_id, occurrence_date) where schedule_id is not null do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_criadas from criadas;

  -- 3. Professores do horário, só nas aulas desta rodada. Quem deixou a
  --    equipe, ficou sem cor, inativo ou anonimizado fica de fora em vez de
  --    abortar o lote. O admin com cor dá aula como o professor (§ 4, T24).
  insert into public.class_teachers (class_id, teacher_id)
  select c.id, st.teacher_id
    from public.classes c
    join public.class_schedule_teachers st on st.schedule_id = c.schedule_id
    join public.profiles p
      on p.id = st.teacher_id
     and p.role in ('professor', 'admin')
     and p.color is not null
     and p.status = 'active'
     and p.anonymized_at is null
   where c.id = any (v_adotadas || v_criadas)
  on conflict do nothing;

  return coalesce(array_length(v_adotadas || v_criadas, 1), 0);
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 7. Salvar horário com público (§ 6): DROP + CREATE, com p_audience no fim
--    para as chamadas de hoje (posicionais ou por nome) continuarem valendo.
-- ----------------------------------------------------------------------------
drop function public.salvar_horario_da_grade(text, text, smallint, time, date, uuid[], date, uuid);

create or replace function public.salvar_horario_da_grade(
  p_group_id    text,
  p_title       text,
  p_weekday     smallint,
  p_start_time  time,
  p_valid_from  date,
  p_teacher_ids uuid[] default '{}',
  p_valid_until date default null,
  p_id          uuid default null,
  p_audience    public.class_audience default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_professores uuid[] := coalesce(array(select distinct t from unnest(p_teacher_ids) as t where t is not null), '{}');
  v_atual       public.class_schedules%rowtype;
  v_antigos     uuid[];
  v_id          uuid;
  v_titulo      text := btrim(coalesce(p_title, ''));
  v_ajustadas   integer := 0;
  v_removidas   integer := 0;
  v_na_grade    integer;
  v_publico     public.class_audience;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador edita a grade.' using errcode = '42501';
  end if;

  if p_valid_until is not null and p_valid_from is not null and p_valid_until < p_valid_from then
    raise exception 'O fim da vigência não pode ser antes do início.' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(v_professores) as t(id)
     where not exists (
       select 1 from public.profiles p
        where p.id = t.id and p.role in ('professor', 'admin') and p.color is not null
          and p.status = 'active' and p.anonymized_at is null
     )
  ) then
    raise exception 'Só professores e administradores ativos com cor podem ser escalados na grade.' using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_atual from public.class_schedules where id = p_id for update;
    if not found then
      raise exception 'Horário não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- Nulo: na criação, fixos e livres; na edição, mantém o público (§ 6, § 15).
  v_publico := coalesce(p_audience, v_atual.audience, 'both');

  if p_group_id is null and v_publico <> 'free' then
    raise exception 'Horário sem turma só pode ser para alunos de horário livre.' using errcode = '22023';
  end if;

  -- Dois horários iguais na mesma turma (ou dois sem turma) disputariam as mesmas aulas.
  if exists (
    select 1 from public.class_schedules s
     where s.group_id is not distinct from p_group_id
       and s.weekday = p_weekday
       and s.start_time = p_start_time
       and (p_id is null or s.id <> p_id)
       and s.valid_from <= coalesce(p_valid_until, 'infinity'::date)
       and coalesce(s.valid_until, 'infinity'::date) >= p_valid_from
  ) then
    raise exception 'Esta turma já tem um horário nesse dia e hora.' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.class_schedules (group_id, title, weekday, start_time, valid_from, valid_until, audience, created_by)
    values (p_group_id, v_titulo, p_weekday, p_start_time, p_valid_from, p_valid_until, v_publico, (select auth.uid()))
    returning id into v_id;

    insert into public.class_schedule_teachers (schedule_id, teacher_id)
    select v_id, t from unnest(v_professores) as t;
  else
    if p_group_id is distinct from v_atual.group_id or p_weekday is distinct from v_atual.weekday then
      raise exception 'Para mudar a turma ou o dia da semana, encerre este horário e crie outro.' using errcode = '22023';
    end if;

    v_id := p_id;

    update public.class_schedules
       set title       = v_titulo,
           start_time  = p_start_time,
           valid_from  = p_valid_from,
           valid_until = p_valid_until,
           audience    = v_publico
     where id = p_id;

    perform set_config('snake.ajuste_da_grade', 'on', true);

    -- Fora da nova vigência: sai da agenda.
    with removidas as (
      delete from public.classes c
       where c.schedule_id = p_id
         and c.date_time > now()
         and c.attendance_taken_at is null
         and c.cancelled_at is null
         and not c.schedule_detached
         and (c.occurrence_date < p_valid_from
              or (p_valid_until is not null and c.occurrence_date > p_valid_until))
      returning 1
    )
    select count(*) into v_removidas from removidas;

    -- Título e hora novos. A hora só muda se o novo instante ainda for futuro:
    -- mudar 19:00 para 08:00 às 10:00 de hoje não cria aula no passado.
    with ajustadas as (
      update public.classes c
         set title     = v_titulo,
             audience  = v_publico,
             date_time = case
                           when ((c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo') > now()
                             then (c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo'
                           else c.date_time
                         end
       where c.schedule_id = p_id
         and c.date_time > now()
         and c.attendance_taken_at is null
         and c.cancelled_at is null
         and not c.schedule_detached
         and (c.title is distinct from v_titulo
              or c.audience is distinct from v_publico
              or (c.date_time is distinct from ((c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo')
                  and ((c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo') > now()))
      returning 1
    )
    select count(*) into v_ajustadas from ajustadas;

    -- Professores: aplica só a diferença, para não desfazer quem entrou ou
    -- saiu à mão de uma aula específica.
    select coalesce(array_agg(teacher_id), '{}') into v_antigos
      from public.class_schedule_teachers where schedule_id = p_id;

    delete from public.class_schedule_teachers
     where schedule_id = p_id and teacher_id <> all (v_professores);
    insert into public.class_schedule_teachers (schedule_id, teacher_id)
    select p_id, t from unnest(v_professores) as t
    on conflict do nothing;

    delete from public.class_teachers ct
     using public.classes c
     where ct.class_id = c.id
       and c.schedule_id = p_id
       and c.date_time > now()
       and c.attendance_taken_at is null
       and c.cancelled_at is null
       and not c.schedule_detached
       and ct.teacher_id = any (v_antigos)
       and ct.teacher_id <> all (v_professores);

    insert into public.class_teachers (class_id, teacher_id)
    select c.id, t
      from public.classes c
      cross join unnest(v_professores) as t
     where c.schedule_id = p_id
       and c.date_time > now()
       and c.attendance_taken_at is null
       and c.cancelled_at is null
       and not c.schedule_detached
       and t <> all (v_antigos)
    on conflict do nothing;

    perform set_config('snake.ajuste_da_grade', 'off', true);

    -- Fim novo, mudado ou retirado: as trocas permanentes acompanham (§ 6).
    if p_valid_until is distinct from v_atual.valid_until then
      perform public.ajustar_trocas_ao_fim_do_horario(p_id, p_valid_until);
    end if;
  end if;

  v_na_grade := public.gerar_aulas_da_grade(v_id);

  return jsonb_build_object(
    'schedule_id', v_id,
    'ajustadas', v_ajustadas,
    'removidas', v_removidas,
    'criadas', v_na_grade
  );
end;
$funcao$;

revoke execute on function public.salvar_horario_da_grade(text, text, smallint, time, date, uuid[], date, uuid, public.class_audience) from public, anon;
grant execute on function public.salvar_horario_da_grade(text, text, smallint, time, date, uuid[], date, uuid, public.class_audience) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Encerrar horário (mesma assinatura): nunca apaga aula cancelada; as
--    trocas permanentes acompanham o fim (§ 6)
-- ----------------------------------------------------------------------------
create or replace function public.encerrar_horario_da_grade(p_id uuid, p_ultimo_dia date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_atual     public.class_schedules%rowtype;
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  v_removidas integer;
  v_acao      text;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador edita a grade.' using errcode = '42501';
  end if;

  select * into v_atual from public.class_schedules where id = p_id for update;
  if not found then
    raise exception 'Horário não encontrado.' using errcode = 'P0002';
  end if;

  if p_ultimo_dia is null or p_ultimo_dia < v_hoje - 1 then
    raise exception 'O último dia do horário não pode ser antes de ontem.' using errcode = '22023';
  end if;

  perform set_config('snake.ajuste_da_grade', 'on', true);
  with removidas as (
    delete from public.classes c
     where c.schedule_id = p_id
       and c.occurrence_date > p_ultimo_dia
       and c.date_time > now()
       and c.attendance_taken_at is null
       and c.cancelled_at is null
       and not c.schedule_detached
    returning 1
  )
  select count(*) into v_removidas from removidas;
  perform set_config('snake.ajuste_da_grade', 'off', true);

  -- Antes de apagar o horário: a permanente pendente perderia o ponteiro.
  perform public.ajustar_trocas_ao_fim_do_horario(p_id, p_ultimo_dia);

  if p_ultimo_dia < v_atual.valid_from then
    delete from public.class_schedules where id = p_id;
    v_acao := 'apagado';
  else
    update public.class_schedules set valid_until = p_ultimo_dia where id = p_id;
    v_acao := 'encerrado';
  end if;

  return jsonb_build_object('acao', v_acao, 'removidas', v_removidas);
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 9. Excluir turma (mesmas assinaturas): nunca apaga aula cancelada; os
--    horários que ela fecha encerram as trocas permanentes de destino (§ 6)
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
  v_horario           record;
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
  -- aula futura. A cancelada fica, riscada, como registro (§ 6).
  perform set_config('snake.ajuste_da_grade', 'on', true);
  with removidas as (
    delete from public.classes c
     where c.group_id = p_group_id
       and c.date_time > now()
       and c.attendance_taken_at is null
       and c.cancelled_at is null
    returning 1
  )
  select count(*) into v_aulas_removidas from removidas;
  perform set_config('snake.ajuste_da_grade', 'off', true);

  -- Permanentes pendentes com horários desta turma: antes de apagar os
  -- horários nunca usados, que levariam o ponteiro junto.
  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = now()
   where s.kind = 'permanent'
     and s.status = 'pending'
     and exists (
       select 1 from public.class_schedules h
        where h.group_id = p_group_id
          and h.id in (s.from_schedule_id, s.to_schedule_id)
     );

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

  for v_horario in
    select h.id, h.valid_until from public.class_schedules h where h.group_id = p_group_id
  loop
    perform public.ajustar_trocas_ao_fim_do_horario(v_horario.id, v_horario.valid_until);
  end loop;

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

-- ----------------------------------------------------------------------------
-- 10. Quem tem troca permanente com um horário (§ 6) — só admin
-- ----------------------------------------------------------------------------
create function public.trocas_permanentes_do_horario(p_schedule_id uuid)
returns table (user_id uuid, student_name text, papel text, started_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador vê as trocas permanentes do horário.' using errcode = '42501';
  end if;

  -- Vigente agora (T37): começou e não terminou, inclusive com fim no futuro.
  return query
    select sp.user_id,
           p.name,
           case when sp.to_schedule_id = p_schedule_id then 'destino' else 'origem' end,
           sp.started_at
      from public.class_swap_periods sp
      join public.profiles p on p.id = sp.user_id
     where p_schedule_id in (sp.from_schedule_id, sp.to_schedule_id)
       and sp.started_at <= now()
       and (sp.ended_at is null or sp.ended_at > now())
     order by p.name, sp.started_at;
end;
$$;

comment on function public.trocas_permanentes_do_horario(uuid) is
  'Alunos com troca permanente vigente (T37) que usa o horário, como origem ou destino. A grade avisa antes de encerrar ou editar (§ 6). Só admin.';

revoke execute on function public.trocas_permanentes_do_horario(uuid) from public, anon;
grant execute on function public.trocas_permanentes_do_horario(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. Contato da academia (§ 5.4, D52, T44): qualquer pessoa logada, nunca
--     antes do login. App e web leem o contato só por aqui.
-- ----------------------------------------------------------------------------
create function public.contato_da_academia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('whatsapp', s.contact_whatsapp, 'email', s.contact_email)
       from public.academy_settings s
      limit 1),
    jsonb_build_object('whatsapp', null, 'email', null)
  );
$$;

comment on function public.contato_da_academia() is
  'O contato público da academia para "Falar com a academia" e o bloco de contato dos pedidos negados (§ 5.4): {"whatsapp", "email"}, nulos quando não cadastrados.';

revoke execute on function public.contato_da_academia() from public, anon;
grant execute on function public.contato_da_academia() to authenticated;
