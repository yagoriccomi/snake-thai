-- Regressão do papel professor: cria uma aula, se inclui na aula de outro
-- professor, gerencia alunos só das próprias aulas, e a cor é autoeditável.
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------
-- Massa de dados: 2 professores, 1 admin, 2 alunos, via service_role.
-- ---------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prof1@t.invalid','x',now(),now(),now()),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','prof2@t.invalid','x',now(),now(),now()),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@t.invalid','x',now(),now(),now()),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aluno1@t.invalid','x',now(),now(),now()),
  ('a0000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aluno2@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, color)
values
  ('a0000000-0000-4000-8000-000000000001','professor','Prof. Um','11111111111', false, '#FF0000'),
  ('a0000000-0000-4000-8000-000000000002','professor','Prof. Dois','22222222222', false, '#00FF00'),
  ('a0000000-0000-4000-8000-000000000003','admin','Admin','33333333333', false, null),
  ('a0000000-0000-4000-8000-000000000004','user','Aluno Um','44444444444', false, null),
  ('a0000000-0000-4000-8000-000000000005','user','Aluno Dois','55555555555', false, null);

insert into public.classes (id, title, type, date_time)
values ('c0000000-0000-4000-8000-000000000001', 'Aula do Prof 1', 'routine', now() + interval '1 day');
insert into public.class_teachers (class_id, teacher_id)
values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------
-- TESTE 1 — professor cria a própria aula e se inclui como professor
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.classes (id, title, type, date_time)
values ('c0000000-0000-4000-8000-000000000002', 'Aula do Prof 2', 'routine', now() + interval '2 day');
insert into public.class_teachers (class_id, teacher_id)
values ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002');

do $$
begin
  if not exists (select 1 from public.class_teachers
                 where class_id = 'c0000000-0000-4000-8000-000000000002'
                   and teacher_id = 'a0000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU T1: professor nao conseguiu criar e se vincular a propria aula';
  end if;
  raise notice 'OK T1: professor cria a propria aula e se inclui';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 2 — professor se inclui na aula de OUTRO professor
-- ---------------------------------------------------------------------
insert into public.class_teachers (class_id, teacher_id)
values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002');

do $$
begin
  if not exists (select 1 from public.class_teachers
                 where class_id = 'c0000000-0000-4000-8000-000000000001'
                   and teacher_id = 'a0000000-0000-4000-8000-000000000002') then
    raise exception 'FALHOU T2: professor nao conseguiu se incluir na aula de outro';
  end if;
  raise notice 'OK T2: professor se inclui na aula de outro professor';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 3 — professor NÃO pode incluir um TERCEIRO professor numa aula
-- ---------------------------------------------------------------------
do $$
begin
  begin
    insert into public.class_teachers (class_id, teacher_id)
    values ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001');
    raise exception 'FALHOU T3: professor conseguiu incluir OUTRO professor numa aula';
  exception when insufficient_privilege then
    raise notice 'OK T3: professor nao pode incluir terceiros, so a si mesmo';
  end;
end $$;

-- ---------------------------------------------------------------------
-- TESTE 4 — professor gerencia (insere presença) só nas SUAS aulas
-- ---------------------------------------------------------------------
insert into public.attendance (class_id, user_id, status)
values ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'present');

do $$
begin
  if not exists (select 1 from public.attendance
                 where class_id = 'c0000000-0000-4000-8000-000000000002'
                   and user_id = 'a0000000-0000-4000-8000-000000000004') then
    raise exception 'FALHOU T4: professor nao conseguiu adicionar aluno na propria aula';
  end if;
  raise notice 'OK T4: professor adiciona aluno na propria aula';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 5 — professor NÃO gerencia aula onde não é professor
-- ---------------------------------------------------------------------
insert into public.classes (id, title, type, date_time)
values ('c0000000-0000-4000-8000-000000000099', 'Aula sem este professor', 'routine', now() + interval '3 day');
-- (inserida pelo mesmo professor de propósito só para existir; agora ele
--  se remove para simular "aula onde ele nao e professor")
delete from public.class_teachers
 where class_id = 'c0000000-0000-4000-8000-000000000099'
   and teacher_id = 'a0000000-0000-4000-8000-000000000002';

do $$
begin
  begin
    insert into public.attendance (class_id, user_id, status)
    values ('c0000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000005', 'present');
    raise exception 'FALHOU T5: professor gerenciou aula onde nao e professor';
  exception when insufficient_privilege then
    raise notice 'OK T5: professor bloqueado fora das proprias aulas';
  end;
end $$;

-- ---------------------------------------------------------------------
-- TESTE 6 — professor edita a PRÓPRIA cor
-- ---------------------------------------------------------------------
update public.profiles set color = '#0000FF'
 where id = 'a0000000-0000-4000-8000-000000000002';

do $$
declare v_color text;
begin
  select color into v_color from public.profiles where id = 'a0000000-0000-4000-8000-000000000002';
  if v_color <> '#0000FF' then
    raise exception 'FALHOU T6: professor nao conseguiu editar a propria cor';
  end if;
  raise notice 'OK T6: professor edita a propria cor';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 7 — professor NÃO edita a cor de OUTRO professor
-- ---------------------------------------------------------------------
do $$
declare v_cor_depois text;
begin
  -- UPDATE sob RLS nao lanca excecao quando o USING exclui a linha: ele so
  -- afeta 0 linhas, silenciosamente. O teste certo e checar que NADA mudou.
  update public.profiles set color = '#000000'
   where id = 'a0000000-0000-4000-8000-000000000001';

  select color into v_cor_depois from public.profiles
   where id = 'a0000000-0000-4000-8000-000000000001';

  if v_cor_depois = '#000000' then
    raise exception 'FALHOU T7: professor alterou a cor de outro professor';
  end if;
  raise notice 'OK T7: professor nao altera cor alheia (0 linhas afetadas)';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 8 — professor NÃO edita/apaga a AULA em si (só admin)
-- ---------------------------------------------------------------------
do $$
declare v_titulo_depois text;
begin
  update public.classes set title = 'Hackeado' where id = 'c0000000-0000-4000-8000-000000000002';

  select title into v_titulo_depois from public.classes
   where id = 'c0000000-0000-4000-8000-000000000002';

  if v_titulo_depois = 'Hackeado' then
    raise exception 'FALHOU T8: professor editou a aula (deveria ser so admin)';
  end if;
  raise notice 'OK T8: edicao da aula em si continua exclusiva do admin (0 linhas afetadas)';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 9 — ADMIN põe qualquer professor, em qualquer quantidade, em
--           qualquer aula (inclusive uma que ele não criou)
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

insert into public.class_teachers (class_id, teacher_id)
values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')
on conflict do nothing;

do $$
declare v_total integer;
begin
  select count(*) into v_total from public.class_teachers
   where class_id = 'c0000000-0000-4000-8000-000000000001';
  if v_total < 2 then
    raise exception 'FALHOU T9: admin nao conseguiu por professor extra na aula';
  end if;
  raise notice 'OK T9: admin gerencia professores de qualquer aula livremente';
end $$;

-- ---------------------------------------------------------------------
-- TESTE 10 — vínculo exige que teacher_id seja de fato um professor
--            (mesmo o admin não pode vincular um ALUNO como professor)
-- ---------------------------------------------------------------------
do $$
begin
  begin
    insert into public.class_teachers (class_id, teacher_id)
    values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004');
    raise exception 'FALHOU T10: um ALUNO foi aceito como professor de uma aula';
  exception when check_violation then
    raise notice 'OK T10: so profile com role=professor pode ser vinculado como professor';
  end;
end $$;

-- ---------------------------------------------------------------------
-- TESTE 11 — constraint de cor: só professor tem cor
-- ---------------------------------------------------------------------
do $$
declare v_cor_aluno text;
begin
  -- Aqui quem executa e o ADMIN (bloco 9 mudou a sessao) — a RLS deixaria a
  -- linha passar; quem tem que barrar e a CHECK constraint (profiles_color_
  -- only_for_professor), que essa sim lanca excecao mesmo dentro do UPDATE,
  -- porque valida a linha resultante, nao a visibilidade dela.
  begin
    update public.profiles set color = '#ABCDEF'
     where id = 'a0000000-0000-4000-8000-000000000004';
    raise exception 'FALHOU T11: um ALUNO recebeu uma cor (deveria ser exclusivo de professor)';
  exception when check_violation then
    raise notice 'OK T11: cor continua exclusiva de professor (constraint)';
  end;
end $$;

rollback;
