-- Regressão da Fase 2 da frequência (docs/FREQUENCIA.md). Roda numa transação
-- e termina em ROLLBACK: nenhuma linha sobrevive, pode rodar contra produção.
--
-- Cenário fixo em NOVEMBRO/2026, referência 20/11/2026 15:00 (São Paulo):
--
--   aluno S (cadastrado em 03/11), turma G
--   c9  31/10 22:00  rotina, sem chamada ....... fora (outubro, mesmo sendo 01/11 em UTC)
--   c0  02/11 19:00  rotina, com chamada ....... fora para S (antes do cadastro)
--   c1  05/11 19:00  rotina, chamada, S presente  → conta, presença
--   c2  07/11 19:00  rotina, chamada, S sem marca → conta (falta)
--   c3  10/11 19:00  rotina, chamada, S falta + justificativa APROVADA → justificada
--   c4  12/11 19:00  rotina, SEM chamada (S declarou que vinha) → só no total
--   c6  14/11 19:00  rotina, chamada, S falta + justificativa PENDENTE → conta (falta)
--   e1  15/11 19:00  EVENTO, chamada, S presente → fora (evento)
--   x1  16/11 19:00  rotina de OUTRA turma → fora
--   c10 20/11 14:30  rotina, sem chamada, 30 min antes da referência → só no total
--   c5  25/11 19:00  rotina, futura → só no total
--   c7  30/11 23:30  rotina, futura → só no total (já é 01/12 em UTC)
--   c8  01/12 00:30  rotina → fora (dezembro)
--
--   Esperado para S: total 8 · contadas 4 · presenças 1 · justificadas 1
--                    frequência 1 / (4 − 1) = 33,33%
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values
  ('turma-freq2', 'Turma Freq Regras'),
  ('turma-freq2-outra', 'Turma Freq Outra');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('f0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-s@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-s2@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-s3@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-p@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-p2@t.invalid','x',now(),now(),now()),
  ('f0000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','r-adm@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at)
values
  ('f0000000-0000-4000-8000-000000000001','user','Aluno S','71000000001',false,'active','turma-freq2',null, timestamptz '2026-11-03 00:00-03'),
  ('f0000000-0000-4000-8000-000000000002','user','Aluno S2','71000000002',false,'active','turma-freq2',null, timestamptz '2026-10-01 00:00-03'),
  ('f0000000-0000-4000-8000-000000000003','user','Aluno S3','71000000003',false,'active','turma-freq2-outra',null, timestamptz '2026-10-01 00:00-03'),
  ('f0000000-0000-4000-8000-000000000004','professor','Prof P','71000000004',false,'active',null,'#333333', now()),
  ('f0000000-0000-4000-8000-000000000005','professor','Prof P2','71000000005',false,'active',null,'#444444', now()),
  ('f0000000-0000-4000-8000-000000000006','admin','Admin R','71000000006',false,'active',null,null, now());

insert into public.classes (id, title, type, date_time, group_id, attendance_taken_at) values
  ('f0000000-0000-4000-8000-00000000c009','c9','routine', timestamptz '2026-10-31 22:00-03','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000c000','c0','routine', timestamptz '2026-11-02 19:00-03','turma-freq2', timestamptz '2026-11-02 20:00-03'),
  ('f0000000-0000-4000-8000-00000000c001','c1','routine', timestamptz '2026-11-05 19:00-03','turma-freq2', timestamptz '2026-11-05 20:00-03'),
  ('f0000000-0000-4000-8000-00000000c002','c2','routine', timestamptz '2026-11-07 19:00-03','turma-freq2', timestamptz '2026-11-07 20:00-03'),
  ('f0000000-0000-4000-8000-00000000c003','c3','routine', timestamptz '2026-11-10 19:00-03','turma-freq2', timestamptz '2026-11-10 20:00-03'),
  ('f0000000-0000-4000-8000-00000000c004','c4','routine', timestamptz '2026-11-12 19:00-03','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000c006','c6','routine', timestamptz '2026-11-14 19:00-03','turma-freq2', timestamptz '2026-11-14 20:00-03'),
  ('f0000000-0000-4000-8000-00000000e001','e1','event',   timestamptz '2026-11-15 19:00-03','turma-freq2', timestamptz '2026-11-15 20:00-03'),
  ('f0000000-0000-4000-8000-00000000a001','x1','routine', timestamptz '2026-11-16 19:00-03','turma-freq2-outra', timestamptz '2026-11-16 20:00-03'),
  ('f0000000-0000-4000-8000-00000000c010','c10','routine',timestamptz '2026-11-20 14:30-03','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000c005','c5','routine', timestamptz '2026-11-25 19:00-03','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000c007','c7','routine', timestamptz '2026-11-30 23:30-03','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000c008','c8','routine', timestamptz '2026-12-01 00:30-03','turma-freq2', null),
  -- aulas relativas a AGORA, para concluir_chamada (que usa now() de propósito)
  ('f0000000-0000-4000-8000-00000000b001','k1','routine', now() - interval '1 hour','turma-freq2', null),
  ('f0000000-0000-4000-8000-00000000b002','k2','routine', now() + interval '1 day','turma-freq2', null);

insert into public.class_teachers (class_id, teacher_id)
select c.id, 'f0000000-0000-4000-8000-000000000004'::uuid
  from public.classes c
 where c.group_id = 'turma-freq2';

insert into public.class_teachers (class_id, teacher_id)
values ('f0000000-0000-4000-8000-00000000a001','f0000000-0000-4000-8000-000000000005');

insert into public.attendance (class_id, user_id, declared_status, status) values
  ('f0000000-0000-4000-8000-00000000c001','f0000000-0000-4000-8000-000000000001', null,     'present'),
  ('f0000000-0000-4000-8000-00000000c003','f0000000-0000-4000-8000-000000000001', 'absent', 'absent'),
  ('f0000000-0000-4000-8000-00000000c004','f0000000-0000-4000-8000-000000000001', 'present', null),
  ('f0000000-0000-4000-8000-00000000c006','f0000000-0000-4000-8000-000000000001', 'absent', 'absent'),
  ('f0000000-0000-4000-8000-00000000e001','f0000000-0000-4000-8000-000000000001', null,     'present');

insert into public.absence_justifications (class_id, user_id, message, status, reviewed_at) values
  ('f0000000-0000-4000-8000-00000000c003','f0000000-0000-4000-8000-000000000001','Atestado', 'approved', now()),
  ('f0000000-0000-4000-8000-00000000c006','f0000000-0000-4000-8000-000000000001','Pendente', 'pending', null);

-- =====================================================================
-- Ator: ALUNO S
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- T1 — a conta completa, com todas as exceções do denominador
do $$
declare r record;
begin
  select * into r from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000001'::uuid],
    timestamptz '2026-11-20 15:00-03');
  if r.reference_month <> date '2026-11-01' then
    raise exception 'FALHOU T1: mês de referência %', r.reference_month;
  end if;
  if (r.total_classes, r.counted_classes, r.attended, r.justified) <> (8, 4, 1, 1) then
    raise exception 'FALHOU T1: total %, contadas %, presenças %, justificadas % (esperado 8/4/1/1)',
      r.total_classes, r.counted_classes, r.attended, r.justified;
  end if;
  if r.frequency_percent <> 33.33 then
    raise exception 'FALHOU T1: frequência % (esperado 33.33)', r.frequency_percent;
  end if;
  raise notice 'OK T1: 1/8 aulas e 33,33%% — aula sem chamada, futura, evento e justificada fora do denominador';
