-- Regressão da troca de aula (bloco 4.9b, migration 20260929190000_trocas;
-- contrato § 9.4, § 10, T36, T37, T41, T42, T49). Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local.
--
-- F fixo da turma G (horário HA, segunda 10h) · L livre · P professor da
-- aula nova · P2 professor que entra na aula nova depois do pedido · A admin.
-- Semana que vem: A1 (HA, seg 10h), X (turma G2, seg 12h), B1 (HB da G2, qua 10h).
-- Daqui a duas semanas: A2 (HA), B2 (HB) e Y (G2, seg 12h).
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('t9-g', 'T9 Turma G'), ('t9-g2', 'T9 Turma G2');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('da000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 't9-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 5) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('da000000-0000-4000-8000-000000000001', 'admin', 'T9 Admin', '61000000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('da000000-0000-4000-8000-000000000002', 'professor', 'T9 Prof P', '61000000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('da000000-0000-4000-8000-000000000003', 'professor', 'T9 Prof P2', '61000000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('da000000-0000-4000-8000-000000000004', 'user', 'T9 Aluno F', '61000000004', false, 'active', 't9-g', null, now() - interval '60 days'),
  ('da000000-0000-4000-8000-000000000005', 'user', 'T9 Aluno L', '61000000005', false, 'active', null, null, now() - interval '60 days');

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota)
values ('dab00000-0000-4000-8000-000000000001', 'T9 Livre 2x', 10000, 'free', 2);
insert into public.plan_periods (user_id, plan_id, started_at)
values ('da000000-0000-4000-8000-000000000005', 'dab00000-0000-4000-8000-000000000001', now() - interval '60 days');

insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from, audience) values
  ('dad00000-0000-4000-8000-000000000001', 't9-g', 'T9 HA', 1, '10:00', '2026-01-01', 'both'),
  ('dad00000-0000-4000-8000-000000000002', 't9-g2', 'T9 HB', 3, '10:00', '2026-01-01', 'both');

create temp table dias on commit drop as
select (date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7) as seg;

insert into public.classes (id, title, type, group_id, date_time, audience, schedule_id, occurrence_date)
select v.id::uuid, v.titulo, 'routine', v.grupo,
       ((d.seg + v.dia) + v.hora) at time zone 'America/Sao_Paulo', 'both', v.horario::uuid,
       case when v.horario is not null then d.seg + v.dia end
  from dias d,
       (values
         ('dac00000-0000-4000-8000-000000000001', 'T9 A1', 't9-g', 0, time '10:00', 'dad00000-0000-4000-8000-000000000001'),
         ('dac00000-0000-4000-8000-000000000002', 'T9 X', 't9-g2', 0, time '12:00', null),
         ('dac00000-0000-4000-8000-000000000003', 'T9 B1', 't9-g2', 2, time '10:00', 'dad00000-0000-4000-8000-000000000002'),
         ('dac00000-0000-4000-8000-000000000004', 'T9 A2', 't9-g', 7, time '10:00', 'dad00000-0000-4000-8000-000000000001'),
         ('dac00000-0000-4000-8000-000000000005', 'T9 B2', 't9-g2', 9, time '10:00', 'dad00000-0000-4000-8000-000000000002'),
         ('dac00000-0000-4000-8000-000000000006', 'T9 Y', 't9-g2', 7, time '12:00', null)
       ) as v(id, titulo, grupo, dia, hora, horario);

insert into public.class_teachers (class_id, teacher_id) values
  ('dac00000-0000-4000-8000-000000000002', 'da000000-0000-4000-8000-000000000002'),
  ('dac00000-0000-4000-8000-000000000003', 'da000000-0000-4000-8000-000000000002'),
  ('dac00000-0000-4000-8000-000000000004', 'da000000-0000-4000-8000-000000000002');

insert into public.push_devices (user_id, expo_token, platform, app_variant)
select p.id, 'ExponentPushToken[t9-' || p.id::text || ']', 'android', 'production'
  from public.profiles p where p.id::text like 'da000000%';

