-- Regressão das notificações push (migrations 20260916211951_push_dispositivos e
-- 20260916211956_notificacoes_fila). Roda numa transação e termina em
-- ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Datas em 2030 ("hoje" = 10/03/2030 em São Paulo). Filas de teste
-- reivindicadas "agora" são inseridas com send_after no passado, para o
-- resultado não depender da hora em que o teste roda.
--
--   ADM admin com aparelho · ADM2 admin sem aparelho · PROF professor das aulas
--   PROF2 professor de outra aula · ALU aluno com aparelho de produção
--   ALU2 só aparelho DEV · ALU3 (limite de aparelhos) · ALU4 e ALU5 (tokens
--   que a Expo dá como inexistentes) · ALU6 (fuso) · ALUI inativo · ALUX excluído
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('b9000000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'push-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04','05','06','07','08','09','10','11','12','13']) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color) values
  ('b9000000-0000-4000-8000-000000000001','admin','Admin Push','99000000001',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000002','admin','Admin Sem Aparelho','99000000002',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000003','professor','Prof Push','99000000003',false,'active',null,'#101010'),
  ('b9000000-0000-4000-8000-000000000004','professor','Prof Outro','99000000004',false,'active',null,'#202020'),
  ('b9000000-0000-4000-8000-000000000005','user','Aluno Push','99000000005',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000006','user','Aluno Dev','99000000006',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000007','user','Aluno Limite','99000000007',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000008','user','Aluno Quatro','99000000008',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000009','user','Aluno Cinco','99000000009',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000010','user','Aluno Fuso','99000000010',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000012','user','Aluno Excluido','99000000012',false,'active',null,null),
  ('b9000000-0000-4000-8000-000000000013','user','Aluno Outro','99000000013',false,'active',null,null);

insert into public.profiles (id, role, name, cpf, is_first_login, status, deactivated_at)
values ('b9000000-0000-4000-8000-000000000011','user','Aluno Inativo','99000000011',false,'inactive', now());

-- Aparelhos gravados direto (a RPC é testada no T1); ALU tem o dele pela RPC.
insert into public.push_devices (user_id, expo_token, platform, app_variant) values
  ('b9000000-0000-4000-8000-000000000001', 'ExponentPushToken[adm]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000003', 'ExponentPushToken[prof]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000004', 'ExponentPushToken[prof2]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000006', 'ExponentPushToken[alu2dev]', 'android', 'development'),
  ('b9000000-0000-4000-8000-000000000008', 'ExponentPushToken[alu4]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000009', 'ExponentPushToken[alu5]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000010', 'ExponentPushToken[alu6]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000011', 'ExponentPushToken[alui]', 'android', 'production'),
  ('b9000000-0000-4000-8000-000000000012', 'ExponentPushToken[alux]', 'android', 'production');

insert into public.groups (id, name) values ('push-t', 'Push Turma'), ('push-arq', 'Push Arquivada');

insert into public.classes (id, title, type, date_time, group_id, attendance_taken_at) values
  ('b9000000-0000-4000-8000-00000000c001','Muay Thai Noite','routine', timestamptz '2030-03-10 18:00-03','push-t', null),
  ('b9000000-0000-4000-8000-00000000c002','Com chamada','routine', timestamptz '2030-03-10 18:00-03','push-t', timestamptz '2030-03-10 19:00-03'),
  ('b9000000-0000-4000-8000-00000000c003','Antiga','routine', timestamptz '2030-03-07 18:00-03','push-t', null),
  ('b9000000-0000-4000-8000-00000000c004','Para justificar','routine', timestamptz '2030-03-20 18:00-03','push-t', null),
  ('b9000000-0000-4000-8000-00000000c005','Sem professor','routine', timestamptz '2030-03-20 19:00-03','push-t', null),
  ('b9000000-0000-4000-8000-00000000c006','Arquivada','routine', timestamptz '2030-03-10 18:00-03','push-arq', null),
  ('b9000000-0000-4000-8000-00000000c007','Do outro professor','routine', timestamptz '2030-03-20 20:00-03','push-t', null);

insert into public.class_teachers (class_id, teacher_id) values
  ('b9000000-0000-4000-8000-00000000c001','b9000000-0000-4000-8000-000000000003'),
  ('b9000000-0000-4000-8000-00000000c002','b9000000-0000-4000-8000-000000000003'),
  ('b9000000-0000-4000-8000-00000000c003','b9000000-0000-4000-8000-000000000003'),
  ('b9000000-0000-4000-8000-00000000c004','b9000000-0000-4000-8000-000000000003'),
  ('b9000000-0000-4000-8000-00000000c006','b9000000-0000-4000-8000-000000000003'),
  ('b9000000-0000-4000-8000-00000000c007','b9000000-0000-4000-8000-000000000004');

update public.groups set archived_at = now() where id = 'push-arq';

-- =====================================================================
-- T1–T5: aparelhos
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000005","role":"authenticated"}';
do $$
declare n integer;
begin
  perform public.registrar_dispositivo_push('ExponentPushToken[alu-rpc]', 'android', 'production');
  select count(*) into n from public.push_devices;
  if n <> 1 or not exists (select 1 from public.push_devices where expo_token = 'ExponentPushToken[alu-rpc]') then
    raise exception 'FALHOU T1: aluno vê % aparelho(s) (esperado só o dele)', n;
  end if;
  raise notice 'OK T1: aluno registra o próprio aparelho e lê só o seu';

  begin
    insert into public.push_devices (user_id, expo_token, platform, app_variant)
    values ('b9000000-0000-4000-8000-000000000005', 'ExponentPushToken[direto]', 'android', 'production');
    raise exception 'FALHOU T2: aluno gravou aparelho direto na tabela';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T2: aluno não grava aparelho direto nem lê o de outra pessoa';

  begin
    perform public.registrar_dispositivo_push('token-qualquer', 'android', 'production');
    raise exception 'FALHOU T4: token malformado aceito';
  exception when check_violation then null;
  end;
  raise notice 'OK T4: token fora do formato Expo é recusado';
end $$;

-- T3 — outra pessoa entra no mesmo aparelho: o token muda de dono
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000013","role":"authenticated"}';
select public.registrar_dispositivo_push('ExponentPushToken[alu-rpc]', 'android', 'production');
reset role;
set local request.jwt.claims = '';
do $$
begin
  if not exists (select 1 from public.push_devices
                  where expo_token = 'ExponentPushToken[alu-rpc]' and user_id = 'b9000000-0000-4000-8000-000000000013') then
    raise exception 'FALHOU T3: token não mudou de dono';
  end if;
  raise notice 'OK T3: o mesmo token registrado por outra pessoa muda de dono';
end $$;
-- Devolve o aparelho ao ALU para o resto dos testes.
update public.push_devices set user_id = 'b9000000-0000-4000-8000-000000000005' where expo_token = 'ExponentPushToken[alu-rpc]';

-- T5 — no máximo 5 aparelhos por pessoa; sai o mais antigo
set local role authenticated;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000007","role":"authenticated"}';
select public.registrar_dispositivo_push('ExponentPushToken[lim' || n || ']', 'android', 'production')
  from generate_series(1, 6) as n;
reset role;
set local request.jwt.claims = '';
do $$
begin
  if (select count(*) from public.push_devices where user_id = 'b9000000-0000-4000-8000-000000000007') <> 5
     or exists (select 1 from public.push_devices where expo_token = 'ExponentPushToken[lim1]')
     or not exists (select 1 from public.push_devices where expo_token = 'ExponentPushToken[lim6]') then
    raise exception 'FALHOU T5: limite de aparelhos não respeitado';
  end if;
  raise notice 'OK T5: no máximo 5 aparelhos, sai o mais antigo';
end $$;

-- T6 — conta excluída perde os aparelhos
update public.profiles set anonymized_at = now(), status = 'inactive', deactivated_at = now() where id = 'b9000000-0000-4000-8000-000000000012';
do $$
begin
  if exists (select 1 from public.push_devices where user_id = 'b9000000-0000-4000-8000-000000000012') then
    raise exception 'FALHOU T6: conta excluída manteve aparelho';
  end if;
  raise notice 'OK T6: excluir a conta apaga os aparelhos';
end $$;

-- =====================================================================
-- T7 — comprovante enviado, recusado, reenviado e aprovado
-- =====================================================================
insert into public.payments (id, user_id, amount_cents, reference_month, due_date, status) values
  ('b9000000-0000-4000-8000-00000000d009','b9000000-0000-4000-8000-000000000005', 10000, date '2030-08-01', date '2030-08-10', 'open');

update public.payments set status = 'pending_approval' where id = 'b9000000-0000-4000-8000-00000000d009';
update public.payments set status = 'pending_approval' where id = 'b9000000-0000-4000-8000-00000000d009';
do $$
begin
  if (select count(*) from public.notification_outbox where payment_id = 'b9000000-0000-4000-8000-00000000d009' and kind = 'comprovante_enviado') <> 1
     or exists (select 1 from public.notification_outbox where recipient_id = 'b9000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU T7: comprovante enviado deveria gerar 1 aviso (só o admin com aparelho)';
  end if;
end $$;
update public.payments set status = 'open' where id = 'b9000000-0000-4000-8000-00000000d009';
update public.payments set status = 'pending_approval' where id = 'b9000000-0000-4000-8000-00000000d009';
update public.payments set status = 'paid', paid_at = now() where id = 'b9000000-0000-4000-8000-00000000d009';
do $$
declare v text;
begin
  select string_agg(kind::text || '>' || right(recipient_id::text, 2), ',' order by created_at, kind::text)
    into v
    from public.notification_outbox where payment_id = 'b9000000-0000-4000-8000-00000000d009';
  if (select count(*) from public.notification_outbox where payment_id = 'b9000000-0000-4000-8000-00000000d009' and kind = 'comprovante_enviado') <> 2
     or (select count(*) from public.notification_outbox where payment_id = 'b9000000-0000-4000-8000-00000000d009'
           and kind in ('comprovante_recusado', 'comprovante_aprovado') and recipient_id = 'b9000000-0000-4000-8000-000000000005') <> 2 then
    raise exception 'FALHOU T7: avisos do comprovante %', v;
  end if;
  raise notice 'OK T7: enviado avisa admins com aparelho (sem duplicar); recusa, reenvio e aprovação avisam';
end $$;

-- =====================================================================
-- T8 — justificativa pendente
-- =====================================================================
insert into public.absence_justifications (id, class_id, user_id, message) values
  ('b9000000-0000-4000-8000-00000000e001','b9000000-0000-4000-8000-00000000c004','b9000000-0000-4000-8000-000000000005','Médico'),
  ('b9000000-0000-4000-8000-00000000e002','b9000000-0000-4000-8000-00000000c005','b9000000-0000-4000-8000-000000000005','Viagem');
do $$
begin
  if not exists (select 1 from public.notification_outbox where justification_id = 'b9000000-0000-4000-8000-00000000e001'
                   and recipient_id = 'b9000000-0000-4000-8000-000000000003')
     or exists (select 1 from public.notification_outbox where justification_id = 'b9000000-0000-4000-8000-00000000e001'
                  and recipient_id in ('b9000000-0000-4000-8000-000000000004', 'b9000000-0000-4000-8000-000000000001'))
     or not exists (select 1 from public.notification_outbox where justification_id = 'b9000000-0000-4000-8000-00000000e002'
                      and recipient_id = 'b9000000-0000-4000-8000-000000000001') then
    raise exception 'FALHOU T8: destinatários da justificativa errados';
  end if;
  raise notice 'OK T8: justificativa vai para o professor da aula; sem professor, para o admin';
end $$;

-- =====================================================================
-- T9–T11 — lembretes de mensalidade
-- =====================================================================
insert into public.payments (id, user_id, amount_cents, reference_month, due_date, status, paid_at) values
  ('b9000000-0000-4000-8000-00000000d001','b9000000-0000-4000-8000-000000000005', 10000, date '2030-05-01', date '2030-03-13', 'open', null),     -- D-3
  ('b9000000-0000-4000-8000-00000000d002','b9000000-0000-4000-8000-000000000005', 10000, date '2030-04-01', date '2030-03-10', 'open', null),     -- D0
  ('b9000000-0000-4000-8000-00000000d003','b9000000-0000-4000-8000-000000000005', 10000, date '2030-03-01', date '2030-03-09', 'overdue', null),  -- D+1
  ('b9000000-0000-4000-8000-00000000d004','b9000000-0000-4000-8000-000000000005', 10000, date '2030-02-01', date '2030-03-03', 'open', null),     -- D+7
  ('b9000000-0000-4000-8000-00000000d005','b9000000-0000-4000-8000-000000000005', 10000, date '2030-01-01', date '2030-02-18', 'overdue', null),  -- 20 dias: nada
  ('b9000000-0000-4000-8000-00000000d006','b9000000-0000-4000-8000-000000000005', 10000, date '2030-06-01', date '2030-03-10', 'pending_approval', null),
  ('b9000000-0000-4000-8000-00000000d007','b9000000-0000-4000-8000-000000000005', 10000, date '2030-07-01', date '2030-03-13', 'paid', now()),
  ('b9000000-0000-4000-8000-00000000d008','b9000000-0000-4000-8000-000000000011', 10000, date '2030-04-01', date '2030-03-10', 'open', null),     -- inativo
  ('b9000000-0000-4000-8000-00000000d010','b9000000-0000-4000-8000-000000000010', 10000, date '2030-04-01', date '2030-03-20', 'open', null);     -- fuso

do $$
declare
  n1 integer;
  n2 integer;
  v text;
begin
  n1 := public.enfileirar_lembretes_de_mensalidade(timestamptz '2030-03-10 09:00-03');
  n2 := public.enfileirar_lembretes_de_mensalidade(timestamptz '2030-03-10 09:00-03');
  select string_agg(format('%s:%s', right(payment_id::text, 2), kind), ',' order by payment_id)
    into v
    from public.notification_outbox
   where recipient_id = 'b9000000-0000-4000-8000-000000000005'
     and kind in ('mensalidade_vence_em_breve', 'mensalidade_vence_hoje', 'mensalidade_atrasada');
  if n2 <> 0 or v is distinct from '01:mensalidade_vence_em_breve,02:mensalidade_vence_hoje,03:mensalidade_atrasada,04:mensalidade_atrasada' then
    raise exception 'FALHOU T9: lembretes % (segunda rodada gerou %)', v, n2;
  end if;
  if not exists (select 1 from public.notification_outbox
                  where payment_id = 'b9000000-0000-4000-8000-00000000d001' and data = '{"dias": 3}'::jsonb
                    and send_after = timestamptz '2030-03-10 09:00-03') then
    raise exception 'FALHOU T9: D-3 sem os dias ou fora do horário';
  end if;
  raise notice 'OK T9: D-3, D0, D+1 e D+7, sem duplicar ao rodar de novo';

  if exists (select 1 from public.notification_outbox where payment_id in (
               'b9000000-0000-4000-8000-00000000d005', 'b9000000-0000-4000-8000-00000000d006',
               'b9000000-0000-4000-8000-00000000d007', 'b9000000-0000-4000-8000-00000000d008')) then
    raise exception 'FALHOU T11: lembrete para atraso antigo, em análise, paga ou aluno inativo';
  end if;
  raise notice 'OK T11: atraso antigo, em análise, paga e aluno inativo não recebem lembrete';
end $$;

-- T10, T15 — fuso e silêncio noturno
do $$
begin
  -- 02:30 UTC de 21/03 = 23:30 de 20/03 em São Paulo: "hoje" é 20/03 (vence
  -- hoje, não "atrasada"), e o aviso fica para as 07:00.
  perform public.enfileirar_lembretes_de_mensalidade(timestamptz '2030-03-21 02:30+00');
  if not exists (select 1 from public.notification_outbox
                  where payment_id = 'b9000000-0000-4000-8000-00000000d010' and kind = 'mensalidade_vence_hoje'
                    and send_after = timestamptz '2030-03-21 07:00-03') then
    raise exception 'FALHOU T10: data de São Paulo ou horário de silêncio errados';
  end if;
  raise notice 'OK T10: o dia do lembrete é o de São Paulo';

  if public.horario_permitido_para_push(timestamptz '2030-03-10 23:00-03') <> timestamptz '2030-03-11 07:00-03'
     or public.horario_permitido_para_push(timestamptz '2030-03-11 06:59-03') <> timestamptz '2030-03-11 07:00-03'
     or public.horario_permitido_para_push(timestamptz '2030-03-11 07:00-03') <> timestamptz '2030-03-11 07:00-03'
     or public.horario_permitido_para_push(timestamptz '2030-03-11 21:59-03') <> timestamptz '2030-03-11 21:59-03' then
    raise exception 'FALHOU T15: horário de silêncio';
  end if;
  raise notice 'OK T15: nada sai entre 22:00 e 07:00';
end $$;

-- =====================================================================
-- T12 — aula sem chamada
-- =====================================================================
do $$
declare v text;
begin
  perform public.enfileirar_avisos_aula_sem_chamada(timestamptz '2030-03-10 19:10-03');
  perform public.enfileirar_avisos_aula_sem_chamada(timestamptz '2030-03-10 19:25-03');
  select string_agg(right(class_id::text, 2) || '>' || right(recipient_id::text, 2), ',')
    into v
    from public.notification_outbox where kind = 'aula_sem_chamada' and class_id::text like 'b9000000%';
  if v is distinct from '01>03' then
    raise exception 'FALHOU T12: avisos de aula sem chamada %', v;
  end if;

  perform public.enfileirar_resumo_aulas_sem_chamada(timestamptz '2030-03-10 21:00-03');
  if not exists (select 1 from public.notification_outbox
                  where kind = 'aulas_sem_chamada_resumo' and recipient_id = 'b9000000-0000-4000-8000-000000000001'
                    and data = '{"quantidade": 1}'::jsonb) then
    raise exception 'FALHOU T12: resumo do admin';
  end if;
  raise notice 'OK T12: avisa só a aula sem chamada recente, fora de turma arquivada; admin recebe o resumo';
end $$;

-- =====================================================================
-- T13 — despachante: obsoletas, sem aparelho da variante e reivindicação
-- =====================================================================
insert into public.payments (id, user_id, amount_cents, reference_month, due_date, status) values
  ('b9000000-0000-4000-8000-00000000d011','b9000000-0000-4000-8000-000000000006', 10000, date '2030-04-01', date '2030-03-10', 'open');

insert into public.notification_outbox (id, recipient_id, kind, dedupe_key, payment_id, send_after) values
  ('b9000000-0000-4000-8000-00000000f001','b9000000-0000-4000-8000-000000000005','mensalidade_vence_hoje','teste:r1','b9000000-0000-4000-8000-00000000d002', now() - interval '1 minute'),
  ('b9000000-0000-4000-8000-00000000f002','b9000000-0000-4000-8000-000000000006','mensalidade_vence_hoje','teste:r2','b9000000-0000-4000-8000-00000000d011', now() - interval '1 minute'),
  ('b9000000-0000-4000-8000-00000000f003','b9000000-0000-4000-8000-000000000005','mensalidade_vence_em_breve','teste:r3','b9000000-0000-4000-8000-00000000d007', now() - interval '1 minute');

set local role service_role;
create temporary table reivindicadas on commit drop as
select * from public.reivindicar_notificacoes(200, 'production');
reset role;

do $$
begin
  if not exists (select 1 from reivindicadas where outbox_id = 'b9000000-0000-4000-8000-00000000f001' and expo_token = 'ExponentPushToken[alu-rpc]')
     or exists (select 1 from reivindicadas where outbox_id in ('b9000000-0000-4000-8000-00000000f002', 'b9000000-0000-4000-8000-00000000f003')) then
    raise exception 'FALHOU T13: reivindicação devolveu as linhas erradas';
  end if;
  if (select status from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f001') <> 'sending'
     or (select status::text || '/' || last_error from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f002') <> 'cancelled/sem_dispositivo'
     or (select status::text || '/' || last_error from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f003') <> 'cancelled/obsoleta' then
    raise exception 'FALHOU T13: situações depois da reivindicação';
  end if;
  raise notice 'OK T13: cancela obsoleta e sem aparelho da variante; reivindica só o que pode sair';
end $$;

-- =====================================================================
-- T14 — nada disso é chamável pelo app
-- =====================================================================
do $$
begin
  if has_function_privilege('authenticated', 'public.enfileirar_lembretes_de_mensalidade(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.reivindicar_notificacoes(integer, public.app_variant)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_envio_de_push(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.disparar_envio_de_push()', 'execute')
     or has_function_privilege('anon', 'public.registrar_dispositivo_push(text, public.push_platform, public.app_variant)', 'execute')
     or has_table_privilege('authenticated', 'public.notification_deliveries', 'select')
     or has_table_privilege('authenticated', 'public.notification_outbox', 'insert')
     or not has_function_privilege('service_role', 'public.reivindicar_notificacoes(integer, public.app_variant)', 'execute') then
    raise exception 'FALHOU T14: permissões das funções internas';
  end if;
  raise notice 'OK T14: fila e despacho só pelo servidor';
end $$;

-- =====================================================================
-- T16 — resultado do envio
-- =====================================================================
insert into public.notification_outbox (id, recipient_id, kind, dedupe_key, status, attempts, claimed_at) values
  ('b9000000-0000-4000-8000-00000000f004','b9000000-0000-4000-8000-000000000005','comprovante_aprovado','teste:r4','sending',1, now()),
  ('b9000000-0000-4000-8000-00000000f005','b9000000-0000-4000-8000-000000000005','comprovante_recusado','teste:r5','sending',5, now()),
  ('b9000000-0000-4000-8000-00000000f006','b9000000-0000-4000-8000-000000000008','comprovante_aprovado','teste:r6','sending',1, now());

set local role service_role;
select public.registrar_envio_de_push(jsonb_build_array(
  jsonb_build_object('outbox_id','b9000000-0000-4000-8000-00000000f001','device_id',(select id from public.push_devices where expo_token = 'ExponentPushToken[alu-rpc]'),'ticket_id','tk-ok','ok',true),
  jsonb_build_object('outbox_id','b9000000-0000-4000-8000-00000000f004','device_id',(select id from public.push_devices where expo_token = 'ExponentPushToken[alu-rpc]'),'ok',false,'error_code','HTTP_500'),
  jsonb_build_object('outbox_id','b9000000-0000-4000-8000-00000000f005','device_id',(select id from public.push_devices where expo_token = 'ExponentPushToken[alu-rpc]'),'ok',false,'error_code','HTTP_500'),
  jsonb_build_object('outbox_id','b9000000-0000-4000-8000-00000000f006','device_id',(select id from public.push_devices where expo_token = 'ExponentPushToken[alu4]'),'ok',false,'error_code','DeviceNotRegistered')
));
reset role;

do $$
begin
  if (select status from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f001') <> 'sent'
     or (select sent_at from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f001') is null
     or (select status::text || '/' || last_error from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f004') <> 'pending/HTTP_500'
     or (select send_after from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f004') <= now()
     or (select status from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f005') <> 'failed'
     or (select status::text || '/' || last_error from public.notification_outbox where id = 'b9000000-0000-4000-8000-00000000f006') <> 'cancelled/sem_dispositivo'
     or exists (select 1 from public.push_devices where expo_token = 'ExponentPushToken[alu4]')
     or (select count(*) from public.notification_deliveries where outbox_id in (
           'b9000000-0000-4000-8000-00000000f001','b9000000-0000-4000-8000-00000000f004',
           'b9000000-0000-4000-8000-00000000f005','b9000000-0000-4000-8000-00000000f006')) <> 4 then
    raise exception 'FALHOU T16: resultado do envio';
  end if;
  raise notice 'OK T16: enviada, nova tentativa com espera, falha após 5 tentativas e aparelho inexistente apagado';
end $$;

-- =====================================================================
-- T17 — recibos
-- =====================================================================
insert into public.notification_deliveries (id, outbox_id, device_id, expo_ticket_id, ticket_status, created_at) values
  ('b9000000-0000-4000-8000-00000000a001','b9000000-0000-4000-8000-00000000f001',
   (select id from public.push_devices where expo_token = 'ExponentPushToken[alu5]'), 'tk-recibo', 'ok', now() - interval '20 minutes');

set local role service_role;
create temporary table recibos_pendentes on commit drop as
select * from public.pendencias_de_recibo_push(1000);
select public.registrar_recibos_de_push(jsonb_build_array(
  jsonb_build_object('delivery_id','b9000000-0000-4000-8000-00000000a001','ok',false,'error_code','DeviceNotRegistered')
));
reset role;

do $$
begin
  if not exists (select 1 from recibos_pendentes where delivery_id = 'b9000000-0000-4000-8000-00000000a001' and ticket_id = 'tk-recibo')
     or exists (select 1 from recibos_pendentes where ticket_id = 'tk-ok')
     or exists (select 1 from public.push_devices where expo_token = 'ExponentPushToken[alu5]')
     or (select receipt_checked_at from public.notification_deliveries where id = 'b9000000-0000-4000-8000-00000000a001') is null then
    raise exception 'FALHOU T17: recibos';
  end if;
  raise notice 'OK T17: recibo com mais de 15 min é conferido; aparelho inexistente sai da base';
end $$;

-- =====================================================================
-- T18, T19 — limpeza e disparo sem configuração
-- =====================================================================
insert into public.notification_outbox (recipient_id, kind, dedupe_key, status, created_at) values
  ('b9000000-0000-4000-8000-000000000005','comprovante_aprovado','teste:velha','sent', now() - interval '31 days'),
  ('b9000000-0000-4000-8000-000000000005','comprovante_aprovado','teste:recente','sent', now() - interval '29 days');
insert into public.notification_outbox (recipient_id, kind, dedupe_key, send_after) values
  ('b9000000-0000-4000-8000-000000000001','comprovante_enviado','teste:pendente', now() - interval '1 minute');

do $$
begin
  perform public.limpar_notificacoes_antigas(now());
  if exists (select 1 from public.notification_outbox where dedupe_key = 'teste:velha')
     or not exists (select 1 from public.notification_outbox where dedupe_key = 'teste:recente') then
    raise exception 'FALHOU T18: retenção de 30 dias';
  end if;
  raise notice 'OK T18: histórico com mais de 30 dias é apagado';

  -- Sem os segredos no Vault: só avisa, não quebra o cron.
  if not exists (select 1 from vault.decrypted_secrets where name in ('push_project_url', 'push_dispatch_secret')) then
    perform public.disparar_envio_de_push();
  end if;
  raise notice 'OK T19: disparo sem configuração não quebra';
end $$;

-- =====================================================================
-- T20 — portabilidade
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"b9000000-0000-4000-8000-000000000005","role":"authenticated"}';
do $$
declare v jsonb := public.export_my_data();
begin
  if jsonb_array_length(v->'aparelhos_com_notificacao') <> 1 or jsonb_array_length(v->'notificacoes') < 1
     or (v->'notificacoes')::text like '%b9000000-0000-4000-8000-000000000001%' then
    raise exception 'FALHOU T20: export sem aparelhos ou notificações do titular';
  end if;
  raise notice 'OK T20: export traz aparelhos e notificações só do titular';
end $$;

rollback;
