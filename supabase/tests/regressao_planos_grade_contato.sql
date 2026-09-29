-- Regressão do bloco 4.3 — planos, grade, dias de aula e contato (migration
-- 20260929110000, contrato v4 § 5, § 5.4, § 6, T3, T7, T37, T39). Roda numa
-- transação e termina em ROLLBACK; rode SÓ no banco local (scripts\db-dev test).
--
-- Numa transação, now() é o mesmo instante: uma mudança feita duas vezes
-- "desfaz antes de valer" (o período é apagado, não fechado).
--
--   ADM admin · PROF professor · FIX aluno fixo (com trocas) · TRC aluno que tranca
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa (como sistema)
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d4300000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'grade43-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04']) as n;

insert into public.groups (id, name) values ('g43-a', 'Turma 4.3 A'), ('g43-b', 'Turma 4.3 B');

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota) values
  ('d4300000-0000-4000-8000-00000000a001', 'Fixo 4.3', 10000, 'fixed', null),
  ('d4300000-0000-4000-8000-00000000a002', 'Livre 4.3', 10000, 'free', 3),
  ('d4300000-0000-4000-8000-00000000a003', 'À vontade 4.3', 10000, 'unlimited', null);

insert into public.profiles (id, role, name, cpf, is_first_login, status, color, group_id, plan_id, created_at, group_since) values
  ('d4300000-0000-4000-8000-000000000001','admin','Admin 4.3','43000000001',false,'active',null,null,null, now() - interval '90 days', null),
  ('d4300000-0000-4000-8000-000000000002','professor','Prof 4.3','43000000002',false,'active','#38BDF8',null,null, now() - interval '90 days', null),
  ('d4300000-0000-4000-8000-000000000003','user','Aluno Fixo 4.3','43000000003',false,'active',null,'g43-a','d4300000-0000-4000-8000-00000000a001', now() - interval '90 days', now() - interval '90 days'),
  ('d4300000-0000-4000-8000-000000000004','user','Aluno Tranca 4.3','43000000004',false,'active',null,'g43-a',null, now() - interval '90 days', now() - interval '90 days');

insert into public.academy_settings (id) values (true) on conflict (id) do nothing;
update public.academy_settings set contact_whatsapp = '5511912345678', contact_email = 'contato@exemplo.com';

-- Dois horários da turma A (origem e destino de uma troca permanente) e as aulas.
insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from) values
  ('d4300000-0000-4000-8000-00000000b001', 'g43-a', 'Origem 4.3', 1, time '19:00', current_date - 60),
  ('d4300000-0000-4000-8000-00000000b002', 'g43-a', 'Destino 4.3', 3, time '19:00', current_date - 60);

insert into public.classes (id, title, type, date_time, group_id) values
  ('d4300000-0000-4000-8000-00000000c001', 'Passada 4.3', 'routine', now() - interval '20 days', 'g43-a'),
  ('d4300000-0000-4000-8000-00000000c002', 'Daqui a 3 semanas 4.3', 'routine', now() + interval '21 days', 'g43-a'),
  ('d4300000-0000-4000-8000-00000000c003', 'Nova 4.3', 'routine', now() + interval '22 days', 'g43-a'),
  ('d4300000-0000-4000-8000-00000000c004', 'Reposição 4.3', 'routine', now() + interval '2 days', 'g43-a');

insert into public.action_reasons (id, kind, body) values
  ('d4300000-0000-4000-8000-00000000f001', 'class_swap_evidence', 'Mudei de emprego'),
  ('d4300000-0000-4000-8000-00000000f002', 'class_swap_evidence', 'Horário novo da faculdade');

-- Período permanente vigente (origem -> destino) e as trocas do aluno fixo.
insert into public.class_swap_periods (id, user_id, from_schedule_id, to_schedule_id, started_at) values
  ('d4300000-0000-4000-8000-00000000d001', 'd4300000-0000-4000-8000-000000000003',
   'd4300000-0000-4000-8000-00000000b001', 'd4300000-0000-4000-8000-00000000b002', now() - interval '30 days');

insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, from_schedule_id, to_schedule_id, motivo_id, status) values
  ('d4300000-0000-4000-8000-00000000e001', 'd4300000-0000-4000-8000-000000000003', 'permanent',
   'd4300000-0000-4000-8000-00000000c002', 'd4300000-0000-4000-8000-00000000c003',
   'd4300000-0000-4000-8000-00000000b001', 'd4300000-0000-4000-8000-00000000b002',
   'd4300000-0000-4000-8000-00000000f001', 'pending');
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status) values
  ('d4300000-0000-4000-8000-00000000e002', 'd4300000-0000-4000-8000-000000000003', 'once',
   'd4300000-0000-4000-8000-00000000c002', 'd4300000-0000-4000-8000-00000000c003', 'pending');
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at) values
  ('d4300000-0000-4000-8000-00000000e003', 'd4300000-0000-4000-8000-000000000003', 'once',
   'd4300000-0000-4000-8000-00000000c001', 'd4300000-0000-4000-8000-00000000c004', 'approved', 'review', now() - interval '19 days');

-- =====================================================================
-- B1 — histórico de plano: fecha o aberto e abre o novo; duas mudanças no
--      mesmo instante apagam a que não chegou a valer
-- =====================================================================
do $$
begin
  if (select count(*) from public.plan_periods where user_id = 'd4300000-0000-4000-8000-000000000003') <> 1 then
    raise exception 'FALHOU B1: o cadastro com plano não abriu o período';
  end if;
  update public.profiles set plan_id = 'd4300000-0000-4000-8000-00000000a003' where id = 'd4300000-0000-4000-8000-000000000004';
  update public.profiles set plan_id = null where id = 'd4300000-0000-4000-8000-000000000004';
  if exists (select 1 from public.plan_periods where user_id = 'd4300000-0000-4000-8000-000000000004') then
    raise exception 'FALHOU B1: a mudança desfeita no mesmo instante deixou período';
  end if;
  raise notice 'OK B1: cadastro abre o período; mudança desfeita antes de valer não deixa rastro';
end $$;

-- =====================================================================
-- B2 — deixar de ser fixo (T39): período encerrado no 1º dia de aula da
--      1ª semana não fixa (nunca no passado); permanente pendente e avulsa
--      da semana não fixa canceladas; a avulsa de semana já passada segue
-- =====================================================================
update public.profiles set plan_id = 'd4300000-0000-4000-8000-00000000a002'
 where id = 'd4300000-0000-4000-8000-000000000003';

do $$
declare
  v_periodo public.class_swap_periods%rowtype;
  v_segunda date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  v_esperado timestamptz;
begin
  v_esperado := public.inicio_da_semana_de_aula(v_segunda);
  if v_esperado < now() then
    v_esperado := public.inicio_da_semana_de_aula(v_segunda + 7);
  end if;

  select * into v_periodo from public.class_swap_periods where id = 'd4300000-0000-4000-8000-00000000d001';
  if v_periodo.end_reason is distinct from 'plan_changed' or v_periodo.ended_at <> v_esperado or v_periodo.ended_at < now() then
    raise exception 'FALHOU B2: período % / % (esperado % / plan_changed)', v_periodo.ended_at, v_periodo.end_reason, v_esperado;
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e001') <> 'cancelled'
     or (select decided_via from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e001') <> 'system' then
    raise exception 'FALHOU B2: a permanente pendente não foi cancelada pelo sistema';
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e002') <> 'cancelled' then
    raise exception 'FALHOU B2: a avulsa da semana não fixa continuou';
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e003') <> 'approved' then
    raise exception 'FALHOU B2: a avulsa de uma semana que já passou foi mexida';
  end if;
  raise notice 'OK B2: deixar de ser fixo encerra o período no 1º dia de aula da semana não fixa e cancela as trocas dela';
end $$;

-- =====================================================================
-- B3 — voltou a fixo antes de a semana não fixa começar: o período volta
-- =====================================================================
update public.profiles set plan_id = 'd4300000-0000-4000-8000-00000000a001'
 where id = 'd4300000-0000-4000-8000-000000000003';

do $$
begin
  if exists (select 1 from public.class_swap_periods
              where id = 'd4300000-0000-4000-8000-00000000d001' and (ended_at is not null or end_reason is not null)) then
    raise exception 'FALHOU B3: o período não voltou a valer';
  end if;
  raise notice 'OK B3: voltar a fixo antes da semana não fixa devolve o período';
end $$;

-- =====================================================================
-- B4 — trancamento: abre o período inativo e cancela as pendentes; a
--      aprovada e o período permanente seguem
-- =====================================================================
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, from_schedule_id, to_schedule_id, motivo_id, status) values
  ('d4300000-0000-4000-8000-00000000e004', 'd4300000-0000-4000-8000-000000000003', 'permanent',
   'd4300000-0000-4000-8000-00000000c002', 'd4300000-0000-4000-8000-00000000c003',
   'd4300000-0000-4000-8000-00000000b001', 'd4300000-0000-4000-8000-00000000b002',
   'd4300000-0000-4000-8000-00000000f002', 'pending');

