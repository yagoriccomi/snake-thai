-- Regressão da exclusão de conta (LGPD) e do prazo de guarda dos comprovantes
-- (migrations 20260916195116_lgpd_exclusao_de_conta e
-- 20260916195119_retencao_comprovantes). Roda numa transação e termina em
-- ROLLBACK; mesmo assim, rode só no banco local (scripts\db-dev test).
--
--   A1 aluno com 2 comprovantes (Cloudinary e Storage), justificativa com anexo,
--      consentimento, presença e frequência mensal
--   A2 aluno com comprovante que o admin recusa · A3 aluno sem nada
--   P  professor com uma aula passada e uma futura · ADM administrador
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa
-- ---------------------------------------------------------------------
insert into public.groups (id, name) values ('turma-lgpd', 'Turma LGPD');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('f7000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lgpd-a1@t.invalid','x',now(),now(),now()),
  ('f7000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lgpd-a2@t.invalid','x',now(),now(),now()),
  ('f7000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lgpd-a3@t.invalid','x',now(),now(),now()),
  ('f7000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lgpd-p@t.invalid','x',now(),now(),now()),
  ('f7000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lgpd-adm@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, phone, is_first_login, status, group_id, color)
values
  ('f7000000-0000-4000-8000-000000000001','user','Aluna LGPD','77000000001','11912345678',false,'active','turma-lgpd',null),
  ('f7000000-0000-4000-8000-000000000002','user','Aluno Recusado','77000000002',null,false,'active','turma-lgpd',null),
  ('f7000000-0000-4000-8000-000000000003','user','Aluno Sem Nada','77000000003',null,false,'active','turma-lgpd',null),
  ('f7000000-0000-4000-8000-000000000004','professor','Prof LGPD','77000000004',null,false,'active',null,'#123456'),
  ('f7000000-0000-4000-8000-000000000005','admin','Admin LGPD','77000000005',null,false,'active',null,null);

insert into public.classes (id, title, type, date_time, group_id) values
  ('f7000000-0000-4000-8000-00000000c001','lgpd-passada','routine', now() - interval '2 days','turma-lgpd'),
  ('f7000000-0000-4000-8000-00000000c002','lgpd-futura','routine', now() + interval '2 days','turma-lgpd');

insert into public.class_teachers (class_id, teacher_id) values
  ('f7000000-0000-4000-8000-00000000c001','f7000000-0000-4000-8000-000000000004'),
  ('f7000000-0000-4000-8000-00000000c002','f7000000-0000-4000-8000-000000000004');

insert into public.attendance (class_id, user_id, declared_status, status) values
  ('f7000000-0000-4000-8000-00000000c001','f7000000-0000-4000-8000-000000000001','absent','absent');

insert into public.absence_justifications (id, class_id, user_id, message, proof_provider, proof_public_id) values
  ('f7000000-0000-4000-8000-00000000e001','f7000000-0000-4000-8000-00000000c001','f7000000-0000-4000-8000-000000000001',
   'Consulta médica', 'cloudinary', 'justificativas/f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-00000000c001');

insert into public.attendance_monthly (user_id, reference_month, group_id, total_classes, counted_classes, attended, justified, frequency_percent)
values ('f7000000-0000-4000-8000-000000000001', date '2030-01-01', 'turma-lgpd', 8, 8, 6, 1, 87.5);

insert into public.legal_documents (id, kind, version, content)
values ('f7000000-0000-4000-8000-00000000a001', 'privacy_policy', 'lgpd-teste', 'texto de teste')
on conflict do nothing;
insert into public.consents (user_id, document_id)
select 'f7000000-0000-4000-8000-000000000001', id from public.legal_documents
 where id = 'f7000000-0000-4000-8000-00000000a001';

-- Competências em 2030: longe de qualquer fatura de entrada criada pelo gatilho.
insert into public.payments (id, user_id, amount_cents, due_date, reference_month, status, paid_at,
                             proof_provider, proof_public_id, proof_storage_path) values
  ('f7000000-0000-4000-8000-00000000d001','f7000000-0000-4000-8000-000000000001',10000, date '2030-01-10', date '2030-01-01','paid', now(),
   'cloudinary','comprovantes/f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-00000000d001', null),
  ('f7000000-0000-4000-8000-00000000d002','f7000000-0000-4000-8000-000000000001',12000, date '2030-02-10', date '2030-02-01','pending_approval', null,
   'supabase_storage', null, 'f7000000-0000-4000-8000-000000000001/d002.jpg'),
  ('f7000000-0000-4000-8000-00000000d003','f7000000-0000-4000-8000-000000000002',10000, date '2030-01-10', date '2030-01-01','pending_approval', null,
   'cloudinary','comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d003', null);

-- =====================================================================
-- T10 — export do titular traz frequência mensal e justificativas, só dele
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f7000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare
  v jsonb := public.export_my_data();
begin
  if jsonb_array_length(v->'frequencia_mensal') <> 1 or jsonb_array_length(v->'justificativas') <> 1 then
    raise exception 'FALHOU T10: export sem frequência mensal ou justificativas: %', v;
  end if;
  if (v->'pagamentos')::text like '%f7000000-0000-4000-8000-000000000002%' or (v->'perfil'->>'id') <> 'f7000000-0000-4000-8000-000000000001' then
    raise exception 'FALHOU T10: export trouxe dado de outro titular';
  end if;
  raise notice 'OK T10: export completo e só do titular';
end $$;

-- T8 — aluno não chama a anonimização direto
do $$
begin
  begin
    perform public.anonimizar_titular('f7000000-0000-4000-8000-000000000003','f7000000-0000-4000-8000-000000000001');
    raise exception 'FALHOU T8: authenticated executou anonimizar_titular';
  exception when insufficient_privilege then
    raise notice 'OK T8: só o servidor anonimiza';
  end;
end $$;

-- T11b — aluno não troca o próprio CPF já definido
do $$
begin
  begin
    update public.profiles set cpf = '77000000099' where id = 'f7000000-0000-4000-8000-000000000001';
    raise exception 'FALHOU T11b: aluno trocou o próprio CPF';
  exception when insufficient_privilege then
    raise notice 'OK T11b: CPF definido só muda pelo admin';
  end;
end $$;

-- T12c — a conferência de e-mail em uso é só do servidor
do $$
begin
  begin
    perform public.email_ja_cadastrado('lgpd-a2@t.invalid', 'f7000000-0000-4000-8000-000000000001');
    raise exception 'FALHOU T12c: aluno consultou e-mail em uso';
  exception when insufficient_privilege then
    raise notice 'OK T12c: e-mail em uso só pelo servidor';
  end;
end $$;

-- T12b — aluno não vê e-mail de ninguém
do $$
begin
  begin
    perform public.email_do_usuario('f7000000-0000-4000-8000-000000000002');
    raise exception 'FALHOU T12b: aluno leu e-mail de outro usuário';
  exception when insufficient_privilege then
    raise notice 'OK T12b: e-mail só para admin';
  end;
end $$;
reset role;

-- =====================================================================
-- Ator: ADMIN
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f7000000-0000-4000-8000-000000000005","role":"authenticated"}';

-- T11 — admin edita os dados do aluno; CPF repetido é recusado pelo banco
do $$
begin
  update public.profiles
     set name = 'Aluno Editado', cpf = '77000000033', phone = '11987654321', dob = date '2000-05-01',
         group_id = null, status = 'inactive', deactivated_at = now()
   where id = 'f7000000-0000-4000-8000-000000000003';
  if not exists (select 1 from public.profiles where id = 'f7000000-0000-4000-8000-000000000003'
                  and name = 'Aluno Editado' and cpf = '77000000033' and status = 'inactive') then
    raise exception 'FALHOU T11: edição do admin não gravou';
  end if;
  begin
    update public.profiles set cpf = '77000000001' where id = 'f7000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU T11: CPF repetido foi aceito';
  exception when unique_violation then
    raise notice 'OK T11: admin edita; CPF repetido recusado';
  end;
end $$;

-- T12 — admin vê o e-mail do aluno
do $$
begin
  if public.email_do_usuario('f7000000-0000-4000-8000-000000000002') <> 'lgpd-a2@t.invalid' then
    raise exception 'FALHOU T12: e-mail não veio';
  end if;
  raise notice 'OK T12: admin vê o e-mail';
end $$;

-- T13 — recusar comprovante (a contagem da fila vem logo abaixo, fora do app)
update public.payments
   set status = 'open', proof_provider = null, proof_public_id = null
 where id = 'f7000000-0000-4000-8000-00000000d003';

-- T14 — admin não apaga perfil (o cascade levaria o financeiro)
do $$
begin
  begin
    delete from public.profiles where id = 'f7000000-0000-4000-8000-000000000003';
    raise exception 'FALHOU T14: admin apagou um perfil';
  exception when insufficient_privilege then
    raise notice 'OK T14: DELETE em profiles negado';
  end;
end $$;
reset role;

-- T13 — a recusa continua gerando exatamente 1 item na fila
do $$
declare
  n integer;
begin
  select count(*) into n from public.media_deletion_queue
   where asset_ref = 'comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d003' and motivo = 'comprovante_recusado';
  if n <> 1 then
    raise exception 'FALHOU T13: recusa gerou % itens', n;
  end if;
  raise notice 'OK T13: recusa gera 1 item na fila';
end $$;

-- =====================================================================
-- Servidor (service_role): anonimização
-- =====================================================================
set local role service_role;

-- T1..T5 — aluna com comprovantes, justificativa e consentimento
do $$
declare
  r jsonb;
  n integer;
begin
  r := public.anonimizar_titular('f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001');
  if (r->>'comprovantes')::int <> 2 or (r->>'justificativas')::int <> 1 or (r->>'ja_anonimizado')::boolean then
    raise exception 'FALHOU T1: contagens inesperadas: %', r;
  end if;

  if not exists (select 1 from public.profiles
                  where id = 'f7000000-0000-4000-8000-000000000001'
                    and name = 'Usuário removido' and cpf is null and phone is null and dob is null
                    and group_id is null and status = 'inactive' and anonymized_at is not null) then
    raise exception 'FALHOU T1: perfil não foi anonimizado';
  end if;
  raise notice 'OK T1: perfil anonimizado';

  select count(*) into n from public.payments
   where user_id = 'f7000000-0000-4000-8000-000000000001'
     and proof_provider is null and proof_public_id is null and proof_storage_path is null;
  if n <> 2 or not exists (select 1 from public.payments where id = 'f7000000-0000-4000-8000-00000000d001'
                            and amount_cents = 10000 and status = 'paid' and paid_at is not null) then
    raise exception 'FALHOU T2: pagamentos não preservados ou comprovantes não limpos';
  end if;
  raise notice 'OK T2: pagamentos preservados, sem imagem de comprovante';

  select count(*) into n from public.media_deletion_queue
   where asset_ref in ('comprovantes/f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-00000000d001', 'f7000000-0000-4000-8000-000000000001/d002.jpg');
  if n <> 2 or exists (select 1 from public.media_deletion_queue
                        where asset_ref in ('comprovantes/f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-00000000d001', 'f7000000-0000-4000-8000-000000000001/d002.jpg')
                          and motivo <> 'conta_excluida') then
    raise exception 'FALHOU T3: fila com % itens ou motivo errado', n;
  end if;
  raise notice 'OK T3: 1 item por arquivo, motivo conta_excluida';

  if exists (select 1 from public.absence_justifications where user_id = 'f7000000-0000-4000-8000-000000000001')
     or not exists (select 1 from public.media_deletion_queue
                     where asset_ref = 'justificativas/f7000000-0000-4000-8000-000000000001/f7000000-0000-4000-8000-00000000c001' and motivo = 'justificativa_removida') then
    raise exception 'FALHOU T4: justificativa ou anexo ficaram';
  end if;
  raise notice 'OK T4: justificativa apagada, anexo na fila';

  if exists (select 1 from public.consents where user_id = 'f7000000-0000-4000-8000-000000000001')
     or not exists (select 1 from public.attendance where user_id = 'f7000000-0000-4000-8000-000000000001')
     or not exists (select 1 from public.attendance_monthly where user_id = 'f7000000-0000-4000-8000-000000000001') then
    raise exception 'FALHOU T5: consentimentos ficaram ou presenças sumiram';
  end if;
  raise notice 'OK T5: consentimentos apagados, presenças e frequência mantidas';

  if not exists (select 1 from public.audit_log
                  where entity = 'profiles' and entity_id = 'f7000000-0000-4000-8000-000000000001'
                    and actor_id = 'f7000000-0000-4000-8000-000000000001'
                    and changes->'lgpd_exclusao'->>'origem' = 'titular') then
    raise exception 'FALHOU T1b: auditoria sem quem pediu';
  end if;
  raise notice 'OK T1b: auditoria registra a origem';
end $$;

-- T6 — segunda chamada é segura
do $$
declare
  r jsonb;
  antes integer;
  depois integer;
begin
  select count(*) into antes from public.media_deletion_queue;
  r := public.anonimizar_titular('f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000005');
  select count(*) into depois from public.media_deletion_queue;
  if not (r->>'ja_anonimizado')::boolean or antes <> depois then
    raise exception 'FALHOU T6: segunda chamada refez a exclusão (%)', r;
  end if;
  raise notice 'OK T6: idempotente';
end $$;

-- T7 — administrador precisa ser rebaixado antes
do $$
begin
  begin
    perform public.anonimizar_titular('f7000000-0000-4000-8000-000000000005','f7000000-0000-4000-8000-000000000005');
    raise exception 'FALHOU T7: admin foi anonimizado';
  exception when insufficient_privilege then
    raise notice 'OK T7: admin recusado';
  end;
end $$;

-- T9 — professor sai só das aulas futuras e mantém a cor
do $$
declare
  r jsonb;
begin
  r := public.anonimizar_titular('f7000000-0000-4000-8000-000000000004','f7000000-0000-4000-8000-000000000005');
  if (r->>'aulas_futuras')::int <> 1
     or not exists (select 1 from public.class_teachers
                     where class_id = 'f7000000-0000-4000-8000-00000000c001' and teacher_id = 'f7000000-0000-4000-8000-000000000004')
     or exists (select 1 from public.class_teachers
                 where class_id = 'f7000000-0000-4000-8000-00000000c002' and teacher_id = 'f7000000-0000-4000-8000-000000000004')
     or not exists (select 1 from public.profiles where id = 'f7000000-0000-4000-8000-000000000004' and color = '#123456') then
    raise exception 'FALHOU T9: professor (%)', r;
  end if;
  raise notice 'OK T9: professor sai das aulas futuras, mantém passadas e cor';
end $$;

-- T12d — e-mail em uso: outra conta sim, a própria não, sem diferença de caixa
do $$
begin
  if not public.email_ja_cadastrado(' LGPD-A2@t.invalid', 'f7000000-0000-4000-8000-000000000003')
     or public.email_ja_cadastrado('lgpd-a2@t.invalid', 'f7000000-0000-4000-8000-000000000002')
     or public.email_ja_cadastrado('ninguem@t.invalid', 'f7000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU T12d: conferência de e-mail em uso';
  end if;
  raise notice 'OK T12d: e-mail em uso conferido';
end $$;

-- T15 — perfil inexistente
do $$
begin
  begin
    perform public.anonimizar_titular('f7000000-0000-4000-8000-0000000000ff','f7000000-0000-4000-8000-000000000005');
    raise exception 'FALHOU T15: perfil inexistente aceito';
  exception when no_data_found then
    raise notice 'OK T15: perfil inexistente recusado';
  end;
end $$;

-- =====================================================================
-- Prazo de guarda dos comprovantes (P-11)
-- =====================================================================
insert into public.payments (id, user_id, amount_cents, due_date, reference_month, status, paid_at,
                             proof_provider, proof_public_id) values
  ('f7000000-0000-4000-8000-00000000d101','f7000000-0000-4000-8000-000000000002',10000, date '2031-01-10', date '2031-01-01','paid', now() - interval '100 days',
   'cloudinary','comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d101'),
  ('f7000000-0000-4000-8000-00000000d102','f7000000-0000-4000-8000-000000000002',10000, date '2031-02-10', date '2031-02-01','paid', now() - interval '10 days',
   'cloudinary','comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d102'),
  ('f7000000-0000-4000-8000-00000000d103','f7000000-0000-4000-8000-000000000002',10000, date '2031-03-10', date '2031-03-01','pending_approval', null,
   'cloudinary','comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d103');

-- R1 — desligado (prazo nulo) não faz nada
do $$
begin
  if public.enfileirar_comprovantes_expirados() <> 0
     or exists (select 1 from public.media_deletion_queue where asset_ref like 'comprovantes/f7000000-0000-4000-8000-000000000002/%' and motivo = 'retencao_expirada') then
    raise exception 'FALHOU R1: com o prazo desligado, algo foi enfileirado';
  end if;
  raise notice 'OK R1: desligado por padrão';
end $$;
reset role;

update public.academy_settings set proof_retention_days = 90;

-- R2 — só o pago antigo entra; recente e pendente ficam; sem duplicata
set local role service_role;
do $$
declare
  n integer;
begin
  n := public.enfileirar_comprovantes_expirados();
  if n <> 1
     or not exists (select 1 from public.media_deletion_queue where asset_ref = 'comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d101' and motivo = 'retencao_expirada')
     or exists (select 1 from public.media_deletion_queue where asset_ref in ('comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d102', 'comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d103'))
     or exists (select 1 from public.payments where id = 'f7000000-0000-4000-8000-00000000d101' and proof_provider is not null)
     or not exists (select 1 from public.payments where id = 'f7000000-0000-4000-8000-00000000d102' and proof_provider is not null) then
    raise exception 'FALHOU R2: varredura errada (enfileirados: %)', n;
  end if;
  select count(*) into n from public.media_deletion_queue where asset_ref = 'comprovantes/f7000000-0000-4000-8000-000000000002/f7000000-0000-4000-8000-00000000d101';
  if n <> 1 then
    raise exception 'FALHOU R2: % itens para o mesmo arquivo', n;
  end if;
  raise notice 'OK R2: só o pago antigo, uma vez';
end $$;

-- R3 — prazo abaixo de 30 dias é recusado
reset role;
do $$
begin
  begin
    update public.academy_settings set proof_retention_days = 7;
    raise exception 'FALHOU R3: prazo de 7 dias aceito';
  exception when check_violation then
    raise notice 'OK R3: prazo mínimo de 30 dias';
  end;
end $$;

rollback;
