-- Regressão dos perfis (bloco 4.10, migration 20260929200000_perfis; contrato
-- § 12, D31, D32, D58, T32). Roda numa transação e termina em ROLLBACK; mesmo
-- assim, rode SÓ no banco local.
--
-- F aluno da turma G · P professor · A admin. As aulas de P ficam no dia 2 do
-- mês de "3 dias atrás", sempre no passado.
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('p1-g', 'P1 Turma G'), ('p1-g2', 'P1 Turma G2');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('db000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'p1-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 3) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('db000000-0000-4000-8000-000000000001', 'admin', 'P1 Admin', '62000000001', false, 'active', null, '#101010', now() - interval '90 days'),
  ('db000000-0000-4000-8000-000000000002', 'professor', 'P1 Prof', '62000000002', false, 'active', null, '#202020', now() - interval '90 days'),
  ('db000000-0000-4000-8000-000000000003', 'user', 'P1 Aluno F', '62000000003', false, 'active', 'p1-g', null, now() - interval '90 days');

-- Financeiro de F: uma paga em dia, uma paga com atraso, uma vencida e uma aberta.
insert into public.payments (user_id, status, due_date, reference_month, paid_at, amount_cents) values
  ('db000000-0000-4000-8000-000000000003', 'paid', current_date - 60, date_trunc('month', current_date - 60)::date, (current_date - 61)::timestamp at time zone 'America/Sao_Paulo', 10000),
  ('db000000-0000-4000-8000-000000000003', 'paid', current_date - 30, date_trunc('month', current_date - 30)::date, (current_date - 20)::timestamp at time zone 'America/Sao_Paulo', 10000),
  ('db000000-0000-4000-8000-000000000003', 'overdue', current_date - 5, date_trunc('month', current_date - 5)::date, null, 10000),
  ('db000000-0000-4000-8000-000000000003', 'open', current_date + 25, date_trunc('month', current_date + 25)::date, null, 10000);

create temp table base on commit drop as
select (date_trunc('month', (now() - interval '3 days') at time zone 'America/Sao_Paulo') + interval '1 day 10 hours')
         at time zone 'America/Sao_Paulo' as quando;
grant select on base to authenticated;

-- C1 dada · C2 falta · C3 abonada · C4 cancelada · C5 dada fora da escala · C6 sem chamada
insert into public.classes (id, title, type, group_id, date_time, audience, attendance_taken_at, cancelled_at)
select v.id::uuid, v.titulo, 'routine', 'p1-g', b.quando + (v.h || ' hours')::interval, 'both',
       case when v.chamada then b.quando + (v.h || ' hours')::interval + interval '1 hour' end,
       case when v.cancelada then b.quando end
  from base b,
       (values ('dbc00000-0000-4000-8000-000000000001', 'P1 C1', 0, true, false),
               ('dbc00000-0000-4000-8000-000000000002', 'P1 C2', 1, true, false),
               ('dbc00000-0000-4000-8000-000000000003', 'P1 C3', 2, true, false),
               ('dbc00000-0000-4000-8000-000000000004', 'P1 C4', 3, false, true),
               ('dbc00000-0000-4000-8000-000000000005', 'P1 C5', 4, true, false),
               ('dbc00000-0000-4000-8000-000000000006', 'P1 C6', 5, false, false)) as v(id, titulo, h, chamada, cancelada);

insert into public.class_teachers (class_id, teacher_id)
select id, 'db000000-0000-4000-8000-000000000002' from public.classes where title like 'P1 C%';
insert into public.class_teacher_presence (class_id, teacher_id, present, added_in_roll_call, set_by) values
  ('dbc00000-0000-4000-8000-000000000001', 'db000000-0000-4000-8000-000000000002', true, false, 'db000000-0000-4000-8000-000000000001'),
  ('dbc00000-0000-4000-8000-000000000002', 'db000000-0000-4000-8000-000000000002', false, false, 'db000000-0000-4000-8000-000000000001'),
  ('dbc00000-0000-4000-8000-000000000003', 'db000000-0000-4000-8000-000000000002', false, false, 'db000000-0000-4000-8000-000000000001'),
  ('dbc00000-0000-4000-8000-000000000005', 'db000000-0000-4000-8000-000000000002', true, true, 'db000000-0000-4000-8000-000000000001');

