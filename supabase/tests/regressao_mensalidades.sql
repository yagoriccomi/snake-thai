-- Regressão da geração de mensalidades. Roda dentro de uma transação e faz
-- ROLLBACK no fim: NENHUMA linha sobrevive, pode rodar contra produção.
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa: 1 plano de R$ 100,00 vencendo dia 10, e alunos em vários estados.
-- ---------------------------------------------------------------------
insert into public.plans (id, name, price_cents, billing_period, due_day, is_active)
values ('b0000000-0000-4000-8000-0000000000aa'::uuid, 'Plano Teste', 10000, 'monthly', 10, true);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m1@t.invalid','x',now(),now(),now()),
  ('b0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2@t.invalid','x',now(),now(),now()),
  ('b0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m3@t.invalid','x',now(),now(),now()),
  ('b0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m4@t.invalid','x',now(),now(),now()),
  ('b0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m5@t.invalid','x',now(),now(),now());

-- ---------------------------------------------------------------------
-- TESTE 1 — aritmética do proporcional
-- ---------------------------------------------------------------------
do $$
begin
  -- Entrou dia 1 de um mês de 30 dias: mês cheio.
  if public.valor_proporcional(10000, 1, 30) <> 10000 then
    raise exception 'FALHOU T1a: entrada no dia 1 deveria custar o mes cheio, deu %',
      public.valor_proporcional(10000, 1, 30);
  end if;
  -- Entrou no ultimo dia: 1/30 do valor.
  if public.valor_proporcional(10000, 30, 30) <> 333 then
    raise exception 'FALHOU T1b: ultimo dia deveria custar 1/30 (333), deu %',
      public.valor_proporcional(10000, 30, 30);
  end if;
  -- Dia 4 de setembro (30 dias): restam 27 dias -> 9000.
  if public.valor_proporcional(10000, 4, 30) <> 9000 then
    raise exception 'FALHOU T1c: dia 4 de 30 deveria dar 9000, deu %',
      public.valor_proporcional(10000, 4, 30);
  end if;
  raise notice 'OK T1: valor proporcional confere nos extremos e no meio';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 2 — aluno cadastrado ATE o dia 10 ganha a fatura proporcional do
--           mes corrente, vencendo no ULTIMO dia do mes
-- ---------------------------------------------------------------------
insert into public.profiles (id, role, name, cpf, is_first_login, plan_id, status)
values ('b0000000-0000-4000-8000-000000000001','user','Aluno Cedo','11111111111', false,
        'b0000000-0000-4000-8000-0000000000aa'::uuid, 'active');

do $$
declare v_gerou boolean; v_venc date; v_valor integer; v_comp date;
begin
  -- O trigger ja rodou com current_date; para testar a REGRA de calendario
  -- usamos uma data fixa num aluno ainda sem fatura daquele mes.
  v_gerou := public.registrar_fatura_de_entrada(
    'b0000000-0000-4000-8000-000000000001', date '2026-11-05');
  if not v_gerou then
    raise exception 'FALHOU T2: aluno cadastrado no dia 5 deveria receber fatura';
  end if;
  select due_date, amount_cents, reference_month into v_venc, v_valor, v_comp
    from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2026-11-01';
  -- Novembro tem 30 dias; entrou dia 5 -> restam 26 -> 10000*26/30 = 8667.
  if v_venc <> date '2026-11-30' then
    raise exception 'FALHOU T2: deveria vencer no ultimo dia do mes, venceu em %', v_venc;
  end if;
  if v_valor <> 8667 then
    raise exception 'FALHOU T2: valor proporcional errado, deu %', v_valor;
  end if;
  raise notice 'OK T2: fatura de entrada proporcional vencendo no ultimo dia do mes';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 3 — cadastrado DEPOIS do dia 10 nao gera nada no mes corrente
-- ---------------------------------------------------------------------
insert into public.profiles (id, role, name, cpf, is_first_login, plan_id, status)
values ('b0000000-0000-4000-8000-000000000002','user','Aluno Tarde','22222222222', false,
        'b0000000-0000-4000-8000-0000000000aa'::uuid, 'active');

do $$
declare v_gerou boolean; v_tem integer;
begin
  v_gerou := public.registrar_fatura_de_entrada(
    'b0000000-0000-4000-8000-000000000002', date '2026-11-11');
  if v_gerou then
    raise exception 'FALHOU T3: cadastro no dia 11 nao pode gerar fatura do mes';
  end if;
  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000002'
     and reference_month = date '2026-11-01';
  if v_tem <> 0 then
    raise exception 'FALHOU T3: apareceu fatura de novembro para quem entrou dia 11';
  end if;
  raise notice 'OK T3: entrada apos o dia 10 fica para a recorrencia do mes seguinte';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 4 — aluno SEM plano nao e faturado
-- ---------------------------------------------------------------------
insert into public.profiles (id, role, name, cpf, is_first_login, plan_id, status)
values ('b0000000-0000-4000-8000-000000000003','user','Aluno Sem Plano','33333333333', false,
        null, 'active');

do $$
declare v_gerou boolean;
begin
  v_gerou := public.registrar_fatura_de_entrada(
    'b0000000-0000-4000-8000-000000000003', date '2026-11-05');
  if v_gerou then
    raise exception 'FALHOU T4: aluno sem plano nao pode receber cobranca';
  end if;
  raise notice 'OK T4: aluno sem plano nao gera cobranca';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 5 — a RECORRENCIA gera o mes cheio vencendo no due_day
