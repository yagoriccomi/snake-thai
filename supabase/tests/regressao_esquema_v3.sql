-- Regressão do esquema do contrato v3 (bloco 4.1 do ROADMAP-thai).
-- Cada fatia da série 20260925200xxx acrescenta os seus casos aqui; no fim,
-- a conferência inteira do G1 (contrato § 14).
-- Roda numa transação e termina em ROLLBACK; mesmo assim, rode SÓ no banco
-- local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('e3000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v3-adm@t.invalid','x',now(),now(),now()),
  ('e3000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v3-alu@t.invalid','x',now(),now(),now()),
  ('e3000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v3-alu2@t.invalid','x',now(),now(),now());

insert into public.groups (id, name) values ('turma-v3', 'Turma V3');

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id) values
  ('e3000000-0000-4000-8000-000000000001','admin','Admin V3','93000000001',false,'active', null),
  ('e3000000-0000-4000-8000-000000000002','user','Aluna V3','93000000002',false,'active','turma-v3'),
  ('e3000000-0000-4000-8000-000000000003','user','Aluno V3','93000000003',false,'active','turma-v3');

insert into public.classes (id, title, type, date_time, group_id) values
  ('e3000000-0000-4000-8000-00000000c001','Muay Thai V3','routine', now() - interval '1 day', 'turma-v3');

-- =====================================================================
-- F2.1 — plano: modalidade e cota coerentes (D1, D2)
-- =====================================================================
do $$
begin
  insert into public.plans (name, price_cents, billing_period, due_day, schedule_mode, weekly_quota)
  values ('Livre 3x V3', 10000, 'monthly', 10, 'free', 3);
  if (select schedule_mode from public.plans where name = 'Livre 3x V3') <> 'free' then
    raise exception 'FALHOU F2.1: plano livre não gravou a modalidade';
  end if;

  begin
    insert into public.plans (name, price_cents, billing_period, due_day, schedule_mode)
    values ('Livre sem cota', 10000, 'monthly', 10, 'free');
    raise exception 'FALHOU F2.1: plano livre sem cota aceito';
  exception when check_violation then null;
  end;

  begin
    insert into public.plans (name, price_cents, billing_period, due_day, schedule_mode, weekly_quota)
    values ('Fixo com cota', 10000, 'monthly', 10, 'fixed', 2);
    raise exception 'FALHOU F2.1: plano fixo com cota aceito';
  exception when check_violation then null;
  end;

  begin
    insert into public.plans (name, price_cents, billing_period, due_day, schedule_mode, weekly_quota)
    values ('Livre 7x', 10000, 'monthly', 10, 'free', 7);
    raise exception 'FALHOU F2.1: cota acima de 6 aceita';
  exception when check_violation then null;
  end;

  if exists (select 1 from public.plans where schedule_mode is null or (schedule_mode = 'fixed' and weekly_quota is not null)) then
    raise exception 'FALHOU F2.1: plano antigo sem modalidade coerente';
  end if;
  raise notice 'OK F2.1: modalidade e cota coerentes; planos antigos viram fixo';
end $$;

-- =====================================================================
-- F2.2 — horário e aula "só livres" podem não ter turma (T7)
-- =====================================================================
do $$
begin
  insert into public.class_schedules (title, weekday, start_time, valid_from, audience, group_id)
  values ('Treino livre V3', 2, '12:00', current_date, 'free', null);

  begin
    insert into public.class_schedules (title, weekday, start_time, valid_from, audience, group_id)
    values ('Sem turma e para fixos', 2, '13:00', current_date, 'both', null);
    raise exception 'FALHOU F2.2: horário de ambos sem turma aceito';
  exception when check_violation then null;
  end;

  insert into public.classes (title, type, date_time, group_id, audience)
  values ('Livre V3', 'routine', now() + interval '2 days', null, 'free');

  begin
    insert into public.classes (title, type, date_time, group_id, audience)
    values ('Rotina sem turma', 'routine', now() + interval '2 days', null, 'fixed');
    raise exception 'FALHOU F2.2: aula de rotina para fixos sem turma aceita';
  exception when check_violation then null;
  end;

  if (select audience from public.classes where id = 'e3000000-0000-4000-8000-00000000c001') <> 'both' then
    raise exception 'FALHOU F2.2: aula nasceu sem o público padrão';
  end if;
  raise notice 'OK F2.2: só livres sem turma; fixos e ambos continuam exigindo turma';
