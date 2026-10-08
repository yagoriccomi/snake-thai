-- Regressão do push de versão nova (D49 e D54 a D56 da coordenação; contrato
-- v7, § 10; migrations 20261008120000 e 20261008120100). Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Versão vigente nos testes: 2.10.0 — de propósito com dois dígitos, para
-- pegar comparação de texto ("2.9.5" > "2.10.0" como texto).
--
--   ADM  admin, aparelho 2.10.0 (em dia)
--   PROF professor, aparelho 2.9.5 (desatualizado)
--   ALU  aluno, um aparelho 2.10.0 e outro sem versão (APK 1.8)
--   ALU2 aluno sem aparelho
--   ALUI inativo, aparelho sem versão
--   ALU3 aluno, aparelho 3.0.0 (acima da vigente)
\set ON_ERROR_STOP on

begin;

insert into public.academy_settings (id) values (true) on conflict (id) do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d4900000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'versao-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04','05','06']) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color) values
  ('d4900000-0000-4000-8000-000000000001','admin','Admin Versao','49000000001',false,'active',null,null),
  ('d4900000-0000-4000-8000-000000000002','professor','Prof Versao','49000000002',false,'active',null,'#494949'),
  ('d4900000-0000-4000-8000-000000000003','user','Aluno Versao','49000000003',false,'active',null,null),
  ('d4900000-0000-4000-8000-000000000004','user','Aluno Sem Aparelho','49000000004',false,'active',null,null),
  ('d4900000-0000-4000-8000-000000000006','user','Aluno Adiantado','49000000006',false,'active',null,null);

insert into public.profiles (id, role, name, cpf, is_first_login, status, deactivated_at)
values ('d4900000-0000-4000-8000-000000000005','user','Aluno Inativo Versao','49000000005',false,'inactive', now());

insert into public.push_devices (user_id, expo_token, platform, app_variant, app_version) values
  ('d4900000-0000-4000-8000-000000000001', 'ExponentPushToken[v49adm]', 'android', 'production', '2.10.0'),
  ('d4900000-0000-4000-8000-000000000002', 'ExponentPushToken[v49prof]', 'android', 'production', '2.9.5'),
  ('d4900000-0000-4000-8000-000000000003', 'ExponentPushToken[v49alu]', 'android', 'production', '2.10.0'),
  ('d4900000-0000-4000-8000-000000000003', 'ExponentPushToken[v49alub]', 'android', 'production', null),
  ('d4900000-0000-4000-8000-000000000005', 'ExponentPushToken[v49alui]', 'android', 'production', null),
  ('d4900000-0000-4000-8000-000000000006', 'ExponentPushToken[v49alu3]', 'android', 'production', '3.0.0');

-- =====================================================================
-- V1 — o formato da versão
-- =====================================================================
do $$
declare
  v_ruim text;
begin
  if public.normalizar_versao_do_app('02.10.00') <> '2.10.0' or public.normalizar_versao_do_app('2.0.0') <> '2.0.0' then
    raise exception 'FALHOU V1: normalização errada';
  end if;
  foreach v_ruim in array array['v2.0.0', '2.0', '2.0.0-beta', '2.0.0+1', ' 2.0.0', '', 'abc', '12345.0.0'] loop
    if public.normalizar_versao_do_app(v_ruim) is not null then
      raise exception 'FALHOU V1: "%" foi aceita', v_ruim;
    end if;
  end loop;
  -- '02.0.0' normaliza para outra coisa; 'v2.0.0' normaliza para nulo, que
  -- num CHECK comum passaria.
  foreach v_ruim in array array['02.0.0', 'v2.0.0'] loop
    begin
      insert into public.push_devices (user_id, expo_token, platform, app_variant, app_version)
      values ('d4900000-0000-4000-8000-000000000004', 'ExponentPushToken[v49ruim]', 'android', 'production', v_ruim);
      raise exception 'FALHOU V1: push_devices aceitou "%"', v_ruim;
    exception when check_violation then null;
    end;
  end loop;
  begin
    update public.academy_settings set current_app_version = 'v2.0.0' where id;
    raise exception 'FALHOU V1: academy_settings aceitou versão fora do formato';
  exception when check_violation then null;
  end;
  raise notice 'OK V1: só X.Y.Z normalizado, nas funções e nas duas colunas';
