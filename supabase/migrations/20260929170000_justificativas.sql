-- ============================================================================
-- Contrato v4 — justificativas novas (bloco 4.8a; § 9.1, § 10, § 13.5, D13–D16,
-- D22, D39, D42, T16–T18, T38)
--
-- A decisão sai do UPDATE direto (recusado desde o 4.1) e passa por
-- decidir_justificativa, com a nota obrigatória e os avisos. O atestado só é
-- visto por quem decide ENQUANTO está pendente; depois, pelo dono e pelo admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. A trava aceita as RPCs de justificativa (§ 0.1 regra 4, v4)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_absence_justification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  colunas_do_dono constant text[] := array['message', 'proof_provider', 'proof_public_id', 'updated_at'];
  v_uid uuid := (select auth.uid());
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  -- § 0.1 regra 4 (v4): as RPCs de justificativa ligam a variável em volta
  -- da própria escrita; sem coalesce, a sessão nova daria nulo e liberaria.
  v_pela_rpc boolean := coalesce(current_setting('snake.justificativa_rpc', true), '') = 'on';
  v_aula record;
  v_dias smallint[];
  v_ultimo_dia date;
  v_cota smallint;
  coluna text;
begin
  -- (i) DELETE: só o dono, com a linha pendente. Decidida fica (D15).
  if tg_op = 'DELETE' then
    if v_sistema
       or not exists (select 1 from public.profiles p where p.id = old.user_id)
       or (old.class_id is not null and not exists (select 1 from public.classes c where c.id = old.class_id)) then
      return old;
    end if;
    if old.user_id <> v_uid or old.status <> 'pending' then
      raise exception 'Operação negada: só o aluno apaga a própria justificativa, enquanto ela está em análise.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- A semana da justificativa de aula é a da aula, qualquer que seja o valor
  -- enviado: é o que mantém o upsert do APK 1.8 e da web atual funcionando.
  if tg_op = 'INSERT' and new.scope = 'class' then
    select c.type, c.date_time, c.cancelled_at into v_aula from public.classes c where c.id = new.class_id;
    new.week_start := date_trunc('week', v_aula.date_time at time zone 'America/Sao_Paulo')::date;
  end if;

  if v_sistema then
    return new;
  end if;

  -- reenviar, anexar e decidir (§ 9.1): o que (f) a (h) recusam no UPDATE direto.
  if tg_op = 'UPDATE' and v_pela_rpc then
    return new;
  end if;

  -- INSERT ------------------------------------------------------------------
  if tg_op = 'INSERT' then
    -- (e) só a própria, e sempre pendente, tentativa 1.
    if new.user_id is distinct from v_uid then
      raise exception 'Operação negada: cada aluno envia só a própria justificativa.' using errcode = '42501';
    end if;
    if new.status <> 'pending' or new.attempt <> 1 or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Operação negada: justificativa nasce pendente de revisão.' using errcode = '42501';
    end if;

    if new.scope = 'class' then
      -- (c) aula de rotina, não cancelada, da grade efetiva do fixo.
      if v_aula.type is distinct from 'routine' then
        raise exception 'Só aula de rotina tem justificativa.' using errcode = '23514';
      end if;
      if v_aula.cancelled_at is not null then
        raise exception 'Aula cancelada.' using errcode = '23514';
      end if;
      -- T38: a original de uma troca pendente ou aprovada não se justifica.
      if exists (
        select 1 from public.class_swaps s
         where s.user_id = new.user_id and s.kind = 'once'
           and s.from_class_id = new.class_id and s.status in ('pending', 'approved')
      ) then
        raise exception 'Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova.'
          using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.grade_efetiva_do_fixo(array[new.user_id], v_aula.date_time, v_aula.date_time + interval '1 microsecond') g
         where g.class_id = new.class_id
      ) then
        raise exception 'Só dá para justificar uma aula da sua grade.' using errcode = '23514';
      end if;
      -- (b) D13: até 23:59 (SP) do 7º dia depois da aula.
      if now() >= ((v_aula.date_time at time zone 'America/Sao_Paulo')::date + 8)::timestamp at time zone 'America/Sao_Paulo' then
        raise exception 'O prazo para justificar esta aula terminou.' using errcode = '23514';
      end if;
      return new;
    end if;

    -- (d) semana: só o livre (o à vontade não justifica, D39).
    if new.week_start is null
       or extract(isodow from new.week_start) <> 1
       or new.week_start > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Informe a segunda-feira de uma semana que já começou.' using errcode = '22023';
    end if;
    if public.modalidade_da_semana(new.user_id, new.week_start) <> 'free' then
      raise exception 'Justificativa por semana é só para alunos de horário livre.' using errcode = '23514';
    end if;
    -- (b) D13: até 23:59 (SP) do 7º dia depois do último dia de aula da semana.
    select class_weekdays into v_dias from public.academy_settings limit 1;
    select new.week_start + max(((d + 6) % 7))::int into v_ultimo_dia
      from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d;
    if now() >= ((v_ultimo_dia + 8)::timestamp at time zone 'America/Sao_Paulo') then
      raise exception 'O prazo para justificar esta semana terminou.' using errcode = '23514';
    end if;
    -- T17: no máximo cota_W por semana, contando as negadas.
    v_cota := coalesce(public.cota_da_semana(new.user_id, new.week_start), 0);
    if (select count(*) from public.absence_justifications j
         where j.user_id = new.user_id and j.scope = 'week' and j.week_start = new.week_start) >= v_cota then
      raise exception 'Você já enviou as justificativas que cabem nesta semana.' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  -- (h) decisão por update direto (APK 1.8): o caminho é decidir_justificativa (4.8).
  if new.status is distinct from old.status then
    raise exception 'Atualize o aplicativo para decidir justificativas.' using errcode = '22023';
  end if;

  -- (g) decidida não muda por update direto, nem para o admin.
  if old.status <> 'pending' then
    raise exception 'Operação negada: justificativa já decidida não pode ser alterada.' using errcode = '42501';
  end if;

  -- (f) pendente: só o dono, e só o texto e o anexo.
  if old.user_id is distinct from v_uid then
    raise exception 'Operação negada: só o aluno altera a própria justificativa.' using errcode = '42501';
  end if;
  for coluna in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) -> coluna) is distinct from (to_jsonb(new) -> coluna)
       and not (coluna = any (colunas_do_dono)) then
      raise exception 'Operação negada: na justificativa, o aluno só altera o texto e o anexo (coluna "%").', coluna
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 2. Quem decide (D14, T18) — a mesma regra na RLS, nas RPCs e no servidor
--    (§ 13.5, segunda barreira)
-- ----------------------------------------------------------------------------
create function public.pode_decidir_justificativa(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.absence_justifications j
     where j.id = p_id
       and j.status = 'pending'
       and (
         -- De aula: a equipe da aula (D14).
         (j.scope = 'class' and exists (
            select 1 from public.class_teachers ct
             where ct.class_id = j.class_id and ct.teacher_id = (select auth.uid())))
         -- De semana: o professor com presença confirmada numa aula não
         -- cancelada daquela semana (T18).
         or (j.scope = 'week' and exists (
            select 1
              from public.class_teacher_presence tp
              join public.classes c on c.id = tp.class_id
             where tp.teacher_id = (select auth.uid())
               and tp.present
               and c.cancelled_at is null
               and c.date_time >= j.week_start::timestamp at time zone 'America/Sao_Paulo'
               and c.date_time < (j.week_start + 7)::timestamp at time zone 'America/Sao_Paulo'))
       )
  );
