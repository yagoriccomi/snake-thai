-- ============================================================================
-- Frequência: conta a partir da entrada na turma e para no trancamento
--
-- Duas falhas encontradas na auditoria de 2026-09-18, ambas reproduzidas com
-- dados reais no banco local:
--
-- 1. TROCA DE TURMA. A conta casava as aulas pela turma ATUAL do aluno e só
--    olhava a data de criação do perfil. Ao mudar de turma no meio do mês, as
--    aulas da turma nova que JÁ tinham chamada viravam falta: um aluno de
--    100% caiu para 0%. Em lote (excluir_turma move todos de uma vez) a média
--    da academia despencou de 83% para 55%.
--
-- 2. MATRÍCULA TRANCADA. O aluno continuava no denominador depois de trancar,
--    e o fechamento mensal congelava 0% para ele todo mês. O mesmo buraco dava
--    100% no mês fechado para quem foi cadastrado depois daquele mês.
--
-- Decisões do dono da academia: contar da entrada na turma e parar de contar
-- no trancamento. A fórmula em si (presenças sobre aulas com chamada, menos as
-- justificadas) não muda — ela foi conferida à mão e estava certa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Desde quando o aluno está na turma
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists group_since timestamptz;

comment on column public.profiles.group_since is
  'Quando o aluno entrou na turma atual. Nulo = desde sempre (cai em created_at). Mantido pelo gatilho; ninguém escreve à mão.';

-- Quem já estava cadastrado mantém o comportamento de antes (conta desde o
-- cadastro), senão a correção reescreveria a frequência de todo mundo.
update public.profiles
   set group_since = created_at
 where group_since is null
   and group_id is not null;

create or replace function public.marcar_entrada_na_turma()
returns trigger
language plpgsql
set search_path = ''
as $gatilho$
begin
  if tg_op = 'INSERT' then
    new.group_since := case when new.group_id is null then null else coalesce(new.group_since, new.created_at) end;
    return new;
  end if;
  if new.group_id is distinct from old.group_id then
    new.group_since := case when new.group_id is null then null else now() end;
  end if;
  return new;
end;
$gatilho$;

create trigger marcar_entrada_na_turma
  before insert or update of group_id on public.profiles
  for each row execute function public.marcar_entrada_na_turma();

-- ----------------------------------------------------------------------------
-- 2. A conta passa a respeitar entrada na turma e trancamento
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
    select p.id, p.group_id, p.created_at, p.group_since, p.deactivated_at
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
          -- Conta a partir da entrada NA TURMA: aula da turma nova que
          -- aconteceu antes de o aluno chegar não é falta dele.
          and c.date_time >= greatest(a.created_at, coalesce(a.group_since, a.created_at))
          -- Matrícula trancada para de contar no dia do trancamento.
          and (a.deactivated_at is null or c.date_time < a.deactivated_at)
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

-- ----------------------------------------------------------------------------
-- 3. Fechamento mensal não congela retrato de quem não teve aula
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
   -- Sem aula nenhuma no mês não há frequência a congelar: era assim que o
   -- aluno cadastrado depois do mês ganhava 100% e o trancado, 0%.
   where f.total_classes > 0
  -- Já fechado não muda: é isso que "congelar" significa.
  on conflict (user_id, reference_month) do nothing;

  get diagnostics v_gravados = row_count;
  return v_gravados;
end;
$funcao$;
