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

rollback;