end $$;

-- =====================================================================
-- V2 a V4 — aluno, professor e anônimo não definem a versão vigente
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4900000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform public.definir_versao_vigente_do_app('2.10.0');
    raise exception 'FALHOU V2: aluno definiu a versão vigente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V2: aluno recebe 42501';
end $$;

set local request.jwt.claims = '{"sub":"d4900000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.definir_versao_vigente_do_app('2.10.0');
    raise exception 'FALHOU V3: professor definiu a versão vigente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V3: professor recebe 42501';
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform public.definir_versao_vigente_do_app('2.10.0');
    raise exception 'FALHOU V4: anônimo definiu a versão vigente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V4: anônimo sem execute';
end $$;

-- =====================================================================
-- V5 — admin: formato inválido é erro; válido é gravado normalizado
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4900000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  v_ruim text;
begin
  foreach v_ruim in array array['v2.0.0', '2.0', '2.0.0-beta', '2.0.0+1', '', 'abc'] loop
    begin
      perform public.definir_versao_vigente_do_app(v_ruim);
      raise exception 'FALHOU V5: versão "%" foi aceita', v_ruim;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if public.definir_versao_vigente_do_app('02.10.00') <> '2.10.0' then
    raise exception 'FALHOU V5: não devolveu a versão normalizada';
  end if;
end $$;

reset role;
set local request.jwt.claims = '';
do $$
declare
  -- definir usa o relógio real: a chave é a da semana de hoje.
  v_chave text := 'versao_nova:2.10.0:' || to_char(now() at time zone 'America/Sao_Paulo', 'IYYY-"W"IW');
begin
  if (select s.current_app_version from public.academy_settings s) is distinct from '2.10.0' then
    raise exception 'FALHOU V5: versão vigente não gravada';
  end if;
  -- D55: definir já avisa os desatualizados, sem comando extra.
  if (select count(*) from public.notification_outbox o
       where o.kind = 'versao_nova' and o.recipient_id::text like 'd4900000-%') <> 2
     or (select count(*) from public.notification_outbox o
          where o.kind = 'versao_nova' and o.dedupe_key = v_chave
            and o.recipient_id in ('d4900000-0000-4000-8000-000000000002', 'd4900000-0000-4000-8000-000000000003')) <> 2 then
    raise exception 'FALHOU V5: definir a versão não enfileirou o aviso aos dois desatualizados';
  end if;
  raise notice 'OK V5: admin grava a vigente normalizada e já enfileira o aviso (D55); formato ruim recebe 22023';
end $$;

-- Os próximos testes usam semanas fixas: sai o aviso da semana real.
delete from public.notification_outbox o
 where o.kind = 'versao_nova' and o.recipient_id::text like 'd4900000-%';

-- =====================================================================
-- V6 — o envio da semana: só os desatualizados ativos, uma linha cada
--
-- Sexta, 16/10/2026, 20h em São Paulo = semana ISO 2026-W42 (D54).
-- =====================================================================
do $$
begin
  if public.enfileirar_avisos_de_versao_nova('2026-10-16 23:00:00+00') < 2 then
    raise exception 'FALHOU V6: enfileirou menos que os dois desatualizados do teste';
  end if;
  if (select count(*) from public.notification_outbox o
       where o.kind = 'versao_nova' and o.recipient_id::text like 'd4900000-%') <> 2
     or (select count(*) from public.notification_outbox o
          where o.kind = 'versao_nova'
            and o.recipient_id in ('d4900000-0000-4000-8000-000000000002', 'd4900000-0000-4000-8000-000000000003')) <> 2 then
    raise exception 'FALHOU V6: destinatários errados (esperados professor 2.9.5 e aluno com aparelho sem versão)';
  end if;
  if exists (select 1 from public.notification_outbox o
              where o.kind = 'versao_nova' and o.recipient_id::text like 'd4900000-%'
                and (o.dedupe_key <> 'versao_nova:2.10.0:2026-W42'
                     or o.data <> '{}'::jsonb
                     or o.class_id is not null or o.payment_id is not null or o.justification_id is not null)) then
    raise exception 'FALHOU V6: chave ou data fora da § 10';
  end if;
  raise notice 'OK V6: só os desatualizados (comparação numérica, sem versão conta), com a chave da versão e da semana';
