-- ============================================================================
-- Contrato v3 — as travas de aula, chamada e justificativa
-- (bloco 4.1, fatia 6b; § 6, § 7.1, § 9.1, § 15, T3, T8, T13, T17)
--
-- Daqui em diante, cancelamento, chamada e decisão de justificativa só mudam
-- pelas funções do banco. Para a chamada do APK 1.8 (e do app DEV) continuar
-- funcionando até o bloco 4.6, `salvar_chamada` e `concluir_chamada` ligam as
-- variáveis de sessão da § 0.1 em volta das próprias escritas: nenhuma regra
-- delas muda. A decisão de justificativa pelo APK 1.8 (`update({status})`)
-- passa a responder "Atualize o aplicativo" (§ 15), como o contrato prevê: o
-- caminho novo é o `decidir_justificativa` do bloco 4.8.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Plano da semana (T3, T5) e cota proporcional (T8) — internas
-- ----------------------------------------------------------------------------
create function public.plano_da_semana(p_user_id uuid, p_segunda date)
returns table (plan_id uuid, schedule_mode public.plan_schedule_mode, weekly_quota smallint, inicio_na_semana timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias smallint[];
  v_instante timestamptz;
  v_inicio_da_semana timestamptz := p_segunda::timestamp at time zone 'America/Sao_Paulo';
begin
  select class_weekdays into v_dias from public.academy_settings limit 1;
  -- 0 = domingo; a semana vai de segunda (0 dias) a domingo (6 dias).
  select (p_segunda + min(((d + 6) % 7))::int)::timestamp at time zone 'America/Sao_Paulo' into v_instante
    from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d;

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

comment on function public.plano_da_semana(uuid, date) is
  'O plano que vale para o aluno na semana (T3): o aberto às 00:00 (SP) do primeiro dia de aula, ou o primeiro que começou dentro da semana (inicio_na_semana preenchido). Sem linha = sem plano (fixo, T5). Interna.';

revoke execute on function public.plano_da_semana(uuid, date) from public, anon, authenticated;

-- Mesma assinatura da fatia 6a: agora lê a regra de um lugar só.
create or replace function public.modalidade_da_semana(p_user_id uuid, p_segunda date)
returns public.plan_schedule_mode
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ps.schedule_mode from public.plano_da_semana(p_user_id, p_segunda) ps),
    'fixed'::public.plan_schedule_mode
  );
$$;

-- Cota do livre na semana (T3, T8): ⌊cota × dias de aula em que ele esteve
-- ativo em algum momento do dia ÷ dias de aula da semana⌋. Com o plano
-- começando no meio da semana, só contam os dias a partir do início dele.
-- Nula para quem não é livre na semana.
create function public.cota_da_semana(p_user_id uuid, p_segunda date)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plano record;
  v_dias smallint[];
  v_total int := 0;
  v_ativos int := 0;
  v_dia date;
  v_inicio_do_dia timestamptz;
  v_fim_do_dia timestamptz;
