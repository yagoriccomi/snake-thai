-- Regressão do bloco 4.4 — aulas do aluno, menu de aulas, extra e meta
-- (migration 20260929120000, contrato v4 § 5.3, § 9.2, § 9.5, § 12, § 12.2).
-- Roda numa transação e termina em ROLLBACK; rode SÓ no banco local.
--
-- As aulas são todas de AMANHÃ (SP), em horas fixas: ficam na mesma semana e
-- nunca começaram. FIX fixo da turma A (sem plano, T5) · LIV livre 1x ·
-- VON à vontade · PROF professor · ADM admin.
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- S0 — sessão nova (nenhuma variável snake.* ligada): as travas valem.
--      Tem de vir ANTES de qualquer set_config nesta transação.
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d4400000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'aulas44-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04','05','06']) as n;

insert into public.groups (id, name) values ('g44-a', 'Turma 4.4 A'), ('g44-b', 'Turma 4.4 B');

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota) values
  ('d4400000-0000-4000-8000-00000000a001', 'Livre 1x (4.4)', 10000, 'free', 1),
  ('d4400000-0000-4000-8000-00000000a002', 'À vontade (4.4)', 10000, 'unlimited', null);

insert into public.profiles (id, role, name, cpf, is_first_login, status, color, group_id, plan_id, created_at, group_since) values
  ('d4400000-0000-4000-8000-000000000001','admin','Admin 4.4','44000000001',false,'active',null,null,null, now() - interval '90 days', null),
  ('d4400000-0000-4000-8000-000000000002','professor','Prof 4.4','44000000002',false,'active','#38BDF8',null,null, now() - interval '90 days', null),
  ('d4400000-0000-4000-8000-000000000003','user','Fixo 4.4','44000000003',false,'active',null,'g44-a',null, now() - interval '90 days', now() - interval '90 days'),
  ('d4400000-0000-4000-8000-000000000004','user','Livre 4.4','44000000004',false,'active',null,null,'d4400000-0000-4000-8000-00000000a001', now() - interval '90 days', null),
  ('d4400000-0000-4000-8000-000000000005','user','Vontade 4.4','44000000005',false,'active',null,null,'d4400000-0000-4000-8000-00000000a002', now() - interval '90 days', null),
  ('d4400000-0000-4000-8000-000000000006','user','Outro fixo 4.4','44000000006',false,'active',null,'g44-b',null, now() - interval '90 days', now() - interval '90 days');

-- Amanhã, horas fixas (SP).
create temp table amanha as
select ((now() at time zone 'America/Sao_Paulo')::date + 1) as dia;
grant select on amanha to authenticated;

insert into public.classes (id, title, type, date_time, group_id, audience)
select v.id::uuid, v.titulo, v.tipo::public.class_type,
       (a.dia + v.hora::time) at time zone 'America/Sao_Paulo', v.turma, v.publico::public.class_audience
  from amanha a,
  (values
    ('d4400000-0000-4000-8000-00000000c001', 'A 07h',          'routine', '07:00', 'g44-a', 'both'),
    ('d4400000-0000-4000-8000-00000000c004', 'B 07h fixos',    'routine', '07:00', 'g44-b', 'fixed'),
    ('d4400000-0000-4000-8000-00000000c002', 'B 09h',          'routine', '09:00', 'g44-b', 'both'),
    ('d4400000-0000-4000-8000-00000000c003', 'Livre 12h',      'routine', '12:00', null,    'free'),
    ('d4400000-0000-4000-8000-00000000c006', 'Livre 12h (2)',  'routine', '12:00', null,    'free'),
    ('d4400000-0000-4000-8000-00000000c014', 'Livre 13h',      'routine', '13:00', null,    'free'),
    ('d4400000-0000-4000-8000-00000000c012', 'A 15h',          'routine', '15:00', 'g44-a', 'both'),
    ('d4400000-0000-4000-8000-00000000c013', 'B 17h',          'routine', '17:00', 'g44-b', 'both'),
    ('d4400000-0000-4000-8000-00000000c005', 'A 18h',          'routine', '18:00', 'g44-a', 'both'),
    ('d4400000-0000-4000-8000-00000000c011', 'B 19h',          'routine', '19:00', 'g44-b', 'both'),
    ('d4400000-0000-4000-8000-00000000c007', 'Evento 20h',     'event',   '20:00', null,    'both'),
    ('d4400000-0000-4000-8000-00000000c008', 'Livre 21h',      'routine', '21:00', null,    'free')
  ) as v(id, titulo, tipo, hora, turma, publico);

