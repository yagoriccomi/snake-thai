-- Regressão de renomear, excluir, arquivar e reativar turma
-- (migrations 20260916201935_turmas_arquivamento e 20260916201939_grade_semanal).
-- Roda numa transação e termina em ROLLBACK; mesmo assim, rode só no banco
-- local (scripts\db-dev test).
--
--   t6-a  turma com histórico: 2 alunos, aula passada com chamada (ligada a um
--         horário), aula passada sem chamada, aula futura avulsa com
--         justificativa anexada, aula futura da grade e mês congelado
--   t6-b  destino dos alunos · t6-c nunca usada · t6-d um aluno, sem aulas
--   ALU1, ALU2 (t6-a) · ALU3 (t6-d) · PROF · ADM
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values
  ('t6-a', 'Turma T6 A'), ('t6-b', 'Turma T6 B'), ('t6-c', 'Turma T6 C'), ('t6-d', 'Turma T6 D');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('f6000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6-alu1@t.invalid','x',now(),now(),now()),
  ('f6000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6-alu2@t.invalid','x',now(),now(),now()),
  ('f6000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6-alu3@t.invalid','x',now(),now(),now()),
  ('f6000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6-prof@t.invalid','x',now(),now(),now()),
  ('f6000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t6-adm@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color)
values
  ('f6000000-0000-4000-8000-000000000001','user','Aluno T6 Um','66000000001',false,'active','t6-a',null),
  ('f6000000-0000-4000-8000-000000000002','user','Aluno T6 Dois','66000000002',false,'active','t6-a',null),
  ('f6000000-0000-4000-8000-000000000003','user','Aluno T6 Três','66000000003',false,'active','t6-d',null),
  ('f6000000-0000-4000-8000-000000000004','professor','Prof T6','66000000004',false,'active',null,'#0A0B0C'),
  ('f6000000-0000-4000-8000-000000000005','admin','Admin T6','66000000005',false,'active',null,null);

insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from)
values ('f6000000-0000-4000-8000-00000000a001', 't6-a', 'Grade T6', 4, '10:00', date '2026-01-01');

-- Datas passadas fixas (meio de janeiro) para o aviso de aula sem chamada ser
-- determinístico; as futuras são relativas a now().
insert into public.classes (id, title, type, date_time, group_id, schedule_id, occurrence_date, attendance_taken_at) values
  ('f6000000-0000-4000-8000-00000000c001','t6 passada com chamada','routine', timestamptz '2026-01-15 10:00-03','t6-a',
   'f6000000-0000-4000-8000-00000000a001', date '2026-01-15', timestamptz '2026-01-15 11:00-03'),
  ('f6000000-0000-4000-8000-00000000c002','t6 passada sem chamada','routine', timestamptz '2026-01-14 10:00-03','t6-a', null, null, null),
  ('f6000000-0000-4000-8000-00000000c003','t6 futura avulsa','routine', now() + interval '2 days','t6-a', null, null, null),
  ('f6000000-0000-4000-8000-00000000c004','t6 futura da grade','routine', now() + interval '3 days','t6-a',
   'f6000000-0000-4000-8000-00000000a001', ((now() + interval '3 days') at time zone 'America/Sao_Paulo')::date, null),
  ('f6000000-0000-4000-8000-00000000c005','t6 evento global','event', now() + interval '4 days', null, null, null, null);

insert into public.attendance (class_id, user_id, declared_status, status) values
  ('f6000000-0000-4000-8000-00000000c001','f6000000-0000-4000-8000-000000000001', null, 'present'),
  ('f6000000-0000-4000-8000-00000000c003','f6000000-0000-4000-8000-000000000002', 'absent', null);

insert into public.absence_justifications (class_id, user_id, message, proof_provider, proof_public_id) values
  ('f6000000-0000-4000-8000-00000000c003','f6000000-0000-4000-8000-000000000002',
   'Viagem', 'cloudinary', 'justificativas/t6/c003');

insert into public.attendance_monthly (user_id, reference_month, group_id, total_classes, counted_classes, attended, justified, frequency_percent)
values ('f6000000-0000-4000-8000-000000000001', date '2025-12-01', 't6-a', 8, 8, 8, 0, 100);

-- =====================================================================
-- Sistema
-- =====================================================================

-- T3 — turma usada não é apagada por DELETE direto
do $$
declare n integer;
begin
  begin
    delete from public.groups where id = 't6-a';
    raise exception 'FALHOU T3: DELETE direto apagou turma com vínculos';
  exception when foreign_key_violation then null;
  end;
  select count(*) into n from public.classes where type = 'routine' and group_id is null;
  if n <> 0 then
    raise exception 'FALHOU T3: % aula(s) de rotina sem turma', n;
  end if;
  raise notice 'OK T3: turma com vínculos não é apagada por DELETE';
end $$;

-- T4 — rotina exige turma
do $$
begin
  begin
    insert into public.classes (title, type, date_time, group_id)
    values ('t6 rotina sem turma', 'routine', now() + interval '1 day', null);
    raise exception 'FALHOU T4: aula de rotina sem turma aceita';
  exception when check_violation then null;
  end;
  raise notice 'OK T4: aula de rotina exige turma';
