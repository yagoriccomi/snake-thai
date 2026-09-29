# Plano — 4.6 Motivos e chamada nova

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 7, § 8, § 10 e § 15, mais D17–D21, D27, D28,
> D48, D51, D54, D56, D58, P21, T11, T13, T14, T15, T35, T38, T45, T47 e T53. Mockups: linhas C
> (chamada, retificação, pendentes) e G (chamada com trocas e extras). **Três PRs:**
>
> - **4.6a (banco):** motivos e os crons dos motivos e dos anexos expirados;
> - **4.6b (banco):** a chamada nova (`lista_da_chamada`, `professores_da_chamada`, as buscas,
>   `salvar_chamada_v2`, `chamadas_pendentes`) e a compatibilidade com a T47;
> - **4.6c (app):** a tela da chamada nova, a retificação e as chamadas pendentes.

## Enunciado canônico

- **Problema:**
  - a chamada de hoje só conhece a turma **atual** e grava tudo por `salvar_chamada`, sem
    retificação, motivo, presença de professor, trocas nem extras;
  - o APK 1.8 pode expirar trocas e dar falta a quem mudou de turma.
- **Resultado esperado:**
  - motivos com anexos e os dois crons;
  - a chamada nova com as origens da v3, a retificação auditada e a presença de professor;
  - a compatibilidade da § 15 com a T47;
  - no app: blocos, selos, incluir, acrescentar professor, a folha Retificar e as chamadas
    pendentes.
- **Como validar:**
  - `regressao_motivos.sql` (4.6a) e `regressao_chamada_nova.sql` (4.6b), com `db-dev test`
    verde;
  - Jest verde e o roteiro do aparelho (4.6c).

## Escopo negativo [#8]

- **Anexos no app** só depois do **G2** (rotas do servidor). Antes, a retificação vai só com
  texto (a própria § 8 prevê seguir sem anexo).
- **`abrir_solicitacao`, `decidir_solicitacao` e a caixa de Solicitações** são do 4.9a.
  `criar_motivo('request_evidence')` já nasce aqui, com a conferência mínima (premissa P2).
- **Cancelar e reativar aula** é o 4.7 (`class_cancel` e `class_reactivate` só ganham o
  `criar_motivo` aqui).
- **Troca permanente pedida pelo aluno** (`pedir_troca_de_aula`) é o 4.9b. A chamada só aplica
  as regras 7 e 8 às trocas que já existem.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | Texto do motivo: `btrim` de 1 a 500 caracteres, senão `22023`, *"Escreva o motivo, com até 500 caracteres."* | O contrato fixa o limite (constraint `action_reasons_texto_valido`), não a frase | Troca de texto |
| P2 | `criar_motivo('request_evidence')`: aula existente e quem chama ativo (aluno ativo ou equipe). O resto (tipo, prazo e requisitos) fica com `abrir_solicitacao` (4.9a) | O tipo da solicitação só se sabe ao abri-la. O motivo sem uso é apagado em 24 h | — |
| P3 | `pode_anexar_ao_motivo` e `anexar_ao_motivo` com grant para `authenticated`. O servidor consulta com o token de quem envia | § 8: "true só para o autor" | — |
| P4 | `marcar_retificacao_conferida` só aceita motivo `roll_call_edit` já usado (`22023` nos outros) e recusa o próprio (`42501`) | § 8 e a categoria "retificações feitas e ainda não conferidas" da § 9.3 | — |
| P5 | Crons: `delete-unused-reasons` de hora em hora (minuto 15) e `expire-attachments` diário às 03:50 UTC | § 8 diz "mais de 24 h" e "cron diário"; a hora não importa, só não pode encavalar com os outros crons das 03:xx | Muda o horário |
| P6 | `enfileirar_anexos_expirados` devolve quantos arquivos foram para a fila | Para o teste e o monitoramento | — |

### Premissas do 4.6b