insert into public.classes (id, title, type, date_time, group_id, audience) values
  ('d4400000-0000-4000-8000-00000000c009', 'Livre que já começou', 'routine', now() - interval '1 hour', null, 'free');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    update public.classes set cancelled_at = now() where id = 'd4400000-0000-4000-8000-00000000c008';
    raise exception 'FALHOU S0: admin cancelou a aula por update direto numa sessão nova';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK S0: numa sessão nova, cancelamento e chamada só pelas RPCs (correção do 4.1)';
end $$;

set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    insert into public.attendance (class_id, user_id, declared_status, status)
    values ('d4400000-0000-4000-8000-00000000c001', 'd4400000-0000-4000-8000-000000000003', 'present', 'present');
    raise exception 'FALHOU S0b: aluno gravou presença oficial numa sessão nova';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK S0b: numa sessão nova, o aluno não grava presença oficial';
end $$;

-- A aula das 21h cancelada (pelo sistema, como a RPC do 4.7 fará).
reset role;
set local request.jwt.claims = '{}';
update public.classes set cancelled_at = now() where id = 'd4400000-0000-4000-8000-00000000c008';

-- Trocas do FIX: aprovada (A 15h -> B 17h) e pendente (A 18h -> B 19h).
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at) values
  ('d4400000-0000-4000-8000-00000000e001', 'd4400000-0000-4000-8000-000000000003', 'once',
   'd4400000-0000-4000-8000-00000000c012', 'd4400000-0000-4000-8000-00000000c013', 'approved', 'review', now());
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id) values
  ('d4400000-0000-4000-8000-00000000e002', 'd4400000-0000-4000-8000-000000000003', 'once',
   'd4400000-0000-4000-8000-00000000c005', 'd4400000-0000-4000-8000-00000000c011');

-- =====================================================================
-- D1 — livre marca "Vou" até acima da cota: avisa e nunca bloqueia (D4)
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
declare
  v jsonb;
begin
  v := public.declarar_aula('d4400000-0000-4000-8000-00000000c003', true);
  if (v ->> 'acima_da_cota')::boolean or (v ->> 'cota')::int <> 1 or (v ->> 'marcadas_na_semana')::int <> 1 then
    raise exception 'FALHOU D1: primeira marcação %', v;
  end if;
  v := public.declarar_aula('d4400000-0000-4000-8000-00000000c014', true);
  if not (v ->> 'acima_da_cota')::boolean or (v ->> 'marcadas_na_semana')::int <> 2 then
    raise exception 'FALHOU D1: acima da cota não avisou %', v;
  end if;
  if (select declared_status from public.attendance
       where class_id = 'd4400000-0000-4000-8000-00000000c014' and user_id = 'd4400000-0000-4000-8000-000000000004') <> 'present' then
    raise exception 'FALHOU D1: acima da cota bloqueou';
  end if;
  raise notice 'OK D1: livre marca acima da cota com aviso, sem bloqueio';
end $$;

-- =====================================================================
-- D2 — livre: aula só de fixos recusada; "Não vou" limpa; mesmo horário recusado
-- =====================================================================
do $$
begin
  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c004', true);
    raise exception 'FALHOU D2: livre marcou aula só de fixos';
  exception when check_violation then null;
  end;

  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c006', true);
    raise exception 'FALHOU D2: livre marcou duas aulas no mesmo horário';
  exception when check_violation then
    if sqlerrm <> 'Você já marcou outra aula neste horário.' then raise exception 'FALHOU D2: %', sqlerrm; end if;
  end;

  perform public.declarar_aula('d4400000-0000-4000-8000-00000000c014', false);
  if (select declared_status from public.attendance
       where class_id = 'd4400000-0000-4000-8000-00000000c014' and user_id = 'd4400000-0000-4000-8000-000000000004') is not null then
    raise exception 'FALHOU D2: "Não vou" do livre gravou falta';
  end if;
  raise notice 'OK D2: livre não marca aula de fixos nem duas no mesmo horário; "Não vou" limpa';
end $$;

-- =====================================================================
-- D3 — aula cancelada e aula que já começou são recusadas (T26)
-- =====================================================================
do $$
begin
  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c008', true);
    raise exception 'FALHOU D3: marcou aula cancelada';
  exception when check_violation then
    if sqlerrm <> 'Aula cancelada.' then raise exception 'FALHOU D3: %', sqlerrm; end if;
  end;
  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c009', true);
    raise exception 'FALHOU D3: marcou aula que já começou';
  exception when check_violation then
    if sqlerrm <> 'Esta aula já começou.' then raise exception 'FALHOU D3: %', sqlerrm; end if;
  end;
  raise notice 'OK D3: aula cancelada e aula que já começou são recusadas';
