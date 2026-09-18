-- ============================================================================
-- Dados dos termos: o admin preenche, o banco monta o texto
--
-- A Política e os Termos nasceram com campos que só a academia sabe (razão
-- social, CNPJ, encarregado, prazos, foro). Até aqui eles eram `[PREENCHER: …]`
-- no arquivo, e publicar exigia editar o .md à mão — o que só o desenvolvedor
-- consegue fazer, e num texto que já estava aprovado.
--
-- Agora o arquivo tem marcadores nomeados ({{cnpj}}), o modelo vive em
-- `legal_templates` (escrito por migration, revisado em PR) e os valores em
-- `legal_field_values` (digitados pelo admin no app). A substituição acontece
-- AQUI, no momento de publicar, e o que vai para `legal_documents` é o texto
-- já completo.
--
-- A imutabilidade da L4 continua intacta: o documento publicado guarda o texto
-- renderizado. Mudar um valor depois NÃO reescreve o que alguém já aceitou —
-- para valer, é preciso publicar outra versão, e todos aceitam de novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Valores preenchidos pelo admin
-- ----------------------------------------------------------------------------
create table public.legal_field_values (
  -- A chave do marcador: {{cnpj}} -> 'cnpj'.
  id text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint legal_field_values_id_formato check (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  -- Um valor não pode carregar outro marcador nem o rascunho antigo: sem isso,
  -- o texto publicado sairia com "{{" no meio ou com "[PREENCHER" de volta.
  constraint legal_field_values_sem_marcador check (value !~ '\{\{' and value !~ '\[PREENCHER'),
  constraint legal_field_values_nao_vazio check (btrim(value) <> ''),
  constraint legal_field_values_tamanho check (char_length(value) <= 2000)
);

comment on table public.legal_field_values is
  'Valores que a academia preenche para montar a Política e os Termos ({{chave}} do modelo). Só admin lê e escreve.';

create trigger set_updated_at_legal_field_values
  before update on public.legal_field_values
  for each row execute function public.handle_updated_at();

create trigger audit_legal_field_values
  after insert or update or delete on public.legal_field_values
  for each row execute function public.record_audit();

-- ----------------------------------------------------------------------------
-- 2. Modelo de cada documento (texto com marcadores)
-- ----------------------------------------------------------------------------
create table public.legal_templates (
  kind public.legal_document_kind primary key,
  body text not null,
  updated_at timestamptz not null default now(),
  constraint legal_templates_corpo_nao_vazio check (btrim(body) <> '')
);

comment on table public.legal_templates is
  'Texto-modelo com marcadores {{chave}}. Só entra por migration gerada de docs/legal (revisão em PR); o app apenas lê.';

create trigger set_updated_at_legal_templates
  before update on public.legal_templates
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS: admin lê tudo; escrever valores é do admin, o modelo não
-- ----------------------------------------------------------------------------
alter table public.legal_field_values enable row level security;
alter table public.legal_templates enable row level security;

create policy "legal_field_values_admin"
  on public.legal_field_values for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Só leitura: se o admin pudesse escrever o modelo pelo app, o texto publicado
-- deixaria de ser o que passou por revisão no repositório.
create policy "legal_templates_select_admin"
  on public.legal_templates for select to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.legal_field_values to authenticated;
grant select on public.legal_templates to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Renderizar: troca os marcadores e diz o que falta
-- ----------------------------------------------------------------------------
create or replace function public.renderizar_documento_legal(p_tipo public.legal_document_kind)
returns table (conteudo text, faltando text[])
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
declare
  v_texto text;
  v_chave text;
  v_valor text;
  v_faltando text[] := '{}';
begin
  -- Sem sessão é a migration (dono do banco) ou o service_role.
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Operação negada: só o administrador vê os documentos em preparação.' using errcode = '42501';
  end if;

  select t.body into v_texto from public.legal_templates t where t.kind = p_tipo;
  if v_texto is null then
    raise exception 'Não há modelo cadastrado para este documento.' using errcode = '23503';
  end if;

  for v_chave in
    select distinct m[1] from regexp_matches(v_texto, '\{\{([a-z0-9_]+)\}\}', 'g') as m
  loop
    select v.value into v_valor from public.legal_field_values v where v.id = v_chave;
    if v_valor is null then
      v_faltando := v_faltando || v_chave;
    else
      -- replace(), NUNCA regexp_replace: um valor com "&" ou "\1" seria lido
      -- como referência de captura e sairia truncado no texto publicado.
      v_texto := replace(v_texto, '{{' || v_chave || '}}', v_valor);
    end if;
  end loop;

  return query select v_texto, v_faltando;
end;
$funcao$;

comment on function public.renderizar_documento_legal(public.legal_document_kind) is
  'Monta o texto do documento com os valores preenchidos. Devolve também as chaves que faltam (o marcador delas fica no texto, para a prévia destacar).';

revoke execute on function public.renderizar_documento_legal(public.legal_document_kind) from public, anon;
grant execute on function public.renderizar_documento_legal(public.legal_document_kind) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Publicar a partir do modelo
-- ----------------------------------------------------------------------------
create or replace function public.publicar_documento_legal_do_modelo(
  p_tipo public.legal_document_kind,
  p_versao text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_render record;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Operação negada: só o administrador publica documentos legais.' using errcode = '42501';
  end if;

  select * into v_render from public.renderizar_documento_legal(p_tipo);

  if array_length(v_render.faltando, 1) is not null then
    raise exception 'Faltam dados dos termos: %. Preencha em Dados dos termos antes de publicar.',
      array_to_string(v_render.faltando, ', ') using errcode = '23514';
  end if;

  -- publicar_documento_legal já recusa texto vazio, versão repetida e sobra de
  -- rascunho, e é ela que troca a versão vigente de forma atômica.
  return public.publicar_documento_legal(p_tipo, p_versao, v_render.conteudo);
end;
$funcao$;

comment on function public.publicar_documento_legal_do_modelo(public.legal_document_kind, text) is
  'Publica o documento montando o modelo com os valores da academia. Recusa se faltar qualquer campo. Usada pela migration de publicação.';

revoke execute on function public.publicar_documento_legal_do_modelo(public.legal_document_kind, text) from public, anon;
grant execute on function public.publicar_documento_legal_do_modelo(public.legal_document_kind, text) to authenticated, service_role;
