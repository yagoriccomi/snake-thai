-- ============================================================================
-- Fila de notificações push — T9
--
-- Mesmo padrão da media_deletion_queue: o banco decide QUEM recebe O QUÊ e
-- guarda numa fila; a Edge Function send-push, chamada pelo pg_cron via
-- pg_net, só entrega pela Expo. O snake-server fica de fora (plano grátis
-- hiberna e não usa a service_role no serviço web).
--
-- Regras (docs/NOTIFICACOES.md):
--   · texto genérico, sem nome, CPF ou valor (passa por Expo e Google e aparece
--     na tela bloqueada);
--   · horário de São Paulo; nada sai entre 22:00 e 07:00;
--   · só entra na fila quem tem aparelho cadastrado;
--   · deduplicação pelo banco: UNIQUE (destinatário, chave);
--   · histórico guardado por 30 dias.
-- ============================================================================

create extension if not exists pg_net with schema extensions;

create type public.notification_kind as enum (
  'mensalidade_vence_em_breve',
  'mensalidade_vence_hoje',
  'mensalidade_atrasada',
  'comprovante_enviado',
  'comprovante_aprovado',
  'comprovante_recusado',
  'justificativa_pendente',
  'aula_sem_chamada',
  'aulas_sem_chamada_resumo'
);

create type public.notification_status as enum ('pending', 'sending', 'sent', 'cancelled', 'failed');

-- ----------------------------------------------------------------------------
-- 1. Tabelas
-- ----------------------------------------------------------------------------
create table public.notification_outbox (
  id               uuid primary key default gen_random_uuid(),
  recipient_id     uuid not null references public.profiles (id) on delete cascade,
  kind             public.notification_kind not null,
  dedupe_key       text not null,
  payment_id       uuid references public.payments (id) on delete cascade,
  class_id         uuid references public.classes (id) on delete cascade,
  justification_id uuid references public.absence_justifications (id) on delete cascade,
  -- Só números pequenos ({"dias": 3}); nunca texto de pessoa.
  data             jsonb not null default '{}'::jsonb
                   constraint notification_outbox_data_pequeno check (pg_column_size(data) <= 512),
  send_after       timestamptz not null default now(),
  status           public.notification_status not null default 'pending',
  attempts         integer not null default 0,
  -- Quando o despachante pegou a linha: envio preso há 10 min volta à fila.
  claimed_at       timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  constraint notification_outbox_unica unique (recipient_id, dedupe_key)
);

comment on table public.notification_outbox is
  'T9: fila de notificações push. O banco enfileira; a Edge Function send-push entrega. Deduplicação por (recipient_id, dedupe_key).';

create index idx_notification_outbox_pendentes on public.notification_outbox (send_after) where status = 'pending';
create index idx_notification_outbox_recipient on public.notification_outbox (recipient_id);

create table public.notification_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  outbox_id          uuid not null references public.notification_outbox (id) on delete cascade,
  device_id          uuid references public.push_devices (id) on delete set null,
  expo_ticket_id     text,
  ticket_status      text not null constraint notification_deliveries_ticket_status check (ticket_status in ('ok', 'error')),
  error_code         text,
  created_at         timestamptz not null default now(),
  receipt_checked_at timestamptz
);

comment on table public.notification_deliveries is
  'T9: um envio por aparelho, com o ticket da Expo; o recibo é conferido depois de 15 minutos.';

create index idx_notification_deliveries_recibos_pendentes
  on public.notification_deliveries (created_at)
  where ticket_status = 'ok' and receipt_checked_at is null;

alter table public.notification_outbox enable row level security;
alter table public.notification_deliveries enable row level security;

-- O titular lê as próprias notificações (portabilidade, export_my_data).
create policy "notification_outbox_select_own" on public.notification_outbox
  for select to authenticated using (recipient_id = (select auth.uid()));

