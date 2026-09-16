-- ============================================================================
-- Renomear, arquivar e excluir turma sem estragar a agenda nem a frequência — T6
--
-- Até aqui apagar uma turma usava ON DELETE SET NULL: as aulas de rotina dela
-- viravam "eventos globais" (visíveis a todos os alunos, e a chamada listava
-- TODOS), os alunos ficavam sem turma com 100% de frequência e as aulas
-- continuavam no aviso de aula sem chamada.
--
-- Agora:
--   · as referências a turma são RESTRICT — ninguém apaga turma usada por acidente;
--   · aula de rotina exige turma (só evento pode ser global);
--   · turma com histórico é ARQUIVADA (some dos seletores, histórico intacto);
--   · turma arquivada não recebe aluno nem aula, e a chamada das aulas dela fica
--     congelada (a lista sai da turma atual dos alunos: salvar de novo apagaria
--     a chamada antiga);
--   · arquivar, reativar e excluir passam só por função (migration grade_semanal).
-- ============================================================================

alter table public.groups add column archived_at timestamptz;

comment on column public.groups.archived_at is
  'Turma encerrada com histórico: some dos seletores, não recebe aluno nem aula e congela a chamada das aulas dela. Nulo = ativa.';

-- ----------------------------------------------------------------------------
-- 1. Referências a turma: RESTRICT
-- ----------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_group_id_fkey;
alter table public.profiles
  add constraint profiles_group_id_fkey foreign key (group_id) references public.groups (id) on delete restrict;

alter table public.classes drop constraint classes_group_id_fkey;
alter table public.classes
  add constraint classes_group_id_fkey foreign key (group_id) references public.groups (id) on delete restrict;

alter table public.attendance_monthly drop constraint attendance_monthly_group_id_fkey;
alter table public.attendance_monthly
  add constraint attendance_monthly_group_id_fkey foreign key (group_id) references public.groups (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- 2. Aula de rotina exige turma
--
--    Para de propósito se já houver rotina sem turma: a check nova faria o
--    salvar_chamada dessas aulas falhar. Decida o destino delas antes.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.classes where type = 'routine' and group_id is null) then
    raise exception 'Há aulas de rotina sem turma. Atribua uma turma ou converta em evento antes desta migration: select id, title, date_time from public.classes where type = ''routine'' and group_id is null;';
  end if;
end $$;

alter table public.classes
  add constraint classes_rotina_exige_turma check (type <> 'routine' or group_id is not null);

-- ----------------------------------------------------------------------------
-- 3. Turma arquivada não recebe aluno nem aula
-- ----------------------------------------------------------------------------
create or replace function public.enforce_turma_ativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if new.group_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.group_id is not distinct from old.group_id then
    return new;
  end if;
  if exists (select 1 from public.groups g where g.id = new.group_id and g.archived_at is not null) then
    raise exception 'A turma está arquivada. Reative a turma antes de usá-la.' using errcode = '23514';
  end if;
  return new;
end;
$funcao$;

revoke execute on function public.enforce_turma_ativa() from public, anon, authenticated;

create trigger trg_profiles_turma_ativa
  before insert or update of group_id on public.profiles
  for each row execute function public.enforce_turma_ativa();

create trigger trg_classes_turma_ativa
  before insert or update of group_id on public.classes
  for each row execute function public.enforce_turma_ativa();

-- ----------------------------------------------------------------------------
-- 4. Pelo app, a turma só é renomeada; o resto é por função
-- ----------------------------------------------------------------------------
revoke update, delete on public.groups from anon, authenticated;
grant update (name) on public.groups to authenticated;
drop policy if exists "groups_delete_admin" on public.groups;

-- ----------------------------------------------------------------------------
-- 5. Aviso de aula sem chamada ignora turma arquivada (a chamada está congelada)
-- ----------------------------------------------------------------------------
create or replace function public.aulas_sem_chamada(p_referencia timestamp with time zone default now())
returns table(class_id uuid, title text, date_time timestamp with time zone, group_id text)
language sql
stable security definer
set search_path to ''
as $function$
  select c.id, c.title, c.date_time, c.group_id
    from public.classes c
   where c.type = 'routine'
     and c.attendance_taken_at is null
     and c.date_time < p_referencia - interval '1 hour'
     and c.date_time >= date_trunc('month', p_referencia at time zone 'America/Sao_Paulo')
                         at time zone 'America/Sao_Paulo'
     and not exists (
       select 1 from public.groups g where g.id = c.group_id and g.archived_at is not null
     )
     and (
       public.is_admin()
       or exists (
         select 1 from public.class_teachers ct
          where ct.class_id = c.id and ct.teacher_id = (select auth.uid())
       )
     )
   order by c.date_time;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Chamada congelada em turma arquivada
