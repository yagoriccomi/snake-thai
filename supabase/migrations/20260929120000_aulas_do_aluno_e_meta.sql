-- ============================================================================
-- 4.4 — Aulas do aluno, menu de aulas, extra e meta (contrato v4: § 5.3,
-- § 9.2, § 9.5, § 12, § 12.2; D13, D36–D38, D51, D56; T2, T3, T5, T19, T26,
-- T27, T33, T34, T36, T38, T40, T43)
--
-- - A declaração ("Vou" / "Não vou" / "Vou (extra)") passa pelas travas do
--   contrato em QUALQUER caminho: a RPC declarar_aula e o upsert direto do
--   APK 1.8 e da web atual, pelo gatilho de attendance.
-- - aulas_do_aluno e menu_de_aulas saem da MESMA função-base, com a mesma
--   lista e ordem de colunas (§ 12.2): não têm como divergir.
-- - O que a aula permite na troca (can_swap_*) sai de funções internas que o
--   pedir_troca_de_aula do 4.9b reusa: a tela e a RPC decidem igual [#6].
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Correção do 4.1: as travas com "not (v_sistema or v_pela_rpc)" liberavam
--    quando a variável de sessão nunca tinha sido ligada (current_setting dá
--    nulo, e "not nulo" não é verdadeiro). Mesma armadilha do check que dá
--    nulo (§ 0.1, regra 9). A de attendance é corrigida na seção 3.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_class_state_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  -- coalesce: numa sessão nova da API a variável nunca ligada dá nulo, e o
  -- "not (...)" abaixo deixaria passar (§ 0.1, regra 4). Achado no 4.4.
  v_pela_rpc boolean := coalesce(current_setting('snake.aula_rpc', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.attendance_taken_at is not null then
      raise exception 'Aula com chamada: cancele em vez de apagar.' using errcode = '23514';
    end if;
    return old;
  end if;

  -- A data da primeira conclusão é a base do "feita X dias depois" (T14).
  if old.attendance_taken_at is not null and new.attendance_taken_at is null then
    raise exception 'A chamada concluída não volta a ficar pendente.' using errcode = '23514';
  end if;

  if old.attendance_taken_at is not null and (
       new.type is distinct from old.type
       or new.date_time is distinct from old.date_time
       or new.group_id is distinct from old.group_id
       or new.audience is distinct from old.audience
     ) then
    raise exception 'Aula com chamada: tipo, data, turma e público não mudam.' using errcode = '23514';
  end if;

  if not (v_sistema or v_pela_rpc) and (
       new.cancelled_at is distinct from old.cancelled_at
       or new.attendance_taken_at is distinct from old.attendance_taken_at
       or new.attendance_edited is distinct from old.attendance_edited
     ) then
    raise exception 'Operação negada: cancelamento e chamada só mudam pelas funções do aplicativo.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Peças internas
-- ----------------------------------------------------------------------------

-- Prazo de 7 dias (D13, T19): até 23:59 (SP) do 7º dia depois da aula. Devolve
-- o instante que ENCERRA o prazo (00:00 do 8º dia), como o gatilho da
-- justificativa (4.1) confere.
create function public.limite_de_7_dias(p_quando timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (((p_quando at time zone 'America/Sao_Paulo')::date + 8)::timestamp at time zone 'America/Sao_Paulo');
$$;

revoke execute on function public.limite_de_7_dias(timestamptz) from public, anon, authenticated;

-- A aula é da grade efetiva do fixo? Devolve a fonte ('turma' | 'permanente' |
-- 'troca') ou nulo. É a T33 para UMA aula, sempre pela função única.
create function public.fonte_da_aula_na_grade(p_user_id uuid, p_class_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.fonte
    from public.classes c
    cross join lateral public.grade_efetiva_do_fixo(
      array[p_user_id], c.date_time, c.date_time + interval '1 microsecond'
    ) g
   where c.id = p_class_id
     and g.class_id = p_class_id;
$$;

revoke execute on function public.fonte_da_aula_na_grade(uuid, uuid) from public, anon, authenticated;

-- Outra aula da grade dele (não cancelada) no mesmo instante desta (§ 9.2, T40).
create function public.outra_aula_da_grade_no_horario(p_user_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.classes c
      cross join lateral public.grade_efetiva_do_fixo(
        array[p_user_id], c.date_time, c.date_time + interval '1 microsecond'
      ) g
      join public.classes o on o.id = g.class_id
     where c.id = p_class_id
       and g.class_id <> p_class_id
       and o.cancelled_at is null
  );
$$;

revoke execute on function public.outra_aula_da_grade_no_horario(uuid, uuid) from public, anon, authenticated;

-- "Vou" marcados na semana, só em aula de rotina não cancelada. No fixo,
-- só as extras (as aulas da grade dele não são "marcadas", § 9.2).
create function public.marcadas_na_semana(p_user_id uuid, p_segunda date, p_so_extras boolean)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
    from public.attendance a
    join public.classes o on o.id = a.class_id
   where a.user_id = p_user_id
     and a.declared_status = 'present'
     and o.type = 'routine'
     and o.cancelled_at is null
     and o.date_time >= p_segunda::timestamp at time zone 'America/Sao_Paulo'
     and o.date_time < (p_segunda + 7)::timestamp at time zone 'America/Sao_Paulo'
     and (not p_so_extras or public.fonte_da_aula_na_grade(p_user_id, o.id) is null);
$$;

revoke execute on function public.marcadas_na_semana(uuid, date, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Meta semanal do à vontade (§ 5.3, D36–D38)
-- ----------------------------------------------------------------------------
create function public.meta_vigente(p_user_id uuid, p_segunda date)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  -- A mais recente que já vale (D38); sem nenhuma, a padrão da academia (D36).
  select coalesce(
    (select g.goal
       from public.weekly_goals g
      where g.user_id = p_user_id
        and g.effective_week_start <= p_segunda
      order by g.effective_week_start desc
      limit 1),
    (select s.default_weekly_goal from public.academy_settings s limit 1)
  );
$$;

revoke execute on function public.meta_vigente(uuid, date) from public, anon, authenticated;

create function public.meta_da_semana(p_user_id uuid, p_week_start date)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
begin
  if not (v_sistema or p_user_id = (select auth.uid()) or public.is_staff()) then
    raise exception 'Operação negada: só o próprio aluno e a equipe veem a meta.' using errcode = '42501';
  end if;
  return public.meta_vigente(p_user_id, date_trunc('week', p_week_start)::date);
end;
$$;

revoke execute on function public.meta_da_semana(uuid, date) from public, anon;
grant execute on function public.meta_da_semana(uuid, date) to authenticated;

create function public.definir_meta_semanal(p_meta smallint, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem  uuid := (select auth.uid());
  v_aluno uuid := coalesce(p_user_id, (select auth.uid()));
  v_vale  date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7;
begin
  if v_quem is null or (v_aluno <> v_quem and not public.is_admin()) then
    raise exception 'Operação negada: só o próprio aluno ou um admin define a meta.' using errcode = '42501';
  end if;

  if p_meta is null or p_meta not between 1 and 6 then
    raise exception 'A meta vai de 1 a 6 aulas por semana.' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.plan_periods pp
      join public.plans p on p.id = pp.plan_id
     where pp.user_id = v_aluno
       and pp.ended_at is null
       and p.schedule_mode = 'unlimited'
  ) then
    raise exception 'A meta semanal é só do plano à vontade.' using errcode = '23514';
  end if;

  -- Vale a partir da próxima segunda: a meta desta semana não muda (D37).
  insert into public.weekly_goals (user_id, effective_week_start, goal, set_by, set_at)
  values (v_aluno, v_vale, p_meta, v_quem, now())
  on conflict (user_id, effective_week_start)
  do update set goal = excluded.goal, set_by = excluded.set_by, set_at = excluded.set_at;

  return jsonb_build_object('meta', p_meta, 'vale_a_partir', v_vale);
end;
$$;

revoke execute on function public.definir_meta_semanal(smallint, uuid) from public, anon;
grant execute on function public.definir_meta_semanal(smallint, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Declaração de presença (§ 9.2, § 9.5, T26, T27, T40)
--    As travas vivem aqui e valem para a RPC e para o upsert direto: o
--    gatilho de attendance chama esta função quando o aluno muda a própria
--    declaração. Recusa com a frase do contrato ou devolve o valor a gravar.
-- ----------------------------------------------------------------------------
create function public.normalizar_declaracao(
  p_user_id uuid,
  p_class_id uuid,
  p_valor public.attendance_status
)
returns public.attendance_status
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aula  public.classes%rowtype;
  v_modo  public.plan_schedule_mode;
  v_valor public.attendance_status;
begin
  select * into v_aula from public.classes where id = p_class_id;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if v_aula.cancelled_at is not null then
    raise exception 'Aula cancelada.' using errcode = '23514';
  end if;

  -- T26: declarar só até o início; depois, só a chamada.
  if v_aula.date_time <= now() then
    raise exception 'Esta aula já começou.' using errcode = '23514';
  end if;

  if v_aula.type = 'event' then
    -- Evento: qualquer aluno declara "Vou"; "Não vou" só limpa (evento não conta).
    v_valor := case when p_valor = 'present' then 'present'::public.attendance_status end;
  else
    v_modo := public.modalidade_da_semana(
      p_user_id, date_trunc('week', v_aula.date_time at time zone 'America/Sao_Paulo')::date
    );

    if v_modo <> 'fixed' then
      -- Livre e à vontade (T27): só aula que aceita livres; "Não vou" limpa.
      if v_aula.audience = 'fixed' then
        raise exception 'Esta aula é só para alunos de horário fixo.' using errcode = '23514';
      end if;
      v_valor := case when p_valor = 'present' then 'present'::public.attendance_status end;
    else
      if exists (
        select 1 from public.class_swaps s
         where s.user_id = p_user_id and s.kind = 'once' and s.status = 'approved' and s.from_class_id = p_class_id
      ) then
        raise exception 'Você trocou esta aula por outra.' using errcode = '23514';
      end if;

      if exists (
        select 1 from public.class_swaps s
         where s.user_id = p_user_id and s.kind = 'once' and s.status = 'pending' and s.to_class_id = p_class_id
      ) then
        raise exception 'Você já pediu troca para esta aula.' using errcode = '23514';
      end if;

      if public.fonte_da_aula_na_grade(p_user_id, p_class_id) is not null then
        -- Aula da grade: "Vou" e "Não vou" como sempre.
        v_valor := p_valor;
      else
        -- Extra (D51, D56): qualquer público; "Não vou" nunca vira falta (T40).
        if p_valor = 'present' and public.outra_aula_da_grade_no_horario(p_user_id, p_class_id) then
          raise exception 'Você já tem aula neste horário. Para ir nesta, peça a troca.' using errcode = '23514';
        end if;
        v_valor := case when p_valor = 'present' then 'present'::public.attendance_status end;
      end if;
    end if;
  end if;

  -- T26: duas aulas no mesmo horário, não.
  if v_valor = 'present' and exists (
    select 1
      from public.attendance a
      join public.classes o on o.id = a.class_id
     where a.user_id = p_user_id
       and a.class_id <> p_class_id
       and a.declared_status = 'present'
       and o.cancelled_at is null
       and o.date_time = v_aula.date_time
  ) then
    raise exception 'Você já marcou outra aula neste horário.' using errcode = '23514';
  end if;

  return v_valor;
end;
$$;

revoke execute on function public.normalizar_declaracao(uuid, uuid, public.attendance_status) from public, anon, authenticated;

create or replace function public.enforce_attendance_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  colunas_do_aluno constant text[] := array['declared_status', 'declared_at', 'updated_at'];
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  -- Sem coalesce, a variável nunca ligada na sessão dá nulo, e o "not (...)"
  -- abaixo pularia as travas (§ 0.1, regra 4: a trava nunca libera por ausência).
  v_pela_rpc boolean := coalesce(current_setting('snake.chamada_rpc', true), '') = 'on';
  v_gestor boolean;
  coluna text;
begin
  if tg_op = 'DELETE' then
    if v_sistema or v_pela_rpc then
      return old;
    end if;
    -- Cascata da aula ou do perfil: a linha vai junto.
    if not exists (select 1 from public.classes c where c.id = old.class_id)
       or not exists (select 1 from public.profiles p where p.id = old.user_id) then
      return old;
    end if;
    if old.status is not null or old.included then
      raise exception 'Operação negada: presença registrada só sai pela chamada.' using errcode = '42501';
    end if;
    return old;
  end if;

  -- A chamada oficial só muda pelas RPCs de chamada (§ 7.1): recusado antes
  -- de qualquer outra regra, para o aluno e para a equipe.
  if not (v_sistema or v_pela_rpc) then
    if tg_op = 'INSERT' and (new.status is not null or new.edited or new.included) then
      raise exception 'Operação negada: a presença só é confirmada pela chamada do professor.'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.status is distinct from old.status
                             or new.edited is distinct from old.edited
                             or new.included is distinct from old.included) then
      raise exception 'Operação negada: a presença só é confirmada pela chamada do professor.'
        using errcode = '42501';
    end if;
  end if;

  -- § 9.2 (4.4): a declaração do próprio aluno passa pelas travas, venha da
  -- RPC ou do upsert direto (APK 1.8, web atual). Pode virar nulo (extra e
  -- livre com "Não vou").
  if not (v_sistema or v_pela_rpc)
     and new.user_id = (select auth.uid())
     and ((tg_op = 'INSERT' and new.declared_status is not null)
          or (tg_op = 'UPDATE' and new.declared_status is distinct from old.declared_status)) then
    new.declared_status := public.normalizar_declaracao(new.user_id, new.class_id, new.declared_status);
  end if;

  -- T29: carimba quando a declaração vira "Vou"; limpa quando deixa de ser.
  if new.declared_status = 'present' then
    if tg_op = 'INSERT' or old.declared_status is distinct from 'present' then
      new.declared_at := now();
    else
      new.declared_at := old.declared_at;
    end if;
  else
    new.declared_at := null;
  end if;

  if v_sistema or v_pela_rpc then
    return new;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  v_gestor := public.is_admin() or exists (
    select 1 from public.class_teachers ct
     where ct.class_id = new.class_id and ct.teacher_id = (select auth.uid())
  );
  if v_gestor then
    return new;
  end if;

  -- O aluno só muda a própria declaração.
  for coluna in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) -> coluna) is distinct from (to_jsonb(new) -> coluna)
       and not (coluna = any (colunas_do_aluno)) then
      raise exception
        'Operação negada: o aluno só altera a própria declaração (coluna "%").', coluna
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

create function public.declarar_aula(p_class_id uuid, p_vou boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aluno   uuid := (select auth.uid());
  v_perfil  public.profiles%rowtype;
  v_aula    public.classes%rowtype;
  v_segunda date;
  v_modo    public.plan_schedule_mode;
  v_valor   public.attendance_status;
  v_cota    smallint;
  v_marcadas int;
begin
  select * into v_perfil from public.profiles where id = v_aluno;
  if v_aluno is null or not found or v_perfil.role <> 'user' then
    raise exception 'Declarar presença é só para alunos.' using errcode = '42501';
  end if;
  if v_perfil.status <> 'active' then
    raise exception 'Só aluno ativo declara presença.' using errcode = '23514';
  end if;

  select * into v_aula from public.classes where id = p_class_id;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  v_segunda := date_trunc('week', v_aula.date_time at time zone 'America/Sao_Paulo')::date;
  v_modo := public.modalidade_da_semana(v_aluno, v_segunda);

  -- "Não vou" só grava falta na aula da grade do fixo; nos outros casos, limpa.
  v_valor := case
    when coalesce(p_vou, false) then 'present'::public.attendance_status
    when v_aula.type = 'routine' and v_modo = 'fixed'
         and public.fonte_da_aula_na_grade(v_aluno, p_class_id) is not null then 'absent'::public.attendance_status
  end;

  if v_valor is not null
     or exists (select 1 from public.attendance a where a.class_id = p_class_id and a.user_id = v_aluno) then
    -- As travas estão no gatilho (normalizar_declaracao): valem para todo caminho.
    insert into public.attendance (class_id, user_id, declared_status)
    values (p_class_id, v_aluno, v_valor)
    on conflict (class_id, user_id) do update set declared_status = excluded.declared_status;
  end if;

  v_marcadas := public.marcadas_na_semana(v_aluno, v_segunda, v_modo = 'fixed');
  v_cota := case when v_modo = 'free' then public.cota_da_semana(v_aluno, v_segunda) end;

  -- Acima da cota só avisa, nunca bloqueia (D4); o à vontade nunca recebe (T27).
  return jsonb_build_object(
    'marcadas_na_semana', v_marcadas,
    'cota', v_cota,
    'acima_da_cota', v_cota is not null and v_marcadas > v_cota
  );
end;
$$;

revoke execute on function public.declarar_aula(uuid, boolean) from public, anon;
grant execute on function public.declarar_aula(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. O que a aula permite na troca (§ 9.4, T34, T36, T37, T38) — as condições
--    que não dependem do par de aulas. O pedir_troca_de_aula (4.9b) confere
--    as mesmas e mais as do par (semana, mesmo horário).
-- ----------------------------------------------------------------------------
create function public.pode_ser_original_avulsa(p_user_id uuid, p_class_id uuid, p_referencia timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.classes c
     where c.id = p_class_id
       and c.type = 'routine'
       and c.cancelled_at is null
       -- Da grade dele, mas não destino de outra avulsa (T34).
       and public.fonte_da_aula_na_grade(p_user_id, c.id) in ('turma', 'permanente')
       -- Reposição só sem presença nela (T34).
       and not exists (
         select 1 from public.attendance a
          where a.class_id = c.id and a.user_id = p_user_id and a.status = 'present'
       )
       and not exists (
         select 1 from public.class_swaps s
          where s.user_id = p_user_id and s.kind = 'once' and s.status in ('pending', 'approved')
            and c.id in (s.from_class_id, s.to_class_id)
       )
       -- T38 (b) e (c).
       and not exists (
         select 1 from public.absence_justifications j
          where j.user_id = p_user_id and j.class_id = c.id and j.status in ('pending', 'approved')
       )
       and not exists (
         select 1 from public.roll_call_requests r
          where r.subject_id = p_user_id and r.class_id = c.id
            and r.kind = 'student_was_present' and r.status = 'pending'
       )
       -- T38 (a): aula futura de um horário com permanente pendente.
       and (c.date_time <= p_referencia or c.schedule_id is null or not exists (
         select 1 from public.class_swaps s
          where s.user_id = p_user_id and s.kind = 'permanent' and s.status = 'pending'
            and c.schedule_id in (s.from_schedule_id, s.to_schedule_id)
       ))
  );
$$;

revoke execute on function public.pode_ser_original_avulsa(uuid, uuid, timestamptz) from public, anon, authenticated;

create function public.pode_ser_original_permanente(p_user_id uuid, p_class_id uuid, p_referencia timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.classes c
      join public.class_schedules h on h.id = c.schedule_id
     where c.id = p_class_id
       and c.type = 'routine'
       -- A permanente não repõe falta (T37). Cancelada serve: é só ponteiro.
       and c.date_time > p_referencia
       and public.fonte_da_aula_na_grade(p_user_id, c.id) in ('turma', 'permanente')
       -- Plano aberto fixo ou nenhum (a mudança de plano marcada recusa, § 9.4).
       and coalesce((
         select p.schedule_mode
           from public.plan_periods pp
           join public.plans p on p.id = pp.plan_id
          where pp.user_id = p_user_id and pp.ended_at is null
       ), 'fixed') = 'fixed'
       and (h.valid_until is null or h.valid_until >= (p_referencia at time zone 'America/Sao_Paulo')::date)
       and not exists (
         select 1 from public.class_swaps s
          where s.user_id = p_user_id and s.kind = 'permanent' and s.status = 'pending'
            and s.from_schedule_id = c.schedule_id
       )
       -- T38 (a): avulsa ativa com aula futura deste horário.
       and not exists (
         select 1
           from public.class_swaps s
           join public.classes x on x.id in (s.from_class_id, s.to_class_id)
          where s.user_id = p_user_id and s.kind = 'once' and s.status in ('pending', 'approved')
            and x.schedule_id = c.schedule_id
            and x.date_time > p_referencia
       )
  );
$$;

revoke execute on function public.pode_ser_original_permanente(uuid, uuid, timestamptz) from public, anon, authenticated;

create function public.pode_ser_destino_de_troca(p_user_id uuid, p_class_id uuid, p_referencia timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.classes c
     where c.id = p_class_id
       -- Qualquer aula de rotina, de qualquer público (D47); nunca evento (T34).
       and c.type = 'routine'
       and c.cancelled_at is null
       and c.date_time > p_referencia
       and public.modalidade_da_semana(
             p_user_id, date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date
           ) = 'fixed'
       and public.fonte_da_aula_na_grade(p_user_id, c.id) is null
       and not exists (
         select 1 from public.class_swaps s
          where s.user_id = p_user_id and s.kind = 'once' and s.status in ('pending', 'approved')
            and c.id in (s.from_class_id, s.to_class_id)
       )
       and not public.outra_aula_da_grade_no_horario(p_user_id, c.id)
  );
$$;

revoke execute on function public.pode_ser_destino_de_troca(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. A função-base das aulas do aluno (§ 12, § 12.2)
--    p_menu = true: o fixo vê TODAS as aulas de rotina (o menu de aulas).
--    As colunas can_justify e can_contest só valem nas linhas que também
--    aparecem em aulas_do_aluno (§ 12.2).
-- ----------------------------------------------------------------------------
create function public.aulas_do_aluno_base(
  p_user_id uuid,
  p_de timestamptz,
  p_ate timestamptz,
  p_referencia timestamptz,
  p_menu boolean
)
returns table (
  class_id uuid,
  title text,
  type public.class_type,
  date_time timestamptz,
  group_id text,
  group_name text,
  audience public.class_audience,
  cancelled boolean,
  declared_status public.attendance_status,
  status public.attendance_status,
  justification_id uuid,
  justification_status public.justification_status,
  schedule_mode public.plan_schedule_mode,
  weekly_target smallint,
  marked_in_week int,
  can_justify boolean,
  justify_until timestamptz,
  can_contest boolean,
  contest_until timestamptz,
  teachers jsonb,
  origem text,
  is_recurring boolean,
  schedule_ends_on date,
  can_mark_extra boolean,
  can_swap_from boolean,
  can_swap_from_permanent boolean,
  can_swap_to boolean,
  swap_id uuid,
  swap_kind public.class_swap_kind,
  swap_status public.class_swap_status,
  swap_decided_via text,
  swap_role text,
  swap_other_class_id uuid,
  swap_other_date_time timestamptz,
  can_cancel_swap boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  r                  record;
  v_semana           date;
  v_semana_cacheada  date;
  v_modo             public.plan_schedule_mode;
  v_alvo             smallint;
  v_marcadas         int;
  v_tem_linha        boolean;
  v_decl             public.attendance_status;
  v_status           public.attendance_status;
  v_incluido         boolean;
  v_fonte            text;
  v_trocou           boolean;
  v_pendente_saindo  boolean;
  v_pendente_para    boolean;
  v_expirada_para    boolean;
  v_visivel          boolean;
  v_limite           timestamptz;
  v_troca            public.class_swaps%rowtype;
  v_outra            uuid;
begin
  for r in
    select c.id, c.title, c.type, c.date_time, c.group_id, g.name as group_name, c.audience,
           c.cancelled_at, c.schedule_id, c.attendance_taken_at, h.valid_until
      from public.classes c
      left join public.groups g on g.id = c.group_id
      left join public.class_schedules h on h.id = c.schedule_id
     where c.date_time >= p_de
       and c.date_time < p_ate
     order by c.date_time, c.title, c.id
  loop
    v_semana := date_trunc('week', r.date_time at time zone 'America/Sao_Paulo')::date;
    if v_semana is distinct from v_semana_cacheada then
      -- A modalidade é a da semana da aula (T3); a cota, a meta e as marcadas também.
      v_semana_cacheada := v_semana;
      v_modo := public.modalidade_da_semana(p_user_id, v_semana);
      v_alvo := case v_modo
        when 'free' then public.cota_da_semana(p_user_id, v_semana)
        when 'unlimited' then public.meta_vigente(p_user_id, v_semana)
      end;
      v_marcadas := public.marcadas_na_semana(p_user_id, v_semana, v_modo = 'fixed');
    end if;

    select a.declared_status, a.status, a.included
      into v_decl, v_status, v_incluido
      from public.attendance a
     where a.class_id = r.id and a.user_id = p_user_id;
    v_tem_linha := found;
    if not v_tem_linha then
      v_decl := null; v_status := null; v_incluido := false;
    end if;

    v_fonte := case when v_modo = 'fixed' and r.type = 'routine'
                    then public.fonte_da_aula_na_grade(p_user_id, r.id) end;

    select exists (select 1 from public.class_swaps s
                    where s.user_id = p_user_id and s.kind = 'once' and s.status = 'approved' and s.from_class_id = r.id),
           exists (select 1 from public.class_swaps s
                    where s.user_id = p_user_id and s.status = 'pending' and s.from_class_id = r.id),
           exists (select 1 from public.class_swaps s
                    where s.user_id = p_user_id and s.kind = 'once' and s.status = 'pending' and s.to_class_id = r.id),
           exists (select 1 from public.class_swaps s
                    where s.user_id = p_user_id and s.kind = 'once' and s.status = 'expired' and s.to_class_id = r.id)
      into v_trocou, v_pendente_saindo, v_pendente_para, v_expirada_para;

    -- O que aparece em aulas_do_aluno (§ 12).
    v_visivel := v_tem_linha
      or r.type = 'event'
      or (v_modo = 'fixed' and (v_fonte is not null or v_trocou or v_pendente_para or v_expirada_para))
      or (v_modo <> 'fixed' and r.type = 'routine' and r.audience in ('free', 'both'));

    -- O menu de aulas: o fixo vê todas as aulas de rotina (§ 12.2, D47, D56).
    if not (v_visivel or (p_menu and v_modo = 'fixed' and r.type = 'routine')) then
      continue;
    end if;

    v_limite := public.limite_de_7_dias(r.date_time);

    class_id := r.id;
    title := r.title;
    type := r.type;
    date_time := r.date_time;
    group_id := r.group_id;
    group_name := r.group_name;
    audience := r.audience;
    cancelled := r.cancelled_at is not null;
    declared_status := v_decl;
    status := v_status;

    select j.id, j.status into justification_id, justification_status
      from public.absence_justifications j
     where j.class_id = r.id and j.user_id = p_user_id;
    if not found then
      justification_id := null;
      justification_status := null;
    end if;

    schedule_mode := v_modo;
    weekly_target := v_alvo;
    marked_in_week := v_marcadas;

    -- Justificar (fixo, § 9.1, D13, T38 b): aula da grade, no prazo, sem justificativa.
    can_justify := v_modo = 'fixed' and r.type = 'routine' and r.cancelled_at is null
      and v_fonte is not null and p_referencia < v_limite
      and justification_id is null and v_status is distinct from 'present'
      and not v_pendente_saindo;
    justify_until := case when v_modo = 'fixed' and r.type = 'routine' and v_fonte is not null
                          then v_limite - interval '1 second' end;

    -- "Eu estava na aula" (§ 9.3, T19, T38 c): só nas linhas de aulas_do_aluno.
    can_contest := v_visivel and r.type = 'routine' and r.cancelled_at is null
      and r.attendance_taken_at is not null and v_status is distinct from 'present'
      and p_referencia < v_limite and not v_trocou and not v_pendente_saindo
      and not exists (
        select 1 from public.roll_call_requests q
         where q.kind = 'student_was_present' and q.class_id = r.id and q.subject_id = p_user_id
      );
    contest_until := case when v_visivel and r.type = 'routine' then v_limite - interval '1 second' end;

    teachers := coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color)
                       order by ct.created_at, p.name)
        from public.class_teachers ct
        join public.profiles p on p.id = ct.teacher_id
       where ct.class_id = r.id and p.anonymized_at is null
    ), '[]'::jsonb);

    -- Vocabulário da § 7.2, a primeira que se aplica.
    origem := case
      when r.type = 'event' then
        case when v_decl = 'present' then 'marcou' when v_incluido or v_status is not null then 'incluido' end
      when v_modo = 'fixed' then coalesce(v_fonte, case
        when v_pendente_para then 'troca_pendente'
        when v_trocou then 'trocou'
        when v_decl = 'present' then 'extra'
        when v_incluido or v_status is not null then 'incluido'
      end)
      else
        case when v_decl = 'present' then 'marcou' when v_incluido or v_status is not null then 'incluido' end
    end;

    is_recurring := r.schedule_id is not null;
    schedule_ends_on := r.valid_until;

    -- Vou (extra) (§ 9.5): fora da grade, qualquer público, sem aula dele no horário.
    can_mark_extra := v_modo = 'fixed' and r.type = 'routine' and r.cancelled_at is null
      and r.date_time > p_referencia and v_fonte is null and not v_trocou and not v_pendente_para
      and v_decl is distinct from 'present'
      and not public.outra_aula_da_grade_no_horario(p_user_id, r.id);

    can_swap_from := v_modo = 'fixed' and public.pode_ser_original_avulsa(p_user_id, r.id, p_referencia);
    can_swap_from_permanent := v_modo = 'fixed' and public.pode_ser_original_permanente(p_user_id, r.id, p_referencia);
    can_swap_to := public.pode_ser_destino_de_troca(p_user_id, r.id, p_referencia);

    -- A troca mais recente em que esta aula é a original ou a nova.
    select s.* into v_troca
      from public.class_swaps s
     where s.user_id = p_user_id and r.id in (s.from_class_id, s.to_class_id)
     order by s.created_at desc, s.id
     limit 1;
    if found then
      swap_id := v_troca.id;
      swap_kind := v_troca.kind;
      swap_status := v_troca.status;
      swap_decided_via := v_troca.decided_via;
      swap_role := case when v_troca.from_class_id = r.id then 'origem' else 'destino' end;
      v_outra := case when v_troca.from_class_id = r.id then v_troca.to_class_id else v_troca.from_class_id end;
      swap_other_class_id := v_outra;
      swap_other_date_time := (select o.date_time from public.classes o where o.id = v_outra);
      -- T36: a pendente, sempre; a avulsa aprovada, só antes de as duas começarem.
      can_cancel_swap := r.cancelled_at is null and (
        v_troca.status = 'pending'
        or (v_troca.kind = 'once' and v_troca.status = 'approved'
            and not exists (
              select 1 from public.classes o
               where o.id in (v_troca.from_class_id, v_troca.to_class_id) and o.date_time <= p_referencia
            )
            and v_troca.from_class_id is not null and v_troca.to_class_id is not null)
      );
    else
      swap_id := null; swap_kind := null; swap_status := null; swap_decided_via := null;
      swap_role := null; swap_other_class_id := null; swap_other_date_time := null;
      can_cancel_swap := false;
    end if;

    return next;
  end loop;
end;
$$;

revoke execute on function public.aulas_do_aluno_base(uuid, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. As duas RPCs do aluno (mesma lista e ordem de colunas, § 12.2)
-- ----------------------------------------------------------------------------
create function public.aulas_do_aluno(p_de timestamptz, p_ate timestamptz)
returns table (
  class_id uuid,
  title text,
  type public.class_type,
  date_time timestamptz,
  group_id text,
  group_name text,
  audience public.class_audience,
  cancelled boolean,
  declared_status public.attendance_status,
  status public.attendance_status,
  justification_id uuid,
  justification_status public.justification_status,
  schedule_mode public.plan_schedule_mode,
  weekly_target smallint,
  marked_in_week int,
  can_justify boolean,
  justify_until timestamptz,
  can_contest boolean,
  contest_until timestamptz,
  teachers jsonb,
  origem text,
  is_recurring boolean,
  schedule_ends_on date,
  can_mark_extra boolean,
  can_swap_from boolean,
  can_swap_from_permanent boolean,
  can_swap_to boolean,
  swap_id uuid,
  swap_kind public.class_swap_kind,
  swap_status public.class_swap_status,
  swap_decided_via text,
  swap_role text,
  swap_other_class_id uuid,
  swap_other_date_time timestamptz,
  can_cancel_swap boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Operação negada: entre para ver as suas aulas.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate <= p_de then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  -- Sempre do próprio aluno (§ 12).
  return query
    select b.class_id, b.title, b.type, b.date_time, b.group_id, b.group_name, b.audience, b.cancelled, b.declared_status, b.status, b.justification_id, b.justification_status, b.schedule_mode, b.weekly_target, b.marked_in_week, b.can_justify, b.justify_until, b.can_contest, b.contest_until, b.teachers, b.origem, b.is_recurring, b.schedule_ends_on, b.can_mark_extra, b.can_swap_from, b.can_swap_from_permanent, b.can_swap_to, b.swap_id, b.swap_kind, b.swap_status, b.swap_decided_via, b.swap_role, b.swap_other_class_id, b.swap_other_date_time, b.can_cancel_swap
      from public.aulas_do_aluno_base((select auth.uid()), p_de, p_ate, now(), false) b;
end;
$$;

revoke execute on function public.aulas_do_aluno(timestamptz, timestamptz) from public, anon;
grant execute on function public.aulas_do_aluno(timestamptz, timestamptz) to authenticated;

create function public.menu_de_aulas(p_semana date, p_referencia timestamptz default now())
returns table (
  class_id uuid,
  title text,
  type public.class_type,
  date_time timestamptz,
  group_id text,
  group_name text,
  audience public.class_audience,
  cancelled boolean,
  declared_status public.attendance_status,
  status public.attendance_status,
  justification_id uuid,
  justification_status public.justification_status,
  schedule_mode public.plan_schedule_mode,
  weekly_target smallint,
  marked_in_week int,
  can_justify boolean,
  justify_until timestamptz,
  can_contest boolean,
  contest_until timestamptz,
  teachers jsonb,
  origem text,
  is_recurring boolean,
  schedule_ends_on date,
  can_mark_extra boolean,
  can_swap_from boolean,
  can_swap_from_permanent boolean,
  can_swap_to boolean,
  swap_id uuid,
  swap_kind public.class_swap_kind,
  swap_status public.class_swap_status,
  swap_decided_via text,
  swap_role text,
  swap_other_class_id uuid,
  swap_other_date_time timestamptz,
  can_cancel_swap boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_aluno   uuid := (select auth.uid());
  -- Só o sistema (os testes, em data fixa) escolhe o "agora"; quem vem pela API, não (§ 12.2).
  v_ref     timestamptz := case
    when coalesce(nullif(current_setting('role', true), 'none'), '') in ('authenticated', 'anon') then now()
    else coalesce(p_referencia, now())
  end;
  v_segunda date := date_trunc('week', p_semana)::date;
  v_atual   date := date_trunc('week', v_ref at time zone 'America/Sao_Paulo')::date;
begin
  if v_aluno is null or coalesce((select p.role from public.profiles p where p.id = v_aluno), 'admin') <> 'user' then
    raise exception 'Operação negada: o menu de aulas é só para alunos.' using errcode = '42501';
  end if;

  -- T43: esta semana ou a próxima.
  if p_semana is null or v_segunda not in (v_atual, v_atual + 7) then
    raise exception 'Escolha esta semana ou a próxima.' using errcode = '22023';
  end if;

  return query
    select b.class_id, b.title, b.type, b.date_time, b.group_id, b.group_name, b.audience, b.cancelled, b.declared_status, b.status, b.justification_id, b.justification_status, b.schedule_mode, b.weekly_target, b.marked_in_week, b.can_justify, b.justify_until, b.can_contest, b.contest_until, b.teachers, b.origem, b.is_recurring, b.schedule_ends_on, b.can_mark_extra, b.can_swap_from, b.can_swap_from_permanent, b.can_swap_to, b.swap_id, b.swap_kind, b.swap_status, b.swap_decided_via, b.swap_role, b.swap_other_class_id, b.swap_other_date_time, b.can_cancel_swap
      from public.aulas_do_aluno_base(
        v_aluno,
        v_segunda::timestamp at time zone 'America/Sao_Paulo',
        (v_segunda + 7)::timestamp at time zone 'America/Sao_Paulo',
        v_ref,
        true
      ) b;
end;
$$;

revoke execute on function public.menu_de_aulas(date, timestamptz) from public, anon;
grant execute on function public.menu_de_aulas(date, timestamptz) to authenticated;
