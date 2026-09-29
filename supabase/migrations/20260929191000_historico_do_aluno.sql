-- ============================================================================
-- Contrato v4 — historico_de_aulas_do_aluno (§ 12; adiantado do bloco 4.10)
--
-- O G3 (§ 14) conta as 23 RPCs do aluno, e esta é uma delas. Ela vem antes do
-- resto do 4.10 (perfis e Pessoas) para o G3 abrir no fim do 4.9b.
--
-- As aulas são as de aulas_do_aluno no período (uma regra só do que é do
-- aluno, § 12); a original de troca aprovada vem com origem 'trocou' e a
-- outra ponta da troca (T33).
-- ============================================================================

create function public.historico_de_aulas_do_aluno(p_user_id uuid, p_de date, p_ate date)
returns table (
  class_id uuid, date_time timestamptz, title text, group_name text,
  audience public.class_audience, cancelled boolean,
  status public.attendance_status, declared_status public.attendance_status,
  origem text, justification_status public.justification_status,
  approved_by_name text,
  edited boolean,
  edited_at timestamptz, previous_status public.attendance_status, edited_by_name text,
  attendance_delay_days int,
  swap_kind public.class_swap_kind, swap_other_date_time timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_de    timestamptz;
  v_ate   timestamptz;
begin
  if p_user_id is null or not (p_user_id = (select auth.uid()) or public.is_staff()) then
    raise exception 'Operação negada: só o próprio aluno ou a equipe vê o histórico.' using errcode = '42501';
  end if;
  v_de := coalesce(p_de, '2000-01-01'::date)::timestamp at time zone 'America/Sao_Paulo';
  v_ate := (coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date) + 1)::timestamp at time zone 'America/Sao_Paulo';

  return query
    select b.class_id, b.date_time, b.title, b.group_name, b.audience, b.cancelled,
           b.status, b.declared_status, b.origem, b.justification_status,
           case when j.status = 'approved' then pj.name end,
           coalesce(a.edited, false),
           case when v_admin then u.edited_at end,
           case when v_admin then u.previous_status end,
           case when v_admin then pe.name end,
           -- T14: dias de calendário (SP) entre a aula e a primeira conclusão; nulo quando 0.
           nullif((c.attendance_taken_at at time zone 'America/Sao_Paulo')::date
                  - (c.date_time at time zone 'America/Sao_Paulo')::date, 0),
           case when b.swap_status = 'approved' then b.swap_kind end,
           case when b.swap_status = 'approved' then b.swap_other_date_time end
      from public.aulas_do_aluno_base(p_user_id, v_de, v_ate, now(), false) b
      join public.classes c on c.id = b.class_id
      left join public.attendance a on a.class_id = b.class_id and a.user_id = p_user_id
      left join public.attendance_audit u on u.attendance_id = a.id
      left join public.profiles pe on pe.id = u.edited_by
      left join public.absence_justifications j on j.class_id = b.class_id and j.user_id = p_user_id
      left join public.profiles pj on pj.id = j.reviewed_by
     order by b.date_time desc;
end;
$$;

comment on function public.historico_de_aulas_do_aluno(uuid, date, date) is
  '§ 12: as aulas do aluno no período, com a situação de cada uma. O próprio aluno ou is_staff(); quem editou e o valor anterior, só o admin.';

revoke execute on function public.historico_de_aulas_do_aluno(uuid, date, date) from public, anon;
grant execute on function public.historico_de_aulas_do_aluno(uuid, date, date) to authenticated;