--    Corpos copiados das versões vigentes (pg_get_functiondef), com a recusa
--    logo depois de travar a aula.
-- ----------------------------------------------------------------------------
create or replace function public.salvar_chamada(p_class_id uuid, p_presentes uuid[], p_ausentes uuid[])
returns timestamp with time zone
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid       uuid := (select auth.uid());
  v_presentes uuid[] := coalesce(p_presentes, '{}');
  v_ausentes  uuid[] := coalesce(p_ausentes, '{}');
  v_inicio    timestamptz;
  v_concluida timestamptz;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = p_class_id and ct.teacher_id = v_uid
    )
  ) then
    raise exception 'Operação negada: só o professor da aula ou o admin faz a chamada.'
      using errcode = '42501';
  end if;

  select date_time, attendance_taken_at into v_inicio, v_concluida
    from public.classes where id = p_class_id
     for update;

  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.classes c join public.groups g on g.id = c.group_id
     where c.id = p_class_id and g.archived_at is not null
  ) then
    raise exception 'A turma desta aula está arquivada: a chamada fica congelada.'
      using errcode = '23514';
  end if;

  if v_inicio > now() then
    raise exception 'A chamada só pode ser feita depois que a aula começa.'
      using errcode = '23514';
  end if;

  if v_presentes && v_ausentes then
    raise exception 'Um aluno não pode estar presente e ausente na mesma chamada.'
      using errcode = '22023';
  end if;

  -- A função é SECURITY DEFINER: sem esta checagem, qualquer uuid viraria
  -- linha de presença, inclusive de professor e admin.
  if exists (
    select 1
      from unnest(v_presentes || v_ausentes) as marcado(id)
     where not exists (
       select 1 from public.profiles p where p.id = marcado.id and p.role = 'user'
     )
  ) then
    raise exception 'A chamada só aceita alunos.' using errcode = '22023';
  end if;

  -- DISTINCT: o mesmo aluno duas vezes no array faria o ON CONFLICT atualizar
  -- a mesma linha duas vezes, e o Postgres recusa o comando inteiro.
  insert into public.attendance (class_id, user_id, status)
  select p_class_id, marcado.id, 'present'::public.attendance_status
    from (select distinct unnest(v_presentes) as id) as marcado
  union all
  select p_class_id, marcado.id, 'absent'::public.attendance_status
    from (select distinct unnest(v_ausentes) as id) as marcado
  on conflict (class_id, user_id) do update
     set status = excluded.status;

  -- Quem ficou fora das duas listas volta a "sem chamada". Só a chamada é
  -- zerada: a declaração do aluno não é de quem faz a chamada.
  update public.attendance a
     set status = null
   where a.class_id = p_class_id
     and a.status is not null
     and a.user_id <> all (v_presentes || v_ausentes);

  -- Salvar de novo corrige a chamada, mas não reescreve quando ela foi concluída.
  if v_concluida is null then
    update public.classes set attendance_taken_at = now() where id = p_class_id;
    v_concluida := now();
  end if;

  return v_concluida;
end;
$function$;

create or replace function public.concluir_chamada(p_class_id uuid)
returns timestamp with time zone
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid      uuid := (select auth.uid());
  v_inicio   timestamptz;
  v_concluida timestamptz;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = p_class_id and ct.teacher_id = v_uid
    )
  ) then
    raise exception 'Operação negada: só o professor da aula ou o admin conclui a chamada.'
      using errcode = '42501';
  end if;

  select date_time, attendance_taken_at into v_inicio, v_concluida
    from public.classes where id = p_class_id
     for update;

  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.classes c join public.groups g on g.id = c.group_id
     where c.id = p_class_id and g.archived_at is not null
  ) then
    raise exception 'A turma desta aula está arquivada: a chamada fica congelada.'
      using errcode = '23514';
  end if;

  if v_inicio > now() then
    raise exception 'A chamada só pode ser concluída depois que a aula começa.'
      using errcode = '23514';
  end if;

  -- Idempotente: concluir de novo não reescreve o momento original.
  if v_concluida is not null then
    return v_concluida;
  end if;

  update public.classes set attendance_taken_at = now() where id = p_class_id;
  return now();
end;
$function$;
