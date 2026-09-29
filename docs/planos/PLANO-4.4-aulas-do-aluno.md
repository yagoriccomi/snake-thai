# Plano — 4.4 Aulas do aluno, menu de aulas, extra e meta

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 5.3, § 9.2, § 9.5, § 12 e § 12.2, mais D4, D13,
> D36–D38, D47, D51, D56, T2, T3, T5, T11, T19, T26, T27, T33, T34, T36, T38, T40 e T43.
> Mockups: linhas B (aulas do livre, do à vontade e do fixo, e o aviso de cota) e G (escolher
> aulas). **Três PRs:** 4.4a (banco), 4.4b (a lista de aulas do aluno) e 4.4c (o menu **Aulas
> da semana**).

## Enunciado canônico

- **Problema:**
  - o app e a web leem as aulas direto de `classes` e gravam a declaração com upsert direto, sem
    nenhuma trava (aula cancelada, que já começou, de outro público, fora da grade);
  - não existem o menu de aulas, a extra do fixo nem a meta do à vontade.
- **Resultado esperado:**
  - `aulas_do_aluno`, `menu_de_aulas`, `declarar_aula`, `definir_meta_semanal` e
    `meta_da_semana` no banco;
  - as travas da declaração valem em qualquer caminho;
  - a tela Aulas das três modalidades e o menu **Aulas da semana** sobre essas colunas.
- **Como validar:**
  - `regressao_aulas_do_aluno.sql` (S0, D1–D8, A1–A6, M1, M2, X1) e `db-dev test` verdes;
  - Jest verde;
  - o roteiro do aparelho.

## Escopo negativo [#8]

- **Os botões de troca** (Trocar para esta, Desistir da troca e a folha Trocar aula) ficam no
  4.9b. As colunas `can_swap_*` e `swap_*` já vêm do banco.
