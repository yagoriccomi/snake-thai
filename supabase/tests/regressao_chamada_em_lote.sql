-- Regressão da chamada em lote e do comprovante obrigatório
-- (migration 20260914190000_chamada_em_lote). Roda numa transação e termina
-- em ROLLBACK: nenhuma linha sobrevive, pode rodar contra produção.
--
--   turma L · aula k1 (começou há 1 h) e k2 (amanhã) · professor P nas duas
--   A1 declarou que vem · A2 sem registro · A3 já tinha presença gravada
--   P2 é professor, mas não desta aula
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values ('turma-lote', 'Turma Chamada em Lote');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-a1@t.invalid','x',now(),now(),now()),
  ('e0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-a2@t.invalid','x',now(),now(),now()),
  ('e0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-a3@t.invalid','x',now(),now(),now()),
  ('e0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-p@t.invalid','x',now(),now(),now()),
  ('e0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-p2@t.invalid','x',now(),now(),now()),
  ('e0000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','l-adm@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color)
values
  ('e0000000-0000-4000-8000-000000000001','user','Aluno A1','72000000001',false,'active','turma-lote',null),
  ('e0000000-0000-4000-8000-000000000002','user','Aluno A2','72000000002',false,'active','turma-lote',null),
  ('e0000000-0000-4000-8000-000000000003','user','Aluno A3','72000000003',false,'active','turma-lote',null),
  ('e0000000-0000-4000-8000-000000000004','professor','Prof L','72000000004',false,'active',null,'#555555'),
  ('e0000000-0000-4000-8000-000000000005','professor','Prof L2','72000000005',false,'active',null,'#666666'),
  ('e0000000-0000-4000-8000-000000000006','admin','Admin L','72000000006',false,'active',null,null);

insert into public.classes (id, title, type, date_time, group_id) values
  ('e0000000-0000-4000-8000-00000000b001','lote-k1','routine', now() - interval '1 hour','turma-lote'),
  ('e0000000-0000-4000-8000-00000000b002','lote-k2','routine', now() + interval '1 day','turma-lote');

insert into public.class_teachers (class_id, teacher_id) values
  ('e0000000-0000-4000-8000-00000000b001','e0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-00000000b002','e0000000-0000-4000-8000-000000000004');

insert into public.attendance (class_id, user_id, declared_status, status) values
  ('e0000000-0000-4000-8000-00000000b001','e0000000-0000-4000-8000-000000000001','present', null),
  ('e0000000-0000-4000-8000-00000000b001','e0000000-0000-4000-8000-000000000003', null,     'present');

-- Competências em 2030: longe de qualquer fatura de entrada criada pelo gatilho.
insert into public.payments (id, user_id, amount_cents, due_date, reference_month, status) values
  ('e0000000-0000-4000-8000-00000000d001','e0000000-0000-4000-8000-000000000001',10000, date '2030-01-10', date '2030-01-01','open'),
  ('e0000000-0000-4000-8000-00000000d002','e0000000-0000-4000-8000-000000000001',10000, date '2030-02-10', date '2030-02-01','open'),
  ('e0000000-0000-4000-8000-00000000d003','e0000000-0000-4000-8000-000000000002',10000, date '2030-01-10', date '2030-01-01','open');

-- =====================================================================
-- Ator: ALUNO A1
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}';

-- T1 — aluno não faz chamada
do $$
begin
  begin
    perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU T1: aluno salvou a chamada';
  exception when insufficient_privilege then
    raise notice 'OK T1: aluno não faz chamada';
  end;
end $$;

-- T8 — aluno não manda mensalidade para análise sem anexo
do $$
begin
  begin
    update public.payments set status = 'pending_approval'
     where id = 'e0000000-0000-4000-8000-00000000d001';
    raise exception 'FALHOU T8: mensalidade foi para análise sem comprovante';
  exception when check_violation then
    raise notice 'OK T8: sem anexo, a mensalidade não vai para análise';
  end;
end $$;

-- T9 — com anexo, o envio do aluno continua funcionando (mesmo update do app)
do $$
declare n integer;
begin
  update public.payments
     set status = 'pending_approval',
         proof_provider = 'cloudinary',
         proof_public_id = 'comprovantes/e0000000-0000-4000-8000-000000000001/d002'
   where id = 'e0000000-0000-4000-8000-00000000d002';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FALHOU T9: envio com anexo atualizou % linha(s)', n;
  end if;
  raise notice 'OK T9: envio com anexo segue funcionando';
end $$;

-- =====================================================================
-- Ator: PROFESSOR P2 (não é desta aula)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated"}';

-- T2 — professor de outra aula não faz esta chamada
do $$
begin
  begin
    perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001', '{}'::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU T2: professor de outra aula salvou a chamada';
  exception when insufficient_privilege then
    raise notice 'OK T2: só o professor da aula faz a chamada';
  end;
end $$;

-- =====================================================================
-- Ator: PROFESSOR P (da aula)
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated"}';