revoke all on public.notification_outbox, public.notification_deliveries from anon, authenticated;
grant select on public.notification_outbox to authenticated;
grant all on public.notification_outbox, public.notification_deliveries to service_role;

-- ----------------------------------------------------------------------------
-- 2. Enfileirar uma notificação
-- ----------------------------------------------------------------------------

-- Próximo instante permitido: fora de 22:00–07:00 em São Paulo.
create or replace function public.horario_permitido_para_push(p_agora timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $funcao$
  select case
    when (p_agora at time zone 'America/Sao_Paulo')::time >= time '22:00'
      then (((p_agora at time zone 'America/Sao_Paulo')::date + 1) + time '07:00') at time zone 'America/Sao_Paulo'
    when (p_agora at time zone 'America/Sao_Paulo')::time < time '07:00'
      then ((p_agora at time zone 'America/Sao_Paulo')::date + time '07:00') at time zone 'America/Sao_Paulo'
    else p_agora
  end;
$funcao$;

create or replace function public.enfileirar_notificacao(
  p_destinatario uuid,
  p_tipo public.notification_kind,
  p_chave text,
  p_data jsonb default '{}'::jsonb,
  p_payment_id uuid default null,
  p_class_id uuid default null,
  p_justification_id uuid default null,
  p_agora timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_inseridas integer;
begin
  -- Sem aparelho não há para onde mandar: não guarda dado à toa.
  if not exists (select 1 from public.push_devices d where d.user_id = p_destinatario) then
    return false;
  end if;

  insert into public.notification_outbox
    (recipient_id, kind, dedupe_key, data, payment_id, class_id, justification_id, send_after)
  values
    (p_destinatario, p_tipo, p_chave, coalesce(p_data, '{}'::jsonb), p_payment_id, p_class_id, p_justification_id,
     public.horario_permitido_para_push(p_agora))
  on conflict (recipient_id, dedupe_key) do nothing;

  get diagnostics v_inseridas = row_count;
  return v_inseridas > 0;
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 3. Eventos: comprovante enviado, aprovado e recusado
--
--    Uma falha aqui NUNCA pode impedir o aluno de enviar o comprovante nem o
--    admin de aprovar: o erro vira WARNING no log do Postgres e o UPDATE segue.
-- ----------------------------------------------------------------------------
create or replace function public.notificar_mudanca_de_pagamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_admin uuid;
  -- Milissegundos: recusa e reenvio no mesmo segundo ainda avisam de novo.
  v_marca text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  begin
    if new.status = 'pending_approval' then
      for v_admin in
        select p.id from public.profiles p
         where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
      loop
        -- A marca de tempo deixa um reenvio (depois de recusa) avisar de novo.
        perform public.enfileirar_notificacao(
          v_admin, 'comprovante_enviado', format('comprovante_enviado:%s:%s', new.id, v_marca),
          '{}'::jsonb, new.id);
      end loop;
    elsif new.status = 'paid' and old.status = 'pending_approval' then
      perform public.enfileirar_notificacao(
        new.user_id, 'comprovante_aprovado', format('comprovante_aprovado:%s', new.id), '{}'::jsonb, new.id);
    elsif new.status = 'open' and old.status = 'pending_approval' then
      perform public.enfileirar_notificacao(
        new.user_id, 'comprovante_recusado', format('comprovante_recusado:%s:%s', new.id, v_marca), '{}'::jsonb, new.id);
    end if;
  exception when others then
    raise warning 'Notificação de pagamento não enfileirada (%): %', sqlstate, sqlerrm;
  end;

  return new;
end;
$funcao$;

create trigger trg_payments_notificar_mudanca
  after update of status on public.payments
  for each row execute function public.notificar_mudanca_de_pagamento();

-- ----------------------------------------------------------------------------
-- 4. Evento: justificativa de falta para revisar
--    Vai para os professores da aula; para os admins só se a aula não tiver
--    professor (quem revisa é quem deu a aula).
-- ----------------------------------------------------------------------------
create or replace function public.notificar_justificativa_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_destinatario uuid;
  v_tem_professor boolean;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  begin
    select exists (
      select 1 from public.class_teachers ct
        join public.profiles p on p.id = ct.teacher_id
       where ct.class_id = new.class_id
         and p.role = 'professor' and p.status = 'active' and p.anonymized_at is null
    ) into v_tem_professor;

    for v_destinatario in
      select p.id
        from public.profiles p
       where p.status = 'active' and p.anonymized_at is null
         and (
           (v_tem_professor and p.role = 'professor'
              and exists (select 1 from public.class_teachers ct where ct.class_id = new.class_id and ct.teacher_id = p.id))
           or (not v_tem_professor and p.role = 'admin')
         )
    loop
      perform public.enfileirar_notificacao(
        v_destinatario, 'justificativa_pendente', format('justificativa_pendente:%s', new.id),
        '{}'::jsonb, null, new.class_id, new.id);
    end loop;
  exception when others then
    raise warning 'Notificação de justificativa não enfileirada (%): %', sqlstate, sqlerrm;
  end;

  return new;
end;
$funcao$;

create trigger trg_absence_justifications_notificar
  after insert on public.absence_justifications
  for each row execute function public.notificar_justificativa_pendente();

-- ----------------------------------------------------------------------------
-- 5. Lembretes de mensalidade (cron diário às 09:00 de São Paulo)
--
--    D-3 (janela D-3..D-2), D0 e atraso em D+1 (D+1..D+2) e D+7 (D+7..D+8).
--    As janelas de 2 dias recuperam um dia sem cron sem mandar enxurrada de
--    atrasos antigos na primeira ativação. O atraso usa o dia de São Paulo, não
--    o status 'overdue' (o cron que o marca roda em UTC).
-- ----------------------------------------------------------------------------
create or replace function public.enfileirar_lembretes_de_mensalidade(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_total integer := 0;
  r record;
begin
  for r in
    select pay.id, pay.user_id, pay.due_date, pay.status
      from public.payments pay
      join public.profiles p on p.id = pay.user_id
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
       and exists (select 1 from public.push_devices d where d.user_id = p.id)
       and pay.status in ('open', 'overdue')
       and pay.due_date between v_hoje - 8 and v_hoje + 3
  loop
    if r.status = 'open' and r.due_date between v_hoje + 2 and v_hoje + 3 then
      if public.enfileirar_notificacao(r.user_id, 'mensalidade_vence_em_breve',
           format('mensalidade_vence_em_breve:%s:%s', r.id, r.due_date),
           jsonb_build_object('dias', r.due_date - v_hoje), r.id, null, null, p_agora) then
        v_total := v_total + 1;
      end if;
    elsif r.status = 'open' and r.due_date = v_hoje then
      if public.enfileirar_notificacao(r.user_id, 'mensalidade_vence_hoje',
           format('mensalidade_vence_hoje:%s:%s', r.id, r.due_date),
           '{}'::jsonb, r.id, null, null, p_agora) then
        v_total := v_total + 1;
      end if;
    elsif r.due_date between v_hoje - 2 and v_hoje - 1 then
      if public.enfileirar_notificacao(r.user_id, 'mensalidade_atrasada',
           format('mensalidade_atrasada:%s:d1', r.id),
           jsonb_build_object('dias', v_hoje - r.due_date), r.id, null, null, p_agora) then
        v_total := v_total + 1;
      end if;
    elsif r.due_date between v_hoje - 8 and v_hoje - 7 then
      if public.enfileirar_notificacao(r.user_id, 'mensalidade_atrasada',
           format('mensalidade_atrasada:%s:d7', r.id),
           jsonb_build_object('dias', v_hoje - r.due_date), r.id, null, null, p_agora) then
        v_total := v_total + 1;
      end if;
    end if;
  end loop;

  return v_total;
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 6. Aula sem chamada: professor por aula (a cada 15 min) e resumo para o
--    admin (21:00). Mesma tolerância de 1 hora de aulas_sem_chamada; turma
--    arquivada não entra (a chamada dela está congelada).
-- ----------------------------------------------------------------------------
create or replace function public.enfileirar_avisos_aula_sem_chamada(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_total integer := 0;
  r record;
begin
  for r in
    select c.id as class_id, ct.teacher_id
      from public.classes c
      join public.class_teachers ct on ct.class_id = c.id
      join public.profiles p on p.id = ct.teacher_id
     where c.type = 'routine'
       and c.attendance_taken_at is null
       and c.date_time < p_agora - interval '1 hour'
       and c.date_time >= p_agora - interval '24 hours'
       and not exists (select 1 from public.groups g where g.id = c.group_id and g.archived_at is not null)
       and p.role = 'professor' and p.status = 'active' and p.anonymized_at is null
  loop
    if public.enfileirar_notificacao(r.teacher_id, 'aula_sem_chamada', format('aula_sem_chamada:%s', r.class_id),
         '{}'::jsonb, null, r.class_id, null, p_agora) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$funcao$;

create or replace function public.enfileirar_resumo_aulas_sem_chamada(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_quantidade integer;
  v_total integer := 0;
  v_admin uuid;
begin
  select count(*) into v_quantidade
    from public.classes c
   where c.type = 'routine'
     and c.attendance_taken_at is null
     and (c.date_time at time zone 'America/Sao_Paulo')::date = v_hoje
     and c.date_time < p_agora - interval '1 hour'
     and not exists (select 1 from public.groups g where g.id = c.group_id and g.archived_at is not null);

  if v_quantidade = 0 then
    return 0;
  end if;

  for v_admin in
    select p.id from public.profiles p
     where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
  loop
    if public.enfileirar_notificacao(v_admin, 'aulas_sem_chamada_resumo', format('aulas_sem_chamada_resumo:%s', v_hoje),
         jsonb_build_object('quantidade', v_quantidade), null, null, null, p_agora) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 7. Despacho: o que a Edge Function pega, e o que ela devolve
-- ----------------------------------------------------------------------------

-- Devolve as notificações prontas para sair, uma linha por aparelho da
-- variante pedida, já marcadas como 'sending'. Antes disso: libera as presas,
-- cancela as que perderam o sentido e as sem aparelho.
create or replace function public.reivindicar_notificacoes(p_limite integer, p_variante public.app_variant)
returns table (
  outbox_id uuid,
  recipient_id uuid,
  kind public.notification_kind,
  data jsonb,
  payment_id uuid,
  class_id uuid,
  justification_id uuid,
  class_title text,
  class_date_time timestamptz,
  device_id uuid,
  expo_token text
)
language plpgsql
security definer
set search_path = ''
as $funcao$
#variable_conflict use_column
begin
  -- Função que caiu no meio do envio: volta para a fila.
  update public.notification_outbox o
     set status = 'pending'
   where o.status = 'sending'
     and o.claimed_at < now() - interval '10 minutes';

  -- Perderam o sentido antes de sair.
  update public.notification_outbox o
     set status = 'cancelled', last_error = 'obsoleta'
   where o.status = 'pending'
     and (
       exists (select 1 from public.profiles p
                where p.id = o.recipient_id and (p.anonymized_at is not null or p.status <> 'active'))
       or (o.kind in ('mensalidade_vence_em_breve', 'mensalidade_vence_hoje') and not exists (
             select 1 from public.payments pay where pay.id = o.payment_id and pay.status = 'open'))
       or (o.kind = 'mensalidade_atrasada' and not exists (
             select 1 from public.payments pay where pay.id = o.payment_id and pay.status in ('open', 'overdue')))
       or (o.kind = 'comprovante_enviado' and not exists (
             select 1 from public.payments pay where pay.id = o.payment_id and pay.status = 'pending_approval'))
       or (o.kind = 'justificativa_pendente' and not exists (
             select 1 from public.absence_justifications j where j.id = o.justification_id and j.status = 'pending'))
       or (o.kind = 'aula_sem_chamada' and not exists (
             select 1 from public.classes c where c.id = o.class_id and c.attendance_taken_at is null))
     );

  update public.notification_outbox o
     set status = 'cancelled', last_error = 'sem_dispositivo'
   where o.status = 'pending'
     and o.send_after <= now()
     and not exists (select 1 from public.push_devices d where d.user_id = o.recipient_id and d.app_variant = p_variante);

  return query
  with escolhidas as (
    select o.id
      from public.notification_outbox o
     where o.status = 'pending'
       and o.send_after <= now()
     order by o.created_at
     limit greatest(coalesce(p_limite, 0), 0)
     for update skip locked
  ), reivindicadas as (
    update public.notification_outbox o
       set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
      from escolhidas e
     where o.id = e.id
    returning o.id, o.recipient_id, o.kind, o.data, o.payment_id, o.class_id, o.justification_id
  )
  select r.id, r.recipient_id, r.kind, r.data, r.payment_id, r.class_id, r.justification_id,
         c.title, c.date_time, d.id, d.expo_token
    from reivindicadas r
    join public.push_devices d on d.user_id = r.recipient_id and d.app_variant = p_variante
    left join public.classes c on c.id = r.class_id
   order by r.id, d.id;
end;
$funcao$;

-- Resultado do envio. p_entregas: [{outbox_id, device_id, ticket_id, ok, error_code}].
-- Com ao menos um aparelho aceito a notificação sai como 'sent'; só aparelhos
-- inexistentes → 'cancelled'; erro passageiro → volta com espera exponencial;
-- depois de 5 tentativas → 'failed'.
create or replace function public.registrar_envio_de_push(p_entregas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  c_maximo_de_tentativas constant integer := 5;
begin
  with entregas as (
    select (e->>'outbox_id')::uuid as outbox_id,
           nullif(e->>'device_id', '')::uuid as device_id,
           nullif(e->>'ticket_id', '') as ticket_id,
           coalesce((e->>'ok')::boolean, false) as ok,
           nullif(e->>'error_code', '') as error_code
      from jsonb_array_elements(coalesce(p_entregas, '[]'::jsonb)) as e
  ), gravadas as (
    insert into public.notification_deliveries (outbox_id, device_id, expo_ticket_id, ticket_status, error_code)
    select en.outbox_id,
           case when exists (select 1 from public.push_devices d where d.id = en.device_id) then en.device_id end,
           en.ticket_id,
           case when en.ok then 'ok' else 'error' end,
           en.error_code
      from entregas en
    returning 1
  ), resumo as (
    select en.outbox_id,
           bool_or(en.ok) as algum_ok,
           bool_and(not en.ok and en.error_code = 'DeviceNotRegistered') as todos_inexistentes,
           max(en.error_code) filter (where not en.ok) as erro
      from entregas en
     group by en.outbox_id
  )
  update public.notification_outbox o
     set status = case
                    when r.algum_ok then 'sent'::public.notification_status
                    when r.todos_inexistentes then 'cancelled'::public.notification_status
                    when o.attempts >= c_maximo_de_tentativas then 'failed'::public.notification_status
                    else 'pending'::public.notification_status
                  end,
         sent_at = case when r.algum_ok then now() else o.sent_at end,
         last_error = case when r.algum_ok then null when r.todos_inexistentes then 'sem_dispositivo' else r.erro end,
         send_after = case
                        when not r.algum_ok and not r.todos_inexistentes and o.attempts < c_maximo_de_tentativas
                          then now() + make_interval(mins => power(2, o.attempts)::integer)
                        else o.send_after
                      end
    from resumo r
   where o.id = r.outbox_id
     and exists (select 1 from gravadas);

  -- A Expo disse que o aparelho não existe mais: some da base.
  delete from public.push_devices d
   using jsonb_array_elements(coalesce(p_entregas, '[]'::jsonb)) as e
   where d.id = nullif(e->>'device_id', '')::uuid
     and e->>'error_code' = 'DeviceNotRegistered';
end;
$funcao$;

-- Envios com ticket aceito há mais de 15 minutos, cujo recibo ainda não foi visto.
-- A Expo guarda recibos por ~24 h: depois disso não adianta perguntar (e o
-- despachante acordaria a cada minuto por um recibo que nunca vem).
create or replace function public.pendencias_de_recibo_push(p_limite integer)
returns table (delivery_id uuid, ticket_id text)
language sql
stable
security definer
set search_path = ''
as $funcao$
  select d.id, d.expo_ticket_id
    from public.notification_deliveries d
   where d.ticket_status = 'ok'
     and d.receipt_checked_at is null
     and d.expo_ticket_id is not null
     and d.created_at between now() - interval '1 day' and now() - interval '15 minutes'
   order by d.created_at
   limit greatest(coalesce(p_limite, 0), 0);
$funcao$;

-- p_recibos: [{delivery_id, ok, error_code}]. DeviceNotRegistered apaga o aparelho.
create or replace function public.registrar_recibos_de_push(p_recibos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  delete from public.push_devices d
   using public.notification_deliveries nd,
         jsonb_array_elements(coalesce(p_recibos, '[]'::jsonb)) as e
   where nd.id = (e->>'delivery_id')::uuid
     and d.id = nd.device_id
     and e->>'error_code' = 'DeviceNotRegistered';

  update public.notification_deliveries nd
     set receipt_checked_at = now(),
         error_code = coalesce(nullif(e->>'error_code', ''), nd.error_code)
    from jsonb_array_elements(coalesce(p_recibos, '[]'::jsonb)) as e
   where nd.id = (e->>'delivery_id')::uuid;
end;
$funcao$;

-- Chamado a cada minuto pelo pg_cron. Só acorda a Edge Function quando há o que
-- fazer (senão seriam ~43 mil invocações por mês). Sem os segredos no Vault
-- (ambiente ainda não configurado), avisa só quando há fila parada.
create or replace function public.disparar_envio_de_push()
returns void
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_url     text;
  v_segredo text;
begin
  if not exists (select 1 from public.notification_outbox o where o.status = 'pending' and o.send_after <= now())
     and not exists (
       select 1 from public.notification_deliveries d
        where d.ticket_status = 'ok' and d.receipt_checked_at is null
          and d.created_at between now() - interval '1 day' and now() - interval '15 minutes'
     ) then
    return;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'push_project_url';
  select s.decrypted_secret into v_segredo from vault.decrypted_secrets s where s.name = 'push_dispatch_secret';

  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    raise warning 'Push não configurado: faltam push_project_url e/ou push_dispatch_secret no Vault (docs/NOTIFICACOES.md).';
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$funcao$;

-- Retenção de 30 dias (LGPD: minimização) e limpeza do histórico dos jobs de
-- push (o de minuto gera ~1.440 linhas por dia). Os outros jobs não são tocados.
create or replace function public.limpar_notificacoes_antigas(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_apagadas integer;
begin
  delete from public.notification_outbox o
   where o.status in ('sent', 'cancelled', 'failed')
     and o.created_at < p_agora - interval '30 days';
  get diagnostics v_apagadas = row_count;

  delete from cron.job_run_details d
   using cron.job j
   where j.jobid = d.jobid
     and j.jobname like 'push-%'
     and d.start_time < p_agora - interval '7 days';

  return v_apagadas;
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 8. Permissões: nada disso é chamável pelo app
-- ----------------------------------------------------------------------------
revoke execute on function public.horario_permitido_para_push(timestamptz) from public, anon, authenticated;
revoke execute on function public.enfileirar_notificacao(uuid, public.notification_kind, text, jsonb, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.notificar_mudanca_de_pagamento() from public, anon, authenticated;
revoke execute on function public.notificar_justificativa_pendente() from public, anon, authenticated;
revoke execute on function public.enfileirar_lembretes_de_mensalidade(timestamptz) from public, anon, authenticated;
revoke execute on function public.enfileirar_avisos_aula_sem_chamada(timestamptz) from public, anon, authenticated;
revoke execute on function public.enfileirar_resumo_aulas_sem_chamada(timestamptz) from public, anon, authenticated;
revoke execute on function public.reivindicar_notificacoes(integer, public.app_variant) from public, anon, authenticated;
revoke execute on function public.registrar_envio_de_push(jsonb) from public, anon, authenticated;
revoke execute on function public.pendencias_de_recibo_push(integer) from public, anon, authenticated;
revoke execute on function public.registrar_recibos_de_push(jsonb) from public, anon, authenticated;
revoke execute on function public.disparar_envio_de_push() from public, anon, authenticated;
revoke execute on function public.limpar_notificacoes_antigas(timestamptz) from public, anon, authenticated;

grant execute on function public.reivindicar_notificacoes(integer, public.app_variant) to service_role;
grant execute on function public.registrar_envio_de_push(jsonb) to service_role;
grant execute on function public.pendencias_de_recibo_push(integer) to service_role;
grant execute on function public.registrar_recibos_de_push(jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 9. Portabilidade (art. 18, V): aparelhos e notificações entram no export
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
    'frequencia_mensal', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.attendance_monthly m where m.user_id = (select auth.uid())
    ),
    'justificativas', (
      select coalesce(jsonb_agg(to_jsonb(j)), '[]'::jsonb)
      from public.absence_justifications j where j.user_id = (select auth.uid())
    ),
    'pagamentos', (
      select coalesce(jsonb_agg(to_jsonb(pay)), '[]'::jsonb)
      from public.payments pay where pay.user_id = (select auth.uid())
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.consents c where c.user_id = (select auth.uid())
    ),
    'aparelhos_com_notificacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plataforma', d.platform, 'variante', d.app_variant,
               'token', d.expo_token, 'criado_em', d.created_at, 'visto_em', d.last_seen_at)), '[]'::jsonb)
      from public.push_devices d where d.user_id = (select auth.uid())
    ),
    'notificacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tipo', o.kind, 'situacao', o.status, 'criada_em', o.created_at, 'enviada_em', o.sent_at)), '[]'::jsonb)
      from public.notification_outbox o where o.recipient_id = (select auth.uid())
    ),
    'exportado_em', now()
  );
$function$;

comment on function public.export_my_data() is
  'Exporta os dados do titular autenticado em JSON (LGPD art. 18, V): perfil, presenças, frequência mensal, justificativas, pagamentos, consentimentos, aparelhos com notificação e notificações dos últimos 30 dias.';

-- ----------------------------------------------------------------------------
-- 10. Agenda (UTC; São Paulo é UTC-3 sem horário de verão desde 2019)
-- ----------------------------------------------------------------------------
select cron.schedule('push-lembretes-mensalidade', '0 12 * * *', $$select public.enfileirar_lembretes_de_mensalidade()$$);   -- 09:00 SP
select cron.schedule('push-aulas-sem-chamada', '*/15 * * * *', $$select public.enfileirar_avisos_aula_sem_chamada()$$);
select cron.schedule('push-resumo-aulas-sem-chamada', '0 0 * * *', $$select public.enfileirar_resumo_aulas_sem_chamada()$$); -- 21:00 SP
select cron.schedule('push-despachar', '* * * * *', $$select public.disparar_envio_de_push()$$);
select cron.schedule('push-limpeza', '30 6 * * *', $$select public.limpar_notificacoes_antigas()$$);                          -- 03:30 SP