end $$;

-- T5 — os cortes de fuso estão embutidos no total 8 do T1:
--      c7 (30/11 23:30 local, já 01/12 UTC) DENTRO; c8 e c9 FORA.
do $$ begin raise notice 'OK T5: recorte do mês no fuso de São Paulo (coberto pelo total do T1)'; end $$;

-- T13 — aluno não recebe aviso de aula sem chamada
do $$
declare n integer;
begin
  select count(*) into n from public.aulas_sem_chamada(timestamptz '2026-11-20 15:00-03');
  if n <> 0 then
    raise exception 'FALHOU T13: aluno viu % aviso(s) de aula sem chamada', n;
  end if;
  raise notice 'OK T13: aluno não recebe aviso de chamada';
end $$;

-- T6 — aluno não conclui chamada
do $$
begin
  begin
    perform public.concluir_chamada('f0000000-0000-4000-8000-00000000b001');
    raise exception 'FALHOU T6: aluno concluiu chamada';
  exception when insufficient_privilege then
    raise notice 'OK T6: aluno não conclui chamada';
  end;
end $$;

-- T18 — o app não executa o fechamento mensal
do $$
begin
  begin
    perform public.fechar_frequencia_do_mes(date '2026-11-01', timestamptz '2026-12-01 04:00+00');
    raise exception 'FALHOU T18: aluno executou o fechamento mensal';
  exception when insufficient_privilege then
    raise notice 'OK T18: fechamento mensal não é executável pelo app';
  end;
