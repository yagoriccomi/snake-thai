-- ============================================================================
-- Snake Thai — HISTÓRICO de demonstração (últimos 3 meses)
-- ----------------------------------------------------------------------------
-- Complementa `demo_seed.sql` — rode aquele ANTES. Dá corpo às telas de
-- frequência e ao histórico de pagamentos do admin:
--
--   · agenda de rotina desde o 1º dia do terceiro mês anterior;
--   · chamada CONCLUÍDA em toda aula de rotina que já terminou, inclusive as
--     do mês corrente — com presença, declaração do aluno e justificativas;
--   · os meses fechados congelados em `attendance_monthly`;
--   · mensalidades dos 3 meses anteriores: em dia, com atraso e em aberto.
--
-- ATENÇÃO — DADOS FICTÍCIOS, gravados direto em produção para apresentação.
--
-- Alcance: alunos ATIVOS e não anonimizados, o mesmo da `demo_seed.sql` (que
-- já vincula plano e fatura a todos). Duas coisas nunca são sobrescritas:
-- aula cuja chamada um professor já concluiu e mensalidade com comprovante.
--
-- IDEMPOTENTE e relativo ao dia em que roda: rodar de novo amanhã só conclui
-- as chamadas das aulas que terminaram nesse meio-tempo. A distribuição sai
-- do hash dos ids, então a demonstração é sempre a mesma.
--
-- Remoção: `demo_seed_limpar.sql` apaga as contas de demo e, em cascata,
-- presença, justificativas, frequência congelada e pagamentos delas. As aulas
-- ficam (são agenda, não dado de pessoa).
-- ============================================================================

begin;

create temp table parametros on commit drop as
select
  (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '3 months')::date as primeiro_mes,
  date_trunc('month', now() at time zone 'America/Sao_Paulo')::date as mes_corrente;

create temp table alunos_do_historico on commit drop as
select p.id, p.group_id
  from public.profiles p
 where p.role = 'user'
   and p.status = 'active'
   and p.anonymized_at is null;

-- ----------------------------------------------------------------------------
-- 1. Corrige o fuso das aulas criadas em 2026-08-19
--
--    Foram gravadas com o horário local tratado como UTC: "Manhã" às 04:00,
--    "Tarde" ao meio-dia, "Noite" às 16:30. Somar 3 horas as põe no horário
--    real. O filtro pelo horário local torna o passo idempotente: corrigida,
--    a aula deixa de casar com ele.
-- ----------------------------------------------------------------------------
update public.classes
   set date_time = date_time + interval '3 hours'
 where type = 'routine'
   and created_at::date = date '2026-08-19'
   and title in ('Muay Thai - Manhã', 'Muay Thai - Tarde', 'Muay Thai - Noite')
   and (date_time at time zone 'America/Sao_Paulo')::time in (time '04:00', time '12:00', time '16:30');

-- ----------------------------------------------------------------------------
-- 2. Alunos "matriculados" antes do histórico
--
--    `frequencia_mensal` ignora aulas anteriores ao `created_at` do aluno — é
--    o certo para quem entra no meio do mês. Sem recuar a data, os 3 meses
--    semeados simplesmente não entrariam na conta de ninguém.
-- ----------------------------------------------------------------------------
update public.profiles p
   set created_at = (((select primeiro_mes from parametros) - 10) + time '10:00')
                    at time zone 'America/Sao_Paulo'
 where p.id in (select id from alunos_do_historico)
   and p.created_at > (((select primeiro_mes from parametros) - 10) + time '10:00')
                      at time zone 'America/Sao_Paulo';

-- ----------------------------------------------------------------------------
-- 3. Agenda do início do histórico
--
--    Segunda, quarta e sexta no horário de cada turma, só ANTES da primeira
--    aula de rotina que a turma já tem — o período coberto pela agenda
--    existente não ganha aula duplicada, e cada mês fica com ~3 aulas por
--    semana. Na segunda execução, a primeira aula passa a ser a do início
--    do histórico e nada é inserido.
-- ----------------------------------------------------------------------------
insert into public.classes (title, type, date_time, group_id)
select
  'Muay Thai — ' || g.name,
  'routine',
  (dia::date + case
      when g.name ilike '%manh%' then time '07:00'
      when g.name ilike '%tarde%' then time '15:00'
      else time '19:00'
    end) at time zone 'America/Sao_Paulo',
  g.id
from public.groups g
cross join generate_series((select primeiro_mes from parametros), current_date, interval '1 day') as dia
where extract(dow from dia) in (1, 3, 5)
  and dia::date < coalesce(
        (select min((c.date_time at time zone 'America/Sao_Paulo')::date)
           from public.classes c
          where c.group_id = g.id and c.type = 'routine'),
        current_date + 1)
  and ((dia::date + case
          when g.name ilike '%manh%' then time '07:00'
          when g.name ilike '%tarde%' then time '15:00'
          else time '19:00'
        end) at time zone 'America/Sao_Paulo') < now();

