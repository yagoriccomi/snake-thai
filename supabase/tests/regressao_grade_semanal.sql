-- Regressão da grade semanal (migration 20260916201939_grade_semanal).
-- Roda numa transação e termina em ROLLBACK; mesmo assim, rode só no banco
-- local (scripts\db-dev test).
--
-- Datas fixas em 2030 via p_agora = 2030-03-01 10:00 (sexta-feira) em São
-- Paulo: horizonte até 30/04/2030. Segundas no período: 4, 11, 18, 25/03 e
-- 1, 8, 15, 22, 29/04 (9). Sextas: 1, 8, 15, 22, 29/03 e 5, 12, 19, 26/04 (9).
--
--   grade-a  S1 segunda 19:00 (P1 e PR, que é rebaixado antes da geração)
--            + aula avulsa já cadastrada em 11/03 19:00 · aluno ALU
--   grade-b  S2 sexta 08:00 · S3 sexta 19:00 (PX) · S4 segunda 07:00 de 10 a 31/03
--   grade-arq  S5, turma arquivada
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values
  ('grade-a', 'Grade A'), ('grade-b', 'Grade B'), ('grade-arq', 'Grade Arquivada');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('f6100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-adm@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-p1@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-p2@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-p3@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-pr@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-px@t.invalid','x',now(),now(),now()),
  ('f6100000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grade-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color)
values
  ('f6100000-0000-4000-8000-000000000001','admin','Admin Grade','66100000001',false,'active',null,null),
  ('f6100000-0000-4000-8000-000000000002','professor','Prof Um','66100000002',false,'active',null,'#111111'),
  ('f6100000-0000-4000-8000-000000000003','professor','Prof Dois','66100000003',false,'active',null,'#222222'),
  ('f6100000-0000-4000-8000-000000000004','professor','Prof Três','66100000004',false,'active',null,'#333333'),
  ('f6100000-0000-4000-8000-000000000005','professor','Prof Rebaixado','66100000005',false,'active',null,'#444444'),
  ('f6100000-0000-4000-8000-000000000006','professor','Prof Excluído','66100000006',false,'active',null,'#555555'),
  ('f6100000-0000-4000-8000-000000000007','user','Aluno Grade','66100000007',false,'active','grade-a',null);

insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from, valid_until) values
  ('f6100000-0000-4000-8000-00000000a001','grade-a','Segunda noite', 1, '19:00', date '2030-03-01', null),
  ('f6100000-0000-4000-8000-00000000a002','grade-b','Sexta cedo',    5, '08:00', date '2030-03-01', null),
  ('f6100000-0000-4000-8000-00000000a003','grade-b','Sexta noite',   5, '19:00', date '2030-03-01', null),
  ('f6100000-0000-4000-8000-00000000a004','grade-b','Segunda cedo',  1, '07:00', date '2030-03-10', date '2030-03-31'),
  ('f6100000-0000-4000-8000-00000000a005','grade-arq','Arquivada',   1, '19:00', date '2030-03-01', null);

insert into public.class_schedule_teachers (schedule_id, teacher_id) values
  ('f6100000-0000-4000-8000-00000000a001','f6100000-0000-4000-8000-000000000002'),
  ('f6100000-0000-4000-8000-00000000a001','f6100000-0000-4000-8000-000000000005'),
  ('f6100000-0000-4000-8000-00000000a003','f6100000-0000-4000-8000-000000000006');

-- Aula avulsa no mesmo instante de uma ocorrência de S1 (G7).
insert into public.classes (id, title, type, date_time, group_id)
values ('f6100000-0000-4000-8000-00000000c011','Avulsa de segunda','routine', timestamptz '2030-03-11 19:00-03','grade-a');

-- G6 — professor rebaixado ANTES da geração
update public.profiles set role = 'user', color = null where id = 'f6100000-0000-4000-8000-000000000005';

update public.groups set archived_at = now() where id = 'grade-arq';

-- =====================================================================
-- Sistema: geração
-- =====================================================================

