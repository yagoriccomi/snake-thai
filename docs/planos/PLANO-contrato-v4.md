# Plano — contrato v4 (os quatro itens da D4)

> Modo 🔁 Loop, 2026-09-29. Branch `docs/contrato-v4`. Aprovado pelo dono em 28/09 (D4 de
> `academy/handoffs/COORDENACAO.md`). Só este chat edita o contrato.

## Enunciado canônico

- **Problema:** quatro ajustes aprovados estão fora do contrato. O texto de `plans_cota_coerente`
  deixa passar o plano livre sem cota. A variável de sessão das RPCs de justificativa do 4.8 não
  tem nome. A 2ª dica do aviso de atualização está no mockup aprovado, mas não na § 12.3. E o
  servidor não sabe o que pode chamar para a segunda barreira (P-9, item 5.5 do
  `ROADMAP-server.md`).
- **Resultado esperado:** `docs/CONTRATO.md` na **v4**, com os quatro itens e uma linha no § 17.
  O Registro do `ROADMAP-thai.md` avisa o servidor de que o 5.5 destravou.
- **Como validar:** a v4 está na `origin/main`. Pelo § 13.5, o chat do servidor encontra a
  função, o corpo e o retorno de cada consulta sem precisar perguntar.

## Escopo negativo [#8]

- **Nenhuma migration nem código.** A variável `snake.justificativa_rpc` nasce no 4.8, com as
  RPCs. A dica entra na tela quando a 1.9.0 for preparada (é uma linha no
  `AvisoDeAtualizacao.tsx`, num PR próprio). A segunda barreira é código do servidor (5.5 dele).
- **A mensagem de "navegador não abre" (P5 da entrega da 3A) não entra:** não faz parte dos
  quatro itens da D4.
- Não mexe nos nomes que já existem.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | O nome da variável é **`snake.justificativa_rpc`** | Segue o padrão `snake.aula_rpc` / `snake.chamada_rpc` [#1] | É nome interno do banco: troca-se no 4.8 com uma linha na v5 |
| P2 | A dica usa **"Baixe"** e não o **"Baixa"** do mockup | Os outros verbos da frase estão no mesmo modo ("abra", "toque"). "Baixa" destoa deles e parece erro de digitação | O dono veta, e a dica volta ao texto literal do mockup |
| P3 | A segunda barreira usa **`is_admin()`** (comprovante e justificativa) e **`pode_decidir_justificativa(p_id)`** (justificativa pendente). Nenhuma função nova | São as mesmas funções que a RLS usa. Assim a barreira confere a mesma regra e não cria uma segunda [#6][#55] | Se o servidor precisar de mais, é pedido de v5 |
| P4 | A barreira da justificativa só fica completa depois de o **4.8 estar na `main`**. Até lá, `pode_decidir_justificativa` não existe | Conferido no banco local: `is_admin` já tem `execute` para `authenticated`; `pode_decidir_justificativa` ainda não existe | O servidor faz a parte do comprovante agora e a da justificativa depois do 4.8 |
| P5 | A regra "check que dá nulo" entra na § 0.1 como a **regra 9** | A errata mostrou uma classe de defeito, e não um caso isolado [#11] | — |

## Decisão visual

A dica é texto de tela, mas o mockup aprovado já a mostra (linha H). Não há desenho novo, então
não há mockup nem `design-de-interface-projeto` neste PR. Isso fica para o PR que a põe na tela.

## Passos

| # | Arquivo | O que muda | Prática | Como verificar |
| --- | --- | --- | --- | --- |
| 1 | `docs/CONTRATO.md` (cabeçalho) | Sobe para v4, com o que ela traz | [#96] | O cabeçalho diz v4 |
| 2 | § 0.1 | Regra 4 com `snake.justificativa_rpc`; regra 9 nova, sobre `check` que dá nulo | [#11] | Leitura |
| 3 | § 5.2 | `plans_cota_coerente` com `weekly_quota is not null and …` (igual à migration `20260925200100`) | [#87] | `grep` bate com a migration |
| 4 | § 9.1 | Gatilho (f) a (h): o que as RPCs gravam com a variável ligada | [#4] | Leitura |
| 5 | § 3 e § 12.3 | A dica na lista de textos e no glossário | [#96] | Leitura |
| 6 | § 13 | Estado de hoje e **§ 13.5 Segunda barreira** | [#55] | Leitura |
| 7 | § 17 | Linha da v4 | [#96] | Leitura |
| 8 | `ROADMAP-thai.md` | "Onde estamos" com a v4; Registro com a linha para o servidor | [#96] | `git show origin/main:ROADMAP-thai.md` depois do merge |

## Riscos e rollback [#84]

- **Risco:** o servidor começar a barreira da justificativa antes do 4.8. A § 13.5 diz que ela
  espera o 4.8.
- **Rollback:** reverter o merge. É só documento.

## Definição de pronto

- [ ] v4 na `origin/main`, com o CI verde
- [ ] Linha no Registro: "Contrato v4 na main; o 5.5 do servidor destravou"