end $$;

-- =====================================================================
-- D4 — fixo: "Não vou" na aula da grade é falta declarada; extra em outra
--      turma (de qualquer público, D56) e "Não vou" na extra só limpa (T40)
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  perform public.declarar_aula('d4400000-0000-4000-8000-00000000c001', false);
  if (select declared_status from public.attendance
       where class_id = 'd4400000-0000-4000-8000-00000000c001' and user_id = 'd4400000-0000-4000-8000-000000000003') <> 'absent' then
    raise exception 'FALHOU D4: "Não vou" na aula da grade não gravou ausência';
  end if;

  perform public.declarar_aula('d4400000-0000-4000-8000-00000000c003', true);   -- só livres: extra (D56)
  if (select origem from public.aulas_do_aluno(now(), now() + interval '3 days')
       where class_id = 'd4400000-0000-4000-8000-00000000c003') <> 'extra' then
    raise exception 'FALHOU D4: a extra não aparece como extra';
  end if;
  perform public.declarar_aula('d4400000-0000-4000-8000-00000000c003', false);
  if (select declared_status from public.attendance
       where class_id = 'd4400000-0000-4000-8000-00000000c003' and user_id = 'd4400000-0000-4000-8000-000000000003') is not null then
    raise exception 'FALHOU D4: "Não vou" na extra gravou falta';
  end if;
  raise notice 'OK D4: falta só na aula da grade; extra em aula só de livres; desmarcar extra limpa';
end $$;

-- =====================================================================
-- D5 — fixo: extra no mesmo horário de uma aula da grade é recusada (T40)
-- =====================================================================
do $$
begin
  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c004', true);
    raise exception 'FALHOU D5: extra no horário da aula dele';
  exception when check_violation then
    if sqlerrm <> 'Você já tem aula neste horário. Para ir nesta, peça a troca.' then
      raise exception 'FALHOU D5: %', sqlerrm;
    end if;
  end;
  raise notice 'OK D5: extra no horário da própria aula pede a troca';
end $$;

-- =====================================================================
-- D6 — trocas: na original da troca aprovada e na aula nova da pendente,
--      nem a RPC nem o upsert direto (APK 1.8) declaram
-- =====================================================================
do $$
begin
  begin
    insert into public.attendance (class_id, user_id, declared_status)
    values ('d4400000-0000-4000-8000-00000000c012', 'd4400000-0000-4000-8000-000000000003', 'present')
    on conflict (class_id, user_id) do update set declared_status = excluded.declared_status;
    raise exception 'FALHOU D6: upsert direto na aula trocada';
  exception when check_violation then
    if sqlerrm <> 'Você trocou esta aula por outra.' then raise exception 'FALHOU D6: %', sqlerrm; end if;
  end;
  begin
    perform public.declarar_aula('d4400000-0000-4000-8000-00000000c011', true);
    raise exception 'FALHOU D6: marcou a aula nova da troca pendente';
  exception when check_violation then
    if sqlerrm <> 'Você já pediu troca para esta aula.' then raise exception 'FALHOU D6: %', sqlerrm; end if;
  end;
  raise notice 'OK D6: aula trocada e aula nova de troca pendente não se declaram';
end $$;

-- =====================================================================
-- D7 — o "Não vou" do APK 1.8 numa aula de outra turma vira nulo (§ 9.2, § 15)
-- =====================================================================
do $$
begin
  insert into public.attendance (class_id, user_id, declared_status)
  values ('d4400000-0000-4000-8000-00000000c002', 'd4400000-0000-4000-8000-000000000003', 'absent')
  on conflict (class_id, user_id) do update set declared_status = excluded.declared_status;
  if (select declared_status from public.attendance
       where class_id = 'd4400000-0000-4000-8000-00000000c002' and user_id = 'd4400000-0000-4000-8000-000000000003') is not null then
    raise exception 'FALHOU D7: "Não vou" fora da grade gravou falta';
  end if;
  raise notice 'OK D7: "Não vou" do APK 1.8 fora da grade só limpa';
end $$;

-- =====================================================================
-- D8 — evento: o fixo marca "Vou" e aparece como "marcou", nunca extra (T40)
-- =====================================================================
do $$
begin
  perform public.declarar_aula('d4400000-0000-4000-8000-00000000c007', true);
  if (select origem from public.aulas_do_aluno(now(), now() + interval '3 days')
       where class_id = 'd4400000-0000-4000-8000-00000000c007') <> 'marcou' then
    raise exception 'FALHOU D8: evento do fixo não veio como marcou';
  end if;
  raise notice 'OK D8: no evento, o fixo marca Vou sem virar extra';
