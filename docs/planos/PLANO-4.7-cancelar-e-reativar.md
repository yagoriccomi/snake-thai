# Plano — 4.7 Cancelar e reativar aula

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 6.1, § 10 e § 14, mais D18, D24–D26, D57, T21–T23,
> T31, T39, T42 e T50. Mockups: linha C (Cancelar aula, Aula cancelada). **Três PRs:**
>
> - **4.7a (banco):** `cancelar_aula`, `reativar_aula`, os avisos e a obsolescência;
> - **4.7b (Edge Function `send-push`):** os 10 tipos novos e um `default` que não quebra o lote.
>   **O código fica pronto; a publicação é do dono** e vem **antes** das migrations (§ 14);
> - **4.7c (app):** a folha Cancelar aula, a aula cancelada com Reativar e o toque na notificação.

## Enunciado canônico

- **Problema:** não há como cancelar uma aula com motivo, avisar quem deve ser avisado e abonar
  certo; a `send-push` não conhece os tipos novos que o banco já enfileira (desde o 4.6b), e um
  tipo desconhecido derruba o lote.
- **Resultado esperado:** as duas RPCs com as trocas da T50/D57, os avisos da D25/T42 (o
  primeiro cancelamento fura o silêncio; a reativação respeita), a obsolescência da § 10, a
  `send-push` com os textos da § 10, e as telas.
- **Como validar:** `regressao_cancelar_aula.sql` e `db-dev test`; `deno test` da `send-push`;
  Jest e o roteiro do aparelho.

## Escopo negativo [#8]

- **Anexos do motivo** só depois do G2.
- **Publicar a `send-push`** é do dono (§ 14: antes das migrations).
- **Cancelar vários dias de uma vez** (feriado) não está no contrato.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | "Antes da aula" = `date_time > now()` no momento da ação | D25 separa antes e depois da aula; a hora de início é o corte mais simples e o mesmo da chamada | — |
| P2 | Alunos avisados antes da aula: **fixos** = as origens `turma`, `permanente`, `troca`, `troca_pendente` e `extra` de `origens_da_chamada` (T42, quem trocou a aula fica de fora); **livres e à vontade** = todos os ativos cuja modalidade na semana da aula não é fixa, se a aula aceita livres. **Evento:** todos os alunos ativos | T42 manda usar a mesma resposta da grade; o evento não tem grade nem público de fixos | Quem é avisado no evento |
| P3 | Limite de 2 cancelamentos por aula para não-admin, contados pelos motivos `class_cancel` usados por ele naquela aula | § 6.1 não diz onde contar; o motivo usado é o registro de cada cancelamento | — |
| P4 | Textos que o contrato não escreve: *"A aula já está cancelada."*, *"A aula não está cancelada."*, *"Você já cancelou esta aula duas vezes. Peça ao admin."*, *"Para cancelar, informe o motivo."*, *"Para reativar, informe o motivo."* | Frase para a pessoa | Troca de texto |
| P5 | **Função nova de leitura, fora da lista do contrato:** `quem_sera_avisado(p_class_id, p_acao)` (`'cancelar'` ou `'reativar'`), só para quem pode cancelar, devolvendo se é antes da aula, quantos fixos, quantos livres, os nomes dos outros professores e quantos admins. Usa a mesma função interna dos avisos | O mockup da folha Cancelar mostra essas contagens; sem ela, a tela teria de adivinhar a grade | Vira uma linha no contrato na próxima revisão |
| P6 | A `send-push` só monta textos; o `default` devolve "Snake Thai" / "Abra o app para ver a novidade." no canal `frequencia` e loga o tipo desconhecido | § 10: "um `default` que devolve um texto genérico em vez de quebrar o lote" | Troca de texto |

## Passos (4.7a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929160000_cancelar_aula.sql` | `destinatarios_da_aula` (interna), `quem_sera_avisado`, `cancelar_aula`, `reativar_aula`; `enfileirar_notificacao` fura o silêncio só no `aula_cancelada` dos alunos; `reivindicar_notificacoes` com a obsolescência da § 10 | [#87] [#6] | `db-dev reset` |
| 2 | `supabase/tests/regressao_cancelar_aula.sql` | Quem pode, limite de 2, motivo, dois lados, T50/D57 nas trocas, reativação, destinatários antes e depois, silêncio, obsolescência, T31, anônimo | [#41] | `db-dev test` |

## Riscos e rollback [#84]

- **Aviso em massa errado:** o teste confere os destinatários de cada caso.
- **Troca que some:** a reativação só devolve a aprovada pelo sistema; a cancelada fica.
- **Rollback:** migration local até o `db-push-prod.bat`.

## Definição de pronto

- [ ] 4.7a: `db-dev test` e `reset` verdes, tipos, PR com CI verde, Registro;
- [ ] 4.7b: `deno test` verde, PR com CI verde, Registro avisando que a publicação vem antes das migrations;
- [ ] 4.7c: Jest verde, PR, entrega com o roteiro do aparelho.
