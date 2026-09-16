-- ============================================================================
-- Saúde das rotinas agendadas — lacuna L3
--
-- Dez rotinas rodam sozinhas no pg_cron (mensalidades, vencidas, frequência,
-- guarda de comprovantes, grade, notificações). Uma falha só aparecia em
-- cron.job_run_details, que ninguém abre: a geração de mensalidades podia
-- falhar no dia 1 e só se notava quando faltava cobrança.
--
-- Esta função dá ao admin, no Painel, a última execução e as falhas recentes
-- de cada rotina. A mensagem de erro fica de fora de propósito (pode trazer
-- detalhe interno): o app mostra só o nome e a contagem; o detalhe está no
-- SQL do RUNBOOK.
-- ============================================================================

create or replace function public.saude_das_rotinas(p_referencia timestamptz default now())
returns table (
  rotina text,
  agenda text,
  ultima_execucao timestamptz,
  ultimo_status text,
  falhas_24h integer
)
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o administrador acompanha as rotinas.' using errcode = '42501';
  end if;

  -- As rotinas rodam como o dono das migrations, o mesmo desta função: a
  -- política de cron.job_run_details (username = current_user) mostra as linhas.
  return query
  select j.jobname::text,
         j.schedule::text,
         ultima.start_time,
         ultima.status::text,
         (select count(*)::integer
            from cron.job_run_details d
           where d.jobid = j.jobid
             and d.status = 'failed'
             and d.start_time > p_referencia - interval '24 hours'
             and d.start_time <= p_referencia)
    from cron.job j
    left join lateral (
      select d.start_time, d.status
        from cron.job_run_details d
       where d.jobid = j.jobid
         and d.start_time <= p_referencia
       order by d.start_time desc
       limit 1
    ) ultima on true
   order by j.jobname;
end;
$funcao$;

comment on function public.saude_das_rotinas(timestamptz) is
  'L3: por rotina do pg_cron, a agenda, a última execução, o último status e as falhas das últimas 24 h. Só admin; sem a mensagem de erro.';

revoke execute on function public.saude_das_rotinas(timestamptz) from public, anon;
grant execute on function public.saude_das_rotinas(timestamptz) to authenticated;