-- G2 + G6 + G7 — segundas às 19:00, professores copiados, avulsa adotada
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a001', timestamptz '2030-03-01 10:00-03');
  if n <> 9 then
    raise exception 'FALHOU G2: gerou % aulas (esperado 9)', n;
  end if;
  if exists (select 1 from public.classes
              where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                and (extract(dow from occurrence_date) <> 1
                     or (date_time at time zone 'America/Sao_Paulo')::time <> time '19:00'
                     or (date_time at time zone 'America/Sao_Paulo')::date <> occurrence_date
                     or type <> 'routine' or group_id <> 'grade-a')) then
    raise exception 'FALHOU G2: ocorrência fora de segunda 19:00 em São Paulo';
  end if;
  raise notice 'OK G2: horário de segunda 19:00 gera só segundas às 19:00 de São Paulo';

  if (select count(*) from public.classes where group_id = 'grade-a' and date_time = timestamptz '2030-03-11 19:00-03') <> 1
     or not exists (select 1 from public.classes
                     where id = 'f6100000-0000-4000-8000-00000000c011'
                       and schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                       and occurrence_date = date '2030-03-11') then
    raise exception 'FALHOU G7: aula avulsa não foi adotada (ou duplicou)';
  end if;
  raise notice 'OK G7: aula avulsa no mesmo horário é adotada, sem duplicar';

  if exists (select 1 from public.classes c
              where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                and not exists (select 1 from public.class_teachers ct
                                 where ct.class_id = c.id and ct.teacher_id = 'f6100000-0000-4000-8000-000000000002'))
     or exists (select 1 from public.class_teachers ct join public.classes c on c.id = ct.class_id
                 where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                   and ct.teacher_id = 'f6100000-0000-4000-8000-000000000005') then
    raise exception 'FALHOU G6: professores do horário não copiados como esperado';
  end if;
  raise notice 'OK G6: professores copiados; rebaixado fica de fora sem abortar o lote';
end $$;

