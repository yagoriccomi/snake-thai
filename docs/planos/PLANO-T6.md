# PLANO DE EXECUÇÃO — T6: Aulas recorrentes (grade semanal) e renomear/excluir turma com segurança

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T6` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/grade-semanal-turmas` |
| **Esforço** | G |
| **Depende de** | T1, T4 |

## 1. Enunciado

Criar no banco uma grade semanal por turma (dia da semana, hora local de São Paulo, título, professores, vigência). Uma função idempotente gera as aulas com antecedência, chamada todo dia pelo pg_cron e logo depois de cada edição. Ao editar ou encerrar um horário, só mudam as aulas futuras sem chamada; aula com chamada nunca é tocada. Na mesma entrega entram renomear e excluir turma: a exclusão deixa de usar ON DELETE SET NULL. Turma com histórico é arquivada e turma nunca usada é apagada de fato. Assim nenhuma aula de rotina vira evento global e nenhum aluno fica sem turma sem que o admin escolha isso.

## 2. Terreno (situação verificada)

- Não existe recorrência: `classes` tem só id, title, type, date_time, group_id, timestamps e attendance_taken_at. A agenda é criada aula a aula.  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:91-100; 20260914120100_frequencia_fundacao.sql:102; CriarAulaScreen.tsx:105-111 (createClass/updateClass de uma aula só)
- `classes.group_id` nulo significa evento global. O aluno vê as aulas da própria turma e também as que têm group_id nulo.  
  _Evidência:_ supabase/migrations/20260727150000_profiles_group_id.sql:4-6; src/services/classes.service.ts:33-37 (`group_id.eq.X,group_id.is.null`)
- As FKs para groups usam ON DELETE SET NULL em profiles, classes e attendance_monthly.  
  _Evidência:_ 20260727160000_groups.sql:19-25; 20260914120100_frequencia_fundacao.sql:348
- Apagar uma turma hoje (a RLS permite ao admin) teria quatro efeitos: as rotinas dela virariam globais e visíveis a todos os alunos; a chamada dessas aulas listaria TODOS os alunos; os alunos ficariam sem turma, com 0 aulas e 100% de frequência; e as aulas continuariam no aviso de aula sem chamada.  
  _Evidência:_ groups.sql:46-48 (groups_delete_admin); classes.service.ts:159 (groupId nulo lista todos); 20260914140000_frequencia_regras.sql:99-104 (join c.group_id = a.group_id) e 217-230 (aulas_sem_chamada sem filtro de turma)
- O banco não impede aula de rotina sem turma. Só a tela exige a turma.  
  _Evidência:_ init_schema.sql:91-100 (group_id nullable, sem CHECK); CriarAulaScreen.tsx:89-91
- O app só cria e lista turmas. Renomear e excluir não existem, embora a RLS já permita update e delete ao admin. O backlog marca os dois itens como P0.  
  _Evidência:_ src/services/groups.service.ts (só fetchGroups/createGroup); src/hooks/useGroups.ts:44-50; groups.sql:41-48; docs/FUNCIONALIDADES.md:46-47
- `groups.name` é UNIQUE, mas diferencia maiúsculas de minúsculas. O id é texto (uuid em texto; os testes usam ids legíveis).  
  _Evidência:_ 20260727160000_groups.sql:9-10; supabase/tests/regressao_chamada_em_lote.sql:15
- A frequência conta como total do mês INTEIRO todas as aulas de rotina cadastradas da turma atual do aluno (o '12' do '0/12'). Aula sem chamada sai do percentual. Por isso a geração precisa cobrir o mês corrente inteiro.  
  _Evidência:_ 20260914140000_frequencia_regras.sql:80-104; docs/FREQUENCIA.md:96-97 e 112-116
- A lista da chamada sai da turma ATUAL dos alunos. `salvar_chamada` zera a chamada de quem não vier nas listas. Se a turma for arquivada e os alunos movidos, reabrir e salvar uma aula antiga apagaria a chamada dela.  
  _Evidência:_ src/hooks/useClassAttendance.ts:55-56; classes.service.ts:152-160; 20260914190000_chamada_em_lote.sql:399-405
- O vínculo de professores é N:N em `class_teachers`, com gatilho que exige role=professor. No app, o admin não tem tela para pôr professor numa aula; só o próprio professor entra ou sai.  
  _Evidência:_ 20260903120100_professores.sql:119-157; DetalheAulaScreen.tsx:69-97 (addClassTeacher só com profile.id); profile.service.ts:131-142 (fetchAllProfessors existe)
- O admin pode editar data/hora e turma de qualquer aula, inclusive das que já têm chamada. O app não tem exclusão de aula.  
  _Evidência:_ classes.service.ts:123-136; init_schema.sql:285-292 (classes_update_admin/classes_delete_admin); nenhum `.delete()` sobre classes em src/services
- Os jobs pg_cron são agendados dentro de migrations, e as funções de lote recebem `p_agora` para a regressão fixar a data.  
  _Evidência:_ 20260904200000_geracao_mensalidades.sql:241-245; 20260914140000_frequencia_regras.sql:244-251 e 303-309
