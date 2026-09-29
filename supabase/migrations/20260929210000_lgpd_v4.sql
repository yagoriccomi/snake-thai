-- ============================================================================
-- Contrato v4 — LGPD (bloco 4.11; § 12.1, D22, D54, D58)
--
-- export_my_data: lista EXPLÍCITA de colunas (nada de to_jsonb da linha
-- inteira: uma coluna nova não pode vazar sozinha) e as chaves novas;
-- continua SECURITY INVOKER (a RLS vale). class_swaps e class_swap_periods
-- não têm grant para authenticated: saem das RPCs definer, que filtram pelo
-- auth.uid().
--
-- anonimizar_titular: também apaga solicitações, metas, trocas, períodos de
-- troca e de turma e os motivos do titular (os anexos vão para a fila).
-- ============================================================================

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
      select jsonb_build_object(
               'nome', p.name, 'cpf', p.cpf, 'celular', p.phone, 'nascimento', p.dob,
               'papel', p.role, 'situacao', p.status, 'turma', p.group_id, 'plano', p.plan_id,
               'cor', p.color, 'canal_de_acesso', p.access_channel,
               'criado_em', p.created_at, 'trancado_em', p.deactivated_at)
        from public.profiles p where p.id = (select auth.uid())
    ),
    'presencas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'class_id', a.class_id, 'declared_status', a.declared_status,
               'status', a.status, 'edited', a.edited)), '[]'::jsonb)
        from public.attendance a where a.user_id = (select auth.uid())
    ),
    'frequencia_mensal', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mes', m.reference_month, 'modalidade', m.schedule_mode, 'esperadas', m.expected,
               'feitas', m.attended, 'abonadas', m.excused, 'canceladas', m.cancelled,
               'percentual', m.frequency_percent, 'fechado_em', m.closed_at)
             order by m.reference_month), '[]'::jsonb)
        from public.attendance_monthly m where m.user_id = (select auth.uid())
    ),
    -- D16: quem negou e a nota nunca saem; o aprovador, só na aprovada.
    'justificativas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', j.id, 'scope', j.scope, 'class_id', j.class_id, 'week_start', j.week_start,
               'message', j.message, 'status', j.status, 'attempt', j.attempt,
               'reviewed_at', j.reviewed_at, 'approved_by_name', j.approved_by_name)
             order by j.created_at), '[]'::jsonb)
        from public.minhas_justificativas() j
    ),
    'solicitacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'kind', s.kind, 'class_id', s.class_id, 'class_title', s.class_title,
               'class_date_time', s.class_date_time, 'status', s.status,
               'approved_by_name', s.approved_by_name, 'created_at', s.created_at)
             order by s.created_at), '[]'::jsonb)
        from public.minhas_solicitacoes() s
    ),
    'metas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'semana', g.effective_week_start, 'meta', g.goal, 'definida_em', g.set_at)
             order by g.effective_week_start), '[]'::jsonb)
        from public.weekly_goals g where g.user_id = (select auth.uid())
    ),
    'periodos_de_plano', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plano', pl.name, 'inicio', pp.started_at, 'fim', pp.ended_at)
             order by pp.started_at), '[]'::jsonb)
        from public.plan_periods pp
        left join public.plans pl on pl.id = pp.plan_id
       where pp.user_id = (select auth.uid())
    ),
    'periodos_inativos', (
      select coalesce(jsonb_agg(jsonb_build_object('inicio', ip.started_at, 'fim', ip.ended_at)
             order by ip.started_at), '[]'::jsonb)
        from public.inactive_periods ip where ip.user_id = (select auth.uid())
    ),
    -- Todas, sem filtro de data: nunca com os padrões, que trazem só 60 dias.
    'trocas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb)
        from public.minhas_trocas('-infinity'::date, 'infinity'::date) t
    ),
    'trocas_permanentes', (
      select coalesce(jsonb_agg(to_jsonb(tp) order by tp.started_at), '[]'::jsonb)
        from public.minhas_trocas_permanentes() tp
    ),
    'periodos_de_turma', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'turma', g.name, 'inicio', sgp.started_at, 'fim', sgp.ended_at)
             order by sgp.started_at), '[]'::jsonb)
        from public.student_group_periods sgp
        left join public.groups g on g.id = sgp.group_id
       where sgp.user_id = (select auth.uid())
    ),
    'pagamentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pay.id, 'mes', pay.reference_month, 'vencimento', pay.due_date,
               'valor_centavos', pay.amount_cents, 'situacao', pay.status, 'pago_em', pay.paid_at,
               'tem_comprovante', pay.proof_url is not null or pay.proof_public_id is not null
                                  or pay.proof_storage_path is not null)
             order by pay.due_date), '[]'::jsonb)
        from public.payments pay where pay.user_id = (select auth.uid())
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'documento', d.kind, 'versao', d.version, 'aceito_em', c.accepted_at)
             order by c.accepted_at), '[]'::jsonb)
        from public.consents c
        left join public.legal_documents d on d.id = c.document_id
       where c.user_id = (select auth.uid())
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
  'LGPD art. 18, V (§ 12.1): os dados do titular com lista explícita de colunas. Nunca a nota da decisão, quem negou, edited_by, previous_status nem auditoria.';

