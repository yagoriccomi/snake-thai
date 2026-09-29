-- Regressão dos motivos e anexos (bloco 4.6a, migration 20260929140000_motivos;
-- contrato § 8). Roda numa transação e termina em ROLLBACK; mesmo assim, rode
-- SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values ('m6-turma', 'Turma Motivos');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('a6000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'm6-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 6) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, deactivated_at, color) values
  ('a6000000-0000-4000-8000-000000000001', 'admin', 'Admin M6', '66600000001', false, 'active', null, null),
  ('a6000000-0000-4000-8000-000000000002', 'professor', 'Prof da aula', '66600000002', false, 'active', null, '#0F0F0F'),
  ('a6000000-0000-4000-8000-000000000003', 'professor', 'Prof de fora', '66600000003', false, 'active', null, '#1F1F1F'),
  ('a6000000-0000-4000-8000-000000000004', 'user', 'Aluno ativo', '66600000004', false, 'active', null, null),
  ('a6000000-0000-4000-8000-000000000005', 'user', 'Aluno trancado', '66600000005', false, 'inactive', now(), null),
  ('a6000000-0000-4000-8000-000000000006', 'admin', 'Outro admin', '66600000006', false, 'active', null, null);

insert into public.classes (id, title, type, group_id, date_time, attendance_taken_at) values
  ('a6c00000-0000-4000-8000-000000000001', 'Aula M6', 'routine', 'm6-turma', now() - interval '2 days', now() - interval '2 days'),
  ('a6c00000-0000-4000-8000-000000000002', 'Aula antiga M6', 'routine', 'm6-turma', now() - interval '40 days', now() - interval '40 days');

insert into public.class_teachers (class_id, teacher_id) values
  ('a6c00000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002'),
  ('a6c00000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000002');

create temp table ctx (chave text primary key, id uuid) on commit drop;
grant select, insert, update on ctx to authenticated, anon;

create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- =====================================================================
-- M1–M4 — quem cria cada tipo e o texto
-- =====================================================================
set local role authenticated;

do $$
declare v uuid;
begin
  -- Aluno ativo: justificativa de troca, sem aula.
  perform pg_temp.como('a6000000-0000-4000-8000-000000000004');
  v := public.criar_motivo('class_swap_evidence', null, '  Mudei de emprego  ');
  insert into ctx values ('troca', v);
  if (select body from public.action_reasons where id = v) <> 'Mudei de emprego' then
    raise exception 'FALHOU M1: o texto não foi aparado';
  end if;
  begin
    perform public.criar_motivo('class_swap_evidence', 'a6c00000-0000-4000-8000-000000000001', 'x');
    raise exception 'FALHOU M1: motivo de troca aceitou aula';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.criar_motivo('roll_call_edit', 'a6c00000-0000-4000-8000-000000000001', 'x');
    raise exception 'FALHOU M2: aluno criou motivo de retificação';
  exception when insufficient_privilege then null;
  end;
  v := public.criar_motivo('request_evidence', 'a6c00000-0000-4000-8000-000000000001', 'Eu estava lá');
  insert into ctx values ('pedido', v);
  begin
    perform public.criar_motivo('request_evidence', gen_random_uuid(), 'x');
    raise exception 'FALHOU M4: motivo de aula inexistente';
  exception when no_data_found then null;
  end;
  begin
    perform public.criar_motivo('request_evidence', 'a6c00000-0000-4000-8000-000000000001', '   ');
    raise exception 'FALHOU M3: aceitou texto vazio';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.criar_motivo('request_evidence', 'a6c00000-0000-4000-8000-000000000001', repeat('a', 501));
    raise exception 'FALHOU M3: aceitou 501 caracteres';
  exception when invalid_parameter_value then null;
  end;

  -- Aluno trancado não pede troca.
  perform pg_temp.como('a6000000-0000-4000-8000-000000000005');
  begin
    perform public.criar_motivo('class_swap_evidence', null, 'x');
    raise exception 'FALHOU M1: aluno trancado criou motivo de troca';
  exception when insufficient_privilege then null;
  end;

  -- Professor da aula: retificação e cancelamento; professor de fora, não.
  perform pg_temp.como('a6000000-0000-4000-8000-000000000002');
  insert into ctx values ('retificacao', public.criar_motivo('roll_call_edit', 'a6c00000-0000-4000-8000-000000000001', 'Marquei errado'));
  insert into ctx values ('cancelamento', public.criar_motivo('class_cancel', 'a6c00000-0000-4000-8000-000000000001', 'Chuva forte'));
  perform pg_temp.como('a6000000-0000-4000-8000-000000000003');
  begin
    perform public.criar_motivo('class_cancel', 'a6c00000-0000-4000-8000-000000000001', 'x');
    raise exception 'FALHOU M2: professor de fora criou motivo da aula';
  exception when insufficient_privilege then null;
  end;

  -- Admin cria em qualquer aula.
  perform pg_temp.como('a6000000-0000-4000-8000-000000000001');
  insert into ctx values ('retificacao_admin', public.criar_motivo('roll_call_edit', 'a6c00000-0000-4000-8000-000000000001', 'Correção do admin'));
  raise notice 'OK M1–M4: cada tipo só por quem pode, texto de 1 a 500 e aula obrigatória fora da troca';
