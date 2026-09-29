-- Regressão de cancelar e reativar aula (bloco 4.7a, migration
-- 20260929160000_cancelar_aula; contrato § 6.1 e § 10). Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
--
-- Aula C (turma G, amanhã, fixos e livres), professor P:
--   F1 fixo da turma · F2 troca pendente para C (original ainda por vir) ·
--   F5 troca pendente para C (original já passou) · F3 trocou C por outra ·
--   F4 extra marcada em C · F6 troca pendente SAINDO de C · L1 livre ·
--   T trancado (não é avisado)
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('k7-g', 'K7 Turma G'), ('k7-o', 'K7 Turma O');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('c7000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'k7-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 12) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('c7000000-0000-4000-8000-000000000001', 'admin', 'K7 Admin', '67700000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000002', 'professor', 'K7 Prof P', '67700000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000003', 'professor', 'K7 Prof P2', '67700000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000004', 'user', 'K7 F1', '67700000004', false, 'active', 'k7-g', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000005', 'user', 'K7 F2', '67700000005', false, 'active', 'k7-o', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000006', 'user', 'K7 F3', '67700000006', false, 'active', 'k7-g', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000007', 'user', 'K7 F4', '67700000007', false, 'active', 'k7-o', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000008', 'user', 'K7 F5', '67700000008', false, 'active', 'k7-o', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000009', 'user', 'K7 F6', '67700000009', false, 'active', 'k7-g', null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000010', 'user', 'K7 L1', '67700000010', false, 'active', null, null, now() - interval '60 days'),
  ('c7000000-0000-4000-8000-000000000011', 'user', 'K7 Trancado', '67700000011', false, 'active', 'k7-g', null, now() - interval '60 days');
update public.profiles set status = 'inactive', deactivated_at = now() where id = 'c7000000-0000-4000-8000-000000000011';

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota)
values ('c7b00000-0000-4000-8000-000000000001', 'K7 Livre 2x', 10000, 'free', 2);
insert into public.plan_periods (user_id, plan_id, started_at)
values ('c7000000-0000-4000-8000-000000000010', 'c7b00000-0000-4000-8000-000000000001', now() - interval '60 days');

insert into public.classes (id, title, type, group_id, date_time, audience) values
  ('c7c00000-0000-4000-8000-000000000001', 'K7 Aula C', 'routine', 'k7-g', now() + interval '1 day', 'both'),
  ('c7c00000-0000-4000-8000-000000000002', 'K7 Original futura F2', 'routine', 'k7-o', now() + interval '2 days', 'both'),
  ('c7c00000-0000-4000-8000-000000000003', 'K7 Destino F3', 'routine', 'k7-o', now() + interval '3 days', 'both'),
  ('c7c00000-0000-4000-8000-000000000004', 'K7 Original passada F5', 'routine', 'k7-o', now() - interval '1 day', 'both'),
  ('c7c00000-0000-4000-8000-000000000005', 'K7 Destino F6', 'routine', 'k7-o', now() + interval '4 days', 'both'),
  ('c7c00000-0000-4000-8000-000000000006', 'K7 Aula passada', 'routine', 'k7-g', now() - interval '2 hours', 'both');

insert into public.class_teachers (class_id, teacher_id) values
  ('c7c00000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000002'),
  ('c7c00000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000002');

insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at) values
  ('c7e00000-0000-4000-8000-000000000002', 'c7000000-0000-4000-8000-000000000005', 'once',
   'c7c00000-0000-4000-8000-000000000002', 'c7c00000-0000-4000-8000-000000000001', 'pending', null, null),
  ('c7e00000-0000-4000-8000-000000000003', 'c7000000-0000-4000-8000-000000000006', 'once',
   'c7c00000-0000-4000-8000-000000000001', 'c7c00000-0000-4000-8000-000000000003', 'approved', 'review', now()),
  ('c7e00000-0000-4000-8000-000000000005', 'c7000000-0000-4000-8000-000000000008', 'once',
   'c7c00000-0000-4000-8000-000000000004', 'c7c00000-0000-4000-8000-000000000001', 'pending', null, null),
  ('c7e00000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000009', 'once',
   'c7c00000-0000-4000-8000-000000000001', 'c7c00000-0000-4000-8000-000000000005', 'pending', null, null);

insert into public.attendance (class_id, user_id, declared_status) values
  ('c7c00000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000007', 'present');

insert into public.push_devices (user_id, expo_token, platform, app_variant)
select p.id, 'ExponentPushToken[k7-' || p.id::text || ']', 'android', 'production'
  from public.profiles p where p.id::text like 'c7000000%';

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.avisado(p_uid text, p_prefixo text) returns boolean language sql as $$
  select exists (select 1 from public.notification_outbox o
                  where o.recipient_id = p_uid::uuid and o.dedupe_key like p_prefixo || '%');
$$;

