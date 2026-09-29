-- ============================================================================
-- Contrato v4 — Troca de aula (bloco 4.9b; § 9.4, § 10, D44–D50, T35–T42, T49, T50)
--
-- As tabelas, pode_decidir_troca, a grade efetiva, os avisos da aprovação,
-- a chamada que resolve a avulsa e os encerramentos automáticos (T39, T50,
-- T53, P21) já existem desde o 4.1 e os blocos 4.3 a 4.7. Aqui entram:
--
-- - pedir_troca_de_aula, com as recusas na ordem da tabela da § 9.4;
-- - decidir_troca_de_aula (nota pela T41; a permanente abre ou encerra o
--   período pela T37);
-- - desistir_da_troca (T36);
-- - minhas_trocas, minhas_trocas_permanentes, trocas_para_decidir e
--   trocas_decididas (só admin);
-- - a categoria trocas_de_aula da caixa de Solicitações (§ 9.3).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Internas
-- ----------------------------------------------------------------------------

-- O horário é da grade do aluno agora? Pela turma aberta (público fixos ou
-- ambos, sem período vigente saindo dele) ou como destino de um período
-- vigente (T37). É a conferência "pelo horário" da aprovação da permanente.
create function public.horario_na_grade(p_user_id uuid, p_schedule_id uuid, p_quando timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.class_schedules h
             join public.student_group_periods g
               on g.group_id = h.group_id and g.user_id = p_user_id
              and g.started_at <= p_quando and (g.ended_at is null or p_quando < g.ended_at)
            where h.id = p_schedule_id
              and h.audience in ('fixed', 'both')
              and not exists (
                select 1 from public.class_swap_periods sp
                 where sp.user_id = p_user_id and sp.from_schedule_id = p_schedule_id
                   and sp.started_at <= p_quando and (sp.ended_at is null or p_quando < sp.ended_at)
              )
         )
      or exists (
           select 1 from public.class_swap_periods sp
            where sp.user_id = p_user_id and sp.to_schedule_id = p_schedule_id
              and sp.started_at <= p_quando and (sp.ended_at is null or p_quando < sp.ended_at)
         );
$$;

revoke execute on function public.horario_na_grade(uuid, uuid, timestamptz) from public, anon, authenticated;

-- A segunda-feira (SP) da semana de um instante (T2).
create function public.segunda_de(p_quando timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', p_quando at time zone 'America/Sao_Paulo')::date;
$$;

revoke execute on function public.segunda_de(timestamptz) from public, anon, authenticated;

-- O plano aberto agora é fixo (ou não há plano, T5)? A mudança marcada para
-- a próxima semana já conta (T3).
create function public.plano_aberto_e_fixo(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pl.schedule_mode = 'fixed'
      from public.plan_periods pp
      join public.plans pl on pl.id = pp.plan_id
     where pp.user_id = p_user_id and pp.ended_at is null
     order by pp.started_at desc
     limit 1
  ), true);
$$;

revoke execute on function public.plano_aberto_e_fixo(uuid) from public, anon, authenticated;

-- T38 (a): troca avulsa pendente ou aprovada com uma aula FUTURA de um dos
-- dois horários.
create function public.avulsa_com_aula_futura_dos_horarios(p_user_id uuid, p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_swaps s
      join public.classes c on c.id in (s.from_class_id, s.to_class_id)
     where s.user_id = p_user_id and s.kind = 'once' and s.status in ('pending', 'approved')
       and c.date_time > now()
       and c.schedule_id in (p_a, p_b)
  );
$$;

revoke execute on function public.avulsa_com_aula_futura_dos_horarios(uuid, uuid, uuid) from public, anon, authenticated;

