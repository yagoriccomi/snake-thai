-- Regressão da chamada nova (bloco 4.6b, migration 20260929150000_chamada_nova;
-- contrato § 7.2, § 10 e § 15). Roda numa transação e termina em ROLLBACK;
-- mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Aula C (turma G, começou há 2 h, horário H) e quem está nela:
--   F1 fixo da turma · F2 troca pendente para C · F3 trocou C por outra ·
--   F4 extra (de outra turma, marcou "Vou") · L1 livre que marcou ·
--   F5 fixo que mudou de turma DEPOIS da aula · F6 permanente para o horário H ·
--   F7 troca pendente para C (vai expirar) · I aluno sem turma (vai ser incluído)
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values
  ('b6-g', 'Turma G'), ('b6-o', 'Turma O'), ('b6-g2', 'Turma G2');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('b6000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'b6-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 16) as n;

-- 01 admin · 02 prof P (da aula) · 03 prof P2 (de fora) · 04 prof sem vínculo
insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('b6000000-0000-4000-8000-000000000001', 'admin', 'B6 Admin', '67600000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000002', 'professor', 'B6 Prof P', '67600000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000003', 'professor', 'B6 Prof P2', '67600000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000004', 'professor', 'B6 Prof Sem', '67600000004', false, 'active', null, '#404040', now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000011', 'user', 'B6 Aluno F1', '67600000011', false, 'active', 'b6-g', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000012', 'user', 'B6 Aluno F2', '67600000012', false, 'active', 'b6-o', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000013', 'user', 'B6 Aluno F3', '67600000013', false, 'active', 'b6-g', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000014', 'user', 'B6 Aluno F4', '67600000014', false, 'active', 'b6-o', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000015', 'user', 'B6 Aluno L1', '67600000015', false, 'active', null, null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000016', 'user', 'B6 Aluno F5', '67600000016', false, 'active', 'b6-g', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000005', 'user', 'B6 Aluno F6', '67600000005', false, 'active', 'b6-o', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000006', 'user', 'B6 Aluno F7', '67600000006', false, 'active', 'b6-o', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000007', 'user', 'B6 Aluno Incluido', '67600000007', false, 'active', null, null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000008', 'user', 'B6 Aluno F8', '67600000008', false, 'active', 'b6-g2', null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000009', 'user', 'B6 Percentual 100%', '67600000009', false, 'active', null, null, now() - interval '60 days'),
  ('b6000000-0000-4000-8000-000000000010', 'user', 'B6 Trancado', '67600000010', false, 'active', null, null, now() - interval '60 days');
update public.profiles set status = 'inactive', deactivated_at = now() where id = 'b6000000-0000-4000-8000-000000000010';

-- L1 é livre.
insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota)
values ('b6b00000-0000-4000-8000-000000000001', 'B6 Livre 2x', 10000, 'free', 2);
insert into public.plan_periods (user_id, plan_id, started_at)
values ('b6000000-0000-4000-8000-000000000015', 'b6b00000-0000-4000-8000-000000000001', now() - interval '60 days');

insert into public.class_schedules (id, group_id, title, weekday, start_time, valid_from, audience)
values ('b6d00000-0000-4000-8000-000000000001', 'b6-g', 'B6 Horário H', 1, '19:00', '2026-01-01', 'both');