$$;

comment on function public.pode_decidir_justificativa(uuid) is
  '§ 9.1 (D14, T18): pendente e de alguém da equipe da aula (de aula) ou de quem deu aula na semana (de semana). O admin decide qualquer uma à parte. Usada pela RLS, pelas RPCs e pela segunda barreira do servidor (§ 13.5).';

revoke execute on function public.pode_decidir_justificativa(uuid) from public, anon;
grant execute on function public.pode_decidir_justificativa(uuid) to authenticated;

-- RLS de leitura (§ 9.1): o dono, o admin e, SÓ enquanto pendente, quem pode
-- decidir. Depois da decisão, o atestado é do dono e do admin (D22).
drop policy absence_justifications_select_own_admin_or_teacher on public.absence_justifications;
create policy absence_justifications_select_quem_pode on public.absence_justifications
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_admin())
    or public.pode_decidir_justificativa(id)
  );

-- O UPDATE direto continua alcançando quem vê a linha: assim a decisão pelo
-- APK 1.8 chega ao gatilho e recebe "Atualize o aplicativo" (§ 15), em vez de
-- mudar zero linhas em silêncio. Quem muda o quê, o gatilho decide (§ 9.1 f–h).
drop policy absence_justifications_update_own_admin_or_teacher on public.absence_justifications;
create policy absence_justifications_update_quem_pode on public.absence_justifications
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_admin())
    or public.pode_decidir_justificativa(id)
  );