update public.profiles set status = 'inactive', deactivated_at = now()
 where id = 'd4300000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (select 1 from public.inactive_periods
                  where user_id = 'd4300000-0000-4000-8000-000000000003' and ended_at is null) then
    raise exception 'FALHOU B4: trancar não abriu o período inativo';
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e004') <> 'cancelled' then
    raise exception 'FALHOU B4: a permanente pendente continuou';
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e003') <> 'approved'
     or exists (select 1 from public.class_swap_periods where id = 'd4300000-0000-4000-8000-00000000d001' and ended_at is not null) then
    raise exception 'FALHOU B4: trancar mexeu na aprovada ou no período';
  end if;
  raise notice 'OK B4: trancar abre o período inativo e cancela só as pendentes';
end $$;

update public.profiles set status = 'active', deactivated_at = null
 where id = 'd4300000-0000-4000-8000-000000000003';

do $$
begin
  if exists (select 1 from public.inactive_periods where user_id = 'd4300000-0000-4000-8000-000000000003') then
    raise exception 'FALHOU B4b: reativar no mesmo instante deixou o período inativo';
  end if;
  raise notice 'OK B4b: reativar fecha o período (no mesmo instante, apaga)';
end $$;

-- =====================================================================
-- B5 — horário "só livres" sem turma gera aula; sem turma e para fixos é recusado
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  v_resultado jsonb;
  v_horario uuid;
begin
  v_resultado := public.salvar_horario_da_grade(
    p_group_id => null, p_title => 'Treino livre 4.3',
    p_weekday => extract(dow from (now() at time zone 'America/Sao_Paulo') + interval '2 days')::smallint,
    p_start_time => time '12:00', p_valid_from => (now() at time zone 'America/Sao_Paulo')::date,
    p_audience => 'free');
  v_horario := (v_resultado ->> 'schedule_id')::uuid;

  if (select audience from public.class_schedules where id = v_horario) <> 'free' then
    raise exception 'FALHOU B5: o horário não guardou o público';
  end if;
  if not exists (select 1 from public.classes where schedule_id = v_horario and group_id is null and audience = 'free') then
    raise exception 'FALHOU B5: o horário sem turma não gerou aula só para livres';
  end if;

  begin
    perform public.salvar_horario_da_grade(
      p_group_id => null, p_title => 'Sem turma para fixos',
      p_weekday => 2::smallint, p_start_time => time '07:00',
      p_valid_from => (now() at time zone 'America/Sao_Paulo')::date, p_audience => 'both');
    raise exception 'FALHOU B5: horário de fixos sem turma foi aceito';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK B5: horário só livres sem turma gera aula; de fixos sem turma é recusado';
end $$;

-- =====================================================================
-- B6 — público: nulo na criação vira 'both'; na edição, mantém; o novo
--      propaga às aulas futuras sem chamada e nunca à cancelada
-- =====================================================================
do $$
declare
  v_horario uuid;
  v_dia smallint := extract(dow from (now() at time zone 'America/Sao_Paulo') + interval '3 days')::smallint;
  v_cancelada uuid;