with m as (
  insert into public.action_reasons (kind, class_id, author_id, body, used_at)
  values ('request_evidence', 'dbc00000-0000-4000-8000-000000000003', 'db000000-0000-4000-8000-000000000002', 'Consulta', now())
  returning id
)
insert into public.roll_call_requests (kind, class_id, requester_id, subject_id, motivo_id, status, reviewed_by, reviewed_at, review_note)
select 'teacher_absence', 'dbc00000-0000-4000-8000-000000000003', 'db000000-0000-4000-8000-000000000002',
       'db000000-0000-4000-8000-000000000002', m.id, 'approved', 'db000000-0000-4000-8000-000000000001', now(), 'Ok'
  from m;

-- F muda de turma (D58): o mês passa a ter dois períodos.
update public.profiles set group_id = 'p1-g2' where id = 'db000000-0000-4000-8000-000000000003';

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

do $$
declare
  F constant uuid := 'db000000-0000-4000-8000-000000000003';
  v jsonb;
begin
  perform pg_temp.como('db000000-0000-4000-8000-000000000002');
  v := public.perfil_do_aluno(F);
  if v ->> 'nome' <> 'P1 Aluno F' or v ->> 'turma' <> 'P1 Turma G2' or v ->> 'situacao' <> 'ativo' then
    raise exception 'FALHOU P1: perfil do aluno para o professor: %', v;
  end if;
  if v ? 'financeiro' or v ? 'plano_nome' or v::text like '%62000000003%' then
    raise exception 'FALHOU P1: o professor viu financeiro, plano ou CPF (D32)';
  end if;
  if jsonb_array_length(v -> 'turmas_no_mes') < 2 then
    raise exception 'FALHOU P2: turmas_no_mes sem os dois períodos (D58): %', v -> 'turmas_no_mes';
  end if;

  perform pg_temp.como('db000000-0000-4000-8000-000000000001');
  v := public.perfil_do_aluno(F) -> 'financeiro';
  if (v ->> 'pagas')::int <> 2 or (v ->> 'pagas_com_atraso')::int <> 1
     or (v ->> 'inadimplentes')::int <> 1 or (v ->> 'em_aberto')::int <> 1 then
    raise exception 'FALHOU P3: financeiro do admin: %', v;
  end if;

  perform pg_temp.como('db000000-0000-4000-8000-000000000003');
  begin
    perform public.perfil_do_aluno(F);
    raise exception 'FALHOU P1: o aluno leu o perfil pela RPC da equipe';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK P1–P3: a equipe vê a ficha, só o admin vê o financeiro, e a turma por período';
end $$;

do $$
declare
  P constant uuid := 'db000000-0000-4000-8000-000000000002';
  v jsonb;
  n int;
begin
  perform pg_temp.como('db000000-0000-4000-8000-000000000001');
  v := public.perfil_do_professor(P, ((select quando from base) at time zone 'America/Sao_Paulo')::date);
  if (v ->> 'esperadas')::int <> 4 or (v ->> 'dadas')::int <> 2 or (v ->> 'dadas_fora_da_escala')::int <> 1
     or (v ->> 'canceladas')::int <> 1 or (v ->> 'faltas')::int <> 1 or (v ->> 'abonadas')::int <> 1
     or (v ->> 'pendentes')::int <> 1 or (v ->> 'percentual')::numeric <> 66.67 then
    raise exception 'FALHOU P4: perfil do professor: %', v;
  end if;
  select count(*) into n from public.historico_de_aulas_do_professor(P, current_date - 40, current_date);
  if n <> 6 then
    raise exception 'FALHOU P5: histórico do professor com % aulas', n;
  end if;

  perform pg_temp.como('db000000-0000-4000-8000-000000000002');
  begin
    perform public.perfil_do_professor(P, current_date);
    raise exception 'FALHOU P5: o professor leu o próprio perfil (D31: só admin)';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK P4–P5: a conta do professor pela T32, só para o admin';
end $$;

rollback;
