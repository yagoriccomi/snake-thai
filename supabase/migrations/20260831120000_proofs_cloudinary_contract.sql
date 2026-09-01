-- ============================================================================
-- Snake Thai — Comprovantes: contrato de dados da migração para a Cloudinary
-- ----------------------------------------------------------------------------
-- Estratégia EXPAND → MIGRATE → CONTRACT. Esta migration é o EXPAND.
--
-- POR QUE NÃO TROCAR proof_url DE SIGNIFICADO DE UMA VEZ:
-- o aplicativo está PUBLICADO na Play Store. Um APK antigo continua gravando
-- e lendo o path do Supabase Storage. Se esta coluna passasse a significar
-- "public_id da Cloudinary" num único passo, todo usuário que ainda não
-- atualizou passaria a receber link quebrado — em silêncio, com dado
-- financeiro. Convivência primeiro; o CONTRACT (drop da coluna antiga) só
-- depois que a telemetria mostrar o parque atualizado. [#81][#87]
--
-- LGPD: o comprovante é PII financeira. O REGISTRO do pagamento é retido por
-- obrigação legal (art. 16, I), mas a IMAGEM do comprovante tem finalidade
-- exaurida na aprovação (art. 6º, I e art. 15, I) — por isso a fila de
-- eliminação na seção 4. [#63]
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tipo de domínio: qual provedor guarda o arquivo
--    ENUM (e não texto livre) para o provedor não virar magic string
--    espalhada por dois repositórios. Coerente com public.payment_status. [#3][#5]
-- ----------------------------------------------------------------------------
create type public.media_provider as enum ('supabase_storage', 'cloudinary');

-- ----------------------------------------------------------------------------
-- 2. Colunas novas — cada uma com UM significado, honesto no nome.
--
--    A coluna `proof_url` nunca guardou uma URL: guardava um path. Esse nome
--    mentiroso é a origem direta do bug latente que esta migração corrige — o
--    servidor leu "url" e assumiu public_id da Cloudinary. Nome revela
--    intenção. [#1]
-- ----------------------------------------------------------------------------
alter table public.payments
  add column proof_provider     public.media_provider,
  add column proof_storage_path text,
  add column proof_public_id    text;

comment on column public.payments.proof_provider is
  'Onde o arquivo do comprovante está: supabase_storage (legado) ou cloudinary (novo).';
comment on column public.payments.proof_storage_path is
  'Legado. Path no bucket payment_proofs, formato "<user_id>/<payment_id>_<arquivo>".';
comment on column public.payments.proof_public_id is
  'public_id da Cloudinary, formato "comprovantes/<user_id>/<payment_id>". Sem URL, sem extensão.';
comment on column public.payments.proof_url is
  'DEPRECADA — mantida só durante a convivência com APKs antigos. Removida no CONTRACT.';

-- ----------------------------------------------------------------------------
-- 3. Backfill: tudo que existe hoje é, por definição, path do Storage.
--    Idempotente para poder reexecutar sem duplicar efeito. [#87]
-- ----------------------------------------------------------------------------
update public.payments
   set proof_storage_path = proof_url,
       proof_provider     = 'supabase_storage'
 where proof_url is not null
   and proof_storage_path is null;

-- Integridade: ou não há comprovante, ou há EXATAMENTE um provedor com o
-- respectivo identificador preenchido. Impede o estado ambíguo em que o
-- servidor não sabe onde procurar o arquivo. [#86]
alter table public.payments
  add constraint payments_proof_coerente check (
    (proof_provider is null
      and proof_storage_path is null
      and proof_public_id is null)
    or (proof_provider = 'supabase_storage'
      and proof_storage_path is not null
      and proof_public_id is null)
    or (proof_provider = 'cloudinary'
      and proof_public_id is not null
      and proof_storage_path is null)
  );

-- Índice parcial: as consultas de reconciliação e do job de retenção filtram
-- por "tem comprovante". O parcial indexa só essas linhas. [#71]
create index idx_payments_proof_provider
  on public.payments (proof_provider)
  where proof_provider is not null;

-- ----------------------------------------------------------------------------
-- 4. LGPD — fila de eliminação de mídia (art. 18, VI; art. 15, I)
--
--    Apagar um arquivo num provedor externo é uma chamada HTTP: não pode ser
--    feita de dentro de uma transação SQL. O banco então REGISTRA a intenção
--    de forma durável e o servidor consome a fila. Padrão outbox: se a chamada
--    externa falhar, o pedido de exclusão não se perde. [#25][#89]
-- ----------------------------------------------------------------------------
create type public.media_deletion_reason as enum (
  'conta_excluida',        -- titular exerceu o art. 18, VI
  'comprovante_recusado',  -- admin recusou; o arquivo perde a finalidade na hora
  'retencao_expirada',     -- fim do prazo de guarda (art. 15, I)
  'migrado_de_provedor'    -- copiado para outro provedor; a origem vira duplicata de PII
);

create table public.media_deletion_queue (
  id             uuid primary key default gen_random_uuid(),
  provider       public.media_provider not null,
  -- Identificador do asset NO PROVEDOR (path do Storage ou public_id da Cloudinary).
  asset_ref      text not null,
  -- ON DELETE SET NULL: se o pagamento sumir, a ordem de apagar o arquivo
  -- PRECISA sobreviver — senão o arquivo fica órfão no provedor para sempre.
  payment_id     uuid references public.payments (id) on delete set null,
  motivo         public.media_deletion_reason not null,
  enfileirado_em timestamptz not null default now(),
  processado_em  timestamptz,
  tentativas     integer not null default 0,
  ultimo_erro    text,
  constraint media_deletion_queue_asset_ref_nao_vazio check (length(trim(asset_ref)) > 0)
);

comment on table public.media_deletion_queue is
  'Outbox de eliminação de mídia em provedor externo (LGPD art. 18, VI e art. 15, I). Consumida pelo snake-server.';

-- Índice parcial só do que ainda não foi processado: é o único filtro que o
-- worker usa, e a fila processada cresce indefinidamente. [#71]
create index idx_media_deletion_queue_pendentes
  on public.media_deletion_queue (enfileirado_em)
  where processado_em is null;

-- RLS: esta fila referencia assets de PII. Nenhum cliente autenticado tem
-- negócio aqui — só o servidor, via service_role. Menor privilégio. [#55]
alter table public.media_deletion_queue enable row level security;

-- Sem policy para `authenticated`: com RLS ligada e nenhuma policy, o acesso é
-- negado por padrão. O service_role ignora RLS por construção.
revoke all on public.media_deletion_queue from anon, authenticated;
grant select, insert, update on public.media_deletion_queue to service_role;

-- ----------------------------------------------------------------------------
-- 5. Enfileiramento automático: o banco garante que nada seja esquecido.
--
--    Dispara quando o comprovante deixa de existir logicamente (campos
--    limpos, ex.: recusa do admin) ou quando a linha de pagamento é apagada.
--    A aplicação pode esquecer de chamar a API do provedor; o trigger não. [#89]
-- ----------------------------------------------------------------------------
create or replace function public.enfileirar_exclusao_de_comprovante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_provider  public.media_provider;
  v_asset_ref text;
  v_motivo    public.media_deletion_reason;
begin
  if tg_op = 'DELETE' then
    v_provider  := old.proof_provider;
    v_asset_ref := coalesce(old.proof_public_id, old.proof_storage_path, old.proof_url);
    v_motivo    := 'conta_excluida';
  else
    -- Só interessa a transição "tinha comprovante" -> "não tem mais".
    if old.proof_provider is null then
      return new;
    end if;
    if new.proof_public_id is not null or new.proof_storage_path is not null then
      return new;
    end if;
    v_provider  := old.proof_provider;
    v_asset_ref := coalesce(old.proof_public_id, old.proof_storage_path, old.proof_url);
    v_motivo    := 'comprovante_recusado';
  end if;

  if v_provider is null or v_asset_ref is null or length(trim(v_asset_ref)) = 0 then
    return coalesce(new, old);
  end if;

  insert into public.media_deletion_queue (provider, asset_ref, payment_id, motivo)
  values (v_provider, v_asset_ref,
          case when tg_op = 'DELETE' then null else old.id end,
          v_motivo);

  return coalesce(new, old);
end;
$funcao$;

revoke execute on function public.enfileirar_exclusao_de_comprovante() from public, anon, authenticated;

create trigger trg_payments_enfileirar_exclusao_comprovante
  after update or delete on public.payments
  for each row execute function public.enfileirar_exclusao_de_comprovante();

-- ----------------------------------------------------------------------------
-- 6. Exclusão de conta (LGPD art. 18, VI) — o caminho que o trigger NÃO cobre
--
--    A Edge Function `delete-my-account` ANONIMIZA o perfil em vez de apagá-lo,
--    de propósito: a cadeia auth.users → profiles → payments é ON DELETE CASCADE,
--    e apagar o titular levaria junto o histórico financeiro que a lei manda
--    guardar (art. 16, I). Consequência: nenhum DELETE chega em `payments`, e o
--    trigger da seção 5 nunca dispara nesse fluxo.
--
--    Resultado hoje: o titular exclui a conta e a IMAGEM do comprovante — nome,
--    banco, valor, às vezes CPF — permanece armazenada e visível ao admin.
--
--    Esta função separa as duas coisas, que a lei também separa:
--      · o REGISTRO do pagamento é retido  (art. 16, I — obrigação legal)
--      · a IMAGEM do comprovante é eliminada (art. 15, I — fim do tratamento)
--
--    A Edge Function passa a chamá-la ao anonimizar. [#63][#89]
-- ----------------------------------------------------------------------------
create or replace function public.eliminar_comprovantes_do_titular(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_enfileirados integer;
begin
  insert into public.media_deletion_queue (provider, asset_ref, payment_id, motivo)
  select p.proof_provider,
         coalesce(p.proof_public_id, p.proof_storage_path, p.proof_url),
         p.id,
         'conta_excluida'
    from public.payments p
   where p.user_id = p_user_id
     and p.proof_provider is not null;

  get diagnostics v_enfileirados = row_count;

  -- Limpa o ponteiro, preservando a linha do pagamento (valor, data, status).
  -- Roda DEPOIS do insert: a fila já guarda o asset_ref, então zerar as colunas
  -- aqui não perde a referência do arquivo a ser apagado no provedor.
  update public.payments
     set proof_provider     = null,
         proof_storage_path = null,
         proof_public_id    = null,
         proof_url          = null
   where user_id = p_user_id
     and proof_provider is not null;

  return v_enfileirados;
end;
$funcao$;

comment on function public.eliminar_comprovantes_do_titular(uuid) is
  'LGPD art. 18, VI: elimina as IMAGENS dos comprovantes do titular, preservando os registros financeiros (art. 16, I). Chamada pela Edge Function delete-my-account.';

-- Só o servidor/Edge Function (service_role). Um aluno não dispara isto direto. [#55]
revoke execute on function public.eliminar_comprovantes_do_titular(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_comprovantes_do_titular(uuid) to service_role;