insert into public.classes (id, title, type, group_id, date_time, audience, schedule_id, occurrence_date) values
  ('b6c00000-0000-4000-8000-000000000001', 'B6 Aula C', 'routine', 'b6-g', now() - interval '2 hours', 'both',
   'b6d00000-0000-4000-8000-000000000001', (now() at time zone 'America/Sao_Paulo')::date),
  -- originais das trocas de F2 e F7 (turma O, amanhã) e o destino de F3 (turma O, depois de amanhã)
  ('b6c00000-0000-4000-8000-000000000002', 'B6 Original F2', 'routine', 'b6-o', now() + interval '1 day', 'both', null, null),
  ('b6c00000-0000-4000-8000-000000000003', 'B6 Destino F3', 'routine', 'b6-o', now() + interval '2 days', 'both', null, null),
  ('b6c00000-0000-4000-8000-000000000004', 'B6 Original F7', 'routine', 'b6-o', now() + interval '1 day 1 hour', 'both', null, null),
  -- C12: a original (passada) e o destino (futuro) da troca pendente de F8
  ('b6c00000-0000-4000-8000-000000000005', 'B6 Original F8', 'routine', 'b6-g2', now() - interval '3 hours', 'both', null, null),
  ('b6c00000-0000-4000-8000-000000000006', 'B6 Destino F8', 'routine', 'b6-o', now() + interval '3 days', 'both', null, null),
  -- C13: pendente sem chamada, de ontem, e uma cancelada
  ('b6c00000-0000-4000-8000-000000000007', 'B6 Pendente', 'routine', 'b6-g', now() - interval '1 day', 'both', null, null),
  ('b6c00000-0000-4000-8000-000000000008', 'B6 Cancelada', 'routine', 'b6-g', now() - interval '1 day', 'both', null, null),
  -- C3: aula "só livres"
  ('b6c00000-0000-4000-8000-000000000009', 'B6 Só livres', 'routine', null, now() - interval '2 hours', 'free', null, null),
  -- C18: evento
  ('b6c00000-0000-4000-8000-000000000010', 'B6 Evento', 'event', null, now() - interval '2 hours', 'both', null, null);
update public.classes set cancelled_at = now() where id = 'b6c00000-0000-4000-8000-000000000008';

insert into public.class_teachers (class_id, teacher_id) values
  ('b6c00000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000002'),
  ('b6c00000-0000-4000-8000-000000000005', 'b6000000-0000-4000-8000-000000000002'),
  ('b6c00000-0000-4000-8000-000000000007', 'b6000000-0000-4000-8000-000000000002'),
  ('b6c00000-0000-4000-8000-000000000008', 'b6000000-0000-4000-8000-000000000002'),
  ('b6c00000-0000-4000-8000-000000000009', 'b6000000-0000-4000-8000-000000000002'),
  ('b6c00000-0000-4000-8000-000000000010', 'b6000000-0000-4000-8000-000000000002');

-- Trocas.
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at) values
  ('b6e00000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000012', 'once',
   'b6c00000-0000-4000-8000-000000000002', 'b6c00000-0000-4000-8000-000000000001', 'pending', null, null),
  ('b6e00000-0000-4000-8000-000000000003', 'b6000000-0000-4000-8000-000000000013', 'once',
   'b6c00000-0000-4000-8000-000000000001', 'b6c00000-0000-4000-8000-000000000003', 'approved', 'review', now()),
  ('b6e00000-0000-4000-8000-000000000007', 'b6000000-0000-4000-8000-000000000006', 'once',
   'b6c00000-0000-4000-8000-000000000004', 'b6c00000-0000-4000-8000-000000000001', 'pending', null, null),
  ('b6e00000-0000-4000-8000-000000000008', 'b6000000-0000-4000-8000-000000000008', 'once',
   'b6c00000-0000-4000-8000-000000000005', 'b6c00000-0000-4000-8000-000000000006', 'pending', null, null);
with h as (
  insert into public.class_schedules (group_id, title, weekday, start_time, valid_from, audience)
  values ('b6-o', 'B6 Horário de F6', 2, '19:00', '2026-01-01', 'both') returning id
)
insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
select 'b6000000-0000-4000-8000-000000000005', h.id, 'b6d00000-0000-4000-8000-000000000001', now() - interval '10 days'
  from h;

-- Marcações: F4 (extra) e L1 (livre) marcaram "Vou" em C; F4 também no evento.
insert into public.attendance (class_id, user_id, declared_status) values
  ('b6c00000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000014', 'present'),
  ('b6c00000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000015', 'present'),
  ('b6c00000-0000-4000-8000-000000000010', 'b6000000-0000-4000-8000-000000000014', 'present');