create temp table ctx (chave text primary key, id uuid) on commit drop;
grant select, insert, update on ctx to authenticated, anon;

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- =====================================================================
-- T1 — pedir a avulsa e as recusas
-- =====================================================================
set local role authenticated;

do $$
declare
  A1 constant uuid := 'dac00000-0000-4000-8000-000000000001';
  X  constant uuid := 'dac00000-0000-4000-8000-000000000002';
  Y  constant uuid := 'dac00000-0000-4000-8000-000000000006';
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000002');
  begin
    perform public.pedir_troca_de_aula(A1, X, 'once');
    raise exception 'FALHOU T1: professor pediu troca';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('da000000-0000-4000-8000-000000000005');
  begin
    perform public.pedir_troca_de_aula(A1, X, 'once');
    raise exception 'FALHOU T1: livre pediu troca';
  exception when check_violation then null;
  end;

  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  begin
    perform public.pedir_troca_de_aula(A1, X, null);
    raise exception 'FALHOU T1: sem tipo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.pedir_troca_de_aula(A1, Y, 'once');
    raise exception 'FALHOU T1: avulsa entre semanas';
  exception when check_violation then null;
  end;
  begin
    perform public.pedir_troca_de_aula(X, A1, 'once');
    raise exception 'FALHOU T1: original que não é dele';
  exception when check_violation then null;
  end;

  insert into ctx values ('avulsa', public.pedir_troca_de_aula(A1, X, 'once'));
  begin
    perform public.pedir_troca_de_aula(A1, X, 'once');
    raise exception 'FALHOU T1: duas para o mesmo destino';
  exception when check_violation then null;
  end;
  begin
    perform public.pedir_troca_de_aula(A1, 'dac00000-0000-4000-8000-000000000003', 'once');
    raise exception 'FALHOU T1: duas da mesma original';
  exception when check_violation then null;
  end;
  raise notice 'OK T1: só o fixo pede, com as recusas da tabela';
end $$;

-- =====================================================================
-- T2 — decidir a avulsa (nota opcional para aprovar) e desistir
-- =====================================================================
do $$
declare
  A1 constant uuid := 'dac00000-0000-4000-8000-000000000001';
  X  constant uuid := 'dac00000-0000-4000-8000-000000000002';
  v uuid := (select id from ctx where chave = 'avulsa');
  r record;
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000003');
  begin
    perform public.decidir_troca_de_aula(v, 'approved');
    raise exception 'FALHOU T2: professor de fora decidiu';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('da000000-0000-4000-8000-000000000002');
  if (select count(*) from public.itens_da_solicitacao('trocas_de_aula') where id = v) <> 1 then
    raise exception 'FALHOU T2: a troca não entrou na caixa';
  end if;
  begin
    perform public.decidir_troca_de_aula(v, 'rejected');
    raise exception 'FALHOU T2: negou sem nota';
  exception when invalid_parameter_value then null;
  end;
  perform public.decidir_troca_de_aula(v, 'approved');

  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  select * into r from public.minhas_trocas() where id = v;
  if r.status <> 'approved' or r.approved_by_name <> 'T9 Prof P' or not r.can_cancel then
    raise exception 'FALHOU T2: minhas_trocas depois da aprovação';
  end if;
  perform public.desistir_da_troca(v);
  begin
    perform public.desistir_da_troca(v);
    raise exception 'FALHOU T2: desistiu duas vezes';
  exception when check_violation then null;
  end;

  -- De novo, e agora o admin nega com nota.
  update ctx set id = public.pedir_troca_de_aula(A1, X, 'once') where chave = 'avulsa';
  perform pg_temp.como('da000000-0000-4000-8000-000000000001');
  perform public.decidir_troca_de_aula((select id from ctx where chave = 'avulsa'), 'rejected', 'Turma cheia.');
  if (select review_note from public.trocas_decididas(current_date - 1, current_date + 1)
       where id = (select id from ctx where chave = 'avulsa')) <> 'Turma cheia.' then
    raise exception 'FALHOU T2: trocas_decididas do admin';
  end if;

  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  select * into r from public.minhas_trocas() where id = (select id from ctx where chave = 'avulsa');
  if r.status <> 'rejected' or r.approved_by_name is not null or r.can_cancel then
    raise exception 'FALHOU T2: a negada mostra quem negou';
  end if;
  raise notice 'OK T2: aprovar sem nota, negar com nota, desistir uma vez e quem negou não aparece';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  if not exists (select 1 from public.notification_outbox where recipient_id = 'da000000-0000-4000-8000-000000000002'
                  and kind = 'troca_pendente')
     or not exists (select 1 from public.notification_outbox where recipient_id = 'da000000-0000-4000-8000-000000000004'
                     and kind = 'troca_aprovada')
     or not exists (select 1 from public.notification_outbox where recipient_id = 'da000000-0000-4000-8000-000000000004'
                     and kind = 'troca_negada') then
    raise exception 'FALHOU T3: avisos da avulsa';
  end if;
  if exists (select 1 from public.notification_outbox where recipient_id = 'da000000-0000-4000-8000-000000000001'
              and kind = 'troca_pendente') then
    raise exception 'FALHOU T3: admin avisado da avulsa com professor na aula nova';
  end if;
  raise notice 'OK T3: pedido aos professores da aula nova; aprovada e negada ao aluno';
