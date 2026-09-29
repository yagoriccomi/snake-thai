-- Regressão das solicitações (bloco 4.9a, migration 20260929180000_solicitacoes;
-- contrato § 9.3, § 10). Roda numa transação e termina em ROLLBACK; mesmo
-- assim, rode SÓ no banco local.
--
-- F fixo da turma G (aula C há 2 dias, chamada feita, F ausente) · P professor
-- de C (presente) · P2 professor de fora · A admin (também em C, com cor)
\set ON_ERROR_STOP on

begin;

insert into public.groups (id, name) values ('s9-g', 'S9 Turma G');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('d9000000-0000-4000-8000-00000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 's9-' || n || '@t.invalid', 'x', now(), now(), now()
  from generate_series(1, 5) as n;

insert into public.profiles (id, role, name, cpf, is_first_login, status, group_id, color, created_at) values
  ('d9000000-0000-4000-8000-000000000001', 'admin', 'S9 Admin', '69900000001', false, 'active', null, '#101010', now() - interval '60 days'),
  ('d9000000-0000-4000-8000-000000000002', 'professor', 'S9 Prof P', '69900000002', false, 'active', null, '#202020', now() - interval '60 days'),
  ('d9000000-0000-4000-8000-000000000003', 'professor', 'S9 Prof P2', '69900000003', false, 'active', null, '#303030', now() - interval '60 days'),
  ('d9000000-0000-4000-8000-000000000004', 'user', 'S9 Aluno F', '69900000004', false, 'active', 's9-g', null, now() - interval '60 days');

insert into public.classes (id, title, type, group_id, date_time, audience, attendance_taken_at) values
  ('d9c00000-0000-4000-8000-000000000001', 'S9 Aula C', 'routine', 's9-g', now() - interval '2 days', 'both', now() - interval '2 days'),
  ('d9c00000-0000-4000-8000-000000000002', 'S9 Aula antiga', 'routine', 's9-g', now() - interval '10 days', 'both', now() - interval '10 days');
insert into public.class_teachers (class_id, teacher_id) values
  ('d9c00000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000002'),
  ('d9c00000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001'),
  ('d9c00000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000002');
insert into public.class_teacher_presence (class_id, teacher_id, present, set_by) values
  ('d9c00000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000002', true, 'd9000000-0000-4000-8000-000000000002'),
  ('d9c00000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001', false, 'd9000000-0000-4000-8000-000000000002');
insert into public.attendance (class_id, user_id, status) values
  ('d9c00000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000004', 'absent');

insert into public.push_devices (user_id, expo_token, platform, app_variant)
select p.id, 'ExponentPushToken[s9-' || p.id::text || ']', 'android', 'production'
  from public.profiles p where p.id::text like 'd9000000%';

create temp table ctx (chave text primary key, id uuid) on commit drop;
grant select, insert on ctx to authenticated, anon;

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- =====================================================================
-- S1–S2 — abrir
-- =====================================================================
set local role authenticated;

do $$
declare
  C constant uuid := 'd9c00000-0000-4000-8000-000000000001';
  v uuid;
begin
  -- Aluno: "Eu estava na aula".
  perform pg_temp.como('d9000000-0000-4000-8000-000000000004');
  begin
    perform public.abrir_solicitacao('student_was_present', C, gen_random_uuid());
    raise exception 'FALHOU S1: abriu sem motivo';
  exception when invalid_parameter_value then null;
  end;
  v := public.abrir_solicitacao('student_was_present', C, public.criar_motivo('request_evidence', C, 'Cheguei atrasado, mas fiquei.'));
  insert into ctx values ('aluno', v);
  begin
    perform public.abrir_solicitacao('student_was_present', C, public.criar_motivo('request_evidence', C, 'De novo'));
    raise exception 'FALHOU S1: duas vezes';
  exception when check_violation then null;
  end;
  begin
    perform public.abrir_solicitacao('student_was_present', 'd9c00000-0000-4000-8000-000000000002',
      public.criar_motivo('request_evidence', 'd9c00000-0000-4000-8000-000000000002', 'Atrasado'));
    raise exception 'FALHOU S1: fora do prazo';
  exception when check_violation then null;
  end;
  begin
    perform public.abrir_solicitacao('teacher_absence', C, public.criar_motivo('request_evidence', C, 'x'));
    raise exception 'FALHOU S1: aluno fez pedido de professor';
  exception when insufficient_privilege then null;
  end;

  -- P2, de fora: me incluir. P, escalado: justificar ausência, mas não "corrigir de outro".
  perform pg_temp.como('d9000000-0000-4000-8000-000000000003');
  insert into ctx values ('inclusao', public.abrir_solicitacao('teacher_asks_inclusion', C,
    public.criar_motivo('request_evidence', C, 'Dei a aula no lugar do P.')));
  begin
    perform public.abrir_solicitacao('teacher_absence', C, public.criar_motivo('request_evidence', C, 'x'));
    raise exception 'FALHOU S2: ausência de quem não está escalado';
  exception when check_violation then null;
  end;

  perform pg_temp.como('d9000000-0000-4000-8000-000000000002');
  insert into ctx values ('ausencia', public.abrir_solicitacao('teacher_absence', C,
    public.criar_motivo('request_evidence', C, 'Consulta médica.')));
  begin
    perform public.abrir_solicitacao('teacher_asks_edit', C, public.criar_motivo('request_evidence', C, 'x'));
    raise exception 'FALHOU S2: escalado pediu para corrigir de outro';
  exception when check_violation then null;
  end;
  begin
    perform public.abrir_solicitacao('teacher_was_present', C, public.criar_motivo('request_evidence', C, 'x'));
    raise exception 'FALHOU S2: presente pediu "eu estava"';
  exception when check_violation then null;
  end;

  -- A, admin marcado ausente: "eu estava na aula".
  perform pg_temp.como('d9000000-0000-4000-8000-000000000001');
  insert into ctx values ('admin', public.abrir_solicitacao('teacher_was_present', C,
    public.criar_motivo('request_evidence', C, 'Estava no tatame.')));
  raise notice 'OK S1–S2: abre com motivo, no prazo, uma vez, e só com os requisitos de cada tipo';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  if not exists (select 1 from public.notification_outbox
                  where recipient_id = 'd9000000-0000-4000-8000-000000000002'
                    and dedupe_key = 'solicitacao_pendente:' || (select id from ctx where chave = 'aluno'))
     or not exists (select 1 from public.notification_outbox
                     where recipient_id = 'd9000000-0000-4000-8000-000000000001'
                       and dedupe_key = 'solicitacao_pendente:' || (select id from ctx where chave = 'inclusao'))
     or exists (select 1 from public.notification_outbox
                 where recipient_id = 'd9000000-0000-4000-8000-000000000001'
                   and dedupe_key = 'solicitacao_pendente:' || (select id from ctx where chave = 'admin')) then
    raise exception 'FALHOU S3: destinatários do aviso';
  end if;
  if exists (select 1 from public.action_reasons where kind = 'request_evidence' and class_id = 'd9c00000-0000-4000-8000-000000000001'
              and used_at is null and body <> 'x' and body <> 'De novo') then
    raise exception 'FALHOU S3: motivo aceito sem used_at';
  end if;
  raise notice 'OK S3: o aviso vai a quem decide (a equipe no do aluno; os admins nos de professor, sem quem pediu)';
end $$;

-- =====================================================================
-- S4 — quem vê e quem decide
-- =====================================================================
set local role authenticated;

do $$
declare
  v_aluno uuid := (select id from ctx where chave = 'aluno');
  v_incl  uuid := (select id from ctx where chave = 'inclusao');
  v_adm   uuid := (select id from ctx where chave = 'admin');
  n int;
begin
  perform pg_temp.como('d9000000-0000-4000-8000-000000000002');
  if not public.pode_decidir_solicitacao(v_aluno) or public.pode_decidir_solicitacao(v_incl) then
    raise exception 'FALHOU S4: professor da aula decide só o do aluno';
  end if;
  select count(*) into n from public.caixa_de_solicitacoes();
  if n <> 3 then
    raise exception 'FALHOU S4: professor vê % categorias', n;
  end if;
  if (select quantidade from public.caixa_de_solicitacoes() where categoria = 'retificacao_de_chamadas') <> 1 then
    raise exception 'FALHOU S4: contagem da retificação do professor';
  end if;
  if (select texto from public.solicitacao_para_decidir(v_aluno)) <> 'Cheguei atrasado, mas fiquei.' then
    raise exception 'FALHOU S4: texto para decidir';
  end if;
  begin
    perform public.itens_da_solicitacao('faltas_de_professores');
    raise exception 'FALHOU S4: professor viu faltas de professores';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('d9000000-0000-4000-8000-000000000003');
  begin
    perform * from public.solicitacao_para_decidir(v_aluno);
    raise exception 'FALHOU S4: professor de fora leu o pedido';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.como('d9000000-0000-4000-8000-000000000004');
  begin
    perform * from public.caixa_de_solicitacoes();
    raise exception 'FALHOU S4: aluno abriu a caixa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.roll_call_requests;
    raise exception 'FALHOU S4: leitura direta da tabela';
  exception when insufficient_privilege then null;
  end;

  -- Ninguém decide o próprio pedido, nem o admin.
  perform pg_temp.como('d9000000-0000-4000-8000-000000000001');
  if public.pode_decidir_solicitacao(v_adm) then
    raise exception 'FALHOU S4: admin decide o próprio pedido';
  end if;
  begin
    perform public.decidir_solicitacao(v_adm, 'approved', 'ok');
    raise exception 'FALHOU S4: admin decidiu o próprio pedido';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.caixa_de_solicitacoes()) <> 5 then
    raise exception 'FALHOU S4: admin vê as 5 categorias';
  end if;
  raise notice 'OK S4: cada um vê e decide só o que pode; a tabela só pelas RPCs';
