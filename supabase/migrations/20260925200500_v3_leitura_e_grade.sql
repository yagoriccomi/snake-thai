-- ============================================================================
-- Contrato v3 — quem lê os motivos, a grade efetiva do fixo e a guarda dos
-- anexos (bloco 4.1, fatia 6a; § 5.2, § 6, § 8, § 9.4, T3, T5, T33, T37, T49, T51)
--
-- Nada aqui muda o que o app de hoje faz: são leituras novas e uma trava
-- sobre uma coluna que nenhum cliente usa. As travas de cancelamento,
-- chamada e justificativa vêm na fatia 6b, junto da compatibilidade da
-- `salvar_chamada` do APK 1.8.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quem decide uma troca (§ 9.4, D45, T49)
--
-- Nasce aqui, e não no 4.9b, porque a leitura da justificativa da troca
-- permanente depende exatamente desta regra (§ 8). Uma regra, um lugar.
-- ----------------------------------------------------------------------------
create function public.pode_decidir_troca(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_swaps s
     where s.id = p_id
       and s.status = 'pending'
       and (
         public.is_admin()
         or (
           s.kind = 'once'
           and exists (select 1 from public.class_teachers ct
                        where ct.class_id = s.to_class_id and ct.teacher_id = (select auth.uid()))
         )
         or (
           -- Permanente: só quem já estava na aula nova ANTES do pedido ou está
           -- escalado no horário de destino. Incluir-se depois não dá acesso à
           -- justificativa, que pode ser atestado (T49, D22).
           s.kind = 'permanent'
           and (
             exists (select 1 from public.class_teachers ct
                      where ct.class_id = s.to_class_id and ct.teacher_id = (select auth.uid())
                        and ct.created_at <= s.created_at)
             or exists (select 1 from public.class_schedule_teachers cst
                         where cst.schedule_id = s.to_schedule_id and cst.teacher_id = (select auth.uid()))
           )
         )
       )
  );
$$;

comment on function public.pode_decidir_troca(uuid) is
  'Troca pendente que quem chama pode decidir: admin, ou professor da aula nova (na permanente, só o vinculado antes do pedido ou escalado no horário de destino, T49).';

