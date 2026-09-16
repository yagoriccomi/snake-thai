-- Regressão dos documentos legais e do aceite (migration
-- 20260916223510_documentos_legais_aceite). Roda numa transação e termina em
-- ROLLBACK; mesmo assim, rode SÓ no banco local (scripts\db-dev test).
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('1e000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','legal-adm@t.invalid','x',now(),now(),now()),
  ('1e000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','legal-alu@t.invalid','x',now(),now(),now());

insert into public.profiles (id, role, name, cpf, is_first_login, status) values
  ('1e000000-0000-4000-8000-000000000001','admin','Admin Legal','14000000001',false,'active'),
  ('1e000000-0000-4000-8000-000000000002','user','Aluno Legal','14000000002',false,'active');

-- Estado conhecido: nenhum documento vigente (o banco de dev não publica nada).
create temp table legal_ids (nome text primary key, id uuid) on commit drop;
grant all on legal_ids to authenticated;

-- =====================================================================
-- D1 — sem documento publicado, nada fica pendente
-- =====================================================================
update public.legal_documents set is_current = false where is_current;

set local role authenticated;
set local request.jwt.claims = '{"sub":"1e000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if exists (select 1 from public.documentos_legais_pendentes()) then
    raise exception 'FALHOU D1: pendência sem documento vigente';
  end if;
  if exists (select 1 from public.documentos_legais_vigentes()) then
    raise exception 'FALHOU D1: vigente sem publicação';
  end if;
  raise notice 'OK D1: sem documento publicado, nada a aceitar';
end $$;

-- =====================================================================
-- D2 — aluno não publica nem escreve direto
-- =====================================================================
do $$
begin
  begin
    perform public.publicar_documento_legal('privacy_policy', '9.0', 'Texto do aluno');
    raise exception 'FALHOU D2: aluno publicou';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.legal_documents (kind, version, content) values ('privacy_policy', '9.1', 'Direto');
    raise exception 'FALHOU D2: aluno inseriu documento direto';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK D2: aluno não publica documento';
end $$;

-- =====================================================================
-- D3, D4 — admin publica; validações; escrita direta negada também ao admin
-- =====================================================================
set local request.jwt.claims = '{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare v_id uuid;
begin
  begin
    perform public.publicar_documento_legal('privacy_policy', '1.0', 'Controlador: [PREENCHER: razão social]');
    raise exception 'FALHOU D3: rascunho com placeholder publicado';
  exception when check_violation then null;
  end;
  begin
    perform public.publicar_documento_legal('privacy_policy', '  ', 'Texto');
    raise exception 'FALHOU D3: versão vazia aceita';
  exception when check_violation then null;
  end;
  begin
    perform public.publicar_documento_legal('privacy_policy', '1.0', '   ');
    raise exception 'FALHOU D3: texto vazio aceito';
  exception when check_violation then null;
  end;
  begin
    insert into public.legal_documents (kind, version, content) values ('privacy_policy', '9.2', 'Direto');
    raise exception 'FALHOU D3: admin inseriu direto, fora da função';
  exception when insufficient_privilege then null;
  end;

  v_id := public.publicar_documento_legal('privacy_policy', '2030.1', '# Política de teste' || chr(10) || 'Texto.');
  insert into legal_ids values ('politica_v1', v_id);
  v_id := public.publicar_documento_legal('terms_of_use', '2030.1', '# Termos de teste');
  insert into legal_ids values ('termos_v1', v_id);

  begin
    perform public.publicar_documento_legal('terms_of_use', '2030.1', '# Outro texto');
    raise exception 'FALHOU D4: versão repetida aceita';
  exception when unique_violation then null;
  end;
  raise notice 'OK D3/D4: admin publica; placeholder, vazio, repetido e escrita direta recusados';
end $$;

-- =====================================================================
-- D5, D6 — aluno vê pendência, aceita, e repetir não duplica
-- =====================================================================
set local request.jwt.claims = '{"sub":"1e000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare
  v_pendentes uuid[];
  v_registrados integer;