-- =====================================================================
-- K1 — quem pode e o motivo
-- =====================================================================
set local role authenticated;
do $$
declare v_motivo uuid;
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000003');
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', gen_random_uuid());
    raise exception 'FALHOU K1: professor de fora cancelou';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como('c7000000-0000-4000-8000-000000000004');
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', gen_random_uuid());
    raise exception 'FALHOU K1: aluno cancelou';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.como('c7000000-0000-4000-8000-000000000002');
  v_motivo := public.criar_motivo('class_reactivate', 'c7c00000-0000-4000-8000-000000000001', 'Tipo errado');
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', v_motivo);
    raise exception 'FALHOU K1: cancelou com motivo de outro tipo';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK K1: só a equipe da aula ou o admin cancela, com motivo do tipo certo';
end $$;

-- =====================================================================
-- K2 — a prévia da folha "Cancelar aula"
-- =====================================================================
do $$
declare v record;
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000002');
  select * into v from public.quem_sera_avisado('c7c00000-0000-4000-8000-000000000001');
  -- F1 (turma), F2 e F5 (troca pendente), F4 (extra); F3 trocou e F6 é da
  -- turma mas tem a pendente SAINDO (continua na grade, entra); o trancado não.
  if not v.antes_da_aula or v.fixos <> 5 or v.livres < 1 or v.professores <> '{}'::text[] or v.admins < 1 then
    raise exception 'FALHOU K2: prévia %', row_to_json(v);
  end if;
  raise notice 'OK K2: a prévia conta os fixos da T42, os livres, a equipe e os admins';
end $$;

