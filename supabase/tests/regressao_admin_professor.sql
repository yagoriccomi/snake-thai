-- Regressão do bloco 4.2 — admin é professor (migration 20260929100000,
-- contrato v4 § 4 e T24). Roda numa transação e termina em ROLLBACK; mesmo
-- assim, rode SÓ no banco local (scripts\db-dev test).
--
--   ADM  admin com cor (dá aula)         ADM0 admin sem cor
--   PROF professor                       ALU  aluno fixo sem plano
--   ALV  aluno com plano livre           ALX  outro aluno
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa (como sistema)
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d4200000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'adm-prof-' || n || '@t.invalid', 'x', now(), now(), now()
  from unnest(array['01','02','03','04','05','06']) as n;

insert into public.plans (id, name, price_cents, schedule_mode, weekly_quota) values
  ('d4200000-0000-4000-8000-00000000a001', 'Livre 3x (4.2)', 10000, 'free', 3);

insert into public.groups (id, name) values ('adm-prof', 'Turma 4.2');

insert into public.profiles (id, role, name, cpf, is_first_login, status, color, group_id, plan_id) values
  ('d4200000-0000-4000-8000-000000000001','admin','Admin Com Cor','42000000001',false,'active','#FB923C',null,null),
  ('d4200000-0000-4000-8000-000000000002','admin','Admin Sem Cor','42000000002',false,'active',null,null,null),
  ('d4200000-0000-4000-8000-000000000003','professor','Prof 4.2','42000000003',false,'active','#38BDF8',null,null),
  ('d4200000-0000-4000-8000-000000000004','user','Aluno Fixo','42000000004',false,'active',null,'adm-prof',null),
  ('d4200000-0000-4000-8000-000000000005','user','Aluno Livre','42000000005',false,'active',null,null,'d4200000-0000-4000-8000-00000000a001'),
  ('d4200000-0000-4000-8000-000000000006','user','Aluno Outro','42000000006',false,'active',null,null,null);

-- O admin que dá aula precisa de aparelho: sem ele, a fila não grava o aviso.
insert into public.push_devices (user_id, expo_token, platform, app_variant) values
  ('d4200000-0000-4000-8000-000000000001', 'ExponentPushToken[adm42]', 'android', 'production'),
  ('d4200000-0000-4000-8000-000000000002', 'ExponentPushToken[adm042]', 'android', 'production'),
  ('d4200000-0000-4000-8000-000000000003', 'ExponentPushToken[prof42]', 'android', 'production');

insert into public.classes (id, title, type, date_time, group_id) values
  ('d4200000-0000-4000-8000-00000000c001', 'Aula futura 4.2', 'routine', now() + interval '2 days', 'adm-prof'),
  ('d4200000-0000-4000-8000-00000000c002', 'Aula de 2030 (sem chamada)', 'routine', timestamptz '2030-03-10 18:00-03', 'adm-prof'),
  ('d4200000-0000-4000-8000-00000000c003', 'Aula para justificar', 'routine', timestamptz '2030-03-20 18:00-03', 'adm-prof');

-- =====================================================================
-- A1 — cor por papel: admin pode ter cor; aluno nunca; professor sempre
-- =====================================================================
do $$
begin
  begin
    update public.profiles set color = '#FF00FF' where id = 'd4200000-0000-4000-8000-000000000006';
    raise exception 'FALHOU A1: aluno ficou com cor';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set color = null where id = 'd4200000-0000-4000-8000-000000000003';
    raise exception 'FALHOU A1: professor ficou sem cor';
  exception when check_violation then null;
  end;
  if (select color from public.profiles where id = 'd4200000-0000-4000-8000-000000000001') <> '#FB923C' then
    raise exception 'FALHOU A1: admin não guardou a cor';
  end if;
  raise notice 'OK A1: admin tem cor opcional; aluno nunca; professor sempre';
end $$;

-- =====================================================================
-- A2 — admin com cor entra e sai da aula
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.class_teachers (class_id, teacher_id)
values ('d4200000-0000-4000-8000-00000000c001', 'd4200000-0000-4000-8000-000000000001');

do $$
begin
  if not exists (select 1 from public.class_teachers
                  where class_id = 'd4200000-0000-4000-8000-00000000c001'
                    and teacher_id = 'd4200000-0000-4000-8000-000000000001') then
    raise exception 'FALHOU A2: admin com cor não entrou na aula';
  end if;
  raise notice 'OK A2: admin com cor entra na aula';
end $$;