end $$;

-- =====================================================================
-- T1 — aluno e professor não mexem em turma
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare n integer;
begin
  update public.groups set name = 'Hackeada' where id = 't6-a';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FALHOU T1: aluno renomeou a turma';
  end if;
  begin
    update public.groups set archived_at = now() where id = 't6-a';
    raise exception 'FALHOU T1: aluno arquivou a turma direto';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.excluir_turma('t6-a', 't6-b');
    raise exception 'FALHOU T1: aluno excluiu a turma';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.previa_exclusao_turma('t6-a');
    raise exception 'FALHOU T1: aluno viu a prévia';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  begin
    perform public.excluir_turma('t6-a', 't6-b');
    raise exception 'FALHOU T1: professor excluiu a turma';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reativar_turma('t6-a');
    raise exception 'FALHOU T1: professor reativou a turma';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T1: aluno e professor não renomeiam, arquivam nem excluem turma';
end $$;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
set local request.jwt.claims = '{"sub":"f6000000-0000-4000-8000-000000000005","role":"authenticated"}';

-- T2 — renomear
do $$
begin
  update public.groups set name = 'Turma T6 B Renomeada' where id = 't6-b';
  if not exists (select 1 from public.groups where id = 't6-b' and name = 'Turma T6 B Renomeada') then
    raise exception 'FALHOU T2: admin não renomeou';
  end if;
  begin
    update public.groups set name = 'Turma T6 A' where id = 't6-b';
    raise exception 'FALHOU T2: nome duplicado aceito';
  exception when unique_violation then null;
  end;
  begin
    update public.groups set name = '   ' where id = 't6-b';
    raise exception 'FALHOU T2: nome em branco aceito';
  exception when check_violation then null;
  end;
  begin
    update public.groups set archived_at = now() where id = 't6-c';
    raise exception 'FALHOU T2: admin arquivou por UPDATE direto';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.groups where id = 't6-c';
    raise exception 'FALHOU T2: admin apagou por DELETE direto';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T2: admin renomeia; nome duplicado ou em branco recusado; arquivar e apagar só por função';
end $$;

-- T5 — prévia
do $$
declare v jsonb;
begin
  v := public.previa_exclusao_turma('t6-a');
  if (v->>'alunos')::int <> 2 or (v->>'aulas_futuras_sem_chamada')::int <> 2 or (v->>'aulas_passadas')::int <> 2
     or (v->>'horarios_ativos')::int <> 1 or (v->>'meses_congelados')::int <> 1
     or (v->>'pode_apagar_de_vez')::boolean or (v->>'arquivada')::boolean then
    raise exception 'FALHOU T5: prévia de t6-a %', v;
  end if;
  v := public.previa_exclusao_turma('t6-c');
  if (v->>'alunos')::int <> 0 or (v->>'aulas_passadas')::int <> 0 or not (v->>'pode_apagar_de_vez')::boolean then
    raise exception 'FALHOU T5: prévia de t6-c %', v;
  end if;
  raise notice 'OK T5: prévia conta alunos, aulas, horários e meses congelados';
end $$;

-- T10 (antes) — a aula sem chamada aparece enquanto a turma está ativa
do $$
begin
  if not exists (select 1 from public.aulas_sem_chamada(timestamptz '2026-01-15 12:00-03')
                  where class_id = 'f6000000-0000-4000-8000-00000000c002') then
    raise exception 'FALHOU T10: aula sem chamada não apareceu com a turma ativa';
  end if;
end $$;

-- T6 — destino dos alunos
do $$
declare v jsonb;
begin
  begin
    perform public.excluir_turma('t6-a');
    raise exception 'FALHOU T6: excluiu turma com alunos sem destino';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.excluir_turma('t6-a', 't6-b', true);
    raise exception 'FALHOU T6: aceitou destino e "sem turma" juntos';
  exception when invalid_parameter_value then null;
  end;

  v := public.excluir_turma('t6-d', null, true);
  if exists (select 1 from public.profiles where id = 'f6000000-0000-4000-8000-000000000003' and group_id is not null) then
    raise exception 'FALHOU T6: aluno de t6-d continuou com turma';
  end if;
  if v->>'acao' <> 'apagada' then
    raise exception 'FALHOU T6: t6-d sem histórico deveria ser apagada, veio %', v;
  end if;

  v := public.excluir_turma('t6-a', 't6-b');
  if v->>'acao' <> 'arquivada' or (v->>'alunos_movidos')::int <> 2 or (v->>'aulas_removidas')::int <> 2 then
    raise exception 'FALHOU T6: resultado de t6-a %', v;
  end if;
  if (select count(*) from public.profiles where group_id = 't6-b') <> 2 then
    raise exception 'FALHOU T6: alunos não foram para t6-b';
  end if;
  raise notice 'OK T6: exige destino; move para outra turma ou deixa sem turma de propósito';
end $$;

