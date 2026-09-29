-- ============================================================================
-- Contrato v4 — a chamada nova (bloco 4.6b; § 7, § 10, § 15, D17–D21, D27,
-- D28, D48, D51, D56, D58, T11, T13, T35, T38, T47)
--
-- Quem está na chamada sai de UMA função (`origens_da_chamada`): a lista, a
-- `salvar_chamada_v2` e a trava do APK 1.8 (T47) leem a mesma resposta. As
-- regras da T35 que valem "venha de qualquer RPC" ficam num gatilho em
-- attendance, para a chamada nova, a antiga e o "Eu estava na aula" (4.9a)
-- seguirem a mesma regra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quem está na chamada (§ 7.2) — interna
-- ----------------------------------------------------------------------------
create function public.origens_da_chamada(p_class_id uuid)
returns table (
  user_id              uuid,
  origem               text,
  swap_id              uuid,
  swap_kind            public.class_swap_kind,
  swap_status          public.class_swap_status,
  swap_role            text,
  swap_other_date_time timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with aula as (
    select c.id, c.type, c.date_time, c.group_id, c.schedule_id,
           date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date as segunda
      from public.classes c
     where c.id = p_class_id
  ),
  -- Candidatos à grade efetiva: a turma da DATA da aula (D58), a permanente
  -- para o horário dela e a avulsa aprovada para ela. A decisão é da T33.
  candidatos as (
    select g.user_id
      from aula a
      join public.student_group_periods g
        on g.group_id = a.group_id
       and g.started_at <= a.date_time
       and (g.ended_at is null or a.date_time < g.ended_at)
    union
    select sp.user_id from aula a join public.class_swap_periods sp on sp.to_schedule_id = a.schedule_id
    union
    select s.user_id from public.class_swaps s
     where s.to_class_id = p_class_id and s.kind = 'once' and s.status = 'approved'
  ),
  grade as (
    select g.user_id, g.fonte as origem, 1 as prioridade
      from aula a
      cross join lateral public.grade_efetiva_do_fixo(
        array(select c.user_id from candidatos c), a.date_time, a.date_time + interval '1 microsecond'
      ) g
     where a.type = 'routine' and g.class_id = p_class_id
  ),
  linhas as (
    select at.user_id, at.declared_status, at.status, at.included
      from public.attendance at
     where at.class_id = p_class_id
  ),
  todas as (
    select * from grade
    union all
    select s.user_id, 'troca_pendente', 2
      from aula a join public.class_swaps s on s.to_class_id = a.id
     where a.type = 'routine' and s.kind = 'once' and s.status = 'pending'
    union all
    select s.user_id, 'trocou', 3
      from aula a join public.class_swaps s on s.from_class_id = a.id
     where a.type = 'routine' and s.kind = 'once' and s.status = 'approved'
    union all
    -- O fixo que marcou "Vou (extra)", em aula de qualquer público (D51, D56).
    select l.user_id, 'extra', 4
      from aula a join linhas l on true
     where a.type = 'routine' and l.declared_status = 'present'
       and public.modalidade_da_semana(l.user_id, a.segunda) = 'fixed'
    union all
    -- Livre e à vontade que marcaram; no evento, qualquer modalidade (T40).
    select l.user_id, 'marcou', 5
      from aula a join linhas l on true
     where l.declared_status = 'present'
       and (a.type = 'event' or public.modalidade_da_semana(l.user_id, a.segunda) <> 'fixed')
    union all
    select l.user_id, 'incluido', 6
      from linhas l
     where l.included or l.status is not null
  ),
  uma as (
    select distinct on (t.user_id) t.user_id, t.origem
      from todas t
      join public.profiles p on p.id = t.user_id and p.role = 'user'
     order by t.user_id, t.prioridade
  )
  select u.user_id,
         u.origem,
         s.id,
         s.kind,
         s.status,
         case when s.id is null then null when s.to_class_id = p_class_id then 'destino' else 'origem' end,
         (select c.date_time from public.classes c
           where c.id = case when s.to_class_id = p_class_id then s.from_class_id else s.to_class_id end)
    from uma u
    -- Os swap_* só com troca avulsa pendente ou aprovada (§ 7.2): a que chega
    -- (troca, troca pendente) ou a que sai (trocou, pendente saindo da turma).
    left join lateral (
      select sw.*
        from public.class_swaps sw
       where sw.user_id = u.user_id
         and sw.kind = 'once'
         and sw.status in ('pending', 'approved')
         and (sw.to_class_id = p_class_id or sw.from_class_id = p_class_id)
       order by (sw.to_class_id = p_class_id) desc, sw.created_at desc
       limit 1
    ) s on true;
$$;

comment on function public.origens_da_chamada(uuid) is
  'Quem está na chamada da aula e por quê (§ 7.2): turma, permanente, troca, troca_pendente, trocou, extra, marcou, incluido, com a troca avulsa pendente ou aprovada que toca a aula. Interna.';

revoke execute on function public.origens_da_chamada(uuid) from public, anon, authenticated;

-- A trava do APK 1.8 (T47): aula com troca ou extra, ou com um fixo da turma
-- que hoje está em outra turma (mudou depois da aula, D58).
create function public.chamada_exige_app_novo(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.origens_da_chamada(p_class_id) o
      join public.classes c on c.id = p_class_id
      join public.profiles p on p.id = o.user_id
     where o.origem in ('permanente', 'troca', 'troca_pendente', 'extra')
        or (o.origem = 'turma' and p.group_id is distinct from c.group_id)
  );
$$;

revoke execute on function public.chamada_exige_app_novo(uuid) from public, anon, authenticated;

-- Quem faz a chamada da aula: o admin ou a equipe dela (D17).
create function public.faz_a_chamada(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.class_teachers ct
     where ct.class_id = p_class_id and ct.teacher_id = (select auth.uid())
  );
$$;

revoke execute on function public.faz_a_chamada(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Trocas pela chamada (§ 7.2 regra 8, § 10, T35, T38) — internas
-- ----------------------------------------------------------------------------

-- Os avisos da troca aprovada (§ 10): o aluno e a equipe das duas aulas; os
-- admins só na permanente. Quem aprovou fica de fora; quem está nas duas
-- aulas recebe só o da nova. Mesma chave na volta de expirada (T35).
create function public.avisar_troca_aprovada(p_swap_id uuid, p_por uuid, p_pela_chamada boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_troca public.class_swaps%rowtype;
  v_perm  int;
  v_chama int := case when p_pela_chamada then 1 else 0 end;
  r       record;
begin
  select * into v_troca from public.class_swaps where id = p_swap_id;
  if not found then
    return;
  end if;
  v_perm := case when v_troca.kind = 'permanent' then 1 else 0 end;

  perform public.enfileirar_notificacao(
    v_troca.user_id, 'troca_aprovada', 'troca_aprovada:' || p_swap_id::text,
    jsonb_build_object('permanente', v_perm, 'pela_chamada', v_chama),
    p_class_id => v_troca.to_class_id
  );

  for r in
    with equipe as (
      select ct.teacher_id as pessoa, 1 as entrada, v_troca.to_class_id as aula
        from public.class_teachers ct where ct.class_id = v_troca.to_class_id
      union all
      select ct.teacher_id, 0, v_troca.from_class_id
        from public.class_teachers ct where ct.class_id = v_troca.from_class_id
      union all
      select p.id, 1, v_troca.to_class_id
        from public.profiles p
       where v_troca.kind = 'permanent' and p.role = 'admin' and p.status = 'active'
    )
    select distinct on (e.pessoa) e.pessoa, e.entrada, e.aula
      from equipe e
     where e.pessoa is distinct from p_por
     order by e.pessoa, e.entrada desc
  loop
    perform public.enfileirar_notificacao(
      r.pessoa, 'troca_aprovada_equipe', 'troca_aprovada_equipe:' || p_swap_id::text,
      jsonb_build_object('permanente', v_perm, 'entrada', r.entrada, 'pela_chamada', v_chama),
      p_class_id => r.aula
    );
  end loop;
end;
$$;

revoke execute on function public.avisar_troca_aprovada(uuid, uuid, boolean) from public, anon, authenticated;

-- Aprovar pela chamada (D48): a chamada é a palavra do professor; quem a fez
-- é o aprovador, e a revisão fica sem nota.
create function public.aprovar_troca_pela_chamada(p_swap_id uuid, p_por uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.class_swaps
     set status = 'approved', decided_via = 'roll_call', decided_by = p_por, decided_at = now()
   where id = p_swap_id;
  insert into public.class_swap_reviews (swap_id, reviewer_id, review_note, decided_via, decided_at)
  values (p_swap_id, p_por, null, 'roll_call', now())
  on conflict (swap_id) do update
     set reviewer_id = excluded.reviewer_id, review_note = null,
         decided_via = excluded.decided_via, decided_at = excluded.decided_at;
  perform public.avisar_troca_aprovada(p_swap_id, p_por, true);
end;
$$;

revoke execute on function public.aprovar_troca_pela_chamada(uuid, uuid) from public, anon, authenticated;

-- A conferência da T35 (e da T38) para a expirada voltar a aprovada.
create function public.troca_pode_voltar(p_swap_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_swaps s
     where s.id = p_swap_id
       and s.kind = 'once'
       and s.status = 'expired'
       -- a original ainda na grade efetiva dele
       and public.fonte_da_aula_na_grade(s.user_id, s.from_class_id) is not null
       -- sem presença na original
       and not exists (
         select 1 from public.attendance a
          where a.class_id = s.from_class_id and a.user_id = s.user_id and a.status = 'present'
       )
       -- sem outra avulsa pendente ou aprovada com a mesma original ou a mesma aula nova
       and not exists (
         select 1 from public.class_swaps o
          where o.user_id = s.user_id and o.id <> s.id and o.kind = 'once'
            and o.status in ('pending', 'approved')
            and (o.from_class_id = s.from_class_id or o.to_class_id = s.to_class_id)
       )
       -- sem justificativa nem "Eu estava na aula" pendente ou aprovado na original
       and not exists (
         select 1 from public.absence_justifications j
          where j.class_id = s.from_class_id and j.user_id = s.user_id
            and j.status in ('pending', 'approved')
       )
       and not exists (
         select 1 from public.roll_call_requests q
          where q.class_id = s.from_class_id and q.subject_id = s.user_id
            and q.kind = 'student_was_present' and q.status in ('pending', 'approved')
       )
  );
$$;

revoke execute on function public.troca_pode_voltar(uuid) from public, anon, authenticated;

-- A presença mexe nas trocas, venha de qualquer RPC (§ 7.2 regra 8, § 15, T35):
-- presença na original cancela a pendente; presença nova na aula de uma
-- expirada a aprova de novo, se a conferência passar; presença retirada de
-- uma aprovada PELA CHAMADA a devolve a expirada.
create function public.aplicar_trocas_pela_presenca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.attendance_status;
  v_troca record;
begin
  -- No INSERT não há "old": a linha nova vem de "sem registro".
  if tg_op = 'UPDATE' then
    v_antes := old.status;
  end if;

  if new.status = 'present' and v_antes is distinct from 'present' then
    update public.class_swaps s
       set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = now()
     where s.user_id = new.user_id and s.kind = 'once' and s.status = 'pending'
       and s.from_class_id = new.class_id;

    for v_troca in
      select s.id from public.class_swaps s
       where s.user_id = new.user_id and s.kind = 'once' and s.status = 'expired'
         and s.to_class_id = new.class_id
    loop
      if public.troca_pode_voltar(v_troca.id) then
        perform public.aprovar_troca_pela_chamada(v_troca.id, (select auth.uid()));
      end if;
    end loop;
  elsif v_antes = 'present' and new.status is distinct from 'present' then
    update public.class_swaps s
       set status = 'expired', decided_via = 'roll_call', decided_by = null, decided_at = now()
     where s.user_id = new.user_id and s.kind = 'once' and s.status = 'approved'
       and s.decided_via = 'roll_call' and s.to_class_id = new.class_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.aplicar_trocas_pela_presenca() from public, anon, authenticated;

create trigger aplicar_trocas_pela_presenca
  after insert or update of status on public.attendance
  for each row execute function public.aplicar_trocas_pela_presenca();

-- ----------------------------------------------------------------------------
-- 3. Leituras da chamada (§ 7.2)
-- ----------------------------------------------------------------------------
create function public.lista_da_chamada(p_class_id uuid)
returns table (
  user_id              uuid,
  name                 text,
  schedule_mode        public.plan_schedule_mode,
  weekly_target        smallint,
  origem               text,
  declared_status      public.attendance_status,
  status               public.attendance_status,
  edited               boolean,
  previous_status      public.attendance_status,
  edited_by_name       text,
  edited_at            timestamptz,
  taken_by_name        text,
  justification_id     uuid,
  justification_status public.justification_status,
  week_attended        int,
  week_expected        int,
  swap_id              uuid,
  swap_kind            public.class_swap_kind,
  swap_status          public.class_swap_status,
  swap_role            text,
  swap_other_date_time timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_segunda date;
  v_admin   boolean := public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Operação negada: a chamada é da equipe.' using errcode = '42501';
  end if;
  select date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date into v_segunda
    from public.classes c where c.id = p_class_id;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  return query
    with o as (
      select o.*, public.modalidade_da_semana(o.user_id, v_segunda) as modo
        from public.origens_da_chamada(p_class_id) o
    ), semanas as (
      -- Livre e à vontade: a semana deles (§ 7.2, de frequencia_semanal).
      select f.user_id, f.attended_week, f.expected_week
        from public.frequencia_por_semana(
               array(select o.user_id from o where o.modo <> 'fixed'), v_segunda, v_segunda, now()
             ) f
    )
    select o.user_id,
           p.name,
           o.modo,
           case o.modo
             when 'free' then public.cota_da_semana(o.user_id, v_segunda)
             when 'unlimited' then public.meta_vigente(o.user_id, v_segunda)
           end,
           o.origem,
           a.declared_status,
           a.status,
           coalesce(a.edited, false),
           case when v_admin then au.previous_status end,
           case when v_admin then pe.name end,
           case when v_admin then au.edited_at end,
           case when v_admin then pt.name end,
           j.id,
           j.status,
           (select s.attended_week from semanas s where s.user_id = o.user_id limit 1),
           (select s.expected_week from semanas s where s.user_id = o.user_id limit 1),
           o.swap_id,
           o.swap_kind,
           o.swap_status,
           o.swap_role,
           o.swap_other_date_time
      from o
      join public.profiles p on p.id = o.user_id
      left join public.attendance a on a.class_id = p_class_id and a.user_id = o.user_id
      left join public.attendance_audit au on au.attendance_id = a.id
      left join public.profiles pe on pe.id = au.edited_by
      left join public.profiles pt on pt.id = au.taken_by
      left join lateral (
        select jj.id, jj.status from public.absence_justifications jj
         where jj.class_id = p_class_id and jj.user_id = o.user_id
         order by jj.created_at desc limit 1
      ) j on true
     order by p.name nulls last, o.user_id;
end;
$$;

comment on function public.lista_da_chamada(uuid) is
  '§ 7.2: a chamada da aula com as origens da v3, a turma da data da aula (D58) e as trocas. Os detalhes da edição só para o admin (D20). is_staff().';

revoke execute on function public.lista_da_chamada(uuid) from public, anon;
grant execute on function public.lista_da_chamada(uuid) to authenticated;

create function public.professores_da_chamada(p_class_id uuid)
returns table (
  teacher_id         uuid,
  name               text,
  color              text,
  scheduled          boolean,
  present            boolean,
  added_in_roll_call boolean,
  edited             boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só a equipe da aula e o admin veem os professores da chamada.' using errcode = '42501';
  end if;
  return query
    select ct.teacher_id,
           p.name,
           p.color,
           not coalesce(tp.added_in_roll_call, false),
           tp.present,
           coalesce(tp.added_in_roll_call, false),
           tp.edited_at is not null
      from public.class_teachers ct
      join public.profiles p on p.id = ct.teacher_id
      left join public.class_teacher_presence tp on tp.class_id = ct.class_id and tp.teacher_id = ct.teacher_id
     where ct.class_id = p_class_id
     order by p.name;
end;
$$;

revoke execute on function public.professores_da_chamada(uuid) from public, anon;
grant execute on function public.professores_da_chamada(uuid) to authenticated;

-- Busca de 2 a 60 caracteres; % e _ são texto (§ 7.2).
create function public.padrao_de_busca(p_busca text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_busca, ''));
begin
  if char_length(v) not between 2 and 60 then
    raise exception 'Digite de 2 a 60 letras para buscar.' using errcode = '22023';
  end if;
  return '%' || replace(replace(replace(v, '\', '\\'), '%', '\%'), '_', '\_') || '%';
end;
$$;

revoke execute on function public.padrao_de_busca(text) from public, anon, authenticated;

create function public.buscar_alunos_para_incluir(p_class_id uuid, p_busca text)
returns table (user_id uuid, name text, schedule_mode public.plan_schedule_mode, group_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_padrao  text;
  v_segunda date;
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só a equipe da aula e o admin incluem alunos.' using errcode = '42501';
  end if;
  v_padrao := public.padrao_de_busca(p_busca);
  select date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date into v_segunda
    from public.classes c where c.id = p_class_id;

  return query
    select p.id, p.name, public.modalidade_da_semana(p.id, v_segunda), g.name
      from public.profiles p
      left join public.groups g on g.id = p.group_id
     where p.role = 'user'
       and p.status = 'active'
       and p.anonymized_at is null
       and p.name ilike v_padrao escape '\'
       and not exists (select 1 from public.origens_da_chamada(p_class_id) o where o.user_id = p.id)
     order by p.name
     limit 20;
end;
$$;

revoke execute on function public.buscar_alunos_para_incluir(uuid, text) from public, anon;
grant execute on function public.buscar_alunos_para_incluir(uuid, text) to authenticated;

create function public.buscar_equipe_para_incluir(p_class_id uuid, p_busca text)
returns table (teacher_id uuid, name text, color text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_padrao text;
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só a equipe da aula e o admin acrescentam professores.' using errcode = '42501';
  end if;
  v_padrao := public.padrao_de_busca(p_busca);
  return query
    select p.id, p.name, p.color
      from public.profiles p
     where p.role in ('professor', 'admin')
       and p.status = 'active'
       and p.anonymized_at is null
       and p.color is not null
       and p.name ilike v_padrao escape '\'
       and not exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = p.id)
     order by p.name
     limit 20;
end;
$$;

revoke execute on function public.buscar_equipe_para_incluir(uuid, text) from public, anon;
grant execute on function public.buscar_equipe_para_incluir(uuid, text) to authenticated;

-- T13: rotinas passadas (1 h de tolerância), sem chamada e não canceladas, de
-- qualquer mês. O professor vê as suas; o admin, com p_somente_minhas = false,
-- vê todas.
create function public.chamadas_pendentes(p_somente_minhas boolean default true)
returns table (
  class_id       uuid,
  title          text,
  date_time      timestamptz,
  group_id       text,
  group_name     text,
  audience       public.class_audience,
  dias_em_aberto int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid   uuid := (select auth.uid());
  v_todas boolean := not coalesce(p_somente_minhas, true) and public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Operação negada: chamadas pendentes são da equipe.' using errcode = '42501';
  end if;
  return query
    select c.id, c.title, c.date_time, c.group_id, g.name, c.audience,
           ((now() at time zone 'America/Sao_Paulo')::date - (c.date_time at time zone 'America/Sao_Paulo')::date)::int
      from public.classes c
      left join public.groups g on g.id = c.group_id
     where c.type = 'routine'
       and c.attendance_taken_at is null
       and c.cancelled_at is null
       and c.date_time < now() - interval '1 hour'
       and (g.id is null or g.archived_at is null)
       and (v_todas or exists (
         select 1 from public.class_teachers ct where ct.class_id = c.id and ct.teacher_id = v_uid
       ))
     order by c.date_time;
end;
$$;

revoke execute on function public.chamadas_pendentes(boolean) from public, anon;
grant execute on function public.chamadas_pendentes(boolean) to authenticated;

-- § 15: mesmo retorno; a aula cancelada sai.
create or replace function public.aulas_sem_chamada(p_referencia timestamptz default now())
returns table (class_id uuid, title text, date_time timestamptz, group_id text)
language sql
stable
security definer
set search_path = ''
as $function$
  select c.id, c.title, c.date_time, c.group_id
    from public.classes c
   where c.type = 'routine'
     and c.attendance_taken_at is null
     and c.cancelled_at is null
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
-- 4. Salvar a chamada (§ 7.2, regras 1 a 8)
-- ----------------------------------------------------------------------------

-- As travas comuns às três RPCs de chamada: quem, aula existente, não
-- cancelada, turma ativa e aula já começada. Devolve a aula travada.
create function public.travar_aula_para_chamada(p_class_id uuid)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula public.classes%rowtype;
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só o professor da aula ou o admin faz a chamada.' using errcode = '42501';
  end if;
  select * into v_aula from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;
  if v_aula.cancelled_at is not null then
    raise exception 'Aula cancelada não tem chamada.' using errcode = '23514';
  end if;
  if exists (select 1 from public.groups g where g.id = v_aula.group_id and g.archived_at is not null) then
    raise exception 'A turma desta aula está arquivada: a chamada fica congelada.' using errcode = '23514';
  end if;
  if v_aula.date_time > now() then
    raise exception 'A chamada só pode ser feita depois que a aula começa.' using errcode = '23514';
  end if;
  return v_aula;
end;
$$;

revoke execute on function public.travar_aula_para_chamada(uuid) from public, anon, authenticated;

create function public.salvar_chamada_v2(
  p_class_id              uuid,
  p_presentes             uuid[],
  p_ausentes              uuid[],
  p_professores_presentes uuid[],
  p_professores_ausentes  uuid[],
  p_remover_incluidos     uuid[] default '{}',
  p_motivo_id             uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_admin       boolean := public.is_admin();
  v_aula        public.classes%rowtype;
  v_presentes   uuid[] := array(select distinct x from unnest(coalesce(p_presentes, '{}')) x);
  v_ausentes    uuid[] := array(select distinct x from unnest(coalesce(p_ausentes, '{}')) x);
  v_remover     uuid[] := array(select distinct x from unnest(coalesce(p_remover_incluidos, '{}')) x);
  v_prof_sim    uuid[] := array(select distinct x from unnest(coalesce(p_professores_presentes, '{}')) x);
  v_prof_nao    uuid[] := array(select distinct x from unnest(coalesce(p_professores_ausentes, '{}')) x);
  v_primeira    boolean;
  v_origens     jsonb;
  v_origem      text;
  v_quero       public.attendance_status;
  v_linha       record;
  v_troca       record;
  v_mudancas    int := 0;
  v_mudou_prof  boolean := false;
  v_alterados   uuid[] := '{}';
  v_novos       uuid[];
  v_id          uuid;
  v_ms          text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
begin
  v_aula := public.travar_aula_para_chamada(p_class_id);

  -- D28: o professor sem presença nesta aula pede a correção ao admin.
  if not v_admin and exists (
    select 1 from public.class_teacher_presence tp
     where tp.class_id = p_class_id and tp.teacher_id = v_uid and not tp.present
  ) then
    raise exception 'Operação negada: você está sem presença nesta aula. Peça a correção em Solicitações.'
      using errcode = '42501';
  end if;

  if v_presentes && v_ausentes or v_presentes && v_remover or v_ausentes && v_remover then
    raise exception 'Um aluno não pode estar em duas listas.' using errcode = '22023';
  end if;
  if v_prof_sim && v_prof_nao then
    raise exception 'Um professor não pode estar presente e ausente.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_presentes || v_ausentes || v_remover) m(id)
     where not exists (select 1 from public.profiles p where p.id = m.id and p.role = 'user')
  ) then
    raise exception 'A chamada só aceita alunos.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_prof_sim || v_prof_nao) m(id)
     where not exists (
       select 1 from public.profiles p
        where p.id = m.id and p.role in ('professor', 'admin') and p.color is not null
     )
  ) then
    raise exception 'Só professor com cor entra na chamada.' using errcode = '22023';
  end if;

  -- Regra 2: lista completa.
  if exists (
       select 1 from public.attendance a
        where a.class_id = p_class_id and (a.status is not null or a.included)
          and a.user_id <> all (v_presentes || v_ausentes || v_remover)
     )
     or exists (
       select 1 from public.class_teachers ct
        where ct.class_id = p_class_id and ct.teacher_id <> all (v_prof_sim || v_prof_nao)
     ) then
    raise exception 'Lista incompleta.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_remover) m(id)
     where not exists (
       select 1 from public.attendance a where a.class_id = p_class_id and a.user_id = m.id and a.included
     )
  ) then
    raise exception 'Só aluno incluído pode sair da chamada.' using errcode = '22023';
  end if;

  v_primeira := v_aula.attendance_taken_at is null
                and not exists (select 1 from public.attendance a where a.class_id = p_class_id and a.status is not null);
  select coalesce(jsonb_object_agg(o.user_id::text, o.origem), '{}') into v_origens
    from public.origens_da_chamada(p_class_id) o;

  -- O que muda (regras 3, 5, 7 e 8).
  for v_linha in
    select t.user_id, t.quero, t.remover, a.status as atual, coalesce(a.included, false) as incluido,
           a.id as attendance_id
      from (select m.id as user_id, 'present'::public.attendance_status as quero, false as remover
               from unnest(v_presentes) m(id)
             union all
             -- 'trocou' ausente não grava nada; 'troca_pendente' ausente só expira a troca.
             select m.id, 'absent', false
               from unnest(v_ausentes) m(id)
              where coalesce(v_origens ->> m.id::text, '') not in ('trocou', 'troca_pendente')
             union all
             select m.id, null, true from unnest(v_remover) m(id)) t
      left join public.attendance a on a.class_id = p_class_id and a.user_id = t.user_id
  loop
    if v_linha.remover
       or v_linha.atual is distinct from v_linha.quero
       or (v_linha.quero is not null and not v_linha.incluido and not (v_origens ? v_linha.user_id::text)) then
      v_mudancas := v_mudancas + 1;
      v_alterados := v_alterados || v_linha.user_id;
    end if;
  end loop;

  -- Professores: presença diferente ou professor novo.
  if exists (
       select 1 from unnest(v_prof_sim) m(id)
        left join public.class_teacher_presence tp on tp.class_id = p_class_id and tp.teacher_id = m.id
        where tp.present is distinct from true
     )
     or exists (
       select 1 from unnest(v_prof_nao) m(id)
        left join public.class_teacher_presence tp on tp.class_id = p_class_id and tp.teacher_id = m.id
        where tp.present is distinct from false
     ) then
    v_mudou_prof := true;
  end if;

  if not v_primeira then
    -- Regra 6: sem diferença, nada muda e não pede motivo.
    if v_mudancas = 0 and not v_mudou_prof then
      return jsonb_build_object('concluida_em', v_aula.attendance_taken_at, 'retificada', false, 'alteracoes', 0);
    end if;
    -- D28: presença de professor só o admin retifica.
    if v_mudou_prof and not v_admin then
      raise exception 'Presença de professor só o admin corrige: peça em Solicitações.' using errcode = '42501';
    end if;
    -- Regra 5: retificação pede o motivo desta aula, de quem chama, não usado.
    if not exists (
      select 1 from public.action_reasons r
       where r.id = p_motivo_id and r.kind = 'roll_call_edit' and r.class_id = p_class_id
         and r.author_id = v_uid and r.used_at is null
    ) then
      raise exception 'Para retificar, informe o motivo.' using errcode = '22023';
    end if;
  end if;

  perform set_config('snake.chamada_rpc', 'on', true);
  perform set_config('snake.aula_rpc', 'on', true);

  -- Regra 8, primeira conclusão: a chamada resolve a troca pendente PARA esta aula.
  if v_primeira then
    for v_troca in
      select s.id, s.user_id, s.from_class_id from public.class_swaps s
       where s.to_class_id = p_class_id and s.kind = 'once' and s.status = 'pending'
    loop
      if v_troca.user_id = any (v_presentes) then
        if exists (
          select 1 from public.attendance a
           where a.class_id = v_troca.from_class_id and a.user_id = v_troca.user_id and a.status = 'present'
        ) then
          -- Já foi à original: a troca cai e a presença aqui conta a mais.
          update public.class_swaps
             set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = now()
           where id = v_troca.id;
        else
          perform public.aprovar_troca_pela_chamada(v_troca.id, v_uid);
        end if;
      else
        -- Ausente ou sem marcação: expira, e nada é gravado para ele aqui.
        update public.class_swaps
           set status = 'expired', decided_via = 'roll_call', decided_by = null, decided_at = now()
         where id = v_troca.id;
      end if;
    end loop;
  end if;

  -- Alunos.
  for v_linha in
    select t.user_id, t.quero, t.remover, a.id as attendance_id, a.status as atual,
           coalesce(a.included, false) as incluido, a.declared_status
      from (select m.id as user_id, 'present'::public.attendance_status as quero, false as remover
               from unnest(v_presentes) m(id)
             union all
             -- 'trocou' ausente não grava nada; 'troca_pendente' ausente só expira a troca.
             select m.id, 'absent', false
               from unnest(v_ausentes) m(id)
              where coalesce(v_origens ->> m.id::text, '') not in ('trocou', 'troca_pendente')
             union all
             select m.id, null, true from unnest(v_remover) m(id)) t
      left join public.attendance a on a.class_id = p_class_id and a.user_id = t.user_id
  loop
    if v_linha.remover then
      if v_linha.declared_status is null then
        delete from public.attendance where id = v_linha.attendance_id;
      else
        update public.attendance set status = null, included = false, edited = not v_primeira
         where id = v_linha.attendance_id;
      end if;
      continue;
    end if;

    if v_linha.atual is not distinct from v_linha.quero
       and (v_linha.incluido or v_origens ? v_linha.user_id::text) then
      continue;
    end if;

    v_origem := v_origens ->> v_linha.user_id::text;
    insert into public.attendance (class_id, user_id, status, included, edited)
    values (p_class_id, v_linha.user_id, v_linha.quero, v_origem is null, not v_primeira)
    on conflict (class_id, user_id) do update
       set status = excluded.status,
           included = public.attendance.included or excluded.included,
           edited = public.attendance.edited or excluded.edited
    returning id into v_id;

    insert into public.attendance_audit (attendance_id, taken_by, added_by, previous_status, edited_by, edited_at, edit_reason_id)
    values (
      v_id,
      case when v_primeira then v_uid end,
      case when v_origem is null and not v_linha.incluido then v_uid end,
      case when not v_primeira then v_linha.atual end,
      case when not v_primeira then v_uid end,
      case when not v_primeira then now() end,
      case when not v_primeira then p_motivo_id end
    )
    on conflict (attendance_id) do update
       set taken_by = coalesce(public.attendance_audit.taken_by, excluded.taken_by),
           added_by = coalesce(public.attendance_audit.added_by, excluded.added_by),
           previous_status = case when not v_primeira then excluded.previous_status else public.attendance_audit.previous_status end,
           edited_by = coalesce(excluded.edited_by, public.attendance_audit.edited_by),
           edited_at = coalesce(excluded.edited_at, public.attendance_audit.edited_at),
           edit_reason_id = coalesce(excluded.edit_reason_id, public.attendance_audit.edit_reason_id);
  end loop;

  -- Professores (D27): o que faltava em class_teachers entra como acrescentado.
  v_novos := array(
    select m.id from unnest(v_prof_sim || v_prof_nao) m(id)
     where not exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = m.id)
  );
  insert into public.class_teachers (class_id, teacher_id) select p_class_id, x from unnest(v_novos) x;

  insert into public.class_teacher_presence (class_id, teacher_id, present, added_in_roll_call, set_by)
  select p_class_id, m.id, m.presente, m.id = any (v_novos), v_uid
    from (select id, true as presente from unnest(v_prof_sim) id
          union all
          select id, false from unnest(v_prof_nao) id) m
  on conflict (class_id, teacher_id) do update
     set present = excluded.present,
         added_in_roll_call = public.class_teacher_presence.added_in_roll_call or excluded.added_in_roll_call,
         previous = case when not v_primeira and public.class_teacher_presence.present is distinct from excluded.present
                         then public.class_teacher_presence.present else public.class_teacher_presence.previous end,
         edited_by = case when not v_primeira and public.class_teacher_presence.present is distinct from excluded.present
                          then v_uid else public.class_teacher_presence.edited_by end,
         edited_at = case when not v_primeira and public.class_teacher_presence.present is distinct from excluded.present
                          then now() else public.class_teacher_presence.edited_at end,
         edit_reason_id = case when not v_primeira and public.class_teacher_presence.present is distinct from excluded.present
                               then p_motivo_id else public.class_teacher_presence.edit_reason_id end;

  if v_primeira then
    update public.classes set attendance_taken_at = now() where id = p_class_id;
    insert into public.class_audit (class_id, attendance_taken_by) values (p_class_id, v_uid)
    on conflict (class_id) do update set attendance_taken_by = excluded.attendance_taken_by;
  else
    update public.classes set attendance_edited = true where id = p_class_id;
    insert into public.class_audit (class_id, attendance_edited_by, attendance_edited_at) values (p_class_id, v_uid, now())
    on conflict (class_id) do update
       set attendance_edited_by = excluded.attendance_edited_by, attendance_edited_at = excluded.attendance_edited_at;
    update public.action_reasons set used_at = now() where id = p_motivo_id;
    -- D21: o aluno afetado é avisado.
    perform public.enfileirar_notificacao(
      x.id, 'chamada_retificada',
      'chamada_retificada:' || p_class_id::text || ':' || x.id::text || ':' || v_ms,
      '{}'::jsonb, p_class_id => p_class_id
    )
      from unnest(v_alterados) x(id);
  end if;

  perform set_config('snake.chamada_rpc', 'off', true);
  perform set_config('snake.aula_rpc', 'off', true);

  return jsonb_build_object(
    'concluida_em', (select c.attendance_taken_at from public.classes c where c.id = p_class_id),
    'retificada', not v_primeira,
    'alteracoes', v_mudancas + case when v_mudou_prof then 1 else 0 end
  );
end;
$$;

comment on function public.salvar_chamada_v2(uuid, uuid[], uuid[], uuid[], uuid[], uuid[], uuid) is
  '§ 7.2: salva e conclui a chamada; depois da conclusão, toda diferença é retificação com motivo (D17). Resolve as trocas pela chamada (D48, T35).';

revoke execute on function public.salvar_chamada_v2(uuid, uuid[], uuid[], uuid[], uuid[], uuid[], uuid) from public, anon;
grant execute on function public.salvar_chamada_v2(uuid, uuid[], uuid[], uuid[], uuid[], uuid[], uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Compatibilidade com o APK ≤ 1.8 (§ 15, T47)
-- ----------------------------------------------------------------------------
create or replace function public.salvar_chamada(p_class_id uuid, p_presentes uuid[], p_ausentes uuid[])
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_presentes uuid[] := array(select distinct x from unnest(coalesce(p_presentes, '{}')) x);
  v_ausentes  uuid[] := array(select distinct x from unnest(coalesce(p_ausentes, '{}')) x);
  v_aula      public.classes%rowtype;
  v_origens   jsonb;
  v_id        uuid;
  v_marcado   record;
begin
  v_aula := public.travar_aula_para_chamada(p_class_id);

  if v_presentes && v_ausentes then
    raise exception 'Um aluno não pode estar presente e ausente na mesma chamada.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_presentes || v_ausentes) as marcado(id)
     where not exists (select 1 from public.profiles p where p.id = marcado.id and p.role = 'user')
  ) then
    raise exception 'A chamada só aceita alunos.' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(o.user_id::text, o.origem), '{}') into v_origens
    from public.origens_da_chamada(p_class_id) o;

  -- Já concluída: sem diferença, devolve; com diferença, é retificação, que
  -- só o app novo faz.
  if v_aula.attendance_taken_at is not null then
    if exists (
         select 1 from unnest(v_presentes) m(id)
          where not exists (select 1 from public.attendance a
                             where a.class_id = p_class_id and a.user_id = m.id and a.status = 'present')
       )
       or exists (
         select 1 from unnest(v_ausentes) m(id)
          where v_origens ->> m.id::text in ('turma', 'permanente', 'troca')
            and not exists (select 1 from public.attendance a
                             where a.class_id = p_class_id and a.user_id = m.id and a.status = 'absent')
       )
       or exists (
         select 1 from public.attendance a
          where a.class_id = p_class_id and a.status is not null
            and a.user_id <> all (v_presentes || v_ausentes)
       ) then
      raise exception 'Atualize o aplicativo para corrigir uma chamada já feita.' using errcode = '22023';
    end if;
    return v_aula.attendance_taken_at;
  end if;

  if v_aula.audience = 'free' or public.chamada_exige_app_novo(p_class_id) then
    raise exception 'Atualize o aplicativo para fazer a chamada desta aula.' using errcode = '22023';
  end if;

  perform set_config('snake.chamada_rpc', 'on', true);
  perform set_config('snake.aula_rpc', 'on', true);

  -- Presentes: quem não é esperado vira incluído. Ausentes: só os fixos da
  -- grade (T11); os demais ids são ignorados.
  for v_marcado in
    select id, 'present'::public.attendance_status as quero from unnest(v_presentes) id
    union all
    select id, 'absent' from unnest(v_ausentes) id
     where v_origens ->> id::text in ('turma', 'permanente', 'troca')
  loop
    insert into public.attendance (class_id, user_id, status, included)
    values (p_class_id, v_marcado.id, v_marcado.quero, not (v_origens ? v_marcado.id::text))
    on conflict (class_id, user_id) do update
       set status = excluded.status, included = public.attendance.included or excluded.included
    returning id into v_id;
    insert into public.attendance_audit (attendance_id, taken_by, added_by)
    values (v_id, v_uid, case when not (v_origens ? v_marcado.id::text) then v_uid end)
    on conflict (attendance_id) do update set taken_by = coalesce(public.attendance_audit.taken_by, excluded.taken_by);
  end loop;

  -- Como antes: quem ficou fora das duas listas volta a "sem chamada" (a
  -- declaração do aluno fica).
  update public.attendance a
     set status = null
   where a.class_id = p_class_id
     and a.status is not null
     and a.user_id <> all (v_presentes || v_ausentes);

  update public.classes set attendance_taken_at = now() where id = p_class_id;
  insert into public.class_audit (class_id, attendance_taken_by) values (p_class_id, v_uid)
  on conflict (class_id) do update set attendance_taken_by = excluded.attendance_taken_by;
  insert into public.class_teacher_presence (class_id, teacher_id, present, set_by)
  select p_class_id, v_uid, true, v_uid
   where exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = v_uid)
  on conflict (class_id, teacher_id) do nothing;

  perform set_config('snake.chamada_rpc', 'off', true);
  perform set_config('snake.aula_rpc', 'off', true);
  return (select c.attendance_taken_at from public.classes c where c.id = p_class_id);
end;
$$;

create or replace function public.concluir_chamada(p_class_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_aula public.classes%rowtype;
begin
  v_aula := public.travar_aula_para_chamada(p_class_id);

  -- Idempotente: concluir de novo não reescreve o momento original.
  if v_aula.attendance_taken_at is not null then
    return v_aula.attendance_taken_at;
  end if;
  if v_aula.audience = 'free' or public.chamada_exige_app_novo(p_class_id) then
    raise exception 'Atualize o aplicativo para fazer a chamada desta aula.' using errcode = '22023';
  end if;

  perform set_config('snake.chamada_rpc', 'on', true);
  perform set_config('snake.aula_rpc', 'on', true);
  update public.classes set attendance_taken_at = now() where id = p_class_id;
  insert into public.class_audit (class_id, attendance_taken_by) values (p_class_id, v_uid)
  on conflict (class_id) do update set attendance_taken_by = excluded.attendance_taken_by;
  insert into public.class_teacher_presence (class_id, teacher_id, present, set_by)
  select p_class_id, v_uid, true, v_uid
   where exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = v_uid)
  on conflict (class_id, teacher_id) do nothing;
  perform set_config('snake.chamada_rpc', 'off', true);
  perform set_config('snake.aula_rpc', 'off', true);
  return now();
end;
$$;