-- ----------------------------------------------------------------------------
-- 3. O aviso de justificativa pendente (§ 10): quem pode decidir; sem
--    ninguém, os admins. A tentativa 2 tem chave própria.
-- ----------------------------------------------------------------------------
create function public.avisar_justificativa_pendente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_just public.absence_justifications%rowtype;
  v_destinatarios uuid[];
  v_chave text;
begin
  select * into v_just from public.absence_justifications where id = p_id;
  if not found or v_just.status <> 'pending' then
    return;
  end if;

  if v_just.scope = 'class' then
    v_destinatarios := array(
      select ct.teacher_id
        from public.class_teachers ct
        join public.profiles p on p.id = ct.teacher_id and p.status = 'active' and p.anonymized_at is null
       where ct.class_id = v_just.class_id
    );
  else
    v_destinatarios := array(
      select distinct tp.teacher_id
        from public.class_teacher_presence tp
        join public.classes c on c.id = tp.class_id
        join public.profiles p on p.id = tp.teacher_id and p.status = 'active' and p.anonymized_at is null
       where tp.present
         and c.cancelled_at is null
         and c.date_time >= v_just.week_start::timestamp at time zone 'America/Sao_Paulo'
         and c.date_time < (v_just.week_start + 7)::timestamp at time zone 'America/Sao_Paulo'
    );
  end if;
  if coalesce(array_length(v_destinatarios, 1), 0) = 0 then
    v_destinatarios := array(
      select p.id from public.profiles p where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
    );
  end if;

  v_chave := 'justificativa_pendente:' || p_id::text || case when v_just.attempt = 2 then ':2' else '' end;
  perform public.enfileirar_notificacao(x, 'justificativa_pendente', v_chave, '{}'::jsonb,
                                        null, v_just.class_id, p_id)
     from unnest(v_destinatarios) x;
end;
$$;

revoke execute on function public.avisar_justificativa_pendente(uuid) from public, anon, authenticated;

create or replace function public.notificar_justificativa_pendente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Aviso não pode derrubar o envio da justificativa.
  begin
    perform public.avisar_justificativa_pendente(new.id);
  exception when others then
    raise warning 'Notificação de justificativa não enfileirada (%): %', sqlstate, sqlerrm;
  end;
  return new;
end;
$$;

-- O anexo da tentativa 1 vai para o arquivo do admin no reenvio (D42): ele
-- não é apagado, então não entra na fila de exclusão.
create or replace function public.enfileirar_exclusao_de_anexo_justificativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.proof_public_id is null then
    return coalesce(new, old);
  end if;
  -- Em UPDATE, só interessa quando o anexo foi TROCADO ou REMOVIDO.
  if tg_op = 'UPDATE' and new.proof_public_id is not distinct from old.proof_public_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.absence_justification_attempts a
     where a.justification_id = old.id and a.proof_public_id = old.proof_public_id
  ) then
    return new;
  end if;

  insert into public.media_deletion_queue (provider, asset_ref, justification_id, motivo)
  values (
    old.proof_provider,
    old.proof_public_id,
    -- Em DELETE a linha já não existe: referenciá-la violaria a FK.
    case when tg_op = 'DELETE' then null else old.id end,
    case when current_setting('snake.anexo_expirado', true) = 'on'
         then 'anexo_expirado'::public.media_deletion_reason
         else 'justificativa_removida'::public.media_deletion_reason
    end
  );

  return coalesce(new, old);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. As RPCs (§ 9.1)