end $$;

-- =====================================================================
-- S5–S7 — decidir e os efeitos
-- =====================================================================
do $$
declare
  C constant uuid := 'd9c00000-0000-4000-8000-000000000001';
  v_aluno uuid := (select id from ctx where chave = 'aluno');
  v_incl  uuid := (select id from ctx where chave = 'inclusao');
  v_aus   uuid := (select id from ctx where chave = 'ausencia');
  v_linha record;
begin
  perform pg_temp.como('d9000000-0000-4000-8000-000000000002');
  begin
    perform public.decidir_solicitacao(v_aluno, 'approved', '  ');
    raise exception 'FALHOU S5: aprovou sem nota';
  exception when invalid_parameter_value then null;
  end;
  perform public.decidir_solicitacao(v_aluno, 'approved', 'Vi o aluno no treino.');
  begin
    perform public.decidir_solicitacao(v_aluno, 'rejected', 'x');
    raise exception 'FALHOU S5: decidiu duas vezes';
  exception when check_violation then null;
  end;

  perform pg_temp.como('d9000000-0000-4000-8000-000000000004');
  select * into v_linha from public.minhas_solicitacoes() where id = v_aluno;
  if v_linha.status <> 'approved' or v_linha.approved_by_name <> 'S9 Prof P' then
    raise exception 'FALHOU S6: minhas_solicitacoes';
  end if;

  perform pg_temp.como('d9000000-0000-4000-8000-000000000001');
  if not exists (select 1 from public.itens_da_solicitacao('retificacao_de_chamadas') where tipo = 'retificacao_feita')
     or not exists (select 1 from public.itens_da_solicitacao('retificacao_de_chamadas') where tipo = 'solicitacao' and id = v_incl) then
    raise exception 'FALHOU S7: itens da retificação do admin';
  end if;
  perform public.decidir_solicitacao(v_incl, 'approved', 'Confirmado pela recepção.');
  perform public.decidir_solicitacao(v_aus, 'rejected', 'Sem atestado.');

  perform pg_temp.como('d9000000-0000-4000-8000-000000000002');
  select * into v_linha from public.minhas_solicitacoes() where id = v_aus;
  if v_linha.status <> 'rejected' or v_linha.approved_by_name is not null then
    raise exception 'FALHOU S7: a negada mostra quem negou';
  end if;
  raise notice 'OK S5–S7: nota obrigatória, uma decisão só, e quem negou não aparece';
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  C constant uuid := 'd9c00000-0000-4000-8000-000000000001';
  v_att record;