begin
  v_horario := (public.salvar_horario_da_grade(
    'g43-b', 'Turma B 4.3', v_dia, time '20:00', (now() at time zone 'America/Sao_Paulo')::date) ->> 'schedule_id')::uuid;
  if (select audience from public.class_schedules where id = v_horario) <> 'both' then
    raise exception 'FALHOU B6: criação sem público não virou both';
  end if;

  -- Uma das aulas é cancelada (pelo sistema, como o 4.7 fará pela RPC).
  select id into v_cancelada from public.classes where schedule_id = v_horario order by date_time limit 1;
  perform set_config('snake.aula_rpc', 'on', true);
  update public.classes set cancelled_at = now() where id = v_cancelada;
  perform set_config('snake.aula_rpc', 'off', true);

  perform public.salvar_horario_da_grade(
    'g43-b', 'Turma B 4.3', v_dia, time '20:00', (now() at time zone 'America/Sao_Paulo')::date,
    '{}'::uuid[], null, v_horario, 'fixed');
  if exists (select 1 from public.classes where schedule_id = v_horario and cancelled_at is null and audience <> 'fixed') then
    raise exception 'FALHOU B6: o público novo não propagou';
  end if;
  if (select audience from public.classes where id = v_cancelada) <> 'both' then
    raise exception 'FALHOU B6: a aula cancelada foi alterada';
  end if;

  perform public.salvar_horario_da_grade(
    'g43-b', 'Turma B 4.3 (novo título)', v_dia, time '20:00', (now() at time zone 'America/Sao_Paulo')::date,
    '{}'::uuid[], null, v_horario);
  if (select audience from public.class_schedules where id = v_horario) <> 'fixed' then
    raise exception 'FALHOU B6: a edição sem público não manteve o atual';
  end if;
  raise notice 'OK B6: público padrão, mantido na edição, propagado sem tocar a aula cancelada';
end $$;

-- =====================================================================
-- B7 — fim de horário (salvar): encerra o período de destino no dia
--      seguinte ao último dia e cancela a permanente pendente; fim retirado
--      devolve o período
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
with r as (
  insert into public.action_reasons (kind, body) values ('class_swap_evidence', 'Outro motivo') returning id
)
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, from_schedule_id, to_schedule_id, motivo_id, status)
select 'd4300000-0000-4000-8000-00000000e005', 'd4300000-0000-4000-8000-000000000004', 'permanent',
       'd4300000-0000-4000-8000-00000000c002', 'd4300000-0000-4000-8000-00000000c003',
       'd4300000-0000-4000-8000-00000000b001', 'd4300000-0000-4000-8000-00000000b002', r.id, 'pending'
  from r;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
  perform public.salvar_horario_da_grade(
    'g43-a', 'Destino 4.3', 3::smallint, time '19:00', current_date - 60,
    '{}'::uuid[], (now() at time zone 'America/Sao_Paulo')::date + 10, 'd4300000-0000-4000-8000-00000000b002');
end $$;

-- class_swap_periods não tem grant para authenticated: confere como sistema.
reset role;
set local request.jwt.claims = '{}';
do $$
declare
  v_ultimo date := (now() at time zone 'America/Sao_Paulo')::date + 10;
  v_periodo public.class_swap_periods%rowtype;
begin
  select * into v_periodo from public.class_swap_periods where id = 'd4300000-0000-4000-8000-00000000d001';
  if v_periodo.end_reason is distinct from 'schedule_ended'
     or v_periodo.ended_at <> ((v_ultimo + 1)::timestamp at time zone 'America/Sao_Paulo') then
    raise exception 'FALHOU B7: período % / %', v_periodo.ended_at, v_periodo.end_reason;
  end if;
  if (select status from public.class_swaps where id = 'd4300000-0000-4000-8000-00000000e005') <> 'cancelled' then
    raise exception 'FALHOU B7: a permanente pendente do horário continuou';
  end if;
  raise notice 'OK B7: fim de horário encerra no dia seguinte ao último dia e cancela a pendente';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.salvar_horario_da_grade(
    'g43-a', 'Destino 4.3', 3::smallint, time '19:00', current_date - 60,
    '{}'::uuid[], null, 'd4300000-0000-4000-8000-00000000b002');
