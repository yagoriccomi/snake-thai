-- Regressão das justificativas novas (bloco 4.8a, migration
-- 20260929170000_justificativas; contrato § 9.1, § 10, § 15). Roda numa
-- transação e termina em ROLLBACK; mesmo assim, rode SÓ no banco local.
--
-- F fixo da turma G (aula C há 2 dias, professor P) · L livre (aula K desta
-- semana, dada por P3) · V à vontade · P2 professor de fora · A admin
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('j8-g', 'J8 Turma G');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d8000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'j8-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 8) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('d8000000-0000-4000-8000-000000000001', 'admin', 'J8 Admin', '68800000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000002', 'professor', 'J8 Prof P', '68800000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000003', 'professor', 'J8 Prof P2', '68800000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000004', 'professor', 'J8 Prof P3', '68800000004', false, 'active', null, '#404040', now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000005', 'user', 'J8 Aluno F', '68800000005', false, 'active', 'j8-g', null, now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000006', 'user', 'J8 Aluno L', '68800000006', false, 'active', null, null, now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000007', 'user', 'J8 Aluno V', '68800000007', false, 'active', null, null, now() - interval '60 days');

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota) values
  ('d8b00000-0000-4000-8000-000000000001', 'J8 Livre 2x', 10000, 'free', 2),
  ('d8b00000-0000-4000-8000-000000000002', 'J8 À vontade', 10000, 'unlimited', null);
insert into public.plan_periods (user_id, plan_id, started_at) values
  ('d8000000-0000-4000-8000-000000000006', 'd8b00000-0000-4000-8000-000000000001', now() - interval '60 days'),
  ('d8000000-0000-4000-8000-000000000007', 'd8b00000-0000-4000-8000-000000000002', now() - interval '60 days');

-- A semana de referência: a desta segunda (K é hoje de manhã, com P3 presente).
insert into public.classes (id, title, type, group_id, date_time, audience, attendance_taken_at) values
  ('d8c00000-0000-4000-8000-000000000001', 'J8 Aula C', 'routine', 'j8-g', now() - interval '2 days', 'both', now() - interval '2 days'),
  ('d8c00000-0000-4000-8000-000000000002', 'J8 Aula antiga', 'routine', 'j8-g', now() - interval '10 days', 'both', now() - interval '10 days'),
  ('d8c00000-0000-4000-8000-000000000003', 'J8 Aula K', 'routine', null,
   greatest(date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '8 hours',
            now() - interval '2 hours'), 'free', now());
insert into public.class_teachers (class_id, teacher_id) values
  ('d8c00000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-000000000002'),
  ('d8c00000-0000-4000-8000-000000000002', 'd8000000-0000-4000-8000-000000000002'),
  ('d8c00000-0000-4000-8000-000000000003', 'd8000000-0000-4000-8000-000000000004');
insert into public.class_teacher_presence (class_id, teacher_id, present, set_by)
values ('d8c00000-0000-4000-8000-000000000003', 'd8000000-0000-4000-8000-000000000004', true,
        'd8000000-0000-4000-8000-000000000004');

insert into public.push_devices (user_id, expo_token, platform, app_variant)
select p.id, 'ExponentPushToken[j8-' || p.id::text || ']', 'android', 'production'
  from public.profiles p where p.id::text like 'd8000000%';

create temp table ctx (chave text primary key, id uuid) on commit drop;
grant select, insert on ctx to authenticated, anon;

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- =====================================================================
-- J1–J3 — enviar
-- =====================================================================
set local role authenticated;

