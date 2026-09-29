-- Regressão das correções da auditoria da Fase 4 (bloco 4.12, migration
-- 20260929220000_auditoria_fase4; REVIEW-FASE4.md). Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local.
--
-- F fixo da turma G (aula C daqui a 2 dias, professor P desde antes) · P2
-- professor que se inclui depois · A admin.
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('a4-g', 'A4 Turma G'), ('a4-g2', 'A4 Turma G2');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('dd000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'a4-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 4) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('dd000000-0000-4000-8000-000000000001', 'admin', 'A4 Admin', '64000000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('dd000000-0000-4000-8000-000000000002', 'professor', 'A4 Prof P', '64000000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('dd000000-0000-4000-8000-000000000003', 'professor', 'A4 Prof P2', '64000000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('dd000000-0000-4000-8000-000000000004', 'user', 'A4 Aluno F', '64000000004', false, 'active', 'a4-g', null, now() - interval '60 days');

insert into public.classes (id, title, type, group_id, date_time, audience) values
  ('ddc00000-0000-4000-8000-000000000001', 'A4 Aula C', 'routine', 'a4-g', now() + interval '2 days', 'both');
insert into public.class_teachers (class_id, teacher_id, created_at) values
  ('ddc00000-0000-4000-8000-000000000001', 'dd000000-0000-4000-8000-000000000002', now() - interval '1 day');

-- B2: um horário que nunca começou, destino de um período de troca.
insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from, audience) values
  ('ddd00000-0000-4000-8000-000000000001', 'a4-g', 'A4 HA', 1, '10:00', '2026-01-01', 'both'),
  ('ddd00000-0000-4000-8000-000000000002', 'a4-g2', 'A4 HB', 3, '10:00', current_date + 14, 'both');
insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
values ('dd000000-0000-4000-8000-000000000004', 'ddd00000-0000-4000-8000-000000000001',
        'ddd00000-0000-4000-8000-000000000002', now() - interval '5 days');

create temp table ctx (chave text primary key, id uuid) on commit drop;
grant select, insert on ctx to authenticated;

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- =====================================================================
-- A1 — quem se inclui depois não lê o atestado
-- =====================================================================
do $$
declare
  C constant uuid := 'ddc00000-0000-4000-8000-000000000001';
  n int;
begin
  perform pg_temp.como('dd000000-0000-4000-8000-000000000004');
  insert into ctx values ('just', public.enviar_justificativa('class', C, null, 'Atestado médico'));

  perform pg_temp.como('dd000000-0000-4000-8000-000000000003');
  -- Numa transação só o now() não anda: a inclusão "depois" vai um minuto à frente.
  insert into public.class_teachers (class_id, teacher_id, created_at)
  values (C, 'dd000000-0000-4000-8000-000000000003', now() + interval '1 minute');
  select count(*) into n from public.absence_justifications where class_id = C;
  if n <> 0 or public.pode_decidir_justificativa((select id from ctx where chave = 'just')) then
    raise exception 'FALHOU A1: quem se incluiu depois leu o atestado (D22)';
  end if;

  perform pg_temp.como('dd000000-0000-4000-8000-000000000002');
  select count(*) into n from public.absence_justifications where class_id = C;
  if n <> 1 then
    raise exception 'FALHOU A1: o professor que já estava na aula não lê a justificativa';
  end if;
  raise notice 'OK A1: incluir-se numa aula futura não dá acesso ao atestado';
end $$;

-- =====================================================================
-- B1 — aula nova não nasce cancelada nem com chamada
-- =====================================================================
do $$
begin
  perform pg_temp.como('dd000000-0000-4000-8000-000000000002');
  begin
    insert into public.classes (title, type, date_time, audience, attendance_taken_at, attendance_edited)
    values ('A4 Forjada', 'event', now() - interval '1 day', 'both', now(), true);
    raise exception 'FALHOU B1: aula criada já com chamada';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.classes (title, type, date_time, audience, cancelled_at)
    values ('A4 Forjada 2', 'event', now() + interval '1 day', 'both', now());
    raise exception 'FALHOU B1: aula criada já cancelada';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK B1: a trava de classes vale no INSERT';
end $$;

-- =====================================================================
-- B2 — o horário com período de troca não é apagado
-- =====================================================================
do $$
begin
  perform pg_temp.como('dd000000-0000-4000-8000-000000000001');
  begin
    perform public.encerrar_horario_da_grade('ddd00000-0000-4000-8000-000000000002', current_date);
    raise exception 'FALHOU B2: apagou horário com período de troca';
  exception when check_violation then null;
  end;
  perform public.excluir_turma('a4-g2', null, true);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  if not exists (select 1 from public.class_schedules where id = 'ddd00000-0000-4000-8000-000000000002')
     or not exists (select 1 from public.class_swap_periods where to_schedule_id = 'ddd00000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU B2: excluir a turma apagou o período de troca';
  end if;
  begin
    delete from public.class_schedules where id = 'ddd00000-0000-4000-8000-000000000002';
    raise exception 'FALHOU B2: a FK ainda apaga o período junto';
  exception when foreign_key_violation then null;
  end;
  raise notice 'OK B2: o período de troca é histórico e segura o horário';
end $$;

-- =====================================================================
-- B3 — o anon não é "o sistema" na trava de papel
-- =====================================================================
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    update public.profiles set role = 'professor', color = '#010203'
     where id = 'dd000000-0000-4000-8000-000000000004';
    raise exception 'FALHOU B3: a trava tratou o anon como o sistema';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'OK B3: aluno não muda de papel nem com a sessão anônima';
end $$;

-- =====================================================================
-- S1 — limite de envios (seguranca-projeto)
-- =====================================================================
set local role authenticated;

do $$
declare
  i int;
begin
  perform pg_temp.como('dd000000-0000-4000-8000-000000000004');
  for i in 1..20 loop
    perform public.criar_motivo('request_evidence', 'ddc00000-0000-4000-8000-000000000001', 'Motivo ' || i);
  end loop;
  begin
    perform public.criar_motivo('request_evidence', 'ddc00000-0000-4000-8000-000000000001', 'Mais um');
    raise exception 'FALHOU S1: motivo sem limite';
  exception when check_violation then null;
  end;
  raise notice 'OK S1: motivos de pedido com limite por hora';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- =====================================================================
-- H1 — permissões
-- =====================================================================
do $$
begin
  if has_function_privilege('anon', 'public.export_my_data()', 'execute')
     or has_function_privilege('anon', 'public.mark_overdue_payments()', 'execute')
     or has_function_privilege('authenticated', 'public.mark_overdue_payments()', 'execute')
     or has_table_privilege('authenticated', 'public.diretorio_perfis', 'update') then
    raise exception 'FALHOU H1: permissão que deveria ter sido revogada';
  end if;
  raise notice 'OK H1: export só para authenticated, vencidas só pelo cron, diretório só leitura';
end $$;

rollback;
