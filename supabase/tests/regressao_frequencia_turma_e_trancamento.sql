-- Regressão da correção de frequência (migration
-- 20260918200000_frequencia_turma_e_trancamento): conta a partir da entrada na
-- turma e para no trancamento. Roda numa transação e termina em ROLLBACK;
-- mesmo assim, rode SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

-- Turmas e aulas do cenário. Datas em 2030 para não esbarrar em dados de demo.
insert into public.groups (id, name) values
  ('f0-turma-a', 'Turma Frequência A'),
  ('f0-turma-b', 'Turma Frequência B');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','freq-adm@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','freq-troca@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','freq-tranca@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, created_at) values
  ('f0000000-0000-4000-8000-000000000001','admin','Admin Frequência','66000000001',false,'active',null,'2024-01-01'),
  ('f0000000-0000-4000-8000-000000000002','user','Aluna Que Troca','66000000002',false,'active','f0-turma-a','2024-01-01'),
  ('f0000000-0000-4000-8000-000000000003','user','Aluno Que Tranca','66000000003',false,'active','f0-turma-a','2024-01-01');

-- Quatro aulas de rotina na turma A e duas na turma B, todas com chamada.
insert into public.classes (id, title, type, group_id, date_time, attendance_taken_at) values
  ('f0c00000-0000-4000-8000-00000000000a','A1','routine','f0-turma-a','2024-03-04 10:00-03','2024-03-04 11:00-03'),
  ('f0c00000-0000-4000-8000-00000000000b','A2','routine','f0-turma-a','2024-03-06 10:00-03','2024-03-06 11:00-03'),
  ('f0c00000-0000-4000-8000-00000000000c','A3','routine','f0-turma-a','2024-03-11 10:00-03','2024-03-11 11:00-03'),
  ('f0c00000-0000-4000-8000-00000000000d','A4','routine','f0-turma-a','2024-03-13 10:00-03','2024-03-13 11:00-03'),
  ('f0c00000-0000-4000-8000-00000000000e','B1','routine','f0-turma-b','2024-03-05 10:00-03','2024-03-05 11:00-03'),
  ('f0c00000-0000-4000-8000-00000000000f','B2','routine','f0-turma-b','2024-03-12 10:00-03','2024-03-12 11:00-03');

-- A aluna que troca esteve presente nas duas primeiras aulas da turma A.
insert into public.attendance (class_id, user_id, status) values
  ('f0c00000-0000-4000-8000-00000000000a','f0000000-0000-4000-8000-000000000002','present'),
  ('f0c00000-0000-4000-8000-00000000000b','f0000000-0000-4000-8000-000000000002','present');

-- O aluno que tranca esteve presente nas duas primeiras e some depois.
insert into public.attendance (class_id, user_id, status) values
  ('f0c00000-0000-4000-8000-00000000000a','f0000000-0000-4000-8000-000000000003','present'),
  ('f0c00000-0000-4000-8000-00000000000b','f0000000-0000-4000-8000-000000000003','present');

-- =====================================================================
-- F1 — o gatilho marca a entrada na turma
-- =====================================================================
do $$
declare v_antes timestamptz; v_depois timestamptz;
begin
  select group_since into v_antes from public.profiles where id = 'f0000000-0000-4000-8000-000000000002';
  if v_antes is null then
    raise exception 'FALHOU F1: aluno criado com turma ficou sem group_since';
  end if;
  update public.profiles set group_id = 'f0-turma-b' where id = 'f0000000-0000-4000-8000-000000000002';
  select group_since into v_depois from public.profiles where id = 'f0000000-0000-4000-8000-000000000002';
  if v_depois is null or v_depois is not distinct from v_antes then
    raise exception 'FALHOU F1: troca de turma não atualizou group_since';
  end if;
  if v_depois < now() - interval '1 minute' then
    raise exception 'FALHOU F1: group_since não foi marcado no momento da troca (veio %)', v_depois;
  end if;
  raise notice 'OK F1: entrada na turma é registrada na criação e na troca';
end $$;

-- =====================================================================
-- F2 — aulas anteriores à entrada na turma não viram falta
-- =====================================================================
do $$
declare v record;
begin
  -- A aluna acabou de entrar na turma B; as duas aulas de B já aconteceram.
  select * into v from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000002']::uuid[], '2024-03-20 12:00-03');
  if v.counted_classes <> 0 then
    raise exception 'FALHOU F2: % aulas da turma nova entraram na conta', v.counted_classes;
  end if;
  if v.frequency_percent <> 100.00 then
    raise exception 'FALHOU F2: sem aula elegível o percentual deveria ser 100, veio %', v.frequency_percent;
  end if;
  raise notice 'OK F2: aula da turma nova anterior à entrada não conta como falta';
end $$;

