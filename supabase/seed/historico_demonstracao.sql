-- ============================================================================
-- Histórico de demonstração — 12 meses de academia funcionando
--
-- Para APRESENTAR o produto: o app fica convincente quando a frequência tem
-- meses fechados, o faturamento tem doze barras e o relatório de inadimplência
-- tem gente de verdade nas faixas de atraso. Com o banco recém-criado, todo
-- gráfico aparece vazio e a demonstração não mostra nada.
--
-- ⚠️ SÓ EM BANCO DE DEMONSTRAÇÃO. Isto inventa presenças e pagamentos. Rodar
-- onde existe aluno real corrompe o financeiro e a frequência de pessoas
-- reais, e não há desfazer sem restaurar backup.
--
-- É idempotente: roda de novo sem duplicar (as chaves únicas do banco cuidam
-- disso, e o que já existe é ignorado).
--
-- Uso no banco LOCAL:
--   docker exec -i supabase_db_snake-thai psql -U postgres -d postgres \
--     < supabase/seed/historico_demonstracao.sql
--
-- Uso em OUTRO banco (o de demonstração). Duas armadilhas já pagas:
--
--   1. O PowerShell não aceita `<` para redirecionar entrada. Por isso o
--      arquivo é COPIADO para dentro do contêiner e rodado com -f: sem pipe,
--      e sem risco de a acentuação chegar corrompida.
--   2. A string de conexão NÃO é a chave de API. Ela começa com
--      `postgresql://` e está em Project Settings > Database >
--      Connection string. Um valor `sbp_...` ou `eyJ...` é chave, e não
--      serve aqui.
--   3. Naquela página, escolha a aba **Session pooler**, não "Direct
--      connection". A direta (`db.<projeto>.supabase.co`) só resolve para
--      IPv6, e o contêiner não tem IPv6 — o erro é "Network is unreachable",
--      que parece banco fora do ar e não é. O pooler responde em IPv4, na
--      mesma porta 5432, e aguenta a transação longa deste script (a aba
--      "Transaction pooler", na 6543, não aguenta).
--
--   docker cp supabase/seed/historico_demonstracao.sql supabase_db_snake-thai:/tmp/historico.sql
--   docker exec supabase_db_snake-thai psql "postgresql://..." -f /tmp/historico.sql
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ----------------------------------------------------------------------------
-- Trava: recusa rodar se houver sinal de uso real
-- ----------------------------------------------------------------------------
do $$
declare
  v_reais integer;
begin
  -- Um comprovante de verdade é a marca mais confiável de uso real. Os que
  -- este pacote gera ficam em `.../demonstracao-*.png` e são ignorados — sem
  -- essa exceção, rodar o gerador de comprovantes trancaria o próprio script.
  select count(*) into v_reais
    from public.payments
   where proof_public_id is not null
      or (proof_storage_path is not null and proof_storage_path not like '%/demonstracao-%');

  if v_reais > 0 then
    raise exception
      'RECUSADO: existem % pagamento(s) com comprovante enviado de verdade. Este banco tem uso real — não escreva histórico fictício aqui.',
      v_reais
      using errcode = '42501';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 0. Retroage a matrícula: ninguém tem um ano de histórico tendo entrado hoje
-- ----------------------------------------------------------------------------

-- Há quantos dias esta pessoa está na academia. Determinística pelo id, para
-- que o script possa rodar quantas vezes for sem mover as matrículas.
create or replace function public.dias_de_casa_da_demonstracao(p_id uuid)
returns integer
language sql
immutable
as $funcao$
  select case
           when abs(hashtextextended(p_id::text, 29)) % 100 < 45
             -- Veterano: entre dez e treze meses de casa.
             then 300 + (abs(hashtextextended(p_id::text, 23)) % 95)
             -- Entrou ao longo do ano.
             else 5 + (abs(hashtextextended(p_id::text, 23)) % 295)
         end;