-- ----------------------------------------------------------------------------
-- 4. Professor em toda aula que ainda não tem
--
--    Mesmo rodízio da `demo_seed.sql`. É o professor que "fez" a chamada e
--    revisou as justificativas — e o que dá cor à aula na agenda.
-- ----------------------------------------------------------------------------
with professores as (
  select id, row_number() over (order by name) as posicao, count(*) over () as total
    from public.profiles
   where role = 'professor' and status = 'active'
),
aulas as (
  select c.id, row_number() over (order by c.date_time) as posicao
    from public.classes c
   where not exists (select 1 from public.class_teachers ct where ct.class_id = c.id)
)
insert into public.class_teachers (class_id, teacher_id)
select a.id, pr.id
  from aulas a
  join professores pr on pr.posicao = 1 + (a.posicao % pr.total)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 5. Aulas cuja chamada esta seed conclui
--
--    Rotina, já terminada (mesma folga de 1 hora do aviso de aula sem
--    chamada) e sem chamada concluída. As que um professor concluiu de verdade
--    ficam fora — o dado dele vale mais que o fictício.
-- ----------------------------------------------------------------------------
create temp table aulas_a_concluir on commit drop as
select c.id, c.group_id, c.date_time
  from public.classes c
 where c.type = 'routine'
   and c.attendance_taken_at is null
   and c.date_time < now() - interval '1 hour'
   and c.date_time >= ((select primeiro_mes from parametros)::timestamp at time zone 'America/Sao_Paulo');

-- ----------------------------------------------------------------------------
-- 6. Chamada e declaração de cada aluno
--
--    Cada aluno tem uma assiduidade própria entre 65% e 98% (hash do id), e
--    cada aula sorteia contra ela. A declaração acompanha o que aconteceu na
--    maioria das vezes, mas nem sempre: há quem diga que vem e não aparece —
--    é o caso que mostra por que só a chamada vale.
--
--    Declaração que o aluno já tinha feito é preservada.
-- ----------------------------------------------------------------------------
insert into public.attendance as presenca (class_id, user_id, status, declared_status)
select
  s.class_id,
  s.user_id,
  (case when s.sorte < s.assiduidade then 'present' else 'absent' end)::public.attendance_status,
  (case
     when s.sorte < s.assiduidade then case when s.sorte % 10 < 7 then 'present' end
     when s.sorte % 10 < 6 then 'absent'
     when s.sorte % 10 < 8 then 'present'
   end)::public.attendance_status
from (
  select
    a.id as class_id,
    al.id as user_id,
    abs(hashtext(a.id::text || al.id::text)::bigint) % 100 as sorte,
    65 + abs(hashtext(al.id::text)::bigint) % 34 as assiduidade
  from aulas_a_concluir a
  join alunos_do_historico al on al.group_id = a.group_id
  join public.profiles p on p.id = al.id and p.created_at <= a.date_time
) s
on conflict (class_id, user_id) do update
   set status = excluded.status,
       declared_status = coalesce(presenca.declared_status, excluded.declared_status)
 where presenca.status is null;

-- ----------------------------------------------------------------------------
-- 7. Conclui as chamadas — é o que faz a aula entrar na frequência
-- ----------------------------------------------------------------------------
update public.classes c
   set attendance_taken_at = least(c.date_time + interval '90 minutes', now())
  from aulas_a_concluir a
 where a.id = c.id;

-- ----------------------------------------------------------------------------
-- 8. Justificativas de falta
--
--    Parte de quem avisou que não vinha justificou. Revisadas pelo professor
--    da aula no dia seguinte (70% aprovadas); as da última semana seguem
--    pendentes, para a fila de revisão não aparecer vazia. Sem anexo: não há
--    arquivo de verdade na Cloudinary para apontar.
-- ----------------------------------------------------------------------------
insert into public.absence_justifications (class_id, user_id, message, status, reviewed_by, reviewed_at)
select
  j.class_id,
  j.user_id,
  j.message,
  j.status::public.justification_status,
  case when j.status = 'pending' then null else j.revisor end,
  case when j.status = 'pending' then null else j.date_time + interval '1 day' end
