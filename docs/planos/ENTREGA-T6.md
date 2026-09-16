# ENTREGA — T6: grade semanal e renomear/excluir turma

| Campo | Valor |
|---|---|
| **Tarefa** | `T6` |
| **Plano** | [`PLANO-T6.md`](PLANO-T6.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/grade-semanal-turmas` |
| **Status** | 🟡 Pronto e testado no ambiente local; **nada publicado em produção** |

---

## 1. O que foi feito

- **Grade semanal por turma.** O admin cadastra os horários fixos (dia, hora de
  Brasília, vigência e professores). O banco gera as aulas até o fim do mês
  seguinte: todo dia às 00:40 e logo depois de cada salvamento.
- **Editar ou encerrar um horário** só mexe em aula futura **sem chamada**. Aula
  com chamada nunca muda. Aula editada à mão fica desvinculada da grade. Aula da
  grade apagada à mão não volta.
- **Renomear, excluir e reativar turma.** Antes, excluir uma turma transformava
  as aulas dela em eventos visíveis a **todos** os alunos e deixava os alunos sem
  turma. Agora:
  - a turma nunca usada é apagada;
  - a turma com histórico é arquivada, com aulas passadas, chamadas e frequências
    preservadas;
  - o admin escolhe para onde vão os alunos;
  - a chamada das aulas da turma arquivada fica congelada.
- **No banco:** referências a turma viram RESTRICT e aula de rotina passa a exigir
  turma.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916201935_turmas_arquivamento.sql` | `groups.archived_at`; FKs RESTRICT; `classes_rotina_exige_turma` (com parada antecipada se houver legado); gatilho `enforce_turma_ativa`; turma só renomeada pelo app (privilégio por coluna); `aulas_sem_chamada`, `salvar_chamada` e `concluir_chamada` ignoram ou recusam turma arquivada |
| `supabase/migrations/20260916201939_grade_semanal.sql` | `class_schedules`, `class_schedule_teachers`, `class_schedule_skips`; `classes.schedule_id/occurrence_date/schedule_detached` + índice único; `gerar_aulas_da_grade`, `salvar_horario_da_grade`, `encerrar_horario_da_grade`, `previa_exclusao_turma`, `excluir_turma`, `reativar_turma`; job `generate-scheduled-classes`; `anonimizar_titular` tira o professor da grade |
| `supabase/tests/regressao_turmas.sql`, `regressao_grade_semanal.sql` | 13 + 16 casos |
| `supabase/tests/regressao_professores.sql` | Aulas de teste sem turma viram eventos (rotina sem turma deixou de existir) |
| `supabase/seed/demo_seed.sql` | Agenda de demonstração montada pela grade (seg/qua/sex), idempotente |
| `src/services/groups.service.ts`, `schedules.service.ts`, `classes.service.ts` | Visão geral, renomear, prévia, excluir, reativar; grade; `updateClass` desvincula |
| `src/lib/functionsError.ts` (`lerErroDoBanco`), `src/utils/jsonDoBanco.ts`, `src/utils/gradeSemanal.ts` | Recusa escrita pelo banco chega à tela; jsonb conferido campo a campo; validação e textos da grade |
| `src/screens/dados/TurmasScreen.tsx`, `GradeTurmaScreen.tsx`, `HorarioFormScreen.tsx`, `src/components/ExcluirTurmaSheet.tsx`, `WeekdayPicker.tsx`, `ProfessorMultiPicker.tsx`, hooks | Telas e componentes novos |
| `GroupPicker`, `useGroups`, `AdminAulasList`, `ProfessorAulasList`, `DetalheAulaScreen`, `CriarAulaScreen`, `FrequenciaScreen`, `DadosScreen`, navegação | Sem turma arquivada nos seletores; "(arquivada)" nas listas; selo da grade; aviso ao editar aula da grade (e erro real na tela); chamada só leitura em turma arquivada; linha "Turmas e grade semanal" |
| Docs | `MANUAL-DO-ADMINISTRADOR` §5, `FREQUENCIA`, `RUNBOOK` (tabela dos jobs), `FUNCIONALIDADES`, `README`, `PLANO-DE-TAREFAS` |

## 3. Como validar no app DEV

Pré-requisito: `scripts\db-dev reset`, `adb reverse tcp:55321 tcp:55321`, APK DEV
novo (gerado a partir desta branch) e login com a conta de admin local.

1. **Dados → Turmas e grade semanal:** as 3 turmas aparecem com a contagem de
   alunos e 3 horários cada.
2. **Grade semanal** da Turma Noite → **Novo horário**: terça, 20:30, início hoje,
   um professor. Ao salvar aparece "Horário salvo: N aulas entraram na agenda".
   Na aba **Aulas**, a próxima terça tem a aula com a cor do professor.
3. **Editar** esse horário para 21:00 e confirmar: as aulas futuras mudam de hora.
4. Na aba **Aulas**, abrir uma dessas aulas: selo **Grade semanal**. Em **Editar
   aula** aparece o aviso de independência. Mudar a hora e depois editar o
   horário de novo: essa aula não muda.
5. **Encerrar** o horário hoje: as aulas saem da agenda.
6. **Turmas → Nova turma** "Teste" → lixeira: "será apagada de vez" → confirmar.
7. Lixeira na Turma Tarde: a prévia diz "será arquivada" e exige destino. Escolher
   Turma Manhã → **Arquivar turma**. Conferir: a Turma Tarde some do seletor em
   Gerenciar Alunos e em Criar aula; uma aula passada dela abre a chamada só para
   leitura, com o aviso; em **Arquivadas**, **Reativar** a devolve.

## 4. Verificações executadas

- [x] 31 migrations aplicam do zero; suíte SQL completa verde (9 arquivos), incluindo as 7 regressões antigas depois da reescrita de `salvar_chamada`, `concluir_chamada` e `aulas_sem_chamada`
- [x] `regressao_turmas.sql` (13 casos): permissões de aluno e professor; renomear com nome repetido e em branco; DELETE direto barrado; rotina sem turma recusada; prévia; destino obrigatório, mover e "sem turma"; arquivar preserva o passado e tira o futuro; turma arquivada recusa aluno, aula, horário e destino; chamada congelada; aviso de aula sem chamada; apagar a nunca usada; reativar; anexo de justificativa na fila LGPD
- [x] `regressao_grade_semanal.sql` (16 casos): só admin escreve e aluno nem lê; segundas às 19:00 de São Paulo; idempotência; horizonte e instante de referência; vigência; professores copiados e rebaixado ignorado; avulsa adotada; frequência do dia 1 com 4/4 aulas e 100%; editar hora (chamada, remarcada e passada intactas); troca de professores por diferença; encerrar sem gerar exceção; apagada à mão não volta; reabrir a vigência gera de novo; validações; professor excluído (LGPD) sai da grade
- [x] Seed de demonstração rodada duas vezes: 9 horários e 58 aulas nas duas
- [x] API local (PostgREST + Auth, login como admin): visão geral com contagem embutida; prévia; criar horário omitindo `p_id` e `p_valid_until` (6 terças até 27/10); editar hora (6 ajustadas); trocar dia → 400/22023 com a mensagem; encerrar (6 removidas); renomear para nome existente → 409/23505; arquivar por UPDATE direto → 403/42501; excluir turma nunca usada → `apagada`; excluir com alunos sem destino → 400/22023
- [x] Jest: 577 testes (57 novos: serviços, utilitários, `lerErroDoBanco`, folha de exclusão, seletores); typecheck verde
- [ ] Teste no celular com o app DEV — celular não conectado

## 5. ⚠️ Premissas e desvios do plano (revisar)

- Decisões P1–P10 do plano seguidas como recomendado (fim do mês seguinte; só admin;
  adotar avulsa; aula editada fica desvinculada; arquivar com histórico; destino
  escolhido; aulas futuras avulsas também saem; chamada congelada; nome reservado com
  reativação; cancelar data isolada fica para depois).
- **Desvio:** aumentar a vigência **não** apaga as exceções (`class_schedule_skips`).
  Encerrar e editar não criam exceção, então reabrir volta a gerar (G12). Uma exceção
  só existe quando alguém apagou a aula de propósito, e apagá-la recriaria essa aula.
- **Acréscimo:** o banco recusa dois horários iguais (mesma turma, dia e hora com
  vigências sobrepostas), porque eles disputariam as mesmas aulas.
- **Acréscimo:** `salvar_horario_da_grade` recebe `p_id` e `p_valid_until` por último,
  com padrão nulo. Assim o app omite esses campos em vez de mandar nulo num tipo gerado
  como obrigatório.
- A política `groups_delete_admin` foi removida: excluir turma passa só pela função.
- Os professores escalados precisam estar ativos e não excluídos; o seletor avisa e
  tira da seleção quem saiu.

## 6. Pendências e riscos

- 👤⚠️ **Produção**, depois da T7 (as migrations da T6 têm timestamp maior):
  1. rodar a consulta somente leitura `select count(*) from public.classes where type = 'routine' and group_id is null;`
     — se der mais que zero, a migration para de propósito e é preciso decidir o destino dessas aulas;
  2. `scripts\db-push-prod.bat`;
  3. no dia seguinte, conferir o job em `cron.job_run_details` (consulta no RUNBOOK).
- 👤 **APK 1.6.0 em uso:** o seletor antigo ainda mostra turma arquivada (o banco
  recusa com mensagem genérica). Editar uma aula da grade pelo APK antigo não a
  desvincula. Distribuir o APK novo antes de usar a grade.
- 👤 **Aulas futuras de demonstração em produção:** se coincidirem com a grade real,
  serão adotadas como aulas da grade. Decidir a limpeza antes.
- **Chamada de turma arquivada:** abre só para leitura, mas a lista sai vazia porque
  os alunos já mudaram de turma. A chamada gravada continua valendo na frequência.
  Mostrar os alunos que têm registro na aula fica como melhoria.
- **Remover aulas futuras** (encerrar ou arquivar) apaga junto as declarações e
  justificativas pendentes dos alunos, sem avisá-los (sem push até a T9).
- **Falha do job diário** só aparece em `cron.job_run_details` (lacuna L3).
- **Cancelar uma data isolada** (feriado) fica para o item P1; a tabela de exceções
  já existe.

## 7. Próximo passo

Abrir o PR, mesclar e seguir para a **T8** (Painel do admin).