revoke execute on function public.pode_decidir_troca(uuid) from public, anon;
grant execute on function public.pode_decidir_troca(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Quem lê um motivo (§ 8)
--
-- É a ÚNICA chamada das políticas de action_reasons e action_reason_attachments.
-- A expressão de uma política roda com os privilégios de quem consulta, e
-- roll_call_requests e class_swaps não têm grant para authenticated: um
-- `exists (select ... from class_swaps)` direto na política daria 42501 em
-- todo select de anexo. Aqui, `security definer`, a consulta passa.
-- ----------------------------------------------------------------------------
create function public.pode_ler_motivo(p_motivo_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_motivo public.action_reasons%rowtype;
  v_eu uuid := (select auth.uid());
begin
  select * into v_motivo from public.action_reasons where id = p_motivo_id;
  if not found or v_eu is null then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  -- Retificação: detalhes só para o admin (D20).
  if v_motivo.kind = 'roll_call_edit' then
    return false;
  end if;

  -- Cancelamento e reativação: a equipe da aula precisa saber por quê (T21).
  if v_motivo.kind in ('class_cancel', 'class_reactivate') then
    return exists (select 1 from public.class_teachers ct
                    where ct.class_id = v_motivo.class_id and ct.teacher_id = v_eu);
  end if;

  if v_motivo.author_id = v_eu then
    return true;
  end if;

  -- Solicitação: enquanto pendente, quem pode decidi-la. Só o
  -- "eu estava na aula" é decidido pela equipe da aula; os pedidos de
  -- professor são do admin (§ 9.3).
  if v_motivo.kind = 'request_evidence' then
    return exists (
      select 1
        from public.roll_call_requests r
        join public.class_teachers ct on ct.class_id = r.class_id and ct.teacher_id = v_eu
       where r.motivo_id = p_motivo_id
         and r.status = 'pending'
         and r.kind = 'student_was_present'
    );
  end if;

  -- Troca permanente: enquanto pendente, quem pode decidi-la; depois, só o
  -- autor e o admin (a justificativa pode ter dado de saúde, D22).
  if v_motivo.kind = 'class_swap_evidence' then
    return exists (
      select 1 from public.class_swaps s
       where s.motivo_id = p_motivo_id and public.pode_decidir_troca(s.id)
    );
  end if;

  return false;
end;
$$;

comment on function public.pode_ler_motivo(uuid) is
  'Regra de leitura dos motivos e dos anexos (§ 8), num lugar só. Motivo inexistente: false.';

-- A política roda como quem consulta: authenticated precisa executar.
revoke execute on function public.pode_ler_motivo(uuid) from public, anon;
grant execute on function public.pode_ler_motivo(uuid) to authenticated, service_role;

grant select on public.action_reasons to authenticated;
grant select on public.action_reason_attachments to authenticated;

create policy action_reasons_select_quem_pode_ler on public.action_reasons
  for select to authenticated
  using (public.pode_ler_motivo(id));

create policy action_reason_attachments_select_quem_pode_ler on public.action_reason_attachments
  for select to authenticated
  using (public.pode_ler_motivo(reason_id));

-- ----------------------------------------------------------------------------
-- 3. Modalidade do aluno numa semana (T3, T5) — interna
--
-- Vale para a semana inteira a do plano aberto às 00:00 (São Paulo) do
-- PRIMEIRO dia de aula configurado da semana. Sem plano nesse instante, a do
-- primeiro plano que começou dentro da semana. Sem plano nenhum: fixo (T5).
-- ----------------------------------------------------------------------------
create function public.modalidade_da_semana(p_user_id uuid, p_segunda date)
returns public.plan_schedule_mode
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias smallint[];
  v_primeiro_dia date;
  v_instante timestamptz;
  v_inicio_da_semana timestamptz := p_segunda::timestamp at time zone 'America/Sao_Paulo';
  v_modo public.plan_schedule_mode;
begin
  select class_weekdays into v_dias from public.academy_settings limit 1;
  -- 0 = domingo; a semana vai de segunda (0 dias) a domingo (6 dias).
  select p_segunda + min(((d + 6) % 7))::int into v_primeiro_dia
    from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d;
  v_instante := v_primeiro_dia::timestamp at time zone 'America/Sao_Paulo';

  select p.schedule_mode into v_modo
    from public.plan_periods pp
    join public.plans p on p.id = pp.plan_id
   where pp.user_id = p_user_id
     and pp.started_at <= v_instante
     and (pp.ended_at is null or pp.ended_at > v_instante)
   order by pp.started_at desc
   limit 1;
  if found then
    return v_modo;
  end if;

  select p.schedule_mode into v_modo
    from public.plan_periods pp
    join public.plans p on p.id = pp.plan_id
   where pp.user_id = p_user_id
     and pp.started_at >= v_inicio_da_semana
     and pp.started_at < v_inicio_da_semana + interval '7 days'
   order by pp.started_at
   limit 1;

  return coalesce(v_modo, 'fixed');
end;
$$;

revoke execute on function public.modalidade_da_semana(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Grade efetiva do fixo (T33) — a ÚNICA resposta para "esta aula é dele?"
--
-- Interna: nenhum grant. A conta, a chamada, a declaração, as listas e os
-- avisos a chamam; se cada um calculasse do seu jeito, a conta divergiria da
-- tela. Aulas de rotina em [p_de, p_ate), CANCELADAS INCLUÍDAS (quem chama
-- filtra), só nas semanas em que ele é fixo e fora do trancamento.
-- ----------------------------------------------------------------------------
create function public.grade_efetiva_do_fixo(p_user_ids uuid[], p_de timestamptz, p_ate timestamptz)
returns table (user_id uuid, class_id uuid, fonte text)
language sql
stable
security definer
set search_path = ''
as $$
  with aulas as (
    select c.id, c.date_time, c.group_id, c.schedule_id, c.audience
      from public.classes c
     where c.type = 'routine'
       and c.date_time >= p_de
       and c.date_time < p_ate
  ),
  -- 1. Pela turma DA DATA DA AULA (D58, T51), público fixos ou ambos, e sem
  --    período de troca permanente saindo do horário dela.
  pela_turma as (
    select g.user_id, a.id as class_id, a.date_time, 'turma'::text as fonte, 1 as prioridade
      from aulas a
      join public.student_group_periods g
        on g.group_id = a.group_id
       and g.started_at <= a.date_time
       and (g.ended_at is null or a.date_time < g.ended_at)
     where g.user_id = any (p_user_ids)
       and a.audience in ('fixed', 'both')
       and not exists (
         select 1 from public.class_swap_periods sp
          where sp.user_id = g.user_id
            and sp.from_schedule_id = a.schedule_id
            and sp.started_at < a.date_time
            and (sp.ended_at is null or a.date_time < sp.ended_at)
       )
  ),
  -- 2. Pelo horário de destino de uma troca permanente vigente, em qualquer
  --    público (D47). "Vigente para a aula": começou ANTES dela (T37).
  pela_permanente as (
    select sp.user_id, a.id as class_id, a.date_time, 'permanente'::text as fonte, 2 as prioridade
      from aulas a
      join public.class_swap_periods sp
        on sp.to_schedule_id = a.schedule_id
       and sp.started_at < a.date_time
       and (sp.ended_at is null or a.date_time < sp.ended_at)
     where sp.user_id = any (p_user_ids)
  ),
  -- 3. Menos as originais das trocas avulsas aprovadas.
  base as (
    select b.*
      from (select * from pela_turma union all select * from pela_permanente) b
     where not exists (
       select 1 from public.class_swaps s
        where s.user_id = b.user_id and s.kind = 'once' and s.status = 'approved'
          and s.from_class_id = b.class_id
     )
  ),
  -- 4. Mais os destinos delas, em qualquer público.
  pela_troca as (
    select s.user_id, a.id as class_id, a.date_time, 'troca'::text as fonte, 3 as prioridade
      from public.class_swaps s
      join aulas a on a.id = s.to_class_id
     where s.user_id = any (p_user_ids)
       and s.kind = 'once'
       and s.status = 'approved'
  ),
  todas as (
    select * from base
    union all
    select * from pela_troca
  )
  select distinct on (t.user_id, t.class_id) t.user_id, t.class_id, t.fonte
    from todas t
   where not exists (
           select 1 from public.inactive_periods ip
            where ip.user_id = t.user_id
              and ip.started_at <= t.date_time
              and (ip.ended_at is null or t.date_time < ip.ended_at)
         )
     and public.modalidade_da_semana(
           t.user_id,
           date_trunc('week', t.date_time at time zone 'America/Sao_Paulo')::date
         ) = 'fixed'
   order by t.user_id, t.class_id, t.prioridade;
$$;

comment on function public.grade_efetiva_do_fixo(uuid[], timestamptz, timestamptz) is
  'Aulas de rotina que são do aluno fixo (T33): turma da data da aula, troca permanente vigente, menos as originais e mais os destinos das trocas avulsas aprovadas. Canceladas incluídas. Interna: nenhum grant.';

revoke execute on function public.grade_efetiva_do_fixo(uuid[], timestamptz, timestamptz) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. O prazo de guarda dos anexos só muda com nova Política (§ 5.2, D54)
--
-- O admin continua com `update` direto em academy_settings (é assim que ele
-- salva Configurações). Esta trava recusa só a mudança desta coluna, a menos
-- que venha do sistema (migration). Sistema = sem usuário E não é o anon (§ 0.1).
-- ----------------------------------------------------------------------------
create function public.proteger_guarda_de_anexos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.attachment_retention_days is not distinct from old.attachment_retention_days then
    return new;
  end if;
  if (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon' then
    return new;
  end if;
  raise exception 'O prazo de guarda dos anexos só muda com uma nova Política de Privacidade.'
    using errcode = '42501';
end;
$$;

revoke execute on function public.proteger_guarda_de_anexos() from public, anon, authenticated;

create trigger trg_academy_settings_proteger_guarda_de_anexos
  before update of attachment_retention_days on public.academy_settings
  for each row execute function public.proteger_guarda_de_anexos();

-- ----------------------------------------------------------------------------
-- 6. class_teachers: leitura por coluna (§ 6)
--
-- Hoje a tabela só tem estas três colunas; o grant por coluna garante que
-- uma coluna nova nasça fechada, em vez de vazar pelo select('*').
-- ----------------------------------------------------------------------------
revoke select on public.class_teachers from authenticated;
grant select (class_id, teacher_id, created_at) on public.class_teachers to authenticated;
