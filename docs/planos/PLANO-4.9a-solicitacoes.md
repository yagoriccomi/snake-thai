# Plano — 4.9a Solicitações

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 9.3, § 10, § 3 e § 5.4, mais D28–D30, D40, T19,
> T20 e T38. Mockups: linha D. **Dois PRs:** 4.9a-banco e 4.9a-app.

## Enunciado canônico

- **Problema:** "Eu estava na aula" (aluno), os pedidos de professor ao admin e a caixa de
  Solicitações não existem; a tabela `roll_call_requests` está no banco desde o 4.1, sem nenhum
  caminho de uso.
- **Resultado esperado:** as RPCs da § 9.3 com os efeitos da aprovação e o aviso
  `solicitacao_pendente`; no app, a caixa com as 5 categorias, os pedidos do aluno e do professor,
  a folha de decisão, o **Conferido** das retificações e o bloco de contato nos negados.
- **Como validar:** `regressao_solicitacoes.sql` (S1–S10) e `db-dev test`; Jest; roteiro do
  aparelho.

## Escopo negativo [#8]

- **Trocas de aula:** a categoria existe e fica vazia até o 4.9b.
- **Anexos** das solicitações: pelo fluxo da § 8, só depois do **G2**.
- **Abono do professor no esperado (T20):** a conta da frequência do professor não existe ainda;
  a aprovação de `teacher_absence` só grava o estado, que essa conta vai ler.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | A **nota é obrigatória** para aprovar e para negar (1..500) | Na aprovação do "Eu estava na aula" ela vira o texto do motivo `roll_call_edit` (§ 9.3), que não aceita texto vazio; e D15 já pede nota na justificativa |
| P2 | **Ninguém decide o próprio pedido**, nem o admin (o de professor fica para outro admin) | Abonar a própria falta é conflito de interesse; o admin corrige a si mesmo pela chamada |
| P3 | `solicitacao_para_decidir(id)` devolve o tipo e o texto para a folha de decisão, só para quem pode decidir, enquanto pendente | `itens_da_solicitacao` não traz nem o tipo nem o texto; entra no contrato na próxima revisão, como `quem_sera_avisado` |
| P4 | Frases que o contrato não escreve: *"Para pedir, escreva o motivo."*, *"Aula cancelada não aceita pedido."*, *"O prazo para este pedido terminou."*, *"Você já fez este pedido para esta aula."*, *"A chamada desta aula ainda não foi feita."*, *"Você já está com presença nesta aula."*, *"Esta aula não aceita o pedido."*, *"Você não está marcado como ausente nesta aula."*, *"Você não está escalado nesta aula."*, *"Você está nesta aula: corrija pela chamada."*, *"Você já está nesta aula."*, *"A aula ainda não começou."*, *"Esta solicitação já foi decidida."* | Frase para a pessoa |
| P5 | O aviso `solicitacao_pendente` do aluno vai à equipe da aula; os de professor (ou aula sem equipe) vão aos admins, menos quem pediu | § 10: "quem pode decidir" |
| P6 | A aprovação do "Eu estava na aula" avisa o aluno por `chamada_retificada` (D21), como toda retificação | Não há tipo de aviso próprio para a decisão da solicitação na § 10 |

## Passos (4.9a-banco)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929180000_solicitacoes.sql` | `pode_decidir_solicitacao`, `abrir_solicitacao`, `decidir_solicitacao`, `minhas_solicitacoes`, `solicitacao_para_decidir`, `itens_da_solicitacao`, `caixa_de_solicitacoes`, `solicitacoes_decididas` e o aviso | [#87] [#89] [#52] | `db-dev reset` |
| 2 | `supabase/tests/regressao_solicitacoes.sql` | S1–S10 | [#41] | `db-dev test` |

## Passos (4.9a-app)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 3 | `src/services/solicitacoes.service.ts` | As chamadas e a tradução das recusas | [#22] | Jest |
| 4 | Telas **Solicitações** e itens da categoria; folha de decisão; **Conferido** | A caixa da equipe | [#13] [#93] | Jest |
| 5 | Folhas de pedido: **Eu estava na aula** (aluno) e **Pedir ao admin** (professor) | Os pedidos | [#6] | Jest |
| 6 | **Minhas solicitações**, com o bloco de contato nos negados | O acompanhamento | [#93] | Jest |

## Riscos e rollback

- A aprovação escreve em `attendance`: o gatilho `aplicar_trocas_pela_presenca` resolve a troca
  expirada (T35) pelo mesmo caminho da chamada. Rollback: a migration só cria funções e um índice.

## Definição de pronto

- [x] 4.9a-banco: `db-dev test` e `reset` verdes, tipos, PR com CI verde, Registro;
- [ ] 4.9a-app: Jest verde, PR, entrega com o roteiro do aparelho.