end $$;

-- =====================================================================
-- M5 — anexos
-- =====================================================================
do $$
declare
  v_motivo uuid := (select id from ctx where chave = 'troca');
  v_anexo  uuid;
  i int;
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000003');
  if public.pode_anexar_ao_motivo(v_motivo) then
    raise exception 'FALHOU M5: outra pessoa pode anexar';
  end if;
  begin
    perform public.anexar_ao_motivo(v_motivo, gen_random_uuid());
    raise exception 'FALHOU M5: outra pessoa anexou';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('a6000000-0000-4000-8000-000000000004');
  for i in 1 .. 5 loop
    v_anexo := gen_random_uuid();
    perform public.anexar_ao_motivo(v_motivo, v_anexo);
  end loop;
  if (select public_id from public.action_reason_attachments where id = v_anexo)
     <> 'motivos/a6000000-0000-4000-8000-000000000004/' || v_anexo::text then
    raise exception 'FALHOU M5: caminho do anexo não foi derivado';
  end if;
  if public.pode_anexar_ao_motivo(v_motivo) then
    raise exception 'FALHOU M5: aceita o sexto anexo';
  end if;
  begin
    perform public.anexar_ao_motivo(v_motivo, gen_random_uuid());
    raise exception 'FALHOU M5: sexto anexo gravado';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK M5: só o autor anexa, até 5, com o caminho derivado';
end $$;

-- Motivo já usado não aceita anexo.
reset role;
update public.action_reasons set used_at = now() where id = (select id from ctx where chave = 'retificacao');
set local role authenticated;

do $$
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000002');
  if public.pode_anexar_ao_motivo((select id from ctx where chave = 'retificacao')) then
    raise exception 'FALHOU M5: motivo usado aceita anexo';
  end if;
  perform public.anexar_ao_motivo((select id from ctx where chave = 'cancelamento'), gen_random_uuid());
  raise notice 'OK M5b: motivo usado não aceita anexo';
end $$;

-- =====================================================================
-- M6 — quem lê (RLS pela pode_ler_motivo; § 0.1 regra 8: nenhum 42501)
-- =====================================================================
do $$
declare n int;
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000002');
  select count(*) into n from public.action_reasons where class_id = 'a6c00000-0000-4000-8000-000000000001' or class_id is null;
  -- O professor da aula vê o cancelamento (T21), não as retificações (D20) nem os do aluno.
  if n <> 1 then
    raise exception 'FALHOU M6: professor da aula viu % motivos (esperado 1)', n;
  end if;
  select count(*) into n from public.action_reason_attachments;
  if n <> 1 then
    raise exception 'FALHOU M6: professor da aula viu % anexos (esperado 1, o do cancelamento)', n;
  end if;
  select count(*) into n from public.motivos_da_aula('a6c00000-0000-4000-8000-000000000001');
  if n <> 1 then
    raise exception 'FALHOU M6: motivos_da_aula devolveu % ao professor', n;
  end if;

  perform pg_temp.como('a6000000-0000-4000-8000-000000000004');
  select count(*) into n from public.action_reasons;
  if n <> 2 then
    raise exception 'FALHOU M6: aluno viu % motivos (esperado os 2 dele)', n;
  end if;
  select count(*) into n from public.action_reason_attachments;
  if n <> 5 then
    raise exception 'FALHOU M6: aluno viu % anexos (esperado os 5 dele)', n;
  end if;

  perform pg_temp.como('a6000000-0000-4000-8000-000000000001');
  select count(*) into n from public.action_reasons where author_id::text like 'a6000000%';
  if n <> 5 then
    raise exception 'FALHOU M6: admin viu % motivos (esperado 5)', n;
  end if;
  select jsonb_array_length(m.anexos) into n
    from public.motivos_da_aula('a6c00000-0000-4000-8000-000000000001') m where m.kind = 'class_cancel';
  if n <> 1 then
    raise exception 'FALHOU M6: motivos_da_aula sem o anexo';
  end if;
  raise notice 'OK M6: cada papel lê o que pode, sem 42501';
