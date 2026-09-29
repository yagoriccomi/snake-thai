-- ============================================================================
-- Auditoria da Fase 4 (bloco 4.12): as correções do REVIEW-FASE4.md
--
-- A1  pode_decidir_justificativa: quem se inclui numa aula futura não lê o
--     atestado nem decide a justificativa dela (D22; a mesma regra da T18 e
--     da T49).
-- B1  A trava de classes passa a valer no INSERT (§ 6, § 0.1 regra 4).
-- B2  Horário com período de troca permanente não é apagado: o período é
--     histórico e apagá-lo mudaria a grade do passado (D49, T37).
-- B3  A trava de papel não trata o anon como "o sistema" (§ 0.1).
-- H1  Revokes que faltaram em funções reescritas (§ 0.1, regra 2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1
-- ----------------------------------------------------------------------------
create or replace function public.pode_decidir_justificativa(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.absence_justifications j
     where j.id = p_id
       and j.status = 'pending'
       and (
         -- De aula: a equipe da aula (D14) que já estava nela quando a
         -- justificativa chegou, ou a escalada no horário. O professor pode se
         -- incluir em qualquer aula futura; isso não dá acesso a atestado (D22).
         (j.scope = 'class' and (
            exists (
              select 1 from public.class_teachers ct
               where ct.class_id = j.class_id and ct.teacher_id = (select auth.uid())
                 and ct.created_at <= j.created_at)
            or exists (
              select 1
                from public.classes c
                join public.class_schedule_teachers cst on cst.schedule_id = c.schedule_id
               where c.id = j.class_id and cst.teacher_id = (select auth.uid()))))
         -- De semana: o professor com presença confirmada numa aula não
         -- cancelada daquela semana (T18).
         or (j.scope = 'week' and exists (
            select 1
              from public.class_teacher_presence tp
              join public.classes c on c.id = tp.class_id
             where tp.teacher_id = (select auth.uid())
               and tp.present
               and c.cancelled_at is null
               and c.date_time >= j.week_start::timestamp at time zone 'America/Sao_Paulo'
               and c.date_time < (j.week_start + 7)::timestamp at time zone 'America/Sao_Paulo'))
       )
  );
$$;

comment on function public.pode_decidir_justificativa(uuid) is
  '§ 9.1 (D14, D22, T18): pendente e da equipe da aula que já estava nela quando a justificativa chegou (ou escalada no horário), ou de quem deu aula na semana. O admin decide qualquer uma à parte.';

-- ----------------------------------------------------------------------------
-- B1
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
  -- "not (...)" abaixo deixaria passar (§ 0.1, regra 4).
  v_pela_rpc boolean := coalesce(current_setting('snake.aula_rpc', true), '') = 'on';
begin
  -- Aula nova nasce sem cancelamento e sem chamada: senão, o professor
  -- criaria uma aula já "concluída" que ninguém consegue apagar.
  if tg_op = 'INSERT' then
    if not (v_sistema or v_pela_rpc) and (
         new.cancelled_at is not null
         or new.attendance_taken_at is not null
         or coalesce(new.attendance_edited, false)
       ) then
      raise exception 'Operação negada: cancelamento e chamada só mudam pelas funções do aplicativo.'
        using errcode = '42501';
    end if;
    return new;
  end if;

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

drop trigger enforce_class_state_rules on public.classes;
create trigger enforce_class_state_rules
  before insert or update or delete on public.classes
  for each row execute function public.enforce_class_state_rules();

-- ----------------------------------------------------------------------------
-- B2: a FK deixa de apagar o período junto, e as duas funções que apagam
--     horário nunca usado deixam de fora o horário com período.
-- ----------------------------------------------------------------------------
alter table public.class_swap_periods
  drop constraint class_swap_periods_from_schedule_id_fkey,
  add constraint class_swap_periods_from_schedule_id_fkey
    foreign key (from_schedule_id) references public.class_schedules (id) on delete restrict,
  drop constraint class_swap_periods_to_schedule_id_fkey,
  add constraint class_swap_periods_to_schedule_id_fkey
    foreign key (to_schedule_id) references public.class_schedules (id) on delete restrict;

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
    -- Um período de troca permanente já aponta para este horário: apagá-lo
    -- levaria o período junto e mudaria a grade do passado (D49, T37).
    if exists (
      select 1 from public.class_swap_periods sp
       where p_id in (sp.from_schedule_id, sp.to_schedule_id)
    ) then
      raise exception 'Este horário tem troca permanente de aluno: encerre com uma data a partir de %.',
        to_char(v_atual.valid_from, 'DD/MM/YYYY') using errcode = '23514';
    end if;
    delete from public.class_schedules where id = p_id;
    v_acao := 'apagado';
  else
    update public.class_schedules set valid_until = p_ultimo_dia where id = p_id;
    v_acao := 'encerrado';
  end if;

  return jsonb_build_object('acao', v_acao, 'removidas', v_removidas);
end;
$funcao$;

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
       -- O período de troca que aponta para o horário é histórico (D49): o
       -- horário fica, só encerrado, e a turma arquivada não gera aula.
       and not exists (
         select 1 from public.class_swap_periods sp where s.id in (sp.from_schedule_id, sp.to_schedule_id)
       )
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
-- B3
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

  -- Sem sessão é migration, seed ou o servidor (service_role) montando dados;
  -- o anon também não tem uid e nunca é "o sistema" (§ 0.1).
  if (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon' then
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

-- ----------------------------------------------------------------------------
-- H1: funções reescritas sem o revoke da § 0.1 (regra 2) e grants de escrita
--     numa view que só se lê.
-- ----------------------------------------------------------------------------
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
revoke execute on function public.enforce_attendance_rules() from public, anon, authenticated;
revoke execute on function public.enforce_absence_justification_rules() from public, anon, authenticated;
revoke execute on function public.enfileirar_exclusao_de_anexo_justificativa() from public, anon, authenticated;
revoke execute on function public.enforce_class_teacher_is_professor() from public, anon, authenticated;
revoke execute on function public.enforce_class_state_rules() from public, anon, authenticated;
-- Só o cron chama (como postgres): ninguém de fora marca mensalidade vencida.
revoke execute on function public.mark_overdue_payments() from public, anon, authenticated;
revoke insert, update, delete on public.diretorio_perfis from authenticated;