end $$;

-- =====================================================================
-- F2.3 — justificativa: escopo, tentativa e caminho do anexo (§ 9.1)
-- =====================================================================
do $$
begin
  begin
    insert into public.absence_justifications (class_id, user_id, message, scope)
    values (null, 'e3000000-0000-4000-8000-000000000002', 'Sem aula', 'class');
    raise exception 'FALHOU F2.3: justificativa de aula sem aula aceita';
  exception when check_violation or not_null_violation then null;
  end;

  begin
    insert into public.absence_justifications (class_id, user_id, message, scope)
    values ('e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'Semana com aula', 'week');
    raise exception 'FALHOU F2.3: justificativa semanal com aula aceita';
  exception when check_violation then null;
  end;

  -- O anexo na pasta de OUTRO aluno é a brecha que a constraint fecha.
  begin
    insert into public.absence_justifications (class_id, user_id, message, proof_provider, proof_public_id)
    values ('e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'Atestado', 'cloudinary',
            'justificativas/e3000000-0000-4000-8000-000000000003/e3000000-0000-4000-8000-00000000c001');
    raise exception 'FALHOU F2.3: anexo apontando para a pasta de outro aluno aceito';
  exception when check_violation then null;
  end;
  raise notice 'OK F2.3: escopo coerente e anexo só na pasta do próprio aluno';
end $$;

-- =====================================================================
-- F2.4 — comprovante: caminho travado no dono do pagamento (§ 8)
-- =====================================================================
do $$
declare
  v_pagamento uuid;
begin
  insert into public.payments (user_id, amount_cents, due_date, reference_month, status)
  values ('e3000000-0000-4000-8000-000000000002', 10000, date '2031-05-10', date '2031-05-01', 'open')
  returning id into v_pagamento;

  update public.payments
     set proof_provider = 'cloudinary',
         proof_public_id = 'comprovantes/e3000000-0000-4000-8000-000000000002/' || v_pagamento::text
   where id = v_pagamento;

  begin
    update public.payments
       set proof_public_id = 'comprovantes/e3000000-0000-4000-8000-000000000003/' || v_pagamento::text
     where id = v_pagamento;
    raise exception 'FALHOU F2.4: comprovante na pasta de outro aluno aceito';
  exception when check_violation then null;
  end;

  begin
    update public.payments
       set proof_provider = 'supabase_storage', proof_public_id = null,
           proof_storage_path = 'e3000000-0000-4000-8000-000000000002/../outro/arquivo.jpg'
     where id = v_pagamento;
    raise exception 'FALHOU F2.4: caminho com ".." aceito no Storage';
  exception when check_violation then null;
  end;
  raise notice 'OK F2.4: comprovante só na pasta do dono, sem ".."';
end $$;

-- =====================================================================
-- F2.5 — configuração: dias de aula, meta, guarda e contato (§ 5.2, § 5.4)
-- =====================================================================
do $$
declare
  v_ultima text;
begin
  if (select class_weekdays from public.academy_settings) is distinct from '{1,2,3,4,5,6}'::smallint[]
     and not exists (select 1 from public.academy_settings where cardinality(class_weekdays) between 1 and 7) then
    raise exception 'FALHOU F2.5: dias de aula fora do padrão seg–sáb';
  end if;
  if (select attachment_retention_days from public.academy_settings) <> 180 then
    raise exception 'FALHOU F2.5: guarda de anexos não nasceu com 180 dias (D54)';
  end if;

  begin
    update public.academy_settings set class_weekdays = '{1,1,2}';
    raise exception 'FALHOU F2.5: dia de aula repetido aceito';
  exception when check_violation then null;
  end;
  begin
    update public.academy_settings set class_weekdays = '{7}';
    raise exception 'FALHOU F2.5: dia 7 aceito';
  exception when check_violation then null;
  end;
  begin
    update public.academy_settings set contact_whatsapp = '11912345678';
    raise exception 'FALHOU F2.5: WhatsApp sem o 55 aceito';
  exception when check_violation then null;
  end;
  begin
    update public.academy_settings set contact_email = '';
    raise exception 'FALHOU F2.5: e-mail vazio aceito (o cliente grava null)';
  exception when check_violation then null;
  end;
  begin
    update public.academy_settings set attachment_retention_days = 10;
    raise exception 'FALHOU F2.5: guarda de 10 dias aceita';
  exception when check_violation then null;
  end;

  update public.academy_settings set contact_whatsapp = '5511912345678', contact_email = 'contato@academia.test';

  -- O APK 1.8 faz select('*') em academy_settings (§ 15): a coluna nova vem por último.
  select column_name into v_ultima
    from information_schema.columns
   where table_schema = 'public' and table_name = 'academy_settings'
   order by ordinal_position desc
   limit 1;
  if v_ultima <> 'contact_whatsapp' then
    raise exception 'FALHOU F2.5: contact_whatsapp não é a última coluna (é %)', v_ultima;
  end if;
  raise notice 'OK F2.5: dias de aula, WhatsApp, e-mail e guarda validados; WhatsApp no fim da tabela';
end $$;

-- =====================================================================
-- F2.6 — o admin continua salvando Configurações (sem_repeticao roda na
-- constraint com a permissão de quem grava)
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  update public.academy_settings set class_weekdays = '{1,2,3,4,5}';
  if (select class_weekdays from public.academy_settings) <> '{1,2,3,4,5}'::smallint[] then
    raise exception 'FALHOU F2.6: admin não conseguiu mudar os dias de aula';
  end if;
  raise notice 'OK F2.6: admin grava os dias de aula';
end $$;

-- =====================================================================
-- F2.7 — o upsert de justificativa do APK 1.8 continua funcionando (§ 15)
-- =====================================================================
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  insert into public.attendance (class_id, user_id, declared_status)
  values ('e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'absent')
  on conflict (class_id, user_id) do update set declared_status = excluded.declared_status;

  insert into public.absence_justifications (class_id, user_id, message)
  values ('e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'Consulta médica')
  on conflict (class_id, user_id) do update set message = excluded.message;

  if not exists (
    select 1 from public.absence_justifications
     where class_id = 'e3000000-0000-4000-8000-00000000c001'
       and user_id = 'e3000000-0000-4000-8000-000000000002'
       and scope = 'class' and attempt = 1
  ) then
    raise exception 'FALHOU F2.7: justificativa do APK 1.8 não nasceu como de aula, tentativa 1';
  end if;
  raise notice 'OK F2.7: upsert antigo de justificativa segue funcionando';
end $$;

-- =====================================================================
-- F2.8 — anon não chega às colunas novas (§ 0.1)
-- =====================================================================
set local role anon;
set local request.jwt.claims = '{}';
do $$
declare
  n int;
begin
  -- A tabela tem o grant padrão do Supabase para anon; quem protege é a RLS,
  -- que só tem política para authenticated: o anon enxerga zero linhas. Sem
  -- isso, o contato apareceria antes do login (D52).
  select count(*) into n from public.academy_settings where contact_whatsapp is not null or true;
  if n <> 0 then
    raise exception 'FALHOU F2.8: anon leu % linha(s) de academy_settings', n;
  end if;
  raise notice 'OK F2.8: anon não enxerga a configuração nem o contato';
end $$;

reset role;

-- =====================================================================
-- F3.1 — anexo de motivo: no máximo 5, só na pasta de quem enviou (T25, § 8)
-- =====================================================================
insert into public.action_reasons (id, kind, class_id, author_id, body) values
  ('e3000000-0000-4000-8000-00000000a001', 'roll_call_edit', 'e3000000-0000-4000-8000-00000000c001',
   'e3000000-0000-4000-8000-000000000001', 'Aluno chegou atrasado e não foi marcado');

do $$
declare
  i int;
  v_id uuid;
begin
  for i in 1..5 loop
    v_id := gen_random_uuid();
    insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id)
    values (v_id, 'e3000000-0000-4000-8000-00000000a001', 'e3000000-0000-4000-8000-000000000001', 'cloudinary',
            'motivos/e3000000-0000-4000-8000-000000000001/' || v_id::text);
  end loop;

  begin
    v_id := gen_random_uuid();
    insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id)
    values (v_id, 'e3000000-0000-4000-8000-00000000a001', 'e3000000-0000-4000-8000-000000000001', 'cloudinary',
            'motivos/e3000000-0000-4000-8000-000000000001/' || v_id::text);
    raise exception 'FALHOU F3.1: sexto anexo aceito';
  exception when check_violation then null;
  end;

  begin
    v_id := gen_random_uuid();
    insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id)
    values (v_id, 'e3000000-0000-4000-8000-00000000a001', 'e3000000-0000-4000-8000-000000000001', 'cloudinary',
            'motivos/e3000000-0000-4000-8000-000000000002/' || v_id::text);
    raise exception 'FALHOU F3.1: anexo na pasta de outra pessoa aceito';
  exception when check_violation then null;
  end;

  begin
    insert into public.action_reasons (kind, class_id, author_id, body)
    values ('class_swap_evidence', 'e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'Mudei de emprego');
    raise exception 'FALHOU F3.1: justificativa de troca presa a uma aula aceita';
  exception when check_violation then null;
  end;

  begin
    insert into public.action_reasons (kind, class_id, author_id, body)
    values ('class_cancel', 'e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000001', '   ');
    raise exception 'FALHOU F3.1: motivo em branco aceito';
  exception when check_violation then null;
  end;
  raise notice 'OK F3.1: 5 anexos no máximo, caminho do próprio autor, motivo com texto';
end $$;

-- =====================================================================
-- F3.2 — anexo apagado vai para a fila com o caminho derivado e o motivo certo
-- =====================================================================
do $$
declare
  v_anexo record;
begin
  select id, uploaded_by into v_anexo from public.action_reason_attachments
   where reason_id = 'e3000000-0000-4000-8000-00000000a001' limit 1;
  delete from public.action_reason_attachments where id = v_anexo.id;
  if not exists (select 1 from public.media_deletion_queue
                  where asset_ref = 'motivos/' || v_anexo.uploaded_by::text || '/' || v_anexo.id::text
                    and motivo = 'anexo_de_motivo_removido') then
    raise exception 'FALHOU F3.2: anexo removido não foi para a fila com anexo_de_motivo_removido';
  end if;

  -- O cron dos 180 dias liga a variável antes de apagar (T45).
  select id, uploaded_by into v_anexo from public.action_reason_attachments
   where reason_id = 'e3000000-0000-4000-8000-00000000a001' limit 1;
  perform set_config('snake.anexo_expirado', 'on', true);
  delete from public.action_reason_attachments where id = v_anexo.id;
  perform set_config('snake.anexo_expirado', 'off', true);
  if not exists (select 1 from public.media_deletion_queue
                  where asset_ref = 'motivos/' || v_anexo.uploaded_by::text || '/' || v_anexo.id::text
                    and motivo = 'anexo_expirado') then
    raise exception 'FALHOU F3.2: anexo expirado não foi para a fila com anexo_expirado';
  end if;
  raise notice 'OK F3.2: fila de exclusão com o caminho derivado e o motivo certo';
end $$;

-- =====================================================================
-- F3.3 — anexo de justificativa que expira: um item só na fila, anexo_expirado
-- =====================================================================
do $$
declare
  v_id uuid;
  n int;
begin
  select id into v_id from public.absence_justifications
   where class_id = 'e3000000-0000-4000-8000-00000000c001' and user_id = 'e3000000-0000-4000-8000-000000000002';
  update public.absence_justifications
     set proof_provider = 'cloudinary',
         proof_public_id = 'justificativas/e3000000-0000-4000-8000-000000000002/' || v_id::text
   where id = v_id;

  perform set_config('snake.anexo_expirado', 'on', true);
  update public.absence_justifications set proof_provider = null, proof_public_id = null where id = v_id;
  perform set_config('snake.anexo_expirado', 'off', true);

  select count(*) into n from public.media_deletion_queue
   where asset_ref = 'justificativas/e3000000-0000-4000-8000-000000000002/' || v_id::text;
  if n <> 1 or not exists (select 1 from public.media_deletion_queue
                            where asset_ref = 'justificativas/e3000000-0000-4000-8000-000000000002/' || v_id::text
                              and motivo = 'anexo_expirado') then
    raise exception 'FALHOU F3.3: anexo expirado da justificativa foi para a fila % vez(es) ou com o motivo errado', n;
  end if;
  raise notice 'OK F3.3: anexo expirado da justificativa entra uma vez, como anexo_expirado';
end $$;

-- =====================================================================
-- F4.1 — aula apagada com troca pendente (T39, T50)
-- =====================================================================
insert into public.classes (id, title, type, date_time, group_id) values
  ('e3000000-0000-4000-8000-00000000c010', 'Original passada', 'routine', now() - interval '2 hours', 'turma-v3'),
  ('e3000000-0000-4000-8000-00000000c011', 'Nova A', 'routine', now() + interval '1 day', 'turma-v3'),
  ('e3000000-0000-4000-8000-00000000c012', 'Original futura', 'routine', now() + interval '2 days', 'turma-v3'),
  ('e3000000-0000-4000-8000-00000000c013', 'Nova B', 'routine', now() + interval '3 days', 'turma-v3'),
  ('e3000000-0000-4000-8000-00000000c014', 'Original aprovada', 'routine', now() + interval '4 days', 'turma-v3'),
  ('e3000000-0000-4000-8000-00000000c015', 'Nova aprovada', 'routine', now() + interval '5 days', 'turma-v3');

insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id) values
  ('e3000000-0000-4000-8000-00000000f001', 'e3000000-0000-4000-8000-000000000002', 'once',
   'e3000000-0000-4000-8000-00000000c010', 'e3000000-0000-4000-8000-00000000c011'),
  ('e3000000-0000-4000-8000-00000000f002', 'e3000000-0000-4000-8000-000000000002', 'once',
   'e3000000-0000-4000-8000-00000000c012', 'e3000000-0000-4000-8000-00000000c013');