-- =====================================================================
-- K3 — cancelar antes da aula
-- =====================================================================
do $$
declare v_motivo uuid;
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000002');
  v_motivo := public.criar_motivo('class_cancel', 'c7c00000-0000-4000-8000-000000000001', 'Manutenção no tatame');
  perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', v_motivo);
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', v_motivo);
    raise exception 'FALHOU K4: cancelou de novo';
  exception when check_violation then
    raise notice 'OK K4: aula cancelada não cancela de novo';
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare c constant uuid := 'c7c00000-0000-4000-8000-000000000001';
begin
  if (select cancelled_at from public.classes where id = c) is null
     or (select cancelled_by from public.class_audit where class_id = c) <> 'c7000000-0000-4000-8000-000000000002'
     or exists (select 1 from public.action_reasons where class_id = c and kind = 'class_cancel' and used_at is null) then
    raise exception 'FALHOU K3: aula, auditoria ou motivo';
  end if;
  -- Avisados: os fixos da T42 e o livre, na hora (fura o silêncio), e o admin.
  if not (pg_temp.avisado('c7000000-0000-4000-8000-000000000004', 'aula_cancelada:' || c)
          and pg_temp.avisado('c7000000-0000-4000-8000-000000000005', 'aula_cancelada:' || c)
          and pg_temp.avisado('c7000000-0000-4000-8000-000000000007', 'aula_cancelada:' || c)
          and pg_temp.avisado('c7000000-0000-4000-8000-000000000008', 'aula_cancelada:' || c)
          and pg_temp.avisado('c7000000-0000-4000-8000-000000000010', 'aula_cancelada:' || c)
          and pg_temp.avisado('c7000000-0000-4000-8000-000000000001', 'aula_cancelada:' || c || ':')) then
    raise exception 'FALHOU K3: faltou avisar alguém';
  end if;
  if pg_temp.avisado('c7000000-0000-4000-8000-000000000006', 'aula_cancelada')
     or pg_temp.avisado('c7000000-0000-4000-8000-000000000011', 'aula_cancelada')
     or pg_temp.avisado('c7000000-0000-4000-8000-000000000002', 'aula_cancelada') then
    raise exception 'FALHOU K3: avisou quem trocou a aula, o trancado ou quem cancelou';
  end if;
  if exists (select 1 from public.notification_outbox
              where kind = 'aula_cancelada' and dedupe_key = 'aula_cancelada:' || c and send_after > now()) then
    raise exception 'FALHOU K3: o aviso aos alunos não furou o silêncio';
  end if;

  -- Trocas (T50, D57).
  if (select status || '/' || decided_via from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000002') <> 'cancelled/system'
     or (select status || '/' || decided_via from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000005') <> 'approved/system'
     or exists (select 1 from public.class_swap_reviews where swap_id = 'c7e00000-0000-4000-8000-000000000005')
     or (select status from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000006') <> 'cancelled'
     or (select status from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000003') <> 'approved' then
    raise exception 'FALHOU K3: trocas no cancelamento';
  end if;
  if exists (select 1 from public.notification_outbox where kind::text like 'troca_aprovada%') then
    raise exception 'FALHOU K3: a aprovação pelo sistema gerou push';
  end if;
  raise notice 'OK K3: cancela, avisa na hora os fixos da T42 e os livres, e resolve as trocas (T50, D57)';
end $$;

-- =====================================================================
-- K5 — reativar
-- =====================================================================
set local role authenticated;
do $$
declare v_motivo uuid;
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000002');
  begin
    perform public.reativar_aula('c7c00000-0000-4000-8000-000000000001', gen_random_uuid());
    raise exception 'FALHOU K5: reativou sem motivo';
  exception when invalid_parameter_value then null;
  end;
  v_motivo := public.criar_motivo('class_reactivate', 'c7c00000-0000-4000-8000-000000000001', 'Tatame pronto');
  perform public.reativar_aula('c7c00000-0000-4000-8000-000000000001', v_motivo);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare c constant uuid := 'c7c00000-0000-4000-8000-000000000001';
begin
  if (select cancelled_at from public.classes where id = c) is not null
     or (select cancelled_by from public.class_audit where class_id = c) is not null then
    raise exception 'FALHOU K5: a aula não voltou';
  end if;
  if (select status from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000005') <> 'pending'
     or (select decided_via from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000005') is not null
     or (select status from public.class_swaps where id = 'c7e00000-0000-4000-8000-000000000002') <> 'cancelled' then
    raise exception 'FALHOU K5: trocas na reativação (T50)';
  end if;
  -- Avisados de agora: F5 (troca pendente de novo) entra; F2 (troca cancelada) não.
  if not pg_temp.avisado('c7000000-0000-4000-8000-000000000008', 'aula_reativada:' || c)
     or pg_temp.avisado('c7000000-0000-4000-8000-000000000005', 'aula_reativada:' || c) then
    raise exception 'FALHOU K5: avisados da reativação (T22)';
  end if;
  -- K8: os avisos de cancelamento ainda na fila ficam obsoletos.
  perform * from public.reivindicar_notificacoes(0, 'production');
  if exists (select 1 from public.notification_outbox
              where kind = 'aula_cancelada' and class_id = c and status = 'pending') then
    raise exception 'FALHOU K8: aviso de cancelamento de aula reativada continuou na fila';
  end if;
  raise notice 'OK K5, K8: reativa, devolve a troca do sistema a pendente, avisa os de agora e derruba o aviso velho';
end $$;

-- =====================================================================
-- K6 — o professor cancela no máximo 2 vezes a mesma aula
-- =====================================================================
set local role authenticated;
do $$
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000002');
  perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001',
    public.criar_motivo('class_cancel', 'c7c00000-0000-4000-8000-000000000001', 'Segunda vez'));
  perform public.reativar_aula('c7c00000-0000-4000-8000-000000000001',
    public.criar_motivo('class_reactivate', 'c7c00000-0000-4000-8000-000000000001', 'Voltou'));
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001',
      public.criar_motivo('class_cancel', 'c7c00000-0000-4000-8000-000000000001', 'Terceira vez'));
    raise exception 'FALHOU K6: terceiro cancelamento do mesmo professor';
  exception when check_violation then null;
  end;
  -- O admin não tem limite.
  perform pg_temp.como('c7000000-0000-4000-8000-000000000001');
  perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001',
    public.criar_motivo('class_cancel', 'c7c00000-0000-4000-8000-000000000001', 'Admin cancela'));
  raise notice 'OK K6: não-admin até 2 cancelamentos por aula; o admin, sem limite';
end $$;

-- =====================================================================
-- K7 — cancelar depois da aula avisa só a equipe e os admins
-- =====================================================================
do $$
begin
  perform pg_temp.como('c7000000-0000-4000-8000-000000000001');
  perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000006',
    public.criar_motivo('class_cancel', 'c7c00000-0000-4000-8000-000000000006', 'Não houve aula'));
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare c constant uuid := 'c7c00000-0000-4000-8000-000000000006';
begin
  if pg_temp.avisado('c7000000-0000-4000-8000-000000000004', 'aula_cancelada:' || c)
     or not pg_temp.avisado('c7000000-0000-4000-8000-000000000002', 'aula_cancelada:' || c || ':') then
    raise exception 'FALHOU K7: depois da aula, avisa só a equipe';
  end if;
  -- K9: troca pendente que já não está pendente sai da fila (§ 10).
  insert into public.notification_outbox (recipient_id, kind, dedupe_key, class_id, send_after)
  values ('c7000000-0000-4000-8000-000000000002', 'troca_pendente', 'troca_pendente:c7e00000-0000-4000-8000-000000000002', c, now());
  perform * from public.reivindicar_notificacoes(0, 'production');
  if (select status from public.notification_outbox where dedupe_key = 'troca_pendente:c7e00000-0000-4000-8000-000000000002') <> 'cancelled' then
    raise exception 'FALHOU K9: troca_pendente de troca cancelada continuou na fila';
  end if;
  raise notice 'OK K7, K9: depois da aula só a equipe; a troca decidida derruba o aviso pendente';
end $$;

-- =====================================================================
-- K10 — anônimo (§ 0.1 regra 8)
-- =====================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform public.cancelar_aula('c7c00000-0000-4000-8000-000000000001', gen_random_uuid());
    raise exception 'FALHOU K10: anônimo cancelou';
  exception when insufficient_privilege then
    raise notice 'OK K10: anônimo recebe 42501';
  end;
end $$;

reset role;
rollback;
