-- Regressão da senha de primeiro acesso protegida (migration
-- 20260916220151_senha_padrao_protegida). Roda numa transação e termina em
-- ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('5e000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','senha-adm@t.invalid','x',now(),now(),now()),
  ('5e000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','senha-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status) values
  ('5e000000-0000-4000-8000-000000000001','admin','Admin Senha','55000000001',false,'active'),
  ('5e000000-0000-4000-8000-000000000002','user','Aluno Senha','55000000002',true,'active');

-- Estado conhecido, pelo caminho do servidor.
update public.academy_secrets set default_student_password = 'SenhaDoBalcao#1' where id = true;

-- =====================================================================
-- T1 — aluno não lê a senha por nenhum caminho
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"5e000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare v text;
begin
  select default_student_password into v from public.academy_settings where id = true;
  if v is distinct from '********' then
    raise exception 'FALHOU T1: aluno leu % na configuração', v;
  end if;
  begin
    perform 1 from public.academy_secrets;
    raise exception 'FALHOU T1: aluno leu a tabela protegida';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.senha_padrao_da_academia();
    raise exception 'FALHOU T1: aluno leu pela função';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.definir_senha_padrao_da_academia('OutraSenha#2');
    raise exception 'FALHOU T1: aluno trocou a senha';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.contas_sem_primeiro_acesso();
    raise exception 'FALHOU T1: aluno contou as contas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T1: aluno não lê nem troca a senha de primeiro acesso';
end $$;

-- =====================================================================
-- T2, T3 — admin lê e troca pela função; validação
-- =====================================================================
set local request.jwt.claims = '{"sub":"5e000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  if public.senha_padrao_da_academia() is distinct from 'SenhaDoBalcao#1' then
    raise exception 'FALHOU T2: admin não leu a senha vigente';
  end if;
  perform public.definir_senha_padrao_da_academia('NovaSenha#2026');
  if public.senha_padrao_da_academia() is distinct from 'NovaSenha#2026' then
    raise exception 'FALHOU T2: troca não gravada';
  end if;
  if public.contas_sem_primeiro_acesso() < 1 then
    raise exception 'FALHOU T2: conta sem primeiro acesso não contada';
  end if;
  raise notice 'OK T2: admin lê, troca e vê quantas contas ainda não entraram';

  begin
    perform public.definir_senha_padrao_da_academia('curta');
    raise exception 'FALHOU T3: senha curta aceita';
  exception when check_violation then null;
  end;
  begin
    perform public.definir_senha_padrao_da_academia('********');
    raise exception 'FALHOU T3: a máscara foi aceita como senha';
  exception when check_violation then null;
  end;
  raise notice 'OK T3: senha curta e a própria máscara são recusadas';
end $$;

-- =====================================================================
-- T4 — caminho do APK 1.6.0: grava na coluna antiga, vai para a protegida
-- =====================================================================
update public.academy_settings set default_student_password = 'DoAppAntigo#9' where id = true;
update public.academy_settings set default_student_password = '********', academy_name = academy_name where id = true;
do $$
begin
  if public.senha_padrao_da_academia() is distinct from 'DoAppAntigo#9' then
    raise exception 'FALHOU T4: o que o app antigo gravou não chegou à tabela protegida';
  end if;
  if (select default_student_password from public.academy_settings where id = true) <> '********' then
    raise exception 'FALHOU T4: a coluna antiga guardou a senha em claro';
  end if;
  raise notice 'OK T4: app antigo continua salvando, e a coluna guarda só a máscara';
end $$;

reset role;

-- T5 — auditoria nunca vê a senha
do $$
begin
  if exists (select 1 from public.audit_log
              where entity = 'academy_settings'
                and changes::text like any (array['%DoAppAntigo#9%', '%NovaSenha#2026%', '%SenhaDoBalcao#1%'])) then
    raise exception 'FALHOU T5: senha registrada na auditoria';
  end if;
  if has_table_privilege('anon', 'public.academy_secrets', 'select')
     or has_table_privilege('authenticated', 'public.academy_secrets', 'select')
     or not has_table_privilege('service_role', 'public.academy_secrets', 'select') then
    raise exception 'FALHOU T5: permissões da tabela protegida';
  end if;
  raise notice 'OK T5: auditoria sem senha; tabela protegida só para o servidor';
end $$;

rollback;