do $$
declare v uuid;
begin
  perform pg_temp.como('d8000000-0000-4000-8000-000000000005');
  v := public.enviar_justificativa('class', 'd8c00000-0000-4000-8000-000000000001', null, 'Atestado médico');
  insert into ctx values ('aula', v);
  begin
    perform public.enviar_justificativa('class', 'd8c00000-0000-4000-8000-000000000001', null, 'De novo');
    raise exception 'FALHOU J2: duas justificativas na mesma aula';
  exception when check_violation then null;
  end;
  begin
    perform public.enviar_justificativa('class', 'd8c00000-0000-4000-8000-000000000002', null, 'Atrasada');
    raise exception 'FALHOU J2: aceitou fora do prazo';
  exception when check_violation then null;
  end;
  begin
    perform public.enviar_justificativa('class', 'd8c00000-0000-4000-8000-000000000001', null, '   ');
    raise exception 'FALHOU J2: aceitou texto vazio';
  exception when invalid_parameter_value then null;
  end;
  -- Anexo enquanto pendente (caminho derivado).
  perform public.anexar_a_justificativa(v);
  begin
    perform public.anexar_a_justificativa(v);
    raise exception 'FALHOU J6: segundo anexo';
  exception when check_violation then null;
  end;

  perform pg_temp.como('d8000000-0000-4000-8000-000000000006');
  insert into ctx values ('semana', public.enviar_justificativa('week', null,
    date_trunc('week', now() at time zone 'America/Sao_Paulo')::date, 'Viagem de trabalho'));

  perform pg_temp.como('d8000000-0000-4000-8000-000000000007');
  begin
    perform public.enviar_justificativa('week', null, date_trunc('week', now() at time zone 'America/Sao_Paulo')::date, 'x');
    raise exception 'FALHOU J3: à vontade justificou a semana';
  exception when check_violation then null;
  end;
  raise notice 'OK J1–J3, J6: envia de aula e de semana, com prazo, texto, uma por aula e o anexo derivado';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  v_aula uuid := (select id from ctx where chave = 'aula');
  v_semana uuid := (select id from ctx where chave = 'semana');
begin
  if (select proof_public_id from public.absence_justifications where id = v_aula)
     <> 'justificativas/d8000000-0000-4000-8000-000000000005/' || v_aula::text then
    raise exception 'FALHOU J6: caminho do anexo';
  end if;
  -- Avisos: a de aula vai à equipe da aula; a de semana, a quem deu aula na semana (T18).
  if not exists (select 1 from public.notification_outbox where recipient_id = 'd8000000-0000-4000-8000-000000000002'
                  and dedupe_key = 'justificativa_pendente:' || v_aula)
     or not exists (select 1 from public.notification_outbox where recipient_id = 'd8000000-0000-4000-8000-000000000004'
                     and dedupe_key = 'justificativa_pendente:' || v_semana)
     or exists (select 1 from public.notification_outbox where recipient_id = 'd8000000-0000-4000-8000-000000000002'
                 and dedupe_key = 'justificativa_pendente:' || v_semana) then
    raise exception 'FALHOU J1: destinatários do aviso';
  end if;
  raise notice 'OK J1b: o aviso vai a quem pode decidir';
end $$;

-- =====================================================================
-- J4–J5 — quem vê e quem decide
-- =====================================================================
set local role authenticated;