begin
  select * into v_plano from public.plano_da_semana(p_user_id, p_segunda);
  if not found or v_plano.schedule_mode <> 'free' then
    return null;
  end if;

  select class_weekdays into v_dias from public.academy_settings limit 1;
  for v_dia in
    select p_segunda + ((d + 6) % 7)::int
      from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d
  loop
    v_total := v_total + 1;
    v_inicio_do_dia := v_dia::timestamp at time zone 'America/Sao_Paulo';
    v_fim_do_dia := (v_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
    if v_plano.inicio_na_semana is not null and v_fim_do_dia <= v_plano.inicio_na_semana then
      continue;
    end if;
    -- Ativo em algum momento do dia = nenhum trancamento cobre o dia inteiro.
    if not exists (
      select 1 from public.inactive_periods ip
       where ip.user_id = p_user_id
         and ip.started_at <= v_inicio_do_dia
         and (ip.ended_at is null or ip.ended_at >= v_fim_do_dia)
    ) then
      v_ativos := v_ativos + 1;
    end if;
  end loop;

  if v_total = 0 then
    return 0;
  end if;
  return floor(v_plano.weekly_quota::numeric * v_ativos / v_total)::smallint;
end;
$$;

revoke execute on function public.cota_da_semana(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Aula: cancelamento e chamada só pelas RPCs; aula com chamada fica
--    imutável e não é apagada (§ 6)
-- ----------------------------------------------------------------------------
create function public.enforce_class_state_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  v_pela_rpc boolean := current_setting('snake.aula_rpc', true) = 'on';
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

revoke execute on function public.enforce_class_state_rules() from public, anon, authenticated;

create trigger enforce_class_state_rules
  before update or delete on public.classes
  for each row execute function public.enforce_class_state_rules();

-- ----------------------------------------------------------------------------
-- 3. Equipe da aula: aula cancelada só o admin mexe; aula já iniciada só pela
--    chamada (§ 6)
-- ----------------------------------------------------------------------------
create function public.enforce_class_teacher_state_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula record;
  v_class_id uuid := coalesce(new.class_id, old.class_id);
begin
  if (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon' then
    return coalesce(new, old);
  end if;

  select c.cancelled_at, c.date_time into v_aula from public.classes c where c.id = v_class_id;
  if not found then
    -- Cascata: a aula já não existe.
    return coalesce(new, old);
  end if;

  if v_aula.cancelled_at is not null and not public.is_admin() then
    raise exception 'Aula cancelada.' using errcode = '23514';
  end if;

  if v_aula.date_time <= now() and coalesce(current_setting('snake.chamada_rpc', true), 'off') <> 'on' then
    raise exception 'A equipe de uma aula que já começou só muda pela chamada.' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.enforce_class_teacher_state_rules() from public, anon, authenticated;

create trigger enforce_class_teacher_state_rules
  before insert or delete on public.class_teachers
  for each row execute function public.enforce_class_teacher_state_rules();

-- ----------------------------------------------------------------------------
-- 4. Chamada: status, edited e included só pelas RPCs; o aluno só declara
--    (§ 7.1)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_attendance_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  colunas_do_aluno constant text[] := array['declared_status', 'declared_at', 'updated_at'];
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  v_pela_rpc boolean := current_setting('snake.chamada_rpc', true) = 'on';
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
    if new.status is not null or new.edited or new.included then
      raise exception 'Operação negada: a presença só é confirmada pela chamada do professor.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.edited is distinct from old.edited
     or new.included is distinct from old.included then
    raise exception 'Operação negada: a presença só é confirmada pela chamada do professor.'
      using errcode = '42501';
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

drop trigger trg_attendance_enforce_rules on public.attendance;
create trigger trg_attendance_enforce_rules
  before insert or update or delete on public.attendance
  for each row execute function public.enforce_attendance_rules();

-- Apagar presença deixa de ser direto: só pela chamada (§ 7.1).
drop policy attendance_delete_admin_or_teacher on public.attendance;

-- ----------------------------------------------------------------------------
-- 5. Compatibilidade: a chamada do APK 1.8 continua funcionando (§ 15)
--
-- Mesmas regras de antes; só ligam as variáveis em volta das próprias
-- escritas e as desligam antes de voltar (o pg_graphql roda várias mutations
-- na mesma transação). Tudo o mais da § 15 (T47, público 'free', retificação)
-- entra no bloco 4.6.
-- ----------------------------------------------------------------------------
create or replace function public.salvar_chamada(p_class_id uuid, p_presentes uuid[], p_ausentes uuid[])
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
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

  perform set_config('snake.chamada_rpc', 'on', true);
  perform set_config('snake.aula_rpc', 'on', true);

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

  perform set_config('snake.chamada_rpc', 'off', true);
  perform set_config('snake.aula_rpc', 'off', true);
  return v_concluida;
end;
$$;

create or replace function public.concluir_chamada(p_class_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
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

  perform set_config('snake.aula_rpc', 'on', true);
  update public.classes set attendance_taken_at = now() where id = p_class_id;
  perform set_config('snake.aula_rpc', 'off', true);
  return now();
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Justificativa: reescrita da trava (§ 9.1, D13, D15, D39, D42, T16–T17, T38)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_absence_justification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  colunas_do_dono constant text[] := array['message', 'proof_provider', 'proof_public_id', 'updated_at'];
  v_uid uuid := (select auth.uid());
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  v_aula record;
  v_dias smallint[];
  v_ultimo_dia date;
  v_cota smallint;
  coluna text;
begin
  -- (i) DELETE: só o dono, com a linha pendente. Decidida fica (D15).
  if tg_op = 'DELETE' then
    if v_sistema
       or not exists (select 1 from public.profiles p where p.id = old.user_id)
       or (old.class_id is not null and not exists (select 1 from public.classes c where c.id = old.class_id)) then
      return old;
    end if;
    if old.user_id <> v_uid or old.status <> 'pending' then
      raise exception 'Operação negada: só o aluno apaga a própria justificativa, enquanto ela está em análise.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- A semana da justificativa de aula é a da aula, qualquer que seja o valor
  -- enviado: é o que mantém o upsert do APK 1.8 e da web atual funcionando.
  if tg_op = 'INSERT' and new.scope = 'class' then
    select c.type, c.date_time, c.cancelled_at into v_aula from public.classes c where c.id = new.class_id;
    new.week_start := date_trunc('week', v_aula.date_time at time zone 'America/Sao_Paulo')::date;
  end if;

  if v_sistema then
    return new;
  end if;

  -- INSERT ------------------------------------------------------------------
  if tg_op = 'INSERT' then
    -- (e) só a própria, e sempre pendente, tentativa 1.
    if new.user_id is distinct from v_uid then
      raise exception 'Operação negada: cada aluno envia só a própria justificativa.' using errcode = '42501';
    end if;
    if new.status <> 'pending' or new.attempt <> 1 or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Operação negada: justificativa nasce pendente de revisão.' using errcode = '42501';
    end if;

    if new.scope = 'class' then
      -- (c) aula de rotina, não cancelada, da grade efetiva do fixo.
      if v_aula.type is distinct from 'routine' then
        raise exception 'Só aula de rotina tem justificativa.' using errcode = '23514';
      end if;
      if v_aula.cancelled_at is not null then
        raise exception 'Aula cancelada.' using errcode = '23514';
      end if;
      -- T38: a original de uma troca pendente ou aprovada não se justifica.
      if exists (
        select 1 from public.class_swaps s
         where s.user_id = new.user_id and s.kind = 'once'
           and s.from_class_id = new.class_id and s.status in ('pending', 'approved')
      ) then
        raise exception 'Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova.'
          using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.grade_efetiva_do_fixo(array[new.user_id], v_aula.date_time, v_aula.date_time + interval '1 microsecond') g
         where g.class_id = new.class_id
      ) then
        raise exception 'Só dá para justificar uma aula da sua grade.' using errcode = '23514';
      end if;
      -- (b) D13: até 23:59 (SP) do 7º dia depois da aula.
      if now() >= ((v_aula.date_time at time zone 'America/Sao_Paulo')::date + 8)::timestamp at time zone 'America/Sao_Paulo' then
        raise exception 'O prazo para justificar esta aula terminou.' using errcode = '23514';
      end if;
      return new;
    end if;

    -- (d) semana: só o livre (o à vontade não justifica, D39).
    if new.week_start is null
       or extract(isodow from new.week_start) <> 1
       or new.week_start > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Informe a segunda-feira de uma semana que já começou.' using errcode = '22023';
    end if;
    if public.modalidade_da_semana(new.user_id, new.week_start) <> 'free' then
      raise exception 'Justificativa por semana é só para alunos de horário livre.' using errcode = '23514';
    end if;
    -- (b) D13: até 23:59 (SP) do 7º dia depois do último dia de aula da semana.
    select class_weekdays into v_dias from public.academy_settings limit 1;
    select new.week_start + max(((d + 6) % 7))::int into v_ultimo_dia
      from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d;
    if now() >= ((v_ultimo_dia + 8)::timestamp at time zone 'America/Sao_Paulo') then
      raise exception 'O prazo para justificar esta semana terminou.' using errcode = '23514';
    end if;
    -- T17: no máximo cota_W por semana, contando as negadas.
    v_cota := coalesce(public.cota_da_semana(new.user_id, new.week_start), 0);
    if (select count(*) from public.absence_justifications j
         where j.user_id = new.user_id and j.scope = 'week' and j.week_start = new.week_start) >= v_cota then
      raise exception 'Você já enviou as justificativas que cabem nesta semana.' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  -- (h) decisão por update direto (APK 1.8): o caminho é decidir_justificativa (4.8).
  if new.status is distinct from old.status then
    raise exception 'Atualize o aplicativo para decidir justificativas.' using errcode = '22023';
  end if;

  -- (g) decidida não muda por update direto, nem para o admin.
  if old.status <> 'pending' then
    raise exception 'Operação negada: justificativa já decidida não pode ser alterada.' using errcode = '42501';
  end if;

  -- (f) pendente: só o dono, e só o texto e o anexo.
  if old.user_id is distinct from v_uid then
    raise exception 'Operação negada: só o aluno altera a própria justificativa.' using errcode = '42501';
  end if;
  for coluna in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) -> coluna) is distinct from (to_jsonb(new) -> coluna)
       and not (coluna = any (colunas_do_dono)) then
      raise exception 'Operação negada: na justificativa, o aluno só altera o texto e o anexo (coluna "%").', coluna
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger trg_absence_justifications_enforce_rules on public.absence_justifications;
create trigger trg_absence_justifications_enforce_rules
  before insert or update or delete on public.absence_justifications
  for each row execute function public.enforce_absence_justification_rules();

-- (e) e (i): INSERT só a própria; DELETE só a própria pendente.
drop policy absence_justifications_insert_own_or_admin on public.absence_justifications;
create policy absence_justifications_insert_own on public.absence_justifications
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy absence_justifications_delete_own_pending_or_admin on public.absence_justifications;
create policy absence_justifications_delete_own_pending on public.absence_justifications
  for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'pending');

-- A semana, preenchida pelo gatilho desde o INSERT e pelo backfill da fatia 2.
alter table public.absence_justifications
  alter column week_start set not null;