- A seed de demonstração cria a agenda com SQL fixo (segunda, quarta e sexta, 4 semanas, horário deduzido do nome da turma). Pelo contexto do projeto, ela rodou em produção, onde há aulas futuras fictícias.  
  _Evidência:_ supabase/seed/demo_seed.sql:280-303; README.md:225 (psql "$DATABASE_URL"); demo_seed_limpar.sql:10-11 (não remove aulas nem turmas)
- As regressões SQL rodam numa transação com ROLLBACK, trocam o ator com `set local role authenticated` + `request.jwt.claims` e sinalizam com NOTICE OK/FALHOU.  
  _Evidência:_ supabase/tests/regressao_chamada_em_lote.sql:1-70
- Ambiente local: psql não está no PATH e a Supabase CLI é a 2.117.0. Outro stack Supabase (radar-tributario) já ocupa as portas 54321/54322, as mesmas do config.toml do snake-thai, então `supabase start` do snake-thai deve conflitar. Esse conflito não foi testado.  
  _Evidência:_ `where psql` → não encontrado; `npx supabase --version` → 2.117.0; `docker ps` → supabase_db_radar-tributario 0.0.0.0:54322, supabase_kong_radar-tributario 0.0.0.0:54321; supabase/config.toml:8,14
- `combineDateTimeToIso` converte pela timezone do APARELHO. A grade deve mandar a hora como `time` local de São Paulo e deixar a conversão para o banco.  
  _Evidência:_ src/utils/datetime.ts:15-38
- O snake-server não referencia turmas nem aulas: não há mudança no backend Node.  
  _Evidência:_ grep por groups/classes/group_id em snake-server/src sem resultado

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Até quando as aulas da grade são geradas com antecedência?**

- Até o último dia do mês seguinte (job diário)
- Janela fixa de 4 semanas
- Janela fixa de 8 semanas

➡️ _Adotado:_ Até o fim do mês seguinte. É o mínimo que garante o contador 'X/12' certo desde o dia 1: 4 semanas a partir do dia 1 não cobrem os dias 29 a 31.

**P2. Quem pode criar, editar e encerrar horários da grade?**

- Só o admin
- Admin e professores (o professor só nos horários em que está)

➡️ _Adotado:_ Só o admin, como já é com editar e excluir aula (classes_update_admin).

**P3. Já existe aula avulsa cadastrada na mesma turma, dia e hora de um horário novo. O que fazer?**

- Adotar a aula existente na grade (sem duplicar)
- Ignorar e gerar outra (duplicada)
- Apagar a avulsa e gerar a da grade

➡️ _Adotado:_ Adotar. Preserva declarações e justificativas já feitas e evita duplicatas com a agenda de produção.

**P4. O admin edita uma aula específica da grade (ex.: muda o horário de uma segunda). Uma edição posterior do horário da grade sobrescreve essa aula?**

- Não: a aula fica 'desvinculada' e a grade não mexe mais nela
- Sim: a grade sempre prevalece

➡️ _Adotado:_ Não sobrescrever. Custa uma coluna (`schedule_detached`) e já serve de base para o futuro 'remarcar aula' (P1).

**P5. O que 'Excluir turma' faz quando a turma já tem alunos, aulas ou histórico?**

- Arquivar (some dos seletores, histórico intacto) e apagar de fato só a turma nunca usada
- Só bloquear a exclusão enquanto houver qualquer vínculo
- Apagar tudo, inclusive aulas passadas e frequência

➡️ _Adotado:_ Arquivar quando há histórico e apagar só a turma nunca usada. Apagar tudo destrói frequência congelada. Só bloquear deixa o admin sem saída para turma extinta.

**P6. Para onde vão os alunos da turma excluída ou arquivada?**

- O admin escolhe na hora: outra turma ou 'Sem turma' (explícito)
- Bloquear até o admin mover um a um em Gerenciar Alunos
- Ficam sem turma automaticamente

➡️ _Adotado:_ Escolha obrigatória na hora da confirmação. 'Sem turma' só se marcado de propósito, porque o aluno passa a ver só eventos e fica com 100% de frequência.

**P7. As aulas futuras AVULSAS (fora da grade) de uma turma arquivada também são removidas?**

- Sim, todas as futuras sem chamada
- Não, só as da grade

➡️ _Adotado:_ Sim. Turma arquivada não tem aula futura, e manter essas aulas deixaria alunos movidos sem acesso a elas.

**P8. A chamada das aulas passadas de uma turma arquivada pode ser alterada?**

- Não: fica congelada (banco recusa)
- Sim, montando a lista pelos alunos que têm registro na aula

➡️ _Adotado:_ Congelar. Hoje a lista sai da turma atual, e salvar uma aula antiga com a lista vazia apagaria a chamada. Se precisar corrigir, reativa a turma, corrige e arquiva de novo.

**P9. O nome de uma turma arquivada continua reservado? E é possível reativar a turma?**

- Nome reservado + reativação permitida
- Nome liberado (renomeia a arquivada com sufixo) + reativação
- Sem reativação

➡️ _Adotado:_ Nome reservado e reativação permitida. É simples (update de archived_at via RPC) e evita duas 'Turma Noite' no histórico.

**P10. Cancelar uma aula isolada da grade (feriado) entra agora?**

- Não: fica para o item P1 'Cancelar/remarcar aula e feriados'; T6 só garante que aula apagada não é recriada
- Sim, incluir tela de cancelar ocorrência em T6

