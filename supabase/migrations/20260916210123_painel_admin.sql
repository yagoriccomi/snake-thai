-- ============================================================================
-- Painel do administrador e relatório de inadimplência — T8
--
-- Toda a conta mora aqui, em funções que recusam quem não é admin (42501).
-- O app recebe só agregados e, no relatório, o mínimo para cobrar: nome,
-- turma e valores — nunca CPF, telefone, nascimento ou e-mail. Regras e
-- decisões em docs/PAINEL.md.
--
-- Definições comuns:
--   · "hoje" e o mês são os de São Paulo, a partir de p_referencia (default
--     now()), que as regressões fixam;
--   · inadimplência = mensalidade 'open' ou 'overdue' com vencimento ANTES de
--     hoje. Não depende do cron mark-overdue-payments (roda em UTC, às 21:01 de
--     Brasília) e não cobra quem já mandou comprovante ('pending_approval');
--   · conta excluída (LGPD, anonymized_at) nunca aparece por nome: o valor dela
--     entra só numa soma à parte.
-- ============================================================================

-- O faturamento e o financeiro por mês filtram por competência; a unique
-- (user_id, reference_month) começa por user_id e não serve para isso.
create index if not exists idx_payments_reference_month on public.payments (reference_month);

-- ----------------------------------------------------------------------------
-- 1. Resumo: alunos, mês atual, inadimplência e frequência
-- ----------------------------------------------------------------------------
create or replace function public.painel_admin_resumo(p_referencia timestamptz default now())
returns table (
  alunos_ativos integer,
  alunos_inativos integer,
  alunos_ativos_sem_plano integer,
  saidas_no_mes integer,
  competencia date,
  esperado_cents bigint,
  recebido_cents bigint,
  em_analise_cents bigint,
  em_aberto_cents bigint,
  vencido_cents bigint,
  mensalidades_total integer,
  mensalidades_pagas integer,
  inadimplencia_cents bigint,
  alunos_inadimplentes integer,
  inadimplencia_contas_encerradas_cents bigint,
  frequencia_media_mes numeric,
  alunos_com_aula_no_mes integer,
  ultimo_mes_fechado date,
  frequencia_media_ultimo_mes numeric,
  alunos_com_aula_ultimo_mes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje         date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  v_mes          date := date_trunc('month', v_hoje::timestamp)::date;
  v_mes_anterior date := (date_trunc('month', v_hoje::timestamp) - interval '1 month')::date;
  v_ativos       uuid[];
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  v_ativos := array(
    select p.id from public.profiles p
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  );

  return query
  with alunos as (
    select p.status, p.plan_id, p.deactivated_at, p.anonymized_at
      from public.profiles p
     where p.role = 'user'
  ), mensalidades_do_mes as (
    select pay.status, pay.amount_cents
      from public.payments pay
     where pay.reference_month = v_mes
  ), inadimplentes as (
    select pay.user_id, pay.amount_cents, p.anonymized_at is not null as encerrada
      from public.payments pay
      join public.profiles p on p.id = pay.user_id
     where pay.status in ('open', 'overdue')
       and pay.due_date < v_hoje
  ), frequencia_do_mes as (
    -- Denominador zero vale 100% na regra da frequência: entra na média só
    -- quem teve ao menos uma aula contada, senão a média fica inflada.
    select f.frequency_percent
      from public.frequencia_mensal(v_ativos, p_referencia) f
     where f.counted_classes - f.justified > 0
  ), frequencia_do_mes_anterior as (
    select m.frequency_percent
      from public.attendance_monthly m
     where m.reference_month = v_mes_anterior
       and m.counted_classes - m.justified > 0
  )
  select
    (select count(*) from alunos a where a.status = 'active' and a.anonymized_at is null)::integer,
    (select count(*) from alunos a where a.status = 'inactive' and a.anonymized_at is null)::integer,
    (select count(*) from alunos a where a.status = 'active' and a.anonymized_at is null and a.plan_id is null)::integer,
    (select count(*) from alunos a
      where a.deactivated_at is not null
        and date_trunc('month', a.deactivated_at at time zone 'America/Sao_Paulo')::date = v_mes)::integer,
    v_mes,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m)::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'paid')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'pending_approval')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'open')::bigint,
    (select coalesce(sum(m.amount_cents), 0) from mensalidades_do_mes m where m.status = 'overdue')::bigint,
    (select count(*) from mensalidades_do_mes m)::integer,
    (select count(*) from mensalidades_do_mes m where m.status = 'paid')::integer,
    (select coalesce(sum(i.amount_cents), 0) from inadimplentes i where not i.encerrada)::bigint,
    (select count(distinct i.user_id) from inadimplentes i where not i.encerrada)::integer,
    (select coalesce(sum(i.amount_cents), 0) from inadimplentes i where i.encerrada)::bigint,
    (select round(avg(f.frequency_percent), 2) from frequencia_do_mes f),
    (select count(*) from frequencia_do_mes f)::integer,
    v_mes_anterior,
    (select round(avg(f.frequency_percent), 2) from frequencia_do_mes_anterior f),
    (select count(*) from frequencia_do_mes_anterior f)::integer;
