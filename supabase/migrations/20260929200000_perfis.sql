-- ============================================================================
-- Contrato v4 — Perfis (bloco 4.10; § 12, D31, D32, D58, T32)
--
-- - perfil_do_aluno: a ficha do aluno (is_staff); o financeiro só para o admin;
--   nunca CPF, telefone, nascimento nem preço (D32);
-- - perfil_do_professor e historico_de_aulas_do_professor: só o admin (D31).
--
-- historico_de_aulas_do_aluno veio antes, no 4.9b (G3).
-- ============================================================================

create function public.perfil_do_aluno(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin   boolean := public.is_admin();
  v_aluno   public.profiles%rowtype;
  v_segunda date := public.segunda_de(now());
  v_mes     date := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_modo    public.plan_schedule_mode;
  v_perfil  jsonb;
begin
  if not public.is_staff() then
    raise exception 'Operação negada: só a equipe vê o perfil do aluno.' using errcode = '42501';
  end if;
  select * into v_aluno from public.profiles where id = p_user_id and role = 'user';
  if not found then
    raise exception 'Aluno não encontrado.' using errcode = 'P0002';
  end if;

  v_modo := public.modalidade_da_semana(p_user_id, v_segunda);

  v_perfil := jsonb_build_object(
    'nome', v_aluno.name,
    'turma', (select g.name from public.groups g where g.id = v_aluno.group_id),
    'modalidade', v_modo,
    'cota_ou_meta', case v_modo
      when 'free' then public.cota_da_semana(p_user_id, v_segunda)
      when 'unlimited' then public.meta_vigente(p_user_id, v_segunda)
    end,
    'situacao', case
      when v_aluno.status <> 'active' then 'trancado'
      when v_aluno.is_first_login then 'primeiro_acesso'
      else 'ativo'
    end,
    'na_academia_desde', (v_aluno.created_at at time zone 'America/Sao_Paulo')::date,
    'frequencia_semana', (
      select jsonb_build_object('percentual', f.frequency_percent, 'feitas', f.attended, 'esperadas', f.expected)
        from public.frequencia_semanal(array[p_user_id], v_segunda, v_segunda, now()) f
       limit 1
    ),
    'frequencia_mes', (
      select jsonb_build_object('percentual', f.frequency_percent, 'feitas', f.attended, 'esperadas', f.expected)
        from public.frequencia_do_mes(array[p_user_id], v_mes, now()) f
       limit 1
    ),
    -- Os períodos de troca permanente vigentes agora (T37).
    'trocas_permanentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'de', jsonb_build_object('weekday', hd.weekday, 'start_time', hd.start_time, 'group_name', gd.name),
               'para', jsonb_build_object('weekday', hp.weekday, 'start_time', hp.start_time, 'group_name', gp.name),
               'desde', (sp.started_at at time zone 'America/Sao_Paulo')::date
             ) order by sp.started_at)
        from public.class_swap_periods sp
        join public.class_schedules hd on hd.id = sp.from_schedule_id
        join public.class_schedules hp on hp.id = sp.to_schedule_id
        left join public.groups gd on gd.id = hd.group_id
        left join public.groups gp on gp.id = hp.group_id
       where sp.user_id = p_user_id
         and sp.started_at <= now() and (sp.ended_at is null or now() < sp.ended_at)
    ), '[]'::jsonb),
    -- D58: a turma de cada período que toca o mês corrente (SP).
    'turmas_no_mes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'turma', g.name,
               'desde', (sgp.started_at at time zone 'America/Sao_Paulo')::date,
               'ate', case when sgp.ended_at is not null
                           then ((sgp.ended_at - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date end
             ) order by sgp.started_at)
        from public.student_group_periods sgp
        join public.groups g on g.id = sgp.group_id
       where sgp.user_id = p_user_id
         and sgp.started_at < ((v_mes + interval '1 month')::date)::timestamp at time zone 'America/Sao_Paulo'
         and (sgp.ended_at is null or sgp.ended_at > v_mes::timestamp at time zone 'America/Sao_Paulo')
    ), '[]'::jsonb)
  );

  if not v_admin then
    return v_perfil;
  end if;

  return v_perfil || jsonb_build_object(
    'plano_nome', (
      select pl.name from public.plan_periods pp join public.plans pl on pl.id = pp.plan_id
       where pp.user_id = p_user_id and pp.ended_at is null
       order by pp.started_at desc limit 1
    ),
    'financeiro', (
      select jsonb_build_object(
               'meses_na_academia',
               greatest(1, (extract(year from age(now(), v_aluno.created_at)) * 12
                            + extract(month from age(now(), v_aluno.created_at)))::int + 1),
               'pagas', count(*) filter (where pg.status = 'paid'),
               'pagas_com_atraso', count(*) filter (
                 where pg.status = 'paid' and (pg.paid_at at time zone 'America/Sao_Paulo')::date > pg.due_date),
               'inadimplentes', count(*) filter (where pg.status = 'overdue'),
               'em_aberto', count(*) filter (where pg.status in ('open', 'pending_approval'))
             )
        from public.payments pg
       where pg.user_id = p_user_id
    )
  );