insert into public.class_swaps (id, user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at) values
  ('e3000000-0000-4000-8000-00000000f003', 'e3000000-0000-4000-8000-000000000003', 'once',
   'e3000000-0000-4000-8000-00000000c014', 'e3000000-0000-4000-8000-00000000c015', 'approved', 'review', now());

do $$
begin
  -- Reposição: a original já passou, e a aula nova some. Ele não tem mais
  -- como repor; a culpa é da academia (D57, T50).
  delete from public.classes where id = 'e3000000-0000-4000-8000-00000000c011';
  if (select status from public.class_swaps where id = 'e3000000-0000-4000-8000-00000000f001') <> 'approved'
     or (select decided_via from public.class_swaps where id = 'e3000000-0000-4000-8000-00000000f001') <> 'system' then
    raise exception 'FALHOU F4.1: nova apagada com a original já começada não virou aprovada pelo sistema';
  end if;

  -- A original ainda vai acontecer: a troca cai e ele vai a ela.
  delete from public.classes where id = 'e3000000-0000-4000-8000-00000000c013';
  if (select status from public.class_swaps where id = 'e3000000-0000-4000-8000-00000000f002') <> 'cancelled' then
    raise exception 'FALHOU F4.1: nova apagada com a original por vir não cancelou a troca';
  end if;

  -- A aprovada segue (T39).
  delete from public.classes where id = 'e3000000-0000-4000-8000-00000000c015';
  if (select status from public.class_swaps where id = 'e3000000-0000-4000-8000-00000000f003') <> 'approved'
     or (select decided_via from public.class_swaps where id = 'e3000000-0000-4000-8000-00000000f003') <> 'review' then
    raise exception 'FALHOU F4.1: troca aprovada mudou quando a aula nova foi apagada';
  end if;
  raise notice 'OK F4.1: aula apagada — reposição aprovada pelo sistema, pendente futura cancelada, aprovada segue';
