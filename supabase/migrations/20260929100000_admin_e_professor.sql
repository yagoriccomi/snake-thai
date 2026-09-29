-- ============================================================================
-- 4.2 — Admin é professor (contrato v4, § 4 e T24)
--
-- O admin que tem cor passa a dar aula como o professor: entra e sai de aula,
-- é escalado na grade, aparece com a cor para todos e recebe os avisos de
-- professor da aula. A cor é o que o trilho das aulas mostra, por isso o admin
-- só é vinculado a uma aula com cor (T24), e promover um professor mantém a
-- cor dele. `is_professor()` não muda: regra nova de "quem dá aula" usa
-- `is_staff()` (4.1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cor por papel: professor sempre tem cor; aluno nunca; admin pode ter.
--    § 0.1, regra 7: NOT VALID, conferência e só então VALIDATE.
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_color_only_for_professor;

alter table public.profiles
  add constraint profiles_color_by_role
  check ((role <> 'professor' or color is not null) and (role <> 'user' or color is null))
  not valid;

do $$
begin
  if exists (
    select 1 from public.profiles
     where not ((role <> 'professor' or color is not null) and (role <> 'user' or color is null))
  ) then
    raise exception 'profiles_color_by_role: há perfis com cor incoerente com o papel; corrija antes de validar.';
  end if;
end $$;

alter table public.profiles validate constraint profiles_color_by_role;

comment on column public.profiles.color is
  'Cor da pessoa no trilho das aulas (hex #RRGGBB). Obrigatória para professor, opcional para admin (sem cor, ele não dá aula, T24), proibida para aluno.';

-- ----------------------------------------------------------------------------
-- 2. Vínculo com a aula e com o horário: equipe com cor (T24).
--    Papel e cor só são conferidos ao criar o vínculo: tirar a cor depois é
--    barrado na própria mudança de cor (seção 3), não aqui.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_class_teacher_is_professor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  public.user_role;
  v_color text;
begin
  select role, color into v_role, v_color from public.profiles where id = new.teacher_id;

  if v_role is null or v_role not in ('professor', 'admin') then
    raise exception 'teacher_id % não corresponde a um professor.', new.teacher_id
      using errcode = '23514';
  end if;

  -- Só o admin pode estar sem cor (profiles_color_by_role exige a do professor).
  if v_color is null then
    raise exception 'Escolha a sua cor antes de entrar na aula.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger trg_class_teachers_enforce_professor on public.class_teachers;
create trigger trg_class_teachers_enforce_professor
  before insert or update of teacher_id on public.class_teachers
  for each row execute function public.enforce_class_teacher_is_professor();

drop trigger trg_class_schedule_teachers_enforce_professor on public.class_schedule_teachers;
create trigger trg_class_schedule_teachers_enforce_professor
  before insert or update of teacher_id on public.class_schedule_teachers
  for each row execute function public.enforce_class_teacher_is_professor();

-- ----------------------------------------------------------------------------
-- 3. Mudança de papel e de cor
--    - Promover professor -> admin mantém a cor: o APK <= 1.8 manda
--      `color: null` na promoção, porque antes a constraint exigia isso.
--    - O admin tira a própria cor com outro update; se ele está escalado em
--      aula futura, a aula ficaria sem a cor no trilho, então é recusado.
--    - As regras de papel de 2026-09-22 continuam iguais.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_role_change_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if old.role = 'professor' and new.role = 'admin' then
    new.color := coalesce(new.color, old.color);
  end if;

  if new.role = 'admin' and new.color is null and old.color is not null
     and exists (
       select 1
         from public.class_teachers ct
         join public.classes c on c.id = ct.class_id
        where ct.teacher_id = new.id
          and c.date_time > now()
     ) then
    raise exception 'Você está em aulas que ainda vão acontecer. Saia delas antes de apagar a sua cor.'
      using errcode = '23514';
  end if;

  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Sem sessão é migration, seed ou o servidor (service_role) montando dados.
  if (select auth.uid()) is null then
    return new;
  end if;

  if old.role = 'user' or new.role = 'user' then
    raise exception
      'Operação negada: a conta de aluno não muda de papel. Cadastre a pessoa como professor ou administrador.'
      using errcode = '42501';
  end if;

  return new;
end;
$funcao$;

comment on function public.enforce_role_change_rules() is
  'Só professor vira administrador (e volta a professor); aluno não muda de papel pelo app (2026-09-22). Promover mantém a cor, e o admin escalado em aula futura não apaga a cor (§ 4, T24).';

revoke execute on function public.enforce_role_change_rules() from public, anon, authenticated;

drop trigger enforce_role_change_rules on public.profiles;
create trigger enforce_role_change_rules
  before update of role, color on public.profiles
  for each row execute function public.enforce_role_change_rules();

-- ----------------------------------------------------------------------------
-- 4. Diretório: o admin com cor aparece para todos, como o professor, e a
--    equipe (não só o professor) vê os alunos. `schedule_mode` entra no fim:
--    o `select('*')` do APK 1.8 continua recebendo as colunas de antes.
-- ----------------------------------------------------------------------------
create or replace view public.diretorio_perfis
with (security_invoker = false)
as
select
  p.id,
  p.name,
  p.color,
  p.role,
  p.group_id,
  p.status,
  case
    when p.role = 'user' then coalesce(pl.schedule_mode, 'fixed'::public.plan_schedule_mode)
  end as schedule_mode
from public.profiles p
left join public.plans pl on pl.id = p.plan_id
where p.anonymized_at is null
  and (
    p.role = 'professor'
    or (p.role = 'admin' and p.color is not null)
    or p.id = (select auth.uid())
    or public.is_admin()
    or (public.is_staff() and p.role = 'user')
  );

-- ----------------------------------------------------------------------------
-- 5. Grade: admin com cor é escalado e copiado para as aulas (mesmas assinaturas)
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

create or replace function public.salvar_horario_da_grade(
  p_group_id    text,
  p_title       text,
  p_weekday     smallint,
  p_start_time  time,
  p_valid_from  date,
  p_teacher_ids uuid[] default '{}',
  p_valid_until date default null,
  p_id          uuid default null
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
        where p.id = t.id and p.role in ('professor', 'admin') and p.color is not null
          and p.status = 'active' and p.anonymized_at is null
     )
  ) then
    raise exception 'Só professores e administradores ativos com cor podem ser escalados na grade.' using errcode = '22023';
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