-- O aviso do pedido (T42): professores da aula nova; sem nenhum, os admins;
-- na permanente, também os admins.
create function public.avisar_troca_pendente(p_swap_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_troca public.class_swaps%rowtype;
  v_destinatarios uuid[];
begin
  select * into v_troca from public.class_swaps where id = p_swap_id;
  if not found or v_troca.status <> 'pending' then
    return;
  end if;

  v_destinatarios := array(
    select ct.teacher_id
      from public.class_teachers ct
      join public.profiles p on p.id = ct.teacher_id and p.status = 'active' and p.anonymized_at is null
     where ct.class_id = v_troca.to_class_id
  );
  if coalesce(array_length(v_destinatarios, 1), 0) = 0 or v_troca.kind = 'permanent' then
    v_destinatarios := array(
      select distinct x from unnest(v_destinatarios || array(
        select p.id from public.profiles p
         where p.role = 'admin' and p.status = 'active' and p.anonymized_at is null
      )) x
    );
  end if;

  perform public.enfileirar_notificacao(x, 'troca_pendente', 'troca_pendente:' || p_swap_id::text,
                                        '{}'::jsonb, null, v_troca.to_class_id)
     from unnest(v_destinatarios) x;
end;
$$;

revoke execute on function public.avisar_troca_pendente(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Pedir (§ 9.4: as recusas na ordem da tabela)
-- ----------------------------------------------------------------------------
create function public.pedir_troca_de_aula(
  p_de uuid,
  p_para uuid,
  p_tipo public.class_swap_kind,
  p_motivo_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_de    public.classes%rowtype;
  v_para  public.classes%rowtype;
  v_fonte text;
  v_id    uuid;
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = v_uid and p.role = 'user' and p.status = 'active' and p.anonymized_at is null
  ) then
    raise exception 'Troca de aula é só para alunos.' using errcode = '42501';
  end if;
  if p_tipo is null then
    raise exception 'Escolha o tipo da troca.' using errcode = '22023';
  end if;

  select * into v_de from public.classes where id = p_de for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;
  select * into v_para from public.classes where id = p_para for update;
  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if public.modalidade_da_semana(v_uid, public.segunda_de(v_de.date_time)) <> 'fixed' then
    raise exception 'Troca de aula é só para alunos de horário fixo. No seu plano, é só marcar Vou na aula que quiser.'
      using errcode = '23514';
  end if;
  v_fonte := public.fonte_da_aula_na_grade(v_uid, p_de);
  if v_fonte is null then
    raise exception 'Esta aula não é sua.' using errcode = '23514';
  end if;
  if v_de.type <> 'routine' or v_para.type <> 'routine' then
    raise exception 'Troca só entre aulas de rotina.' using errcode = '23514';
  end if;
  if v_para.cancelled_at is not null then
    raise exception 'Aula cancelada.' using errcode = '23514';
  end if;
  if v_para.date_time <= now() then
    raise exception 'Esta aula já começou.' using errcode = '23514';
  end if;
  if public.fonte_da_aula_na_grade(v_uid, p_para) is not null then
    raise exception 'Esta aula já é sua.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.class_swaps s
     where s.user_id = v_uid and s.kind = 'once' and s.status in ('pending', 'approved') and s.to_class_id = p_para
  ) then
    raise exception 'Você já pediu troca para esta aula.' using errcode = '23514';
  end if;
  if exists (
    select 1
      from public.grade_efetiva_do_fixo(array[v_uid], v_para.date_time, v_para.date_time + interval '1 second') g
      join public.classes c on c.id = g.class_id
     where g.class_id <> p_de and c.cancelled_at is null
  ) then
    raise exception 'Você já tem aula neste horário.' using errcode = '23514';
  end if;

  if p_tipo = 'once' then
    if p_motivo_id is not null then
      raise exception 'Troca só nesta semana não leva justificativa.' using errcode = '22023';
    end if;
    if public.segunda_de(v_de.date_time) <> public.segunda_de(v_para.date_time) then
      raise exception 'A aula nova precisa ser na mesma semana da aula original.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.class_swaps s
       where s.user_id = v_uid and s.kind = 'once' and s.status in ('pending', 'approved') and s.to_class_id = p_de
    ) then
      raise exception 'Esta aula já é uma troca. Desista dela para pedir outra.' using errcode = '23514';
    end if;
    if v_de.cancelled_at is not null then
      raise exception 'Esta aula foi cancelada e já está abonada.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.attendance a where a.class_id = p_de and a.user_id = v_uid and a.status = 'present'
    ) then
      raise exception 'Você já fez esta aula.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.class_swaps s
       where s.user_id = v_uid and s.kind = 'once' and s.status in ('pending', 'approved') and s.from_class_id = p_de
    ) then
      raise exception 'Esta aula já tem uma troca em andamento.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.absence_justifications j
       where j.class_id = p_de and j.user_id = v_uid and j.status in ('pending', 'approved')
    ) then
      raise exception 'Esta aula já tem justificativa.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.roll_call_requests q
       where q.class_id = p_de and q.subject_id = v_uid and q.kind = 'student_was_present' and q.status = 'pending'
    ) then
      raise exception 'Esta aula tem um pedido de ''Eu estava na aula'' em análise.' using errcode = '23514';
    end if;
    if v_de.date_time > now() and exists (
      select 1 from public.class_swaps s
       where s.user_id = v_uid and s.kind = 'permanent' and s.status = 'pending'
         and (s.from_schedule_id in (v_de.schedule_id, v_para.schedule_id)
              or s.to_schedule_id in (v_de.schedule_id, v_para.schedule_id))
    ) then
      raise exception 'Você pediu a troca permanente deste horário. Aguarde a decisão ou desista dela.' using errcode = '23514';
    end if;
  else
    if not public.plano_aberto_e_fixo(v_uid) then
      raise exception 'Seu plano muda na próxima semana: a troca permanente não vale mais.' using errcode = '23514';
    end if;
    if v_de.date_time <= now() then
      raise exception 'Para a troca permanente, escolha uma aula sua que ainda não aconteceu. Para repor esta, peça a troca só nesta semana.'
        using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.action_reasons r
       where r.id = p_motivo_id and r.kind = 'class_swap_evidence' and r.author_id = v_uid and r.used_at is null
    ) then
      raise exception 'Para a troca permanente, escreva a justificativa.' using errcode = '22023';
    end if;
    if v_de.schedule_id is null or v_para.schedule_id is null or v_fonte = 'troca'
       or v_de.schedule_id = v_para.schedule_id
       or exists (
         select 1 from public.class_schedules h
          where h.id in (v_de.schedule_id, v_para.schedule_id)
            and h.valid_until is not null
            and h.valid_until < (now() at time zone 'America/Sao_Paulo')::date
       ) then
      raise exception 'Só aulas da grade semanal podem ter troca permanente. Peça a troca só nesta semana.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.class_swaps s
       where s.user_id = v_uid and s.kind = 'permanent' and s.status = 'pending' and s.from_schedule_id = v_de.schedule_id
    ) then
      raise exception 'Você já pediu a troca permanente desta aula.' using errcode = '23514';
    end if;
    if public.avulsa_com_aula_futura_dos_horarios(v_uid, v_de.schedule_id, v_para.schedule_id) then
      raise exception 'Você tem uma troca só desta semana com este horário. Peça a permanente depois dela.' using errcode = '23514';
    end if;
  end if;

  -- A marcação de extra na aula nova vira o pedido (§ 9.5).
  update public.attendance
     set declared_status = null
   where class_id = p_para and user_id = v_uid and declared_status is not null;

  insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, from_schedule_id, to_schedule_id, motivo_id)
  values (
    v_uid, p_tipo, p_de, p_para,
    case when p_tipo = 'permanent' then v_de.schedule_id end,
    case when p_tipo = 'permanent' then v_para.schedule_id end,
    case when p_tipo = 'permanent' then p_motivo_id end
  )
  returning id into v_id;

  if p_tipo = 'permanent' then
    update public.action_reasons set used_at = now() where id = p_motivo_id;
  end if;

  perform public.avisar_troca_pendente(v_id);
  return v_id;