-- =====================================================================
-- A3 — admin sem cor não entra (T24), com a mensagem que o app mostra
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  begin
    insert into public.class_teachers (class_id, teacher_id)
    values ('d4200000-0000-4000-8000-00000000c001', 'd4200000-0000-4000-8000-000000000002');
    raise exception 'FALHOU A3: admin sem cor entrou na aula';
  exception when check_violation then
    if sqlerrm <> 'Escolha a sua cor antes de entrar na aula.' then
      raise exception 'FALHOU A3: mensagem inesperada: %', sqlerrm;
    end if;
  end;
  raise notice 'OK A3: admin sem cor é recusado com "Escolha a sua cor antes de entrar na aula."';
end $$;

-- =====================================================================
-- A4 — aluno continua fora da equipe da aula, mesmo pelo admin
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    insert into public.class_teachers (class_id, teacher_id)
    values ('d4200000-0000-4000-8000-00000000c001', 'd4200000-0000-4000-8000-000000000004');
    raise exception 'FALHOU A4: aluno virou professor da aula';
  exception when check_violation then null;
  end;
  raise notice 'OK A4: aluno não entra como professor';
end $$;

-- =====================================================================
-- A5 — admin escalado em aula futura não apaga a cor; fora dela, apaga
-- =====================================================================
do $$
begin
  begin
    update public.profiles set color = null where id = 'd4200000-0000-4000-8000-000000000001';
    raise exception 'FALHOU A5: admin escalado apagou a cor';
  exception when check_violation then null;
  end;

  delete from public.class_teachers
   where class_id = 'd4200000-0000-4000-8000-00000000c001'
     and teacher_id = 'd4200000-0000-4000-8000-000000000001';
  update public.profiles set color = null where id = 'd4200000-0000-4000-8000-000000000001';
  if (select color from public.profiles where id = 'd4200000-0000-4000-8000-000000000001') is not null then
    raise exception 'FALHOU A5: admin fora das aulas não apagou a cor';
  end if;
  update public.profiles set color = '#FB923C' where id = 'd4200000-0000-4000-8000-000000000001';
  raise notice 'OK A5: admin sai da aula antes de apagar a cor';
end $$;

-- =====================================================================
-- A6 — promover mantém a cor, mesmo com color: null (APK 1.8)
-- =====================================================================
do $$
begin
  update public.profiles set role = 'admin', color = null where id = 'd4200000-0000-4000-8000-000000000003';
  if (select color from public.profiles where id = 'd4200000-0000-4000-8000-000000000003') is distinct from '#38BDF8' then
    raise exception 'FALHOU A6: a promoção apagou a cor';
  end if;
  update public.profiles set role = 'professor' where id = 'd4200000-0000-4000-8000-000000000003';
  raise notice 'OK A6: promover professor a admin mantém a cor';
end $$;

-- =====================================================================
-- A7 — grade: admin com cor é escalado e copiado para as aulas geradas;
--      admin sem cor é recusado
-- =====================================================================
do $$
declare
  v_resultado jsonb;
  v_horario uuid;
begin
  v_resultado := public.salvar_horario_da_grade(
    'adm-prof', 'Treino 4.2',
    extract(dow from (now() at time zone 'America/Sao_Paulo') + interval '3 days')::smallint,
    time '20:00', (now() at time zone 'America/Sao_Paulo')::date,
    array['d4200000-0000-4000-8000-000000000001', 'd4200000-0000-4000-8000-000000000003']::uuid[]);
  v_horario := (v_resultado ->> 'schedule_id')::uuid;

  if (select count(*) from public.class_schedule_teachers where schedule_id = v_horario) <> 2 then
    raise exception 'FALHOU A7: a grade não guardou os dois professores';
  end if;
  if not exists (
    select 1 from public.class_teachers ct join public.classes c on c.id = ct.class_id
     where c.schedule_id = v_horario and ct.teacher_id = 'd4200000-0000-4000-8000-000000000001'
  ) then
    raise exception 'FALHOU A7: o admin não foi copiado para as aulas geradas';
  end if;

  begin
    perform public.salvar_horario_da_grade(
      'adm-prof', 'Treino sem cor',
      extract(dow from (now() at time zone 'America/Sao_Paulo') + interval '4 days')::smallint,
      time '21:00', (now() at time zone 'America/Sao_Paulo')::date,
      array['d4200000-0000-4000-8000-000000000002']::uuid[]);
    raise exception 'FALHOU A7: admin sem cor foi escalado na grade';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'OK A7: admin com cor na grade e nas aulas geradas; sem cor, recusado';