do $$
declare n int;
begin
  perform pg_temp.como('d8000000-0000-4000-8000-000000000002');
  select count(*) into n from public.absence_justifications where user_id::text like 'd8000000%';
  if n <> 1 then
    raise exception 'FALHOU J4: o professor da aula viu % justificativas (esperado 1, a da aula dele)', n;
  end if;

  perform pg_temp.como('d8000000-0000-4000-8000-000000000003');
  select count(*) into n from public.absence_justifications where user_id::text like 'd8000000%';
  if n <> 0 then
    raise exception 'FALHOU J4: professor de fora viu justificativas';
  end if;
  begin
    perform public.decidir_justificativa((select id from ctx where chave = 'aula'), 'approved', 'ok');
    raise exception 'FALHOU J5: professor de fora decidiu';
  exception when insufficient_privilege then null;
  end;

  -- § 15: o APK 1.8 decide por UPDATE direto e recebe "Atualize o aplicativo".
  perform pg_temp.como('d8000000-0000-4000-8000-000000000002');
  begin
    update public.absence_justifications set status = 'approved', reviewed_at = now()
     where id = (select id from ctx where chave = 'aula');
    raise exception 'FALHOU J11: decisão por UPDATE direto passou';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.decidir_justificativa((select id from ctx where chave = 'aula'), 'rejected', '  ');
    raise exception 'FALHOU J5: decidiu sem nota';
  exception when invalid_parameter_value then null;
  end;
  perform public.decidir_justificativa((select id from ctx where chave = 'aula'), 'rejected', 'Atestado ilegível');

  -- Decidida, o atestado sai da vista do professor (D22).
  select count(*) into n from public.absence_justifications where id = (select id from ctx where chave = 'aula');
  if n <> 0 then
    raise exception 'FALHOU J4: o professor continuou vendo a justificativa decidida';
  end if;
  raise notice 'OK J4, J5, J11: só quem decide vê enquanto pendente, com nota obrigatória; o UPDATE direto pede o app novo';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare v_aula uuid := (select id from ctx where chave = 'aula');
begin
  if (select status || '/' || coalesce(reviewed_by::text, 'nulo') from public.absence_justifications where id = v_aula) <> 'rejected/nulo'
     or (select reviewer_id from public.absence_justification_reviews where justification_id = v_aula) <> 'd8000000-0000-4000-8000-000000000002'
     or not exists (select 1 from public.notification_outbox where recipient_id = 'd8000000-0000-4000-8000-000000000005'
                     and dedupe_key = 'justificativa_negada:' || v_aula || ':1' and data ->> 'tentativa' = '1') then
    raise exception 'FALHOU J5: negativa sem esconder quem negou, sem revisão ou sem aviso';
  end if;
  raise notice 'OK J5b: a negativa esconde quem negou (D16) e avisa o aluno';
end $$;

-- =====================================================================
-- J7 — reenviar (D42, T16)
-- =====================================================================
set local role authenticated;

do $$
declare
  v_aula uuid := (select id from ctx where chave = 'aula');
  r record;
begin
  perform pg_temp.como('d8000000-0000-4000-8000-000000000005');
  select * into r from public.minhas_justificativas() m where m.id = v_aula;
  if not r.can_resend or r.resend_until is null or r.approved_by_name is not null then
    raise exception 'FALHOU J7: minhas_justificativas antes do reenvio';
  end if;
  perform public.reenviar_justificativa(v_aula, 'Segue o atestado legível');
  perform public.anexar_a_justificativa(v_aula);
  begin
    perform public.reenviar_justificativa(v_aula, 'De novo');
    raise exception 'FALHOU J7: reenviou uma pendente';
  exception when check_violation then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare v_aula uuid := (select id from ctx where chave = 'aula');
begin
  if (select status || '/' || attempt || '/' || message from public.absence_justifications where id = v_aula)
     <> 'pending/2/Segue o atestado legível'
     or (select proof_public_id from public.absence_justifications where id = v_aula) not like '%-2'
     or (select review_note from public.absence_justification_attempts where justification_id = v_aula) <> 'Atestado ilegível'
     or (select proof_public_id from public.absence_justification_attempts where justification_id = v_aula) is null
     or exists (select 1 from public.media_deletion_queue where justification_id = v_aula)
     or exists (select 1 from public.absence_justification_reviews where justification_id = v_aula)
     or not exists (select 1 from public.notification_outbox where dedupe_key = 'justificativa_pendente:' || v_aula || ':2') then
    raise exception 'FALHOU J7: o reenvio não guardou a tentativa 1 ou mandou o anexo antigo para a fila';
  end if;
  raise notice 'OK J7: reenvio guarda a tentativa 1 para o admin, sem apagar o anexo dela, e avisa de novo';
end $$;