end $$;

-- =====================================================================
-- Ator: ALUNO S2 — dia 1º do mês
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}';

-- T2 — "0/9 e 100%" no dia 1º: total do mês inteiro, percentual sem aulas ainda
do $$
declare r record;
begin
  select * into r from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000002'::uuid],
    timestamptz '2026-11-01 08:00-03');
  if (r.total_classes, r.counted_classes, r.attended) <> (9, 0, 0) or r.frequency_percent <> 100 then
    raise exception 'FALHOU T2: total %, contadas %, presenças %, frequência % (esperado 9/0/0/100)',
      r.total_classes, r.counted_classes, r.attended, r.frequency_percent;
  end if;
  raise notice 'OK T2: dia 1º mostra 0/9 e 100%% (denominador zero vale 100)';
end $$;

-- =====================================================================
-- Ator: ALUNO S3 — privacidade
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000003","role":"authenticated"}';

-- T3 — aluno não vê a frequência de outro aluno
do $$
declare n integer;
begin
  select count(*) into n from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000001'::uuid],
    timestamptz '2026-11-20 15:00-03');
  if n <> 0 then
    raise exception 'FALHOU T3: aluno viu a frequência de outro aluno';
  end if;
  raise notice 'OK T3: frequência é privada entre alunos';
end $$;

-- =====================================================================
-- Ator: PROFESSOR P (professor das aulas da turma G)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000004","role":"authenticated"}';

-- T4 — professor vê a frequência de vários alunos numa chamada só
do $$
declare n integer;
begin
  select count(*) into n from public.frequencia_mensal(
    array['f0000000-0000-4000-8000-000000000001'::uuid, 'f0000000-0000-4000-8000-000000000002'::uuid],
    timestamptz '2026-11-20 15:00-03');
  if n <> 2 then
    raise exception 'FALHOU T4: professor recebeu % linha(s) (esperado 2)', n;
  end if;
  raise notice 'OK T4: professor consulta a frequência de vários alunos de uma vez';
end $$;

-- T10 — aviso: só c4 (c10 está na tolerância de 1h; c5 e c7 são futuras;
--       c8/c9 são de outro mês; as demais têm chamada)
do $$
declare v_ids uuid[];
begin
  select array_agg(class_id order by date_time) into v_ids
    from public.aulas_sem_chamada(timestamptz '2026-11-20 15:00-03')
   where class_id::text like 'f0000000-0000-4000-8000-%';
  if v_ids is distinct from array['f0000000-0000-4000-8000-00000000c004'::uuid] then
    raise exception 'FALHOU T10: avisos do professor %', v_ids;
  end if;
  raise notice 'OK T10: professor é avisado só da aula que passou sem chamada';
end $$;

-- T8 — não conclui chamada de aula que ainda não começou
do $$
begin
  begin
    perform public.concluir_chamada('f0000000-0000-4000-8000-00000000b002');
    raise exception 'FALHOU T8: concluiu chamada de aula futura';
  exception when check_violation then
    raise notice 'OK T8: aula futura não tem chamada concluída';
  end;
end $$;

-- T9 — conclui a chamada da própria aula, e repetir não reescreve o horário
do $$
declare v1 timestamptz; v2 timestamptz;
begin
  v1 := public.concluir_chamada('f0000000-0000-4000-8000-00000000b001');
  perform pg_sleep(0.01);
  v2 := public.concluir_chamada('f0000000-0000-4000-8000-00000000b001');
  if v1 is null or v1 <> v2 then
    raise exception 'FALHOU T9: conclusão % e repetição %', v1, v2;
  end if;
  raise notice 'OK T9: professor conclui a chamada; repetir é idempotente';
end $$;

-- =====================================================================
-- Ator: PROFESSOR P2 (não é professor das aulas da turma G)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000005","role":"authenticated"}';