-- =====================================================================
-- F3 — depois da entrada, as aulas da turma nova contam normalmente
-- =====================================================================
insert into public.classes (id, title, type, group_id, date_time, attendance_taken_at) values
  ('f0c00000-0000-4000-8000-000000000010','B3','routine','f0-turma-b', now() + interval '1 second', now() + interval '2 seconds');
insert into public.attendance (class_id, user_id, status) values
  ('f0c00000-0000-4000-8000-000000000010','f0000000-0000-4000-8000-000000000002','present');

do $$
declare v record;
begin
  select * into v from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000002']::uuid[], now() + interval '1 minute');
  if v.counted_classes <> 1 or v.attended <> 1 or v.frequency_percent <> 100.00 then
    raise exception 'FALHOU F3: esperava 1/1 e 100%%, veio %/% e %', v.attended, v.counted_classes, v.frequency_percent;
  end if;
  raise notice 'OK F3: aula depois da entrada na turma conta normalmente';
end $$;

-- =====================================================================
-- F4 — matrícula trancada para de contar no dia do trancamento
-- =====================================================================
update public.profiles
   set status = 'inactive', deactivated_at = '2024-03-07 00:00-03'
 where id = 'f0000000-0000-4000-8000-000000000003';

do $$
declare v record;
begin
  select * into v from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000003']::uuid[], '2024-03-20 12:00-03');
  -- Só as duas aulas anteriores ao trancamento, ambas presentes.
  if v.counted_classes <> 2 or v.attended <> 2 then
    raise exception 'FALHOU F4: esperava 2 aulas e 2 presenças, veio % e %', v.counted_classes, v.attended;
  end if;
  if v.frequency_percent <> 100.00 then
    raise exception 'FALHOU F4: trancado deveria ficar com 100%% do que cursou, veio %', v.frequency_percent;
  end if;
  raise notice 'OK F4: aulas depois do trancamento não contam';
end $$;

-- =====================================================================
-- F5 — fechamento mensal não congela retrato de quem não teve aula
-- =====================================================================
do $$
declare v_linhas integer;
begin
  -- Aluno cadastrado DEPOIS do mês fechado não pode ganhar 100% naquele mês.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values ('f0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','freq-novo@t.invalid','x',now(),now(),now());
  insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, created_at)
  values ('f0000000-0000-4000-8000-000000000004','user','Aluno Novo','66000000004',false,'active','f0-turma-a','2024-04-15');

  perform public.fechar_frequencia_do_mes('2024-03-01', '2024-05-01 00:00-03');

  select count(*) into v_linhas
    from public.attendance_monthly
   where reference_month = '2024-03-01'
     and user_id = 'f0000000-0000-4000-8000-000000000004';
  if v_linhas <> 0 then
    raise exception 'FALHOU F5: aluno cadastrado depois do mês ganhou linha congelada';
  end if;

  -- Quem teve aula continua sendo congelado.
  select count(*) into v_linhas
    from public.attendance_monthly
   where reference_month = '2024-03-01'
     and user_id = 'f0000000-0000-4000-8000-000000000003';
  if v_linhas <> 1 then
    raise exception 'FALHOU F5: aluno com aulas no mês não foi congelado';
  end if;
  raise notice 'OK F5: fechamento ignora quem não teve aula e mantém quem teve';
end $$;

-- =====================================================================
-- F6 — a fórmula não mudou: justificada sai do denominador
-- =====================================================================
insert into public.absence_justifications (class_id, user_id, message, status, reviewed_at, reviewed_by)
values ('f0c00000-0000-4000-8000-00000000000c','f0000000-0000-4000-8000-000000000002','Atestado','approved',
        '2024-03-12 09:00-03','f0000000-0000-4000-8000-000000000001');

do $$
declare v record;
begin
  -- Aluna de volta à turma A, entrando antes das quatro aulas.
  update public.profiles set group_id = 'f0-turma-a' where id = 'f0000000-0000-4000-8000-000000000002';
  update public.profiles set group_since = '2024-03-01' where id = 'f0000000-0000-4000-8000-000000000002';
  insert into public.attendance (class_id, user_id, status) values
    ('f0c00000-0000-4000-8000-00000000000c','f0000000-0000-4000-8000-000000000002','absent'),
    ('f0c00000-0000-4000-8000-00000000000d','f0000000-0000-4000-8000-000000000002','absent');

  select * into v from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000002']::uuid[], '2024-03-20 12:00-03');
  -- 4 aulas, 2 presenças, 1 falta justificada: 2 / (4 - 1) = 66,67%.
  if v.counted_classes <> 4 or v.attended <> 2 or v.justified <> 1 then
    raise exception 'FALHOU F6: base errada — % aulas, % presenças, % justificadas',
      v.counted_classes, v.attended, v.justified;
  end if;
  if v.frequency_percent <> 66.67 then
    raise exception 'FALHOU F6: esperava 66,67%%, veio %', v.frequency_percent;
  end if;
  raise notice 'OK F6: justificada continua saindo do denominador (2 de 3 = 66,67%%)';
end $$;

rollback;
