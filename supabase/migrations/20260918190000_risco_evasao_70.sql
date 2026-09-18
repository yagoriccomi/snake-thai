-- ============================================================================
-- Risco de evasão: limite padrão passa de 50% para 70%
--
-- Decisão do dono da academia em 2026-09-18: com 50%, o aluno que já está
-- sumindo (falta metade das aulas) não aparecia no Painel.
--
-- O app manda o valor explícito, mas o padrão da função precisa acompanhar:
-- senão o Painel diz uma coisa e a consulta pelo SQL diz outra. A REGRA não
-- muda — mínimo de aulas, mês atual ao vivo e último mês fechado seguem como
-- na T8; o corpo abaixo é o mesmo de 20260916210123_painel_admin.sql.
-- ============================================================================

create or replace function public.painel_alunos_em_risco(
  p_limite_percent numeric default 70,
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
  'T8: alunos ativos com frequência abaixo de p_limite_percent (padrão 70%) no mês atual (com ao menos p_min_aulas contadas) ou no último mês fechado. Só admin.';

revoke execute on function public.painel_alunos_em_risco(numeric, integer, timestamptz) from public, anon;
grant execute on function public.painel_alunos_em_risco(numeric, integer, timestamptz) to authenticated;