end;
$$;

comment on function public.perfil_do_aluno(uuid) is
  '§ 12: a ficha do aluno para a equipe (D32). O plano e o financeiro só para o admin; nunca CPF, telefone, nascimento nem preço.';

revoke execute on function public.perfil_do_aluno(uuid) from public, anon;
grant execute on function public.perfil_do_aluno(uuid) to authenticated;

-- As aulas do professor num período, com a situação dele em cada uma.
create function public.historico_de_aulas_do_professor(p_teacher_id uuid, p_de date, p_ate date)
returns table (
  class_id uuid, date_time timestamptz, title text, group_name text,
  cancelled boolean, scheduled boolean, present boolean, added_in_roll_call boolean,
  attendance_delay_days int, edited boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o admin vê o perfil do professor.' using errcode = '42501';
  end if;
  return query
    select c.id, c.date_time, c.title, g.name, c.cancelled_at is not null,
           -- "Escalado": na aula por escala ou vinculado antes da chamada (não acrescentado nela).
           not coalesce(tp.added_in_roll_call, false),
           tp.present, coalesce(tp.added_in_roll_call, false),
           nullif((c.attendance_taken_at at time zone 'America/Sao_Paulo')::date
                  - (c.date_time at time zone 'America/Sao_Paulo')::date, 0),
           tp.edited_at is not null
      from public.class_teachers ct
      join public.classes c on c.id = ct.class_id
      left join public.groups g on g.id = c.group_id
      left join public.class_teacher_presence tp on tp.class_id = c.id and tp.teacher_id = ct.teacher_id
     where ct.teacher_id = p_teacher_id
       and c.date_time >= coalesce(p_de, '2000-01-01'::date)::timestamp at time zone 'America/Sao_Paulo'
       and c.date_time < (coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date) + 1)::timestamp
                         at time zone 'America/Sao_Paulo'
     order by c.date_time desc;
end;
$$;

revoke execute on function public.historico_de_aulas_do_professor(uuid, date, date) from public, anon;
grant execute on function public.historico_de_aulas_do_professor(uuid, date, date) to authenticated;

create function public.perfil_do_professor(p_teacher_id uuid, p_mes date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prof public.profiles%rowtype;
  v_mes  date := date_trunc('month', coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date))::date;
  v_de   timestamptz;
  v_ate  timestamptz;
  v      record;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o admin vê o perfil do professor.' using errcode = '42501';
  end if;
  select * into v_prof from public.profiles where id = p_teacher_id and role in ('professor', 'admin');
  if not found then
    raise exception 'Professor não encontrado.' using errcode = 'P0002';
  end if;
  v_de := v_mes::timestamp at time zone 'America/Sao_Paulo';
  v_ate := (v_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  with aulas as (
    select c.id, c.type, c.date_time, c.cancelled_at, c.attendance_taken_at,
           tp.present, coalesce(tp.added_in_roll_call, false) as acrescentado,
           exists (
             select 1 from public.roll_call_requests r
              where r.kind = 'teacher_absence' and r.status = 'approved'
                and r.class_id = c.id and r.subject_id = p_teacher_id
           ) as abonada
      from public.class_teachers ct
      join public.classes c on c.id = ct.class_id
      left join public.class_teacher_presence tp on tp.class_id = c.id and tp.teacher_id = ct.teacher_id
     where ct.teacher_id = p_teacher_id and c.date_time >= v_de and c.date_time < v_ate
  )
  select
    count(*) filter (where a.type = 'routine' and a.cancelled_at is null and not a.acrescentado) as esperadas,
    count(*) filter (where a.present) as dadas,
    count(*) filter (where a.present and a.acrescentado) as dadas_fora_da_escala,
    count(*) filter (where a.cancelled_at is not null and not a.acrescentado) as canceladas,
    count(*) filter (where a.cancelled_at is null and not a.acrescentado and a.present = false and not a.abonada) as faltas,
    count(*) filter (where a.abonada) as abonadas,
    count(*) filter (where a.type = 'routine' and a.cancelled_at is null and a.date_time < now()
                       and a.attendance_taken_at is null) as pendentes
    into v
    from aulas a;

  return jsonb_build_object(
    'nome', v_prof.name,
    'cor', v_prof.color,
    'esperadas', v.esperadas,
    'dadas', v.dadas,
    'dadas_fora_da_escala', v.dadas_fora_da_escala,
    'canceladas', v.canceladas,
    'faltas', v.faltas,
    'abonadas', v.abonadas,
    'pendentes', v.pendentes,
    -- T32: dadas ÷ (esperadas − abonadas), sem teto; nulo sem esperado.
    'percentual', case when v.esperadas - v.abonadas > 0
                       then round(v.dadas * 100.0 / (v.esperadas - v.abonadas), 2) end
  );
end;
$$;

comment on function public.perfil_do_professor(uuid, date) is
  '§ 12, D31, T32: o mês do professor, só para o admin.';

revoke execute on function public.perfil_do_professor(uuid, date) from public, anon;
grant execute on function public.perfil_do_professor(uuid, date) to authenticated;
