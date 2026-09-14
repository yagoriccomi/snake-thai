-- ============================================================================
-- Snake Thai — Controle de frequência, Fase 2: regras no banco
-- ----------------------------------------------------------------------------
-- Regras e decisões em docs/FREQUENCIA.md. Esta migration traz:
--   · frequencia_mensal()        — o cálculo (contador e percentual);
--   · concluir_chamada()         — efetiva a chamada de uma aula;
--   · aulas_sem_chamada()        — o aviso para admin e professores da aula;
--   · fechar_frequencia_do_mes() — congela o mês anterior (cron do dia 1).
--
-- FUSO: o banco roda em UTC, mas o mês da academia é o de São Paulo. Uma aula
-- às 23h30 do dia 30 (local) já é dia 1º em UTC e, sem conversão, cairia no
-- mês seguinte. Todo recorte de mês aqui passa por America/Sao_Paulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cálculo da frequência
--
--    presenças confirmadas
--    ───────────────────────────────────────────────────────────────  × 100
--    (aulas de rotina da turma, já ocorridas, COM chamada concluída)
--      − (faltas com justificativa aprovada)
--
--    Particularidades (todas cobertas pela regressão):
--      · denominador zero → 100% (dia 1, ou turma sem chamada ainda);
--      · total_classes é o mês INTEIRO — é o "12" do contador "0/12" —,
--        enquanto o percentual usa só as aulas já ocorridas com chamada;
--      · eventos (type = 'event') não entram;
--      · aulas anteriores ao cadastro do aluno não entram: ninguém falta a
--        uma aula de antes de existir;
--      · justificativa aprovada numa aula em que o aluno foi dado PRESENTE
--        não conta como justificada (não pode tirar a aula da conta duas
--        vezes).
--
--    Recebe vários alunos de uma vez para a tela do professor não disparar
--    uma chamada por aluno. [#70]
-- ----------------------------------------------------------------------------
create or replace function public.frequencia_mensal(
  p_user_ids   uuid[],
  p_referencia timestamptz default now()
)
returns table (
  user_id           uuid,
  reference_month   date,
  total_classes     integer,
  counted_classes   integer,
  attended          integer,
  justified         integer,
  frequency_percent numeric
)
language sql
stable
security definer
set search_path = ''
as $funcao$
  with
  periodo as (
    select
      date_trunc('month', p_referencia at time zone 'America/Sao_Paulo')::date as mes_local,
      date_trunc('month', p_referencia at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo' as inicio,
      (date_trunc('month', p_referencia at time zone 'America/Sao_Paulo') + interval '1 month')
        at time zone 'America/Sao_Paulo' as fim
  ),
  -- Quem o chamador pode ver. security definer contorna a RLS, então a regra
  -- de acesso mora AQUI: o próprio aluno; professor e admin veem todos; e o
  -- contexto de sistema (cron, sem JWT) também. Os demais ids são descartados
  -- em silêncio, como a RLS faria.
  alunos as (
    select p.id, p.group_id, p.created_at
      from public.profiles p
     where p.id = any (p_user_ids)
       and p.role = 'user'
       and (
         p.id = (select auth.uid())
         or public.is_admin()
         or public.is_professor()
         or (select auth.uid()) is null
       )
  ),
  contagem as (
    select
      a.id as user_id,
      pe.mes_local,
      count(c.id)::integer as total_classes,
      count(c.id) filter (
        where c.date_time <= p_referencia and c.attendance_taken_at is not null
      )::integer as counted_classes,
      count(c.id) filter (
        where c.date_time <= p_referencia and c.attendance_taken_at is not null
          and at.status = 'present'
      )::integer as attended,
      count(c.id) filter (
        where c.date_time <= p_referencia and c.attendance_taken_at is not null
          and at.status is distinct from 'present'
          and j.id is not null
      )::integer as justified
    from alunos a
    cross join periodo pe
    left join public.classes c
           on c.group_id = a.group_id
          and c.type = 'routine'
          and c.date_time >= pe.inicio
          and c.date_time <  pe.fim
          and c.date_time >= a.created_at
    left join public.attendance at
           on at.class_id = c.id and at.user_id = a.id
    left join public.absence_justifications j
           on j.class_id = c.id and j.user_id = a.id and j.status = 'approved'
    group by a.id, pe.mes_local
  )
  select
    ct.user_id,
    ct.mes_local,
    ct.total_classes,
    ct.counted_classes,
    ct.attended,
    ct.justified,
    case
      when ct.counted_classes - ct.justified <= 0 then 100.00
      else round(ct.attended * 100.0 / (ct.counted_classes - ct.justified), 2)
    end
  from contagem ct;
$funcao$;

comment on function public.frequencia_mensal(uuid[], timestamptz) is
  'Frequência do mês (fuso de São Paulo) dos alunos informados. Regras em '
  'docs/FREQUENCIA.md. Filtra silenciosamente os alunos que o chamador não pode ver.';

revoke execute on function public.frequencia_mensal(uuid[], timestamptz) from public, anon;
grant execute on function public.frequencia_mensal(uuid[], timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Concluir a chamada
--
--    Função, e não UPDATE direto: a policy de UPDATE de classes é exclusiva do
--    admin, e o professor da aula precisa poder concluir a própria chamada.
--
--    NÃO recebe "agora" por parâmetro de propósito: se recebesse, um cliente
--    passaria uma data futura e concluiria a chamada de uma aula que ainda
--    não começou.
-- ----------------------------------------------------------------------------
create or replace function public.concluir_chamada(p_class_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_uid      uuid := (select auth.uid());
  v_inicio   timestamptz;
  v_concluida timestamptz;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = p_class_id and ct.teacher_id = v_uid
    )
  ) then
    raise exception 'Operação negada: só o professor da aula ou o admin conclui a chamada.'
      using errcode = '42501';
  end if;

  select date_time, attendance_taken_at into v_inicio, v_concluida
    from public.classes where id = p_class_id
     for update;

  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if v_inicio > now() then
    raise exception 'A chamada só pode ser concluída depois que a aula começa.'
      using errcode = '23514';
  end if;

  -- Idempotente: concluir de novo não reescreve o momento original.
  if v_concluida is not null then
    return v_concluida;
  end if;

  update public.classes set attendance_taken_at = now() where id = p_class_id;
  return now();
end;
$funcao$;

comment on function public.concluir_chamada(uuid) is
  'Marca a chamada da aula como concluída (professor da aula ou admin). A '
  'partir daí a aula entra no cálculo de frequência. Idempotente.';

revoke execute on function public.concluir_chamada(uuid) from public, anon;
grant execute on function public.concluir_chamada(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Aviso de aula sem chamada
--
--    Decidido em 2026-09-14: o admin vê todas; o professor, só as suas.
--    · Tolerância de 1 hora após o início: a chamada costuma ser feita
--      durante a aula, e avisar antes disso seria ruído.
--    · Só o mês corrente (fuso de São Paulo): mês fechado está congelado,
--      avisar sobre ele não muda nada.
--    É consulta, não estado guardado: o aviso some sozinho quando alguém
--    conclui a chamada.
-- ----------------------------------------------------------------------------
create or replace function public.aulas_sem_chamada(p_referencia timestamptz default now())
returns table (
  class_id  uuid,
  title     text,
  date_time timestamptz,
  group_id  text
)
language sql
stable
security definer
set search_path = ''
as $funcao$
  select c.id, c.title, c.date_time, c.group_id
    from public.classes c
   where c.type = 'routine'
     and c.attendance_taken_at is null
     and c.date_time < p_referencia - interval '1 hour'
     and c.date_time >= date_trunc('month', p_referencia at time zone 'America/Sao_Paulo')
                         at time zone 'America/Sao_Paulo'
     and (
       public.is_admin()
       or exists (
         select 1 from public.class_teachers ct
          where ct.class_id = c.id and ct.teacher_id = (select auth.uid())
       )
     )
   order by c.date_time;
$funcao$;

comment on function public.aulas_sem_chamada(timestamptz) is
  'Aulas de rotina do mês corrente que já passaram (1h de tolerância) sem '
  'chamada concluída. Admin vê todas; professor, só as suas; aluno, nenhuma.';

revoke execute on function public.aulas_sem_chamada(timestamptz) from public, anon;
grant execute on function public.aulas_sem_chamada(timestamptz) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Fechamento mensal (congela)
--
--    `p_agora` existe só para a regressão poder fechar um mês fixo; a função
--    não é executável pelo app (revoke abaixo), então o parâmetro não é uma
--    porta de entrada.
-- ----------------------------------------------------------------------------
create or replace function public.fechar_frequencia_do_mes(
  p_mes  date default null,
  p_agora timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_mes        date := coalesce(
    p_mes,
    (date_trunc('month', p_agora at time zone 'America/Sao_Paulo') - interval '1 month')::date
  );
  v_fim        timestamptz;
  v_gravados   integer;
begin
  if v_mes <> date_trunc('month', v_mes)::date then
    raise exception 'O mês a fechar deve ser informado pelo dia 1.' using errcode = '22023';
  end if;

  v_fim := (v_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  -- Congelar um mês em andamento gravaria um retrato parcial para sempre.
  if v_fim > p_agora then
    raise exception 'O mês % ainda não terminou.', v_mes using errcode = '22023';
  end if;

  insert into public.attendance_monthly (
    user_id, reference_month, group_id, total_classes,
    counted_classes, attended, justified, frequency_percent
  )
  select f.user_id, f.reference_month, p.group_id, f.total_classes,
         f.counted_classes, f.attended, f.justified, f.frequency_percent
    from public.frequencia_mensal(
           array(select id from public.profiles
                  where role = 'user' and anonymized_at is null),
           v_fim - interval '1 microsecond'
         ) f
    join public.profiles p on p.id = f.user_id
  -- Já fechado não muda: é isso que "congelar" significa.
  on conflict (user_id, reference_month) do nothing;

  get diagnostics v_gravados = row_count;
  return v_gravados;
end;
$funcao$;

comment on function public.fechar_frequencia_do_mes(date, timestamptz) is
  'Grava em attendance_monthly o retrato do mês (padrão: o anterior). Não '
  'sobrescreve mês já fechado.';

revoke execute on function public.fechar_frequencia_do_mes(date, timestamptz)
  from public, anon, authenticated;

-- 00:20 em São Paulo do dia 1º = 03:20 UTC (sem horário de verão desde 2019).
-- Rodar à meia-noite UTC fecharia o mês três horas antes de ele acabar.
select cron.schedule(
  'close-monthly-attendance',
  '20 3 1 * *',
  $cron$ select public.fechar_frequencia_do_mes(); $cron$
);
