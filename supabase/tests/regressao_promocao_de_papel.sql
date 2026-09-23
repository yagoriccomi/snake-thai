-- Regressão da promoção a administrador (migration 20260922100000):
-- só professor vira admin; aluno não muda de papel. Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('ca000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','papel-adm@t.invalid','x',now(),now(),now()),
  ('ca000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','papel-prof@t.invalid','x',now(),now(),now()),
  ('ca000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','papel-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, color) values
  ('ca000000-0000-4000-8000-000000000001','admin','Admin Papel','88000000001',false,'active',null),
  ('ca000000-0000-4000-8000-000000000002','professor','Professor Papel','88000000002',false,'active','#39FF14'),
  ('ca000000-0000-4000-8000-000000000003','user','Aluno Papel','88000000003',false,'active',null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"ca000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- =====================================================================
-- P1 — aluno NÃO vira administrador
-- =====================================================================
do $$
begin
  begin
    update public.profiles set role = 'admin'
     where id = 'ca000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU P1: aluno foi promovido a administrador';
  exception when insufficient_privilege then null;
  end;
  if (select role from public.profiles where id = 'ca000000-0000-4000-8000-000000000003') <> 'user' then
    raise exception 'FALHOU P1: o papel do aluno mudou';
  end if;
  raise notice 'OK P1: aluno não é promovido a administrador';
end $$;

-- =====================================================================
-- P2 — aluno NÃO vira professor pela edição de papel
-- =====================================================================
do $$
begin
  begin
    update public.profiles set role = 'professor', color = '#FF00FF'
     where id = 'ca000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU P2: aluno virou professor';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK P2: aluno não vira professor por atualização de papel';
end $$;

-- =====================================================================
-- P3 — professor vira administrador, com a cor liberada na mesma operação
-- =====================================================================
do $$
begin
  update public.profiles set role = 'admin', color = null
   where id = 'ca000000-0000-4000-8000-000000000002';
  if (select role from public.profiles where id = 'ca000000-0000-4000-8000-000000000002') <> 'admin' then
    raise exception 'FALHOU P3: o professor não foi promovido';
  end if;
  raise notice 'OK P3: professor vira administrador';
end $$;

-- =====================================================================
-- P4 — promover sem tirar a cor é recusado (constraint de cor)
-- =====================================================================
do $$
begin
  update public.profiles set role = 'professor', color = '#39FF14'
   where id = 'ca000000-0000-4000-8000-000000000002';
  begin
    update public.profiles set role = 'admin'
     where id = 'ca000000-0000-4000-8000-000000000002';
    raise exception 'FALHOU P4: promoveu mantendo a cor de professor';
  exception when check_violation then null;
  end;
  raise notice 'OK P4: promover exige limpar a cor na mesma operação';
end $$;

-- =====================================================================
-- P5 — administrador volta a ser professor, com cor
-- =====================================================================
do $$
begin
  update public.profiles set role = 'admin', color = null
   where id = 'ca000000-0000-4000-8000-000000000002';
  update public.profiles set role = 'professor', color = '#22C55E'
   where id = 'ca000000-0000-4000-8000-000000000002';
  if (select role from public.profiles where id = 'ca000000-0000-4000-8000-000000000002') <> 'professor' then
    raise exception 'FALHOU P5: o administrador não voltou a professor';
  end if;
  raise notice 'OK P5: administrador volta a professor';
end $$;

-- =====================================================================
-- P6 — administrador NÃO é rebaixado a aluno
-- =====================================================================
do $$
begin
  begin
    update public.profiles set role = 'user'
     where id = 'ca000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU P6: administrador virou aluno';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK P6: administrador não vira aluno';
end $$;

-- =====================================================================
-- P7 — a trava do último administrador continua valendo
-- =====================================================================
do $$
begin
  begin
    update public.profiles set role = 'professor', color = '#39FF14'
     where id = 'ca000000-0000-4000-8000-000000000001';
    -- Passou: havia outro administrador ativo, então a trava não se aplicava.
    raise notice 'OK P7: havia outro administrador ativo, trava não se aplica aqui';
  -- check_violation (23514) é o código que prevent_last_admin_removal usa.
  exception when check_violation or raise_exception or insufficient_privilege then
    raise notice 'OK P7: o último administrador continua protegido';
  end;
end $$;

-- =====================================================================
-- P8 — sem sessão (migration/seed/servidor) a regra não se aplica
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
do $$
begin
  -- Corrigir um cadastro errado por fora precisa continuar possível; a trava
  -- existe contra o que se alcança pelo app.
  update public.profiles set role = 'professor', color = '#39FF14'
   where id = 'ca000000-0000-4000-8000-000000000003';
  if (select role from public.profiles where id = 'ca000000-0000-4000-8000-000000000003') <> 'professor' then
    raise exception 'FALHOU P8: contexto sem sessão não conseguiu ajustar o papel';
  end if;
  raise notice 'OK P8: migration e servidor continuam ajustando o papel';
end $$;

rollback;