end $$;

-- =====================================================================
-- V7 — a mesma versão na mesma semana não reenvia (de segunda 0h a
-- domingo 23:30 em SP)
-- =====================================================================
do $$
begin
  if public.enfileirar_avisos_de_versao_nova('2026-10-12 03:00:00+00') <> 0
     or public.enfileirar_avisos_de_versao_nova('2026-10-16 23:00:00+00') <> 0
     or public.enfileirar_avisos_de_versao_nova('2026-10-19 02:30:00+00') <> 0 then
    raise exception 'FALHOU V7: reenviou na mesma semana';
  end if;
  raise notice 'OK V7: a mesma versão na mesma semana (no fuso de São Paulo) não reenvia';
end $$;

-- =====================================================================
-- V8 — na semana seguinte, quem continua desatualizado recebe de novo
-- =====================================================================
update public.push_devices set app_version = '2.10.0' where expo_token = 'ExponentPushToken[v49prof]';
do $$
begin
  perform public.enfileirar_avisos_de_versao_nova('2026-10-23 23:00:00+00');
  if not exists (select 1 from public.notification_outbox o
                  where o.recipient_id = 'd4900000-0000-4000-8000-000000000003'
                    and o.dedupe_key = 'versao_nova:2.10.0:2026-W43')
     or exists (select 1 from public.notification_outbox o
                 where o.recipient_id = 'd4900000-0000-4000-8000-000000000002'
                   and o.dedupe_key = 'versao_nova:2.10.0:2026-W43') then
    raise exception 'FALHOU V8: a semana seguinte não seguiu quem continua (ou não) desatualizado';
  end if;
  raise notice 'OK V8: semana nova avisa de novo só quem não atualizou';
end $$;

-- =====================================================================
-- V8b — D56: versão nova na mesma semana avisa de novo; a repetição da
-- mesma versão continua uma por semana
--
-- Na W43, o aluno já recebeu o aviso da 2.10.0 (V8). A 2.11.0 sai no
-- sábado, 24/10 (ainda W43): aluno, professor e admin (os dois em 2.10.0)
-- recebem.
-- O update direto, e não definir, porque definir usa o relógio real.
-- =====================================================================
update public.academy_settings set current_app_version = '2.11.0' where id;
do $$
begin
  if public.enfileirar_avisos_de_versao_nova('2026-10-24 15:00:00+00') <> 3 then
    raise exception 'FALHOU V8b: a versão nova não avisou os três desatualizados na mesma semana';
  end if;
  if (select count(*) from public.notification_outbox o
       where o.dedupe_key = 'versao_nova:2.11.0:2026-W43'
         and o.recipient_id in ('d4900000-0000-4000-8000-000000000001', 'd4900000-0000-4000-8000-000000000002',
                                'd4900000-0000-4000-8000-000000000003')) <> 3 then
    raise exception 'FALHOU V8b: chave da versão nova errada';
  end if;
  if public.enfileirar_avisos_de_versao_nova('2026-10-25 20:00:00+00') <> 0 then
    raise exception 'FALHOU V8b: a mesma versão nova repetiu na mesma semana';
  end if;
  raise notice 'OK V8b: cada versão nova avisa de novo; a mesma versão, uma vez por semana (D56)';
end $$;

-- =====================================================================
-- V9 — sem versão vigente, o push semanal fica desligado
-- =====================================================================
do $$
declare
  v_antes bigint := (select count(*) from public.notification_outbox o where o.kind = 'versao_nova');
