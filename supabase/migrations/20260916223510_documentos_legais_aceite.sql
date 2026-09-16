-- ============================================================================
-- Documentos legais e registro do aceite — lacuna L4
--
-- `legal_documents` e `consents` existem desde 20260819150000, mas nada as
-- usava: o onboarding só marcava uma caixa na tela, o que não prova QUAL texto
-- foi aceito nem QUANDO (LGPD art. 8º, §2º: o ônus da prova é do controlador).
--
-- Esta migration fecha o caminho:
--   1. documento publicado não muda (o aceite antigo aponta para o texto lido);
--   2. publicar é uma função atômica, que recusa rascunho com [PREENCHER;
--   3. o app lista o que falta aceitar e registra o aceite só da versão vigente.
--
-- Nada é publicado aqui: sem documento vigente, o app segue como antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Documento publicado é imutável
-- ----------------------------------------------------------------------------
create or replace function public.proteger_documento_legal()
returns trigger
language plpgsql
set search_path = ''
as $funcao$
begin
  -- Só a marca de vigente pode mudar: é ela que a publicação troca.
  if new.kind is distinct from old.kind
     or new.version is distinct from old.version
     or new.content is distinct from old.content
     or new.published_at is distinct from old.published_at then
    raise exception 'Documento legal publicado não muda: publique uma nova versão.'
      using errcode = '23514';
  end if;
  return new;
end;
$funcao$;

create trigger proteger_documento_legal
  before update on public.legal_documents
  for each row execute function public.proteger_documento_legal();

-- ----------------------------------------------------------------------------
-- 2. Escrita só pelas funções (menor privilégio) [#55]
-- ----------------------------------------------------------------------------
drop policy if exists "legal_documents_insert_admin" on public.legal_documents;
drop policy if exists "legal_documents_update_admin" on public.legal_documents;
revoke insert, update, delete on public.legal_documents from anon, authenticated;

drop policy if exists "consents_insert_own" on public.consents;
revoke insert, update, delete on public.consents from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Publicar uma versão
-- ----------------------------------------------------------------------------
create or replace function public.publicar_documento_legal(
  p_tipo public.legal_document_kind,
  p_versao text,
  p_conteudo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_versao text := btrim(coalesce(p_versao, ''));
  v_id uuid;
begin
  -- Sem usuário na sessão é a migration (dono do banco) ou o service_role.
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Operação negada: só o administrador publica documentos legais.' using errcode = '42501';
  end if;

  if v_versao = '' or char_length(v_versao) > 40 then
    raise exception 'Informe a versão do documento (até 40 caracteres).' using errcode = '23514';
  end if;
  if btrim(coalesce(p_conteudo, '')) = '' then
    raise exception 'O documento está vazio.' using errcode = '23514';
  end if;
  -- O rascunho marca com [PREENCHER: …] o que só a academia sabe. Publicar assim
  -- seria prometer ao titular algo que ninguém conferiu.
  if position('[PREENCHER' in p_conteudo) > 0 then
    raise exception 'O documento ainda tem campos [PREENCHER] em aberto.' using errcode = '23514';
  end if;
  if exists (select 1 from public.legal_documents d where d.kind = p_tipo and d.version = v_versao) then
    raise exception 'Já existe a versão % deste documento: use outro número.', v_versao using errcode = '23505';
  end if;

  update public.legal_documents
     set is_current = false
   where kind = p_tipo
     and is_current;

  insert into public.legal_documents (kind, version, content, is_current)
  values (p_tipo, v_versao, p_conteudo, true)
  returning id into v_id;

  return v_id;
end;
$funcao$;

comment on function public.publicar_documento_legal(public.legal_document_kind, text, text) is
  'L4: publica nova versão (a anterior deixa de ser vigente). Admin ou servidor; recusa texto com [PREENCHER.';

revoke execute on function public.publicar_documento_legal(public.legal_document_kind, text, text) from public, anon;
grant execute on function public.publicar_documento_legal(public.legal_document_kind, text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. O que falta aceitar (leve: sem o texto, roda a cada abertura do app)
-- ----------------------------------------------------------------------------
create or replace function public.documentos_legais_pendentes()
returns table (
  id uuid,
  tipo public.legal_document_kind,
  versao text,
  publicado_em timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $funcao$
  select d.id, d.kind, d.version, d.published_at
    from public.legal_documents d
   where d.is_current
     and not exists (
       select 1
         from public.consents c
        where c.document_id = d.id
          and c.user_id = (select auth.uid())
     )
   order by d.kind;
$funcao$;

comment on function public.documentos_legais_pendentes() is
  'L4: documentos vigentes que o usuário logado ainda não aceitou (sem o texto).';

revoke execute on function public.documentos_legais_pendentes() from public, anon;
grant execute on function public.documentos_legais_pendentes() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Documentos vigentes, com o texto e a data do meu aceite
-- ----------------------------------------------------------------------------
create or replace function public.documentos_legais_vigentes()
returns table (
  id uuid,
  tipo public.legal_document_kind,
  versao text,
  conteudo text,
  publicado_em timestamptz,
  aceito_em timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $funcao$
  select d.id, d.kind, d.version, d.content, d.published_at, c.accepted_at
    from public.legal_documents d
    left join public.consents c
      on c.document_id = d.id
     and c.user_id = (select auth.uid())
   where d.is_current
   order by d.kind;
$funcao$;

comment on function public.documentos_legais_vigentes() is
  'L4: documentos vigentes com o texto e quando o usuário logado aceitou (nulo se não aceitou).';

revoke execute on function public.documentos_legais_vigentes() from public, anon;
grant execute on function public.documentos_legais_vigentes() to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Registrar o aceite
-- ----------------------------------------------------------------------------
create or replace function public.aceitar_documentos_legais(p_documentos uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_usuario uuid := (select auth.uid());
  v_registrados integer;
begin
  if v_usuario is null then
    raise exception 'Operação negada: entre na sua conta para aceitar os documentos.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_documentos), 0) = 0 then
    raise exception 'Nenhum documento informado.' using errcode = '23514';
  end if;

  -- A versão pode ter mudado enquanto a pessoa lia: aceitar a antiga não vale.
  if exists (
    select 1
      from unnest(p_documentos) as pedido(id)
     where not exists (
       select 1 from public.legal_documents d where d.id = pedido.id and d.is_current
     )
  ) then
    raise exception 'Os documentos foram atualizados. Leia a versão nova antes de aceitar.' using errcode = '23514';
  end if;

  insert into public.consents (user_id, document_id)
  select v_usuario, pedido.id
    from (select distinct unnest(p_documentos) as id) pedido
  on conflict (user_id, document_id) do nothing;

  get diagnostics v_registrados = row_count;
  return v_registrados;
end;
$funcao$;

comment on function public.aceitar_documentos_legais(uuid[]) is
  'L4: registra o aceite do usuário logado. Só versão vigente; repetir não duplica.';

revoke execute on function public.aceitar_documentos_legais(uuid[]) from public, anon;
grant execute on function public.aceitar_documentos_legais(uuid[]) to authenticated;
