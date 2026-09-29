-- ============================================================================
-- Contrato v4 — Solicitações (bloco 4.9a; § 9.3, § 10, D28–D30, D40, T19, T20, T38)
--
-- A tabela roll_call_requests nasceu no 4.1, sem grant nem política para
-- authenticated: tudo passa por estas RPCs. Quem pediu nunca vê quem negou
-- nem a nota (D16).
--
-- - pode_decidir_solicitacao: a regra única de quem decide;
-- - abrir_solicitacao / decidir_solicitacao, com os efeitos da aprovação;
-- - minhas_solicitacoes (quem pediu);
-- - caixa_de_solicitacoes / itens_da_solicitacao (a caixa da equipe);
-- - solicitacoes_decididas (só admin);
-- - solicitacao_para_decidir: o texto e o tipo para a folha de decisão
--   (fora da lista da § 9.3; entra no contrato na próxima revisão);
-- - o aviso solicitacao_pendente (§ 10).
--
-- A categoria trocas_de_aula já existe e fica vazia até o 4.9b.
-- ============================================================================

create index if not exists roll_call_requests_por_pessoa on public.roll_call_requests (subject_id);

-- ----------------------------------------------------------------------------
-- 1. Quem decide (§ 9.3)
-- ----------------------------------------------------------------------------
-- Pendente; o "eu estava na aula" é da equipe da aula ou do admin; os
-- pedidos de professor, só do admin. Ninguém decide o próprio pedido.
create function public.pode_decidir_solicitacao(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.roll_call_requests r
     where r.id = p_id
       and r.status = 'pending'
       and r.subject_id <> (select auth.uid())
       and r.requester_id is distinct from (select auth.uid())
       and (
         public.is_admin()
         or (r.kind = 'student_was_present' and exists (
               select 1 from public.class_teachers ct
                where ct.class_id = r.class_id and ct.teacher_id = (select auth.uid())
             ))
       )
  );
$$;

comment on function public.pode_decidir_solicitacao(uuid) is
  '§ 9.3: pendente, e a equipe da aula (só no student_was_present) ou o admin. Ninguém decide o próprio pedido.';