-- =====================================================================
-- J8–J10 — segunda negativa, aprovação e as leituras
-- =====================================================================
set local role authenticated;

do $$
declare r record;
begin
  perform pg_temp.como('d8000000-0000-4000-8000-000000000001');
  if not exists (select 1 from public.justificativas_para_revisar() j where j.id = (select id from ctx where chave = 'aula')) then
    raise exception 'FALHOU J9: o admin não vê a pendente';
  end if;
  perform public.decidir_justificativa((select id from ctx where chave = 'aula'), 'rejected', 'Continua ilegível');

  perform pg_temp.como('d8000000-0000-4000-8000-000000000004');
  if (select count(*) from public.justificativas_para_revisar()) <> 1 then
    raise exception 'FALHOU J9: P3 deveria ver só a semanal';
  end if;
  perform public.decidir_justificativa((select id from ctx where chave = 'semana'), 'approved', 'Ok');

  perform pg_temp.como('d8000000-0000-4000-8000-000000000006');
  select * into r from public.minhas_justificativas() m where m.id = (select id from ctx where chave = 'semana');
  if r.approved_by_name <> 'J8 Prof P3' then
    raise exception 'FALHOU J8: aprovada sem o nome de quem aprovou (D16)';
  end if;

  perform pg_temp.como('d8000000-0000-4000-8000-000000000005');
  select * into r from public.minhas_justificativas() m where m.id = (select id from ctx where chave = 'aula');
  if r.can_resend or r.status <> 'rejected' then
    raise exception 'FALHOU J8: a segunda negativa ainda deixa reenviar';
  end if;

  -- J10: o professor vê o histórico sem nota nem quem negou; o admin vê tudo.
  perform pg_temp.como('d8000000-0000-4000-8000-000000000002');
  select * into r from public.justificativas_do_aluno('d8000000-0000-4000-8000-000000000005') j where j.id = (select id from ctx where chave = 'aula');
  if r.review_note is not null or r.reviewed_by_name is not null or r.first_attempt is not null then
    raise exception 'FALHOU J10: professor viu nota ou quem negou';
  end if;
  begin
    perform * from public.justificativas_do_aluno();
    raise exception 'FALHOU J10: professor listou todas';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como('d8000000-0000-4000-8000-000000000001');
  select * into r from public.justificativas_do_aluno('d8000000-0000-4000-8000-000000000005') j where j.id = (select id from ctx where chave = 'aula');
  if r.review_note <> 'Continua ilegível' or r.reviewed_by_name <> 'J8 Admin' or r.first_attempt ->> 'review_note' <> 'Atestado ilegível' then
    raise exception 'FALHOU J10: o admin não viu o histórico completo';
  end if;
  raise notice 'OK J8–J10: segunda negativa encerra, aprovação mostra quem aprovou, histórico por papel';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  if not exists (select 1 from public.notification_outbox
                  where dedupe_key = 'justificativa_negada:' || (select id from ctx where chave = 'aula') || ':2'
                    and data ->> 'tentativa' = '2')
     or not exists (select 1 from public.notification_outbox
                     where dedupe_key = 'justificativa_aprovada:' || (select id from ctx where chave = 'semana') || ':1') then
    raise exception 'FALHOU J8: avisos da segunda negativa ou da aprovação';
  end if;
  raise notice 'OK J8b: avisos com a tentativa';
end $$;

-- =====================================================================
-- J13 — C11: o anexo da forma nova só pela RPC; o legado (§ 15) segue
-- =====================================================================
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.classes (id, title, type, group_id, date_time, audience, attendance_taken_at) values
  ('d8c00000-0000-4000-8000-000000000004', 'J8 Aula D', 'routine', 'j8-g', now() - interval '1 day', 'both', now() - interval '1 day');
insert into public.class_teachers (class_id, teacher_id) values
  ('d8c00000-0000-4000-8000-000000000004', 'd8000000-0000-4000-8000-000000000002');

