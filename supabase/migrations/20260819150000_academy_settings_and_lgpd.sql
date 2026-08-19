-- ============================================================================
-- Snake Thai — Configurações da academia (white-label) e base de LGPD
-- ----------------------------------------------------------------------------
-- Tira do código-fonte tudo que é PARÂMETRO DE NEGÓCIO e deveria ser editável
-- pelo cliente que compra o sistema [#3][#6]:
--     src/constants/payments.ts:7   ACADEMY_PIX_KEY
--     src/constants/auth.ts:8       DEFAULT_STUDENT_PASSWORD
--     src/theme/colors.ts:48        cor primária da marca
--     OnboardingScreen.tsx:205      texto do termo LGPD
--
-- Enquanto isso vive em constante de código, cada mudança de PIX, de cor ou de
-- termo exige um desenvolvedor, um build e uma nova instalação. É exatamente o
-- que impede o produto de ser vendido a mais de uma academia.
--
-- Traz também a base de conformidade: consentimento VERSIONADO (um boolean não
-- prova o que a pessoa aceitou nem quando) e exportação dos dados do titular.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela: academy_settings (singleton)
-- ----------------------------------------------------------------------------
create table public.academy_settings (
  -- Trava de linha única: garante um e só um registro de configuração.
  id boolean primary key default true check (id),

  -- Identidade visual e institucional
  academy_name text not null default 'Snake Thai',
  logo_url text,
  primary_color text not null default '#39FF14'
    check (primary_color ~* '^#[0-9a-f]{6}$'),
  contact_email text,
  contact_phone text,
  address text,

  -- Financeiro
  pix_key text,
  pix_holder_name text,
  default_due_day smallint not null default 10
    check (default_due_day between 1 and 28),

  -- Operacional
  default_student_password text not null default 'Snake@123'
    check (length(default_student_password) >= 8),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academy_settings is
  'Configuração única da academia (white-label). Substitui constantes de código.';
comment on column public.academy_settings.id is
  'Sempre true — a constraint garante linha única (padrão singleton).';

create trigger trg_academy_settings_set_updated_at
  before update on public.academy_settings
  for each row execute function public.handle_updated_at();

-- Semeia a configuração inicial com os valores que hoje estão no código,
-- para que o app continue funcionando idêntico até o admin personalizar.
insert into public.academy_settings (id) values (true);

-- ----------------------------------------------------------------------------
-- 2. Tabela: legal_documents (termos versionados)
-- ----------------------------------------------------------------------------
create type public.legal_document_kind as enum ('terms_of_use', 'privacy_policy');

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_document_kind not null,
  -- Versão semântica ou data: o que importa é ser estável e comparável.
  version text not null,
  content text not null,
  published_at timestamptz not null default now(),
  -- Só um documento vigente por tipo; os demais ficam como histórico, porque
  -- consentimentos antigos precisam continuar apontando para o texto original.
  is_current boolean not null default true,
  unique (kind, version)
);

comment on table public.legal_documents is
  'Termos e política de privacidade versionados. Nunca editar documento já consentido: publique nova versão.';

create unique index idx_legal_documents_current
  on public.legal_documents (kind) where is_current;

-- ----------------------------------------------------------------------------
-- 3. Tabela: consents (prova de aceite — LGPD art. 8)
-- ----------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  unique (user_id, document_id)
);

comment on table public.consents is
  'Aceite por usuário e por VERSÃO do documento. Um boolean na tela não prova o que foi aceito nem quando.';

create index idx_consents_user_id on public.consents (user_id);

-- ----------------------------------------------------------------------------
-- 4. Portabilidade: exportar os dados do titular (LGPD art. 18, V)
-- ----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  -- SECURITY INVOKER de propósito: a RLS continua valendo, então cada titular
  -- só exporta os próprios dados — nem com a função na mão alguém lê a de outro.
  select jsonb_build_object(
    'perfil', (
      select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())
    ),
    'presencas', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.attendance a where a.user_id = (select auth.uid())
    ),
    'pagamentos', (
      select coalesce(jsonb_agg(to_jsonb(pay)), '[]'::jsonb)
      from public.payments pay where pay.user_id = (select auth.uid())
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.consents c where c.user_id = (select auth.uid())
    ),
    'exportado_em', now()
  );
$function$;

comment on function public.export_my_data() is
  'Exporta os dados do titular autenticado em JSON (LGPD art. 18, V).';

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table public.academy_settings enable row level security;
alter table public.legal_documents enable row level security;
alter table public.consents enable row level security;

-- Configuração: todo autenticado lê (o app precisa da marca já no login),
-- só admin escreve.
create policy "academy_settings_select_authenticated"
  on public.academy_settings for select to authenticated using (true);
create policy "academy_settings_update_admin"
  on public.academy_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Documentos legais: leitura para autenticados, escrita só admin.
create policy "legal_documents_select_authenticated"
  on public.legal_documents for select to authenticated using (true);
create policy "legal_documents_insert_admin"
  on public.legal_documents for insert to authenticated
  with check (public.is_admin());
create policy "legal_documents_update_admin"
  on public.legal_documents for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Consentimento: o titular registra e lê o próprio; o admin audita todos.
create policy "consents_select_own_or_admin"
  on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "consents_insert_own"
  on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 6. Grants (menor privilégio) [#55]
-- ----------------------------------------------------------------------------
grant select, update on public.academy_settings to authenticated;
grant select, insert, update on public.legal_documents to authenticated;
grant select, insert on public.consents to authenticated;
grant select, insert, update on public.academy_settings to service_role;
grant execute on function public.export_my_data() to authenticated;