from (
  select
    pr.class_id,
    pr.user_id,
    a.date_time,
    (array[
      'Consulta médica marcada no horário do treino.',
      'Estava gripado, preferi não treinar.',
      'Viagem a trabalho.',
      'Dor no joelho, fiquei de repouso.',
      'Imprevisto na família.',
      'Prova na faculdade.',
      'Plantão extra no trabalho.',
      'Trânsito parado, não consegui chegar a tempo.'
    ])[1 + (abs(hashtext(pr.user_id::text || pr.class_id::text || 'mensagem')::bigint) % 8)::int] as message,
    case
      when a.date_time > now() - interval '7 days' then 'pending'
      when abs(hashtext(pr.class_id::text || pr.user_id::text || 'decisao')::bigint) % 10 < 7 then 'approved'
      else 'rejected'
    end as status,
    (select ct.teacher_id
       from public.class_teachers ct
      where ct.class_id = a.id
      order by ct.created_at, ct.teacher_id
      limit 1) as revisor
  from aulas_a_concluir a
  join public.attendance pr on pr.class_id = a.id
  where pr.status = 'absent'
    and pr.declared_status = 'absent'
    and pr.user_id in (select id from alunos_do_historico)
    and abs(hashtext(pr.class_id::text || pr.user_id::text || 'justifica')::bigint) % 10 < 6
) j
on conflict (class_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- 9. Congela os meses fechados
--
--    Em produção o mês congela uma vez e não muda. Aqui a seed apaga e
--    recongela o PRÓPRIO histórico fictício, para uma segunda execução
--    refletir a agenda corrigida — nunca mês fora do período semeado.
-- ----------------------------------------------------------------------------
delete from public.attendance_monthly m
 using alunos_do_historico al
 where m.user_id = al.id
   and m.reference_month >= (select primeiro_mes from parametros)
   and m.reference_month < (select mes_corrente from parametros);

select to_char(mes, 'YYYY-MM') as mes_congelado,
       public.fechar_frequencia_do_mes(mes::date) as alunos_congelados
  from generate_series(
         (select primeiro_mes from parametros),
         (select mes_corrente from parametros) - interval '1 month',
         interval '1 month') as mes;

-- ----------------------------------------------------------------------------
-- 10. Mensalidades dos 3 meses anteriores
--
--     Primeiro garante que todo aluno com plano tenha a cobrança de cada mês;
--     depois distribui as situações: 70% pagam em dia (alguns antes do
--     vencimento), 20% com atraso curto, 10% com atraso longo — e, no último
--     mês fechado, esses 10% ainda devem. A conta de teste `caloteiro@`
--     deve os dois últimos meses.
-- ----------------------------------------------------------------------------
insert into public.payments (user_id, plan_id, amount_cents, due_date, reference_month, status, paid_at)
select
  al.id,
  p.plan_id,
  pl.price_cents,
  make_date(extract(year from mes)::int, extract(month from mes)::int, pl.due_day),
  mes::date,
  'paid',
  (make_date(extract(year from mes)::int, extract(month from mes)::int, pl.due_day) + time '10:00')
    at time zone 'America/Sao_Paulo'
from alunos_do_historico al
join public.profiles p on p.id = al.id
join public.plans pl on pl.id = p.plan_id
cross join generate_series(
       (select primeiro_mes from parametros),
       (select mes_corrente from parametros) - interval '1 month',
       interval '1 month') as mes
on conflict (user_id, reference_month) do nothing;

with alvo as (
  select
    pay.id,
    pay.due_date,
    pay.reference_month,
    u.email,
    abs(hashtext(pay.user_id::text || pay.reference_month::text)::bigint) % 100 as sorte
  from public.payments pay
  join alunos_do_historico al on al.id = pay.user_id
  join auth.users u on u.id = pay.user_id
  where pay.reference_month >= (select primeiro_mes from parametros)
    and pay.reference_month < (select mes_corrente from parametros)
    and pay.proof_provider is null
),
situacao as (
  select
    alvo.id,
    s.novo_status,
    case
      when s.novo_status = 'paid' then least(
        ((alvo.due_date + case
            when alvo.sorte < 70 then -(alvo.sorte % 6)::int
            when alvo.sorte < 90 then (2 + alvo.sorte % 12)::int
            else (18 + alvo.sorte % 12)::int
          end) + time '10:00') at time zone 'America/Sao_Paulo',
        now())
    end as novo_paid_at
  from alvo
  cross join lateral (
    select (case
      when alvo.email = 'caloteiro@snake.com'
       and alvo.reference_month >= ((select mes_corrente from parametros) - interval '2 months')::date
        then 'overdue'
      when alvo.reference_month = ((select mes_corrente from parametros) - interval '1 month')::date
       and alvo.sorte >= 90
        then 'overdue'
      else 'paid'
    end)::public.payment_status as novo_status
  ) s
)
update public.payments pay
   set status = s.novo_status,
       paid_at = s.novo_paid_at
  from situacao s
 where pay.id = s.id
   -- Só grava o que muda: cada UPDATE vira uma linha na trilha de auditoria.
   and (pay.status is distinct from s.novo_status or pay.paid_at is distinct from s.novo_paid_at);

-- ----------------------------------------------------------------------------
-- 11. Conferência
-- ----------------------------------------------------------------------------
select to_char(date_trunc('month', c.date_time at time zone 'America/Sao_Paulo'), 'YYYY-MM') as mes,
       count(*) as aulas_de_rotina,
       count(c.attendance_taken_at) as com_chamada
  from public.classes c
 where c.type = 'routine'
   and c.date_time >= ((select primeiro_mes from parametros)::timestamp at time zone 'America/Sao_Paulo')
 group by 1 order by 1;

select status, count(*) as justificativas
  from public.absence_justifications group by 1 order by 1;

select to_char(reference_month, 'YYYY-MM') as mes, count(*) as alunos,
       round(avg(frequency_percent), 1) as frequencia_media
  from public.attendance_monthly group by 1 order by 1;

select to_char(reference_month, 'YYYY-MM') as mes, status, count(*)
  from public.payments
 where reference_month >= (select primeiro_mes from parametros)
 group by 1, 2 order by 1, 2;

commit;