-- ----------------------------------------------------------------------------
create function public.enviar_justificativa(
  p_scope      public.justification_scope,
  p_class_id   uuid,
  p_week_start date,
  p_texto      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Operação negada: entre no aplicativo para continuar.' using errcode = '42501';
  end if;
  if char_length(v_texto) not between 1 and 255 then
    raise exception 'Escreva o motivo da falta.' using errcode = '22023';
  end if;
  if p_scope = 'class' and p_class_id is null or p_scope = 'week' and p_week_start is null then
    raise exception 'Informe a aula ou a semana.' using errcode = '22023';
  end if;

  -- As travas de prazo, grade, troca e cota são as do gatilho (§ 9.1 b–e).
  begin
    insert into public.absence_justifications (user_id, scope, class_id, week_start, message)
    values ((select auth.uid()), p_scope,
            case when p_scope = 'class' then p_class_id end,
            case when p_scope = 'week' then p_week_start end,
            v_texto)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Você já enviou uma justificativa para esta aula.' using errcode = '23514';
  end;
  return v_id;
end;
$$;

revoke execute on function public.enviar_justificativa(public.justification_scope, uuid, date, text) from public, anon;
grant execute on function public.enviar_justificativa(public.justification_scope, uuid, date, text) to authenticated;

create function public.reenviar_justificativa(p_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_texto text := btrim(coalesce(p_texto, ''));
  v_just  public.absence_justifications%rowtype;
  v_rev   public.absence_justification_reviews%rowtype;
begin
  if char_length(v_texto) not between 1 and 255 then
    raise exception 'Escreva o motivo da falta.' using errcode = '22023';
  end if;
  select * into v_just from public.absence_justifications where id = p_id for update;
  if not found or v_just.user_id is distinct from v_uid then
    raise exception 'Operação negada: só o aluno reenvia a própria justificativa.' using errcode = '42501';
  end if;
  if v_just.status <> 'rejected' or v_just.attempt <> 1 then
    raise exception 'Só a primeira justificativa negada pode ser reenviada.' using errcode = '23514';
  end if;
  -- D42: até 23:59 (SP) do 7º dia depois da negativa.
  if now() >= public.limite_de_7_dias(v_just.reviewed_at) then
    raise exception 'O prazo para reenviar terminou.' using errcode = '23514';
  end if;

  -- A tentativa 1 vai para o arquivo só do admin (T16), com a nota.
  select * into v_rev from public.absence_justification_reviews where justification_id = p_id;
  insert into public.absence_justification_attempts
    (justification_id, message, proof_provider, proof_public_id, reviewer_id, reviewed_at, review_note)
  values (p_id, v_just.message, v_just.proof_provider, v_just.proof_public_id, v_rev.reviewer_id,
          v_just.reviewed_at, v_rev.review_note);
  delete from public.absence_justification_reviews where justification_id = p_id;

  perform set_config('snake.justificativa_rpc', 'on', true);
  update public.absence_justifications
     set status = 'pending', attempt = 2, message = v_texto,
         proof_provider = null, proof_public_id = null,
         reviewed_by = null, reviewed_at = null
   where id = p_id;
  perform set_config('snake.justificativa_rpc', 'off', true);

  perform public.avisar_justificativa_pendente(p_id);
end;
$$;

revoke execute on function public.reenviar_justificativa(uuid, text) from public, anon;
grant execute on function public.reenviar_justificativa(uuid, text) to authenticated;

create function public.anexar_a_justificativa(p_id uuid, p_provider public.media_provider default 'cloudinary')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_just public.absence_justifications%rowtype;
begin
  select * into v_just from public.absence_justifications where id = p_id for update;
  if not found or v_just.user_id is distinct from v_uid then
    raise exception 'Operação negada: só o aluno anexa à própria justificativa.' using errcode = '42501';
  end if;
  if v_just.status <> 'pending' or v_just.proof_public_id is not null then
    raise exception 'Esta justificativa não aceita mais anexo.' using errcode = '23514';
  end if;
  -- O caminho é derivado aqui, nunca vem do cliente (§ 9.1).
  perform set_config('snake.justificativa_rpc', 'on', true);
  update public.absence_justifications
     set proof_provider = p_provider,
         proof_public_id = 'justificativas/' || v_uid::text || '/' || p_id::text
                           || case when v_just.attempt = 2 then '-2' else '' end
   where id = p_id;
  perform set_config('snake.justificativa_rpc', 'off', true);
end;
$$;

revoke execute on function public.anexar_a_justificativa(uuid, public.media_provider) from public, anon;
grant execute on function public.anexar_a_justificativa(uuid, public.media_provider) to authenticated;

create function public.decidir_justificativa(p_id uuid, p_decisao public.justification_status, p_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_nota text := btrim(coalesce(p_nota, ''));
  v_just public.absence_justifications%rowtype;
begin
  if p_decisao is null or p_decisao not in ('approved', 'rejected') then
    raise exception 'Escolha aprovar ou negar.' using errcode = '22023';
  end if;
  -- D15: quem decide escreve o motivo.
  if char_length(v_nota) not between 1 and 500 then
    raise exception 'Escreva a nota da decisão, com até 500 caracteres.' using errcode = '22023';
  end if;
  select * into v_just from public.absence_justifications where id = p_id for update;
  if not found then
    raise exception 'Justificativa não encontrada.' using errcode = 'P0002';
  end if;
  if v_just.status <> 'pending' then
    raise exception 'Esta justificativa já foi decidida.' using errcode = '23514';
  end if;
  if not (public.is_admin() or public.pode_decidir_justificativa(p_id)) then
    raise exception 'Operação negada: você não decide esta justificativa.' using errcode = '42501';
  end if;

  perform set_config('snake.justificativa_rpc', 'on', true);
  update public.absence_justifications
     -- D16: quem negou não aparece na linha; fica só na revisão, para o admin.
     set status = p_decisao,
         reviewed_by = case when p_decisao = 'approved' then v_uid end,
         reviewed_at = now()
   where id = p_id;
  perform set_config('snake.justificativa_rpc', 'off', true);

  insert into public.absence_justification_reviews (justification_id, reviewer_id, review_note, decided_at)
  values (p_id, v_uid, v_nota, now())
  on conflict (justification_id) do update
     set reviewer_id = excluded.reviewer_id, review_note = excluded.review_note, decided_at = excluded.decided_at;

  if p_decisao = 'approved' then
    perform public.enfileirar_notificacao(v_just.user_id, 'justificativa_aprovada',
      'justificativa_aprovada:' || p_id::text || ':' || v_just.attempt::text, '{}'::jsonb,
      null, v_just.class_id, p_id);
  else
    perform public.enfileirar_notificacao(v_just.user_id, 'justificativa_negada',
      'justificativa_negada:' || p_id::text || ':' || v_just.attempt::text,
      jsonb_build_object('tentativa', v_just.attempt), null, v_just.class_id, p_id);
  end if;
end;
$$;

revoke execute on function public.decidir_justificativa(uuid, public.justification_status, text) from public, anon;
grant execute on function public.decidir_justificativa(uuid, public.justification_status, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Leituras (§ 9.1)
-- ----------------------------------------------------------------------------
create function public.minhas_justificativas()
returns table (
  id               uuid,
  scope            public.justification_scope,
  class_id         uuid,
  class_title      text,
  class_date_time  timestamptz,
  week_start       date,
  message          text,
  has_attachment   boolean,
  status           public.justification_status,
  attempt          smallint,
  approved_by_name text,
  can_resend       boolean,
  resend_until     timestamptz,
  created_at       timestamptz,
  reviewed_at      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.scope, j.class_id, c.title, c.date_time, j.week_start, j.message,
         j.proof_public_id is not null, j.status, j.attempt,
         -- D16: quem aprovou aparece; quem negou, nunca.
         case when j.status = 'approved' then r.name end,
         j.status = 'rejected' and j.attempt = 1 and now() < public.limite_de_7_dias(j.reviewed_at),
         case when j.status = 'rejected' and j.attempt = 1 then public.limite_de_7_dias(j.reviewed_at) end,
         j.created_at, j.reviewed_at
    from public.absence_justifications j
    left join public.classes c on c.id = j.class_id
    left join public.profiles r on r.id = j.reviewed_by
   where j.user_id = (select auth.uid())
   order by j.created_at desc;
$$;

revoke execute on function public.minhas_justificativas() from public, anon;
grant execute on function public.minhas_justificativas() to authenticated;

create function public.justificativas_para_revisar()
returns table (
  id              uuid,
  scope           public.justification_scope,
  user_id         uuid,
  student_name    text,
  class_id        uuid,
  class_title     text,
  class_date_time timestamptz,
  week_start      date,
  message         text,
  has_attachment  boolean,
  attempt         smallint,
  created_at      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.scope, j.user_id, p.name, j.class_id, c.title, c.date_time, j.week_start, j.message,
         j.proof_public_id is not null, j.attempt, j.created_at
    from public.absence_justifications j
    join public.profiles p on p.id = j.user_id
    left join public.classes c on c.id = j.class_id
   where j.status = 'pending'
     and (public.is_admin() or public.pode_decidir_justificativa(j.id))
   order by j.created_at;
$$;

revoke execute on function public.justificativas_para_revisar() from public, anon;
grant execute on function public.justificativas_para_revisar() to authenticated;

create function public.justificativas_do_aluno(
  p_user_id uuid default null,
  p_de      date default null,
  p_ate     date default null
)
returns table (
  id               uuid,
  scope            public.justification_scope,
  user_id          uuid,
  student_name     text,
  class_id         uuid,
  class_title      text,
  class_date_time  timestamptz,
  week_start       date,
  status           public.justification_status,
  attempt          smallint,
  approved_by_name text,
  reviewed_by_name text,
  review_note      text,
  first_attempt    jsonb,
  reviewed_at      timestamptz,
  created_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin boolean := public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Operação negada: o histórico de justificativas é da equipe.' using errcode = '42501';
  end if;
  if p_user_id is null and not v_admin then
    raise exception 'Operação negada: só o admin vê as justificativas de todos.' using errcode = '42501';
  end if;
  return query
    select j.id, j.scope, j.user_id, p.name, j.class_id, c.title, c.date_time, j.week_start, j.status, j.attempt,
           case when j.status = 'approved' then ap.name end,
           -- Estes três só para o admin (D15, D16).
           case when v_admin then rv.name end,
           case when v_admin then r.review_note end,
           case when v_admin then (
             select jsonb_build_object('message', a.message, 'review_note', a.review_note,
                                       'reviewed_at', a.reviewed_at, 'has_attachment', a.proof_public_id is not null)
               from public.absence_justification_attempts a where a.justification_id = j.id)
           end,
           j.reviewed_at, j.created_at
      from public.absence_justifications j
      join public.profiles p on p.id = j.user_id
      left join public.classes c on c.id = j.class_id
      left join public.profiles ap on ap.id = j.reviewed_by
      left join public.absence_justification_reviews r on r.justification_id = j.id
      left join public.profiles rv on rv.id = r.reviewer_id
     where (p_user_id is null or j.user_id = p_user_id)
       and (p_de is null or coalesce((c.date_time at time zone 'America/Sao_Paulo')::date, j.week_start) >= p_de)
       and (p_ate is null or coalesce((c.date_time at time zone 'America/Sao_Paulo')::date, j.week_start) <= p_ate)
     order by j.created_at desc;
end;
$$;

revoke execute on function public.justificativas_do_aluno(uuid, date, date) from public, anon;
grant execute on function public.justificativas_do_aluno(uuid, date, date) to authenticated;
