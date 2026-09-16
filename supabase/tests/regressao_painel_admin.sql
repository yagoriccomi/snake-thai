-- Regressão do Painel do admin e do relatório de inadimplência
-- (migration 20260916210123_painel_admin). Roda numa transação e termina em
-- ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Datas em 2031 com "hoje" = 20/05/2031 (São Paulo): nenhuma aula ou
-- mensalidade da demonstração cai nesses meses. Contagens globais (alunos,
-- inadimplência) são comparadas por DIFERENÇA antes/depois da massa, para
-- passar com ou sem a demonstração carregada.
--
--   A1 ativo (turma A)        A2 ativo com plano (turma A)   A3 inativo, saiu em 05/05
--   A4 conta excluída (LGPD)  A5 ativo (turma B, 2 aulas)    A6 ativo, 25% em abril
--   A7 ativo sem nenhuma aula · PROF · ADM
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Admin primeiro, para medir a linha de base antes do resto da massa
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('9d000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-adm@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-prof@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a1@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a2@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a3@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a4@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a5@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a6@t.invalid','x',now(),now(),now()),
  ('9d000000-0000-4000-8000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','painel-a7@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color)
values ('9d000000-0000-4000-8000-000000000001','admin','Admin Painel','91000000001',false,'active',null,null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"9d000000-0000-4000-8000-000000000001","role":"authenticated"}';

create temporary table painel_base on commit drop as
select r.*, (select coalesce(sum(f.valor_cents), 0) from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') f where f.faixa = '1-30') as faixa1_cents,
       (select coalesce(sum(f.valor_cents), 0) from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') f where f.faixa = '31-60') as faixa2_cents,
       (select coalesce(sum(f.valor_cents), 0) from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') f where f.faixa = '60+') as faixa3_cents
  from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03') r;

reset role;
set local request.jwt.claims = '';

-- ---------------------------------------------------------------------
-- Massa (plan_id nulo no insert: o gatilho de fatura de entrada criaria
-- cobrança de hoje e mudaria a inadimplência)
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values
  ('painel-a', 'Painel A'), ('painel-b', 'Painel B'), ('painel-c', 'Painel C'), ('painel-d', 'Painel D');

insert into public.plans (id, name, price_cents, billing_period, due_day, is_active)
values ('9d000000-0000-4000-8000-00000000f001', 'Plano Painel', 10000, 'monthly', 10, true);

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, deactivated_at, anonymized_at)
values
  ('9d000000-0000-4000-8000-000000000002','professor','Prof Painel','91000000002',false,'active',null,'#0F0F0F',null,null),
  ('9d000000-0000-4000-8000-000000000003','user','Aluno Um','91000000003',false,'active','painel-a',null,null,null),
  ('9d000000-0000-4000-8000-000000000004','user','Aluno Dois','91000000004',false,'active','painel-a',null,null,null),
  ('9d000000-0000-4000-8000-000000000005','user','Aluno Três','91000000005',false,'inactive','painel-a',null,timestamptz '2031-05-05 10:00-03',null),
  ('9d000000-0000-4000-8000-000000000006','user','Usuário removido',null,false,'inactive',null,null,timestamptz '2031-04-10 10:00-03',timestamptz '2031-04-10 10:00-03'),
  ('9d000000-0000-4000-8000-000000000007','user','Aluno Cinco','91000000007',false,'active','painel-b',null,null,null),
  ('9d000000-0000-4000-8000-000000000008','user','Aluno Seis','91000000008',false,'active','painel-c',null,null,null),
  ('9d000000-0000-4000-8000-000000000009','user','Aluno Sete','91000000009',false,'active','painel-d',null,null,null);

update public.profiles set plan_id = '9d000000-0000-4000-8000-00000000f001' where id = '9d000000-0000-4000-8000-000000000004';

-- Mensalidades. "Hoje" = 20/05/2031: hoje-30 = 20/04, hoje-31 = 19/04,
-- hoje-60 = 21/03, hoje-61 = 20/03.
insert into public.payments (user_id, amount_cents, reference_month, due_date, status, paid_at) values
  ('9d000000-0000-4000-8000-000000000003', 10000, date '2031-05-01', date '2031-05-10', 'paid', timestamptz '2031-05-09 10:00-03'),
  ('9d000000-0000-4000-8000-000000000003', 11000, date '2031-04-01', date '2031-04-20', 'open', null),              -- 30 dias: 1-30
  ('9d000000-0000-4000-8000-000000000003', 12000, date '2031-03-01', date '2031-03-21', 'overdue', null),           -- 60 dias: 31-60
  ('9d000000-0000-4000-8000-000000000004', 13000, date '2031-05-01', date '2031-05-20', 'open', null),              -- vence hoje: não é inadimplência
  ('9d000000-0000-4000-8000-000000000004', 14000, date '2031-04-01', date '2031-04-19', 'overdue', null),           -- 31 dias: 31-60
  ('9d000000-0000-4000-8000-000000000004', 15000, date '2031-03-01', date '2031-03-10', 'paid', timestamptz '2031-03-15 10:00-03'),
  ('9d000000-0000-4000-8000-000000000005', 16000, date '2031-05-01', date '2031-05-19', 'overdue', null),           -- 1 dia: 1-30 (inativo)
  ('9d000000-0000-4000-8000-000000000005', 17000, date '2031-02-01', date '2031-03-20', 'open', null),              -- 61 dias: 60+ (cron não rodou)
  ('9d000000-0000-4000-8000-000000000006', 18000, date '2031-05-01', date '2031-05-01', 'open', null),              -- conta excluída
  ('9d000000-0000-4000-8000-000000000007', 19000, date '2031-05-01', date '2031-05-01', 'pending_approval', null);  -- em análise: não é inadimplência

-- Frequência de maio (até dia 20): turma A com 5 aulas, turma B com 2.
insert into public.classes (id, title, type, date_time, group_id, attendance_taken_at) values
  ('9d000000-0000-4000-8000-00000000c001','Painel A','routine', timestamptz '2031-05-05 19:00-03','painel-a', timestamptz '2031-05-05 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c002','Painel A','routine', timestamptz '2031-05-07 19:00-03','painel-a', timestamptz '2031-05-07 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c003','Painel A','routine', timestamptz '2031-05-12 19:00-03','painel-a', timestamptz '2031-05-12 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c004','Painel A','routine', timestamptz '2031-05-14 19:00-03','painel-a', timestamptz '2031-05-14 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c005','Painel A','routine', timestamptz '2031-05-19 19:00-03','painel-a', timestamptz '2031-05-19 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c006','Painel B','routine', timestamptz '2031-05-06 19:00-03','painel-b', timestamptz '2031-05-06 20:00-03'),
  ('9d000000-0000-4000-8000-00000000c007','Painel B','routine', timestamptz '2031-05-13 19:00-03','painel-b', timestamptz '2031-05-13 20:00-03');

insert into public.attendance (class_id, user_id, status)
select c.id, '9d000000-0000-4000-8000-000000000003'::uuid, 'present'::public.attendance_status
  from public.classes c where c.group_id = 'painel-a' and c.id::text like '9d000000%'
union all
select c.id, '9d000000-0000-4000-8000-000000000004'::uuid,
       case when c.id = '9d000000-0000-4000-8000-00000000c001' then 'present' else 'absent' end::public.attendance_status
  from public.classes c where c.group_id = 'painel-a' and c.id::text like '9d000000%'
union all
select c.id, '9d000000-0000-4000-8000-000000000007'::uuid, 'absent'::public.attendance_status
  from public.classes c where c.group_id = 'painel-b' and c.id::text like '9d000000%';

-- Abril fechado: A6 com 25%; A1 sem aula contada (denominador zero).
insert into public.attendance_monthly (user_id, reference_month, group_id, total_classes, counted_classes, attended, justified, frequency_percent) values
  ('9d000000-0000-4000-8000-000000000008', date '2031-04-01', 'painel-c', 8, 8, 2, 0, 25),
  ('9d000000-0000-4000-8000-000000000003', date '2031-04-01', 'painel-a', 0, 0, 0, 0, 100);

-- =====================================================================
-- T1, T2 — aluno e professor recebem 42501 nas 5 funções
-- =====================================================================
set local role authenticated;
do $$
declare
  v_ator text;
begin
  foreach v_ator in array array['9d000000-0000-4000-8000-000000000003', '9d000000-0000-4000-8000-000000000002'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_ator, 'role', 'authenticated')::text, true);
    begin
      perform public.painel_admin_resumo();
      raise exception 'FALHOU T1/T2: % leu o resumo', v_ator;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.painel_inadimplencia_faixas();
      raise exception 'FALHOU T1/T2: % leu as faixas', v_ator;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.painel_faturamento_mensal();
      raise exception 'FALHOU T1/T2: % leu o faturamento', v_ator;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.painel_alunos_em_risco();
      raise exception 'FALHOU T1/T2: % leu os alunos em risco', v_ator;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.relatorio_inadimplencia();
      raise exception 'FALHOU T1/T2: % leu o relatório', v_ator;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK T1: aluno não acessa o painel';
  raise notice 'OK T2: professor não acessa o painel';
end $$;

reset role;

-- T3 — anon nem executa
do $$
begin
  if has_function_privilege('anon', 'public.painel_admin_resumo(timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.painel_inadimplencia_faixas(timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.painel_faturamento_mensal(integer, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.painel_alunos_em_risco(numeric, integer, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.relatorio_inadimplencia(timestamptz)', 'execute') then
    raise exception 'FALHOU T3: anon pode executar uma função do painel';
  end if;
  raise notice 'OK T3: anon sem acesso às funções do painel';
end $$;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"9d000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- T4 — contagem de alunos
do $$
declare
  r record;
  b record;
begin
  select * into r from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03');
  select * into b from painel_base;
  if (r.alunos_ativos - b.alunos_ativos, r.alunos_inativos - b.alunos_inativos,
      r.alunos_ativos_sem_plano - b.alunos_ativos_sem_plano, r.saidas_no_mes - b.saidas_no_mes) <> (5, 1, 4, 1) then
    raise exception 'FALHOU T4: ativos +%, inativos +%, sem plano +%, saídas +% (esperado 5/1/4/1)',
      r.alunos_ativos - b.alunos_ativos, r.alunos_inativos - b.alunos_inativos,
      r.alunos_ativos_sem_plano - b.alunos_ativos_sem_plano, r.saidas_no_mes - b.saidas_no_mes;
  end if;
  raise notice 'OK T4: ativos e inativos contam só alunos, sem conta excluída, professor ou admin';
end $$;

-- T5 — competência atual
do $$
declare
  r record;
  b record;
begin
  select * into r from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03');
  select * into b from painel_base;
  if r.competencia <> date '2031-05-01' then
    raise exception 'FALHOU T5: competência %', r.competencia;
  end if;
  if (r.esperado_cents - b.esperado_cents, r.recebido_cents - b.recebido_cents, r.em_analise_cents - b.em_analise_cents,
      r.em_aberto_cents - b.em_aberto_cents, r.vencido_cents - b.vencido_cents,
      r.mensalidades_total - b.mensalidades_total, r.mensalidades_pagas - b.mensalidades_pagas)
     <> (76000::bigint, 10000::bigint, 19000::bigint, 31000::bigint, 16000::bigint, 5, 1) then
    raise exception 'FALHOU T5: esperado %, recebido %, análise %, aberto %, vencido %, total %, pagas %',
      r.esperado_cents - b.esperado_cents, r.recebido_cents - b.recebido_cents, r.em_analise_cents - b.em_analise_cents,
      r.em_aberto_cents - b.em_aberto_cents, r.vencido_cents - b.vencido_cents,
      r.mensalidades_total - b.mensalidades_total, r.mensalidades_pagas - b.mensalidades_pagas;
  end if;
  raise notice 'OK T5: esperado, recebido, em análise, em aberto e vencido da competência';
end $$;

-- T6, T7 — faixas nos limites; em análise e paga vencidas não contam
do $$
declare
  b record;
  v_faixas integer;
  v1 bigint; v2 bigint; v3 bigint;
  r record;
begin
  select * into b from painel_base;
  select count(*) into v_faixas from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03');
  select valor_cents into v1 from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') where faixa = '1-30';
  select valor_cents into v2 from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') where faixa = '31-60';
  select valor_cents into v3 from public.painel_inadimplencia_faixas(timestamptz '2031-05-20 12:00-03') where faixa = '60+';
  if v_faixas <> 3 or (v1 - b.faixa1_cents, v2 - b.faixa2_cents, v3 - b.faixa3_cents) <> (27000::bigint, 26000::bigint, 17000::bigint) then
    raise exception 'FALHOU T6: % faixas; 1-30 +%, 31-60 +%, 60+ +% (esperado 27000/26000/17000)',
      v_faixas, v1 - b.faixa1_cents, v2 - b.faixa2_cents, v3 - b.faixa3_cents;
  end if;
  raise notice 'OK T6: vencimento hoje fora; 30 dias em 1-30, 31 e 60 em 31-60, 61 em 60+';

  select * into r from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03');
  if (r.inadimplencia_cents - b.inadimplencia_cents, r.alunos_inadimplentes - b.alunos_inadimplentes)
     <> (70000::bigint, 3) then
    raise exception 'FALHOU T7: inadimplência +%, alunos +% (esperado 70000 e 3)',
      r.inadimplencia_cents - b.inadimplencia_cents, r.alunos_inadimplentes - b.alunos_inadimplentes;
  end if;
  raise notice 'OK T7: aberta vencida conta mesmo sem o cron; em análise e paga não contam';
end $$;

-- T8 — relatório por aluno e conta excluída só na soma
do $$
declare
  b record;
  r record;
  v_linhas text;
begin
  select string_agg(format('%s|%s|%s|%s|%s|%s', x.nome, x.aluno_ativo, x.mensalidades, x.total_devido_cents,
                           x.maior_atraso_dias, x.vencimento_mais_antigo), ' ; ' order by x.ordem)
    into v_linhas
    from (
      select rel.*, row_number() over () as ordem
        from public.relatorio_inadimplencia(timestamptz '2031-05-20 12:00-03') rel
       where rel.user_id::text like '9d000000%'
    ) x;
  if v_linhas is distinct from
     'Aluno Três|f|2|33000|61|2031-03-20 ; Aluno Um|t|2|23000|60|2031-03-21 ; Aluno Dois|t|1|14000|31|2031-04-19' then
    raise exception 'FALHOU T8: relatório %', v_linhas;
  end if;
  if exists (select 1 from public.relatorio_inadimplencia(timestamptz '2031-05-20 12:00-03') rel
              where rel.user_id = '9d000000-0000-4000-8000-000000000006') then
    raise exception 'FALHOU T8: conta excluída apareceu no relatório';
  end if;
  select * into b from painel_base;
  select * into r from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03');
  if r.inadimplencia_contas_encerradas_cents - b.inadimplencia_contas_encerradas_cents <> 18000 then
    raise exception 'FALHOU T8: contas encerradas +%', r.inadimplencia_contas_encerradas_cents - b.inadimplencia_contas_encerradas_cents;
  end if;
  raise notice 'OK T8: relatório agrupa por aluno, inclui inativo e omite conta excluída (só na soma)';
end $$;

-- T9 — faturamento contínuo, com zero nos meses vazios e limites 1 e 24
do $$
declare
  v_linhas text;
  n integer;
begin
  select string_agg(format('%s:%s/%s/%s', f.reference_month, f.esperado_cents, f.recebido_cents, f.pendente_cents), ' ' order by f.reference_month)
    into v_linhas
    from public.painel_faturamento_mensal(5, timestamptz '2031-05-20 12:00-03') f;
  if v_linhas <> '2031-01-01:0/0/0 2031-02-01:17000/0/17000 2031-03-01:27000/15000/12000 2031-04-01:25000/0/25000 2031-05-01:76000/10000/66000' then
    raise exception 'FALHOU T9: faturamento %', v_linhas;
  end if;
  select count(*) into n from public.painel_faturamento_mensal(0, timestamptz '2031-05-20 12:00-03');
  if n <> 1 then
    raise exception 'FALHOU T9: 0 meses devolveu % linhas (esperado 1)', n;
  end if;
  select count(*) into n from public.painel_faturamento_mensal(99, timestamptz '2031-05-20 12:00-03');
  if n <> 24 then
    raise exception 'FALHOU T9: 99 meses devolveu % linhas (esperado 24)', n;
  end if;
  raise notice 'OK T9: faturamento por competência, meses contínuos, entre 1 e 24';
end $$;

-- T10 — frequência média sem os alunos de denominador zero
do $$
declare
  r record;
begin
  select * into r from public.painel_admin_resumo(timestamptz '2031-05-20 12:00-03');
  -- Maio: A1 100%, A2 20%, A5 0% (A6 e A7 sem aula contada ficam fora).
  if r.frequencia_media_mes <> 40.00 or r.alunos_com_aula_no_mes <> 3 then
    raise exception 'FALHOU T10: média do mês % de % alunos (esperado 40 de 3)', r.frequencia_media_mes, r.alunos_com_aula_no_mes;
  end if;
  -- Abril fechado: só A6 (25%); A1 com zero aulas fica fora.
  if r.ultimo_mes_fechado <> date '2031-04-01' or r.frequencia_media_ultimo_mes <> 25.00 or r.alunos_com_aula_ultimo_mes <> 1 then
    raise exception 'FALHOU T10: último mês % com média % de %', r.ultimo_mes_fechado, r.frequencia_media_ultimo_mes, r.alunos_com_aula_ultimo_mes;
  end if;
  raise notice 'OK T10: frequência média ignora aluno sem aula contada';
end $$;

-- T11 — risco de evasão
do $$
declare
  v_lista text;
begin
  select string_agg(format('%s|%s|%s', x.nome, coalesce(x.frequencia_mes_atual::text, '-'), coalesce(x.frequencia_ultimo_mes::text, '-')), ' ; ')
    into v_lista
    from public.painel_alunos_em_risco(50, 4, timestamptz '2031-05-20 12:00-03') x
   where x.user_id::text like '9d000000%';
  -- A2: 20% com 5 aulas. A6: 25% em abril. A5 (0% com 2 aulas) fica fora.
  if v_lista is distinct from 'Aluno Dois|20.00|- ; Aluno Seis|-|25.00' then
    raise exception 'FALHOU T11: em risco %', v_lista;
  end if;
  raise notice 'OK T11: risco pelo mês atual (com aulas suficientes) ou pelo último mês fechado';
end $$;

-- T12 — fuso: 23h30 do último dia em São Paulo ainda é o mesmo mês
do $$
declare
  r record;
  v_ultimo date;
begin
  select * into r from public.painel_admin_resumo(timestamptz '2031-05-31 23:30-03');
  select max(f.reference_month) into v_ultimo from public.painel_faturamento_mensal(1, timestamptz '2031-05-31 23:30-03') f;
  if r.competencia <> date '2031-05-01' or v_ultimo <> date '2031-05-01' then
    raise exception 'FALHOU T12: competência % e faturamento % às 23h30 de 31/05', r.competencia, v_ultimo;
  end if;
  raise notice 'OK T12: o mês segue o fuso de São Paulo';
end $$;

rollback;
