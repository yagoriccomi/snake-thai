-- Regressão do aluno que não usa o aplicativo (migration 20260923100000).
-- Roda numa transação e termina em ROLLBACK; mesmo assim, rode SÓ no banco
-- local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('5e000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','semapp-adm@t.invalid','x',now(),now(),now()),
  ('5e000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','semapp-alu@t.invalid','x',now(),now(),now()),
  ('5e000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','semapp-alu2@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status) values
  ('5e000000-0000-4000-8000-000000000001','admin','Admin Sem App','99000000001',false,'active');

-- =====================================================================
-- S1 — o padrão continua sendo o aplicativo
-- =====================================================================
do $$
begin
  insert into public.profiles (id, role, is_first_login, status)
  values ('5e000000-0000-4000-8000-000000000002','user',true,'active');
  if (select access_channel from public.profiles where id = '5e000000-0000-4000-8000-000000000002') <> 'app' then
    raise exception 'FALHOU S1: o padrão deixou de ser app';
  end if;
  raise notice 'OK S1: quem é cadastrado sem dizer nada usa o aplicativo';
end $$;

-- =====================================================================
-- S2 — sem acesso e sem nome é recusado
-- =====================================================================
do $$
begin
  begin
    insert into public.profiles (id, role, is_first_login, status, access_channel)
    values ('5e000000-0000-4000-8000-000000000003','user',true,'active','none');
    raise exception 'FALHOU S2: aluno sem acesso entrou sem nome';
  exception when check_violation then null;
  end;
  raise notice 'OK S2: sem acesso exige nome — senão a chamada mostra aluno sem nome';
end $$;

-- =====================================================================
-- S3 — sem acesso e sem CPF também é recusado
-- =====================================================================
do $$
begin
  begin
    insert into public.profiles (id, role, name, is_first_login, status, access_channel)
    values ('5e000000-0000-4000-8000-000000000003','user','Aluna do iPhone',true,'active','none');
    raise exception 'FALHOU S3: aluno sem acesso entrou sem CPF';
  exception when check_violation then null;
  end;
  raise notice 'OK S3: sem acesso exige CPF';
end $$;

-- =====================================================================
-- S4 — com nome e CPF, entra
-- =====================================================================
do $$
begin
  insert into public.profiles (id, role, name, cpf, is_first_login, status, access_channel)
  values ('5e000000-0000-4000-8000-000000000003','user','Aluna do iPhone','99000000003',true,'active','none');
  if (select name from public.profiles where id = '5e000000-0000-4000-8000-000000000003') is null then
    raise exception 'FALHOU S4: o nome não foi gravado';
  end if;
  raise notice 'OK S4: aluno sem acesso entra com os dados preenchidos';
end $$;

-- =====================================================================
-- S5 — nome em branco não vale como nome
-- =====================================================================
do $$
begin
  begin
    update public.profiles set name = '   '
     where id = '5e000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU S5: nome em branco aceito para quem não acessa';
  exception when check_violation then null;
  end;
  raise notice 'OK S5: nome em branco é recusado';
end $$;

-- =====================================================================
-- S6 — canal desconhecido é recusado
-- =====================================================================
do $$
begin
  begin
    update public.profiles set access_channel = 'telepatia'
     where id = '5e000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU S6: canal inventado aceito';
  exception when check_violation then null;
  end;
  raise notice 'OK S6: só os canais previstos são aceitos';
end $$;

-- =====================================================================
-- S7 — o aluno não muda o próprio canal de acesso
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"5e000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    update public.profiles set access_channel = 'app'
     where id = '5e000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU S7: o aluno mudou o próprio canal de acesso';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK S7: o canal de acesso é do administrador';
end $$;

rollback;