revoke execute on function public.pode_decidir_solicitacao(uuid) from public, anon;
grant execute on function public.pode_decidir_solicitacao(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. O aviso a quem pode decidir (§ 10)
-- ----------------------------------------------------------------------------
create function public.avisar_solicitacao_pendente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.roll_call_requests%rowtype;
  v_destinatarios uuid[] := '{}';
begin
  select * into v_req from public.roll_call_requests where id = p_id;
  if not found or v_req.status <> 'pending' then
    return;
  end if;

  if v_req.kind = 'student_was_present' then
    v_destinatarios := array(
      select ct.teacher_id
        from public.class_teachers ct
        join public.profiles p on p.id = ct.teacher_id and p.status = 'active' and p.anonymized_at is null
       where ct.class_id = v_req.class_id
    );
  end if;
  -- Pedido de professor, ou aula sem equipe: os admins.
  if coalesce(array_length(v_destinatarios, 1), 0) = 0 then
    v_destinatarios := array(
      select p.id from public.profiles p
       where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
         and p.id <> v_req.subject_id
    );
  end if;

  perform public.enfileirar_notificacao(x, 'solicitacao_pendente', 'solicitacao_pendente:' || p_id::text,
                                        '{}'::jsonb, null, v_req.class_id)
     from unnest(v_destinatarios) x;
end;
$$;

revoke execute on function public.avisar_solicitacao_pendente(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Abrir (§ 9.3, T19, T38)
-- ----------------------------------------------------------------------------
create function public.abrir_solicitacao(
  p_kind public.roll_call_request_kind,
  p_class_id uuid,
  p_motivo_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_eu    public.profiles%rowtype;
  v_aula  public.classes%rowtype;
  v_pode  boolean;
  v_escalado boolean;
  v_id    uuid;
begin
  select * into v_eu from public.profiles
   where id = v_uid and status = 'active' and anonymized_at is null;
  if not found then
    raise exception 'Operação negada: só quem está ativo abre uma solicitação.' using errcode = '42501';
  end if;

  select * into v_aula from public.classes where id = p_class_id for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  -- O motivo desta aula, de quem pede, ainda não usado (§ 8).
  if not exists (
    select 1 from public.action_reasons r
     where r.id = p_motivo_id and r.kind = 'request_evidence' and r.class_id = p_class_id
       and r.author_id = v_uid and r.used_at is null
  ) then
    raise exception 'Para pedir, escreva o motivo.' using errcode = '22023';
  end if;

  if v_aula.cancelled_at is not null then
    raise exception 'Aula cancelada não aceita pedido.' using errcode = '23514';
  end if;
  -- T19: até 23:59 (SP) do 7º dia depois da aula.
  if now() >= public.limite_de_7_dias(v_aula.date_time) then
    raise exception 'O prazo para este pedido terminou.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.roll_call_requests q
     where q.kind = p_kind and q.class_id = p_class_id and q.subject_id = v_uid
  ) then
    raise exception 'Você já fez este pedido para esta aula.' using errcode = '23514';
  end if;

  v_escalado := exists (
    select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = v_uid
  );

  if p_kind = 'student_was_present' then
    if v_eu.role <> 'user' then
      raise exception 'Operação negada: só aluno pede "Eu estava na aula".' using errcode = '42501';
    end if;
    if v_aula.attendance_taken_at is null then
      raise exception 'A chamada desta aula ainda não foi feita.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.attendance a
       where a.class_id = p_class_id and a.user_id = v_uid and a.status = 'present'
    ) then
      raise exception 'Você já está com presença nesta aula.' using errcode = '23514';
    end if;
    -- T38 (c): a original de troca pendente ou aprovada não aceita o pedido.
    if exists (
      select 1 from public.class_swaps s
       where s.user_id = v_uid and s.from_class_id = p_class_id
         and (s.status = 'pending' or (s.kind = 'once' and s.status = 'approved'))
    ) then
      raise exception 'Esta aula foi trocada.' using errcode = '23514';
    end if;
    -- O "visível ao aluno" é o de aulas_do_aluno (§ 12): uma regra só.
    select b.can_contest into v_pode
      from public.aulas_do_aluno_base(v_uid, v_aula.date_time, v_aula.date_time + interval '1 second', now(), false) b
     where b.class_id = p_class_id;
    if not coalesce(v_pode, false) then
      raise exception 'Esta aula não aceita o pedido.' using errcode = '23514';
    end if;
  else
    if v_eu.role not in ('professor', 'admin') then
      raise exception 'Operação negada: só a equipe faz este pedido.' using errcode = '42501';
    end if;
    if p_kind = 'teacher_was_present' then
      if v_aula.attendance_taken_at is null then
        raise exception 'A chamada desta aula ainda não foi feita.' using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.class_teacher_presence tp
         where tp.class_id = p_class_id and tp.teacher_id = v_uid and not tp.present
      ) then
        raise exception 'Você não está marcado como ausente nesta aula.' using errcode = '23514';
      end if;
    elsif p_kind = 'teacher_absence' then
      if not v_escalado then
        raise exception 'Você não está escalado nesta aula.' using errcode = '23514';
      end if;
    elsif p_kind = 'teacher_asks_edit' then
      if v_escalado then
        raise exception 'Você está nesta aula: corrija pela chamada.' using errcode = '23514';
      end if;
      if v_aula.attendance_taken_at is null then
        raise exception 'A chamada desta aula ainda não foi feita.' using errcode = '23514';
      end if;
    elsif p_kind = 'teacher_asks_inclusion' then
      if v_escalado then
        raise exception 'Você já está nesta aula.' using errcode = '23514';
      end if;
      if v_aula.date_time > now() then
        raise exception 'A aula ainda não começou.' using errcode = '23514';
      end if;
      if v_eu.color is null then
        raise exception 'Escolha a sua cor antes de pedir.' using errcode = '23514';
      end if;
    end if;
  end if;

  insert into public.roll_call_requests (kind, class_id, requester_id, subject_id, motivo_id)
  values (p_kind, p_class_id, v_uid, v_uid, p_motivo_id)
  returning id into v_id;

  update public.action_reasons set used_at = now() where id = p_motivo_id;

  perform public.avisar_solicitacao_pendente(v_id);
  return v_id;
end;
$$;

comment on function public.abrir_solicitacao(public.roll_call_request_kind, uuid, uuid) is
  '§ 9.3: abre uma solicitação com o motivo (request_evidence) de quem pede. Uma por tipo, aula e pessoa, sem reenvio (T19).';