➡️ _Adotado:_ Deixar para o P1. T6 cria a tabela de exceções (`class_schedule_skips`) que o P1 vai usar.

## 4. Ações que só o usuário pode fazer

- [ ] Responder às decisões acima antes da implementação. As migrations dependem das decisões 1, 3, 4, 5, 6, 7 e 8.
- [ ] Informar a grade real de cada turma (dias, horários, título, professores e início da vigência) ou cadastrá-la pelo app depois do deploy.
- [ ] Antes do deploy em produção, rodar ou autorizar a consulta somente leitura `select count(*) from public.classes where type = 'routine' and group_id is null;`. Se o resultado for maior que zero, a migration aborta de propósito e é preciso decidir o destino dessas aulas.
- [ ] Decidir se as aulas futuras de demonstração criadas em produção pelo demo_seed.sql (seção 8) serão apagadas antes de cadastrar a grade real. Se o horário coincidir, elas seriam adotadas pela grade como aulas reais.
- [ ] Autorizar explicitamente o push da branch, a abertura do PR, o merge e o `supabase db push` em produção (regra do projeto: push só com decisão explícita).
- [ ] Depois do release, instalar o novo APK nos aparelhos de admin e professores antes de usar a grade e a exclusão de turma. O APK 1.6.0 não conhece turma arquivada nem aula desvinculada.

## 5. Passos atômicos

### Passo 1

Preparação. Criar a branch `feat/grade-semanal-turmas` a partir da integração mais recente (depois do merge de feat/papel-professor). Subir o banco de dev local (tarefa de separação dev/produção), resolvendo o conflito de portas com o stack radar-tributario. Confirmar o nome do container com `docker ps --format "{{.Names}}"` (esperado: `supabase_db_snake-thai`). Rodar as 6 regressões existentes como linha de base, sem psql no host: `for f in supabase/tests/*.sql; do docker exec -i supabase_db_snake-thai psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"; done`.

_Arquivos:_ `supabase/tests/*.sql`

**Como verificar:** As 6 regressões terminam só com NOTICE 'OK ...' e nenhum 'FALHOU'. `git branch --show-current` = feat/grade-semanal-turmas. Nada é executado contra produção.

### Passo 2

Migration A (`npx supabase migration new turmas_arquivamento`). Conteúdo: (1) `alter table public.groups add column archived_at timestamptz`. (2) Recriar as FKs `profiles_group_id_fkey`, `classes_group_id_fkey` e a de `attendance_monthly.group_id` com ON DELETE RESTRICT. O nome da última é gerado automaticamente: confirmar antes com `\d public.attendance_monthly` no banco local. (3) Bloco DO fail-fast: se existir `classes` com type='routine' e group_id nulo, `raise exception` com instrução. Em seguida, `alter table public.classes add constraint classes_rotina_exige_turma check (type <> 'routine' or group_id is not null)`. (4) Função de gatilho `public.enforce_turma_ativa()` (security definer, search_path ''), BEFORE INSERT OR UPDATE OF group_id em profiles e classes: recusa com 23514 quando o novo group_id não é nulo, mudou e aponta para turma arquivada. (5) Privilégios por coluna: `revoke update, delete on public.groups from authenticated; grant update (name) on public.groups to authenticated`. Arquivar, reativar e excluir passam só por RPC. (6) `create or replace` de `aulas_sem_chamada` (copiar de 20260914140000:205-232) excluindo aulas de turma arquivada. (7) `create or replace` de `salvar_chamada` (copiar de 20260914190000:330-415) e de `concluir_chamada` (20260914140000:142-185), acrescentando logo após o `select ... for update` a recusa (23514) quando a turma da aula está arquivada. Manter revoke/grant e comments.

_Arquivos:_ `supabase/migrations/<timestamp>_turmas_arquivamento.sql`

**Como verificar:** `npx supabase db reset` aplica tudo sem erro. `\d public.classes` e `\d public.profiles` mostram FK `ON DELETE RESTRICT` e a check `classes_rotina_exige_turma`. `\dp public.groups` mostra update só na coluna name para authenticated.

### Passo 3

