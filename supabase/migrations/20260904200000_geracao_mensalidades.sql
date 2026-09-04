-- ============================================================================
-- Snake Thai — Geração automática das mensalidades
-- ----------------------------------------------------------------------------
-- Até aqui NADA gerava mensalidade: o cron existente só marcava atraso
-- (`mark_overdue_payments`), e a geração vivia como SQL comentado desde
-- 20260727160100. Na prática, cobrança só nascia por SQL manual no banco.
--
-- Regras decididas com o usuário nesta data:
--   · Recorrência mensal para todo aluno ativo COM plano, gerada no dia 1.
--   · Inadimplência do mês anterior NÃO impede a cobrança nova — dívida velha
--     não cancela a competência nova.
--   · Aluno cadastrado ATÉ o dia 10 já recebe a fatura do mês corrente,
--     PROPORCIONAL aos dias restantes, vencendo no último dia do mês.
--   · Cadastrado depois do dia 10, nada no mês corrente: a primeira cobrança
--     é a recorrente do mês seguinte, cheia e vencendo no `due_day` do plano.
--
-- As funções recebem a DATA como parâmetro (em vez de lerem `current_date`
-- por dentro) porque senão as regras de calendário — "antes do dia 10",
-- "último dia do mês", "fevereiro" — só seriam testáveis no dia certo do mês.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Competência (mês de referência)
--
--    `due_date` sozinho não identifica o mês cobrado: a fatura de entrada
--    vence no fim do mês e a recorrente no dia 10, então duas cobranças do
--    MESMO mês teriam vencimentos diferentes. Sem competência não há como um
--    cron reexecutado saber que já gerou aquele mês — e a tabela não tinha
--    unicidade nenhuma além da PK.
-- ----------------------------------------------------------------------------
alter table public.payments add column reference_month date;

comment on column public.payments.reference_month is
  'Mês de competência da cobrança (sempre o dia 1). Junto com user_id forma a '
  'chave natural que torna a geração idempotente.';

-- Backfill: para o histórico, a competência é o mês do vencimento.
update public.payments
   set reference_month = date_trunc('month', due_date)::date
 where reference_month is null;

alter table public.payments alter column reference_month set not null;

-- A guarda de idempotência. Sem ela, uma reexecução do cron duplicaria a
-- mensalidade do mês para a base inteira.
alter table public.payments
  add constraint payments_unico_por_competencia unique (user_id, reference_month);

-- Competência é sempre o primeiro dia do mês — protege contra um INSERT que
-- passe uma data qualquer e escape da unicidade por diferença de dia.
alter table public.payments
  add constraint payments_reference_month_dia_um
  check (reference_month = date_trunc('month', reference_month)::date);

-- ----------------------------------------------------------------------------
-- 2. Plano padrão da academia
--
--    O aluno precisa de um plano para ser faturado, e `profiles.plan_id`
--    existia sem nenhum código que o preenchesse. O padrão deixa o cadastro
--    funcionar sem obrigar o admin a escolher toda vez.
-- ----------------------------------------------------------------------------
alter table public.academy_settings
  add column default_plan_id uuid references public.plans (id) on delete set null;

comment on column public.academy_settings.default_plan_id is
  'Plano sugerido no cadastro de aluno. ON DELETE SET NULL: apagar o plano '
  'não pode derrubar as configurações da academia.';