set local role authenticated;

do $$
declare
  v_id uuid := gen_random_uuid();
  v_legado text := 'justificativas/d8000000-0000-4000-8000-000000000005/d8c00000-0000-4000-8000-000000000004';
begin
  perform pg_temp.como('d8000000-0000-4000-8000-000000000005');
  -- O upsert do APK 1.8/1.9 e da web atual: caminho por aula, escrito pelo dono.
  insert into public.absence_justifications (id, class_id, user_id, message, proof_provider, proof_public_id)
  values (v_id, 'd8c00000-0000-4000-8000-000000000004', 'd8000000-0000-4000-8000-000000000005',
          'Consulta', 'cloudinary', v_legado);
  insert into ctx values ('c11', v_id);

  begin
    update public.absence_justifications
       set proof_public_id = 'justificativas/d8000000-0000-4000-8000-000000000005/' || v_id::text
     where id = v_id;
    raise exception 'FALHOU J13: o dono gravou o caminho novo direto';
  exception when insufficient_privilege then null;
  end;

  -- O legado o dono ainda tira; o novo vem da RPC.
  update public.absence_justifications set proof_provider = null, proof_public_id = null where id = v_id;
  perform public.anexar_a_justificativa(v_id);

  begin
    update public.absence_justifications set proof_provider = null, proof_public_id = null where id = v_id;
    raise exception 'FALHOU J13: o dono removeu o anexo da forma nova';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.absence_justifications set proof_provider = 'cloudinary', proof_public_id = v_legado where id = v_id;
    raise exception 'FALHOU J13: o dono trocou o anexo da forma nova pelo legado';
  exception when insufficient_privilege then null;
  end;
  -- O texto continua do dono, com o anexo intacto.
  update public.absence_justifications set message = 'Consulta, segue o atestado' where id = v_id;

  perform pg_temp.como('d8000000-0000-4000-8000-000000000006');
  begin
    insert into public.absence_justifications (id, user_id, scope, week_start, message, proof_provider, proof_public_id)
    values (gen_random_uuid(), 'd8000000-0000-4000-8000-000000000006', 'week',
            date_trunc('week', now() at time zone 'America/Sao_Paulo')::date, 'x', 'cloudinary',
            'justificativas/d8000000-0000-4000-8000-000000000006/' || v_id::text);
    raise exception 'FALHOU J13: a semana nasceu com anexo escrito pelo dono';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare v_id uuid := (select id from ctx where chave = 'c11');
begin
  if (select message || '|' || proof_public_id from public.absence_justifications where id = v_id)
     <> 'Consulta, segue o atestado|justificativas/d8000000-0000-4000-8000-000000000005/' || v_id::text then
    raise exception 'FALHOU J13: texto ou anexo da forma nova';
  end if;
  -- A constraint amarra o sufixo à tentativa, mesmo para o sistema.
  begin
    update public.absence_justifications
       set proof_public_id = 'justificativas/d8000000-0000-4000-8000-000000000005/' || v_id::text || '-2'
     where id = v_id;
    raise exception 'FALHOU J13: -2 na tentativa 1';
  exception when check_violation then null;
  end;
  begin
    update public.absence_justifications set attempt = 2 where id = v_id;
    raise exception 'FALHOU J13: caminho sem -2 na tentativa 2';
  exception when check_violation then null;
  end;
  raise notice 'OK J13: o anexo da forma nova só pela RPC, imutável no UPDATE direto, com o sufixo da tentativa; o legado segue';
end $$;

-- =====================================================================
-- J12 — anônimo
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.enviar_justificativa('class', gen_random_uuid(), null, 'x');
    raise exception 'FALHOU J12: anônimo enviou';
  exception when insufficient_privilege then
    raise notice 'OK J12: anônimo recebe 42501';
  end;
end $$;

reset role;
rollback;