end $$;

reset role;
set local request.jwt.claims = '{}';
do $$
begin
  if exists (select 1 from public.class_swap_periods
              where id = 'd4300000-0000-4000-8000-00000000d001' and ended_at is not null) then
    raise exception 'FALHOU B7b: fim retirado não devolveu o período';
  end if;
  raise notice 'OK B7b: fim retirado devolve o período';
end $$;

-- =====================================================================
-- B8 — encerrar com último dia ontem: o período nunca termina no passado
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.encerrar_horario_da_grade('d4300000-0000-4000-8000-00000000b002',
                                          (now() at time zone 'America/Sao_Paulo')::date - 1);
end $$;

reset role;
set local request.jwt.claims = '{}';
do $$
declare
  v_periodo public.class_swap_periods%rowtype;
begin
  select * into v_periodo from public.class_swap_periods where id = 'd4300000-0000-4000-8000-00000000d001';
  if v_periodo.end_reason is distinct from 'schedule_ended' or v_periodo.ended_at < now() then
    raise exception 'FALHOU B8: período % / % (não pode ser antes de agora)', v_periodo.ended_at, v_periodo.end_reason;
  end if;
  raise notice 'OK B8: encerrar com último dia no passado encerra o período agora, nunca antes';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';

-- =====================================================================
-- B9 — trocas_permanentes_do_horario: só admin; vigentes agora
-- =====================================================================
do $$
begin
  -- O período termina "agora" (B8): pelo T37, já não é vigente.
  if exists (select 1 from public.trocas_permanentes_do_horario('d4300000-0000-4000-8000-00000000b002')) then
    raise exception 'FALHOU B9: período encerrado agora ainda aparece como vigente';
  end if;
  raise notice 'OK B9: só os vigentes aparecem';
end $$;

reset role;
set local request.jwt.claims = '{}';
insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at) values
  ('d4300000-0000-4000-8000-000000000004', 'd4300000-0000-4000-8000-00000000b001',
   'd4300000-0000-4000-8000-00000000b002', now() - interval '1 day');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.trocas_permanentes_do_horario('d4300000-0000-4000-8000-00000000b001') where papel = 'origem') <> 1 then
    raise exception 'FALHOU B9: o admin não vê a troca de origem';
  end if;
  raise notice 'OK B9b: o admin vê quem tem troca permanente com o horário (origem ou destino)';
end $$;

set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform 1 from public.trocas_permanentes_do_horario('d4300000-0000-4000-8000-00000000b001');
    raise exception 'FALHOU B9: professor viu as trocas do horário';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK B9c: professor recebe 42501';
end $$;

-- =====================================================================
-- B10 — contato_da_academia: qualquer pessoa logada; anon não
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if public.contato_da_academia() <> '{"email": "contato@exemplo.com", "whatsapp": "5511912345678"}'::jsonb then
    raise exception 'FALHOU B10: contato %', public.contato_da_academia();
  end if;
  raise notice 'OK B10: aluno lê o contato da academia';
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform public.contato_da_academia();
    raise exception 'FALHOU B10: anon leu o contato';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK B10b: anon recebe 42501 (a tela de login não lê o contato)';
end $$;

-- =====================================================================
-- B11 — excluir turma não apaga a aula cancelada
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
insert into public.classes (id, title, type, date_time, group_id, cancelled_at) values
  ('d4300000-0000-4000-8000-00000000c009', 'Cancelada 4.3', 'routine', now() + interval '5 days', 'g43-b', now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4300000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.excluir_turma('g43-b', null, true);
  if not exists (select 1 from public.classes where id = 'd4300000-0000-4000-8000-00000000c009') then
    raise exception 'FALHOU B11: a aula cancelada foi apagada';
  end if;
  raise notice 'OK B11: excluir turma deixa a aula cancelada como registro';
end $$;

rollback;