end $$;

-- =====================================================================
-- A1 — aulas_do_aluno do fixo: grade, trocas e o que tem linha; nada de
--      outra turma sem vínculo
-- =====================================================================
do $$
declare
  v_origens jsonb;
begin
  select jsonb_object_agg(title, coalesce(origem, '(nula)')) into v_origens
    from public.aulas_do_aluno(now(), now() + interval '3 days');

  if v_origens ->> 'A 07h' <> 'turma' or v_origens ->> 'A 15h' <> 'trocou' or v_origens ->> 'B 17h' <> 'troca'
     or v_origens ->> 'B 19h' <> 'troca_pendente' or v_origens ->> 'A 18h' <> 'turma' then
    raise exception 'FALHOU A1: origens %', v_origens;
  end if;
  if v_origens ? 'B 07h fixos' then
    raise exception 'FALHOU A1: aula de outra turma sem vínculo apareceu %', v_origens;
  end if;
  raise notice 'OK A1: o fixo vê a grade, as trocas e o que tem linha';
end $$;

-- =====================================================================
-- A2 — colunas das trocas e da justificativa (§ 12, T36, T38)
-- =====================================================================
do $$
declare
  r record;
begin
  select * into r from public.aulas_do_aluno(now(), now() + interval '3 days')
   where class_id = 'd4400000-0000-4000-8000-00000000c005';
  if r.swap_role <> 'origem' or r.swap_status <> 'pending' or not r.can_cancel_swap
     or r.can_justify or r.can_swap_from or r.swap_other_class_id <> 'd4400000-0000-4000-8000-00000000c011' then
    raise exception 'FALHOU A2: original da troca pendente %', row_to_json(r);
  end if;

  select * into r from public.aulas_do_aluno(now(), now() + interval '3 days')
   where class_id = 'd4400000-0000-4000-8000-00000000c001';
  if not r.can_justify or r.justify_until <> (((r.date_time at time zone 'America/Sao_Paulo')::date + 8)::timestamp at time zone 'America/Sao_Paulo') - interval '1 second'
     or r.schedule_mode <> 'fixed' or r.weekly_target is not null or r.is_recurring then
    raise exception 'FALHOU A2: aula da grade %', row_to_json(r);
  end if;

  select * into r from public.aulas_do_aluno(now(), now() + interval '3 days')
   where class_id = 'd4400000-0000-4000-8000-00000000c012';
  -- Avulsa aprovada: desiste só antes de as duas começarem (T36).
  if r.swap_role <> 'origem' or r.swap_status <> 'approved' or not r.can_cancel_swap or r.can_justify then
    raise exception 'FALHOU A2: original da troca aprovada %', row_to_json(r);
  end if;
  raise notice 'OK A2: colunas de troca, de desistência e de justificativa';
end $$;

-- =====================================================================
-- A3 — menu de aulas do fixo: todas as aulas de rotina da semana; extra e
--      destino de troca onde pode; justificar e contestar só nas linhas dele
-- =====================================================================
do $$
declare
  r record;
  v_total int;
begin
  select count(*) into v_total
    from public.menu_de_aulas((select dia from amanha))
   where type = 'routine';
  if v_total < 12 then
    raise exception 'FALHOU A3: o menu do fixo não trouxe todas as aulas de rotina (%)', v_total;
  end if;

  select * into r from public.menu_de_aulas((select dia from amanha))
   where class_id = 'd4400000-0000-4000-8000-00000000c002';
  if not r.can_mark_extra or not r.can_swap_to or r.can_justify or r.can_contest or r.origem is not null then
    raise exception 'FALHOU A3: aula de outra turma no menu %', row_to_json(r);
  end if;

  select * into r from public.menu_de_aulas((select dia from amanha))
   where class_id = 'd4400000-0000-4000-8000-00000000c004';
  if r.can_mark_extra or r.can_swap_to then
    raise exception 'FALHOU A3: extra e troca no horário da própria aula %', row_to_json(r);
  end if;

  select * into r from public.menu_de_aulas((select dia from amanha))
   where class_id = 'd4400000-0000-4000-8000-00000000c008';
  if not r.cancelled or r.can_mark_extra or r.can_swap_to or r.can_cancel_swap then
    raise exception 'FALHOU A3: aula cancelada com ação %', row_to_json(r);
  end if;
  raise notice 'OK A3: o menu do fixo mostra tudo e só oferece o que ele pode fazer';
end $$;