-- G3 — idempotente
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a001', timestamptz '2030-03-01 10:00-03');
  if n <> 0 or (select count(*) from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001') <> 9 then
    raise exception 'FALHOU G3: segunda geração criou % aula(s)', n;
  end if;
  raise notice 'OK G3: gerar de novo não duplica';
end $$;

-- G4 — horizonte e instante de referência
do $$
declare n_cedo integer; n_noite integer;
begin
  n_cedo := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a002', timestamptz '2030-03-01 10:00-03');
  n_noite := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a003', timestamptz '2030-03-01 10:00-03');
  if n_cedo <> 8 or n_noite <> 9 then
    raise exception 'FALHOU G4: sexta cedo % (esperado 8), sexta noite % (esperado 9)', n_cedo, n_noite;
  end if;
  if exists (select 1 from public.classes
              where schedule_id in ('f6100000-0000-4000-8000-00000000a002','f6100000-0000-4000-8000-00000000a003')
                and (occurrence_date > date '2030-04-30' or date_time <= timestamptz '2030-03-01 10:00-03')) then
    raise exception 'FALHOU G4: ocorrência além do horizonte ou antes do instante de referência';
  end if;
  raise notice 'OK G4: gera até o fim do mês seguinte e nada antes do instante de referência';
end $$;

-- G5 — vigência
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a004', timestamptz '2030-03-01 10:00-03');
  if n <> 3 or exists (select 1 from public.classes
                        where schedule_id = 'f6100000-0000-4000-8000-00000000a004'
                          and occurrence_date not in (date '2030-03-11', date '2030-03-18', date '2030-03-25')) then
    raise exception 'FALHOU G5: vigência de 10 a 31/03 gerou %', n;
  end if;
  raise notice 'OK G5: respeita início e fim da vigência';
end $$;

-- G13 — turma arquivada não gera
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a005', timestamptz '2030-03-01 10:00-03');
  if n <> 0 or exists (select 1 from public.classes where group_id = 'grade-arq') then
    raise exception 'FALHOU G13: turma arquivada gerou % aula(s)', n;
  end if;
  raise notice 'OK G13: turma arquivada não gera aulas';
end $$;

-- G14 — frequência no dia 1º conta as aulas geradas do mês
do $$
declare r record;
begin
  select * into r from public.frequencia_mensal(
    array['f6100000-0000-4000-8000-000000000007'::uuid], timestamptz '2030-03-01 10:00-03');
  if r.total_classes <> 4 or r.frequency_percent <> 100 then
    raise exception 'FALHOU G14: total % e frequência % (esperado 4 e 100)', r.total_classes, r.frequency_percent;
  end if;
  raise notice 'OK G14: no dia 1º o total do mês já conta as aulas da grade e a frequência é 100%%';
end $$;

-- Preparação do G8: aula com chamada, ocorrência remarcada à mão e ocorrência passada
update public.classes set attendance_taken_at = timestamptz '2030-03-18 20:00-03'
 where schedule_id = 'f6100000-0000-4000-8000-00000000a001' and occurrence_date = date '2030-03-18';
update public.classes set schedule_detached = true, date_time = timestamptz '2030-03-26 19:00-03'
 where schedule_id = 'f6100000-0000-4000-8000-00000000a001' and occurrence_date = date '2030-03-25';
insert into public.classes (id, title, type, date_time, group_id, schedule_id, occurrence_date, attendance_taken_at)
values ('f6100000-0000-4000-8000-00000000c099','Segunda noite','routine', timestamptz '2026-01-05 19:00-03','grade-a',
        'f6100000-0000-4000-8000-00000000a001', date '2026-01-05', null);

-- =====================================================================
-- G1 — só o admin escreve na grade
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f6100000-0000-4000-8000-000000000007","role":"authenticated"}';
do $$
declare n integer;
begin
  begin
    perform public.salvar_horario_da_grade(null, 'grade-a', 'Invasor', 2::smallint, '10:00', date '2030-03-01', null, '{}');
    raise exception 'FALHOU G1: aluno criou horário';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.gerar_aulas_da_grade();
    raise exception 'FALHOU G1: aluno executou a geração';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.class_schedules;
  if n <> 0 then
    raise exception 'FALHOU G1: aluno leu % horário(s)', n;
  end if;
end $$;

set local request.jwt.claims = '{"sub":"f6100000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    perform public.encerrar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', date '2030-03-10');
    raise exception 'FALHOU G1: professor encerrou horário';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.class_schedules (group_id, title, weekday, start_time, valid_from)
    values ('grade-a', 'Direto', 2, '10:00', date '2030-03-01');
    raise exception 'FALHOU G1: professor inseriu horário direto';
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.class_schedules where id = 'f6100000-0000-4000-8000-00000000a001') then
    raise exception 'FALHOU G1: professor não lê a grade';
  end if;
  raise notice 'OK G1: aluno e professor não escrevem na grade; aluno nem lê';
end $$;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
set local request.jwt.claims = '{"sub":"f6100000-0000-4000-8000-000000000001","role":"authenticated"}';

-- G8 — editar a hora mexe só nas futuras sem chamada e não desvinculadas
do $$
declare v jsonb;
begin
  v := public.salvar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', 'grade-a', 'Segunda noite', 1::smallint,
                                      '20:00', date '2030-03-01', null,
                                      array['f6100000-0000-4000-8000-000000000002'::uuid]);
  if (v->>'ajustadas')::int <> 7 or (v->>'removidas')::int <> 0 then
    raise exception 'FALHOU G8: resultado %', v;
  end if;
  if (select count(*) from public.classes
       where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
         and (date_time at time zone 'America/Sao_Paulo')::time = time '20:00') <> 7 then
    raise exception 'FALHOU G8: aulas ajustadas não foram para 20:00';
  end if;
  if not exists (select 1 from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                  and occurrence_date = date '2030-03-18' and date_time = timestamptz '2030-03-18 19:00-03')
     or not exists (select 1 from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                  and occurrence_date = date '2030-03-25' and date_time = timestamptz '2030-03-26 19:00-03')
     or not exists (select 1 from public.classes where id = 'f6100000-0000-4000-8000-00000000c099'
                  and date_time = timestamptz '2026-01-05 19:00-03') then
    raise exception 'FALHOU G8: aula com chamada, remarcada ou passada foi alterada';
  end if;
  raise notice 'OK G8: nova hora só nas futuras sem chamada; chamada, remarcada e passada intactas';