end;
$$;

comment on function public.pedir_troca_de_aula(uuid, uuid, public.class_swap_kind, uuid) is
  '§ 9.4: o fixo pede a troca de uma aula por outra, só nesta semana ou permanente, com as recusas na ordem da tabela.';

revoke execute on function public.pedir_troca_de_aula(uuid, uuid, public.class_swap_kind, uuid) from public, anon;
grant execute on function public.pedir_troca_de_aula(uuid, uuid, public.class_swap_kind, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Decidir (§ 9.4, T37, T41)
-- ----------------------------------------------------------------------------
create function public.decidir_troca_de_aula(p_id uuid, p_decisao public.class_swap_status, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_troca  public.class_swaps%rowtype;
  v_nota   text := nullif(btrim(coalesce(p_nota, '')), '');
  v_agora  timestamptz := now();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_p      public.class_swap_periods%rowtype;
  v_de     uuid;
  v_ate    date;
begin
  if p_decisao is null or p_decisao not in ('approved', 'rejected') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;

  select * into v_troca from public.class_swaps where id = p_id for update;
  if not found then
    raise exception 'Troca não encontrada.' using errcode = 'P0002';
  end if;
  if v_troca.status <> 'pending' then
    raise exception 'Esta troca já foi decidida.' using errcode = '23514';
  end if;
  if not public.pode_decidir_troca(p_id) then
    raise exception 'Só um professor da aula nova ou um admin decide esta troca.' using errcode = '42501';
  end if;
  -- T41: obrigatória para negar e na permanente; opcional para aprovar a avulsa.
  if (p_decisao = 'rejected' or v_troca.kind = 'permanent') and v_nota is null
     or v_nota is not null and char_length(v_nota) > 500 then
    raise exception 'Escreva o motivo da decisão.' using errcode = '22023';
  end if;

  if p_decisao = 'approved' and v_troca.kind = 'once' then
    if public.fonte_da_aula_na_grade(v_troca.user_id, v_troca.from_class_id) is null
       or exists (
         select 1 from public.attendance a
          where a.class_id = v_troca.from_class_id and a.user_id = v_troca.user_id and a.status = 'present'
       ) then
      raise exception 'O aluno já fez a aula original: a troca não vale mais.' using errcode = '23514';
    end if;
  end if;

  if p_decisao = 'approved' and v_troca.kind = 'permanent' then
    perform 1 from public.class_swap_periods where user_id = v_troca.user_id for update;

    -- 1. Confere de novo, pelo horário (a aula escolhida é só ponteiro).
    if public.modalidade_da_semana(v_troca.user_id, public.segunda_de(v_agora)) <> 'fixed'
       or not public.plano_aberto_e_fixo(v_troca.user_id) then
      raise exception 'Seu plano muda na próxima semana: a troca permanente não vale mais.' using errcode = '23514';
    end if;
    if not public.horario_na_grade(v_troca.user_id, v_troca.from_schedule_id, v_agora) then
      raise exception 'Esta aula não é sua.' using errcode = '23514';
    end if;
    if public.horario_na_grade(v_troca.user_id, v_troca.to_schedule_id, v_agora) then
      raise exception 'Esta aula já é sua.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.class_schedules h
       where h.id in (v_troca.from_schedule_id, v_troca.to_schedule_id)
         and h.valid_until is not null and h.valid_until < v_hoje
    ) then
      raise exception 'Só aulas da grade semanal podem ter troca permanente. Peça a troca só nesta semana.' using errcode = '23514';
    end if;
    if public.avulsa_com_aula_futura_dos_horarios(v_troca.user_id, v_troca.from_schedule_id, v_troca.to_schedule_id) then
      raise exception 'Você tem uma troca só desta semana com este horário. Peça a permanente depois dela.' using errcode = '23514';
    end if;

    -- 2 e 3. O período vigente que trouxe a aula original, se houver.
    select * into v_p from public.class_swap_periods sp
     where sp.user_id = v_troca.user_id and sp.to_schedule_id = v_troca.from_schedule_id
       and sp.started_at <= v_agora and (sp.ended_at is null or v_agora < sp.ended_at)
     order by sp.started_at desc
     limit 1;

    v_de := v_troca.from_schedule_id;
    if found then
      update public.class_swap_periods
         set ended_at = v_agora,
             end_reason = case when v_p.from_schedule_id = v_troca.to_schedule_id then 'reverted' else 'replaced' end
       where id = v_p.id;
      v_de := case when v_p.from_schedule_id = v_troca.to_schedule_id then null else v_p.from_schedule_id end;
    end if;

    -- 4. O período novo; com fim do horário de destino, já nasce com o fim.
    if v_de is not null then
      select h.valid_until into v_ate from public.class_schedules h where h.id = v_troca.to_schedule_id;
      insert into public.class_swap_periods (user_id, swap_id, from_schedule_id, to_schedule_id, started_at, ended_at, end_reason)
      values (
        v_troca.user_id, p_id, v_de, v_troca.to_schedule_id, v_agora,
        case when v_ate is not null then greatest(v_agora, (v_ate + 1)::timestamp at time zone 'America/Sao_Paulo') end,
        case when v_ate is not null then 'schedule_ended' end
      );
    end if;
  end if;

  update public.class_swaps
     set status = p_decisao, decided_via = 'review', decided_at = v_agora,
         decided_by = case when p_decisao = 'approved' then v_uid end
   where id = p_id;

  insert into public.class_swap_reviews (swap_id, reviewer_id, review_note, decided_via, decided_at)
  values (p_id, v_uid, v_nota, 'review', v_agora)
  on conflict (swap_id) do update
     set reviewer_id = excluded.reviewer_id, review_note = excluded.review_note,
         decided_via = excluded.decided_via, decided_at = excluded.decided_at;

  if p_decisao = 'approved' then
    perform public.avisar_troca_aprovada(p_id, v_uid, false);
  else
    perform public.enfileirar_notificacao(v_troca.user_id, 'troca_negada', 'troca_negada:' || p_id::text,
                                          '{}'::jsonb, p_class_id => v_troca.to_class_id);
  end if;
end;
$$;

comment on function public.decidir_troca_de_aula(uuid, public.class_swap_status, text) is
  '§ 9.4: aprova ou nega a troca (nota pela T41). A permanente abre ou encerra o período de troca (T37).';

revoke execute on function public.decidir_troca_de_aula(uuid, public.class_swap_status, text) from public, anon;
grant execute on function public.decidir_troca_de_aula(uuid, public.class_swap_status, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Desistir (§ 9.4, T36)
-- ----------------------------------------------------------------------------
create function public.desistir_da_troca(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_troca public.class_swaps%rowtype;
begin
  select * into v_troca from public.class_swaps where id = p_id and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Troca não encontrada.' using errcode = 'P0002';
  end if;
  if v_troca.status in ('rejected', 'expired', 'cancelled') then
    raise exception 'Esta troca já terminou.' using errcode = '23514';
  end if;
  if v_troca.status = 'approved' and v_troca.kind = 'permanent' then
    raise exception 'Troca permanente aprovada não se desfaz. Para voltar ao horário antigo, peça outra troca permanente.'
      using errcode = '23514';
  end if;
  if v_troca.status = 'approved' and exists (
    select 1 from public.classes c
     where c.id in (v_troca.from_class_id, v_troca.to_class_id) and c.date_time <= now()
  ) then
    raise exception 'Não dá mais para desistir: uma das aulas já começou.' using errcode = '23514';
  end if;

  update public.class_swaps
     set status = 'cancelled', decided_via = 'student', decided_at = now(), decided_by = null
   where id = p_id;
end;
$$;

revoke execute on function public.desistir_da_troca(uuid) from public, anon;
grant execute on function public.desistir_da_troca(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Listas
-- ----------------------------------------------------------------------------
create function public.minhas_trocas(p_de date default null, p_ate date default null)
returns table (
  id uuid, kind public.class_swap_kind, status public.class_swap_status,
  decided_via text,
  from_class_id uuid, from_title text, from_date_time timestamptz,
  to_class_id uuid, to_title text, to_date_time timestamptz,
  is_makeup boolean,
  motivo_texto text,
  approved_by_name text,
  can_cancel boolean,
  created_at timestamptz, decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.kind, s.status, s.decided_via,
         s.from_class_id, cd.title, cd.date_time,
         s.to_class_id, cp.title, cp.date_time,
         s.kind = 'once' and cd.date_time is not null and cd.date_time < s.created_at,
         case when s.kind = 'permanent' then m.body end,
         -- D16: só na aprovada, e nunca na aprovada pelo sistema (T50).
         case when s.status = 'approved' and s.decided_via <> 'system' then pv.name end,
         s.status = 'pending'
           or (s.status = 'approved' and s.kind = 'once'
               and coalesce(cd.date_time > now(), true) and coalesce(cp.date_time > now(), true)),
         s.created_at, s.decided_at
    from public.class_swaps s
    left join public.classes cd on cd.id = s.from_class_id
    left join public.classes cp on cp.id = s.to_class_id
    left join public.action_reasons m on m.id = s.motivo_id
    left join public.profiles pv on pv.id = s.decided_by
   where s.user_id = (select auth.uid())
     and (
       (p_de is null and p_ate is null and coalesce(cp.date_time, s.created_at) >= now() - interval '60 days')
       or (
         (p_de is not null or p_ate is not null)
         and (p_de is null or p_de = '-infinity'::date
              or coalesce(cp.date_time, s.created_at) >= p_de::timestamp at time zone 'America/Sao_Paulo')
         and (p_ate is null or p_ate = 'infinity'::date
              or coalesce(cp.date_time, s.created_at) < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
       )
     )
   order by coalesce(cp.date_time, s.created_at) desc;
$$;

comment on function public.minhas_trocas(date, date) is
  '§ 9.4: as trocas do próprio aluno, pela data da aula nova. Sem datas: dos últimos 60 dias e as futuras; -infinity/infinity: todas (§ 12.1).';

revoke execute on function public.minhas_trocas(date, date) from public, anon;
grant execute on function public.minhas_trocas(date, date) to authenticated;

create function public.minhas_trocas_permanentes()
returns table (
  from_weekday smallint, from_start_time time, from_group_name text,
  to_weekday smallint, to_start_time time, to_group_name text,
  started_at timestamptz, ended_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select hd.weekday, hd.start_time, gd.name, hp.weekday, hp.start_time, gp.name, sp.started_at, sp.ended_at
    from public.class_swap_periods sp
    join public.class_schedules hd on hd.id = sp.from_schedule_id
    join public.class_schedules hp on hp.id = sp.to_schedule_id
    left join public.groups gd on gd.id = hd.group_id
    left join public.groups gp on gp.id = hp.group_id
   where sp.user_id = (select auth.uid())
   order by sp.started_at;
$$;

revoke execute on function public.minhas_trocas_permanentes() from public, anon;
grant execute on function public.minhas_trocas_permanentes() to authenticated;

create function public.trocas_para_decidir()
returns table (
  id uuid, kind public.class_swap_kind, user_id uuid, student_name text,
  from_class_id uuid, from_title text, from_date_time timestamptz, from_group_name text,
  from_status public.attendance_status,
  to_class_id uuid, to_title text, to_date_time timestamptz, to_group_name text,
  to_schedule_ends_on date,
  is_makeup boolean,
  motivo_id uuid, motivo_texto text, anexos jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.kind, s.user_id, p.name,
         s.from_class_id, cd.title, cd.date_time, gd.name,
         a.status,
         s.to_class_id, cp.title, cp.date_time, gp.name,
         case when s.kind = 'permanent' then hp.valid_until end,
         s.kind = 'once' and cd.date_time is not null and cd.date_time < s.created_at,
         case when s.kind = 'permanent' then s.motivo_id end,
         case when s.kind = 'permanent' then m.body end,
         case when s.kind = 'permanent' then coalesce((
           select jsonb_agg(jsonb_build_object('id', x.id, 'provider', x.provider) order by x.created_at)
             from public.action_reason_attachments x where x.reason_id = s.motivo_id
         ), '[]'::jsonb) end,
         s.created_at
    from public.class_swaps s
    join public.profiles p on p.id = s.user_id
    left join public.classes cd on cd.id = s.from_class_id
    left join public.classes cp on cp.id = s.to_class_id
    left join public.groups gd on gd.id = cd.group_id
    left join public.groups gp on gp.id = cp.group_id
    left join public.class_schedules hp on hp.id = s.to_schedule_id
    left join public.attendance a on a.class_id = s.from_class_id and a.user_id = s.user_id
    left join public.action_reasons m on m.id = s.motivo_id
   where s.status = 'pending' and public.pode_decidir_troca(s.id)
   order by s.created_at;
$$;

comment on function public.trocas_para_decidir() is
  '§ 9.4: as trocas pendentes que quem chama pode decidir (D45, T49), mais antigas primeiro.';

revoke execute on function public.trocas_para_decidir() from public, anon;
grant execute on function public.trocas_para_decidir() to authenticated;

create function public.trocas_decididas(p_de date, p_ate date)
returns table (
  id uuid, kind public.class_swap_kind, user_id uuid, student_name text,
  from_class_id uuid, from_date_time timestamptz, to_class_id uuid, to_date_time timestamptz,
  status public.class_swap_status, decided_via text,
  reviewer_name text, review_note text, decided_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Operação negada: só o admin vê as trocas decididas.' using errcode = '42501';
  end if;
  return query
    select s.id, s.kind, s.user_id, p.name, s.from_class_id, cd.date_time, s.to_class_id, cp.date_time,
           s.status, s.decided_via, pv.name, r.review_note, s.decided_at
      from public.class_swaps s
      left join public.profiles p on p.id = s.user_id
      left join public.classes cd on cd.id = s.from_class_id
      left join public.classes cp on cp.id = s.to_class_id
      left join public.class_swap_reviews r on r.swap_id = s.id
      left join public.profiles pv on pv.id = r.reviewer_id
     where s.status <> 'pending'
       and s.decided_at >= p_de::timestamp at time zone 'America/Sao_Paulo'
       and s.decided_at < (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo'
     order by s.decided_at desc;
end;
$$;

revoke execute on function public.trocas_decididas(date, date) from public, anon;
grant execute on function public.trocas_decididas(date, date) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. A categoria Trocas de aula da caixa (§ 9.3): o item leva a Revisar troca
-- ----------------------------------------------------------------------------
create or replace function public.itens_da_solicitacao(p_categoria text)
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
  elsif p_categoria = 'trocas_de_aula' then
    -- tipo 'troca': id = a troca, class_id e quando = a aula nova (§ 9.3).
    return query
      select 'troca'::text, x.id, x.to_class_id, null::uuid, x.user_id, x.student_name,
             coalesce(x.to_title, 'Aula removida'), coalesce(x.to_date_time, x.created_at), x.created_at
        from public.trocas_para_decidir() x
       order by x.created_at;
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
end;
$$;
