-- ============================================================================
-- Contrato v4 — motivos e anexos (bloco 4.6a; § 8, D18, D20, D54, P21, T21,
-- T45, T49)
--
-- As tabelas, a RLS pela `pode_ler_motivo` e os gatilhos de fila já existem
-- (bloco 4.1). Aqui entram as RPCs que criam, anexam e leem os motivos, e os
-- dois crons: o que apaga motivo não usado em 24 h e o que apaga o ARQUIVO
-- vencido (o texto e a decisão ficam para sempre).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Criar e anexar (§ 8)
-- ----------------------------------------------------------------------------
create function public.criar_motivo(p_kind public.action_reason_kind, p_class_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Operação negada: entre no aplicativo para continuar.' using errcode = '42501';
  end if;
  if char_length(v_texto) not between 1 and 500 then
    raise exception 'Escreva o motivo, com até 500 caracteres.' using errcode = '22023';
  end if;

  if p_kind = 'class_swap_evidence' then
    -- A justificativa da troca pertence à troca, não a uma aula (§ 8, v3).
    if p_class_id is not null then
      raise exception 'Motivo de troca não leva aula.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.profiles p
       where p.id = v_uid and p.role = 'user' and p.status = 'active' and p.anonymized_at is null
    ) then
      raise exception 'Operação negada: só aluno ativo pede troca de aula.' using errcode = '42501';
    end if;
  else
    if p_class_id is null or not exists (select 1 from public.classes c where c.id = p_class_id) then
      raise exception 'Aula não encontrada.' using errcode = 'P0002';
    end if;

    if p_kind = 'request_evidence' then
      -- Tipo, prazo e requisitos da solicitação: conferidos em abrir_solicitacao (§ 9.3).
      if not exists (
        select 1 from public.profiles p
         where p.id = v_uid and p.status = 'active' and p.anonymized_at is null
      ) then
        raise exception 'Operação negada: só quem está ativo abre uma solicitação.' using errcode = '42501';
      end if;
    elsif not (
      public.is_admin()
      or exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = v_uid)
    ) then
      -- roll_call_edit, class_cancel e class_reactivate: a equipe da aula ou o admin.
      raise exception 'Operação negada: só o professor da aula ou o admin registra este motivo.' using errcode = '42501';
    end if;
  end if;

  insert into public.action_reasons (kind, class_id, author_id, body)
  values (p_kind, p_class_id, v_uid, v_texto)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.criar_motivo(public.action_reason_kind, uuid, text) is
  '§ 8: cria o motivo (texto de 1 a 500) de uma retificação, cancelamento, reativação, solicitação ou troca. Devolve o id que a ação consome.';

revoke execute on function public.criar_motivo(public.action_reason_kind, uuid, text) from public, anon;
grant execute on function public.criar_motivo(public.action_reason_kind, uuid, text) to authenticated;

-- Só o autor, com o motivo ainda não usado e menos de 5 anexos. O servidor
-- consulta antes de assinar o envio.
create function public.pode_anexar_ao_motivo(p_motivo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.action_reasons r
     where r.id = p_motivo_id
       and r.author_id = (select auth.uid())
       and r.used_at is null
       and (select count(*) from public.action_reason_attachments a where a.reason_id = r.id) < 5
  );
$$;

revoke execute on function public.pode_anexar_ao_motivo(uuid) from public, anon;
grant execute on function public.pode_anexar_ao_motivo(uuid) to authenticated;