-- ----------------------------------------------------------------------------
-- 6. Avisos de professor da aula: quem está em class_teachers, qualquer papel
--    (o admin escalado recebe como o professor; sem ninguém, os admins).
-- ----------------------------------------------------------------------------

create or replace function public.notificar_justificativa_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_destinatario uuid;
  v_tem_professor boolean;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  begin
    select exists (
      select 1 from public.class_teachers ct
        join public.profiles p on p.id = ct.teacher_id
       where ct.class_id = new.class_id
         and p.status = 'active' and p.anonymized_at is null
    ) into v_tem_professor;

    for v_destinatario in
      select p.id
        from public.profiles p
       where p.status = 'active' and p.anonymized_at is null
         and (
           (v_tem_professor
              and exists (select 1 from public.class_teachers ct where ct.class_id = new.class_id and ct.teacher_id = p.id))
           or (not v_tem_professor and p.role = 'admin')
         )
    loop
      perform public.enfileirar_notificacao(
        v_destinatario, 'justificativa_pendente', format('justificativa_pendente:%s', new.id),
        '{}'::jsonb, null, new.class_id, new.id);
    end loop;
  exception when others then
    raise warning 'Notificação de justificativa não enfileirada (%): %', sqlstate, sqlerrm;
  end;

  return new;
end;
$funcao$;

create or replace function public.enfileirar_avisos_aula_sem_chamada(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_total integer := 0;
  r record;
begin
  for r in
    select c.id as class_id, ct.teacher_id
      from public.classes c
      join public.class_teachers ct on ct.class_id = c.id
      join public.profiles p on p.id = ct.teacher_id
     where c.type = 'routine'
       and c.attendance_taken_at is null
       and c.date_time < p_agora - interval '1 hour'
       and c.date_time >= p_agora - interval '24 hours'
       and not exists (select 1 from public.groups g where g.id = c.group_id and g.archived_at is not null)
       and p.status = 'active' and p.anonymized_at is null
  loop
    if public.enfileirar_notificacao(r.teacher_id, 'aula_sem_chamada', format('aula_sem_chamada:%s', r.class_id),
         '{}'::jsonb, null, r.class_id, null, p_agora) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$funcao$;

-- As assinaturas não mudaram: os revoke e grant das migrations de origem
-- continuam valendo para as quatro funções acima.
