-- ============================================================================
-- Snake Thai — Base do banco LOCAL de desenvolvimento
-- ----------------------------------------------------------------------------
-- Cria o mínimo para o app funcionar no banco local: planos, turmas e as
-- contas de teste (admin, professor e dois alunos). É a base sobre a qual as
-- seeds de demonstração (demo_seed.sql, demo_seed_historico.sql) rodam.
--
-- SÓ PARA O BANCO LOCAL. Aborta se o banco já tiver qualquer conta — ou seja,
-- só roda logo depois de `scripts\db-dev reset`, nunca num banco com gente.
--
-- A senha das contas locais está no docs/RUNBOOK.md ("Banco local"). Ela vale
-- só neste Docker e é diferente de qualquer senha de produção. [#37][#81]
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'local_base.sql recusado: o banco ja tem contas. Ele so roda num banco recem-resetado (scripts\db-dev reset).';
  end if;
end $$;

-- Planos ----------------------------------------------------------------------
insert into public.plans (name, description, price_cents, billing_period, due_day, is_active)
values
  ('Mensal 2x', 'Aulas de luta 2x por semana.', 10000, 'monthly', 10, true),
  ('Mensal 3x', 'Aulas de luta 3x por semana, com avaliação física por trimestre.', 13000, 'monthly', 10, true);

-- Turmas: os mesmos ids de produção, para as seeds e a agenda baterem --------
insert into public.groups (id, name)
values
  ('turma-manha', 'Turma Manhã'),
  ('turma-tarde', 'Turma Tarde'),
  ('turma-noite', 'Turma Noite');

-- Contas de teste --------------------------------------------------------------
-- UUIDs fixos (prefixo cafe0000) para os testes manuais e a documentação
-- poderem citar cada conta sem consultar o banco.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  -- Colunas de token não podem ficar nulas: o GoTrue as lê como texto e
  -- responde "Database error querying schema" no login.
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  c.id::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  c.email,
  crypt('DevLocal@2026', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', '', '', '', '', ''
from (values
  ('cafe0000-0000-4000-8000-000000000001', 'adm@snake.com'),
  ('cafe0000-0000-4000-8000-000000000002', 'professor@snake.com'),
  ('cafe0000-0000-4000-8000-000000000003', 'aluno@snake.com'),
  ('cafe0000-0000-4000-8000-000000000004', 'caloteiro@snake.com')
) as c(id, email);

insert into public.profiles (id, role, name, cpf, phone, color, is_first_login, status, group_id, plan_id)
values
  ('cafe0000-0000-4000-8000-000000000001', 'admin', 'Admin Local', '70000000001', null, null,
   false, 'active', null, null),
  ('cafe0000-0000-4000-8000-000000000002', 'professor', 'Professor Teste', '70000000002', null, '#FF6B35',
   false, 'active', null, null),
  ('cafe0000-0000-4000-8000-000000000003', 'user', 'Aluno Teste', '70000000003', '11900000003', null,
   false, 'active', 'turma-tarde', (select id from public.plans where name = 'Mensal 2x')),
  ('cafe0000-0000-4000-8000-000000000004', 'user', 'Caloteiro Teste', '70000000004', '11900000004', null,
   false, 'active', 'turma-noite', (select id from public.plans where name = 'Mensal 2x'));

commit;
