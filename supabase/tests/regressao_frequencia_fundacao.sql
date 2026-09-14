-- Regressão da Fase 1 da frequência (docs/FREQUENCIA.md). Roda numa transação
-- e termina em ROLLBACK: nenhuma linha sobrevive, pode rodar contra produção.
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa: 1 turma, 2 aulas (cada uma com um professor), 2 alunos, 1 admin.
-- ---------------------------------------------------------------------
insert into public.groups (id, name)
values ('d0000000-0000-4000-8000-0000000000a1', 'Turma Freq Teste');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('d0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-aluno1@t.invalid','x',now(),now(),now()),
  ('d0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-aluno2@t.invalid','x',now(),now(),now()),
  ('d0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-prof1@t.invalid','x',now(),now(),now()),
  ('d0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-prof2@t.invalid','x',now(),now(),now()),
  ('d0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f-admin@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color)
values
  ('d0000000-0000-4000-8000-000000000001','user','Aluno Um','70000000001',false,'active','d0000000-0000-4000-8000-0000000000a1',null),
  ('d0000000-0000-4000-8000-000000000002','user','Aluno Dois','70000000002',false,'active','d0000000-0000-4000-8000-0000000000a1',null),
  ('d0000000-0000-4000-8000-000000000003','professor','Prof Um','70000000003',false,'active',null,'#111111'),
  ('d0000000-0000-4000-8000-000000000004','professor','Prof Dois','70000000004',false,'active',null,'#222222'),
  ('d0000000-0000-4000-8000-000000000005','admin','Admin F','70000000005',false,'active',null,null);

insert into public.classes (id, title, type, date_time, group_id)
values
  ('d0000000-0000-4000-8000-0000000000c1','Aula Freq 1','routine', now() - interval '2 hours','d0000000-0000-4000-8000-0000000000a1'),
  ('d0000000-0000-4000-8000-0000000000c2','Aula Freq 2','routine', now() - interval '1 day','d0000000-0000-4000-8000-0000000000a1');

insert into public.class_teachers (class_id, teacher_id)
values
  ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-0000000000c2','d0000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------
-- T0 — estrutura: as colunas novas existem e a migração de dados não deixou
--      nenhuma "presença oficial" herdada de declaração de aluno
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'attendance' and column_name = 'declared_status') then
    raise exception 'FALHOU T0: attendance.declared_status não existe';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'classes' and column_name = 'attendance_taken_at') then
    raise exception 'FALHOU T0: classes.attendance_taken_at não existe';
  end if;
  raise notice 'OK T0: estrutura da fundação presente';
end $$;

-- =====================================================================
-- Ator: ALUNO 1
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- T1 — aluno declara que vai (sugestivo)
insert into public.attendance (class_id, user_id, declared_status)
values ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000001','present');

do $$
begin
  if not exists (select 1 from public.attendance
                  where class_id = 'd0000000-0000-4000-8000-0000000000c1'
                    and user_id = 'd0000000-0000-4000-8000-000000000001'
                    and declared_status = 'present' and status is null) then
    raise exception 'FALHOU T1: declaração do aluno não gravou como sugestiva';
  end if;
  raise notice 'OK T1: aluno declara presença sem gerar presença oficial';
end $$;

-- T2 — aluno NÃO se autoconfirma presente
do $$
begin
  begin
    update public.attendance set status = 'present'
     where class_id = 'd0000000-0000-4000-8000-0000000000c1'
       and user_id = 'd0000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU T2: aluno se autoconfirmou presente';
  exception when insufficient_privilege then
    raise notice 'OK T2: aluno não altera a chamada oficial';
  end;
end $$;

-- T3 — aluno NÃO insere a linha já com presença oficial
do $$
begin
  begin
    insert into public.attendance (class_id, user_id, declared_status, status)
    values ('d0000000-0000-4000-8000-0000000000c2','d0000000-0000-4000-8000-000000000001','absent','present');
    raise exception 'FALHOU T3: aluno inseriu presença oficial';
  exception when insufficient_privilege then
    raise notice 'OK T3: insert com presença oficial é recusado para o aluno';
  end;
end $$;

-- =====================================================================
-- Ator: PROFESSOR 1 (professor da aula 1)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated"}';

-- T4 — professor da aula confirma a presença
update public.attendance set status = 'present'
 where class_id = 'd0000000-0000-4000-8000-0000000000c1'
   and user_id = 'd0000000-0000-4000-8000-000000000001';

do $$
declare v public.attendance_status;
begin
  select status into v from public.attendance
   where class_id = 'd0000000-0000-4000-8000-0000000000c1'
     and user_id = 'd0000000-0000-4000-8000-000000000001';
  if v is distinct from 'present' then
    raise exception 'FALHOU T4: professor da aula não confirmou a presença (%)', v;
  end if;
  raise notice 'OK T4: professor da aula registra a chamada';
end $$;

-- =====================================================================
-- Ator: PROFESSOR 2 (NÃO é professor da aula 1)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}';