-- T3 — aula que ainda não começou
do $$
begin
  begin
    perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b002',
      array['e0000000-0000-4000-8000-000000000001']::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU T3: chamada salva em aula futura';
  exception when check_violation then
    raise notice 'OK T3: aula futura recusa a chamada';
  end;
end $$;

-- T4 — grava tudo de uma vez, zera quem saiu das listas e conclui
do $$
declare
  v_concluida timestamptz;
  v_a1 record;
  v_a2 public.attendance_status;
  v_a3 public.attendance_status;
  v_aula timestamptz;
begin
  v_concluida := public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
    array['e0000000-0000-4000-8000-000000000001']::uuid[],
    array['e0000000-0000-4000-8000-000000000002']::uuid[]);

  select status, declared_status into v_a1 from public.attendance
   where class_id = 'e0000000-0000-4000-8000-00000000b001' and user_id = 'e0000000-0000-4000-8000-000000000001';
  select status into v_a2 from public.attendance
   where class_id = 'e0000000-0000-4000-8000-00000000b001' and user_id = 'e0000000-0000-4000-8000-000000000002';
  select status into v_a3 from public.attendance
   where class_id = 'e0000000-0000-4000-8000-00000000b001' and user_id = 'e0000000-0000-4000-8000-000000000003';
  select attendance_taken_at into v_aula from public.classes where id = 'e0000000-0000-4000-8000-00000000b001';

  if v_a1.status is distinct from 'present' or v_a1.declared_status is distinct from 'present' then
    raise exception 'FALHOU T4: A1 chamada % / declaração % (esperado present/present)', v_a1.status, v_a1.declared_status;
  end if;
  if v_a2 is distinct from 'absent' then
    raise exception 'FALHOU T4: A2 chamada % (esperado absent)', v_a2;
  end if;
  if v_a3 is not null then
    raise exception 'FALHOU T4: A3 continuou com chamada % (esperado sem chamada)', v_a3;
  end if;
  if v_concluida is null or v_aula is distinct from v_concluida then
    raise exception 'FALHOU T4: conclusão % na aula, % devolvida', v_aula, v_concluida;
  end if;
  raise notice 'OK T4: presença, falta, remoção e conclusão numa chamada só; declaração preservada';
end $$;

-- T6 — mesmo aluno presente e ausente
do $$
begin
  begin
    perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
      array['e0000000-0000-4000-8000-000000000001']::uuid[],
      array['e0000000-0000-4000-8000-000000000001']::uuid[]);
    raise exception 'FALHOU T6: aluno aceito como presente e ausente';
  exception when invalid_parameter_value then
    raise notice 'OK T6: presente e ausente ao mesmo tempo é recusado';
  end;
end $$;

-- T7 — só alunos entram na chamada
do $$
begin
  begin
    perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
      array['e0000000-0000-4000-8000-000000000004']::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU T7: professor entrou na chamada como aluno';
  exception when invalid_parameter_value then
    raise notice 'OK T7: a chamada só aceita alunos';
  end;
end $$;

-- T10 — aluno repetido no array não derruba o comando
do $$
declare v_a2 public.attendance_status;
begin
  perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
    array['e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001']::uuid[],
    '{}'::uuid[]);
  select status into v_a2 from public.attendance
   where class_id = 'e0000000-0000-4000-8000-00000000b001' and user_id = 'e0000000-0000-4000-8000-000000000002';
  if v_a2 is not null then
    raise exception 'FALHOU T10: A2 ficou com chamada % depois de sair das listas', v_a2;
  end if;
  raise notice 'OK T10: repetição no array é tolerada';
end $$;

-- =====================================================================
-- Sistema: força um momento de conclusão conhecido
-- =====================================================================
reset role;
update public.classes set attendance_taken_at = timestamptz '2026-01-01 10:00-03'
 where id = 'e0000000-0000-4000-8000-00000000b001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated"}';

-- T5 — salvar de novo corrige, mas não reescreve a conclusão
do $$
declare v_concluida timestamptz;
begin
  v_concluida := public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
    '{}'::uuid[], array['e0000000-0000-4000-8000-000000000001']::uuid[]);
  if v_concluida <> timestamptz '2026-01-01 10:00-03' then
    raise exception 'FALHOU T5: conclusão reescrita para %', v_concluida;
  end if;
  raise notice 'OK T5: correção preserva o momento da conclusão';
end $$;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000006","role":"authenticated"}';

-- T11 — admin marca como paga sem anexo
do $$
declare n integer;
begin
  update public.payments set status = 'paid', paid_at = now()
   where id = 'e0000000-0000-4000-8000-00000000d003';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FALHOU T11: admin não marcou como paga (% linha)', n;
  end if;
  raise notice 'OK T11: admin marca como paga sem exigir anexo';
end $$;

-- T12 — admin faz a chamada de qualquer aula
do $$
begin
  perform public.salvar_chamada('e0000000-0000-4000-8000-00000000b001',
    array['e0000000-0000-4000-8000-000000000003']::uuid[], '{}'::uuid[]);
  raise notice 'OK T12: admin faz a chamada';
end $$;

rollback;