-- F5 muda de turma DEPOIS da aula (D58).
update public.profiles set group_id = 'b6-o' where id = 'b6000000-0000-4000-8000-000000000016';

-- Aparelhos, para os avisos entrarem na fila.
insert into public.push_devices (user_id, expo_token, platform, app_variant)
select p.id, 'ExponentPushToken[b6-' || p.id::text || ']', 'android', 'production'
  from public.profiles p where p.id::text like 'b6000000%';

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.origem(p_user text) returns text language sql as $$
  select l.origem from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001') l where l.user_id = p_user::uuid;
$$;

-- =====================================================================
-- C1 — quem está na chamada (§ 7.2)
-- =====================================================================
set local role authenticated;

do $$
declare v record;
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000003');  -- qualquer da equipe lê a lista
  if pg_temp.origem('b6000000-0000-4000-8000-000000000011') is distinct from 'turma'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000012') is distinct from 'troca_pendente'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000013') is distinct from 'trocou'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000014') is distinct from 'extra'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000015') is distinct from 'marcou'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000016') is distinct from 'turma'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000005') is distinct from 'permanente'
     or pg_temp.origem('b6000000-0000-4000-8000-000000000006') is distinct from 'troca_pendente' then
    raise exception 'FALHOU C1: origens erradas: %', (
      select string_agg(l.name || '=' || l.origem, ', ' order by l.name)
        from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001') l);
  end if;
  select * into v from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001') l
   where l.user_id = 'b6000000-0000-4000-8000-000000000012';
  if v.swap_role is distinct from 'destino' or v.swap_status is distinct from 'pending' or v.swap_other_date_time is null then
    raise exception 'FALHOU C1: troca pendente sem os swap_*';
  end if;
  select * into v from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001') l
   where l.user_id = 'b6000000-0000-4000-8000-000000000015';
  if v.schedule_mode <> 'free' or v.weekly_target <> 2 or v.week_expected is null then
    raise exception 'FALHOU C1: o livre veio sem a semana dele';
  end if;
  if (select count(*) from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001') l where l.taken_by_name is not null) > 0 then
    raise exception 'FALHOU C1: detalhe de auditoria para não admin';
  end if;
  -- Evento: quem marcou, de qualquer modalidade, e nunca 'extra' (T40).
  if (select l.origem from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000010') l
       where l.user_id = 'b6000000-0000-4000-8000-000000000014') is distinct from 'marcou' then
    raise exception 'FALHOU C1: no evento o fixo não é extra';
  end if;
  raise notice 'OK C1: turma, troca pendente, trocou, extra, marcou, permanente e a turma da data da aula';
end $$;

-- =====================================================================
-- C2 — quem lê o quê
-- =====================================================================
do $$
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000011');
  begin
    perform * from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001');
    raise exception 'FALHOU C2: aluno leu a chamada';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como('b6000000-0000-4000-8000-000000000003');
  begin
    perform * from public.professores_da_chamada('b6c00000-0000-4000-8000-000000000001');
    raise exception 'FALHOU C2: professor de fora leu os professores da chamada';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', 'B6');
    raise exception 'FALHOU C2: professor de fora buscou alunos';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK C2: lista para a equipe; professores e buscas só para a equipe da aula e o admin';
end $$;

-- =====================================================================
-- C3 — APK 1.8 (§ 15, T47)
-- =====================================================================
do $$
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000002');
  begin
    perform public.salvar_chamada('b6c00000-0000-4000-8000-000000000001',
      array['b6000000-0000-4000-8000-000000000011']::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU C3: APK antigo fez chamada com troca e extra';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.concluir_chamada('b6c00000-0000-4000-8000-000000000001');
    raise exception 'FALHOU C3: APK antigo concluiu chamada com troca e extra';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.salvar_chamada('b6c00000-0000-4000-8000-000000000009', '{}'::uuid[], '{}'::uuid[]);
    raise exception 'FALHOU C3: APK antigo fez chamada de aula só para livres';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK C3: o APK antigo recebe "Atualize o aplicativo" nas aulas com troca, extra, mudança de turma ou só livres';
end $$;

-- =====================================================================
-- C4 — primeira conclusão (regras 3, 4, 7 e 8)
-- =====================================================================
do $$
declare r jsonb;
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000002');
  r := public.salvar_chamada_v2(
    'b6c00000-0000-4000-8000-000000000001',
    array['b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000012',
          'b6000000-0000-4000-8000-000000000014', 'b6000000-0000-4000-8000-000000000007']::uuid[],
    array['b6000000-0000-4000-8000-000000000016', 'b6000000-0000-4000-8000-000000000013',
          'b6000000-0000-4000-8000-000000000005']::uuid[],
    array['b6000000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000003']::uuid[],
    '{}'::uuid[]
  );
  if (r ->> 'retificada')::boolean or r ->> 'concluida_em' is null then
    raise exception 'FALHOU C4: resposta %', r;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  c constant uuid := 'b6c00000-0000-4000-8000-000000000001';
begin
  if (select status from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000011') <> 'present'
     or (select status from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000016') <> 'absent'
     or (select status from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000005') <> 'absent' then
    raise exception 'FALHOU C4: turma, mudou de turma e permanente';
  end if;
  -- Troca pendente com presença: aprovada pela chamada, com revisão sem nota e aviso.
  if (select status || '/' || decided_via || '/' || decided_by::text from public.class_swaps where id = 'b6e00000-0000-4000-8000-000000000002')
     <> 'approved/roll_call/b6000000-0000-4000-8000-000000000002'
     or not exists (select 1 from public.class_swap_reviews where swap_id = 'b6e00000-0000-4000-8000-000000000002' and review_note is null)
     or not exists (select 1 from public.notification_outbox where recipient_id = 'b6000000-0000-4000-8000-000000000012'
                     and dedupe_key = 'troca_aprovada:b6e00000-0000-4000-8000-000000000002'
                     and data ->> 'pela_chamada' = '1') then
    raise exception 'FALHOU C4: a chamada não aprovou a troca pendente com presença';
  end if;
  -- Quem fez a chamada não recebe o aviso da equipe.
  if exists (select 1 from public.notification_outbox where recipient_id = 'b6000000-0000-4000-8000-000000000002'
              and kind = 'troca_aprovada_equipe') then
    raise exception 'FALHOU C4: quem aprovou recebeu o aviso da equipe';
  end if;
  -- Troca pendente sem marcação: expira e nada é gravado.
  if (select status from public.class_swaps where id = 'b6e00000-0000-4000-8000-000000000007') <> 'expired'
     or exists (select 1 from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000006') then
    raise exception 'FALHOU C4: a troca pendente sem marcação não expirou limpa';
  end if;
  -- 'trocou' ausente não grava nada; 'marcou' sem marcação fica sem registro (T11).
  if exists (select 1 from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000013')
     or (select status from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000015') is not null then
    raise exception 'FALHOU C4: trocou ou marcou ganharam registro';
  end if;
  -- Extra conta; o de fora da lista vira incluído.
  if (select status from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000014') <> 'present'
     or not (select included from public.attendance where class_id = c and user_id = 'b6000000-0000-4000-8000-000000000007')
     or (select added_by from public.attendance_audit au join public.attendance a on a.id = au.attendance_id
          where a.class_id = c and a.user_id = 'b6000000-0000-4000-8000-000000000007') <> 'b6000000-0000-4000-8000-000000000002' then
    raise exception 'FALHOU C4: extra ou incluído';
  end if;
  -- Auditoria da primeira conclusão e os professores (D27).
  if (select attendance_taken_by from public.class_audit where class_id = c) <> 'b6000000-0000-4000-8000-000000000002'
     or exists (select 1 from public.attendance_audit au join public.attendance a on a.id = au.attendance_id
                 where a.class_id = c and au.taken_by is distinct from 'b6000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU C4: auditoria da conclusão';
  end if;
  if not exists (select 1 from public.class_teachers where class_id = c and teacher_id = 'b6000000-0000-4000-8000-000000000003')
     or not (select added_in_roll_call and present from public.class_teacher_presence where class_id = c and teacher_id = 'b6000000-0000-4000-8000-000000000003')
     or (select added_in_roll_call from public.class_teacher_presence where class_id = c and teacher_id = 'b6000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU C4: professor acrescentado';
  end if;
  raise notice 'OK C4: primeira conclusão com trocas, extra, incluído, auditoria e professor acrescentado';
end $$;

-- =====================================================================
-- C5–C10 — retificação (regras 2, 5, 6; D17, D21, D28)
-- =====================================================================
set local role authenticated;

do $$
declare
  r jsonb;
  v_motivo uuid;
  presentes uuid[] := array['b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000012',
                            'b6000000-0000-4000-8000-000000000014', 'b6000000-0000-4000-8000-000000000007']::uuid[];
  ausentes uuid[] := array['b6000000-0000-4000-8000-000000000016', 'b6000000-0000-4000-8000-000000000005']::uuid[];
  profs uuid[] := array['b6000000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000003']::uuid[];
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000002');

  -- C16: reenvio igual não é retificação.
  r := public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001', presentes, ausentes, profs, '{}');
  if (r ->> 'retificada')::boolean or (r ->> 'alteracoes')::int <> 0 then
    raise exception 'FALHOU C16: reenvio igual virou retificação: %', r;
  end if;

  -- C5: lista incompleta.
  begin
    perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001', presentes[2:4], ausentes, profs, '{}');
    raise exception 'FALHOU C5: aceitou lista incompleta';
  exception when invalid_parameter_value then null;
  end;

  -- C6: diferença sem motivo.
  begin
    perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001',
      presentes || 'b6000000-0000-4000-8000-000000000016'::uuid, ausentes[2:2], profs, '{}');
    raise exception 'FALHOU C6: retificou sem motivo';
  exception when invalid_parameter_value then null;
  end;

  -- C8: professor muda presença de professor.
  v_motivo := public.criar_motivo('roll_call_edit', 'b6c00000-0000-4000-8000-000000000001', 'P2 não veio');
  begin
    perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001', presentes, ausentes,
      profs[1:1], profs[2:2], '{}', v_motivo);
    raise exception 'FALHOU C8: professor retificou presença de professor';
  exception when insufficient_privilege then null;
  end;

  -- C7: retificação com motivo: F5 de falta para presença.
  r := public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001',
    presentes || 'b6000000-0000-4000-8000-000000000016'::uuid, ausentes[2:2], profs, '{}', '{}', v_motivo);
  if not (r ->> 'retificada')::boolean or (r ->> 'alteracoes')::int <> 1 then
    raise exception 'FALHOU C7: resposta %', r;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare c constant uuid := 'b6c00000-0000-4000-8000-000000000001';
begin
  if not exists (
    select 1 from public.attendance a join public.attendance_audit au on au.attendance_id = a.id
     where a.class_id = c and a.user_id = 'b6000000-0000-4000-8000-000000000016'
       and a.status = 'present' and a.edited and au.previous_status = 'absent'
       and au.edited_by = 'b6000000-0000-4000-8000-000000000002' and au.edit_reason_id is not null
  ) then
    raise exception 'FALHOU C7: a linha retificada não guardou o anterior';
  end if;
  if not (select attendance_edited from public.classes where id = c)
     or (select attendance_edited_by from public.class_audit where class_id = c) <> 'b6000000-0000-4000-8000-000000000002'
     or exists (select 1 from public.action_reasons where class_id = c and kind = 'roll_call_edit' and used_at is null) then
    raise exception 'FALHOU C7: aula, auditoria ou motivo';
  end if;
  if not exists (select 1 from public.notification_outbox where recipient_id = 'b6000000-0000-4000-8000-000000000016'
                  and kind = 'chamada_retificada') then
    raise exception 'FALHOU C7: o aluno não foi avisado (D21)';
  end if;
  raise notice 'OK C5–C8, C16: lista completa, motivo obrigatório, presença de professor só pelo admin, aviso ao aluno';
end $$;

set local role authenticated;

-- C9: o admin retifica a presença de P2; C10: P2 sem presença não faz a chamada (D28).
do $$
declare v_motivo uuid;
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000001');
  v_motivo := public.criar_motivo('roll_call_edit', 'b6c00000-0000-4000-8000-000000000001', 'P2 faltou');
  perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001',
    array['b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000012', 'b6000000-0000-4000-8000-000000000014',
          'b6000000-0000-4000-8000-000000000007', 'b6000000-0000-4000-8000-000000000016']::uuid[],
    array['b6000000-0000-4000-8000-000000000005']::uuid[],
    array['b6000000-0000-4000-8000-000000000002']::uuid[], array['b6000000-0000-4000-8000-000000000003']::uuid[],
    '{}', v_motivo);
  if (select present from public.professores_da_chamada('b6c00000-0000-4000-8000-000000000001') p
       where p.teacher_id = 'b6000000-0000-4000-8000-000000000003')
     or not (select edited from public.professores_da_chamada('b6c00000-0000-4000-8000-000000000001') p
              where p.teacher_id = 'b6000000-0000-4000-8000-000000000003') then
    raise exception 'FALHOU C9: presença de professor retificada pelo admin';
  end if;

  perform pg_temp.como('b6000000-0000-4000-8000-000000000003');
  begin
    perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001', '{}', '{}', '{}', '{}');
    raise exception 'FALHOU C10: professor sem presença fez a chamada';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK C9–C10: o admin retifica o professor, e o professor sem presença pede ao admin';
end $$;

-- Daqui em diante, como sistema com o "sub" de quem age: as conferências leem
-- class_swaps, que não tem grant para authenticated.
reset role;

-- =====================================================================
-- C11 — T35: a expirada volta a aprovada com a presença, e volta a
-- expirada quando a presença sai
-- =====================================================================
do $$
declare
  v_motivo uuid;
  base uuid[] := array['b6000000-0000-4000-8000-000000000011', 'b6000000-0000-4000-8000-000000000012', 'b6000000-0000-4000-8000-000000000014',
                       'b6000000-0000-4000-8000-000000000007', 'b6000000-0000-4000-8000-000000000016']::uuid[];
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000001');
  v_motivo := public.criar_motivo('roll_call_edit', 'b6c00000-0000-4000-8000-000000000001', 'F7 estava');
  perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001',
    base || 'b6000000-0000-4000-8000-000000000006'::uuid, array['b6000000-0000-4000-8000-000000000005']::uuid[],
    array['b6000000-0000-4000-8000-000000000002']::uuid[], array['b6000000-0000-4000-8000-000000000003']::uuid[], '{}', v_motivo);
  if (select status || '/' || decided_via from public.class_swaps where id = 'b6e00000-0000-4000-8000-000000000007') <> 'approved/roll_call' then
    raise exception 'FALHOU C11: a expirada não voltou a aprovada';
  end if;

  v_motivo := public.criar_motivo('roll_call_edit', 'b6c00000-0000-4000-8000-000000000001', 'F7 não estava');
  perform public.salvar_chamada_v2('b6c00000-0000-4000-8000-000000000001',
    base, array['b6000000-0000-4000-8000-000000000005', 'b6000000-0000-4000-8000-000000000006']::uuid[],
    array['b6000000-0000-4000-8000-000000000002']::uuid[], array['b6000000-0000-4000-8000-000000000003']::uuid[], '{}', v_motivo);
  if (select status from public.class_swaps where id = 'b6e00000-0000-4000-8000-000000000007') <> 'expired' then
    raise exception 'FALHOU C11: tirar a presença não devolveu a expirada';
  end if;
  raise notice 'OK C11: a chamada aprova e desfaz a troca expirada pela T35';
end $$;

-- =====================================================================
-- C12 — a presença na original cancela a troca pendente, pelo APK 1.8
-- =====================================================================
do $$
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000002');
  perform public.salvar_chamada('b6c00000-0000-4000-8000-000000000005',
    array['b6000000-0000-4000-8000-000000000008']::uuid[], '{}'::uuid[]);
  if (select status || '/' || decided_via from public.class_swaps where id = 'b6e00000-0000-4000-8000-000000000008') <> 'cancelled/system' then
    raise exception 'FALHOU C12: a presença na original não cancelou a troca pendente';
  end if;
  raise notice 'OK C12: presença na original cancela a troca pendente, venha da RPC que vier';
end $$;

-- =====================================================================
-- C13–C15 — pendentes e buscas
-- =====================================================================
do $$
declare v record;
begin
  perform pg_temp.como('b6000000-0000-4000-8000-000000000002');
  select * into v from public.chamadas_pendentes() p where p.class_id = 'b6c00000-0000-4000-8000-000000000007';
  if not found or v.dias_em_aberto < 1 then
    raise exception 'FALHOU C13: a aula de ontem sem chamada não está pendente';
  end if;
  if exists (select 1 from public.chamadas_pendentes() p
              where p.class_id in ('b6c00000-0000-4000-8000-000000000008', 'b6c00000-0000-4000-8000-000000000001')) then
    raise exception 'FALHOU C13: cancelada ou já feita apareceu como pendente';
  end if;
  if exists (select 1 from public.aulas_sem_chamada() a where a.class_id = 'b6c00000-0000-4000-8000-000000000008') then
    raise exception 'FALHOU C13: aulas_sem_chamada trouxe a cancelada';
  end if;

  -- C14: busca de alunos: ativos, fora da lista, % é texto.
  if not exists (select 1 from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', 'B6 Aluno F8'))
     or exists (select 1 from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', 'B6 Aluno F1'))
     or exists (select 1 from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', 'Trancado')) then
    raise exception 'FALHOU C14: busca de alunos';
  end if;
  if (select count(*) from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', '100%')) <> 1
     or exists (select 1 from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', '_6 Aluno')) then
    raise exception 'FALHOU C14: %% e _ não foram tratados como texto';
  end if;
  begin
    perform * from public.buscar_alunos_para_incluir('b6c00000-0000-4000-8000-000000000001', 'x');
    raise exception 'FALHOU C14: busca com 1 letra';
  exception when invalid_parameter_value then null;
  end;

  -- C15: equipe fora da aula, com cor.
  if not exists (select 1 from public.buscar_equipe_para_incluir('b6c00000-0000-4000-8000-000000000001', 'B6 Prof Sem'))
     or exists (select 1 from public.buscar_equipe_para_incluir('b6c00000-0000-4000-8000-000000000001', 'B6 Prof P2')) then
    raise exception 'FALHOU C15: busca de equipe';
  end if;

  -- O admin, com "todas", vê pendentes de aulas que não são dele.
  perform pg_temp.como('b6000000-0000-4000-8000-000000000001');
  if not exists (select 1 from public.chamadas_pendentes(false) p where p.class_id = 'b6c00000-0000-4000-8000-000000000007')
     or exists (select 1 from public.chamadas_pendentes(true) p where p.class_id = 'b6c00000-0000-4000-8000-000000000007') then
    raise exception 'FALHOU C13: minhas e todas do admin';
  end if;
  raise notice 'OK C13–C15: chamadas pendentes (T13) e as buscas';
end $$;

-- =====================================================================
-- C17 — anônimo (§ 0.1 regra 8)
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform * from public.lista_da_chamada('b6c00000-0000-4000-8000-000000000001');
    raise exception 'FALHOU C17: anônimo leu a chamada';
  exception when insufficient_privilege then
    raise notice 'OK C17: anônimo recebe 42501';
  end;
end $$;

reset role;
rollback;