Migration B (`npx supabase migration new grade_semanal`). Tabelas: (a) `class_schedules`: id uuid pk; group_id text not null references groups on delete restrict; title text not null com check de não-vazio; weekday smallint not null check 0..6 (0=domingo, igual a `extract(dow)` e `Date.getDay()`); start_time time not null (hora LOCAL de São Paulo); valid_from date not null; valid_until date null com check `valid_until is null or valid_until >= valid_from`; created_by uuid references profiles on delete set null; created_at e updated_at com trigger handle_updated_at; trigger enforce_turma_ativa. (b) `class_schedule_teachers` (schedule_id on delete cascade, teacher_id on delete cascade, created_at, pk composta), reusando o trigger `enforce_class_teacher_is_professor()`. (c) `class_schedule_skips` (schedule_id on delete cascade, occurrence_date, pk composta). (d) Em classes: `schedule_id uuid references class_schedules on delete set null`, `occurrence_date date`, `schedule_detached boolean not null default false`, check `schedule_id is null or occurrence_date is not null`, índice único parcial `(schedule_id, occurrence_date) where schedule_id is not null`. RLS nas 3 tabelas: select para `is_admin() or is_professor()`, sem policies de escrita; grant select a authenticated e all a service_role. Gatilho AFTER DELETE em classes: se old.schedule_id não é nulo e `current_setting('snake.ajuste_da_grade', true)` não é 'on', grava skip (on conflict do nothing), para a aula apagada não ser recriada. Funções: (1) `gerar_aulas_da_grade(p_schedule_id uuid default null, p_agora timestamptz default now()) returns integer`, security definer, revoke de public/anon/authenticated. Horizonte = último dia do mês seguinte em São Paulo. Candidatos = horários de turma não arquivada × `generate_series(greatest(valid_from, hoje_sp), least(coalesce(valid_until, horizonte), horizonte))` com dow = weekday, `(dia + start_time) at time zone 'America/Sao_Paulo' > p_agora` e sem skip. Primeiro ADOTA a aula avulsa de mesma turma, type routine, schedule_id nulo e date_time igual (update de schedule_id/occurrence_date). Depois insere `on conflict (schedule_id, occurrence_date) where schedule_id is not null do nothing returning`. Por fim copia os professores do horário para class_teachers, com join em profiles role='professor' para um professor rebaixado não abortar o lote. (2) `salvar_horario_da_grade(p_id, p_group_id, p_title, p_weekday, p_start_time, p_valid_from, p_valid_until, p_teacher_ids uuid[]) returns jsonb`, só admin (42501). Na edição, recusa trocar group_id ou weekday (22023: 'encerre e crie outro'). Faz `set_config('snake.ajuste_da_grade','on',true)` e ajusta as ocorrências com date_time > now(), attendance_taken_at nulo e schedule_detached falso: novo title/date_time só quando o novo instante também é futuro; remove as que ficaram fora da nova vigência; limpa skips além do valid_until antigo quando a vigência aumenta; aplica o diff de professores (tira os removidos, inclui os novos, preserva quem entrou manualmente). Volta o GUC para 'off', chama `gerar_aulas_da_grade(p_id)` e retorna {schedule_id, ajustadas, removidas, criadas}. (3) `encerrar_horario_da_grade(p_id, p_ultimo_dia date) returns jsonb`, só admin: recusa p_ultimo_dia < hoje_sp - 1; remove ocorrências futuras sem chamada e não desvinculadas com occurrence_date > p_ultimo_dia; se p_ultimo_dia < valid_from, apaga o horário; senão grava valid_until. (4) `previa_exclusao_turma(p_group_id text) returns jsonb` (stable, só admin): alunos (role user, anonymized_at nulo), aulas_futuras_sem_chamada, aulas_passadas, horarios_ativos, meses_congelados, pode_apagar_de_vez. (5) `excluir_turma(p_group_id text, p_destino text default null, p_deixar_sem_turma boolean default false) returns jsonb`, só admin: trava a turma; recusa se já arquivada ou se o destino é inválido ou arquivado; se há alunos sem destino e sem p_deixar_sem_turma, recusa (22023). Move os alunos, apaga as aulas futuras sem chamada da turma (com o GUC ligado), apaga horários sem nenhuma aula e encerra os demais em hoje_sp. Se não sobrou referência, faz DELETE da turma (acao 'apagada'); senão grava archived_at = now() (acao 'arquivada'). (6) `reativar_turma(p_group_id)`, só admin: zera archived_at. Cron: `select cron.schedule('generate-scheduled-classes', '40 3 * * *', $$ select public.gerar_aulas_da_grade(); $$)`, que dá 00:40 em São Paulo, depois do close-monthly-attendance (03:20 UTC do dia 1).

_Arquivos:_ `supabase/migrations/<timestamp>_grade_semanal.sql`

**Como verificar:** `npx supabase db reset` sem erro. `select jobname, schedule from cron.job` lista generate-scheduled-classes. `\df public.*grade*` e `\df public.excluir_turma` existem. `has_function_privilege('authenticated','public.gerar_aulas_da_grade(uuid,timestamptz)','execute')` = false.

### Passo 4

Regressão `supabase/tests/regressao_turmas.sql`, no padrão existente (begin, massa com ids fixos, troca de ator, rollback). Casos: T1 aluno e professor não renomeiam (update direto → 42501 por privilégio de coluna) nem executam excluir_turma (42501). T2 admin renomeia; nome duplicado → unique_violation; nome em branco → check_violation. T3 DELETE direto de turma com aulas, alunos ou attendance_monthly → 23503, e a contagem de `classes where type='routine' and group_id is null` continua 0. T4 insert de rotina com group_id nulo → check_violation. T5 previa_exclusao_turma devolve as contagens certas. T6 excluir_turma com alunos e sem destino → 22023; com destino → alunos movidos; com p_deixar_sem_turma → group_id nulo. T7 depois de arquivar: aulas futuras sem chamada (avulsas e da grade) apagadas; aulas passadas com e sem chamada preservadas COM o group_id; eventos globais intactos; horários encerrados; attendance_monthly preserva o group_id. T8 turma arquivada recusa novo aluno, nova aula e novo horário (23514). T9 salvar_chamada e concluir_chamada em aula de turma arquivada → recusa, e a chamada existente fica intacta. T10 aulas_sem_chamada não lista turma arquivada. T11 turma nunca usada → excluir_turma devolve 'apagada' e a linha some. T12 reativar_turma volta a aceitar alunos. T13 justificativa com anexo numa aula futura removida gera linha em media_deletion_queue (fila LGPD).

