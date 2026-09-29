-- ============================================================================
-- Contrato v4 — a frequência nova (bloco 4.5a; § 11, § 15, T2, T3, T8–T10,
-- T17, T29–T31, T33, T52, D7–D10, D26, D35, D55, D57, D58)
--
-- Uma conta só (`frequencia_por_semana`) calcula cada semana de cada aluno e a
-- parte dela que vai para cada mês. Tudo o mais soma essa conta: a semana, o
-- mês, as semanas do mês, o legado `frequencia_mensal`, o fechamento e o
-- Painel. Se cada um contasse do seu jeito, a tela divergiria do fechamento.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Semana e mês (T2) — internas
-- ----------------------------------------------------------------------------

-- Os dias de aula configurados da semana que começa em p_segunda.
create function public.dias_de_aula_da_semana(p_segunda date)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  -- 0 = domingo; a semana vai de segunda (0 dias) a domingo (6 dias).
  select distinct p_segunda + ((d + 6) % 7)::int
    from unnest(
      coalesce((select s.class_weekdays from public.academy_settings s limit 1), '{1,2,3,4,5,6}'::smallint[])
    ) as d
   order by 1;
$$;

revoke execute on function public.dias_de_aula_da_semana(date) from public, anon, authenticated;

-- O mês de cada semana sai só dos dias de aula dela (T2): iguais = semana de
-- um mês; diferentes = Semana Extra (M1 e M2).
create function public.meses_da_semana(p_segunda date)
returns table (mes_inicial date, mes_final date)
language sql
stable
security definer
set search_path = ''
as $$
  select min(date_trunc('month', d::timestamp))::date, max(date_trunc('month', d::timestamp))::date
    from public.dias_de_aula_da_semana(p_segunda) d;
$$;

revoke execute on function public.meses_da_semana(date) from public, anon, authenticated;

-- `closes_on` (§ 11.6): o domingo da última semana que é de M, inteira ou
-- Semana Extra. Se a semana do último dia de M não tem dia de aula em M, ela
-- é toda do mês seguinte e M termina no domingo anterior.
create function public.fim_do_mes_de_frequencia(p_mes date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select (date_trunc('month', p_mes::timestamp) + interval '1 month - 1 day')::date as ultimo
  ), s as (
    select m.ultimo, date_trunc('week', m.ultimo::timestamp)::date as segunda from m
  )
  select case
           when exists (select 1 from public.dias_de_aula_da_semana(s.segunda) d where d <= s.ultimo)
             then s.segunda + 6
           else s.segunda - 1
         end
    from s;
$$;

revoke execute on function public.fim_do_mes_de_frequencia(date) from public, anon, authenticated;