end $$;

-- =====================================================================
-- M7 — conferir a retificação
-- =====================================================================
do $$
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000002');
  begin
    perform public.marcar_retificacao_conferida((select id from ctx where chave = 'retificacao'));
    raise exception 'FALHOU M7: professor conferiu';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('a6000000-0000-4000-8000-000000000001');
  begin
    perform public.marcar_retificacao_conferida((select id from ctx where chave = 'cancelamento'));
    raise exception 'FALHOU M7: conferiu um cancelamento';
  exception when invalid_parameter_value then null;
  end;
  perform public.marcar_retificacao_conferida((select id from ctx where chave = 'retificacao'));
  if (select audited_by from public.action_reasons where id = (select id from ctx where chave = 'retificacao'))
     <> 'a6000000-0000-4000-8000-000000000001' then
    raise exception 'FALHOU M7: conferência não gravada';
  end if;
end $$;

reset role;
update public.action_reasons set used_at = now() where id = (select id from ctx where chave = 'retificacao_admin');
set local role authenticated;

do $$
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000001');
  begin
    perform public.marcar_retificacao_conferida((select id from ctx where chave = 'retificacao_admin'));
    raise exception 'FALHOU M7: admin conferiu a própria retificação';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK M7: só outro admin confere uma retificação feita';
end $$;

-- =====================================================================
-- M8 — motivo não usado em 24 h sai, e o anexo vai para a fila
-- =====================================================================
reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  v_fila int := (select count(*) from public.media_deletion_queue);
  v_apagados int;
begin
  -- O cancelamento (com 1 anexo) nunca foi usado: envelhece 25 h.
  update public.action_reasons set created_at = now() - interval '25 hours'
   where id = (select id from ctx where chave = 'cancelamento');
  v_apagados := public.apagar_motivos_nao_usados();
  if exists (select 1 from public.action_reasons where id = (select id from ctx where chave = 'cancelamento')) then
    raise exception 'FALHOU M8: motivo velho sem uso ficou';
  end if;
  if not exists (select 1 from public.action_reasons where id = (select id from ctx where chave = 'pedido')) then
    raise exception 'FALHOU M8: motivo recente foi apagado';
  end if;
  if (select count(*) from public.media_deletion_queue where motivo = 'anexo_de_motivo_removido') < 1
     or (select count(*) from public.media_deletion_queue) <> v_fila + 1 then
    raise exception 'FALHOU M8: o anexo do motivo apagado não foi para a fila';
  end if;
  raise notice 'OK M8: motivo sem uso sai em 24 h e o anexo vai para a fila (% apagado)', v_apagados;
end $$;

-- =====================================================================
-- M9 — anexos vencidos (180 dias da decisão, T45) e a P21
-- =====================================================================
do $$
declare
  v_fila     int := (select count(*) from public.media_deletion_queue);
  v_retif    uuid := (select id from ctx where chave = 'retificacao');
  v_troca    uuid := (select id from ctx where chave = 'troca');
  v_just     uuid := gen_random_uuid();
  v_perm     uuid := gen_random_uuid();
  v_n        int;