- **Justificar pela tela nova, com prazo e reenvio,** é o 4.8. A coluna `can_justify` já vem.
- **"Eu estava na aula"** é o 4.9a. A coluna `can_contest` já vem.
- **A frequência nova** (Semana e Mês no cartão) é o 4.5.
- **Paginação:** `aulas_do_aluno` recebe o período, e o app pede semanas. Sem teto no banco por
  ora, porque o contrato não fixa um.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | As travas da declaração ficam numa função interna (`normalizar_declaracao`) que o gatilho de `attendance` chama quando **o próprio aluno** muda a declaração | O contrato manda o upsert direto passar pelas mesmas travas (§ 9.2). Uma regra, um lugar [#6] | — |
| P2 | Mensagens que o contrato não escreve: *"Esta aula é só para alunos de horário fixo."* (livre em aula de fixos), *"Você já marcou outra aula neste horário."* (T26), *"Só aluno ativo declara presença."*, *"A meta vai de 1 a 6 aulas por semana."*, *"A meta semanal é só do plano à vontade."*, *"Escolha esta semana ou a próxima."* (esta sim, do contrato) | Frase para a pessoa, no padrão das outras | Troca de texto |
| P3 | "Não vou" no **evento** limpa, para qualquer aluno | O evento não conta na frequência (§ 11.1), então falta nele não diria nada | — |
| P4 | `marked_in_week` e `marcadas_na_semana` contam os "Vou" em aula de rotina não cancelada da semana. No fixo, só as extras | § 9.2: o fixo recebe "extras marcadas" | — |
| P5 | `can_swap_*` usa as condições da § 9.4 que **não dependem do par** de aulas. A semana e o horário do par ficam para o `pedir_troca_de_aula` (4.9b), que reusa as mesmas funções | Uma linha do menu não sabe qual será o outro lado | — |
| P6 | `menu_de_aulas` só aceita `p_referencia` quando a sessão **não** vem da API (`role` fora de `authenticated`/`anon`) | § 12.2: "só o sistema passa outro valor". Os testes rodam como sistema com o `sub` do aluno | — |
| P7 | **Correção do 4.1** na mesma migration: `enforce_class_state_rules` e `enforce_attendance_rules` passam a usar `coalesce` na variável de sessão | Achado deste bloco: numa sessão nova da API, `current_setting` dá nulo e `not (…)` liberava (§ 0.1, regra 4) | — |

## Decisão visual (4.4b e 4.4c)

- **Mockups aprovados:** linha B (aulas das três modalidades e aviso de cota) e linha G (Aulas
  da semana). Nenhum mockup novo.
- **`design-de-interface-projeto`:** acionada em cada PR de tela.

## Passos — 4.4a (banco)

| # | O que muda | Verificação |
| --- | --- | --- |
| a1 | Correção das duas travas (`coalesce` na variável de sessão) | S0 |
| a2 | `limite_de_7_dias`, `fonte_da_aula_na_grade`, `outra_aula_da_grade_no_horario`, `marcadas_na_semana` (internas) | A2, D1 |
| a3 | `meta_vigente` (interna), `meta_da_semana` e `definir_meta_semanal` | M1, M2 |
| a4 | `normalizar_declaracao` + gatilho de `attendance` + `declarar_aula` | D1–D8 |
| a5 | `pode_ser_original_avulsa`, `pode_ser_original_permanente` e `pode_ser_destino_de_troca` (internas, para o 4.9b) | A2, A3 |
| a6 | `aulas_do_aluno_base` + `aulas_do_aluno` + `menu_de_aulas` (a lista de colunas gerada uma vez) | A1–A6 |
| a7 | Testes antigos que declaravam aula que já passou (F2.7, F7.10, fundação T1/T7/T9) ou marcavam a chamada com a sessão de admin (grade G10): ajustados ao contrato | `db-dev test` |
| a8 | `src/types/database.types.ts` | `tsc` |

## Passos — 4.4b (lista de aulas)

| # | Arquivo | O que muda |
| --- | --- | --- |
| b1 | `src/services/aulas.service.ts` (novo) | `fetchAulasDoAluno`, `declararAula`, `definirMetaSemanal`, `fetchMenuDeAulas` |
| b2 | `useStudentClasses` → `useAulasDoAluno` | Lê `aulas_do_aluno` da semana; "Vou"/"Não vou"/"Desmarcar" por `declarar_aula` |
| b3 | `StudentAulasList.tsx` | Três modalidades pelas colunas: barra da semana (cota ou meta), **Marcada · Desmarcar**, aviso de acima da cota com **Desfazer**, aula cancelada riscada, selos **Sua aula / Extra / Troca / Troca permanente / Troca pendente** |
| b4 | Folha da meta (à vontade) | "Vale a partir de {seg dd/mm}. A meta desta semana continua {n}x." |

## Passos — 4.4c (menu)

| # | Arquivo | O que muda |
| --- | --- | --- |
| c1 | Botão **Escolher aulas** na tela Aulas → tela **Aulas da semana** | Abas **Esta semana** / **Próxima semana**, um bloco por dia de aula, as ações da tabela da § 12.2 (sem as de troca, que são do 4.9b) |

## Riscos e rollback [#84]

- **APK 1.8 e web atual:** a declaração deles passa a ser recusada nos casos do contrato (aula
  que já começou, cancelada, de outro público para o livre). Como os dois só listam as próximas
  aulas, isso aparece só nos casos de verdade recusados. O "Não vou" de fixo em outra turma vira
  nulo (§ 15).
- **A correção da trava da aula** fecha um caminho que o 4.1 deixava aberto: o `update` direto
  de `cancelled_at` e `attendance_taken_at` numa sessão nova. Nenhum cliente usava esse caminho
  (conferido no app e na web).
- **Rollback:** migration nova com as definições anteriores. As funções novas são só leitura, e
  a de meta só escreve em `weekly_goals`.

## Definição de pronto

- [ ] 4.4a mesclado com o CI verde
- [ ] 4.4b e 4.4c mesclados
- [ ] Roteiro do aparelho; roadmap e Registro
