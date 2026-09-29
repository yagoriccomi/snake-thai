-- ============================================================================
-- Snake Thai — Remoção do HISTÓRICO de demonstração (historico_demonstracao.sql)
-- ----------------------------------------------------------------------------
-- O `demo_seed_limpar.sql` só apaga as contas @demo.snakethai.com. Este apaga
-- o ANO INVENTADO que o `historico_demonstracao.sql` gravou: aulas
-- "<turma> — treino", presenças e faltas, mensalidades, justificativas e os
-- meses fechados calculados em cima delas.
--
-- COMO RECONHECE O PACOTE: cada execução dele é uma transação, e tudo o que
-- ela inseriu tem o MESMO `created_at`. O pacote é idempotente e pode ter
-- rodado mais de uma vez (cada vez acrescentando o que faltava), então há um
-- instante por execução. As MARCAS são os instantes em que ele gravou algo
-- reconhecível pela forma: aula "— treino" fora da grade com chamada 1 h
-- depois, ou justificativa com um dos 4 textos dele revisada 1 dia depois da
-- aula. O script apaga, em cada tabela, só as linhas nascidas numa marca.
-- (As contas e o histórico do `demo_seed.sql` não têm essa forma: ficam para
-- o `demo_seed_limpar.sql`.)
--
-- ⚠️ PRODUÇÃO: tire o backup ANTES (docs/RUNBOOK.md, "Limpar o histórico de
-- demonstração"). Por padrão este script só MOSTRA o que apagaria e desfaz
-- tudo no fim. Para apagar de verdade, troque a linha da trava abaixo.
--
-- O que o pacote fez e este script NÃO desfaz (só o backup de antes de 23/09):
--   1. reescreveu `created_at` e `group_since` de todos os alunos e professores;
--   2. trocou presença por falta em até 7 alunos, nos 3 meses antes de 23/09,
--      inclusive em chamadas que já existiam.
--
-- Uso: SQL Editor do painel (cole tudo MENOS a linha `\set`) ou
--   docker exec -i supabase_db_snake-thai psql -U postgres -d postgres \
--     < supabase/seed/historico_demonstracao_limpar.sql
-- ============================================================================

\set ON_ERROR_STOP on

begin;

-- ⚠️ A CHAVE DA TRAVA ⚠️ — troque para 'sim' só depois de conferir o relatório
-- e de ter o backup. É a única linha que você precisa editar.
select set_config('limpeza.confirmo', 'nao', true);

create temporary table limpeza_relatorio (ordem int, o_que text, quantas bigint) on commit drop;
create temporary table limpeza_marcas (marca timestamptz primary key) on commit drop;

-- 1. As marcas: os instantes das execuções do pacote.
insert into limpeza_marcas
select distinct c.created_at
  from public.classes c
 where c.title like '% — treino'
   and c.schedule_id is null
   and c.type = 'routine'
   and c.attendance_taken_at = c.date_time + interval '1 hour'
union
select distinct j.created_at
  from public.absence_justifications j
  join public.classes c on c.id = j.class_id
 where j.message in ('Estava com febre, atestado em anexo.',
                     'Compromisso de trabalho no horário da aula.',
                     'Problema no transporte, não consegui chegar a tempo.',
                     'Consulta médica marcada havia semanas.')
   and j.reviewed_at = c.date_time + interval '1 day';

do $$
declare
  v_marcas bigint;
  v_primeira timestamptz;
  v_aulas bigint;
  v_presencas bigint;
  v_justificativas bigint;
  v_mensalidades bigint;
  v_meses bigint;
  v_inicio_do_pacote date;
  v_trava boolean;
begin
  select count(*), min(marca) into v_marcas, v_primeira from limpeza_marcas;
  if v_marcas = 0 then
    raise notice 'Nada a limpar: nenhuma execução do histórico de demonstração encontrada.';
    return;
  end if;

  v_inicio_do_pacote := date_trunc('month', v_primeira - interval '12 months')::date;

  select count(*) into v_aulas from public.classes
   where created_at in (select marca from limpeza_marcas) and title like '% — treino';
  select count(*) into v_presencas from public.attendance
   where created_at in (select marca from limpeza_marcas);
  select count(*) into v_justificativas from public.absence_justifications
   where created_at in (select marca from limpeza_marcas);
  -- Comprovante enviado de verdade nunca sai por aqui: só sem comprovante ou
  -- com o PNG do gerador de demonstração.
  select count(*) into v_mensalidades from public.payments
   where created_at in (select marca from limpeza_marcas)
     and proof_public_id is null
     and (proof_storage_path is null or proof_storage_path like '%/demonstracao-%');
  select count(*) into v_meses from public.attendance_monthly
   where reference_month >= v_inicio_do_pacote and reference_month < date_trunc('month', v_primeira)::date;

  insert into limpeza_relatorio values
    (1, 'execuções do pacote encontradas', v_marcas),
    (2, 'aulas "— treino"', v_aulas),
    (3, 'presenças e faltas', v_presencas),
    (4, 'justificativas', v_justificativas),
    (5, 'mensalidades', v_mensalidades),
    (6, 'meses fechados (' || to_char(v_inicio_do_pacote, 'MM/YYYY') || ' em diante)', v_meses);
  raise notice '% execução(ões) do pacote, a primeira em %: % aulas, % presenças/faltas, % justificativas, % mensalidades, % meses fechados.',
    v_marcas, v_primeira, v_aulas, v_presencas, v_justificativas, v_mensalidades, v_meses;

  -- 2. A exclusão. Justificativa e presença antes da aula (a cascata as
  --    levaria, mas assim a contagem confere linha a linha).
  delete from public.absence_justifications where created_at in (select marca from limpeza_marcas);
  delete from public.attendance where created_at in (select marca from limpeza_marcas);
  -- Mensalidade com o PNG de demonstração: o gatilho de exclusão manda o
  -- arquivo para a fila do worker, que o apaga do Storage.
  delete from public.payments
   where created_at in (select marca from limpeza_marcas)
     and proof_public_id is null
     and (proof_storage_path is null or proof_storage_path like '%/demonstracao-%');

  -- Com as travas da v3 em produção, aula com chamada não se apaga nem pelo
  -- sistema (§ 6 do contrato). Aqui a aula é inventada: a trava é desligada
  -- só dentro desta transação e religada logo depois.
  v_trava := exists (select 1 from pg_trigger
                      where tgname = 'enforce_class_state_rules' and tgrelid = 'public.classes'::regclass);
  if v_trava then
    execute 'alter table public.classes disable trigger enforce_class_state_rules';
  end if;
  delete from public.classes where created_at in (select marca from limpeza_marcas) and title like '% — treino';
  if v_trava then
    execute 'alter table public.classes enable trigger enforce_class_state_rules';
  end if;

  -- Os meses do período do pacote foram calculados em cima de presenças
  -- inventadas; ficariam mentindo no Painel e no histórico do aluno.
  delete from public.attendance_monthly
   where reference_month >= v_inicio_do_pacote and reference_month < date_trunc('month', v_primeira)::date;

  -- 3. Conferência: nada do pacote pode sobrar.
  if exists (select 1 from public.classes where created_at in (select marca from limpeza_marcas) and title like '% — treino')
     or exists (select 1 from public.attendance where created_at in (select marca from limpeza_marcas))
     or exists (select 1 from public.absence_justifications where created_at in (select marca from limpeza_marcas)) then
    raise exception 'Sobrou dado do pacote depois da exclusão: nada foi gravado.';
  end if;
end $$;

select o_que, quantas from limpeza_relatorio order by ordem;

-- 4. Sem a confirmação, desfaz tudo: foi só o relatório.
do $$
begin
  if coalesce(current_setting('limpeza.confirmo', true), 'nao') <> 'sim' then
    raise exception 'SÓ RELATÓRIO: nada foi apagado. Confira os números acima, tire o backup e troque limpeza.confirmo para ''sim''.';
  end if;
end $$;

commit;
