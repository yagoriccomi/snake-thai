-- Regressão dos dados dos termos (migration 20260918210000_dados_dos_termos):
-- o admin preenche, o banco monta o texto e publica. Roda numa transação e
-- termina em ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('da000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','termos-adm@t.invalid','x',now(),now(),now()),
  ('da000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','termos-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status) values
  ('da000000-0000-4000-8000-000000000001','admin','Admin Termos','77000000001',false,'active'),
  ('da000000-0000-4000-8000-000000000002','user','Aluno Termos','77000000002',false,'active');

-- Modelo curto e previsível para o ensaio (o real vem por migration própria).
insert into public.legal_templates (kind, body)
values ('terms_of_use', '# Termos' || chr(10) || chr(10) || 'Academia {{razao_social}}, CNPJ {{cnpj}}. Foro: {{foro}}.')
on conflict (kind) do update set body = excluded.body;

-- =====================================================================
-- T1 — aluno não lê nem escreve os dados dos termos
-- =====================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"da000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.legal_field_values) then
    raise exception 'FALHOU T1: aluno leu os valores';
  end if;
  if exists (select 1 from public.legal_templates) then
    raise exception 'FALHOU T1: aluno leu o modelo';
  end if;
  begin
    insert into public.legal_field_values (id, value) values ('cnpj', '00.000.000/0001-00');
    raise exception 'FALHOU T1: aluno gravou valor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.renderizar_documento_legal('terms_of_use');
    raise exception 'FALHOU T1: aluno renderizou o documento';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T1: aluno não alcança os dados dos termos';
end $$;

-- =====================================================================
-- T2 — valor não pode trazer marcador nem rascunho de volta
-- =====================================================================
set local request.jwt.claims = '{"sub":"da000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    insert into public.legal_field_values (id, value) values ('cnpj', 'CNPJ {{cnpj}}');
    raise exception 'FALHOU T2: valor com marcador aceito';
  exception when check_violation then null;
  end;
  begin
    insert into public.legal_field_values (id, value) values ('cnpj', '[PREENCHER: CNPJ]');
    raise exception 'FALHOU T2: valor com rascunho aceito';
  exception when check_violation then null;
  end;
  begin
    insert into public.legal_field_values (id, value) values ('cnpj', '   ');
    raise exception 'FALHOU T2: valor em branco aceito';
  exception when check_violation then null;
  end;
  raise notice 'OK T2: marcador, rascunho e branco recusados no valor';
end $$;

-- =====================================================================
-- T3 — faltando campo: a prévia diz o que falta e publicar é recusado
-- =====================================================================
insert into public.legal_field_values (id, value) values ('razao_social', 'Academia Cobra Tailandesa Ltda');

do $$
declare v record; v_antes integer;
begin
  select * into v from public.renderizar_documento_legal('terms_of_use');
  if not (v.faltando @> array['cnpj','foro'] and array_length(v.faltando,1) = 2) then
    raise exception 'FALHOU T3: faltando veio %', v.faltando;
  end if;
  if position('Academia Cobra Tailandesa Ltda' in v.conteudo) = 0 then
    raise exception 'FALHOU T3: o campo preenchido não entrou no texto';
  end if;
  if position('{{cnpj}}' in v.conteudo) = 0 then
    raise exception 'FALHOU T3: o marcador do campo vazio sumiu da prévia';
  end if;

  select count(*) into v_antes from public.legal_documents;
  begin
    perform public.publicar_documento_legal_do_modelo('terms_of_use', '1.0');
    raise exception 'FALHOU T3: publicou com campo faltando';
  exception when check_violation then null;
  end;
  if (select count(*) from public.legal_documents) <> v_antes then
    raise exception 'FALHOU T3: recusa deixou documento gravado';
  end if;
  raise notice 'OK T3: prévia aponta o que falta e publicar é recusado';
end $$;

-- =====================================================================
-- T4 — com tudo preenchido, publica o texto já montado
-- =====================================================================
insert into public.legal_field_values (id, value) values
  ('cnpj', '12.345.678/0001-90'),
  -- Valor com & e \1: regexp_replace estragaria o texto aqui.
  ('foro', 'São Paulo/SP & comarca \1');

do $$
declare v_id uuid; v_conteudo text;
begin
  v_id := public.publicar_documento_legal_do_modelo('terms_of_use', '1.0');
  select content into v_conteudo from public.legal_documents where id = v_id;
  if position('{{' in v_conteudo) > 0 then
    raise exception 'FALHOU T4: sobrou marcador no texto publicado';
  end if;
  if position('12.345.678/0001-90' in v_conteudo) = 0 then
    raise exception 'FALHOU T4: o CNPJ não entrou';
  end if;
  if position('São Paulo/SP & comarca \1' in v_conteudo) = 0 then
    raise exception 'FALHOU T4: valor com & e \1 saiu diferente do digitado';
  end if;
  raise notice 'OK T4: publica com os valores da academia, inclusive caracteres especiais';
end $$;

-- =====================================================================
-- T5 — mudar o valor depois NÃO reescreve o que já foi aceito
-- =====================================================================
do $$
declare v_conteudo text;
begin
  update public.legal_field_values set value = 'Outra Razão Social Ltda' where id = 'razao_social';
  select content into v_conteudo from public.legal_documents where kind = 'terms_of_use' and version = '1.0';
  if position('Academia Cobra Tailandesa Ltda' in v_conteudo) = 0 then
    raise exception 'FALHOU T5: o documento publicado mudou junto com o valor';
  end if;
  if position('Outra Razão Social' in v_conteudo) > 0 then
    raise exception 'FALHOU T5: valor novo vazou para o documento já aceito';
  end if;
  raise notice 'OK T5: documento publicado não muda quando o valor muda';
end $$;

-- =====================================================================
-- T6 — o admin não reescreve o modelo pelo app
-- =====================================================================
do $$
begin
  begin
    update public.legal_templates set body = 'Texto trocado por fora do PR' where kind = 'terms_of_use';
    if found then
      raise exception 'FALHOU T6: admin reescreveu o modelo';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.legal_templates (kind, body) values ('privacy_policy', 'Modelo direto');
    raise exception 'FALHOU T6: admin inseriu modelo';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK T6: o modelo só entra por migration';
end $$;

-- =====================================================================
-- T7 — contexto de migration (sem sessão) publica normalmente
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
do $$
declare v_id uuid;
begin
  v_id := public.publicar_documento_legal_do_modelo('terms_of_use', '1.1');
  if v_id is null then
    raise exception 'FALHOU T7: migration não conseguiu publicar';
  end if;
  if not exists (select 1 from public.legal_documents where id = v_id and is_current) then
    raise exception 'FALHOU T7: a versão publicada pela migration não ficou vigente';
  end if;
  raise notice 'OK T7: a migration publica sem sessão de usuário';
end $$;

rollback;