end;
$funcao$;

comment on function public.painel_admin_resumo(timestamptz) is
  'T8: números do Painel do admin (alunos, competência atual, inadimplência, frequência média). Só admin. Regras em docs/PAINEL.md.';

revoke execute on function public.painel_admin_resumo(timestamptz) from public, anon;
grant execute on function public.painel_admin_resumo(timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Inadimplência por faixa de atraso (as 3 faixas sempre aparecem)
-- ----------------------------------------------------------------------------
create or replace function public.painel_inadimplencia_faixas(p_referencia timestamptz default now())
returns table (faixa text, ordem integer, mensalidades integer, valor_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje date := (p_referencia at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  return query
  with faixas (faixa, ordem, de, ate) as (
    values ('1-30', 1, 1, 30), ('31-60', 2, 31, 60), ('60+', 3, 61, null::integer)
  ), atrasos as (
    select pay.amount_cents, v_hoje - pay.due_date as dias
      from public.payments pay
      join public.profiles p on p.id = pay.user_id
     where pay.status in ('open', 'overdue')
       and pay.due_date < v_hoje
       and p.anonymized_at is null
  )
  select f.faixa, f.ordem, count(a.dias)::integer, coalesce(sum(a.amount_cents), 0)::bigint
    from faixas f
    left join atrasos a on a.dias >= f.de and (f.ate is null or a.dias <= f.ate)
   group by f.faixa, f.ordem
   order by f.ordem;
end;
$funcao$;

comment on function public.painel_inadimplencia_faixas(timestamptz) is
  'T8: mensalidades inadimplentes por faixa de atraso (1-30, 31-60, 60+ dias), sem contas excluídas. Só admin.';

revoke execute on function public.painel_inadimplencia_faixas(timestamptz) from public, anon;
grant execute on function public.painel_inadimplencia_faixas(timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Faturamento por competência, mês a mês (meses vazios vêm com zero)
-- ----------------------------------------------------------------------------
create or replace function public.painel_faturamento_mensal(
  p_meses integer default 12,
  p_referencia timestamptz default now()
)
returns table (reference_month date, esperado_cents bigint, recebido_cents bigint, pendente_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje  date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  -- Limite de 24 meses: o gráfico é de tendência, não um extrato.
  v_meses integer := least(greatest(coalesce(p_meses, 12), 1), 24);
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  return query
  with meses as (
    select (date_trunc('month', v_hoje::timestamp) - make_interval(months => n))::date as mes
      from generate_series(0, v_meses - 1) as n
  )
  select m.mes,
         coalesce(sum(pay.amount_cents), 0)::bigint,
         coalesce(sum(pay.amount_cents) filter (where pay.status = 'paid'), 0)::bigint,
         coalesce(sum(pay.amount_cents) filter (where pay.status <> 'paid'), 0)::bigint
    from meses m
    left join public.payments pay on pay.reference_month = m.mes
   group by m.mes
   order by m.mes;
end;
$funcao$;

comment on function public.painel_faturamento_mensal(integer, timestamptz) is
  'T8: esperado x recebido por competência nos últimos p_meses meses (1 a 24), do mais antigo ao atual. Só admin.';

revoke execute on function public.painel_faturamento_mensal(integer, timestamptz) from public, anon;
grant execute on function public.painel_faturamento_mensal(integer, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Alunos em risco de evasão por frequência
--
--    Abaixo do limite no mês atual (só com aulas suficientes para o número
--    significar algo) OU no último mês fechado.
-- ----------------------------------------------------------------------------
create or replace function public.painel_alunos_em_risco(
  p_limite_percent numeric default 50,
  p_min_aulas integer default 4,
  p_referencia timestamptz default now()
)
returns table (
  user_id uuid,
  nome text,
  turma text,
  frequencia_mes_atual numeric,
  frequencia_ultimo_mes numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje         date := (p_referencia at time zone 'America/Sao_Paulo')::date;
  v_mes_anterior date := (date_trunc('month', v_hoje::timestamp) - interval '1 month')::date;
  v_ativos       uuid[];
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  v_ativos := array(
    select p.id from public.profiles p
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  );

  return query
  with mes_atual as (
    select f.user_id as aluno, f.frequency_percent
      from public.frequencia_mensal(v_ativos, p_referencia) f
     where f.counted_classes - f.justified >= p_min_aulas
  ), mes_anterior as (
    select m.user_id as aluno, m.frequency_percent
      from public.attendance_monthly m
     where m.reference_month = v_mes_anterior
       and m.counted_classes - m.justified > 0
  )
  select p.id,
         coalesce(p.name, 'Aluno pendente'),
         g.name,
         atual.frequency_percent,
         anterior.frequency_percent
    from public.profiles p
    left join mes_atual atual on atual.aluno = p.id
    left join mes_anterior anterior on anterior.aluno = p.id
    left join public.groups g on g.id = p.group_id
   where p.id = any (v_ativos)
     and (atual.frequency_percent < p_limite_percent or anterior.frequency_percent < p_limite_percent)
   order by least(coalesce(atual.frequency_percent, 101), coalesce(anterior.frequency_percent, 101)), 2;
end;
$funcao$;

comment on function public.painel_alunos_em_risco(numeric, integer, timestamptz) is
  'T8: alunos ativos com frequência abaixo de p_limite_percent no mês atual (com ao menos p_min_aulas contadas) ou no último mês fechado. Só admin.';

revoke execute on function public.painel_alunos_em_risco(numeric, integer, timestamptz) from public, anon;
grant execute on function public.painel_alunos_em_risco(numeric, integer, timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Relatório de inadimplência por aluno
-- ----------------------------------------------------------------------------
create or replace function public.relatorio_inadimplencia(p_referencia timestamptz default now())
returns table (
  user_id uuid,
  nome text,
  turma text,
  aluno_ativo boolean,
  mensalidades integer,
  total_devido_cents bigint,
  maior_atraso_dias integer,
  vencimento_mais_antigo date
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
declare
  v_hoje date := (p_referencia at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501';
  end if;

  -- Inativo entra (com aluno_ativo = false): é justamente de quem saiu que mais
  -- se esquece de cobrar. Conta excluída não entra por nome.
  return query
  select p.id,
         coalesce(p.name, 'Aluno pendente'),
         g.name,
         p.status = 'active',
         count(*)::integer,
         sum(pay.amount_cents)::bigint,
         max(v_hoje - pay.due_date)::integer,
         min(pay.due_date)
    from public.payments pay
    join public.profiles p on p.id = pay.user_id
    left join public.groups g on g.id = p.group_id
   where pay.status in ('open', 'overdue')
     and pay.due_date < v_hoje
     and p.anonymized_at is null
   group by p.id, p.name, g.name, p.status
   order by 7 desc, 6 desc, 2;
end;
$funcao$;

comment on function public.relatorio_inadimplencia(timestamptz) is
  'T8: devedores (mensalidade em aberto ou vencida com vencimento antes de hoje, São Paulo), um por aluno, sem contas excluídas. Só nome, turma e valores. Só admin.';

revoke execute on function public.relatorio_inadimplencia(timestamptz) from public, anon;
grant execute on function public.relatorio_inadimplencia(timestamptz) to authenticated;