-- =====================================================================
-- A4 — menu: esta semana ou a próxima; só aluno
-- =====================================================================
do $$
begin
  begin
    perform 1 from public.menu_de_aulas((now() at time zone 'America/Sao_Paulo')::date + 21);
    raise exception 'FALHOU A4: menu de daqui a três semanas';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Escolha esta semana ou a próxima.' then raise exception 'FALHOU A4: %', sqlerrm; end if;
  end;
  raise notice 'OK A4: menu só desta semana ou da próxima';
end $$;

set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform 1 from public.menu_de_aulas((select dia from amanha));
    raise exception 'FALHOU A4b: professor abriu o menu de aulas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK A4b: menu de aulas é só do aluno';
end $$;

-- =====================================================================
-- A5 — livre: vê as aulas que aceitam livres, nunca as só de fixos
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
declare
  r record;
begin
  if exists (select 1 from public.aulas_do_aluno(now(), now() + interval '3 days')
              where class_id = 'd4400000-0000-4000-8000-00000000c004') then
    raise exception 'FALHOU A5: livre viu aula só de fixos';
  end if;
  select * into r from public.aulas_do_aluno(now(), now() + interval '3 days')
   where class_id = 'd4400000-0000-4000-8000-00000000c003';
  if r.origem <> 'marcou' or r.schedule_mode <> 'free' or r.weekly_target <> 1 or r.can_mark_extra or r.can_swap_to then
    raise exception 'FALHOU A5: linha do livre %', row_to_json(r);
  end if;
  raise notice 'OK A5: o livre vê as aulas de livres, com a cota da semana';
end $$;

-- =====================================================================
-- A6 — aulas_do_aluno e menu_de_aulas: mesma lista e ordem de colunas (§ 12.2)
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
do $$
begin
  if pg_get_function_result('public.aulas_do_aluno(timestamptz, timestamptz)'::regprocedure)
     <> pg_get_function_result('public.menu_de_aulas(date, timestamptz)'::regprocedure) then
    raise exception 'FALHOU A6: aulas_do_aluno e menu_de_aulas divergem nas colunas';
  end if;
  raise notice 'OK A6: as duas funções têm a mesma lista e ordem de colunas';
end $$;

-- =====================================================================
-- M1 — meta do à vontade (§ 5.3, D36–D38)
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000005","role":"authenticated"}';
do $$
declare
  v jsonb;
  v_esta date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
begin
  v := public.definir_meta_semanal(5::smallint);
  if (v ->> 'vale_a_partir')::date <> v_esta + 7 then
    raise exception 'FALHOU M1: vale_a_partir %', v;
  end if;
  if public.meta_da_semana('d4400000-0000-4000-8000-000000000005', v_esta)
     <> (select default_weekly_goal from public.academy_settings limit 1) then
    raise exception 'FALHOU M1: a meta desta semana mudou';
  end if;
  if public.meta_da_semana('d4400000-0000-4000-8000-000000000005', v_esta + 7) <> 5
     or public.meta_da_semana('d4400000-0000-4000-8000-000000000005', v_esta + 21) <> 5 then
    raise exception 'FALHOU M1: a meta nova não vale dali em diante';
  end if;
  begin
    perform public.definir_meta_semanal(7::smallint);
    raise exception 'FALHOU M1: meta 7 aceita';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK M1: a meta nova vale da próxima semana em diante; esta continua';
end $$;

set local request.jwt.claims = '{"sub":"d4400000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform public.definir_meta_semanal(3::smallint);
    raise exception 'FALHOU M2: fixo definiu meta';
  exception when check_violation then null;
  end;
  begin
    perform public.meta_da_semana('d4400000-0000-4000-8000-000000000005', current_date);
    raise exception 'FALHOU M2: um aluno leu a meta de outro';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK M2: meta só do à vontade, e só ele e a equipe a leem';
end $$;

-- =====================================================================
-- X1 — anon não chama nenhuma das RPCs novas
-- =====================================================================
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare
  v_chamada text;
begin
  foreach v_chamada in array array[
    'select * from public.aulas_do_aluno(now(), now() + interval ''1 day'')',
    'select * from public.menu_de_aulas(current_date)',
    'select public.declarar_aula(''d4400000-0000-4000-8000-00000000c001'', true)',
    'select public.definir_meta_semanal(4::smallint)',
    'select public.meta_da_semana(''d4400000-0000-4000-8000-000000000005'', current_date)'
  ] loop
    begin
      execute v_chamada;
      raise exception 'FALHOU X1: anon chamou %', v_chamada;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK X1: anon recebe 42501 nas RPCs do aluno';
end $$;

rollback;