end $$;

-- =====================================================================
-- T4 — permanente: pedido, T38, T49 e aprovação (abre o período, T37)
-- =====================================================================
set local role authenticated;

do $$
declare
  A1 constant uuid := 'dac00000-0000-4000-8000-000000000001';
  X  constant uuid := 'dac00000-0000-4000-8000-000000000002';
  B1 constant uuid := 'dac00000-0000-4000-8000-000000000003';
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  begin
    perform public.pedir_troca_de_aula(A1, B1, 'permanent');
    raise exception 'FALHOU T4: permanente sem justificativa';
  exception when invalid_parameter_value then null;
  end;
  insert into ctx values ('perm', public.pedir_troca_de_aula(A1, B1, 'permanent',
    public.criar_motivo('class_swap_evidence', null, 'Mudei de emprego.')));
  begin
    perform public.pedir_troca_de_aula(A1, B1, 'permanent', public.criar_motivo('class_swap_evidence', null, 'De novo'));
    raise exception 'FALHOU T4: duas permanentes do mesmo horário';
  exception when check_violation then null;
  end;
  begin
    perform public.pedir_troca_de_aula(A1, X, 'once');
    raise exception 'FALHOU T4: avulsa com permanente pendente do horário (T38)';
  exception when check_violation then null;
  end;
end $$;

reset role;
-- P2 entra na aula nova DEPOIS do pedido (T49).
insert into public.class_teachers (class_id, teacher_id, created_at)
values ('dac00000-0000-4000-8000-000000000003', 'da000000-0000-4000-8000-000000000003', now() + interval '1 minute');
set local role authenticated;

do $$
declare
  v uuid := (select id from ctx where chave = 'perm');
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000003');
  if public.pode_decidir_troca(v) or exists (select 1 from public.trocas_para_decidir() where id = v) then
    raise exception 'FALHOU T4: T49, quem entrou depois vê a permanente';
  end if;

  perform pg_temp.como('da000000-0000-4000-8000-000000000002');
  if (select motivo_texto from public.trocas_para_decidir() where id = v) <> 'Mudei de emprego.' then
    raise exception 'FALHOU T4: professor da aula nova não lê a justificativa';
  end if;
  begin
    perform public.decidir_troca_de_aula(v, 'approved');
    raise exception 'FALHOU T4: aprovou a permanente sem nota';
  exception when invalid_parameter_value then null;
  end;
  perform public.decidir_troca_de_aula(v, 'approved', 'Horário com vaga.');

  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  begin
    perform public.desistir_da_troca(v);
    raise exception 'FALHOU T4: desistiu da permanente aprovada';
  exception when check_violation then null;
  end;
  if (select count(*) from public.minhas_trocas_permanentes()) <> 1 then
    raise exception 'FALHOU T4: minhas_trocas_permanentes';
  end if;
  raise notice 'OK T4: permanente com justificativa, T38, T49 e nota obrigatória na decisão';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  F constant uuid := 'da000000-0000-4000-8000-000000000004';