begin
  -- Retificação usada há 181 dias, com um anexo.
  update public.action_reasons set used_at = now() - interval '181 days' where id = v_retif;
  insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id)
  values ('a6a00000-0000-4000-8000-000000000001', v_retif, 'a6000000-0000-4000-8000-000000000002', 'cloudinary',
          'motivos/a6000000-0000-4000-8000-000000000002/a6a00000-0000-4000-8000-000000000001');

  -- A troca do aluno (5 anexos) decidida há 200 dias.
  insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, motivo_id, status, decided_via, decided_at)
  values ('a6000000-0000-4000-8000-000000000004', 'permanent', null, 'a6c00000-0000-4000-8000-000000000001',
          v_troca, 'rejected', 'review', now() - interval '200 days');

  -- Justificativa aprovada há 200 dias, com anexo, e a 1ª tentativa negada.
  insert into public.absence_justifications (id, class_id, user_id, message, status, reviewed_at, proof_provider, proof_public_id, attempt)
  values (v_just, 'a6c00000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000004', 'Atestado',
          'approved', now() - interval '200 days', 'cloudinary',
          'justificativas/a6000000-0000-4000-8000-000000000004/' || v_just::text || '-2', 2);
  insert into public.absence_justification_attempts (justification_id, message, proof_provider, proof_public_id, reviewed_at)
  values (v_just, 'Primeira', 'cloudinary', 'justificativas/a6000000-0000-4000-8000-000000000004/' || v_just::text,
          now() - interval '210 days');

  -- P21: permanente pendente cuja aula nova começou há 40 dias.
  insert into public.class_swaps (id, user_id, kind, to_class_id, motivo_id, status)
  values (v_perm, 'a6000000-0000-4000-8000-000000000004', 'permanent', 'a6c00000-0000-4000-8000-000000000002',
          (select id from ctx where chave = 'pedido'), 'pending');

  v_n := public.enfileirar_anexos_expirados();

  if (select status from public.class_swaps where id = v_perm) <> 'cancelled'
     or (select decided_via from public.class_swaps where id = v_perm) <> 'system' then
    raise exception 'FALHOU M9: a permanente sem decisão não foi cancelada (P21)';
  end if;
  if exists (select 1 from public.action_reason_attachments where reason_id in (v_retif, v_troca)) then
    raise exception 'FALHOU M9: anexos vencidos ficaram';
  end if;
  if (select proof_public_id from public.absence_justifications where id = v_just) is not null
     or (select proof_public_id from public.absence_justification_attempts where justification_id = v_just) is not null then
    raise exception 'FALHOU M9: anexos da justificativa ficaram';
  end if;
  -- 1 da retificação + 5 da troca + 1 da justificativa + 1 da tentativa = 8, cada um uma vez.
  if v_n <> 8 or (select count(*) from public.media_deletion_queue) <> v_fila + 8
     or (select count(*) from public.media_deletion_queue where motivo = 'anexo_expirado') <> 8 then
    raise exception 'FALHOU M9: fila com % novos (devolveu %), esperado 8 com anexo_expirado',
      (select count(*) from public.media_deletion_queue) - v_fila, v_n;
  end if;
  if not exists (select 1 from public.action_reasons where id = v_retif) then
    raise exception 'FALHOU M9: o texto do motivo saiu junto';
  end if;
  if current_setting('snake.anexo_expirado', true) = 'on' then
    raise exception 'FALHOU M9: a variável ficou ligada';
  end if;
  -- De novo: nada a fazer.
  if public.enfileirar_anexos_expirados() <> 0 then
    raise exception 'FALHOU M9: segunda passada enfileirou de novo';
  end if;
  raise notice 'OK M9: arquivos vencidos vão para a fila uma vez, o texto fica, e a P21 cancela a permanente';
end $$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'delete-unused-reasons' and schedule = '15 * * * *')
     or not exists (select 1 from cron.job where jobname = 'expire-attachments' and schedule = '50 3 * * *') then
    raise exception 'FALHOU M10: crons ausentes';
  end if;
  raise notice 'OK M10: os dois crons agendados';
end $$;

-- =====================================================================
-- M11 — anônimo e aluno fora das funções internas (§ 0.1 regra 8)
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.criar_motivo('request_evidence', 'a6c00000-0000-4000-8000-000000000001', 'x');
    raise exception 'FALHOU M11: anônimo criou motivo';
  exception when insufficient_privilege then
    raise notice 'OK M11: anônimo recebe 42501';
  end;
end $$;

set local role authenticated;
do $$
begin
  perform pg_temp.como('a6000000-0000-4000-8000-000000000001');
  begin
    perform public.enfileirar_anexos_expirados();
    raise exception 'FALHOU M11: usuário rodou o cron';
  exception when insufficient_privilege then
    raise notice 'OK M11b: os crons são internos';
  end;
end $$;

reset role;
rollback;