-- T5 — professor de outra aula não faz chamada da aula 1
do $$
begin
  begin
    insert into public.attendance (class_id, user_id, status)
    values ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000002','absent');
    raise exception 'FALHOU T5: professor de outra aula registrou chamada';
  exception when insufficient_privilege then
    raise notice 'OK T5: só o professor da aula (ou admin) faz a chamada';
  end;
end $$;

-- =====================================================================
-- Ator: ALUNO 2
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}';

-- T6 — sem declarar ausência, não há o que justificar
do $$
begin
  begin
    insert into public.absence_justifications (class_id, user_id, message)
    values ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000002','Sem declarar');
    raise exception 'FALHOU T6: justificativa aceita sem declaração de ausência';
  exception when check_violation then
    raise notice 'OK T6: justificativa exige declaração de ausência';
  end;
end $$;

-- T7 — declara ausência e justifica: nasce pendente
insert into public.attendance (class_id, user_id, declared_status)
values ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000002','absent');

insert into public.absence_justifications (id, class_id, user_id, message)
values ('d0000000-0000-4000-8000-0000000000e1','d0000000-0000-4000-8000-0000000000c1',
        'd0000000-0000-4000-8000-000000000002','Consulta médica');

do $$
begin
  if not exists (select 1 from public.absence_justifications
                  where id = 'd0000000-0000-4000-8000-0000000000e1'
                    and status = 'pending' and reviewed_at is null) then
    raise exception 'FALHOU T7: justificativa não nasceu pendente';
  end if;
  raise notice 'OK T7: justificativa nasce pendente de revisão';
end $$;

-- T8 — mensagem acima de 255 caracteres é recusada no BANCO
do $$
begin
  begin
    update public.absence_justifications set message = repeat('x', 256)
     where id = 'd0000000-0000-4000-8000-0000000000e1';
    raise exception 'FALHOU T8: aceitou mensagem com 256 caracteres';
  exception when check_violation then
    raise notice 'OK T8: limite de 255 caracteres vale no banco';
  end;
end $$;

-- T9 — justificativa vazia (só espaços, sem anexo) é recusada
insert into public.attendance (class_id, user_id, declared_status)
values ('d0000000-0000-4000-8000-0000000000c2','d0000000-0000-4000-8000-000000000002','absent');

do $$
begin
  begin
    insert into public.absence_justifications (class_id, user_id, message)
    values ('d0000000-0000-4000-8000-0000000000c2','d0000000-0000-4000-8000-000000000002','   ');
    raise exception 'FALHOU T9: aceitou justificativa vazia';
  exception when check_violation then
    raise notice 'OK T9: justificativa precisa de mensagem ou anexo';
  end;
end $$;

-- T10 — aluno NÃO aprova a própria justificativa
do $$
begin
  begin
    update public.absence_justifications set status = 'approved'
     where id = 'd0000000-0000-4000-8000-0000000000e1';
    raise exception 'FALHOU T10: aluno se autoaprovou';
  exception when insufficient_privilege then
    raise notice 'OK T10: aluno não revisa a própria justificativa';
  end;
end $$;

-- T16 — uma justificativa por aluno por aula
do $$
begin
  begin
    insert into public.absence_justifications (class_id, user_id, message)
    values ('d0000000-0000-4000-8000-0000000000c1','d0000000-0000-4000-8000-000000000002','Outra');
    raise exception 'FALHOU T16: duas justificativas para a mesma aula';
  exception when unique_violation then
    raise notice 'OK T16: uma justificativa por aluno por aula';
  end;
end $$;

-- T14a — prepara a troca de anexo (ainda como aluno 2, pendente)
insert into public.absence_justifications (id, class_id, user_id, proof_provider, proof_public_id)
values ('d0000000-0000-4000-8000-0000000000e2','d0000000-0000-4000-8000-0000000000c2',
        'd0000000-0000-4000-8000-000000000002','cloudinary','justificativas/teste/anexo-antigo');

update public.absence_justifications set proof_public_id = 'justificativas/teste/anexo-novo'
 where id = 'd0000000-0000-4000-8000-0000000000e2';

-- =====================================================================
-- Ator: ALUNO 1 — privacidade entre alunos
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- T13 — aluno não vê a justificativa de outro aluno
do $$
declare n integer;
begin
  select count(*) into n from public.absence_justifications
   where user_id = 'd0000000-0000-4000-8000-000000000002';
  if n <> 0 then
    raise exception 'FALHOU T13: aluno viu % justificativa(s) de outro aluno', n;
  end if;
  raise notice 'OK T13: justificativa é privada entre alunos';
end $$;

-- T15a — aluno não grava no histórico mensal
do $$
begin
  begin
    insert into public.attendance_monthly (user_id, reference_month, total_classes,
                                           counted_classes, attended, justified, frequency_percent)
    values ('d0000000-0000-4000-8000-000000000001', date_trunc('month', current_date)::date, 12, 0, 0, 0, 100);
    raise exception 'FALHOU T15a: aluno escreveu no próprio histórico';
  exception when insufficient_privilege then
    raise notice 'OK T15a: histórico mensal não é gravável pelo app';
  end;
