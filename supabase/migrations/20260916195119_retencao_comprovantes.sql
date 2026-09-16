-- ============================================================================
-- Prazo de guarda da IMAGEM do comprovante (P-11) — T7
--
-- A imagem do comprovante cumpre a finalidade quando o pagamento é aprovado
-- (art. 15, I); o REGISTRO do pagamento (valor, competência, situação, data)
-- continua guardado por obrigação legal (art. 16, I). Sem prazo, a imagem —
-- nome, banco, às vezes CPF — ficava para sempre.
--
-- NASCE DESLIGADO (proof_retention_days nulo): ligar apaga arquivos de verdade
-- em produção, e o número de dias é decisão da academia. Recomendação
-- registrada em docs/planos/PLANO-T7.md: 90 dias após o pagamento (cobre a
-- contestação de Pix pelo MED, até 80 dias, e os prazos do CDC). Para ligar:
--   update public.academy_settings set proof_retention_days = 90;
-- ============================================================================

alter table public.academy_settings
  add column proof_retention_days smallint
  constraint academy_settings_proof_retention_days_minimo check (proof_retention_days is null or proof_retention_days >= 30);

comment on column public.academy_settings.proof_retention_days is
  'Dias, contados do pagamento (paid_at), até a IMAGEM do comprovante ser eliminada. Nulo = desligado. Mínimo 30.';

-- ----------------------------------------------------------------------------
-- Varredura diária: só pagamentos PAGOS, antigos, que ainda têm arquivo.
-- Pendentes, abertos e vencidos nunca são tocados. A fila (worker do
-- snake-server) apaga o arquivo; aqui só se enfileira e se limpa o ponteiro —
-- e a guarda contra duplicata do gatilho evita um segundo item com outro motivo.
-- ----------------------------------------------------------------------------
create or replace function public.enfileirar_comprovantes_expirados()
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_dias         smallint;
  v_enfileirados integer;
begin
  select s.proof_retention_days into v_dias from public.academy_settings s limit 1;
  if v_dias is null then
    return 0;
  end if;

  with expirados as (
    select p.id, p.proof_provider,
           coalesce(p.proof_public_id, p.proof_storage_path, p.proof_url) as asset_ref
      from public.payments p
     where p.status = 'paid'
       and p.paid_at < now() - make_interval(days => v_dias)
       and p.proof_provider is not null
  ), enfileirados as (
    insert into public.media_deletion_queue (provider, asset_ref, payment_id, motivo)
    select e.proof_provider, e.asset_ref, e.id, 'retencao_expirada'
      from expirados e
     where length(trim(coalesce(e.asset_ref, ''))) > 0
       and not exists (
         select 1 from public.media_deletion_queue q
          where q.provider = e.proof_provider
            and q.asset_ref = e.asset_ref
            and q.processado_em is null
       )
    returning 1
  )
  select count(*) into v_enfileirados from enfileirados;

  update public.payments p
     set proof_provider     = null,
         proof_storage_path = null,
         proof_public_id    = null,
         proof_url          = null
   where p.status = 'paid'
     and p.paid_at < now() - make_interval(days => v_dias)
     and p.proof_provider is not null;

  return v_enfileirados;
end;
$funcao$;

comment on function public.enfileirar_comprovantes_expirados() is
  'P-11: enfileira para eliminação as imagens de comprovante de pagamentos pagos há mais de academy_settings.proof_retention_days dias e limpa os ponteiros. Desligada com o prazo nulo.';

revoke execute on function public.enfileirar_comprovantes_expirados() from public, anon, authenticated;
grant execute on function public.enfileirar_comprovantes_expirados() to service_role;

-- 02:30, antes do worker da Render (03:00). Com o prazo nulo, não faz nada.
select cron.schedule('expire-payment-proofs', '30 2 * * *', $$select public.enfileirar_comprovantes_expirados()$$);