-- T7 — o que o arquivamento preserva e o que tira
do $$
begin
  if not exists (select 1 from public.groups where id = 't6-a' and archived_at is not null) then
    raise exception 'FALHOU T7: t6-a não foi arquivada';
  end if;
  if exists (select 1 from public.classes where id in ('f6000000-0000-4000-8000-00000000c003','f6000000-0000-4000-8000-00000000c004')) then
    raise exception 'FALHOU T7: aula futura sem chamada sobrou';
  end if;
  if (select count(*) from public.classes
       where id in ('f6000000-0000-4000-8000-00000000c001','f6000000-0000-4000-8000-00000000c002')
         and group_id = 't6-a') <> 2 then
    raise exception 'FALHOU T7: aula passada perdeu a turma';
  end if;
  if not exists (select 1 from public.classes where id = 'f6000000-0000-4000-8000-00000000c005') then
    raise exception 'FALHOU T7: evento global foi apagado';
  end if;
  if not exists (select 1 from public.class_schedules
                  where id = 'f6000000-0000-4000-8000-00000000a001'
                    and valid_until = (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'FALHOU T7: horário com histórico não foi encerrado hoje';
  end if;
  if not exists (select 1 from public.attendance
                  where class_id = 'f6000000-0000-4000-8000-00000000c001' and status = 'present') then
    raise exception 'FALHOU T7: chamada passada perdida';
  end if;
  raise notice 'OK T7: arquivar tira aulas futuras e preserva passadas, eventos, horário encerrado e chamada';
end $$;

-- T8 — turma arquivada não recebe aluno, aula nem horário
do $$
begin
  begin
    update public.profiles set group_id = 't6-a' where id = 'f6000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU T8: aluno entrou em turma arquivada';
  exception when check_violation then null;
  end;
  begin
    insert into public.classes (title, type, date_time, group_id)
    values ('t6 nova em arquivada', 'routine', now() + interval '1 day', 't6-a');
    raise exception 'FALHOU T8: aula criada em turma arquivada';
  exception when check_violation then null;
  end;
  begin
    perform public.salvar_horario_da_grade(null, 't6-a', 'Novo', 2::smallint, '18:00', date '2030-01-01', null, '{}');
    raise exception 'FALHOU T8: horário criado em turma arquivada';
  exception when check_violation then null;
  end;
  begin
    perform public.excluir_turma('t6-c', 't6-a');
    raise exception 'FALHOU T8: turma arquivada aceita como destino';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.excluir_turma('t6-a', 't6-b');
    raise exception 'FALHOU T8: arquivou de novo';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK T8: turma arquivada não recebe aluno, aula, horário nem vira destino';
end $$;

-- T9 — chamada congelada
do $$
begin
  begin
    perform public.salvar_chamada('f6000000-0000-4000-8000-00000000c001', '{}', '{}');
    raise exception 'FALHOU T9: salvou chamada de turma arquivada';
  exception when check_violation then null;
  end;
  begin
    perform public.concluir_chamada('f6000000-0000-4000-8000-00000000c002');
    raise exception 'FALHOU T9: concluiu chamada de turma arquivada';
  exception when check_violation then null;
  end;
  if not exists (select 1 from public.attendance
                  where class_id = 'f6000000-0000-4000-8000-00000000c001'
                    and user_id = 'f6000000-0000-4000-8000-000000000001' and status = 'present') then
    raise exception 'FALHOU T9: chamada existente foi alterada';
  end if;
  raise notice 'OK T9: chamada de turma arquivada fica congelada';
end $$;

-- T10 — aviso de aula sem chamada ignora turma arquivada
do $$
begin
  if exists (select 1 from public.aulas_sem_chamada(timestamptz '2026-01-15 12:00-03') where group_id = 't6-a') then
    raise exception 'FALHOU T10: aula de turma arquivada no aviso';
  end if;
  raise notice 'OK T10: aviso de aula sem chamada ignora turma arquivada';
end $$;

-- T11 — turma nunca usada é apagada de fato
do $$
declare v jsonb;
begin
  v := public.excluir_turma('t6-c');
  if v->>'acao' <> 'apagada' or exists (select 1 from public.groups where id = 't6-c') then
    raise exception 'FALHOU T11: turma nunca usada não foi apagada (%)', v;
  end if;
  raise notice 'OK T11: turma nunca usada é apagada';
end $$;

-- T12 — reativar
do $$
begin
  perform public.reativar_turma('t6-a');
  update public.profiles set group_id = 't6-a' where id = 'f6000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.profiles where id = 'f6000000-0000-4000-8000-000000000001' and group_id = 't6-a') then
    raise exception 'FALHOU T12: turma reativada não aceitou aluno';
  end if;
  raise notice 'OK T12: turma reativada volta a aceitar alunos';
end $$;

-- =====================================================================
-- Sistema: a fila de eliminação não é legível pelo app
-- =====================================================================
reset role;

-- T13 — anexo da justificativa da aula removida vai para a fila LGPD
do $$
begin
  if not exists (select 1 from public.media_deletion_queue
                  where asset_ref = 'justificativas/t6/c003' and processado_em is null) then
    raise exception 'FALHOU T13: anexo da justificativa removida não entrou na fila';
  end if;
  raise notice 'OK T13: anexo de justificativa da aula removida entra na fila LGPD';
end $$;

rollback;