end $$;

-- =====================================================================
-- Ator: PROFESSOR 2 — tenta revisar justificativa de aula que não é dele
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}';

-- T11b — professor de outra aula não aprova (a RLS filtra: 0 linhas)
do $$
declare n integer;
begin
  update public.absence_justifications set status = 'rejected'
   where id = 'd0000000-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FALHOU T11b: professor de outra aula revisou a justificativa';
  end if;
  raise notice 'OK T11b: só o professor da aula (ou admin) revisa';
end $$;

-- =====================================================================
-- Ator: PROFESSOR 1 — revisa a justificativa da aula dele
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated"}';

-- T11 — aprova, tentando forjar outro revisor: o carimbo é automático
update public.absence_justifications
   set status = 'approved',
       reviewed_by = 'd0000000-0000-4000-8000-000000000005'
 where id = 'd0000000-0000-4000-8000-0000000000e1';

do $$
declare v_por uuid; v_em timestamptz;
begin
  select reviewed_by, reviewed_at into v_por, v_em
    from public.absence_justifications
   where id = 'd0000000-0000-4000-8000-0000000000e1';
  if v_por is distinct from 'd0000000-0000-4000-8000-000000000003'::uuid or v_em is null then
    raise exception 'FALHOU T11: carimbo de revisão errado (por %, em %)', v_por, v_em;
  end if;
  raise notice 'OK T11: aprovação carimba o revisor real, sem forja';
end $$;

-- T11c — quem revisa não reescreve o que o aluno enviou
do $$
begin
  begin
    update public.absence_justifications set message = 'Editado pelo professor'
     where id = 'd0000000-0000-4000-8000-0000000000e1';
    raise exception 'FALHOU T11c: revisor alterou o conteúdo';
  exception when insufficient_privilege then
    raise notice 'OK T11c: revisor não altera o conteúdo';
  end;
end $$;

-- =====================================================================
-- Ator: ALUNO 2 — justificativa já revisada é imutável para ele
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}';

-- T12
do $$
begin
  begin
    update public.absence_justifications set message = 'Mudei de ideia'
     where id = 'd0000000-0000-4000-8000-0000000000e1';
    raise exception 'FALHOU T12: aluno editou justificativa já revisada';
  exception when insufficient_privilege then
    raise notice 'OK T12: justificativa revisada não é editada pelo aluno';
  end;
end $$;

-- =====================================================================
-- Ator: SISTEMA (sem JWT) — verificações que exigem visão total
-- =====================================================================
reset role;
set local request.jwt.claims = '';

-- T14 — trocar o anexo enfileira o ANTIGO para eliminação (LGPD)
do $$
begin
  if not exists (select 1 from public.media_deletion_queue
                  where asset_ref = 'justificativas/teste/anexo-antigo'
                    and justification_id = 'd0000000-0000-4000-8000-0000000000e2'
                    and motivo = 'justificativa_removida'
                    and processado_em is null) then
    raise exception 'FALHOU T14: anexo substituído não foi para a fila de eliminação';
  end if;
  raise notice 'OK T14: anexo trocado entra na fila LGPD';
end $$;

-- T17 — histórico mensal recusa contagens incoerentes
do $$
begin
  begin
    insert into public.attendance_monthly (user_id, reference_month, total_classes,
                                           counted_classes, attended, justified, frequency_percent)
    values ('d0000000-0000-4000-8000-000000000001', date '2026-08-01', 12, 5, 4, 3, 100);
    raise exception 'FALHOU T17: aceitou presenças + justificadas acima das aulas contadas';
  exception when check_violation then
    raise notice 'OK T17: histórico mensal recusa contagens incoerentes';
  end;
end $$;

-- T15b/c — leitura do histórico: aluno só o próprio, professor o de todos
insert into public.attendance_monthly (user_id, reference_month, total_classes,
                                       counted_classes, attended, justified, frequency_percent)
values
  ('d0000000-0000-4000-8000-000000000001', date '2026-08-01', 12, 12, 11, 0, 91.67),
  ('d0000000-0000-4000-8000-000000000002', date '2026-08-01', 12, 12, 9, 2, 90.00);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare n integer;
begin
  select count(*) into n from public.attendance_monthly
   where user_id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002');
  if n <> 1 then
    raise exception 'FALHOU T15b: aluno enxergou % registros mensais (esperado 1, o próprio)', n;
  end if;
  raise notice 'OK T15b: aluno vê só o próprio histórico mensal';
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated"}';

do $$
declare n integer;
begin
  select count(*) into n from public.attendance_monthly
   where user_id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002');
  if n <> 2 then
    raise exception 'FALHOU T15c: professor enxergou % registros mensais (esperado 2)', n;
  end if;
  raise notice 'OK T15c: professor vê o histórico mensal dos alunos';
end $$;

rollback;