end $$;

-- G9 — diferença de professores, sem desfazer o ajuste manual
reset role;
insert into public.class_teachers (class_id, teacher_id)
values ('f6100000-0000-4000-8000-00000000c011', 'f6100000-0000-4000-8000-000000000004');
set local role authenticated;
do $$
begin
  perform public.salvar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', 'grade-a', 'Segunda noite', 1::smallint,
                                         '20:00', date '2030-03-01', null,
                                         array['f6100000-0000-4000-8000-000000000003'::uuid]);
  if exists (select 1 from public.class_teachers ct join public.classes c on c.id = ct.class_id
              where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                and c.attendance_taken_at is null and not c.schedule_detached and c.date_time > now()
                and ct.teacher_id = 'f6100000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU G9: professor removido continuou nas aulas ajustáveis';
  end if;
  if exists (select 1 from public.classes c
              where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                and c.attendance_taken_at is null and not c.schedule_detached and c.date_time > now()
                and not exists (select 1 from public.class_teachers ct
                                 where ct.class_id = c.id and ct.teacher_id = 'f6100000-0000-4000-8000-000000000003')) then
    raise exception 'FALHOU G9: professor novo não entrou nas aulas ajustáveis';
  end if;
  if not exists (select 1 from public.class_teachers
                  where class_id = 'f6100000-0000-4000-8000-00000000c011' and teacher_id = 'f6100000-0000-4000-8000-000000000004') then
    raise exception 'FALHOU G9: professor incluído à mão foi removido';
  end if;
  if not exists (select 1 from public.class_teachers ct join public.classes c on c.id = ct.class_id
                  where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001' and c.occurrence_date = date '2030-03-18'
                    and ct.teacher_id = 'f6100000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU G9: aula com chamada perdeu o professor';
  end if;
  if (select array_agg(teacher_id) from public.class_schedule_teachers
       where schedule_id = 'f6100000-0000-4000-8000-00000000a001') <> array['f6100000-0000-4000-8000-000000000003'::uuid] then
    raise exception 'FALHOU G9: professores do horário não atualizados';
  end if;
  raise notice 'OK G9: troca de professores aplica a diferença e preserva o ajuste manual';
end $$;

-- G10 — encerrar
reset role;
update public.classes set attendance_taken_at = timestamptz '2030-04-22 20:30-03'
 where schedule_id = 'f6100000-0000-4000-8000-00000000a001' and occurrence_date = date '2030-04-22';
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.encerrar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', date '2030-04-10');
  if v->>'acao' <> 'encerrado' or (v->>'removidas')::int <> 2 then
    raise exception 'FALHOU G10: resultado %', v;
  end if;
  if exists (select 1 from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
              and occurrence_date in (date '2030-04-15', date '2030-04-29'))
     or not exists (select 1 from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
              and occurrence_date = date '2030-04-22') then
    raise exception 'FALHOU G10: remoção errada ao encerrar';
  end if;
  if exists (select 1 from public.class_schedule_skips where schedule_id = 'f6100000-0000-4000-8000-00000000a001') then
    raise exception 'FALHOU G10: encerrar gerou exceção de ocorrência';
  end if;
  if not exists (select 1 from public.class_schedules
                  where id = 'f6100000-0000-4000-8000-00000000a001' and valid_until = date '2030-04-10') then
    raise exception 'FALHOU G10: vigência não gravada';
  end if;
  raise notice 'OK G10: encerrar tira as futuras sem chamada e preserva as com chamada, sem exceções';
end $$;

-- G11 — aula da grade apagada à mão não volta
reset role;
delete from public.classes
 where schedule_id = 'f6100000-0000-4000-8000-00000000a001' and occurrence_date = date '2030-04-01';
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a001', timestamptz '2030-03-01 10:00-03');
  if n <> 0 or exists (select 1 from public.classes where schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                        and occurrence_date = date '2030-04-01') then
    raise exception 'FALHOU G11: aula apagada à mão voltou';
  end if;
  raise notice 'OK G11: aula da grade apagada à mão não é recriada';
end $$;

-- G12 — aumentar a vigência volta a gerar
set local role authenticated;
do $$
begin
  perform public.salvar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', 'grade-a', 'Segunda noite', 1::smallint,
                                         '20:00', date '2030-03-01', null,
                                         array['f6100000-0000-4000-8000-000000000003'::uuid]);
end $$;
reset role;
do $$
declare n integer;
begin
  n := public.gerar_aulas_da_grade('f6100000-0000-4000-8000-00000000a001', timestamptz '2030-03-01 10:00-03');
  if n <> 2 or (select count(*) from public.classes c
                 join public.class_teachers ct on ct.class_id = c.id and ct.teacher_id = 'f6100000-0000-4000-8000-000000000003'
                where c.schedule_id = 'f6100000-0000-4000-8000-00000000a001'
                  and c.occurrence_date in (date '2030-04-15', date '2030-04-29')
                  and (c.date_time at time zone 'America/Sao_Paulo')::time = time '20:00') <> 2 then
    raise exception 'FALHOU G12: reabrir a vigência gerou % aula(s)', n;
  end if;
  raise notice 'OK G12: aumentar a vigência volta a gerar, com a hora e os professores atuais';
end $$;

-- G15 — validações
set local role authenticated;
do $$
begin
  begin
    perform public.salvar_horario_da_grade('f6100000-0000-4000-8000-00000000a001', 'grade-a', 'Segunda noite', 2::smallint,
                                           '20:00', date '2030-03-01', null, '{}');
    raise exception 'FALHOU G15: trocou o dia da semana na edição';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.salvar_horario_da_grade(null, 'grade-b', 'Dia 7', 7::smallint, '10:00', date '2030-03-01', null, '{}');
    raise exception 'FALHOU G15: aceitou weekday 7';
  exception when check_violation then null;
  end;
  begin
    perform public.salvar_horario_da_grade(null, 'grade-b', 'Invertida', 3::smallint, '10:00', date '2030-03-10', date '2030-03-01', '{}');
    raise exception 'FALHOU G15: aceitou fim antes do início';
  exception when check_violation then null;
  end;
  begin
    perform public.salvar_horario_da_grade(null, 'grade-b', 'Repetido', 5::smallint, '19:00', date '2030-05-01', null, '{}');
    raise exception 'FALHOU G15: aceitou horário repetido na mesma turma';
  exception when unique_violation then null;
  end;
  begin
    perform public.salvar_horario_da_grade(null, 'grade-b', 'Com aluno', 3::smallint, '10:00', date '2030-03-01', null,
                                           array['f6100000-0000-4000-8000-000000000007'::uuid]);
    raise exception 'FALHOU G15: aceitou aluno como professor';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK G15: dia da semana fixo na edição; dia, vigência, repetição e professor validados';
end $$;

-- G16 — professor excluído (LGPD) sai da grade
reset role;
set local request.jwt.claims = '';
do $$
begin
  perform public.anonimizar_titular('f6100000-0000-4000-8000-000000000006', 'f6100000-0000-4000-8000-000000000001');
  if exists (select 1 from public.class_schedule_teachers where teacher_id = 'f6100000-0000-4000-8000-000000000006') then
    raise exception 'FALHOU G16: professor anonimizado continua na grade';
  end if;
  raise notice 'OK G16: professor excluído sai da grade e não volta nas próximas gerações';
end $$;

rollback;