-- T7 — professor de outra aula não conclui a chamada
do $$
begin
  begin
    perform public.concluir_chamada('f0000000-0000-4000-8000-00000000b002');
    raise exception 'FALHOU T7: professor de outra aula concluiu chamada';
  exception when insufficient_privilege then
    raise notice 'OK T7: só o professor da aula (ou admin) conclui a chamada';
  end;
end $$;

-- T11 — professor não é avisado de aulas que não são dele
do $$
declare n integer;
begin
  select count(*) into n
    from public.aulas_sem_chamada(timestamptz '2026-11-20 15:00-03')
   where class_id::text like 'f0000000-0000-4000-8000-%';
  if n <> 0 then
    raise exception 'FALHOU T11: professor recebeu % aviso(s) de aulas alheias', n;
  end if;
  raise notice 'OK T11: professor só é avisado das próprias aulas';
end $$;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000006","role":"authenticated"}';

-- T12 — admin é avisado de todas as aulas sem chamada
do $$
begin
  if not exists (select 1 from public.aulas_sem_chamada(timestamptz '2026-11-20 15:00-03')
                  where class_id = 'f0000000-0000-4000-8000-00000000c004') then
    raise exception 'FALHOU T12: admin não foi avisado da aula sem chamada';
  end if;
  raise notice 'OK T12: admin é avisado de todas as aulas sem chamada';
end $$;

-- =====================================================================
-- Ator: SISTEMA (cron, sem JWT) — fechamento mensal
-- =====================================================================
reset role;
set local request.jwt.claims = '';

-- T16 — não congela mês que ainda não terminou
do $$
begin
  begin
    perform public.fechar_frequencia_do_mes(date '2026-11-01', timestamptz '2026-11-30 12:00-03');
    raise exception 'FALHOU T16: fechou mês em andamento';
  exception when invalid_parameter_value then
    raise notice 'OK T16: mês em andamento não é congelado';
  end;
end $$;

-- T14 — fecha novembro com os mesmos números do cálculo ao vivo
do $$
declare n integer; r record;
begin
  n := public.fechar_frequencia_do_mes(date '2026-11-01', timestamptz '2026-12-01 04:00+00');
  if n < 1 then
    raise exception 'FALHOU T14: fechamento gravou % linha(s)', n;
  end if;
  select * into r from public.attendance_monthly
   where user_id = 'f0000000-0000-4000-8000-000000000001' and reference_month = date '2026-11-01';
  if (r.total_classes, r.counted_classes, r.attended, r.justified) <> (8, 4, 1, 1)
     or r.frequency_percent <> 33.33 or r.group_id <> 'turma-freq2' then
    raise exception 'FALHOU T14: retrato %/%/%/% % turma %',
      r.total_classes, r.counted_classes, r.attended, r.justified, r.frequency_percent, r.group_id;
  end if;
  raise notice 'OK T14: novembro congelado com os números do cálculo';
end $$;

-- T15 — congelado de verdade: corrigir uma chamada antiga não muda o mês fechado
do $$
declare n integer; v numeric;
begin
  update public.attendance set status = 'present'
   where class_id = 'f0000000-0000-4000-8000-00000000c006'
     and user_id = 'f0000000-0000-4000-8000-000000000001';
  n := public.fechar_frequencia_do_mes(date '2026-11-01', timestamptz '2026-12-01 04:00+00');
  select frequency_percent into v from public.attendance_monthly
   where user_id = 'f0000000-0000-4000-8000-000000000001' and reference_month = date '2026-11-01';
  if n <> 0 or v <> 33.33 then
    raise exception 'FALHOU T15: refechamento gravou % e a frequência virou %', n, v;
  end if;
  raise notice 'OK T15: mês fechado não muda com edição posterior';
end $$;

-- T17 — o cron do fechamento está agendado depois da meia-noite de São Paulo
do $$
begin
  if not exists (select 1 from cron.job
                  where jobname = 'close-monthly-attendance' and schedule = '20 3 1 * *') then
    raise exception 'FALHOU T17: cron do fechamento mensal ausente ou no horário errado';
  end if;
  raise notice 'OK T17: fechamento agendado para 00:20 de São Paulo do dia 1º';
end $$;

rollback;