_Arquivos:_ `supabase/tests/regressao_turmas.sql`

**Como verificar:** `docker exec -i supabase_db_snake-thai psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/regressao_turmas.sql` termina com 13 NOTICE OK e ROLLBACK, sem FALHOU.

### Passo 5

Regressão `supabase/tests/regressao_grade_semanal.sql`, com datas fixas em 2030 via p_agora (ex.: '2030-03-01 10:00-03'). Casos: G1 aluno e professor não executam salvar/encerrar (42501); insert direto em class_schedules → 42501. G2 horário de segunda às 19:00 gera só segundas, com `(date_time at time zone 'America/Sao_Paulo')::time = '19:00'`. G3 rodar a geração duas vezes não duplica. G4 horizonte: última ocorrência ≤ 2030-04-30, nenhuma no passado ou no mesmo dia antes de p_agora. G5 respeita valid_from e valid_until. G6 professores do horário copiados para class_teachers; professor rebaixado não aborta o lote. G7 aula avulsa no mesmo horário é adotada, sem duplicar. G8 editar a hora: futuras sem chamada mudam; passada com chamada e ocorrência desvinculada não mudam. G9 editar professores: diff aplicado; professor que entrou manualmente numa ocorrência permanece. G10 encerrar: futuras além da data removidas, com chamada preservadas, sem skips gerados. G11 aula da grade apagada manualmente não volta na geração seguinte. G12 aumentar a vigência depois de encerrar volta a gerar. G13 turma arquivada não gera. G14 frequencia_mensal com p_referencia no dia 1 dá total_classes igual ao número de aulas geradas no mês e frequency_percent 100. G15 trocar weekday na edição → 22023; weekday 7 ou valid_until < valid_from → check_violation.

_Arquivos:_ `supabase/tests/regressao_grade_semanal.sql`

**Como verificar:** O mesmo comando docker exec termina com 15 NOTICE OK e ROLLBACK, sem FALHOU.

### Passo 6

Rodar a suíte SQL completa (as 6 antigas + 2 novas), porque a migration A reescreve salvar_chamada, concluir_chamada e aulas_sem_chamada. Regenerar os tipos com `npm run supabase:types`, que usa o banco local.

_Arquivos:_ `src/types/database.types.ts`

**Como verificar:** As 8 regressões verdes. database.types.ts passa a ter class_schedules, class_schedule_teachers, class_schedule_skips, groups.archived_at, classes.schedule_id/occurrence_date/schedule_detached e as RPCs novas. `npm run typecheck` passa.

### Passo 7

Serviços. (a) groups.service.ts: `renameGroup(id, name)` (trim, update só de name; 23505 vira mensagem 'Já existe uma turma com esse nome'), `previewGroupRemoval(id)`, `removeGroup({groupId, destinationGroupId, leaveWithoutGroup})` via rpc excluir_turma (devolve 'apagada' ou 'arquivada'), `reactivateGroup(id)`. fetchGroups continua trazendo as arquivadas, para os rótulos de aulas antigas. (b) Novo src/services/schedules.service.ts: `fetchSchedulesForGroup(groupId)` com professores, `saveSchedule(input)` via rpc salvar_horario_da_grade com a hora como string 'HH:MM' (nunca ISO do aparelho), `endSchedule(id, lastDayIso)`. Tipos derivados de database.types. (c) classes.service.ts: `updateClass` grava `schedule_detached: true` quando a aula tem schedule_id. Testes Jest no padrão de src/services/__tests__ (mockRpc de frequency.service.test.ts e createQueryChain): groups.service.test.ts e schedules.service.test.ts cobrindo sucesso, erro de RLS, erro de rede e mapeamento de 23505/22023; mais um caso em classes.service.test.ts para schedule_detached.

_Arquivos:_ `src/services/groups.service.ts`, `src/services/schedules.service.ts`, `src/services/classes.service.ts`, `src/services/__tests__/groups.service.test.ts`, `src/services/__tests__/schedules.service.test.ts`, `src/services/__tests__/classes.service.test.ts`

**Como verificar:** `npm test` verde (324 testes anteriores + novos); `npm run typecheck` sem erros.

### Passo 8

Hooks e componentes. useGroups ganha `activeGroups` (sem archived_at), `renameGroup` e `removeGroup`. GroupPicker lista só as ativas, exceto a turma já selecionada (com o rótulo '(arquivada)'). Novo `useGroupSchedules(groupId)`. Novo componente `WeekdayPicker` (chips Dom..Sáb, accessibilityRole 'radio', área de toque ≥ 44dp). Novo `ProfessorMultiPicker` em BottomSheet (via Portal, por causa do teclado), usando fetchAllProfessors e TeacherDot para a cor. Testes RNTL: GroupPicker esconde arquivada e mantém a selecionada; WeekdayPicker; ProfessorMultiPicker.

_Arquivos:_ `src/hooks/useGroups.ts`, `src/hooks/useGroupSchedules.ts`, `src/components/GroupPicker.tsx`, `src/components/WeekdayPicker.tsx`, `src/components/ProfessorMultiPicker.tsx`, `src/components/__tests__/GroupPicker.test.tsx`, `src/components/__tests__/WeekdayPicker.test.tsx`

