-- ============================================================================
-- Snake Thai — Automação de vencimentos (pg_cron)
-- ----------------------------------------------------------------------------
-- Regra A (obrigatória): diariamente às 00:01, todo pagamento `open` com
-- due_date < CURRENT_DATE passa a `overdue`.
-- Regra B (avançada/opcional): geração da mensalidade do próximo mês — a
-- estrutura sugerida está comentada ao final.
--
-- O bloco de agendamento é resiliente: só ativa o pg_cron se a extensão estiver
-- disponível (em ambientes sem pg_cron, apenas registra um aviso).
-- ============================================================================

-- Marca como vencidos os pagamentos em aberto cujo vencimento já passou.
create or replace function public.mark_overdue_payments()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments
  set status = 'overdue',
      updated_at = now()
  where status = 'open'
    and due_date < current_date;
$$;

comment on function public.mark_overdue_payments() is
  'Regra A: transiciona pagamentos open vencidos para overdue. Executada pelo pg_cron.';

-- Agenda a execução diária às 00:01 (se o pg_cron existir).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'mark-overdue-payments',
      '1 0 * * *',
      $job$ select public.mark_overdue_payments(); $job$
    );
  else
    raise notice 'pg_cron indisponível neste ambiente; agende mark_overdue_payments() manualmente.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Regra B (SUGESTÃO — geração da mensalidade do próximo mês)
-- ----------------------------------------------------------------------------
-- Estrutura recomendada (deixada comentada; requer definir o "dia de cobrança"
-- e o conceito de aluno ativo):
--
-- create or replace function public.generate_next_month_payments()
-- returns void language sql security definer set search_path = '' as $$
--   insert into public.payments (user_id, status, due_date)
--   select p.user_id, 'open', (max(p.due_date) + interval '1 month')::date
--   from public.payments p
--   join public.profiles pr on pr.id = p.user_id and pr.role = 'user'
--   group by p.user_id
--   having max(p.due_date) < (current_date + interval '1 month')
--      and bool_or(p.status = 'paid');  -- só para quem já pagou ao menos uma vez
-- $$;
-- select cron.schedule('generate-next-month','5 0 1 * *',
--   $job$ select public.generate_next_month_payments(); $job$);