$funcao$;
--
-- As contas de demonstração nascem com a data de hoje, e as regras do banco
-- só contam aula e mensalidade a partir da entrada da pessoa. Sem retroagir,
-- as etapas seguintes inserem zero linhas — parece que o script falhou.
--
-- As entradas ficam espalhadas pelo ano de propósito: uns matriculados há doze
-- meses, outros há poucas semanas. É isso que dá ao painel do admin um gráfico
-- de crescimento em vez de um degrau.
-- Quase metade da turma é veterana, de mais de dez meses de casa; o resto
-- entrou ao longo do ano. Sem esse grupo antigo não existe faturamento nos
-- meses iniciais, e o gráfico de doze meses nasce com metade das barras
-- vazias — o contrário do que uma apresentação precisa mostrar.
--
-- A data sai de uma conta sobre o id, então rodar de novo devolve exatamente
-- a mesma data: não empurra ninguém mais para o passado a cada execução.
update public.profiles p
   set created_at = now() - (public.dias_de_casa_da_demonstracao(p.id) * interval '1 day'),
       group_since = now() - (public.dias_de_casa_da_demonstracao(p.id) * interval '1 day')
 where p.role in ('user', 'professor')
   and p.anonymized_at is null;

-- ----------------------------------------------------------------------------
-- 1. Aulas dos últimos 12 meses, seguindo a grade de cada turma
-- ----------------------------------------------------------------------------
--
-- Sem grade cadastrada não há o que repetir; nesse caso usamos três dias fixos
-- por semana, que é o formato mais comum de academia de luta.
insert into public.classes (title, type, date_time, group_id, attendance_taken_at, occurrence_date)
select
  g.name || ' — treino',
  'routine',
  dia + tempo,
  g.id,
  -- Chamada feita no fim da aula: é isso que faz a frequência contar.
  dia + tempo + interval '1 hour',
  dia::date
from public.groups g
cross join lateral (
  select generate_series(
    date_trunc('day', now() - interval '12 months'),
    date_trunc('day', now() - interval '1 day'),
    interval '1 day'
  ) as dia
) dias
cross join lateral (
  -- Segunda, quarta e sexta às 19h; sábado às 10h.
  select case when extract(dow from dias.dia) = 6 then interval '10 hours' else interval '19 hours' end as tempo
) horario
where g.archived_at is null
  and extract(dow from dias.dia) in (1, 3, 5, 6)
  and not exists (
    select 1 from public.classes c
     where c.group_id = g.id
       and c.date_time = dias.dia + horario.tempo
  );

-- ----------------------------------------------------------------------------
-- 2. Presença de cada aluno nas aulas da turma dele
-- ----------------------------------------------------------------------------
--
-- A presença não é aleatória pura: cada aluno ganha um "perfil de assiduidade"
-- estável, derivado do id. Sem isso, todo mundo ficaria com a mesma frequência
-- média e o painel de risco de evasão não mostraria ninguém.
insert into public.attendance (class_id, user_id, status)
select
  c.id,
  p.id,
  case
    when hashtextextended(p.id::text || c.id::text, 42) % 100 <
         -- de 62% a 96% de presença, conforme o aluno
         62 + (abs(hashtextextended(p.id::text, 7)) % 35)
    then 'present'::public.attendance_status
    else 'absent'::public.attendance_status
  end
from public.classes c
join public.profiles p
  on p.group_id = c.group_id
 and p.role = 'user'
 and p.anonymized_at is null
where c.type = 'routine'
  and c.date_time <= now()
  and c.attendance_taken_at is not null
  -- Só conta a partir da entrada do aluno na turma, como manda a regra.
  and c.date_time >= greatest(p.created_at, coalesce(p.group_since, p.created_at))
  and (p.deactivated_at is null or c.date_time < p.deactivated_at)
  and not exists (
    select 1 from public.attendance a
     where a.class_id = c.id and a.user_id = p.id
  );

-- ----------------------------------------------------------------------------
-- 2b. Alguns alunos precisam estar realmente em risco
-- ----------------------------------------------------------------------------
--
-- Com presença de 62% a 96% e as faltas justificadas saindo do denominador,
-- ninguém fica abaixo dos 70% — e o alerta de risco de evasão, que é um dos
-- recursos a mostrar, aparece vazio na apresentação.
--
-- Estes sete alunos faltam de verdade: dois terços das aulas do último
-- trimestre viram falta, e sem justificativa, que é o que derruba o índice.
update public.attendance a
   set status = 'absent'
  from public.classes c
 where c.id = a.class_id
   and a.status = 'present'
   and c.date_time > now() - interval '3 months'
   and a.user_id in (
     select p.id from public.profiles p
      where p.role = 'user' and p.status = 'active' and p.anonymized_at is null
      order by hashtextextended(p.id::text, 31)
      limit 7
   )
   and abs(hashtextextended(a.id::text, 37)) % 3 <> 0;