**Como verificar:** `npm test` verde; os seletores de CadastrarAluno, GerenciarAlunos e CriarAula deixam de oferecer turma arquivada.

### Passo 9

Telas do admin na stack Dados, com uma nova linha 'Turmas e grade semanal' no bloco admin de DadosScreen (junto de Planos e Configurações). (1) `TurmasScreen`: FlatList de turmas ativas (nome, nº de alunos, nº de horários) e seção recolhida de arquivadas com 'Reativar'. Ações 'Renomear' (BottomSheet com Input) e 'Excluir turma': abre a prévia (previewGroupRemoval) com as consequências em texto; se houver alunos, exige escolher a turma de destino ou marcar 'Deixar sem turma'; avisa que trocar alunos de turma no meio do mês muda a frequência deles; confirma com botão destrutivo e informa se a turma foi apagada ou arquivada. (2) `GradeTurmaScreen` (params groupId, groupName): horários agrupados por dia, com professores e vigência; FAB 'Novo horário'; ações 'Editar' e 'Encerrar' (pede o último dia, DD/MM/AAAA). (3) `HorarioFormScreen`: título, WeekdayPicker (desabilitado na edição, com dica 'para mudar o dia, encerre e crie outro'), hora HH:MM (maskTime), início e fim da vigência (maskDate, fim opcional), ProfessorMultiPicker. Aviso antes de salvar uma edição: 'As aulas futuras deste horário que ainda não tiveram chamada serão atualizadas'. Depois mostra o resumo {criadas, ajustadas, removidas}. Tipos em DadosStackParamList e rotas em DadosStackNavigator.

_Arquivos:_ `src/screens/dados/TurmasScreen.tsx`, `src/screens/dados/GradeTurmaScreen.tsx`, `src/screens/dados/HorarioFormScreen.tsx`, `src/screens/dados/DadosScreen.tsx`, `src/navigation/types.ts`, `src/navigation/DadosStackNavigator.tsx`

**Como verificar:** typecheck e testes verdes. No aparelho, com o banco de dev: criar um horário gera as aulas, que aparecem na WeekStrip de AdminAulasList e na lista do aluno da turma; renomear reflete nos rótulos; excluir turma com alunos pede destino.

### Passo 10

Ajustes nas telas existentes. ClassNavParams ganha `scheduleId: string | null` (AdminAulasList, ProfessorAulasList e DetalheAula passam o valor). DetalheAulaScreen mostra o selo 'Grade semanal'. CriarAulaScreen, ao editar uma aula da grade, avisa que ela passa a ser independente da grade. FrequenciaScreen abre em somente leitura (canManage=false) quando a turma da aula está arquivada, com a explicação na tela. As listas usam o nome da turma com '(arquivada)' quando for o caso.

_Arquivos:_ `src/navigation/types.ts`, `src/screens/aulas/AdminAulasList.tsx`, `src/screens/aulas/ProfessorAulasList.tsx`, `src/screens/aulas/DetalheAulaScreen.tsx`, `src/screens/aulas/CriarAulaScreen.tsx`, `src/screens/aulas/FrequenciaScreen.tsx`

**Como verificar:** No aparelho: editar uma ocorrência e depois mudar a hora do horário não altera essa ocorrência. Aula antiga de turma arquivada abre a chamada sem botão de salvar.

### Passo 11

Seeds. Em demo_seed.sql, trocar a seção 8 (insert direto em classes com horário deduzido do nome) por insert idempotente em class_schedules (seg/qua/sex, mesmo horário por turma) seguido de `select public.gerar_aulas_da_grade();`. A seção 9 (professores) continua valendo para as aulas geradas. Em demo_seed_historico.sql, a agenda passada continua avulsa (a geração só cria aulas futuras). Não rodar seeds em produção.

_Arquivos:_ `supabase/seed/demo_seed.sql`

**Como verificar:** No banco local, rodar demo_seed.sql duas vezes via docker exec não duplica horários nem aulas (contar antes e depois).

### Passo 12

Documentação: FUNCIONALIDADES.md (marcar 'Renomear / excluir turma' e 'Aulas recorrentes' como FEITO); MANUAL-DO-ADMINISTRADOR.md §5 (grade semanal, editar e encerrar horário, excluir ou arquivar turma, o que acontece com alunos e aulas); FREQUENCIA.md (aulas geradas até o fim do mês seguinte, turma arquivada congela a chamada, troca de turma no meio do mês); RUNBOOK.md/BACKEND.md (novo job generate-scheduled-classes e como rodar as regressões via docker exec); README.md (módulo finalizado, conforme §9 do CLAUDE.md).

_Arquivos:_ `docs/FUNCIONALIDADES.md`, `docs/MANUAL-DO-ADMINISTRADOR.md`, `docs/FREQUENCIA.md`, `docs/RUNBOOK.md`, `README.md`

**Como verificar:** Revisão: nenhuma regra do documento contradiz as regressões G* e T*.

### Passo 13

Commits em Conventional Commits, separados: feat(banco) turmas arquivamento; feat(banco) grade semanal; test(banco) regressões; feat(turmas) telas; feat(grade) telas; docs. O Husky roda typecheck + jest. Push e PR para main só com autorização explícita do usuário.