end $$;

-- =====================================================================
-- F4.2 — troca: coerência e uma ativa por aula (§ 9.4)
-- =====================================================================
do $$
begin
  begin
    insert into public.class_swaps (user_id, kind, from_class_id, to_class_id)
    values ('e3000000-0000-4000-8000-000000000003', 'permanent',
            'e3000000-0000-4000-8000-00000000c014', 'e3000000-0000-4000-8000-00000000c012');
    raise exception 'FALHOU F4.2: troca permanente sem justificativa aceita';
  exception when check_violation then null;
  end;

  begin
    insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, status)
    values ('e3000000-0000-4000-8000-000000000003', 'once',
            'e3000000-0000-4000-8000-00000000c012', 'e3000000-0000-4000-8000-00000000c010', 'rejected');
    raise exception 'FALHOU F4.2: troca decidida sem data nem via aceita';
  exception when check_violation then null;
  end;

  begin
    insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at, decided_by)
    values ('e3000000-0000-4000-8000-000000000003', 'once',
            'e3000000-0000-4000-8000-00000000c012', 'e3000000-0000-4000-8000-00000000c010', 'rejected', 'review', now(),
            'e3000000-0000-4000-8000-000000000001');
    raise exception 'FALHOU F4.2: troca negada com quem negou na linha principal (D16)';
  exception when check_violation then null;
  end;

  -- Duas trocas avulsas ativas saindo da mesma aula: abono em dobro.
  insert into public.class_swaps (user_id, kind, from_class_id, to_class_id)
  values ('e3000000-0000-4000-8000-000000000003', 'once',
          'e3000000-0000-4000-8000-00000000c012', 'e3000000-0000-4000-8000-00000000c010');
  begin
    insert into public.class_swaps (user_id, kind, from_class_id, to_class_id)
    values ('e3000000-0000-4000-8000-000000000003', 'once',
            'e3000000-0000-4000-8000-00000000c012', 'e3000000-0000-4000-8000-00000000c001');
    raise exception 'FALHOU F4.2: segunda troca ativa saindo da mesma aula aceita';
  exception when unique_violation then null;
  end;
  raise notice 'OK F4.2: troca coerente, sem aprovador na negada, uma ativa por aula';