begin
  if public.fonte_da_aula_na_grade(F, 'dac00000-0000-4000-8000-000000000004') is not null
     or public.fonte_da_aula_na_grade(F, 'dac00000-0000-4000-8000-000000000005') is distinct from 'permanente' then
    raise exception 'FALHOU T5: a grade não mudou com o período';
  end if;
  if not exists (select 1 from public.notification_outbox where recipient_id = 'da000000-0000-4000-8000-000000000001'
                  and kind = 'troca_pendente') then
    raise exception 'FALHOU T5: admin não avisado da permanente (T42)';
  end if;
  raise notice 'OK T5: o período muda a grade dali em diante e a permanente avisa os admins';
end $$;

-- =====================================================================
-- T6 — voltar ao horário antigo encerra o período sem abrir outro
-- =====================================================================
set local role authenticated;

do $$
declare
  A2 constant uuid := 'dac00000-0000-4000-8000-000000000004';
  B2 constant uuid := 'dac00000-0000-4000-8000-000000000005';
  v uuid;
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  v := public.pedir_troca_de_aula(B2, A2, 'permanent', public.criar_motivo('class_swap_evidence', null, 'Voltei ao emprego antigo.'));
  perform pg_temp.como('da000000-0000-4000-8000-000000000001');
  perform public.decidir_troca_de_aula(v, 'approved', 'Ok.');
  raise notice 'OK T6a: a volta foi aprovada';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  F constant uuid := 'da000000-0000-4000-8000-000000000004';
begin
  if exists (select 1 from public.class_swap_periods where user_id = F and ended_at is null)
     or not exists (select 1 from public.class_swap_periods where user_id = F and end_reason = 'reverted') then
    raise exception 'FALHOU T6: o período de volta';
  end if;
  if public.fonte_da_aula_na_grade(F, 'dac00000-0000-4000-8000-000000000004') is distinct from 'turma' then
    raise exception 'FALHOU T6: a aula da turma não voltou';
  end if;
  raise notice 'OK T6: reverted, sem período novo, e a turma volta a valer';
end $$;

-- =====================================================================
-- T7 — só pelas RPCs
-- =====================================================================
set local role authenticated;

do $$
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  begin
    perform 1 from public.class_swaps;
    raise exception 'FALHOU T7: leitura direta de class_swaps';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.trocas_decididas(current_date, current_date);
    raise exception 'FALHOU T7: aluno viu as decididas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T7: as tabelas de troca só pelas RPCs';
end $$;

-- =====================================================================
-- T8 — historico_de_aulas_do_aluno (adiantado do 4.10 para o G3)
-- =====================================================================
do $$
declare
  F constant uuid := 'da000000-0000-4000-8000-000000000004';
  n int;
begin
  perform pg_temp.como('da000000-0000-4000-8000-000000000004');
  select count(*) into n from public.historico_de_aulas_do_aluno(F, current_date, current_date + 21)
   where title like 'T9 %';
  if n = 0 then
    raise exception 'FALHOU T8: o aluno não vê o próprio histórico';
  end if;

  perform pg_temp.como('da000000-0000-4000-8000-000000000005');
  begin
    perform * from public.historico_de_aulas_do_aluno(F, current_date, current_date + 21);
    raise exception 'FALHOU T8: outro aluno viu o histórico';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('da000000-0000-4000-8000-000000000002');
  if (select count(*) from public.historico_de_aulas_do_aluno(F, current_date, current_date + 21) where title like 'T9 %') <> n then
    raise exception 'FALHOU T8: a equipe vê outro histórico';
  end if;
  raise notice 'OK T8: o histórico é do próprio aluno ou da equipe';
end $$;

rollback;
