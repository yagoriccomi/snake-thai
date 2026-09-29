-- Regressão da LGPD v4 (bloco 4.11, migration 20260929210000_lgpd_v4;
-- contrato § 12.1, § 0.1). Roda numa transação e termina em ROLLBACK; mesmo
-- assim, rode SÓ no banco local.
--
-- F fixo com troca permanente, pedido de troca, solicitação e justificativa
-- negada (com nota) · L aluno sem troca · P professor · A admin.
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('l4-g', 'L4 Turma G'), ('l4-g2', 'L4 Turma G2');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('dc000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'l4-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 4) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('dc000000-0000-4000-8000-000000000001', 'admin', 'L4 Admin', '63000000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('dc000000-0000-4000-8000-000000000002', 'professor', 'L4 Prof', '63000000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('dc000000-0000-4000-8000-000000000003', 'user', 'L4 Aluno F', '63000000003', false, 'active', 'l4-g', null, now() - interval '60 days'),
  ('dc000000-0000-4000-8000-000000000004', 'user', 'L4 Aluno L', '63000000004', false, 'active', 'l4-g', null, now() - interval '60 days');

insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from, audience) values
  ('dcd00000-0000-4000-8000-000000000001', 'l4-g', 'L4 HA', 1, '10:00', '2026-01-01', 'both'),
  ('dcd00000-0000-4000-8000-000000000002', 'l4-g2', 'L4 HB', 3, '10:00', '2026-01-01', 'both');

insert into public.classes (id, title, type, group_id, date_time, audience, attendance_taken_at) values
  ('dcc00000-0000-4000-8000-000000000001', 'L4 Aula C', 'routine', 'l4-g', now() - interval '2 days', 'both', now() - interval '2 days'),
  ('dcc00000-0000-4000-8000-000000000002', 'L4 Aula X', 'routine', 'l4-g2', now() + interval '3 days', 'both', null);
insert into public.class_teachers (class_id, teacher_id) values
  ('dcc00000-0000-4000-8000-000000000001', 'dc000000-0000-4000-8000-000000000002');

-- Os dados de F, gravados como o sistema.
insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
values ('dc000000-0000-4000-8000-000000000003', 'dcd00000-0000-4000-8000-000000000001',
        'dcd00000-0000-4000-8000-000000000002', now() - interval '10 days');

insert into public.action_reasons (id, kind, class_id, author_id, body, used_at) values
  ('dce00000-0000-4000-8000-000000000001', 'class_swap_evidence', null, 'dc000000-0000-4000-8000-000000000003', 'Mudei de emprego', now()),
  ('dce00000-0000-4000-8000-000000000002', 'request_evidence', 'dcc00000-0000-4000-8000-000000000001',
   'dc000000-0000-4000-8000-000000000003', 'Eu estava', now());
insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id) values
  ('dcf00000-0000-4000-8000-000000000001', 'dce00000-0000-4000-8000-000000000001', 'dc000000-0000-4000-8000-000000000003',
   'cloudinary', 'motivos/dc000000-0000-4000-8000-000000000003/dcf00000-0000-4000-8000-000000000001');

insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, from_schedule_id, to_schedule_id, motivo_id, status, decided_via, decided_by, decided_at)
values ('dc000000-0000-4000-8000-000000000003', 'permanent', null, 'dcc00000-0000-4000-8000-000000000002',
        'dcd00000-0000-4000-8000-000000000001', 'dcd00000-0000-4000-8000-000000000002',
        'dce00000-0000-4000-8000-000000000001', 'approved', 'review', 'dc000000-0000-4000-8000-000000000001', now() - interval '10 days');

insert into public.roll_call_requests (kind, class_id, requester_id, subject_id, motivo_id, status, reviewed_by, reviewed_at, review_note)
values ('student_was_present', 'dcc00000-0000-4000-8000-000000000001', 'dc000000-0000-4000-8000-000000000003',
        'dc000000-0000-4000-8000-000000000003', 'dce00000-0000-4000-8000-000000000002', 'rejected',
        'dc000000-0000-4000-8000-000000000002', now(), 'NOTA-SECRETA-DA-SOLICITACAO');

insert into public.absence_justifications (id, class_id, user_id, message, status, reviewed_by, reviewed_at)
values ('dca00000-0000-4000-8000-000000000001', 'dcc00000-0000-4000-8000-000000000001',
        'dc000000-0000-4000-8000-000000000003', 'Gripe', 'pending', null, null);
insert into public.absence_justification_reviews (justification_id, reviewer_id, review_note, decided_at)
values ('dca00000-0000-4000-8000-000000000001', 'dc000000-0000-4000-8000-000000000002', 'NOTA-SECRETA-DA-JUSTIFICATIVA', now());

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

do $$
declare
  v jsonb;
begin
  perform pg_temp.como('dc000000-0000-4000-8000-000000000003');
  v := public.export_my_data();
  if jsonb_array_length(v -> 'trocas') <> 1 or jsonb_array_length(v -> 'trocas_permanentes') <> 1
     or jsonb_array_length(v -> 'periodos_de_turma') < 1 or jsonb_array_length(v -> 'solicitacoes') <> 1
     or jsonb_array_length(v -> 'justificativas') <> 1 then
    raise exception 'FALHOU L1: chaves novas do export: %', v;
  end if;
  if v::text like '%NOTA-SECRETA%' or v::text like '%review_note%' or v::text like '%edited_by%'
     or v::text like '%previous_status%' then
    raise exception 'FALHOU L2: o export vazou nota, revisor ou auditoria';
  end if;
  if (v -> 'perfil' ->> 'nome') <> 'L4 Aluno F' then
    raise exception 'FALHOU L1: perfil';
  end if;

  perform pg_temp.como('dc000000-0000-4000-8000-000000000004');
  v := public.export_my_data();
  if jsonb_array_length(v -> 'trocas') <> 0 or jsonb_array_length(v -> 'trocas_permanentes') <> 0 then
    raise exception 'FALHOU L3: aluno sem troca exporta trocas de outro';
  end if;
  raise notice 'OK L1–L3: export com as chaves novas, para quem tem troca e para quem não tem, sem nota nem revisor';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  F constant uuid := 'dc000000-0000-4000-8000-000000000003';
begin
  perform public.anonimizar_titular(F, F);
  if exists (select 1 from public.class_swaps where user_id = F)
     or exists (select 1 from public.class_swap_periods where user_id = F)
     or exists (select 1 from public.roll_call_requests where subject_id = F)
     or exists (select 1 from public.action_reasons where author_id = F and kind in ('request_evidence', 'class_swap_evidence'))
     or exists (select 1 from public.student_group_periods where user_id = F)
     or exists (select 1 from public.absence_justifications where user_id = F) then
    raise exception 'FALHOU L4: a anonimização deixou dados do titular';
  end if;
  if not exists (
    select 1 from public.media_deletion_queue
     where asset_ref = 'motivos/dc000000-0000-4000-8000-000000000003/dcf00000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FALHOU L5: o anexo do motivo não foi para a fila';
  end if;
  if (select name from public.profiles where id = F) <> 'Usuário removido' then
    raise exception 'FALHOU L4: perfil não anonimizado';
  end if;
  raise notice 'OK L4–L5: a exclusão apaga trocas, períodos, solicitações, motivos e histórico de turma; os anexos vão para a fila';
end $$;

rollback;