create or replace function public.anonimizar_titular(p_user_id uuid, p_solicitante uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_perfil          public.profiles%rowtype;
  v_comprovantes    integer;
  v_justificativas  integer;
  v_aulas_futuras   integer := 0;
begin
  select * into v_perfil
    from public.profiles
   where id = p_user_id
     for update;

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;

  if v_perfil.anonymized_at is not null then
    return jsonb_build_object('ja_anonimizado', true);
  end if;

  if v_perfil.role = 'admin' then
    raise exception 'Rebaixe o administrador antes de excluir a conta.' using errcode = '42501';
  end if;

  v_comprovantes := public.eliminar_comprovantes_do_titular(p_user_id);

  delete from public.absence_justifications where user_id = p_user_id;
  get diagnostics v_justificativas = row_count;

  delete from public.consents where user_id = p_user_id;

  -- § 12.1 (v4): as solicitações e as trocas antes dos motivos, que são
  -- `on delete restrict` nelas; as revisões das trocas vão em cascata.
  delete from public.roll_call_requests where subject_id = p_user_id or requester_id = p_user_id;
  delete from public.class_swaps where user_id = p_user_id;
  delete from public.class_swap_periods where user_id = p_user_id;
  -- Os anexos dos motivos saem em cascata e o gatilho os põe na fila (§ 8).
  delete from public.action_reasons
   where author_id = p_user_id and kind in ('request_evidence', 'class_swap_evidence');
  delete from public.weekly_goals where user_id = p_user_id;

  -- Fora do "if professor": um professor rebaixado antes da exclusão também
  -- pode continuar na grade.
  delete from public.class_schedule_teachers where teacher_id = p_user_id;

  if v_perfil.role = 'professor' then
    -- A cor fica: a constraint exige cor em todo professor, e as aulas passadas
    -- continuam pintadas com ela.
    delete from public.class_teachers ct
     using public.classes c
     where ct.class_id = c.id
       and ct.teacher_id = p_user_id
       and c.date_time > now();
    get diagnostics v_aulas_futuras = row_count;
  end if;

  update public.profiles
     set name           = 'Usuário removido',
         cpf            = null,
         phone          = null,
         dob            = null,
         group_id       = null,
         plan_id        = null,
         status         = 'inactive',
         deactivated_at = coalesce(deactivated_at, now()),
         anonymized_at  = now()
   where id = p_user_id;

  -- Depois do update: o gatilho registrar_periodo_de_turma fecha o período
  -- aberto nele, e só então o histórico de turma sai (D58).
  delete from public.student_group_periods where user_id = p_user_id;

  -- Quem pediu: pela service_role o actor_id do gatilho de auditoria fica nulo.
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    p_solicitante,
    'UPDATE',
    'profiles',
    p_user_id::text,
    jsonb_build_object(
      'lgpd_exclusao',
      jsonb_build_object('origem', case when p_solicitante = p_user_id then 'titular' else 'administrador' end)
    )
  );

  return jsonb_build_object(
    'ja_anonimizado', false,
    'comprovantes', v_comprovantes,
    'justificativas', v_justificativas,
    'aulas_futuras', v_aulas_futuras
  );
end;
$funcao$;
