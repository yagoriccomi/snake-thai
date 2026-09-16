-- ============================================================================
-- Grade semanal por turma e exclusão segura de turma — T6
--
-- Até aqui a agenda era montada aula a aula. Agora cada turma tem horários
-- fixos (dia da semana + hora de São Paulo + vigência + professores) e o banco
-- gera as aulas com antecedência, todo dia, até o fim do mês seguinte — o
-- mínimo para o "X/12" da frequência estar certo desde o dia 1.
--
-- Regras que não se negociam:
--   · aula com chamada nunca é tocada pela grade;
--   · aula editada à mão fica desvinculada (schedule_detached) e a grade não
--     mexe mais nela;
--   · aula da grade apagada à mão não volta (class_schedule_skips);
--   · a hora é local de São Paulo e a conversão é do banco, nunca do aparelho.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Horários da grade
-- ----------------------------------------------------------------------------
create table public.class_schedules (
  id          uuid primary key default gen_random_uuid(),
  group_id    text not null references public.groups (id) on delete restrict,
  title       text not null constraint class_schedules_title_not_blank check (char_length(btrim(title)) > 0),
  -- 0 = domingo, igual a extract(dow) e a Date.getDay().
  weekday     smallint not null constraint class_schedules_weekday_valido check (weekday between 0 and 6),
  -- Hora LOCAL de São Paulo.
  start_time  time not null,
  valid_from  date not null,
  valid_until date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint class_schedules_vigencia_coerente check (valid_until is null or valid_until >= valid_from)
);

comment on table public.class_schedules is
  'Grade semanal: um horário fixo de uma turma. As aulas saem de gerar_aulas_da_grade(); escrita só pelas funções salvar_horario_da_grade/encerrar_horario_da_grade.';

create index idx_class_schedules_group on public.class_schedules (group_id);

create trigger trg_class_schedules_set_updated_at
  before update on public.class_schedules
  for each row execute function public.handle_updated_at();

create trigger trg_class_schedules_turma_ativa
  before insert or update of group_id on public.class_schedules
  for each row execute function public.enforce_turma_ativa();

create table public.class_schedule_teachers (
  schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (schedule_id, teacher_id)
);

create index idx_class_schedule_teachers_teacher on public.class_schedule_teachers (teacher_id);

create trigger trg_class_schedule_teachers_enforce_professor
  before insert or update on public.class_schedule_teachers
  for each row execute function public.enforce_class_teacher_is_professor();

-- Ocorrências que não devem ser geradas de novo (aula da grade apagada à mão).
-- É a base do futuro "cancelar aula / feriado".
create table public.class_schedule_skips (
  schedule_id     uuid not null references public.class_schedules (id) on delete cascade,
  occurrence_date date not null,
  created_at      timestamptz not null default now(),
  primary key (schedule_id, occurrence_date)
);

-- ----------------------------------------------------------------------------
-- 2. Aula ligada à grade
-- ----------------------------------------------------------------------------
alter table public.classes
  add column schedule_id uuid references public.class_schedules (id) on delete set null,
  add column occurrence_date date,
  add column schedule_detached boolean not null default false,
  add constraint classes_ocorrencia_coerente check (schedule_id is null or occurrence_date is not null);

comment on column public.classes.schedule_id is 'Horário da grade que gerou (ou adotou) a aula. Nulo = aula avulsa.';
comment on column public.classes.occurrence_date is 'Dia (São Paulo) da ocorrência na grade. Continua o mesmo se a aula for remarcada.';
comment on column public.classes.schedule_detached is 'Aula da grade editada à mão: a grade não altera mais esta aula.';