**Como verificar:** `git log --oneline main..feat/grade-semanal-turmas` mostra os commits. Pre-commit verde. PR aberto só depois da autorização.

### Passo 14

Produção, só com autorização do usuário. (1) O usuário roda a contagem somente leitura de rotinas sem turma. (2) `supabase db push`. (3) O usuário confere `select jobname, schedule from cron.job` e, no dia seguinte, `select status, return_message from cron.job_run_details where jobid = (select jobid from cron.job where jobname='generate-scheduled-classes') order by start_time desc limit 3`. (4) Decidir a limpeza das aulas futuras de demonstração. (5) Gerar o APK com a nova versão (tarefa de versionamento/release) e cadastrar a grade real pelo app.

**Como verificar:** Job com status 'succeeded'. Aulas geradas até o fim do mês seguinte para cada horário cadastrado. Nenhuma aula de rotina com group_id nulo.

## 6. Riscos

- Legado em produção: se já existir aula de rotina sem turma, a migration A aborta (de propósito). Sem o fail-fast, a nova check faria o `salvar_chamada` dessas aulas falhar, porque check NOT VALID ainda é avaliada em todo UPDATE da linha.
- APK 1.6.0 em uso: o seletor ainda mostra turmas arquivadas, e escolher uma recebe recusa do banco com mensagem genérica. A edição de uma aula da grade não marca schedule_detached, então uma edição posterior do horário a sobrescreve. É preciso distribuir o APK novo antes de usar a grade.
- Troca de turma no meio do mês (inclusive ao arquivar com destino): frequencia_mensal usa a turma ATUAL. As aulas da turma antiga somem da conta do aluno, e as da nova que já tiveram chamada contam como falta. O comportamento já existe hoje (GerenciarAlunos troca a turma), mas o arquivamento o torna mais frequente. Recomendação: arquivar na virada do mês, e a tela avisa.
- Remover aulas futuras (encerrar horário ou arquivar turma) apaga em cascata as declarações e as justificativas pendentes dos alunos para essas aulas. O anexo vai para a fila de eliminação LGPD. Sem notificação push, o aluno não é avisado.
- A geração em lote é uma transação só: um erro inesperado aborta o job inteiro. Mitigado com filtros (professor com role válido, turma não arquivada, só aulas futuras) e com a geração imediata a cada salvamento. Falhas só aparecem em cron.job_run_details, que deve ser monitorado.
- O mecanismo de skips usa um GUC transacional (`snake.ajuste_da_grade`). Se uma função esquecer de desligá-lo, apagamentos manuais na mesma transação não gravam skip. Os casos G10–G12 cobrem isso.
- Reescrever salvar_chamada, concluir_chamada e aulas_sem_chamada com `create or replace` exige copiar o corpo vigente com exatidão. Uma divergência regride a chamada em produção, por isso a suíte SQL completa precisa rodar antes do push.
- Aulas fictícias da seed em produção: se coincidirem com a grade real, são adotadas como aulas reais; se não, ficam como avulsas duplicando a agenda. Depende da decisão de limpeza.
- Ambiente local: o stack radar-tributario ocupa 54321/54322. Sem a tarefa de separação dev/produção resolvida, não há onde rodar as regressões sem tocar produção, e T6 não deve começar antes disso.
- Conflito de merge provável com a tarefa 'editar dados do aluno' (GerenciarAlunosScreen, GroupPicker, profile.service). Convém sequenciar ou rebasear.
- Unicidade de nome diferencia maiúsculas ('Turma A' e 'turma a' convivem). Fica fora do escopo porque normalizar exigiria conferir duplicatas em produção.
- IDs de dependência assumidos pela ordem do pedido: T1 = separar dev de produção (banco local em Docker); T4 = pushs, PRs e merges (integrar feat/papel-professor). Ajustar se a numeração do orquestrador for outra.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T7, T8, T9:** A T1 move a stack local para as portas 553xx (API 55321, DB 55322) porque o radar-tributario ocupa as 543xx. As outras tarefas assumem as portas antigas: T7 ('API em 127.0.0.1:54321', curl em 54321), T8 ('adb reverse tcp:54321'), T9 (psql do host em 54322, vault push_project_url 'http://host.docker.internal:54321', 'supabase status mostra 54321/54322'). A T9 também usa psql no host, que não está instalado.  
  **Resolução:** Depois da T1, trocar em todos os planos para 55321/55322. Rodar SQL sempre por 'docker exec -i supabase_db_snake-thai psql' ou pelos subcomandos do scripts/db-dev. Na T9, o Vault local usa 'http://host.docker.internal:55321' ou o nome do container Kong com a porta interna 8000. Na T8, o adb reverse passa para tcp:55321.
- **Conflito com T1, T7, T8:** Não há um jeito único de rodar os testes e as seeds locais. A T1 (passo 4) roda a suíte com 'db reset --local' e só o seed.sql, sem demo. A T8 (passos 1 e 4) semeia a demo e roda as 6 regressões com os dados de demo carregados. T6 e T7 (passo 1) exigem as 6 regressões verdes como linha de base, mas regressao_c3_payment_whitelist.sql falha hoje e só a T1 (passo 4) a corrige. A T8 (passo 1) roda demo_seed.sql direto, e ele depende de contas @snake.com, turmas e plano que só o local_base.sql da T1 (passo 5) cria. A T6 (passo 11) reescreve a seção 8 do demo_seed.sql, onde a T1 (passo 5) coloca uma trava.  
  **Resolução:** T6, T7 e T8 começam só depois dos passos 2 a 5 da T1. Entrada única: 'scripts\db-dev test' para a suíte (banco limpo) e 'scripts\db-dev reset' para as seeds. Testes novos usam UUIDs próprios e deltas, para passar nos dois estados. A edição da T6 no demo_seed.sql é feita em cima da versão com a trava da T1.
