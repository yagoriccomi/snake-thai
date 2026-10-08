-- Regressão do push de versão nova (D45 da coordenação; contrato v7, § 10;
-- migrations 20261008120000 e 20261008120100). Roda numa transação e termina
-- em ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
--   ADM admin com aparelho · PROF professor com aparelho · ALU aluno com dois
--   aparelhos · ALU2 aluno sem aparelho · ALUI inativo com aparelho
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d4500000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'versao-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04','05']) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color) values
  ('d4500000-0000-4000-8000-000000000001','admin','Admin Versao','45000000001',false,'active',null,null),
  ('d4500000-0000-4000-8000-000000000002','professor','Prof Versao','45000000002',false,'active',null,'#454545'),
  ('d4500000-0000-4000-8000-000000000003','user','Aluno Versao','45000000003',false,'active',null,null),
  ('d4500000-0000-4000-8000-000000000004','user','Aluno Sem Aparelho','45000000004',false,'active',null,null);

insert into public.profiles (id, role, name, cpf, is_first_login, status, deactivated_at)
values ('d4500000-0000-4000-8000-000000000005','user','Aluno Inativo Versao','45000000005',false,'inactive', now());

insert into public.push_devices (user_id, expo_token, platform, app_variant) values
  ('d4500000-0000-4000-8000-000000000001', 'ExponentPushToken[v45adm]', 'android', 'production'),
  ('d4500000-0000-4000-8000-000000000002', 'ExponentPushToken[v45prof]', 'android', 'production'),
  ('d4500000-0000-4000-8000-000000000003', 'ExponentPushToken[v45alu]', 'android', 'production'),
  ('d4500000-0000-4000-8000-000000000003', 'ExponentPushToken[v45alub]', 'android', 'production'),
  ('d4500000-0000-4000-8000-000000000005', 'ExponentPushToken[v45alui]', 'android', 'production');

-- =====================================================================
-- V1 e V2 — aluno e professor não avisam
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4500000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform public.avisar_versao_nova('2.0.0');
    raise exception 'FALHOU V1: aluno avisou versão nova';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V1: aluno recebe 42501';
end $$;

set local request.jwt.claims = '{"sub":"d4500000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.avisar_versao_nova('2.0.0');
    raise exception 'FALHOU V2: professor avisou versão nova';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V2: professor recebe 42501';
end $$;

-- =====================================================================
-- V3 — anônimo nem executa
-- =====================================================================
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform public.avisar_versao_nova('2.0.0');
    raise exception 'FALHOU V3: anônimo executou avisar_versao_nova';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK V3: anônimo sem execute';
end $$;

-- =====================================================================
-- V4 a V6 — admin: formato, destinatários e chave
-- =====================================================================
reset role;
-- O banco local pode ter outros perfis com aparelho: a conta é do banco todo,
-- feita aqui porque a RLS de push_devices só mostra ao admin o aparelho dele.
select set_config('teste.esperados', count(distinct d.user_id)::text, true)
  from public.push_devices d join public.profiles p on p.id = d.user_id
 where p.status = 'active' and p.anonymized_at is null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4500000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  v_ruim text;
begin
  foreach v_ruim in array array['v2.0.0', '2.0', '2.0.0-beta', '2.0.0+1', ' 2.0.0', '', 'abc'] loop
    begin
      perform public.avisar_versao_nova(v_ruim);
      raise exception 'FALHOU V4: versão "%" foi aceita', v_ruim;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.avisar_versao_nova(null);
    raise exception 'FALHOU V4: versão nula foi aceita';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK V4: versão fora de X.Y.Z recebe 22023';

  -- A mesma versão, inclusive com zero à esquerda, não repete.
  perform set_config('teste.avisados', public.avisar_versao_nova('2.0.0')::text, true);
  perform set_config('teste.repetidos',
    (public.avisar_versao_nova('2.0.0') + public.avisar_versao_nova('02.0.00'))::text, true);
end $$;

-- A fila só mostra ao admin as linhas dele: a conferência é do sistema.
reset role;
set local request.jwt.claims = '';
do $$
begin
  if current_setting('teste.avisados') <> current_setting('teste.esperados') then
    raise exception 'FALHOU V5: avisou % de % perfis ativos com aparelho',
      current_setting('teste.avisados'), current_setting('teste.esperados');
  end if;
  if (select count(*) from public.notification_outbox o
       where o.kind = 'versao_nova' and o.recipient_id::text like 'd4500000-%') <> 3
     or exists (select 1 from public.notification_outbox o
                 where o.kind = 'versao_nova'
                   and o.recipient_id in ('d4500000-0000-4000-8000-000000000004', 'd4500000-0000-4000-8000-000000000005')) then
    raise exception 'FALHOU V5: destinatários errados (esperados admin, professor e aluno, uma linha cada)';
  end if;
  if exists (select 1 from public.notification_outbox o
              where o.kind = 'versao_nova' and o.recipient_id::text like 'd4500000-%'
                and (o.dedupe_key <> 'versao_nova:2.0.0'
                     or o.data <> '{"major":2,"minor":0,"patch":0}'::jsonb
                     or o.class_id is not null or o.payment_id is not null or o.justification_id is not null)) then
    raise exception 'FALHOU V5: chave ou data fora da § 10';
  end if;
  raise notice 'OK V5: um aviso por perfil ativo com aparelho, com a chave e os três números';

  if current_setting('teste.repetidos') <> '0' then
    raise exception 'FALHOU V6: a mesma versão avisou de novo';
  end if;
  raise notice 'OK V6: repetir a versão não repete o aviso';
end $$;

-- =====================================================================
-- V7 — o dono, no SQL Editor (sem usuário), avisa outra versão
-- =====================================================================
do $$
begin
  if public.avisar_versao_nova('2.0.1') < 3 then
    raise exception 'FALHOU V7: o sistema não avisou a versão 2.0.1';
  end if;
  if not exists (select 1 from public.notification_outbox o
                  where o.recipient_id = 'd4500000-0000-4000-8000-000000000003'
                    and o.dedupe_key = 'versao_nova:2.0.1'
                    and o.data = '{"major":2,"minor":0,"patch":1}'::jsonb) then
    raise exception 'FALHOU V7: aviso da 2.0.1 ausente';
  end if;
  raise notice 'OK V7: sistema (SQL Editor) avisa e versão nova tem chave nova';
end $$;

rollback;