-- ----------------------------------------------------------------------------
-- 3. Mensalidades dos 12 meses, com estados realistas
-- ----------------------------------------------------------------------------
--
-- Meses antigos aparecem quitados; os recentes trazem atraso e inadimplência,
-- que é o que dá o que mostrar no relatório de cobrança.
insert into public.payments (user_id, plan_id, status, due_date, amount_cents, paid_at, reference_month)
select
  p.id,
  p.plan_id,
  dados.situacao,
  dados.vencimento,
  pl.price_cents,
  case when dados.situacao = 'paid' then dados.vencimento + dados.atraso else null end,
  date_trunc('month', dados.vencimento)::date
from public.profiles p
join public.plans pl on pl.id = p.plan_id
cross join lateral (
  select generate_series(
    date_trunc('month', now() - interval '11 months'),
    date_trunc('month', now()),
    interval '1 month'
  )::date as mes
) meses
cross join lateral (
  select
    (meses.mes + (coalesce(pl.due_day, 10) - 1) * interval '1 day')::date as vencimento,
    abs(hashtextextended(p.id::text || meses.mes::text, 3)) % 100 as sorte,
    (abs(hashtextextended(p.id::text || meses.mes::text, 9)) % 8) * interval '1 day' as atraso
) base
cross join lateral (
  select
    base.vencimento,
    base.atraso,
    case
      -- Mês corrente: ainda em aberto para quase todos.
      when date_trunc('month', base.vencimento) = date_trunc('month', now())
        then case when base.sorte < 55 then 'paid' else 'open' end
      -- Mês passado: onde mora a inadimplência recente.
      when date_trunc('month', base.vencimento) = date_trunc('month', now() - interval '1 month')
        then case
               when base.sorte < 72 then 'paid'
               when base.sorte < 86 then 'overdue'
               else 'pending_approval'
             end
      -- Dois a três meses atrás: alguns arrastando.
      when base.vencimento > (now() - interval '4 months')::date
        then case when base.sorte < 88 then 'paid' else 'overdue' end
      -- Histórico antigo: quitado.
      else 'paid'
    end::public.payment_status as situacao
) dados
where p.role = 'user'
  and p.anonymized_at is null
  and p.plan_id is not null
  and dados.vencimento >= p.created_at::date
  and not exists (
    select 1 from public.payments pg
     where pg.user_id = p.id
       and pg.reference_month = date_trunc('month', dados.vencimento)::date
  );

-- ----------------------------------------------------------------------------
-- 4. Justificativas de falta, aprovadas e recusadas
-- ----------------------------------------------------------------------------
insert into public.absence_justifications (class_id, user_id, message, status, reviewed_by, reviewed_at)
select
  a.class_id,
  a.user_id,
  case abs(hashtextextended(a.id::text, 11)) % 4
    when 0 then 'Estava com febre, atestado em anexo.'
    when 1 then 'Compromisso de trabalho no horário da aula.'
    when 2 then 'Problema no transporte, não consegui chegar a tempo.'
    else 'Consulta médica marcada havia semanas.'
  end,
  case when abs(hashtextextended(a.id::text, 13)) % 10 < 7 then 'approved' else 'rejected' end::public.justification_status,
  (select prof.id from public.profiles prof where prof.role = 'professor' limit 1),
  c.date_time + interval '1 day'
from public.attendance a
join public.classes c on c.id = a.class_id
where a.status = 'absent'
  -- Só uma parte das faltas é justificada; o resto fica como falta mesmo.
  and abs(hashtextextended(a.id::text, 17)) % 100 < 18
  and c.date_time > now() - interval '6 months'
  and not exists (
    select 1 from public.absence_justifications j
     where j.class_id = a.class_id and j.user_id = a.user_id
  );

-- A função era andaime para gerar as datas; não faz parte do produto.
drop function public.dias_de_casa_da_demonstracao(uuid);

commit;

-- ----------------------------------------------------------------------------
-- O que ficou
-- ----------------------------------------------------------------------------
select 'aulas' as o_que, count(*)::text as quantas from public.classes
union all select 'presenças', count(*)::text from public.attendance where status = 'present'
union all select 'faltas', count(*)::text from public.attendance where status = 'absent'
union all select 'justificativas', count(*)::text from public.absence_justifications
union all select 'mensalidades', count(*)::text from public.payments
union all select '  pagas', count(*)::text from public.payments where status = 'paid'
union all select '  vencidas', count(*)::text from public.payments where status = 'overdue'
union all select '  em análise', count(*)::text from public.payments where status = 'pending_approval'
union all select '  em aberto', count(*)::text from public.payments where status = 'open';