begin
  -- Duas instruções: na mesma, a leitura usaria o snapshot de antes do update.
  if public.definir_versao_vigente_do_app(null) is not null then
    raise exception 'FALHOU V9: desligar não devolveu nulo';
  end if;
  if (select s.current_app_version from public.academy_settings s) is not null then
    raise exception 'FALHOU V9: o sistema não desligou a versão vigente';
  end if;
  if public.enfileirar_avisos_de_versao_nova('2026-10-30 23:00:00+00') <> 0
     or (select count(*) from public.notification_outbox o where o.kind = 'versao_nova') <> v_antes then
    raise exception 'FALHOU V9: enfileirou sem versão vigente';
  end if;
  raise notice 'OK V9: o sistema (SQL Editor) desliga com nulo, e nada é enfileirado';
end $$;

-- =====================================================================
-- V10 — o app informa a versão ao registrar o aparelho
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4900000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  perform public.registrar_dispositivo_push('ExponentPushToken[v49reg]', 'android', 'production', '02.1.0');
  perform set_config('teste.v10_com', (select d.app_version from public.push_devices d
                                         where d.expo_token = 'ExponentPushToken[v49reg]'), true);
  -- O APK 1.8 chama com três argumentos: volta a nulo (desatualizado).
  perform public.registrar_dispositivo_push(p_token => 'ExponentPushToken[v49reg]', p_plataforma => 'android', p_variante => 'production');
  perform set_config('teste.v10_sem', coalesce((select d.app_version from public.push_devices d
                                                  where d.expo_token = 'ExponentPushToken[v49reg]'), 'nulo'), true);
  begin
    perform public.registrar_dispositivo_push('ExponentPushToken[v49reg]', 'android', 'production', '2.1.0+5');
    raise exception 'FALHOU V10: aceitou versão com sufixo';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;
set local request.jwt.claims = '';
do $$
begin
  if current_setting('teste.v10_com') <> '2.1.0' then
    raise exception 'FALHOU V10: versão informada não gravada normalizada (%)', current_setting('teste.v10_com');
  end if;
  if current_setting('teste.v10_sem') <> 'nulo' then
    raise exception 'FALHOU V10: a chamada sem versão manteve a versão antiga';
  end if;
  raise notice 'OK V10: grava a versão normalizada, três argumentos gravam nulo, inválida recebe 22023';
end $$;

-- =====================================================================
-- V11 — portabilidade: a versão aparece nos aparelhos do export
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4900000-0000-4000-8000-000000000006","role":"authenticated"}';
do $$
declare
  v jsonb := public.export_my_data();
begin
  if v->'aparelhos_com_notificacao'->0->>'versao_do_app' is distinct from '3.0.0' then
    raise exception 'FALHOU V11: export sem versao_do_app';
  end if;
  raise notice 'OK V11: export traz a versão do app do aparelho';
end $$;

-- =====================================================================
-- V12 — permissões e o agendamento
-- =====================================================================
reset role;
set local request.jwt.claims = '';
do $$
begin
  if has_function_privilege('anon', 'public.enfileirar_avisos_de_versao_nova(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.enfileirar_avisos_de_versao_nova(timestamptz)', 'execute') then
    raise exception 'FALHOU V12: o app consegue disparar o push semanal';
  end if;
  if has_function_privilege('anon', 'public.normalizar_versao_do_app(text)', 'execute')
     or has_function_privilege('anon', 'public.registrar_dispositivo_push(text, public.push_platform, public.app_variant, text)', 'execute') then
    raise exception 'FALHOU V12: anônimo executa função de versão';
  end if;
  if not exists (select 1 from cron.job j
                  where j.jobname = 'push-versao-nova-semanal'
                    and j.schedule = '0 23 * * 5'
                    and j.command like '%enfileirar_avisos_de_versao_nova()%') then
    raise exception 'FALHOU V12: agendamento semanal ausente';
  end if;
  raise notice 'OK V12: só o sistema dispara; o cron roda sexta 23:00 UTC (20h em SP, D54)';
end $$;

rollback;