-- ----------------------------------------------------------------------------
-- 3. Valor proporcional aos dias restantes do mês
--
--    Isolada porque é a única regra ARITMÉTICA daqui, e é a que erra em
--    silêncio: um centavo a menos não quebra nada, só cobra errado para
--    sempre. Separada, dá para testar sozinha.
-- ----------------------------------------------------------------------------
create or replace function public.valor_proporcional(
  preco_cents integer,
  dia_entrada integer,
  dias_no_mes integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  -- O próprio dia da entrada conta como dia usado: quem entra dia 1 paga o
  -- mês cheio; quem entra no último dia paga 1/N.
  select greatest(
    0,
    round(preco_cents::numeric * (dias_no_mes - dia_entrada + 1)::numeric / dias_no_mes::numeric)
  )::integer;
$$;

comment on function public.valor_proporcional(integer, integer, integer) is
  'Valor pro-rata do mês de entrada: preço * dias restantes (incluindo o dia '
  'de entrada) / dias do mês, arredondado ao centavo.';

-- ----------------------------------------------------------------------------
-- 4. Fatura de entrada (proporcional) do aluno recém-cadastrado
-- ----------------------------------------------------------------------------
create or replace function public.registrar_fatura_de_entrada(
  p_user_id uuid,
  p_data date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  -- Dia de corte: cadastrou até aqui, paga o mês corrente proporcional;
  -- depois disso, só entra na recorrência do mês seguinte.
  c_dia_corte constant integer := 10;
  v_role public.user_role;
  v_status public.profile_status;
  v_plan_id uuid;
  v_preco_cents integer;
  v_dia integer;
  v_dias_no_mes integer;
  v_ultimo_dia date;
begin
  select role, status, plan_id into v_role, v_status, v_plan_id
    from public.profiles where id = p_user_id;

  -- Só aluno é faturado; professor e admin não têm mensalidade.
  if v_role is distinct from 'user' or v_plan_id is null then
    return false;
  end if;

  v_dia := extract(day from p_data)::integer;
  if v_dia > c_dia_corte then
    return false;
  end if;

  -- Plano inexistente ou inativo: não inventa cobrança; o admin resolve.
  select price_cents into v_preco_cents
    from public.plans where id = v_plan_id and is_active;
  if v_preco_cents is null then
    return false;
  end if;

  v_ultimo_dia := (date_trunc('month', p_data) + interval '1 month - 1 day')::date;
  v_dias_no_mes := extract(day from v_ultimo_dia)::integer;

  insert into public.payments (user_id, plan_id, amount_cents, due_date, reference_month, status)
  values (
    p_user_id,
    v_plan_id,
    public.valor_proporcional(v_preco_cents, v_dia, v_dias_no_mes),
    v_ultimo_dia,  -- a de entrada vence no fim do mês; as recorrentes, no due_day
    date_trunc('month', p_data)::date,
    'open'
  )
  on conflict (user_id, reference_month) do nothing;

  return found;
end;
$funcao$;

comment on function public.registrar_fatura_de_entrada(uuid, date) is
  'Cria a mensalidade proporcional do mês corrente quando o aluno entra até o '
  'dia 10, vencendo no último dia do mês. Devolve true se gerou.';

-- Trigger e não chamada da Edge Function: a regra vale para QUALQUER caminho
-- que crie um aluno (Edge Function hoje, importação amanhã, SQL do admin), e
-- não só para o caminho que lembrarmos de instrumentar.
create or replace function public.criar_fatura_de_entrada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  perform public.registrar_fatura_de_entrada(new.id, current_date);
  return new;
end;
$funcao$;

create trigger trg_profiles_fatura_de_entrada
  after insert on public.profiles
  for each row execute function public.criar_fatura_de_entrada();

-- ----------------------------------------------------------------------------
-- 5. Recorrência mensal
--
--    Repare no que NÃO existe aqui: nenhum filtro por status anterior. Um
--    aluno com o mês passado em aberto continua sendo faturado — decisão
--    explícita do usuário, e o comportamento correto de mensalidade.
-- ----------------------------------------------------------------------------
create or replace function public.gerar_mensalidades_do_mes(
  p_referencia date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_competencia date := date_trunc('month', p_referencia)::date;
  v_geradas integer;
begin
  insert into public.payments (user_id, plan_id, amount_cents, due_date, reference_month, status)
  select
    p.id,
    p.plan_id,
    pl.price_cents,
    -- due_day é CHECK 1..28, então o dia sempre existe em qualquer mês — não
    -- há 30 de fevereiro para tratar aqui.
    make_date(
      extract(year from v_competencia)::integer,
      extract(month from v_competencia)::integer,
      pl.due_day
    ),
    v_competencia,
    'open'
  from public.profiles p
  join public.plans pl on pl.id = p.plan_id and pl.is_active
  where p.role = 'user'
    and p.status = 'active'
    and p.anonymized_at is null   -- quem pediu exclusão LGPD não volta a ser cobrado
  on conflict (user_id, reference_month) do nothing;

  get diagnostics v_geradas = row_count;
  return v_geradas;
end;
$funcao$;

comment on function public.gerar_mensalidades_do_mes(date) is
  'Gera a mensalidade do mês de referência para todo aluno ativo com plano '
  'ativo. Idempotente pela unicidade (user_id, reference_month); NÃO olha '
  'inadimplência anterior, por decisão de negócio.';

revoke execute on function public.gerar_mensalidades_do_mes(date) from public, anon, authenticated;
revoke execute on function public.registrar_fatura_de_entrada(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Agendamento — dia 1 de cada mês
--
--    00:10 UTC para não disputar com o `mark-overdue-payments` das 00:01.
-- ----------------------------------------------------------------------------
select cron.schedule(
  'generate-monthly-payments',
  '10 0 1 * *',
  $cron$ select public.gerar_mensalidades_do_mes(); $cron$
);