| # | Premissa | Por quê |
| --- | --- | --- |
| P7 | Quem está na chamada sai de **uma** função interna, `origens_da_chamada`, usada pela lista, pela `salvar_chamada_v2`, pela busca de alunos e pela trava do APK 1.8 | Se cada uma decidisse "quem é da aula", a T47 e a lista divergiriam [#6] |
| P8 | As regras da T35 que valem "venha de qualquer RPC" (presença na original cancela a pendente; presença nova na aula de uma expirada a aprova de novo com a conferência; presença retirada de uma aprovada pela chamada a devolve a expirada) ficam num **gatilho** em `attendance` | Cobrem a chamada nova, a antiga e o "Eu estava na aula" (4.9a) sem repetir a regra |
| P9 | A aprovação pela chamada grava `class_swap_reviews` com `on conflict` (a mesma troca pode ser aprovada, expirar e voltar) | A chave da tabela é a troca |
| P10 | Textos que o contrato não escreve: *"Aula cancelada não tem chamada."*, *"Você está sem presença nesta aula. Peça a correção em Solicitações."* (D28), *"Um aluno não pode estar em duas listas."*, *"Só professor com cor entra na chamada."*, *"Só aluno incluído pode sair da chamada."*, *"Digite de 2 a 60 letras para buscar."* | Frase para a pessoa, no padrão das outras |
| P11 | `salvar_chamada` (APK 1.8), na primeira conclusão, continua limpando a chamada de quem ficou fora das duas listas | É o que ela fazia; a declaração do aluno fica |
| P12 | Aluno retirado da chamada (`p_remover_incluidos`) some da aula se não tinha declaração; se tinha, a linha fica só com a declaração | A declaração é do aluno, não de quem faz a chamada |
| P13 | Os testes antigos da chamada em lote passam a cadastrar os alunos antes das aulas (a chamada conta a turma da data da aula, D58) e a esperar a recusa da § 15 na correção pelo APK antigo | Contrato |

As premissas do 4.6c entram aqui quando a fatia começar.

## Passos (4.6a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929140000_motivos.sql` | `criar_motivo`, `pode_anexar_ao_motivo`, `anexar_ao_motivo`, `motivos_da_aula`, `marcar_retificacao_conferida`, `apagar_motivos_nao_usados`, `enfileirar_anexos_expirados` (com a P21 antes) e os dois crons | [#87] [#6] | `db-dev reset` |
| 2 | `supabase/tests/regressao_motivos.sql` | Quem cria cada tipo; texto; anexos (autor, usado, limite de 5, caminho); leitura por papel (RLS pela `pode_ler_motivo`, sem `42501` em nenhum tipo, § 0.1 regra 8); conferência; limpeza de 24 h; expiração dos 180 dias em cada referência, com `'anexo_expirado'` e sem duplicar na fila; P21; anônimo recebe `42501` | [#41] | `db-dev test` |
| 3 | `src/types/database.types.ts` | `db-dev types` | [#11] | `tsc` |

## Passos (4.6b)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929150000_chamada_nova.sql` | `origens_da_chamada`, `lista_da_chamada`, `professores_da_chamada`, as duas buscas, `chamadas_pendentes`, `aulas_sem_chamada` sem cancelada, o gatilho das trocas pela presença, `salvar_chamada_v2` e a compatibilidade de `salvar_chamada` e `concluir_chamada` (T47) | [#87] [#6] | `db-dev reset` |
| 2 | `supabase/tests/regressao_chamada_nova.sql` | C1–C17: origens, leitura por papel, T47, primeira conclusão com trocas, retificação, D28, T35, pendentes, buscas, anônimo | [#41] | `db-dev test` |
| 3 | `supabase/tests/regressao_chamada_em_lote.sql` | P13 | [#42] | `db-dev test` |

## Riscos e rollback [#84]

- **Anexo apagado sem ir para a fila:** mitigado pelos gatilhos existentes e por um teste que
  conta a fila depois do cron.
- **Motivo referenciado apagado:** a limpeza só apaga motivo com `used_at` nulo **e** sem
  referência (`roll_call_requests`, `class_swaps`, `attendance_audit`, `class_audit`,
  `class_teacher_presence`); a FK `restrict` segura o resto.
- **Rollback:** a migration é local até o `db-push-prod.bat`. Voltar = reverter o PR e
  `db-dev reset`.

## Definição de pronto

- [ ] 4.6a: `db-dev test` e `reset` verdes, tipos gerados, PR mesclado com CI verde, Registro;
- [ ] 4.6b: idem;
- [ ] 4.6c: Jest verde, PR mesclado, roteiro do aparelho em `ENTREGA-4.6`.
