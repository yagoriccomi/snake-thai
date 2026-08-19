-- ============================================================================
-- Snake Thai — Planos e valores de mensalidade
-- ----------------------------------------------------------------------------
-- Fecha o maior buraco do modelo: `payments` registrava QUEM deve e QUANDO
-- vence, mas não QUANTO. E `plan_id` era um uuid solto apontando para uma
-- tabela `plans` que nunca existiu — relação fantasma, sem integridade [#86][#89].
--
-- Princípios:
--   * Dinheiro em CENTAVOS (integer). Ponto flutuante não representa 0,10 —
--     somar mensalidades em float acumula erro (CLAUDE.md §3).
--   * Periodicidade como ENUM de domínio, não string livre [#3].
--   * Preço vive no banco, não no código: é o cliente quem reajusta [#6].
--   * RLS em toda tabela nova; leitura para autenticados, escrita só admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Domínio: periodicidade de cobrança
-- ----------------------------------------------------------------------------
create type public.billing_period as enum (
  'monthly',
  'quarterly',
  'semiannual',
  'annual'
);

-- ----------------------------------------------------------------------------
-- 2. Tabela: plans
-- ----------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Valor em centavos: 12990 = R$ 129,90.
  price_cents integer not null check (price_cents >= 0),
  billing_period public.billing_period not null default 'monthly',
  -- Dia do vencimento. Limitado a 28 para existir em todo mês, inclusive fevereiro.
  due_day smallint not null default 10 check (due_day between 1 and 28),
  -- Planos desativados somem da criação de novas cobranças, mas o histórico
  -- de pagamentos que os referencia continua íntegro.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Planos comercializados pela academia. Preço em centavos, editável pelo admin.';
comment on column public.plans.price_cents is
  'Valor em centavos (integer) — nunca usar float para dinheiro.';

create index idx_plans_active on public.plans (is_active) where is_active;

create trigger trg_plans_set_updated_at
  before update on public.plans
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Tabela payments: valor, vínculo real com o plano e data de quitação
-- ----------------------------------------------------------------------------

-- Valor cobrado, congelado no momento da geração: reajustar o plano não pode
-- reescrever o histórico financeiro já emitido.
alter table public.payments
  add column amount_cents integer not null default 0 check (amount_cents >= 0);

comment on column public.payments.amount_cents is
  'Valor cobrado em centavos, congelado na emissão (imune a reajuste do plano).';

-- Momento da quitação — base de todo relatório de faturamento.
alter table public.payments
  add column paid_at timestamptz;

-- Promove o uuid solto a chave estrangeira de verdade. ON DELETE SET NULL:
-- apagar um plano não pode apagar o histórico de quem já pagou [#89].
alter table public.payments
  add constraint payments_plan_id_fkey
  foreign key (plan_id) references public.plans (id) on delete set null;

-- Índice de suporte à FK e aos relatórios por plano [#71].
create index idx_payments_plan_id on public.payments (plan_id);
-- Relatório de faturamento filtra por status e período de quitação.
create index idx_payments_status_paid_at on public.payments (status, paid_at);

-- Backfill antes da constraint: pagamentos já marcados como quitados nasceram
-- sem data de quitação, porque a coluna não existia. `updated_at` é a melhor
-- aproximação disponível — foi quando o registro virou 'paid'.
update public.payments
   set paid_at = updated_at
 where status = 'paid'
   and paid_at is null;

-- Coerência temporal: só pagamento quitado carrega data de quitação. Aplicada
-- depois do backfill, senão a constraint rejeitaria o histórico existente.
alter table public.payments
  add constraint payments_paid_at_matches_status
  check ((status = 'paid') = (paid_at is not null));

-- ----------------------------------------------------------------------------
-- 4. Vínculo do aluno com o plano contratado
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column plan_id uuid references public.plans (id) on delete set null;

create index idx_profiles_plan_id on public.profiles (plan_id);

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table public.plans enable row level security;

-- Todo aluno autenticado precisa ver o plano que contratou (nome e valor).
create policy "plans_select_authenticated"
  on public.plans for select
  to authenticated
  using (true);

create policy "plans_insert_admin"
  on public.plans for insert
  to authenticated
  with check (public.is_admin());

create policy "plans_update_admin"
  on public.plans for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "plans_delete_admin"
  on public.plans for delete
  to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Grants (menor privilégio) [#55]
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update on public.plans to service_role;
