-- ============================================================================
-- Contrato v4 — cancelar e reativar aula (bloco 4.7a; § 6.1, § 10, D18,
-- D24–D26, D57, T21–T23, T42, T50)
--
-- Quem é avisado sai de UMA função (`destinatarios_da_aula`), usada no
-- cancelamento, na reativação e na prévia da folha "Cancelar aula". Os fixos
-- são os da T42, pela mesma resposta da chamada (`origens_da_chamada`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quem é avisado (D25, T22, T42) — interna
-- ----------------------------------------------------------------------------
create function public.destinatarios_da_aula(p_class_id uuid, p_excluir uuid)
returns table (user_id uuid, papel text)
language sql
stable
security definer
set search_path = ''
as $$
  with aula as (
    select c.id, c.type, c.audience, c.date_time > now() as antes,
           date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date as segunda
      from public.classes c
     where c.id = p_class_id
  ),
  ativos as (
    select p.id from public.profiles p
     where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  ),
  -- Antes da aula: os fixos com a aula na grade, com troca pendente para ela
  -- ou com extra marcada nela, em qualquer público (T42). Quem trocou a aula
  -- por outra fica de fora.
  fixos as (
    select o.user_id, 'fixo'::text as papel
      from aula a
      cross join lateral public.origens_da_chamada(a.id) o
     where a.antes and a.type = 'routine'
       and o.origem in ('turma', 'permanente', 'troca', 'troca_pendente', 'extra')
  ),
  -- Os livres e à vontade ativos, se a aula aceita livres (D25).
  livres as (
    select at.id, 'livre'::text
      from aula a
      join ativos at on true
     where a.antes and a.type = 'routine' and a.audience in ('free', 'both')
       and public.modalidade_da_semana(at.id, a.segunda) <> 'fixed'
  ),
  -- Evento: não tem grade nem público de fixos; avisa quem é aluno ativo.
  evento as (
    select at.id, 'aluno'::text from aula a join ativos at on true where a.antes and a.type = 'event'
  ),
  alunos as (
    select f.user_id, f.papel from fixos f join ativos at on at.id = f.user_id
    union
    select * from livres
    union
    select * from evento
  ),
  -- A equipe da aula e os admins, antes ou depois dela.
  equipe as (
    select ct.teacher_id as user_id, 'professor'::text as papel
      from public.class_teachers ct
      join public.profiles p on p.id = ct.teacher_id and p.status = 'active' and p.anonymized_at is null
     where ct.class_id = p_class_id
    union
    select p.id, 'admin' from public.profiles p
     where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
  )
  select distinct on (t.user_id) t.user_id, t.papel
    from (select * from alunos union all select * from equipe) t
   where t.user_id is distinct from p_excluir
   -- Um admin que dá a aula entra como professor dela.
   order by t.user_id, case t.papel when 'professor' then 0 when 'admin' then 1 else 2 end;
$$;

comment on function public.destinatarios_da_aula(uuid, uuid) is
  'Quem é avisado no cancelamento e na reativação (D25, T22, T42): antes da aula, os alunos (fixos da T42, livres se a aula aceita livres; no evento, todos) e a equipe; depois, só a equipe da aula e os admins. Interna.';

revoke execute on function public.destinatarios_da_aula(uuid, uuid) from public, anon, authenticated;

-- A prévia da folha "Cancelar aula" (mockup da linha C). Fora da lista do
-- contrato: só o app a usa (plano do 4.7, P5).
create function public.quem_sera_avisado(p_class_id uuid)
returns table (
  antes_da_aula boolean,
  fixos         int,
  livres        int,
  alunos_evento int,
  professores   text[],
  admins        int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só o professor da aula ou o admin cancela.' using errcode = '42501';
  end if;
  return query
    select (select c.date_time > now() from public.classes c where c.id = p_class_id),
           (count(*) filter (where d.papel = 'fixo'))::int,
           (count(*) filter (where d.papel = 'livre'))::int,
           (count(*) filter (where d.papel = 'aluno'))::int,
           coalesce(array_agg(p.name order by p.name) filter (where d.papel = 'professor'), '{}'),
           (count(*) filter (where d.papel = 'admin'))::int
      from public.destinatarios_da_aula(p_class_id, (select auth.uid())) d
      join public.profiles p on p.id = d.user_id;
end;
$$;

revoke execute on function public.quem_sera_avisado(uuid) from public, anon;
grant execute on function public.quem_sera_avisado(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. O silêncio das 22h às 7h (§ 10): só o primeiro cancelamento fura, e só
--    para os alunos (a chave deles não tem o carimbo de tempo)
-- ----------------------------------------------------------------------------
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
     case
       -- D25: o aluno fica sabendo na hora que a aula caiu, mesmo à noite.
       when p_tipo = 'aula_cancelada' and p_chave = 'aula_cancelada:' || coalesce(p_class_id::text, '') then p_agora
       else public.horario_permitido_para_push(p_agora)
     end)
  on conflict (recipient_id, dedupe_key) do nothing;

  get diagnostics v_inseridas = row_count;
  return v_inseridas > 0;
end;
$funcao$;

-- ----------------------------------------------------------------------------
-- 3. Cancelar e reativar (§ 6.1)
-- ----------------------------------------------------------------------------
create function public.cancelar_aula(p_class_id uuid, p_motivo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_aula    public.classes%rowtype;
  v_ms      text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
  v_alunos  uuid[];
  v_equipe  uuid[];
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só o professor da aula ou o admin cancela.' using errcode = '42501';
  end if;
  select * into v_aula from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;
  if v_aula.cancelled_at is not null then
    raise exception 'A aula já está cancelada.' using errcode = '23514';
  end if;
  if not public.is_admin() and (
    select count(*) from public.action_reasons r
     where r.kind = 'class_cancel' and r.class_id = p_class_id and r.author_id = v_uid and r.used_at is not null
  ) >= 2 then
    raise exception 'Você já cancelou esta aula duas vezes. Peça ao admin.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.action_reasons r
     where r.id = p_motivo_id and r.kind = 'class_cancel' and r.class_id = p_class_id
       and r.author_id = v_uid and r.used_at is null
  ) then
    raise exception 'Para cancelar, informe o motivo.' using errcode = '22023';
  end if;

  -- Os avisados são calculados ANTES de mexer nas trocas: quem tinha troca
  -- pendente para a aula entra (T42).
  select array_agg(d.user_id) filter (where d.papel in ('fixo', 'livre', 'aluno')),
         array_agg(d.user_id) filter (where d.papel in ('professor', 'admin'))
    into v_alunos, v_equipe
    from public.destinatarios_da_aula(p_class_id, v_uid) d;

  perform set_config('snake.aula_rpc', 'on', true);

  -- A chamada e as declarações ficam guardadas (T23).
  update public.classes set cancelled_at = now() where id = p_class_id;
  insert into public.class_audit (class_id, cancelled_by, cancel_reason_id) values (p_class_id, v_uid, p_motivo_id)
  on conflict (class_id) do update set cancelled_by = excluded.cancelled_by, cancel_reason_id = excluded.cancel_reason_id;
  update public.action_reasons set used_at = now() where id = p_motivo_id;

  -- Trocas (§ 6.1, T50, D57): a pendente que sai desta aula cai; a pendente
  -- para esta aula cai se a original ainda vai acontecer, ou é aprovada pelo
  -- sistema (sem revisão e sem push) com a vaga abonada, se ela já começou.
  -- A aprovada para esta aula fica: a vaga é abonada pela própria conta.
  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = now()
   where s.kind = 'once' and s.status = 'pending' and s.from_class_id = p_class_id;

  update public.class_swaps s
     set status = case when o.date_time <= now() then 'approved'::public.class_swap_status
                       else 'cancelled'::public.class_swap_status end,
         decided_via = 'system', decided_by = null, decided_at = now()
    from public.classes o
   where o.id = s.from_class_id
     and s.kind = 'once' and s.status = 'pending' and s.to_class_id = p_class_id;

  perform public.enfileirar_notificacao(x, 'aula_cancelada', 'aula_cancelada:' || p_class_id::text,
                                        '{}'::jsonb, p_class_id => p_class_id)
     from unnest(coalesce(v_alunos, '{}')) x;
  perform public.enfileirar_notificacao(x, 'aula_cancelada', 'aula_cancelada:' || p_class_id::text || ':' || v_ms,
                                        '{}'::jsonb, p_class_id => p_class_id)
     from unnest(coalesce(v_equipe, '{}')) x;

  perform set_config('snake.aula_rpc', 'off', true);
end;
$$;

comment on function public.cancelar_aula(uuid, uuid) is
  '§ 6.1: cancela a aula com motivo, preserva a chamada (T23), resolve as trocas (T50, D57) e avisa (D25, T42). Equipe da aula ou admin; não-admin até 2 vezes por aula.';

revoke execute on function public.cancelar_aula(uuid, uuid) from public, anon;
grant execute on function public.cancelar_aula(uuid, uuid) to authenticated;

create function public.reativar_aula(p_class_id uuid, p_motivo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_aula public.classes%rowtype;
  v_ms   text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
begin
  if not public.faz_a_chamada(p_class_id) then
    raise exception 'Operação negada: só o professor da aula ou o admin reativa.' using errcode = '42501';
  end if;
  select * into v_aula from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;
  if v_aula.cancelled_at is null then
    raise exception 'A aula não está cancelada.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.action_reasons r
     where r.id = p_motivo_id and r.kind = 'class_reactivate' and r.class_id = p_class_id
       and r.author_id = v_uid and r.used_at is null
  ) then
    raise exception 'Para reativar, informe o motivo.' using errcode = '22023';
  end if;

  perform set_config('snake.aula_rpc', 'on', true);

  -- T50: a troca que aquele cancelamento aprovou pelo sistema volta a
  -- pendente ANTES de calcular os avisos; a cancelada não volta; a aprovada
  -- por decisão ou pela chamada fica, e a aula volta à grade dele sem abono.
  update public.class_swaps s
     set status = 'pending', decided_via = null, decided_by = null, decided_at = null
   where s.kind = 'once' and s.status = 'approved' and s.decided_via = 'system' and s.to_class_id = p_class_id;

  update public.classes set cancelled_at = null where id = p_class_id;
  update public.class_audit set cancelled_by = null, cancel_reason_id = null where class_id = p_class_id;
  update public.action_reasons set used_at = now() where id = p_motivo_id;

  -- Os avisados de agora (T22), respeitando o silêncio.
  perform public.enfileirar_notificacao(d.user_id, 'aula_reativada',
                                        'aula_reativada:' || p_class_id::text || ':' || v_ms,
                                        '{}'::jsonb, p_class_id => p_class_id)
     from public.destinatarios_da_aula(p_class_id, v_uid) d;

  perform set_config('snake.aula_rpc', 'off', true);
end;
$$;

comment on function public.reativar_aula(uuid, uuid) is
  '§ 6.1: reativa a aula com motivo; a troca aprovada pelo sistema volta a pendente (T50); avisa os de agora (T22), respeitando o silêncio.';

revoke execute on function public.reativar_aula(uuid, uuid) from public, anon;
grant execute on function public.reativar_aula(uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Obsolescência (§ 10): mesma assinatura, com as regras novas
-- ----------------------------------------------------------------------------
create or replace function public.reivindicar_notificacoes(p_limite integer, p_variante public.app_variant)
returns table (
  outbox_id uuid, recipient_id uuid, kind public.notification_kind, data jsonb, payment_id uuid, class_id uuid,
  justification_id uuid, class_title text, class_date_time timestamptz, device_id uuid, expo_token text
)
language plpgsql
security definer
set search_path = ''
as $function$
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
       -- § 10 (v4): cancelamento, reativação e trocas.
       or (o.kind in ('aula_sem_chamada', 'justificativa_pendente') and exists (
             select 1 from public.classes c where c.id = o.class_id and c.cancelled_at is not null))
       or (o.kind = 'aula_cancelada' and not exists (
             select 1 from public.classes c where c.id = o.class_id and c.cancelled_at is not null))
       or (o.kind = 'aula_reativada' and exists (
             select 1 from public.classes c where c.id = o.class_id and c.cancelled_at is not null))
       or (o.kind = 'troca_pendente' and not exists (
             select 1 from public.class_swaps s
              where s.id::text = split_part(o.dedupe_key, ':', 2) and s.status = 'pending'))
       or (o.kind in ('troca_aprovada', 'troca_aprovada_equipe') and not exists (
             select 1 from public.class_swaps s
              where s.id::text = split_part(o.dedupe_key, ':', 2) and s.status = 'approved'))
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
$function$;