begin
  select a.status, a.edited, u.edit_reason_id, u.previous_status, u.edited_by into v_att
    from public.attendance a join public.attendance_audit u on u.attendance_id = a.id
   where a.class_id = C and a.user_id = 'd9000000-0000-4000-8000-000000000004';
  if v_att.status <> 'present' or not v_att.edited or v_att.previous_status <> 'absent'
     or v_att.edited_by <> 'd9000000-0000-4000-8000-000000000002'
     or not exists (select 1 from public.action_reasons r where r.id = v_att.edit_reason_id
                     and r.kind = 'roll_call_edit' and r.body = 'Vi o aluno no treino.' and r.used_at is not null) then
    raise exception 'FALHOU S8: retificação da presença do aluno';
  end if;
  if not exists (select 1 from public.notification_outbox where recipient_id = 'd9000000-0000-4000-8000-000000000004'
                  and kind = 'chamada_retificada') then
    raise exception 'FALHOU S8: aviso da retificação ao aluno';
  end if;
  if not exists (select 1 from public.class_teacher_presence where class_id = C
                  and teacher_id = 'd9000000-0000-4000-8000-000000000003' and present and added_in_roll_call) then
    raise exception 'FALHOU S9: inclusão do professor';
  end if;
  if (select count(*) from public.roll_call_requests where class_id = C and review_note is not null) <> 3 then
    raise exception 'FALHOU S9: notas gravadas';
  end if;
  raise notice 'OK S8–S9: a aprovação retifica o aluno (com motivo e aviso) e inclui o professor';
end $$;

set local role authenticated;

do $$
begin
  perform pg_temp.como('d9000000-0000-4000-8000-000000000001');
  if (select count(*) from public.solicitacoes_decididas(current_date - 1, current_date)
       where class_id = 'd9c00000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'FALHOU S10: decididas do admin';
  end if;
  perform pg_temp.como('d9000000-0000-4000-8000-000000000002');
  begin
    perform * from public.solicitacoes_decididas(current_date - 1, current_date);
    raise exception 'FALHOU S10: professor viu as decididas';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK S10: só o admin vê as decididas, com quem decidiu e a nota';
end $$;

rollback;