create function public.anexar_ao_motivo(
  p_motivo_id uuid,
  p_anexo_id  uuid,
  p_provider  public.media_provider default 'cloudinary'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_anexo_id is null then
    raise exception 'Informe o anexo.' using errcode = '22023';
  end if;
  if not public.pode_anexar_ao_motivo(p_motivo_id) then
    raise exception 'Operação negada: este motivo não aceita mais anexos.' using errcode = '42501';
  end if;
  -- O caminho é derivado aqui, nunca vem do cliente (§ 8).
  insert into public.action_reason_attachments (id, reason_id, uploaded_by, provider, public_id)
  values (p_anexo_id, p_motivo_id, v_uid, p_provider, 'motivos/' || v_uid::text || '/' || p_anexo_id::text);
end;
$$;

revoke execute on function public.anexar_ao_motivo(uuid, uuid, public.media_provider) from public, anon;
grant execute on function public.anexar_ao_motivo(uuid, uuid, public.media_provider) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Ler (§ 8): a mesma visibilidade da RLS
-- ----------------------------------------------------------------------------
create function public.motivos_da_aula(p_class_id uuid)
returns table (
  id          uuid,
  kind        public.action_reason_kind,
  author_name text,
  created_at  timestamptz,
  body        text,
  anexos      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.kind,
         a.name,
         r.created_at,
         r.body,
         coalesce(
           (select jsonb_agg(jsonb_build_object('id', x.id, 'provider', x.provider) order by x.created_at)
              from public.action_reason_attachments x
             where x.reason_id = r.id),
           '[]'::jsonb
         )
    from public.action_reasons r
    left join public.profiles a on a.id = r.author_id
   where r.class_id = p_class_id
     and public.pode_ler_motivo(r.id)
   order by r.created_at;
$$;

revoke execute on function public.motivos_da_aula(uuid) from public, anon;
grant execute on function public.motivos_da_aula(uuid) to authenticated;

-- O admin confere a retificação feita por outra pessoa (§ 9.3, "retificações
-- feitas e ainda não conferidas").
create function public.marcar_retificacao_conferida(p_motivo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_motivo public.action_reasons%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o admin confere retificações.' using errcode = '42501';
  end if;
  select * into v_motivo from public.action_reasons where id = p_motivo_id for update;
  if not found then
    raise exception 'Motivo não encontrado.' using errcode = 'P0002';
  end if;
  if v_motivo.kind <> 'roll_call_edit' or v_motivo.used_at is null then
    raise exception 'Só uma retificação já feita pode ser conferida.' using errcode = '22023';
  end if;
  if v_motivo.author_id = v_uid then
    raise exception 'Operação negada: outra pessoa confere a sua retificação.' using errcode = '42501';
  end if;
  update public.action_reasons
     set audited_at = coalesce(audited_at, now()), audited_by = coalesce(audited_by, v_uid)
   where id = p_motivo_id;
end;
$$;

revoke execute on function public.marcar_retificacao_conferida(uuid) from public, anon;
grant execute on function public.marcar_retificacao_conferida(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Crons (§ 8, D54, T45, P21)
-- ----------------------------------------------------------------------------

-- Motivo criado e nunca usado (a ação desistiu ou falhou) sai em 24 h. O
-- gatilho manda os anexos para a fila. Motivo referenciado nunca sai.
create function public.apagar_motivos_nao_usados(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_apagados integer;
begin
  delete from public.action_reasons r
   where r.used_at is null
     and r.created_at < p_agora - interval '24 hours'
     and not exists (select 1 from public.roll_call_requests q where q.motivo_id = r.id)
     and not exists (select 1 from public.class_swaps s where s.motivo_id = r.id)
     and not exists (select 1 from public.attendance_audit a where a.edit_reason_id = r.id)
     and not exists (select 1 from public.class_teacher_presence t where t.edit_reason_id = r.id)
     and not exists (select 1 from public.class_audit c where c.cancel_reason_id = r.id);
  get diagnostics v_apagados = row_count;
  return v_apagados;
end;
$$;

revoke execute on function public.apagar_motivos_nao_usados(timestamptz) from public, anon, authenticated;

-- Os arquivos cuja decisão passou de attachment_retention_days (180). Antes,
-- cancela as trocas permanentes pendentes cuja aula nova começou há mais de 30
-- dias (P21): daí a justificativa delas conta os 180 dias a partir desse
-- cancelamento. Liga snake.anexo_expirado para os gatilhos gravarem o motivo
-- certo sem mandar o arquivo duas vezes.
create function public.enfileirar_anexos_expirados(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite timestamptz := p_agora - make_interval(days => coalesce(
    (select s.attachment_retention_days from public.academy_settings s limit 1), 180));
  v_antes  integer;
  v_depois integer;
begin
  -- P21: permanente pendente sem decisão, sem push (T42).
  update public.class_swaps s
     set status = 'cancelled', decided_via = 'system', decided_by = null, decided_at = p_agora
   where s.kind = 'permanent'
     and s.status = 'pending'
     and exists (
       select 1 from public.classes c
        where c.id = s.to_class_id and c.date_time < p_agora - interval '30 days'
     );

  select count(*) into v_antes from public.media_deletion_queue;
  perform set_config('snake.anexo_expirado', 'on', true);

  -- Anexos de motivo, pela data de referência de cada tipo (§ 8).
  delete from public.action_reason_attachments x
   using public.action_reasons r
   where r.id = x.reason_id
     and case r.kind
           when 'request_evidence' then
             (select q.reviewed_at from public.roll_call_requests q where q.motivo_id = r.id limit 1)
           when 'class_swap_evidence' then
             (select s.decided_at from public.class_swaps s where s.motivo_id = r.id limit 1)
           else r.used_at
         end < v_limite;

  -- Justificativa decidida: anular o anexo; o gatilho enfileira.
  update public.absence_justifications j
     set proof_provider = null, proof_public_id = null
   where j.proof_public_id is not null
     and j.status <> 'pending'
     and j.reviewed_at < v_limite;

  -- 1ª tentativa negada: não tem gatilho, entra direto na fila.
  with vencidas as (
    update public.absence_justification_attempts t
       set proof_provider = null, proof_public_id = null
      from (select a.justification_id, a.proof_provider, a.proof_public_id
              from public.absence_justification_attempts a
             where a.proof_public_id is not null
               and a.reviewed_at < v_limite) antes
     where t.justification_id = antes.justification_id
    returning antes.proof_provider, antes.proof_public_id, antes.justification_id
  )
  insert into public.media_deletion_queue (provider, asset_ref, justification_id, motivo)
  select v.proof_provider, v.proof_public_id, v.justification_id, 'anexo_expirado'
    from vencidas v;

  perform set_config('snake.anexo_expirado', 'off', true);
  select count(*) into v_depois from public.media_deletion_queue;
  return v_depois - v_antes;
end;
$$;

revoke execute on function public.enfileirar_anexos_expirados(timestamptz) from public, anon, authenticated;

select cron.schedule(
  'delete-unused-reasons',
  '15 * * * *',
  $cron$ select public.apagar_motivos_nao_usados(); $cron$
);

-- 00:50 em São Paulo = 03:50 UTC, depois do fechamento da frequência (03:20)
-- e da grade (03:40).
select cron.schedule(
  'expire-attachments',
  '50 3 * * *',
  $cron$ select public.enfileirar_anexos_expirados(); $cron$
);