-- A garantia de "gerar duas vezes não duplica" é do banco, não do código. [#89]
create unique index classes_ocorrencia_unica
  on public.classes (schedule_id, occurrence_date)
  where schedule_id is not null;

-- ----------------------------------------------------------------------------
-- 3. Acesso: leitura para admin e professor; escrita só pelas funções
-- ----------------------------------------------------------------------------
alter table public.class_schedules enable row level security;
alter table public.class_schedule_teachers enable row level security;
alter table public.class_schedule_skips enable row level security;

create policy "class_schedules_select_admin_or_professor" on public.class_schedules
  for select to authenticated using (public.is_admin() or public.is_professor());
create policy "class_schedule_teachers_select_admin_or_professor" on public.class_schedule_teachers
  for select to authenticated using (public.is_admin() or public.is_professor());
create policy "class_schedule_skips_select_admin_or_professor" on public.class_schedule_skips
  for select to authenticated using (public.is_admin() or public.is_professor());

revoke all on public.class_schedules, public.class_schedule_teachers, public.class_schedule_skips from anon, authenticated;
grant select on public.class_schedules, public.class_schedule_teachers, public.class_schedule_skips to authenticated;
grant all on public.class_schedules, public.class_schedule_teachers, public.class_schedule_skips to service_role;

-- ----------------------------------------------------------------------------
-- 4. Aula da grade apagada à mão não volta
--
--    As funções da grade ligam o GUC snake.ajuste_da_grade durante os próprios
--    apagamentos (encerrar, editar, excluir turma): esses não viram exceção,
--    senão aumentar a vigência depois não geraria mais nada.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_ocorrencia_apagada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if old.schedule_id is null then
    return old;
  end if;
  if coalesce(current_setting('snake.ajuste_da_grade', true), '') = 'on' then
    return old;
  end if;

  insert into public.class_schedule_skips (schedule_id, occurrence_date)
  values (old.schedule_id, old.occurrence_date)
  on conflict do nothing;

  return old;
end;
$funcao$;

revoke execute on function public.registrar_ocorrencia_apagada() from public, anon, authenticated;

create trigger trg_classes_registrar_ocorrencia_apagada
  after delete on public.classes
  for each row execute function public.registrar_ocorrencia_apagada();

-- ----------------------------------------------------------------------------
-- 5. Geração das aulas
-- ----------------------------------------------------------------------------

-- Ocorrências que a grade quer na agenda: turma ativa, dia da semana certo,
-- dentro da vigência e do horizonte (fim do mês seguinte), ainda por começar
-- e sem exceção registrada.
create or replace function public.ocorrencias_da_grade(p_schedule_id uuid, p_agora timestamptz)
returns table (schedule_id uuid, group_id text, title text, occurrence_date date, date_time timestamptz)
language sql
stable
set search_path = ''
as $funcao$
  with limites as (
    select (p_agora at time zone 'America/Sao_Paulo')::date as hoje,
           (date_trunc('month', (p_agora at time zone 'America/Sao_Paulo')::date) + interval '2 months' - interval '1 day')::date as horizonte
  ), dias as (
    select s.id, s.group_id, s.title, s.weekday, s.start_time,
           greatest(s.valid_from, l.hoje) + n as dia
      from public.class_schedules s
      join public.groups g on g.id = s.group_id and g.archived_at is null
      cross join limites l
      -- Série de inteiros: date + integer = date, sem depender do fuso da sessão.
      cross join lateral generate_series(
        0,
        least(coalesce(s.valid_until, l.horizonte), l.horizonte) - greatest(s.valid_from, l.hoje)
      ) as n
     where p_schedule_id is null or s.id = p_schedule_id
  )
  select d.id, d.group_id, d.title, d.dia, (d.dia + d.start_time) at time zone 'America/Sao_Paulo'
    from dias d
   where extract(dow from d.dia) = d.weekday
     and ((d.dia + d.start_time) at time zone 'America/Sao_Paulo') > p_agora
     and not exists (
       select 1 from public.class_schedule_skips k
        where k.schedule_id = d.id and k.occurrence_date = d.dia
     );
$funcao$;

revoke execute on function public.ocorrencias_da_grade(uuid, timestamptz) from public, anon, authenticated;

-- Idempotente: rodar de novo não duplica. Devolve quantas aulas entraram na
-- grade nesta rodada (criadas + avulsas adotadas).
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
        on c.group_id = o.group_id
       and c.type = 'routine'
       and c.schedule_id is null
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
    insert into public.classes (title, type, date_time, group_id, schedule_id, occurrence_date)
    select o.title, 'routine', o.date_time, o.group_id, o.schedule_id, o.occurrence_date
      from public.ocorrencias_da_grade(p_schedule_id, p_agora) o
    on conflict (schedule_id, occurrence_date) where schedule_id is not null do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_criadas from criadas;

  -- 3. Professores do horário, só nas aulas desta rodada. Professor rebaixado,
  --    inativo ou anonimizado fica de fora em vez de abortar o lote.
  insert into public.class_teachers (class_id, teacher_id)
  select c.id, st.teacher_id
    from public.classes c
    join public.class_schedule_teachers st on st.schedule_id = c.schedule_id
    join public.profiles p
      on p.id = st.teacher_id
     and p.role = 'professor'
     and p.status = 'active'
     and p.anonymized_at is null
   where c.id = any (v_adotadas || v_criadas)
  on conflict do nothing;

  return coalesce(array_length(v_adotadas || v_criadas, 1), 0);
end;
$funcao$;

comment on function public.gerar_aulas_da_grade(uuid, timestamptz) is
  'Gera as aulas da grade semanal até o fim do mês seguinte (São Paulo). Idempotente. p_agora fixa a data nas regressões. Cron diário generate-scheduled-classes.';

revoke execute on function public.gerar_aulas_da_grade(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.gerar_aulas_da_grade(uuid, timestamptz) to service_role;

-- ----------------------------------------------------------------------------
-- 6. Criar e editar horário (só admin)
--
--    Na edição, só mudam as aulas FUTURAS, SEM chamada e NÃO desvinculadas.
--    Turma e dia da semana não mudam: para isso, encerre e crie outro — assim
--    o histórico de cada horário continua coerente.
-- ----------------------------------------------------------------------------
create or replace function public.salvar_horario_da_grade(
  p_id          uuid,
  p_group_id    text,
  p_title       text,
  p_weekday     smallint,
  p_start_time  time,
  p_valid_from  date,
  p_valid_until date,
  p_teacher_ids uuid[]
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
        where p.id = t.id and p.role = 'professor' and p.status = 'active' and p.anonymized_at is null
     )
  ) then
    raise exception 'Só professores ativos podem ser escalados na grade.' using errcode = '22023';
  end if;

  -- Dois horários iguais na mesma turma disputariam as mesmas aulas.
  if exists (
    select 1 from public.class_schedules s
     where s.group_id = p_group_id
       and s.weekday = p_weekday
       and s.start_time = p_start_time
       and (p_id is null or s.id <> p_id)
       and s.valid_from <= coalesce(p_valid_until, 'infinity'::date)
       and coalesce(s.valid_until, 'infinity'::date) >= p_valid_from
  ) then
    raise exception 'Esta turma já tem um horário nesse dia e hora.' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.class_schedules (group_id, title, weekday, start_time, valid_from, valid_until, created_by)
    values (p_group_id, v_titulo, p_weekday, p_start_time, p_valid_from, p_valid_until, (select auth.uid()))
    returning id into v_id;

    insert into public.class_schedule_teachers (schedule_id, teacher_id)
    select v_id, t from unnest(v_professores) as t;
  else
    select * into v_atual from public.class_schedules where id = p_id for update;
    if not found then
      raise exception 'Horário não encontrado.' using errcode = 'P0002';
    end if;

    if p_group_id is distinct from v_atual.group_id or p_weekday is distinct from v_atual.weekday then
      raise exception 'Para mudar a turma ou o dia da semana, encerre este horário e crie outro.' using errcode = '22023';
    end if;

    v_id := p_id;

    update public.class_schedules
       set title       = v_titulo,
           start_time  = p_start_time,
           valid_from  = p_valid_from,
           valid_until = p_valid_until
     where id = p_id;

    perform set_config('snake.ajuste_da_grade', 'on', true);

    -- Fora da nova vigência: sai da agenda.
    with removidas as (
      delete from public.classes c
       where c.schedule_id = p_id
         and c.date_time > now()
         and c.attendance_taken_at is null
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
             date_time = case
                           when ((c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo') > now()
                             then (c.occurrence_date + p_start_time) at time zone 'America/Sao_Paulo'
                           else c.date_time
                         end
       where c.schedule_id = p_id
         and c.date_time > now()
         and c.attendance_taken_at is null
         and not c.schedule_detached
         and (c.title is distinct from v_titulo
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
       and not c.schedule_detached
       and t <> all (v_antigos)
    on conflict do nothing;

    perform set_config('snake.ajuste_da_grade', 'off', true);
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

revoke execute on function public.salvar_horario_da_grade(uuid, text, text, smallint, time, date, date, uuid[]) from public, anon;
grant execute on function public.salvar_horario_da_grade(uuid, text, text, smallint, time, date, date, uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Encerrar horário (só admin)
--    Tira da agenda as aulas futuras sem chamada depois do último dia. Horário
--    que nem chegou a começar é apagado.
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
       and not c.schedule_detached
    returning 1
  )
  select count(*) into v_removidas from removidas;
  perform set_config('snake.ajuste_da_grade', 'off', true);

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

revoke execute on function public.encerrar_horario_da_grade(uuid, date) from public, anon;
grant execute on function public.encerrar_horario_da_grade(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Excluir turma (só admin)
--
--    Turma nunca usada é apagada. Turma com histórico é ARQUIVADA: some dos
--    seletores e guarda aulas passadas, chamadas e frequência com o nome dela.
--    Os alunos vão para onde o admin escolher; "sem turma" só de propósito,
--    porque o aluno passa a ver só eventos.
-- ----------------------------------------------------------------------------
create or replace function public.previa_exclusao_turma(p_group_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
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
    )
  );
end;
$funcao$;

revoke execute on function public.previa_exclusao_turma(text) from public, anon;
grant execute on function public.previa_exclusao_turma(text) to authenticated;

create or replace function public.excluir_turma(
  p_group_id text,
  p_destino text default null,
  p_deixar_sem_turma boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
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

  if not exists (select 1 from public.classes c where c.group_id = p_group_id)
     and not exists (select 1 from public.attendance_monthly m where m.group_id = p_group_id)
     and not exists (select 1 from public.class_schedules s where s.group_id = p_group_id) then
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
$funcao$;

revoke execute on function public.excluir_turma(text, text, boolean) from public, anon;
grant execute on function public.excluir_turma(text, text, boolean) to authenticated;

create or replace function public.reativar_turma(p_group_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador reativa turma.' using errcode = '42501';
  end if;

  update public.groups set archived_at = null where id = p_group_id;
  if not found then
    raise exception 'Turma não encontrada.' using errcode = 'P0002';
  end if;
end;
$funcao$;

revoke execute on function public.reativar_turma(text) from public, anon;
grant execute on function public.reativar_turma(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Professor excluído (LGPD) sai da grade
--
--    Sem isto a geração diária o escalaria de novo nas aulas futuras. Corpo
--    copiado da versão vigente (20260916195116), com a remoção da grade.
-- ----------------------------------------------------------------------------
create or replace function public.anonimizar_titular(p_user_id uuid, p_solicitante uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_perfil          public.profiles%rowtype;
  v_comprovantes    integer;
  v_justificativas  integer;
  v_aulas_futuras   integer := 0;
begin
  select * into v_perfil
    from public.profiles
   where id = p_user_id
     for update;

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;

  if v_perfil.anonymized_at is not null then
    return jsonb_build_object('ja_anonimizado', true);
  end if;

  if v_perfil.role = 'admin' then
    raise exception 'Rebaixe o administrador antes de excluir a conta.' using errcode = '42501';
  end if;

  v_comprovantes := public.eliminar_comprovantes_do_titular(p_user_id);

  delete from public.absence_justifications where user_id = p_user_id;
  get diagnostics v_justificativas = row_count;

  delete from public.consents where user_id = p_user_id;

  -- Fora do "if professor": um professor rebaixado antes da exclusão também
  -- pode continuar na grade.
  delete from public.class_schedule_teachers where teacher_id = p_user_id;

  if v_perfil.role = 'professor' then
    -- A cor fica: a constraint exige cor em todo professor, e as aulas passadas
    -- continuam pintadas com ela.
    delete from public.class_teachers ct
     using public.classes c
     where ct.class_id = c.id
       and ct.teacher_id = p_user_id
       and c.date_time > now();
    get diagnostics v_aulas_futuras = row_count;
  end if;

  update public.profiles
     set name           = 'Usuário removido',
         cpf            = null,
         phone          = null,
         dob            = null,
         group_id       = null,
         plan_id        = null,
         status         = 'inactive',
         deactivated_at = coalesce(deactivated_at, now()),
         anonymized_at  = now()
   where id = p_user_id;

  -- Quem pediu: pela service_role o actor_id do gatilho de auditoria fica nulo.
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    p_solicitante,
    'UPDATE',
    'profiles',
    p_user_id::text,
    jsonb_build_object(
      'lgpd_exclusao',
      jsonb_build_object('origem', case when p_solicitante = p_user_id then 'titular' else 'administrador' end)
    )
  );

  return jsonb_build_object(
    'ja_anonimizado', false,
    'comprovantes', v_comprovantes,
    'justificativas', v_justificativas,
    'aulas_futuras', v_aulas_futuras
  );
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 10. Geração diária: 03:40 UTC = 00:40 em São Paulo, depois do fechamento
--     da frequência (03:20 do dia 1).
-- ----------------------------------------------------------------------------
select cron.schedule('generate-scheduled-classes', '40 3 * * *', $$select public.gerar_aulas_da_grade()$$);