end $$;

-- =====================================================================
-- F4.3 — período de troca permanente: horários diferentes e fim coerente (T37)
-- =====================================================================
do $$
declare
  v_a uuid;
  v_b uuid;
begin
  insert into public.class_schedules (title, weekday, start_time, valid_from, group_id)
  values ('Seg V3', 1, '19:00', current_date, 'turma-v3') returning id into v_a;
  insert into public.class_schedules (title, weekday, start_time, valid_from, group_id)
  values ('Qua V3', 3, '19:00', current_date, 'turma-v3') returning id into v_b;

  begin
    insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
    values ('e3000000-0000-4000-8000-000000000002', v_a, v_a, now());
    raise exception 'FALHOU F4.3: período do horário para ele mesmo aceito';
  exception when check_violation then null;
  end;

  begin
    insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at, ended_at, end_reason)
    values ('e3000000-0000-4000-8000-000000000002', v_a, v_b, now(), now() - interval '1 day', 'reverted');
    raise exception 'FALHOU F4.3: período terminando antes de começar aceito';
  exception when check_violation then null;
  end;

  begin
    insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at, ended_at)
    values ('e3000000-0000-4000-8000-000000000002', v_a, v_b, now(), now() + interval '1 day');
    raise exception 'FALHOU F4.3: período encerrado sem motivo aceito';
  exception when check_violation then null;
  end;

  insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
  values ('e3000000-0000-4000-8000-000000000002', v_a, v_b, now());
  begin
    insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
    values ('e3000000-0000-4000-8000-000000000002', v_a, v_b, now());
    raise exception 'FALHOU F4.3: dois períodos abertos saindo do mesmo horário';
  exception when unique_violation then null;
  end;
  raise notice 'OK F4.3: período permanente coerente e um aberto por horário';