end $$;

-- =====================================================================
-- A8 — diretório: o aluno vê o admin com cor e não vê o admin sem cor
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000004","role":"authenticated"}';
do $$
begin
  if not exists (select 1 from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000001' and color = '#FB923C') then
    raise exception 'FALHOU A8: aluno não vê o admin que dá aula';
  end if;
  if exists (select 1 from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU A8: aluno vê o admin sem cor';
  end if;
  if exists (select 1 from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000006') then
    raise exception 'FALHOU A8: aluno vê outro aluno';
  end if;
  raise notice 'OK A8: aluno vê o admin com cor, não o admin sem cor nem outro aluno';
end $$;

-- =====================================================================
-- A9 — diretório: a equipe vê os alunos com schedule_mode; a equipe vem com nulo
-- =====================================================================
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
begin
  if (select schedule_mode from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000004') is distinct from 'fixed' then
    raise exception 'FALHOU A9: aluno sem plano deveria vir fixed';
  end if;
  if (select schedule_mode from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000005') is distinct from 'free' then
    raise exception 'FALHOU A9: aluno do plano livre deveria vir free';
  end if;
  if (select schedule_mode from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000001') is not null then
    raise exception 'FALHOU A9: a equipe deveria vir com schedule_mode nulo';
  end if;
  raise notice 'OK A9: schedule_mode pelo plano atual (fixed sem plano) e nulo para a equipe';
end $$;

-- O admin sem cor também vê os alunos (is_staff), como o professor.
set local request.jwt.claims = '{"sub":"d4200000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if not exists (select 1 from public.diretorio_perfis where id = 'd4200000-0000-4000-8000-000000000005') then
    raise exception 'FALHOU A9: admin não vê o aluno';
  end if;
  raise notice 'OK A9b: admin vê os alunos pelo diretório';
end $$;

-- =====================================================================
-- A10 — is_staff: verdadeiro para o admin (com e sem cor)
-- =====================================================================
do $$
begin
  if not public.is_staff() then
    raise exception 'FALHOU A10: is_staff falso para admin';
  end if;
  raise notice 'OK A10: is_staff verdadeiro para admin';
end $$;

-- =====================================================================
-- A11 — anon não lê o diretório
-- =====================================================================
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  begin
    perform 1 from public.diretorio_perfis limit 1;
    raise exception 'FALHOU A11: anon leu o diretório';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK A11: anon recebe 42501 no diretório';
end $$;

-- =====================================================================
-- A12 — avisos de professor da aula chegam ao admin escalado
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';

insert into public.class_teachers (class_id, teacher_id) values
  ('d4200000-0000-4000-8000-00000000c002', 'd4200000-0000-4000-8000-000000000001'),
  ('d4200000-0000-4000-8000-00000000c003', 'd4200000-0000-4000-8000-000000000001');

insert into public.absence_justifications (id, class_id, user_id, message) values
  ('d4200000-0000-4000-8000-00000000e001', 'd4200000-0000-4000-8000-00000000c003', 'd4200000-0000-4000-8000-000000000004', 'Médico');

do $$
begin
  if not exists (select 1 from public.notification_outbox
                  where justification_id = 'd4200000-0000-4000-8000-00000000e001'
                    and recipient_id = 'd4200000-0000-4000-8000-000000000001') then
    raise exception 'FALHOU A12: a justificativa não avisou o admin da aula';
  end if;
  if exists (select 1 from public.notification_outbox
              where justification_id = 'd4200000-0000-4000-8000-00000000e001'
                and recipient_id = 'd4200000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU A12: com equipe na aula, outro admin foi avisado';
  end if;
  raise notice 'OK A12: justificativa avisa o admin que é da aula, e só ele';
end $$;

-- =====================================================================
-- A13 — aula sem chamada avisa o admin escalado
-- =====================================================================
do $$
begin
  perform public.enfileirar_avisos_aula_sem_chamada(timestamptz '2030-03-10 19:10-03');
  if not exists (select 1 from public.notification_outbox
                  where kind = 'aula_sem_chamada'
                    and class_id = 'd4200000-0000-4000-8000-00000000c002'
                    and recipient_id = 'd4200000-0000-4000-8000-000000000001') then
    raise exception 'FALHOU A13: o admin da aula não recebeu o aviso de chamada pendente';
  end if;
  raise notice 'OK A13: aula sem chamada avisa o admin escalado';
end $$;

rollback;