- **Conflito com T1, T7, T8, T9:** A publicação em produção não segue o fluxo novo. T6 (passo 14), T7 (passo 15) e T9 (passo 18) chamam 'supabase db push' direto, sem o script com dupla confirmação da T1; a CLI está linkada à produção e 'db push' usa o projeto linkado por padrão. A T7 fixa timestamps (20260917120000, 20260917130000) enquanto as outras usam 'migration new'. Uma migration criada depois mas com timestamp menor que a última aplicada no remoto faz o 'db push' recusar, exigindo --include-all. Ninguém prevê backup antes de cada push.  
  **Resolução:** Todo push de migration em produção passa por scripts\db-push-prod.bat (T1, passo 12), antecedido por 'npx supabase db dump --linked' para fora do repositório, feito pelo usuário. Os timestamps são gerados ('migration new' ou renomeação) no rebase final, logo antes do merge de cada tarefa, na ordem de integração T7 → T6 → T8 → T9. Nunca usar --include-all em produção sem revisão.
- **Conflito com T7:** Um professor anonimizado continua sendo escalado em aulas futuras. A T7 remove o professor só de class_teachers das aulas futuras e mantém role='professor'. A T6 cria class_schedule_teachers, e gerar_aulas_da_grade (cron diário) copia os professores do horário com join em profiles.role='professor', sem filtrar anonymized_at. Na geração seguinte o professor volta às aulas futuras. O diretório e os avisos da T9 também passariam a mirar esse perfil.  
  **Resolução:** Na T6, a geração filtra 'p.anonymized_at is null and p.status = ''active'''. Se a T7 entrar primeiro, a migration da T6 também atualiza anonimizar_titular para apagar class_schedule_teachers do titular. Se a T6 entrar primeiro, isso fica na migration da T7. Incluir um caso de regressão nas duas.
- **Conflito com T9:** A T6 exclui turmas arquivadas de aulas_sem_chamada e congela a chamada delas. A função enfileirar_avisos_aula_sem_chamada da T9 lê classes direto e não filtra groups.archived_at, então avisaria sobre aulas de turma arquivada das últimas 24h que nunca poderão ter chamada. O job push-limpeza da T9 apaga cron.job_run_details de TODOS os jobs com mais de 7 dias, o que reduz o histórico usado para monitorar generate-scheduled-classes (T6) e os jobs financeiros.  
  **Resolução:** A T9 filtra turma arquivada e professor anonimizado ou inativo. A limpeza de cron.job_run_details fica restrita a jobname like 'push-%', ou a retenção de 7 dias é aceita e documentada no RUNBOOK.
- **Conflito com T1, T3, T8, T9:** Várias tarefas esbarram no 'Esquece o CI' (não adicionar testes ao CI). A T1 altera o ci.yml, só a porta do psql (necessário porque o job lê o config.toml). As regressões novas de T6, T8 e T9 em supabase/tests/ passam a rodar sozinhas no job 'banco'. Os testes Jest de T2, T3, T10 e T11 rodam no job de testes. Só a T9 levanta essa questão.  
  **Resolução:** Decisão única do usuário, aplicada a todas as tarefas. Recomendação: aceitar que testes nas pastas existentes rodem no CI atual, sem nenhum job ou passo novo, e manter a única edição do ci.yml na porta 55322. Se o usuário quiser literalmente nada novo no CI, todas as regressões novas vão para supabase/tests-local/ e o db-dev test da T1 percorre as duas pastas.
- **Conflito com T7, T8, T9, T10, T11:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Afirmação a conferir:** O container do banco local se chama 'supabase_db_snake-thai'.  
  **Por quê:** Só existe o volume supabase_db_snake-thai; nenhum container do projeto está rodando (docker ps -a da T1). O nome segue o padrão da CLI e é provável, mas nenhum plano confirmou. Todos os comandos 'docker exec' dependem disso.
- **Decisão consolidada (T1 + T6):** O que fazer com os dados de demo em produção (senha no repositório público) e com as aulas futuras de demo que a grade da T6 adotaria?  
  **Recomendação:** Agora: trocar a senha das contas de demo e de teste em produção (opção A da T1). Antes de cadastrar o primeiro aluno real ou a grade real: backup e limpeza (opção B), com o usuário informando qual e-mail é a conta real de admin. Na mesma rodada, avaliar a senha fixa 'a senha padrão' das Edge Functions.
- **Decisão consolidada (T6):** Horizonte da grade, exclusão de turma e destino dos alunos.  
  **Recomendação:** Gerar até o fim do mês seguinte. Turma com histórico é arquivada e turma nunca usada é apagada. Destino dos alunos escolhido na hora ('Sem turma' só se marcado de propósito). Chamada de turma arquivada fica congelada. Cancelar ocorrência isolada fica para o P1.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T6.md` escrito