-- Fim do prazo da justificativa por semana (D13): o instante que ENCERRA o
-- 7º dia depois do último dia de aula da semana (00:00 do 8º dia), como o
-- gatilho da justificativa confere.
create function public.fim_do_prazo_da_semana(p_segunda date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((max(d) + 8)::timestamp at time zone 'America/Sao_Paulo')
    from public.dias_de_aula_da_semana(p_segunda) d;
$$;

revoke execute on function public.fim_do_prazo_da_semana(date) from public, anon, authenticated;

-- Quem vê a frequência (§ 11.6): o próprio aluno (só a dele), a equipe e o
-- sistema (§ 0.1, regra 1).
create function public.pode_ver_frequencia(p_user_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon')
      or public.is_staff()
      or ((select auth.uid()) is not null and p_user_ids <@ array[(select auth.uid())]);
$$;

revoke execute on function public.pode_ver_frequencia(uuid[]) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. A conta (§ 11.2 a § 11.4b) — interna, a única
--
-- Uma linha por aluno, semana (seg–dom) e mês que recebe parte da semana: um
-- só numa semana de M; M1 e M2 na Semana Extra. As colunas *_week são a
-- semana inteira e se repetem nas duas linhas da Semana Extra.
-- ----------------------------------------------------------------------------
create function public.frequencia_por_semana(
  p_user_ids         uuid[],
  p_primeira_segunda date,
  p_ultima_segunda   date,
  p_referencia       timestamptz
)
returns table (
  user_id            uuid,
  week_start         date,
  week_end           date,
  reference_month    date,
  is_split           boolean,
  schedule_mode      public.plan_schedule_mode,
  weekly_target      smallint,
  expected_week      int,
  attended_week      int,
  excused_week       int,
  cancelled_week     int,
  expected_in_month  int,
  attended_in_month  int,
  excused_in_month   int,
  cancelled_in_month int,
  expected_to_date   int,
  attended_to_date   int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoje        date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  v_aluno       record;
  v_inicio      timestamptz;
  v_segunda     date;
  v_ini         timestamptz;
  v_fim         timestamptz;
  v_m1          date;
  v_m2          date;
  v_split       boolean;
  v_modo        public.plan_schedule_mode;
  v_alvo        int;
  -- [1] = parte de M1 (ou do único mês), [2] = parte de M2.
  v_esp         int[];
  v_fei         int[];
  v_abo         int[];
  v_can         int[];
  v_esp_ate     int[];
  v_fei_ate     int[];
  v_primeiras   uuid[];
  v_presencas   timestamptz[];
  v_canceladas  int;
  v_oferta      int;
  v_justificadas int;
  v_teto        int;
  v_aplicado    int;
  v_esperado    int;
  v_preenchidas int;
  v_resto       int;
  v_parte       int;
  i             int;
begin
  for v_aluno in
    select p.id, p.created_at
      from public.profiles p
     where p.id = any (p_user_ids)
       and p.role = 'user'
  loop
    -- Início da contagem das presenças do fixo (T52).
    v_inicio := greatest(
      v_aluno.created_at,
      coalesce(
        (select max(g.started_at) from public.student_group_periods g
          where g.user_id = v_aluno.id and g.start_reason = 'backfill'),
        v_aluno.created_at
      )
    );

    v_segunda := p_primeira_segunda;
    while v_segunda <= p_ultima_segunda loop
      v_ini := v_segunda::timestamp at time zone 'America/Sao_Paulo';
      v_fim := (v_segunda + 7)::timestamp at time zone 'America/Sao_Paulo';
      select s.mes_inicial, s.mes_final into v_m1, v_m2 from public.meses_da_semana(v_segunda) s;
      v_split := v_m1 <> v_m2;
      v_modo := public.modalidade_da_semana(v_aluno.id, v_segunda);
      v_esp := array[0, 0]; v_fei := array[0, 0]; v_abo := array[0, 0]; v_can := array[0, 0];
      v_esp_ate := array[0, 0]; v_fei_ate := array[0, 0];

      if v_modo = 'fixed' then
        v_alvo := null;

        -- Esperado (§ 11.2): a grade efetiva da semana (T33). Cancelada fica
        -- fora (abono, D26 e D57); justificada sem presença também.
        with grade as (
          select c.date_time, c.attendance_taken_at,
                 case when v_split and (c.date_time at time zone 'America/Sao_Paulo')::date >= v_m2 then 2 else 1 end as parte,
                 case
                   when c.cancelled_at is not null then 'cancelada'
                   when exists (
                          select 1 from public.absence_justifications j
                           where j.class_id = c.id and j.user_id = v_aluno.id
                             and j.scope = 'class' and j.status = 'approved'
                        )
                    and not exists (
                          select 1 from public.attendance a
                           where a.class_id = c.id and a.user_id = v_aluno.id
                             and a.status = 'present' and c.attendance_taken_at is not null
                        )
                     then 'justificada'
                   else 'esperada'
                 end as tipo
            from public.grade_efetiva_do_fixo(array[v_aluno.id], v_ini, v_fim) g
            join public.classes c on c.id = g.class_id
        )
        select
          array[count(*) filter (where tipo = 'esperada' and parte = 1)::int,
                count(*) filter (where tipo = 'esperada' and parte = 2)::int],
          array[count(*) filter (where tipo = 'justificada' and parte = 1)::int,
                count(*) filter (where tipo = 'justificada' and parte = 2)::int],
          array[count(*) filter (where tipo = 'cancelada' and parte = 1)::int,
                count(*) filter (where tipo = 'cancelada' and parte = 2)::int],
          -- Ritmo (T10): do esperado, o que já aconteceu E teve chamada.
          array[count(*) filter (where tipo = 'esperada' and parte = 1
                                   and date_time <= p_referencia and attendance_taken_at is not null)::int,
                count(*) filter (where tipo = 'esperada' and parte = 2
                                   and date_time <= p_referencia and attendance_taken_at is not null)::int]
          into v_esp, v_abo, v_can, v_esp_ate
          from grade;

        -- Feitas: presença com chamada em qualquer aula que conta, de qualquer
        -- turma e público (a extra também), desde o início da contagem e fora
        -- do trancamento.
        with presencas as (
          select c.date_time,
                 case when v_split and (c.date_time at time zone 'America/Sao_Paulo')::date >= v_m2 then 2 else 1 end as parte
            from public.attendance a
            join public.classes c on c.id = a.class_id
           where a.user_id = v_aluno.id
             and a.status = 'present'
             and c.type = 'routine'
             and c.cancelled_at is null
             and c.attendance_taken_at is not null
             and c.date_time >= v_ini
             and c.date_time < v_fim
             and c.date_time >= v_inicio
             and not exists (
               select 1 from public.inactive_periods ip
                where ip.user_id = v_aluno.id
                  and ip.started_at <= c.date_time
                  and (ip.ended_at is null or c.date_time < ip.ended_at)
             )
        )
        select
          array[count(*) filter (where parte = 1)::int, count(*) filter (where parte = 2)::int],
          array[count(*) filter (where parte = 1 and date_time <= p_referencia)::int,
                count(*) filter (where parte = 2 and date_time <= p_referencia)::int]
          into v_fei, v_fei_ate
          from presencas;

        expected_week := v_esp[1] + v_esp[2];
        attended_week := v_fei[1] + v_fei[2];
        excused_week := v_abo[1] + v_abo[2];
        cancelled_week := v_can[1] + v_can[2];
      else
        -- Livre (§ 11.3) e à vontade (§ 11.4b): cota proporcional ou meta.
        if v_modo = 'free' then
          v_alvo := coalesce(public.cota_da_semana(v_aluno.id, v_segunda), 0);
        else
          v_alvo := coalesce(public.meta_vigente(v_aluno.id, v_segunda), 0);
        end if;

        -- T29: só as primeiras `cota_W` declarações da semana geram abono.
        v_primeiras := array(
          select a.class_id
            from public.attendance a
            join public.classes c on c.id = a.class_id
           where a.user_id = v_aluno.id
             and a.declared_status = 'present'
             and c.type = 'routine'
             and c.date_time >= v_ini
             and c.date_time < v_fim
           order by a.declared_at nulls last, c.date_time, a.class_id
           limit v_alvo
        );

        -- Canceladas que entram em abonos_W (cada aula uma vez só).
        select count(*)::int into v_canceladas
          from public.classes c
         where c.type = 'routine'
           and c.cancelled_at is not null
           and c.date_time >= v_ini
           and c.date_time < v_fim
           and (
             c.id = any (v_primeiras)
             or exists (
               select 1 from public.attendance a
                where a.class_id = c.id and a.user_id = v_aluno.id and a.status = 'present'
             )
           );

        -- Oferta (T30): as que contam e aceitam livres, mais essas canceladas.
        select count(*)::int + v_canceladas into v_oferta
          from public.classes c
         where c.type = 'routine'
           and c.cancelled_at is null
           and c.audience in ('free', 'both')
           and c.date_time >= v_ini
           and c.date_time < v_fim;

        -- Justificativa semanal aprovada: só o livre (D39).
        v_justificadas := 0;
        if v_modo = 'free' then
          select count(*)::int into v_justificadas
            from public.absence_justifications j
           where j.user_id = v_aluno.id
             and j.scope = 'week'
             and j.week_start = v_segunda
             and j.status = 'approved';
        end if;

        v_presencas := array(
          select c.date_time
            from public.attendance a
            join public.classes c on c.id = a.class_id
           where a.user_id = v_aluno.id
             and a.status = 'present'
             and c.type = 'routine'
             and c.cancelled_at is null
             and c.attendance_taken_at is not null
             and c.date_time >= v_ini
             and c.date_time < v_fim
           order by c.date_time
        );

        attended_week := coalesce(array_length(v_presencas, 1), 0);
        v_teto := least(v_alvo, v_oferta);
        -- T17: o abono nunca passa do que faltou para cumprir o teto.
        v_aplicado := least(v_canceladas + v_justificadas, greatest(v_teto - attended_week, 0));
        v_esperado := v_teto - v_aplicado;

        expected_week := v_esperado;
        excused_week := v_aplicado;
        cancelled_week := v_canceladas;

        if not v_split then
          v_esp[1] := v_esperado;
          v_abo[1] := v_aplicado;
          v_can[1] := v_canceladas;
          for i in 1 .. attended_week loop
            v_fei[1] := v_fei[1] + 1;
            if v_presencas[i] <= p_referencia then
              v_fei_ate[1] := v_fei_ate[1] + 1;
            end if;
          end loop;
        else
          -- Semana Extra (§ 11.4, D10): as presenças preenchem as vagas em
          -- ordem, cada uma no mês em que aconteceu; o que sobra se divide
          -- ao meio, e a sobra ímpar vai para M2. Abonos e canceladas, em M2.
          v_preenchidas := least(attended_week, v_esperado);
          for i in 1 .. attended_week loop
            v_parte := case when (v_presencas[i] at time zone 'America/Sao_Paulo')::date >= v_m2 then 2 else 1 end;
            v_fei[v_parte] := v_fei[v_parte] + 1;
            if v_presencas[i] <= p_referencia then
              v_fei_ate[v_parte] := v_fei_ate[v_parte] + 1;
            end if;
            if i <= v_preenchidas then
              v_esp[v_parte] := v_esp[v_parte] + 1;
            end if;
          end loop;
          v_resto := v_esperado - v_preenchidas;
          v_esp[1] := v_esp[1] + v_resto / 2;
          v_esp[2] := v_esp[2] + (v_resto - v_resto / 2);
          v_abo[2] := v_aplicado;
          v_can[2] := v_canceladas;
        end if;

        -- Ritmo (T10): semanas terminadas inteiras; a semana em curso só até
        -- o que ele já fez; semana futura, nada.
        for i in 1 .. 2 loop
          v_esp_ate[i] := case
            when v_segunda + 6 < v_hoje then v_esp[i]
            when v_segunda <= v_hoje then least(v_fei_ate[i], v_esp[i])
            else 0
          end;
        end loop;
      end if;

      user_id := v_aluno.id;
      week_start := v_segunda;
      week_end := v_segunda + 6;
      is_split := v_split;
      schedule_mode := v_modo;
      weekly_target := v_alvo::smallint;

      for i in 1 .. (case when v_split then 2 else 1 end) loop
        reference_month := case when i = 1 then v_m1 else v_m2 end;
        expected_in_month := v_esp[i];
        attended_in_month := v_fei[i];
        excused_in_month := v_abo[i];
        cancelled_in_month := v_can[i];
        expected_to_date := v_esp_ate[i];
        attended_to_date := v_fei_ate[i];
        return next;
      end loop;

      v_segunda := v_segunda + 7;
    end loop;
  end loop;
end;
$$;

comment on function public.frequencia_por_semana(uuid[], date, date, timestamptz) is
  'A conta da frequência (§ 11): uma linha por aluno, semana e mês que recebe parte da semana (T2, D10). Fonte única de frequencia_semanal, frequencia_do_mes, semanas_do_mes, frequencia_mensal, do fechamento e do Painel. Interna.';

revoke execute on function public.frequencia_por_semana(uuid[], date, date, timestamptz) from public, anon, authenticated;

-- O mês M somado das semanas (§ 11.4, § 11.6). Interna: quem chama confere
-- o acesso.
create function public.frequencia_do_mes_interna(p_user_ids uuid[], p_mes date, p_referencia timestamptz)
returns table (
  user_id           uuid,
  reference_month   date,
  schedule_mode     public.plan_schedule_mode,
  expected          int,
  attended          int,
  excused           int,
  cancelled         int,
  frequency_percent numeric(7, 2),
  closes_on         date,
  is_closed         boolean,
  expected_to_date  int,
  attended_to_date  int
)
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select date_trunc('month', p_mes::timestamp)::date as mes,
           (date_trunc('month', p_mes::timestamp) + interval '1 month - 1 day')::date as ultimo,
           public.fim_do_mes_de_frequencia(p_mes) as fecha,
           (p_referencia at time zone 'America/Sao_Paulo')::date as hoje
  )
  select f.user_id,
         l.mes,
         -- A modalidade da semana de min(hoje, último dia de M) (§ 11.4).
         public.modalidade_da_semana(
           f.user_id,
           date_trunc('week', greatest(l.mes, least(l.hoje, l.ultimo))::timestamp)::date
         ),
         sum(f.expected_in_month)::int,
         sum(f.attended_in_month)::int,
         sum(f.excused_in_month)::int,
         sum(f.cancelled_in_month)::int,
         case when sum(f.expected_in_month) > 0
              then round(sum(f.attended_in_month) * 100.0 / sum(f.expected_in_month), 2)
         end::numeric(7, 2),
         l.fecha,
         l.hoje > l.fecha,
         sum(f.expected_to_date)::int,
         sum(f.attended_to_date)::int
    from l
    cross join lateral public.frequencia_por_semana(
      p_user_ids,
      date_trunc('week', l.mes::timestamp)::date,
      date_trunc('week', l.ultimo::timestamp)::date,
      p_referencia
    ) f
   where f.reference_month = l.mes
   group by f.user_id, l.mes, l.ultimo, l.fecha, l.hoje;
$$;

revoke execute on function public.frequencia_do_mes_interna(uuid[], date, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. As funções do contrato (§ 11.6)
-- ----------------------------------------------------------------------------
create function public.frequencia_semanal(
  p_user_ids   uuid[],
  p_de         date,
  p_ate        date,
  p_referencia timestamptz default now()
)
returns table (
  user_id           uuid,
  week_start        date,
  week_end          date,
  schedule_mode     public.plan_schedule_mode,
  weekly_target     smallint,
  expected          int,
  attended          int,
  excused           int,
  cancelled         int,
  frequency_percent numeric(7, 2)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.pode_ver_frequencia(p_user_ids) then
    raise exception 'Operação negada: só o próprio aluno e a equipe veem a frequência.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'Informe um período válido.' using errcode = '22023';
  end if;

  return query
    select distinct on (f.user_id, f.week_start)
           f.user_id, f.week_start, f.week_end, f.schedule_mode, f.weekly_target,
           f.expected_week, f.attended_week, f.excused_week, f.cancelled_week,
           case when f.expected_week > 0
                then round(f.attended_week * 100.0 / f.expected_week, 2)
           end::numeric(7, 2)
      from public.frequencia_por_semana(
             p_user_ids,
             date_trunc('week', p_de::timestamp)::date,
             date_trunc('week', p_ate::timestamp)::date,
             p_referencia
           ) f
     order by f.user_id, f.week_start;
end;
$$;

comment on function public.frequencia_semanal(uuid[], date, date, timestamptz) is
  '§ 11.6: uma linha por aluno e semana (seg–dom) com ao menos um dia em [p_de, p_ate]. Percentual nulo com esperado 0 (T9). Próprio aluno, equipe ou sistema.';

revoke execute on function public.frequencia_semanal(uuid[], date, date, timestamptz) from public, anon;
grant execute on function public.frequencia_semanal(uuid[], date, date, timestamptz) to authenticated;

create function public.frequencia_do_mes(
  p_user_ids   uuid[],
  p_mes        date,
  p_referencia timestamptz default now()
)
returns table (
  user_id           uuid,
  reference_month   date,
  schedule_mode     public.plan_schedule_mode,
  expected          int,
  attended          int,
  excused           int,
  cancelled         int,
  frequency_percent numeric(7, 2),
  closes_on         date,
  is_closed         boolean,
  expected_to_date  int,
  attended_to_date  int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode_ver_frequencia(p_user_ids) then
    raise exception 'Operação negada: só o próprio aluno e a equipe veem a frequência.' using errcode = '42501';
  end if;
  if p_mes is null then
    raise exception 'Informe o mês.' using errcode = '22023';
  end if;
  return query select * from public.frequencia_do_mes_interna(p_user_ids, p_mes, p_referencia);
end;
$$;

comment on function public.frequencia_do_mes(uuid[], date, timestamptz) is
  '§ 11.6: o mês de cada aluno (soma das semanas, Semana Extra dividida pela D10), com closes_on, is_closed e o ritmo (T10). Próprio aluno, equipe ou sistema.';

revoke execute on function public.frequencia_do_mes(uuid[], date, timestamptz) from public, anon;
grant execute on function public.frequencia_do_mes(uuid[], date, timestamptz) to authenticated;

create function public.semanas_do_mes(
  p_user_id    uuid,
  p_mes        date,
  p_referencia timestamptz default now()
)
returns table (
  week_start           date,
  week_end             date,
  label                text,
  is_split             boolean,
  expected_week        int,
  attended_week        int,
  week_percent         numeric(7, 2),
  expected_in_month    int,
  attended_in_month    int,
  excused_week         int,
  can_justify          boolean,
  justify_until        timestamptz,
  justifications_left  int,
  justificativas       jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_mes    date := date_trunc('month', p_mes::timestamp)::date;
  v_ultimo date := (date_trunc('month', p_mes::timestamp) + interval '1 month - 1 day')::date;
  v_hoje   date := (p_referencia at time zone 'America/Sao_Paulo')::date;
begin
  if p_user_id is null or not public.pode_ver_frequencia(array[p_user_id]) then
    raise exception 'Operação negada: só o próprio aluno e a equipe veem a frequência.' using errcode = '42501';
  end if;

  return query
    with f as (
      select *
        from public.frequencia_por_semana(
               array[p_user_id],
               date_trunc('week', v_mes::timestamp)::date,
               date_trunc('week', v_ultimo::timestamp)::date,
               p_referencia
             ) s
       where s.reference_month = v_mes
    ), numeradas as (
      -- A Semana extra não consome número (§ 11.6).
      select f.*,
             case when f.is_split then 'Semana extra'
                  else 'S' || (count(*) filter (where not f.is_split) over (order by f.week_start))::text
             end as rotulo
        from f
    ), com_prazo as (
      select n.*,
             public.fim_do_prazo_da_semana(n.week_start) as prazo,
             greatest(
               coalesce(n.weekly_target, 0) - (
                 select count(*) from public.absence_justifications j
                  where j.user_id = p_user_id and j.scope = 'week' and j.week_start = n.week_start
               ),
               0
             )::int as restantes
        from numeradas n
    )
    select c.week_start,
           c.week_end,
           c.rotulo,
           c.is_split,
           c.expected_week,
           c.attended_week,
           case when c.expected_week > 0
                then round(c.attended_week * 100.0 / c.expected_week, 2)
           end::numeric(7, 2),
           c.expected_in_month,
           c.attended_in_month,
           c.excused_week,
           -- Só o livre justifica a semana (D39, T17), que já começou e no prazo.
           c.schedule_mode = 'free' and c.week_start <= v_hoje and p_referencia < c.prazo and c.restantes > 0,
           case when c.schedule_mode = 'free' then c.prazo end,
           case when c.schedule_mode = 'free' then c.restantes end,
           coalesce(
             (select jsonb_agg(
                       jsonb_build_object(
                         'id', j.id,
                         'status', j.status,
                         'attempt', j.attempt,
                         -- Quem negou não aparece (D16).
                         'approved_by_name', case when j.status = 'approved' then r.name end
                       )
                       order by j.created_at
                     )
                from public.absence_justifications j
                left join public.profiles r on r.id = j.reviewed_by
               where j.user_id = p_user_id and j.scope = 'week' and j.week_start = c.week_start),
             '[]'::jsonb
           )
      from com_prazo c
     order by c.week_start;
end;
$$;

comment on function public.semanas_do_mes(uuid, date, timestamptz) is
  '§ 11.6: as semanas do mês de um aluno (S1..S5 e a Semana extra), com a parte de cada uma no mês e a justificativa semanal do livre. Próprio aluno, equipe ou sistema.';

revoke execute on function public.semanas_do_mes(uuid, date, timestamptz) from public, anon;
grant execute on function public.semanas_do_mes(uuid, date, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Legado (APK 1.8 e web atual): mesma assinatura e colunas, com o ritmo
--    (§ 15). Continua descartando em silêncio os ids que a pessoa não vê,
--    como fazia.
-- ----------------------------------------------------------------------------
create or replace function public.frequencia_mensal(
  p_user_ids   uuid[],
  p_referencia timestamptz default now()
)
returns table (
  user_id           uuid,
  reference_month   date,
  total_classes     integer,
  counted_classes   integer,
  attended          integer,
  justified         integer,
  frequency_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $funcao$
  select f.user_id,
         f.reference_month,
         f.expected,
         f.expected_to_date,
         f.attended_to_date,
         f.excused,
         case when f.expected_to_date > 0
              then round(f.attended_to_date * 100.0 / f.expected_to_date, 2)
              else 100.00
         end
    from public.frequencia_do_mes_interna(
           array(
             select p.id from public.profiles p
              where p.id = any (p_user_ids)
                and public.pode_ver_frequencia(array[p.id])
           ),
           (p_referencia at time zone 'America/Sao_Paulo')::date,
           p_referencia
         ) f;
$funcao$;

comment on function public.frequencia_mensal(uuid[], timestamptz) is
  'Legado (APK 1.8 e web atual, § 15): total_classes = esperado do mês; counted_classes = esperado até agora; attended = presenças até agora; justified = excused; percentual pelo ritmo, 100 com esperado 0. Aposentada no G6.';

-- ----------------------------------------------------------------------------
-- 5. attendance_monthly (§ 11.6)
-- ----------------------------------------------------------------------------
alter table public.attendance_monthly
  drop constraint attendance_monthly_contagens_coerentes,
  drop constraint attendance_monthly_percentual_valido;

alter table public.attendance_monthly
  add column schedule_mode public.plan_schedule_mode,
  add column expected integer,
  add column excused integer,
  add column cancelled integer;

-- As linhas antigas: o denominador da fórmula antiga era o esperado.
update public.attendance_monthly
   set schedule_mode = 'fixed',
       expected = greatest(counted_classes - justified, 0),
       excused = justified,
       cancelled = 0;

alter table public.attendance_monthly
  alter column schedule_mode set not null,
  alter column expected set not null,
  alter column excused set not null,
  alter column cancelled set not null,
  alter column frequency_percent type numeric(7, 2);

-- Só é gravado quem tem esperado (§ 11.6). NOT VALID primeiro (§ 0.1, regra 7):
-- linha antiga com esperado 0 não impede a migration; o VALIDATE só roda
-- quando a conferência passa.
alter table public.attendance_monthly
  add constraint attendance_monthly_contagens_validas
  check (expected > 0 and attended >= 0 and excused >= 0 and cancelled >= 0 and frequency_percent >= 0)
  not valid;

do $$
begin
  if not exists (
    select 1 from public.attendance_monthly
     where not (expected > 0 and attended >= 0 and excused >= 0 and cancelled >= 0 and frequency_percent >= 0)
  ) then
    alter table public.attendance_monthly validate constraint attendance_monthly_contagens_validas;
  else
    raise notice 'attendance_monthly_contagens_validas fica NOT VALID: há linhas antigas com esperado 0.';
  end if;
end $$;

comment on table public.attendance_monthly is
  'Frequência mensal gravada quando o mês fecha (dia seguinte a closes_on) e recalculada se o mês mudar depois (T31). Regras em docs/FREQUENCIA.md.';

-- ----------------------------------------------------------------------------
-- 6. Recálculo do mês fechado (T31): fila e gatilhos
--
-- Recalcular todos os meses de todos os alunos todo dia pesaria sem motivo.
-- Os gatilhos anotam (aluno, mês) só quando o mês já fechou; user_id nulo =
-- todos os alunos (cancelamento, reativação e chamada mexem em muita gente).
-- ----------------------------------------------------------------------------
create table public.attendance_recalc_queue (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles (id) on delete cascade,
  reference_month date not null,
  queued_at       timestamptz not null default now(),
  constraint attendance_recalc_queue_mes_dia_um
    check (reference_month = date_trunc('month', reference_month::timestamp)::date),
  constraint attendance_recalc_queue_unica unique nulls not distinct (reference_month, user_id)
);

comment on table public.attendance_recalc_queue is
  'Meses já fechados que mudaram (T31) e esperam o recálculo do fechamento diário. user_id nulo = todos. Interna.';

alter table public.attendance_recalc_queue enable row level security;
revoke all on public.attendance_recalc_queue from anon, authenticated;
grant all on public.attendance_recalc_queue to service_role;

create function public.enfileirar_recalculo_de_frequencia(p_user_id uuid, p_quando timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes  date;
begin
  if p_quando is null then
    return;
  end if;
  -- Os meses da semana da aula: na Semana Extra, a conta de um mês depende
  -- das presenças do outro (D10).
  for v_mes in
    select distinct m.x
      from public.meses_da_semana(date_trunc('week', p_quando at time zone 'America/Sao_Paulo')::date) s
      cross join lateral (values (s.mes_inicial), (s.mes_final)) as m(x)
  loop
    if v_hoje > public.fim_do_mes_de_frequencia(v_mes) then
      insert into public.attendance_recalc_queue (user_id, reference_month)
      values (p_user_id, v_mes)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

revoke execute on function public.enfileirar_recalculo_de_frequencia(uuid, timestamptz) from public, anon, authenticated;

-- Presença, declaração (T29) e retificação.
create function public.recalcular_frequencia_pela_presenca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.attendance%rowtype;
begin
  if tg_op = 'DELETE' then
    v_linha := old;
  else
    v_linha := new;
  end if;
  perform public.enfileirar_recalculo_de_frequencia(
    v_linha.user_id,
    (select c.date_time from public.classes c where c.id = v_linha.class_id)
  );
  return null;
end;
$$;

revoke execute on function public.recalcular_frequencia_pela_presenca() from public, anon, authenticated;

create trigger recalcular_frequencia_pela_presenca
  after insert or delete or update of status, declared_status on public.attendance
  for each row execute function public.recalcular_frequencia_pela_presenca();

-- Cancelamento, reativação, chamada concluída, data mudada ou aula apagada.
create function public.recalcular_frequencia_pela_aula()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.type = 'routine' then
      perform public.enfileirar_recalculo_de_frequencia(null, old.date_time);
    end if;
    return null;
  end if;

  if (old.type = 'routine' or new.type = 'routine')
     and (new.cancelled_at is distinct from old.cancelled_at
          or new.attendance_taken_at is distinct from old.attendance_taken_at
          or new.date_time is distinct from old.date_time
          or new.type is distinct from old.type) then
    perform public.enfileirar_recalculo_de_frequencia(null, old.date_time);
    perform public.enfileirar_recalculo_de_frequencia(null, new.date_time);
  end if;
  return null;
end;
$$;

revoke execute on function public.recalcular_frequencia_pela_aula() from public, anon, authenticated;

create trigger recalcular_frequencia_pela_aula
  after update or delete on public.classes
  for each row execute function public.recalcular_frequencia_pela_aula();

-- Justificativa aprovada (ou que deixou de ser).
create function public.recalcular_frequencia_pela_justificativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.absence_justifications%rowtype;
begin
  if tg_op = 'DELETE' then
    v_linha := old;
  else
    v_linha := new;
  end if;
  if not (v_linha.status = 'approved' or (tg_op = 'UPDATE' and old.status = 'approved')) then
    return null;
  end if;
  perform public.enfileirar_recalculo_de_frequencia(
    v_linha.user_id,
    coalesce(
      (select c.date_time from public.classes c where c.id = v_linha.class_id),
      v_linha.week_start::timestamp at time zone 'America/Sao_Paulo'
    )
  );
  return null;
end;
$$;

revoke execute on function public.recalcular_frequencia_pela_justificativa() from public, anon, authenticated;

create trigger recalcular_frequencia_pela_justificativa
  after insert or delete or update of status on public.absence_justifications
  for each row execute function public.recalcular_frequencia_pela_justificativa();

-- Troca que muda de estado (aprovada, expirada, cancelada, de volta).
create function public.recalcular_frequencia_pela_troca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enfileirar_recalculo_de_frequencia(
    new.user_id, (select c.date_time from public.classes c where c.id = new.from_class_id));
  perform public.enfileirar_recalculo_de_frequencia(
    new.user_id, (select c.date_time from public.classes c where c.id = new.to_class_id));
  return null;
end;
$$;

revoke execute on function public.recalcular_frequencia_pela_troca() from public, anon, authenticated;

create trigger recalcular_frequencia_pela_troca
  after insert or update of status on public.class_swaps
  for each row execute function public.recalcular_frequencia_pela_troca();

-- Período de troca permanente aberto, encerrado ou com o fim mudado. Como o
-- período nunca começa nem termina no passado (T37), isto quase nunca acha
-- mês fechado; fica pela regra do contrato.
create function public.recalcular_frequencia_pelo_periodo_de_troca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.enfileirar_recalculo_de_frequencia(old.user_id, old.started_at);
    perform public.enfileirar_recalculo_de_frequencia(old.user_id, old.ended_at);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.enfileirar_recalculo_de_frequencia(new.user_id, new.started_at);
    perform public.enfileirar_recalculo_de_frequencia(new.user_id, new.ended_at);
  end if;
  return null;
end;
$$;

revoke execute on function public.recalcular_frequencia_pelo_periodo_de_troca() from public, anon, authenticated;

create trigger recalcular_frequencia_pelo_periodo_de_troca
  after insert or delete or update of started_at, ended_at on public.class_swap_periods
  for each row execute function public.recalcular_frequencia_pelo_periodo_de_troca();

-- ----------------------------------------------------------------------------
-- 7. Gravar e fechar o mês (§ 11.6)
-- ----------------------------------------------------------------------------

-- Grava (ou regrava) o mês M dos alunos informados (nulo = todos). Só quem
-- tem esperado fica gravado; quem passou a ter esperado 0 sai.
create function public.gravar_frequencia_do_mes(p_mes date, p_user_ids uuid[], p_agora timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids      uuid[];
  v_inicio   timestamptz := p_mes::timestamp at time zone 'America/Sao_Paulo';
  v_fim      timestamptz := (p_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  v_gravados integer;
begin
  -- Titular anonimizado mantém o histórico como estava (§ 12.1).
  v_ids := array(
    select p.id from public.profiles p
     where p.role = 'user'
       and p.anonymized_at is null
       and (p_user_ids is null or p.id = any (p_user_ids))
  );

  with f as (
    select * from public.frequencia_do_mes_interna(v_ids, p_mes, p_agora)
  ), gravadas as (
    insert into public.attendance_monthly as m (
      user_id, reference_month, group_id, schedule_mode, expected, attended, excused, cancelled,
      frequency_percent, total_classes, counted_classes, justified
    )
    select f.user_id, f.reference_month,
           -- A turma em que ele terminou o mês (§ 11.6, 25/09).
           (select g.group_id from public.student_group_periods g
             where g.user_id = f.user_id
               and g.started_at < v_fim
               and (g.ended_at is null or g.ended_at > v_inicio)
             order by g.started_at desc
             limit 1),
           f.schedule_mode, f.expected, f.attended, f.excused, f.cancelled,
           f.frequency_percent, f.expected, f.expected, f.excused
      from f
     where f.expected > 0
    on conflict (user_id, reference_month) do update
       set group_id = excluded.group_id,
           schedule_mode = excluded.schedule_mode,
           expected = excluded.expected,
           attended = excluded.attended,
           excused = excluded.excused,
           cancelled = excluded.cancelled,
           frequency_percent = excluded.frequency_percent,
           total_classes = excluded.total_classes,
           counted_classes = excluded.counted_classes,
           justified = excluded.justified
    returning m.user_id
  ), apagadas as (
    delete from public.attendance_monthly m
     where m.reference_month = p_mes
       and m.user_id = any (v_ids)
       and not exists (select 1 from f where f.user_id = m.user_id and f.expected > 0)
    returning m.user_id
  )
  select count(*)::int into v_gravados from gravadas;

  return v_gravados;
end;
$$;

revoke execute on function public.gravar_frequencia_do_mes(date, uuid[], timestamptz) from public, anon, authenticated;

-- Diário (§ 11.6): fecha cada mês no dia seguinte ao closes_on e recalcula
-- os meses fechados que mudaram (T31). Com p_mes, fecha (ou regrava) aquele
-- mês. Sem nada a fazer, devolve 0.
create or replace function public.fechar_frequencia_do_mes(
  p_mes   date default null,
  p_agora timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_hoje  date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_mes   date;
  v_total integer := 0;
  v_fila  record;
begin
  if p_mes is not null then
    if p_mes <> date_trunc('month', p_mes::timestamp)::date then
      raise exception 'O mês a fechar deve ser informado pelo dia 1.' using errcode = '22023';
    end if;
    if v_hoje <= public.fim_do_mes_de_frequencia(p_mes) then
      raise exception 'O mês % ainda não terminou: fecha depois de %.',
        to_char(p_mes, 'MM/YYYY'), to_char(public.fim_do_mes_de_frequencia(p_mes), 'DD/MM/YYYY')
        using errcode = '22023';
    end if;
    return public.gravar_frequencia_do_mes(p_mes, null, p_agora);
  end if;

  -- O mês anterior e o de antes: com a Semana Extra, o anterior pode ainda
  -- não ter fechado nos primeiros dias do mês (D10).
  for v_mes in
    select (date_trunc('month', v_hoje::timestamp) - make_interval(months => n))::date
      from generate_series(2, 1, -1) as n
  loop
    if v_hoje > public.fim_do_mes_de_frequencia(v_mes)
       and not exists (select 1 from public.attendance_monthly m where m.reference_month = v_mes) then
      v_total := v_total + public.gravar_frequencia_do_mes(v_mes, null, p_agora);
    end if;
  end loop;

  -- T31: os meses fechados que mudaram.
  for v_fila in
    select q.reference_month,
           bool_or(q.user_id is null) as todos,
           array_agg(q.user_id) filter (where q.user_id is not null) as alunos
      from public.attendance_recalc_queue q
     group by q.reference_month
  loop
    if v_hoje > public.fim_do_mes_de_frequencia(v_fila.reference_month) then
      v_total := v_total + public.gravar_frequencia_do_mes(
        v_fila.reference_month,
        case when v_fila.todos then null else v_fila.alunos end,
        p_agora
      );
      delete from public.attendance_recalc_queue q where q.reference_month = v_fila.reference_month;
    end if;
  end loop;

  return v_total;
end;
$funcao$;

comment on function public.fechar_frequencia_do_mes(date, timestamptz) is
  'Diário (§ 11.6): grava cada mês no dia seguinte ao closes_on (só quem tem esperado) e recalcula os meses fechados que mudaram (T31). Com p_mes, fecha ou regrava aquele mês. Sem nada a fazer, devolve 0.';

revoke execute on function public.fechar_frequencia_do_mes(date, timestamptz) from public, anon, authenticated;

-- 00:20 em São Paulo = 03:20 UTC, todo dia. O mesmo nome substitui o agendamento mensal.
select cron.schedule(
  'close-monthly-attendance',
  '20 3 * * *',
  $cron$ select public.fechar_frequencia_do_mes(); $cron$
);

-- ----------------------------------------------------------------------------
-- 8. Painel (§ 11.6, T10, D35, D55): mesma assinatura e colunas
-- ----------------------------------------------------------------------------

-- O último mês já fechado: o anterior, se o closes_on dele passou; senão, o de antes.
create function public.ultimo_mes_de_frequencia_fechado(p_referencia timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  with h as (
    select (p_referencia at time zone 'America/Sao_Paulo')::date as hoje,
           (date_trunc('month', p_referencia at time zone 'America/Sao_Paulo') - interval '1 month')::date as anterior
  )
  select case when h.hoje > public.fim_do_mes_de_frequencia(h.anterior)
              then h.anterior
              else (h.anterior - interval '1 month')::date
         end
    from h;
$$;

revoke execute on function public.ultimo_mes_de_frequencia_fechado(timestamptz) from public, anon, authenticated;

create or replace function public.painel_admin_resumo(p_referencia timestamptz default now())
returns table (
  alunos_ativos integer,
  alunos_inativos integer,
  alunos_ativos_sem_plano integer,
  saidas_no_mes integer,
  competencia date,
  esperado_cents bigint,
  recebido_cents bigint,
  em_analise_cents bigint,
  em_aberto_cents bigint,
  vencido_cents bigint,
  mensalidades_total integer,
  mensalidades_pagas integer,
  inadimplencia_cents bigint,
  alunos_inadimplentes integer,
  inadimplencia_contas_encerradas_cents bigint,
  frequencia_media_mes numeric,
  alunos_com_aula_no_mes integer,
  ultimo_mes_fechado date,
  frequencia_media_ultimo_mes numeric,
  alunos_com_aula_ultimo_mes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje    date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  v_mes     date := date_trunc('month', v_hoje::timestamp)::date;
  v_fechado date := public.ultimo_mes_de_frequencia_fechado(p_referencia);
  v_ativos  uuid[];
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  v_ativos := array(
    select p.id from public.profiles p
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  );

  return query
  with alunos as (
    select p.status, p.plan_id, p.deactivated_at, p.anonymized_at
      from public.profiles p
     where p.role = 'user'
  ), mensalidades_do_mes as (
    select pay.status, pay.amount_cents
      from public.payments pay
     where pay.reference_month = v_mes
  ), inadimplentes as (
    select pay.user_id, pay.amount_cents, p.anonymized_at is not null as encerrada
      from public.payments pay
      join public.profiles p on p.id = pay.user_id
     where pay.status in ('open', 'overdue')
       and pay.due_date < v_hoje
  ), frequencia_do_mes as (
    -- Pelo ritmo (T10): o mês cheio em andamento derrubaria a média no começo
    -- do mês. Média simples, sem teto por aluno (D55); à vontade fora (D35).
    select round(f.attended_to_date * 100.0 / f.expected_to_date, 2) as percentual
      from public.frequencia_do_mes_interna(v_ativos, v_mes, p_referencia) f
     where f.schedule_mode <> 'unlimited'
       and f.expected_to_date > 0
  ), frequencia_do_mes_fechado as (
    select m.frequency_percent as percentual
      from public.attendance_monthly m
     where m.reference_month = v_fechado
       and m.schedule_mode <> 'unlimited'
  )
  select
    (select count(*) from alunos a where a.status = 'active' and a.anonymized_at is null)::integer,
    (select count(*) from alunos a where a.status = 'inactive' and a.anonymized_at is null)::integer,
    (select count(*) from alunos a where a.status = 'active' and a.anonymized_at is null and a.plan_id is null)::integer,
    (select count(*) from alunos a
      where a.deactivated_at is not null
        and date_trunc('month', a.deactivated_at at time zone 'America/Sao_Paulo')::date = v_mes)::integer,
    v_mes,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m)::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'paid')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'pending_approval')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'open')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'overdue')::bigint,
    (select count(*) from mensalidades_do_mes m)::integer,
    (select count(*) from mensalidades_do_mes m where m.status = 'paid')::integer,
    (select coalesce(sum(i.amount_cents), 0) from inadimplentes i where not i.encerrada)::bigint,
    (select count(distinct i.user_id) from inadimplentes i where not i.encerrada)::integer,
    (select coalesce(sum(i.amount_cents), 0) from inadimplentes i where i.encerrada)::bigint,
    (select round(avg(f.percentual), 2) from frequencia_do_mes f),
    (select count(*) from frequencia_do_mes f)::integer,
    v_fechado,
    (select round(avg(f.percentual), 2) from frequencia_do_mes_fechado f),
    (select count(*) from frequencia_do_mes_fechado f)::integer;
end;
$funcao$;

comment on function public.painel_admin_resumo(timestamptz) is
  'Números do Painel do admin. Frequência: média simples, sem teto por aluno (D55), do ritmo do mês (T10) e do último mês fechado; à vontade fora (D35). Só admin. Regras em docs/PAINEL.md.';

create or replace function public.painel_alunos_em_risco(
  p_limite_percent numeric default 70,
  p_min_aulas integer default 4,
  p_referencia timestamptz default now()
)
returns table (
  user_id uuid,
  nome text,
  turma text,
  frequencia_mes_atual numeric,
  frequencia_ultimo_mes numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje    date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  v_mes     date := date_trunc('month', v_hoje::timestamp)::date;
  v_fechado date := public.ultimo_mes_de_frequencia_fechado(p_referencia);
  v_ativos  uuid[];
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  v_ativos := array(
    select p.id from public.profiles p
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  );

  return query
  with mes as (
    select f.user_id as aluno, f.schedule_mode, f.expected_to_date, f.attended_to_date
      from public.frequencia_do_mes_interna(v_ativos, v_mes, p_referencia) f
  ), mes_atual as (
    -- Ritmo (T10): presenças ÷ esperado até agora, com esperado até agora >= p_min_aulas.
    select m.aluno, round(m.attended_to_date * 100.0 / m.expected_to_date, 2) as percentual
      from mes m
     where m.expected_to_date >= p_min_aulas
       and m.expected_to_date > 0
  ), mes_fechado as (
    select am.user_id as aluno, am.frequency_percent as percentual
      from public.attendance_monthly am
     where am.reference_month = v_fechado
       and am.schedule_mode <> 'unlimited'
  )
  select p.id,
         coalesce(p.name, 'Aluno pendente'),
         g.name,
         atual.percentual,
         anterior.percentual
    from public.profiles p
    join mes on mes.aluno = p.id
    left join mes_atual atual on atual.aluno = p.id
    left join mes_fechado anterior on anterior.aluno = p.id
    left join public.groups g on g.id = p.group_id
   where p.id = any (v_ativos)
     -- O à vontade fica fora (D35).
     and mes.schedule_mode <> 'unlimited'
     and (atual.percentual < p_limite_percent or anterior.percentual < p_limite_percent)
   order by least(coalesce(atual.percentual, 1e9), coalesce(anterior.percentual, 1e9)), 2;
end;
$funcao$;

comment on function public.painel_alunos_em_risco(numeric, integer, timestamptz) is
  'Alunos ativos em risco (T10): ritmo do mês abaixo de p_limite_percent com esperado até agora >= p_min_aulas, ou último mês fechado abaixo do limite. À vontade fora (D35). Só admin.';