end $$;

-- =====================================================================
-- F3.4 / F4.4 — quem lê o quê (§ 0.1, § 6, § 7.1, § 9.3, § 9.4)
-- =====================================================================
insert into public.class_audit (class_id, attendance_taken_by)
values ('e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare
  n int;
  v_tabela text;
begin
  -- Auditoria: o aluno enxerga zero linhas (a RLS só libera o admin).
  select count(*) into n from public.class_audit;
  if n <> 0 then
    raise exception 'FALHOU F3.4: aluno leu % linha(s) da auditoria da aula', n;
  end if;

  -- Solicitações e trocas: nem grant há para authenticated.
  foreach v_tabela in array array['roll_call_requests', 'class_swaps', 'class_swap_reviews', 'class_swap_periods'] loop
    begin
      execute format('select count(*) from public.%I', v_tabela) into n;
      raise exception 'FALHOU F4.4: aluno leu %', v_tabela;
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- Escrita direta: nenhuma.
  begin
    insert into public.action_reasons (kind, class_id, author_id, body)
    values ('roll_call_edit', 'e3000000-0000-4000-8000-00000000c001', 'e3000000-0000-4000-8000-000000000002', 'x');
    raise exception 'FALHOU F3.4: aluno gravou motivo direto na tabela';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK F3.4/F4.4: aluno não lê auditoria, solicitações nem trocas, e não grava motivo direto';
end $$;

set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  if not exists (select 1 from public.class_audit where class_id = 'e3000000-0000-4000-8000-00000000c001') then
    raise exception 'FALHOU F3.4: admin não leu a auditoria da aula';
  end if;
  raise notice 'OK F3.4: admin lê a auditoria';
end $$;

set local role anon;
set local request.jwt.claims = '{}';
do $$
declare
  v_tabela text;
  n int;
begin
  foreach v_tabela in array array['action_reasons', 'action_reason_attachments', 'class_audit', 'attendance_audit',
                                  'absence_justification_reviews', 'class_swaps'] loop
    begin
      execute format('select count(*) from public.%I', v_tabela) into n;
      raise exception 'FALHOU F4.4: anon chegou a %', v_tabela;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK F4.4: anon não chega a nenhuma tabela nova';
end $$;

reset role;

-- =====================================================================
-- F3.5 — aula cancelada (com motivo na auditoria) ainda pode ser apagada:
-- motivo e auditoria somem na mesma cascata, sem o `restrict` travar
-- =====================================================================
do $$
begin
  insert into public.classes (id, title, type, date_time, group_id, cancelled_at)
  values ('e3000000-0000-4000-8000-0000000cc001', 'Cancelada V3', 'routine', now() + interval '1 day', 'turma-v3', now());
  insert into public.action_reasons (id, kind, class_id, body)
  values ('e3000000-0000-4000-8000-0000000aa001', 'class_cancel', 'e3000000-0000-4000-8000-0000000cc001', 'Chuva forte');
  insert into public.class_audit (class_id, cancel_reason_id)
  values ('e3000000-0000-4000-8000-0000000cc001', 'e3000000-0000-4000-8000-0000000aa001');

  delete from public.classes where id = 'e3000000-0000-4000-8000-0000000cc001';
  if exists (select 1 from public.action_reasons where id = 'e3000000-0000-4000-8000-0000000aa001') then
    raise exception 'FALHOU F3.5: o motivo da aula apagada ficou para trás';
  end if;
  raise notice 'OK F3.5: aula cancelada apagada leva motivo e auditoria juntos';
end $$;

rollback;