revoke execute on function public.abrir_solicitacao(public.roll_call_request_kind, uuid, uuid) from public, anon;
grant execute on function public.abrir_solicitacao(public.roll_call_request_kind, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Decidir (§ 9.3: os efeitos da aprovação)
-- ----------------------------------------------------------------------------
create function public.decidir_solicitacao(p_id uuid, p_decisao public.justification_status, p_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_req     public.roll_call_requests%rowtype;
  v_aula    public.classes%rowtype;
  v_nota    text := btrim(coalesce(p_nota, ''));
  v_motivo  uuid;
  v_origem  text;
  v_atual   public.attendance_status;
  v_tinha   boolean;
  v_att     uuid;
  v_ms      text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
begin
  if p_decisao is null or p_decisao not in ('approved', 'rejected') then
    raise exception 'Escolha aprovar ou negar.' using errcode = '22023';
  end if;
  if char_length(v_nota) not between 1 and 500 then
    raise exception 'Escreva a nota da decisão, com até 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_req from public.roll_call_requests where id = p_id for update;
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Esta solicitação já foi decidida.' using errcode = '23514';
  end if;
  if v_req.subject_id = v_uid or v_req.requester_id = v_uid then
    raise exception 'Operação negada: ninguém decide o próprio pedido.' using errcode = '42501';
  end if;
  if not public.pode_decidir_solicitacao(p_id) then
    raise exception 'Operação negada: você não pode decidir esta solicitação.' using errcode = '42501';
  end if;

  if p_decisao = 'approved' and v_req.kind in ('student_was_present', 'teacher_was_present', 'teacher_asks_inclusion') then
    select * into v_aula from public.classes where id = v_req.class_id for update;
    if v_aula.cancelled_at is not null then
      raise exception 'Aula cancelada não tem chamada.' using errcode = '23514';
    end if;

    perform set_config('snake.chamada_rpc', 'on', true);
    perform set_config('snake.aula_rpc', 'on', true);

    if v_req.kind = 'student_was_present' then
      select a.status, a.id into v_atual, v_att
        from public.attendance a where a.class_id = v_req.class_id and a.user_id = v_req.subject_id;
      v_tinha := found;

      if v_atual is distinct from 'present' then
        -- A retificação leva um motivo do revisor, com a nota como texto (§ 9.3).
        insert into public.action_reasons (kind, class_id, author_id, body, used_at)
        values ('roll_call_edit', v_req.class_id, v_uid, v_nota, now())
        returning id into v_motivo;

        select o.origem into v_origem
          from public.origens_da_chamada(v_req.class_id) o where o.user_id = v_req.subject_id;

        -- Sem linha na chamada, o aluno entra como incluído.
        insert into public.attendance (class_id, user_id, status, included, edited)
        values (v_req.class_id, v_req.subject_id, 'present', v_origem is null, true)
        on conflict (class_id, user_id) do update
           set status = 'present',
               included = public.attendance.included or excluded.included,
               edited = true
        returning id into v_att;

        insert into public.attendance_audit (attendance_id, added_by, previous_status, edited_by, edited_at, edit_reason_id)
        values (v_att, case when v_origem is null and not v_tinha then v_uid end, v_atual, v_uid, now(), v_motivo)
        on conflict (attendance_id) do update
           set added_by = coalesce(public.attendance_audit.added_by, excluded.added_by),
               previous_status = excluded.previous_status,
               edited_by = excluded.edited_by,
               edited_at = excluded.edited_at,
               edit_reason_id = excluded.edit_reason_id;

        -- D21: o aluno é avisado da retificação.
        perform public.enfileirar_notificacao(
          v_req.subject_id, 'chamada_retificada',
          'chamada_retificada:' || v_req.class_id::text || ':' || v_req.subject_id::text || ':' || v_ms,
          '{}'::jsonb, p_class_id => v_req.class_id
        );
      end if;
    elsif v_req.kind = 'teacher_was_present' then
      insert into public.action_reasons (kind, class_id, author_id, body, used_at)
      values ('roll_call_edit', v_req.class_id, v_uid, v_nota, now())
      returning id into v_motivo;

      update public.class_teacher_presence
         set present = true, previous = false, edited_by = v_uid, edited_at = now(), edit_reason_id = v_motivo
       where class_id = v_req.class_id and teacher_id = v_req.subject_id and not present;
    else
      -- teacher_asks_inclusion: entra como acrescentado na chamada (D27).
      insert into public.class_teachers (class_id, teacher_id)
      values (v_req.class_id, v_req.subject_id)
      on conflict do nothing;
      insert into public.class_teacher_presence (class_id, teacher_id, present, added_in_roll_call, set_by)
      values (v_req.class_id, v_req.subject_id, true, true, v_uid)
      on conflict (class_id, teacher_id) do update
         set present = true, added_in_roll_call = true;
    end if;

    if v_motivo is not null then
      update public.classes set attendance_edited = true where id = v_req.class_id;
      insert into public.class_audit (class_id, attendance_edited_by, attendance_edited_at)
      values (v_req.class_id, v_uid, now())
      on conflict (class_id) do update
         set attendance_edited_by = excluded.attendance_edited_by, attendance_edited_at = excluded.attendance_edited_at;
    end if;

    perform set_config('snake.chamada_rpc', 'off', true);
    perform set_config('snake.aula_rpc', 'off', true);
  end if;
  -- teacher_absence (T20) e teacher_asks_edit só mudam de estado: o abono do
  -- professor lê a aprovada, e o admin corrige a chamada pela tela dela.

  update public.roll_call_requests
     set status = p_decisao, reviewed_by = v_uid, reviewed_at = now(), review_note = v_nota
   where id = p_id;
end;
$$;

comment on function public.decidir_solicitacao(uuid, public.justification_status, text) is
  '§ 9.3: aprova ou nega com nota obrigatória; na aprovação, retifica a presença do aluno ou do professor, ou inclui o professor.';

revoke execute on function public.decidir_solicitacao(uuid, public.justification_status, text) from public, anon;
grant execute on function public.decidir_solicitacao(uuid, public.justification_status, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Leituras
-- ----------------------------------------------------------------------------
create function public.minhas_solicitacoes()
returns table (
  id uuid, kind public.roll_call_request_kind, class_id uuid, class_title text,
  class_date_time timestamptz, status public.justification_status,
  approved_by_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.kind, r.class_id, c.title, c.date_time, r.status,
         -- D16: quem negou nunca aparece.
         case when r.status = 'approved' then p.name end,
         r.created_at
    from public.roll_call_requests r
    join public.classes c on c.id = r.class_id
    left join public.profiles p on p.id = r.reviewed_by
   where r.subject_id = (select auth.uid())
   order by r.created_at desc;
$$;

revoke execute on function public.minhas_solicitacoes() from public, anon;
grant execute on function public.minhas_solicitacoes() to authenticated;

-- O que a folha de decisão mostra: tipo, aula, quem pediu e o texto.
create function public.solicitacao_para_decidir(p_id uuid)
returns table (
  id uuid, kind public.roll_call_request_kind, class_id uuid, class_title text,
  class_date_time timestamptz, subject_id uuid, subject_name text,
  motivo_id uuid, texto text, anexos int, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode_decidir_solicitacao(p_id) then
    raise exception 'Operação negada: você não pode decidir esta solicitação.' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.class_id, c.title, c.date_time, r.subject_id, p.name,
           r.motivo_id, m.body,
           (select count(*)::int from public.action_reason_attachments x where x.reason_id = r.motivo_id),
           r.created_at
      from public.roll_call_requests r
      join public.classes c on c.id = r.class_id
      join public.action_reasons m on m.id = r.motivo_id
      left join public.profiles p on p.id = r.subject_id
     where r.id = p_id;
end;
$$;

comment on function public.solicitacao_para_decidir(uuid) is
  'A folha de decisão (4.9a): só para quem pode decidir, enquanto pendente. Fora da lista da § 9.3; entra no contrato na próxima revisão.';

revoke execute on function public.solicitacao_para_decidir(uuid) from public, anon;
grant execute on function public.solicitacao_para_decidir(uuid) to authenticated;

-- A ordem é a do rótulo da § 3.
create function public.itens_da_solicitacao(p_categoria text)
returns table (
  tipo text, id uuid, class_id uuid, payment_id uuid, user_id uuid, nome text,
  titulo text, quando timestamptz, criado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Operação negada: só a equipe vê as solicitações.' using errcode = '42501';
  end if;
  if p_categoria is null or p_categoria not in (
    'faltas_de_alunos', 'faltas_de_professores', 'retificacao_de_chamadas', 'trocas_de_aula', 'pagamentos_de_mensalidade'
  ) then
    raise exception 'Categoria desconhecida.' using errcode = '22023';
  end if;
  if not v_admin and p_categoria in ('faltas_de_professores', 'pagamentos_de_mensalidade') then
    raise exception 'Operação negada: só o admin vê esta categoria.' using errcode = '42501';
  end if;

  if p_categoria = 'faltas_de_alunos' then
    return query
      select 'justificativa'::text, j.id, j.class_id, null::uuid, j.user_id, j.student_name,
             coalesce(j.class_title, 'Semana de ' || to_char(j.week_start, 'DD/MM')),
             coalesce(j.class_date_time, j.week_start::timestamp at time zone 'America/Sao_Paulo'),
             j.created_at
        from public.justificativas_para_revisar() j
       order by j.created_at;
  elsif p_categoria = 'faltas_de_professores' then
    return query
      select 'solicitacao'::text, r.id, r.class_id, null::uuid, r.subject_id, p.name, c.title, c.date_time, r.created_at
        from public.roll_call_requests r
        join public.classes c on c.id = r.class_id
        left join public.profiles p on p.id = r.subject_id
       where r.status = 'pending' and r.kind in ('teacher_was_present', 'teacher_absence')
         and public.pode_decidir_solicitacao(r.id)
       order by r.created_at;
  elsif p_categoria = 'retificacao_de_chamadas' then
    return query
      select t.* from (
        select 'solicitacao'::text as tipo, r.id, r.class_id, null::uuid as payment_id, r.subject_id as user_id,
               p.name as nome, c.title as titulo, c.date_time as quando, r.created_at as criado_em
          from public.roll_call_requests r
          join public.classes c on c.id = r.class_id
          left join public.profiles p on p.id = r.subject_id
         where r.status = 'pending'
           and r.kind in ('student_was_present', 'teacher_asks_edit', 'teacher_asks_inclusion')
           and public.pode_decidir_solicitacao(r.id)
        union all
        -- D30 (c): cada retificação feita, só para o admin conferir.
        select 'retificacao_feita', m.id, m.class_id, null, m.author_id, p.name, c.title, c.date_time, m.used_at
          from public.action_reasons m
          join public.classes c on c.id = m.class_id
          left join public.profiles p on p.id = m.author_id
         where v_admin and m.kind = 'roll_call_edit' and m.used_at is not null and m.audited_at is null
      ) t
      order by t.criado_em;
  elsif p_categoria = 'pagamentos_de_mensalidade' then
    return query
      select 'comprovante'::text, pg.id, null::uuid, pg.id, pg.user_id, p.name,
             'Mensalidade ' || to_char(coalesce(pg.reference_month, pg.due_date), 'MM/YYYY'),
             pg.due_date::timestamp at time zone 'America/Sao_Paulo', pg.updated_at
        from public.payments pg
        left join public.profiles p on p.id = pg.user_id
       where pg.status = 'pending_approval'
       order by pg.updated_at;
  end if;
  -- trocas_de_aula: preenchida no 4.9b (pode_decidir_troca).
end;
$$;

comment on function public.itens_da_solicitacao(text) is
  '§ 9.3: os itens de uma categoria da caixa, para quem pode decidir. trocas_de_aula vazia até o 4.9b.';

revoke execute on function public.itens_da_solicitacao(text) from public, anon;
grant execute on function public.itens_da_solicitacao(text) to authenticated;

create function public.caixa_de_solicitacoes()
returns table (categoria text, quantidade int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
begin
  if not public.is_staff() then
    raise exception 'Operação negada: só a equipe vê as solicitações.' using errcode = '42501';
  end if;
  return query
    select c.nome, (select count(*)::int from public.itens_da_solicitacao(c.nome))
      from unnest(array[
        'faltas_de_alunos', 'faltas_de_professores', 'retificacao_de_chamadas',
        'trocas_de_aula', 'pagamentos_de_mensalidade'
      ]) with ordinality as c(nome, ordem)
     where v_admin or c.nome not in ('faltas_de_professores', 'pagamentos_de_mensalidade')
     order by c.ordem;
end;
$$;

comment on function public.caixa_de_solicitacoes() is
  '§ 9.3: as categorias que quem chama vê, na ordem da § 3, com a quantidade de itens.';

revoke execute on function public.caixa_de_solicitacoes() from public, anon;
grant execute on function public.caixa_de_solicitacoes() to authenticated;

create function public.solicitacoes_decididas(p_de date, p_ate date)
returns table (
  id uuid, kind public.roll_call_request_kind, class_id uuid, class_title text,
  requester_name text, subject_name text, status public.justification_status,
  reviewed_by_name text, review_note text, reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o admin vê as solicitações decididas.' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.class_id, c.title, pr.name, ps.name, r.status, pv.name, r.review_note, r.reviewed_at
      from public.roll_call_requests r
      join public.classes c on c.id = r.class_id
      left join public.profiles pr on pr.id = r.requester_id
      left join public.profiles ps on ps.id = r.subject_id
      left join public.profiles pv on pv.id = r.reviewed_by
     where r.status <> 'pending'
       and r.reviewed_at >= p_de::timestamp at time zone 'America/Sao_Paulo'
       and r.reviewed_at < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo'
     order by r.reviewed_at desc;
end;
$$;

revoke execute on function public.solicitacoes_decididas(date, date) from public, anon;
grant execute on function public.solicitacoes_decididas(date, date) to authenticated;