begin
  select array_agg(p.id order by p.tipo) into v_pendentes from public.documentos_legais_pendentes() p;
  if cardinality(v_pendentes) is distinct from 2 then
    raise exception 'FALHOU D5: esperava 2 pendentes, veio %', coalesce(cardinality(v_pendentes), 0);
  end if;

  begin
    insert into public.consents (user_id, document_id)
    values ('1e000000-0000-4000-8000-000000000002', v_pendentes[1]);
    raise exception 'FALHOU D5: aceite inserido direto, fora da função';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aceitar_documentos_legais('{}');
    raise exception 'FALHOU D5: aceite vazio';
  exception when check_violation then null;
  end;

  v_registrados := public.aceitar_documentos_legais(v_pendentes);
  if v_registrados <> 2 then
    raise exception 'FALHOU D5: registrou % aceites', v_registrados;
  end if;
  if exists (select 1 from public.documentos_legais_pendentes()) then
    raise exception 'FALHOU D5: pendência depois do aceite';
  end if;
  if exists (select 1 from public.documentos_legais_vigentes() v where v.aceito_em is null) then
    raise exception 'FALHOU D5: vigente sem data de aceite';
  end if;
  raise notice 'OK D5: aluno aceita pela função e a pendência some';

  v_registrados := public.aceitar_documentos_legais(v_pendentes || v_pendentes);
  if v_registrados <> 0 then
    raise exception 'FALHOU D6: aceite repetido registrou %', v_registrados;
  end if;
  raise notice 'OK D6: aceitar de novo não duplica';
end $$;

-- =====================================================================
-- D7 — versão nova volta a pedir aceite; aceitar a antiga é recusado
-- =====================================================================
set local request.jwt.claims = '{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  insert into legal_ids
  values ('politica_v2', public.publicar_documento_legal('privacy_policy', '2030.2', '# Política nova'));
end $$;

set local request.jwt.claims = '{"sub":"1e000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare
  v_antiga uuid := (select id from legal_ids where nome = 'politica_v1');
  v_nova uuid := (select id from legal_ids where nome = 'politica_v2');
begin
  if (select array_agg(p.id) from public.documentos_legais_pendentes() p) is distinct from array[v_nova] then
    raise exception 'FALHOU D7: a versão nova não ficou pendente sozinha';
  end if;
  begin
    perform public.aceitar_documentos_legais(array[v_antiga]);
    raise exception 'FALHOU D7: aceitou a versão que deixou de valer';
  exception when check_violation then null;
  end;
  begin
    perform public.aceitar_documentos_legais(array[v_nova, gen_random_uuid()]);
    raise exception 'FALHOU D7: aceitou documento inexistente';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.consents c where c.document_id = v_nova) then
    raise exception 'FALHOU D7: recusa deixou aceite parcial';
  end if;
  perform public.aceitar_documentos_legais(array[v_nova]);
  if exists (select 1 from public.documentos_legais_pendentes()) then
    raise exception 'FALHOU D7: nova versão ainda pendente depois do aceite';
  end if;
  raise notice 'OK D7: versão nova pede aceite; a antiga e a inexistente são recusadas sem aceite parcial';
end $$;

-- =====================================================================
-- D8 — documento publicado não muda, nem para o dono do banco
-- =====================================================================
reset role;
set local request.jwt.claims = '{}';
do $$
declare v_antiga uuid := (select id from legal_ids where nome = 'politica_v1');
begin
  begin
    update public.legal_documents set content = 'Texto trocado depois do aceite' where id = v_antiga;
    raise exception 'FALHOU D8: conteúdo publicado alterado';
  exception when check_violation then null;
  end;
  begin
    update public.legal_documents set version = '2030.9' where id = v_antiga;
    raise exception 'FALHOU D8: versão publicada alterada';
  exception when check_violation then null;
  end;
  -- Publicar pela migration (sem usuário na sessão) é permitido.
  perform public.publicar_documento_legal('terms_of_use', '2030.2', '# Termos pela migration');
  raise notice 'OK D8: documento publicado é imutável; a migration publica';
end $$;

-- =====================================================================
-- D9 — anon não chega a nenhuma função
-- =====================================================================
set local role anon;
do $$
begin
  begin
    perform public.documentos_legais_pendentes();
    raise exception 'FALHOU D9: anon listou pendências';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.documentos_legais_vigentes();
    raise exception 'FALHOU D9: anon leu os vigentes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aceitar_documentos_legais(array[gen_random_uuid()]);
    raise exception 'FALHOU D9: anon aceitou';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publicar_documento_legal('privacy_policy', '2030.8', 'x');
    raise exception 'FALHOU D9: anon publicou';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK D9: anon sem acesso às funções';
end $$;
reset role;

rollback;