-- ---------------------------------------------------------------------
do $$
declare v_qtd integer; v_venc date; v_valor integer;
begin
  v_qtd := public.gerar_mensalidades_do_mes(date '2026-12-01');
  if v_qtd < 2 then
    raise exception 'FALHOU T5: deveria gerar para os alunos ativos com plano, gerou %', v_qtd;
  end if;
  select due_date, amount_cents into v_venc, v_valor from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2026-12-01';
  if v_venc <> date '2026-12-10' then
    raise exception 'FALHOU T5: recorrente deveria vencer no due_day (10), venceu %', v_venc;
  end if;
  if v_valor <> 10000 then
    raise exception 'FALHOU T5: recorrente deveria ser o valor cheio, deu %', v_valor;
  end if;
  raise notice 'OK T5: recorrencia mensal cheia vencendo no dia do plano';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 6 — IDEMPOTENCIA: rodar de novo nao duplica
-- ---------------------------------------------------------------------
do $$
declare v_qtd integer; v_total integer;
begin
  v_qtd := public.gerar_mensalidades_do_mes(date '2026-12-15');
  if v_qtd <> 0 then
    raise exception 'FALHOU T6: segunda execucao gerou % cobrancas duplicadas', v_qtd;
  end if;
  select count(*) into v_total from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2026-12-01';
  if v_total <> 1 then
    raise exception 'FALHOU T6: aluno ficou com % faturas em dezembro', v_total;
  end if;
  raise notice 'OK T6: reexecucao do cron nao duplica a competencia';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 7 — INADIMPLENCIA NAO IMPEDE a cobranca nova (regra central)
-- ---------------------------------------------------------------------
do $$
declare v_qtd integer; v_tem integer;
begin
  -- Deixa dezembro em atraso e tenta faturar janeiro.
  update public.payments set status = 'overdue'
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2026-12-01';

  v_qtd := public.gerar_mensalidades_do_mes(date '2027-01-01');
  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2027-01-01';
  if v_tem <> 1 then
    raise exception 'FALHOU T7: aluno inadimplente deixou de ser faturado no mes seguinte';
  end if;
  raise notice 'OK T7: mes anterior em atraso nao impede a cobranca do mes novo';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 8 — aluno com matricula TRANCADA nao e faturado
-- ---------------------------------------------------------------------
do $$
declare v_tem integer;
begin
  update public.profiles
     set status = 'inactive', deactivated_at = now()
   where id = 'b0000000-0000-4000-8000-000000000002';

  perform public.gerar_mensalidades_do_mes(date '2027-02-01');

  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000002'
     and reference_month = date '2027-02-01';
  if v_tem <> 0 then
    raise exception 'FALHOU T8: aluno com matricula trancada recebeu cobranca';
  end if;
  raise notice 'OK T8: matricula trancada suspende a cobranca';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 9 — plano INATIVO nao gera cobranca
-- ---------------------------------------------------------------------
do $$
declare v_tem integer;
begin
  update public.plans set is_active = false
   where id = 'b0000000-0000-4000-8000-0000000000aa'::uuid;

  perform public.gerar_mensalidades_do_mes(date '2027-03-01');

  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000001'
     and reference_month = date '2027-03-01';
  if v_tem <> 0 then
    raise exception 'FALHOU T9: plano inativo continuou faturando';
  end if;

  update public.plans set is_active = true
   where id = 'b0000000-0000-4000-8000-0000000000aa'::uuid;
  raise notice 'OK T9: plano inativo nao gera cobranca';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 10 — a unicidade barra duplicata inserida na marra
-- ---------------------------------------------------------------------
do $$
begin
  begin
    insert into public.payments (user_id, plan_id, amount_cents, due_date, reference_month, status)
    values ('b0000000-0000-4000-8000-000000000001',
            'b0000000-0000-4000-8000-0000000000aa'::uuid,
            10000, date '2026-12-10', date '2026-12-01', 'open');
    raise exception 'FALHOU T10: aceitou duas cobrancas para a mesma competencia';
  exception when unique_violation then
    raise notice 'OK T10: unicidade (aluno, competencia) barra a duplicata';
  end;
end $$;

-- ---------------------------------------------------------------------
-- TESTE 11 — professor NAO recebe mensalidade
-- ---------------------------------------------------------------------
insert into public.profiles (id, role, name, cpf, is_first_login, color, status)
values ('b0000000-0000-4000-8000-000000000004','professor','Prof Mensal','44444444444', false,
        '#123456', 'active');

do $$
declare v_tem integer;
begin
  perform public.gerar_mensalidades_do_mes(date '2027-04-01');
  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000004';
  if v_tem <> 0 then
    raise exception 'FALHOU T11: professor recebeu mensalidade';
  end if;
  raise notice 'OK T11: professor nao e faturado';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 12 — o TRIGGER dispara sozinho ao cadastrar o aluno
-- ---------------------------------------------------------------------
do $$
declare v_tem integer; v_dia integer;
begin
  insert into public.profiles (id, role, name, cpf, is_first_login, plan_id, status)
  values ('b0000000-0000-4000-8000-000000000005','user','Aluno Trigger','55555555555', false,
          'b0000000-0000-4000-8000-0000000000aa'::uuid, 'active');

  select count(*) into v_tem from public.payments
   where user_id = 'b0000000-0000-4000-8000-000000000005'
     and reference_month = date_trunc('month', current_date)::date;

  v_dia := extract(day from current_date)::integer;
  if v_dia <= 10 and v_tem <> 1 then
    raise exception 'FALHOU T12: cadastro no dia % deveria ter gerado a fatura de entrada', v_dia;
  end if;
  if v_dia > 10 and v_tem <> 0 then
    raise exception 'FALHOU T12: cadastro no dia % nao podia gerar fatura', v_dia;
  end if;
  raise notice 'OK T12: trigger de cadastro respeitou o corte do dia 10 (hoje e dia %)', v_dia;
end $$;

rollback;
