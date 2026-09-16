-- Regressão da saúde das rotinas agendadas (migration
-- 20260916221418_saude_das_rotinas). Roda numa transação e termina em ROLLBACK;
-- mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Execuções falsas em 2031 ("agora" = 20/05/2031 12:00 UTC), para não se
-- misturar com o histórico real das rotinas.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('7a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rotinas-adm@t.invalid','x',now(),now(),now()),
  ('7a000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rotinas-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status) values
  ('7a000000-0000-4000-8000-000000000001','admin','Admin Rotinas','73000000001',false,'active'),
  ('7a000000-0000-4000-8000-000000000002','user','Aluno Rotinas','73000000002',false,'active');

-- generate-monthly-payments: falhou há 2 h e antes deu certo; falha de 3 dias
-- atrás fica fora da janela. mark-overdue-payments: última execução ok.
-- runid explícito: o dono das migrations não usa a sequência interna do pg_cron.
insert into cron.job_run_details (jobid, runid, status, return_message, start_time, end_time)
select j.jobid, v.runid, v.status, v.mensagem, v.inicio, v.inicio + interval '1 second'
  from (values
    (970000001, 'generate-monthly-payments', 'failed',    'ERROR: detalhe interno', timestamptz '2031-05-20 10:00+00'),
    (970000002, 'generate-monthly-payments', 'succeeded', '1 row',                  timestamptz '2031-05-20 09:00+00'),
    (970000003, 'generate-monthly-payments', 'failed',    'ERROR: antiga',          timestamptz '2031-05-17 10:00+00'),
    (970000004, 'mark-overdue-payments',     'failed',    'ERROR: resolvida',       timestamptz '2031-05-20 08:00+00'),
    (970000005, 'mark-overdue-payments',     'succeeded', '1 row',                  timestamptz '2031-05-20 11:00+00')
  ) as v(runid, rotina, status, mensagem, inicio)
  join cron.job j on j.jobname = v.rotina;

-- T1 — aluno não vê as rotinas
set local role authenticated;
set local request.jwt.claims = '{"sub":"7a000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.saude_das_rotinas();
    raise exception 'FALHOU T1: aluno viu a saúde das rotinas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T1: aluno não acompanha as rotinas';
end $$;

-- T2–T4 — o admin consulta; as conferências rodam fora do papel (o schema cron
-- não é visível para authenticated).
set local request.jwt.claims = '{"sub":"7a000000-0000-4000-8000-000000000001","role":"authenticated"}';
create temporary table saude on commit drop as
select * from public.saude_das_rotinas(timestamptz '2031-05-20 12:00+00');
reset role;

do $$
declare
  r record;
  n integer;
begin
  select count(*) into n from saude;
  if n <> (select count(*) from cron.job) then
    raise exception 'FALHOU T2: % rotinas listadas, % agendadas', n, (select count(*) from cron.job);
  end if;
  raise notice 'OK T2: admin vê todas as rotinas agendadas';

  select * into r from saude where rotina = 'generate-monthly-payments';
  if r.ultimo_status <> 'failed' or r.falhas_24h <> 1 or r.ultima_execucao <> timestamptz '2031-05-20 10:00+00' then
    raise exception 'FALHOU T3: mensalidades com status %, % falhas, última %', r.ultimo_status, r.falhas_24h, r.ultima_execucao;
  end if;
  raise notice 'OK T3: falha recente contada; a de 3 dias atrás fica fora da janela';

  select * into r from saude where rotina = 'mark-overdue-payments';
  if r.ultimo_status <> 'succeeded' or r.falhas_24h <> 1 then
    raise exception 'FALHOU T4: vencidas com status % e % falhas', r.ultimo_status, r.falhas_24h;
  end if;
  raise notice 'OK T4: falha já resolvida aparece na contagem, com a última execução ok';
end $$;

rollback;
