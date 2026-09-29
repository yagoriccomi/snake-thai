# Plano — Limpar de produção o histórico de demonstração (item 3.5)

> Modo 🔁 Loop, 2026-09-25. Branch `chore/limpar-historico-demonstracao`. Item 3.5 do
> [`ROADMAP-thai.md`](../../ROADMAP-thai.md). **Rodar em produção é ⚠️ e é do dono.**

## Enunciado canônico

- **Problema:** em 23/09, o `supabase/seed/historico_demonstracao.sql` gravou em produção um ano
  inventado: aulas "<turma> — treino", presenças, faltas, mensalidades e justificativas. O
  `demo_seed_limpar.sql` só apaga as contas `@demo.snakethai.com` e deixa tudo isso.
- **Resultado esperado:** um script que apaga **só o que o pacote criou**, que sem confirmação
  explícita apenas mostra o relatório, e que lista o que o pacote mudou e **não tem desfazer**.
- **Como validar:** no banco local (que tem o mesmo pacote), o relatório mostra as contagens e
  nada é apagado; com a confirmação, numa transação desfeita no fim, o pacote some e o resto fica.

## Como o pacote é reconhecido

Cada **execução** do pacote é uma transação, e tudo o que ela inseriu tem **o mesmo
`created_at`**. O pacote é idempotente e pode ter rodado mais de uma vez: no banco local rodou
**três** (21:44:32, 21:46:09 e 21:46:46 de 23/09), cada uma acrescentando o que faltava. As
**marcas** são os instantes em que ele gravou algo com a forma dele: aula `% — treino` fora da
grade com chamada 1 h depois, ou justificativa com um dos 4 textos dele revisada 1 dia depois da
aula. O script apaga só as linhas nascidas numa marca. O `demo_seed` (20:22) não tem essa forma e
fica para o `demo_seed_limpar.sql`.

> **Premissa corrigida na execução:** a primeira versão supunha **uma** marca só. No banco local,
> ela achava 624 aulas e **0 presenças**, porque as presenças nasceram na segunda execução. O
> script teria deixado 6.587 linhas para trás sem avisar. O relatório com números incoerentes foi
> o que denunciou.

## O que o pacote fez e NÃO tem desfazer (vai no relatório)

1. **Reescreveu `created_at` e `group_since`** de todos os alunos e professores (sem guardar os
   originais). Na v3, o histórico de turma (T52) nasce dessas datas.
2. **Trocou presença por falta** em até 7 alunos ativos, nos 3 meses antes de 23/09, **inclusive
   em chamadas que já existiam**.
3. **Os meses fechados** (`attendance_monthly`) de setembro de 2025 a agosto de 2026 foram
   calculados em cima do pacote.

Só o backup de antes de 23/09 desfaz os três. Por isso a pergunta abaixo.

## Pergunta ao dono (não bloqueia o script; decide como usar)

**Como deixar produção pronta para o primeiro aluno real?**

- **A (recomendado):** *zerar o operacional e manter a configuração*: apagar todas as aulas,
  chamadas, justificativas, mensalidades, avisos e meses fechados; manter planos, turmas, grade,
  textos legais, Configurações e as contas que você indicar (a sua de admin, pelo menos). Tudo
  em produção hoje é fictício, e o pacote mexeu em dados que não têm volta (acima): começar do
  zero é mais limpo do que remendar.
- **B:** rodar este script (apaga só o pacote) e conviver com as três marcas acima.

Para o A, preciso do **e-mail da conta real de admin** e da lista de contas a manter. O script
de A é outro (mais simples) e só é escrito depois da sua resposta.

## Escopo negativo [#8]

- **Não roda em produção** (⚠️, 👤).
- Não apaga contas (isso é o `demo_seed_limpar.sql` ou a opção A).
- Não reescreve datas de cadastro (não há de onde tirar as originais).

## Premissas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | **Relatório por padrão.** Sem trocar `limpeza.confirmo` para `sim`, o script conta, mostra e desfaz tudo (termina em erro de propósito). | Mesmo padrão da trava do `historico_demonstracao.sql`, que o dono já conhece. [#89] |
| P2 | **Meses fechados** do período do pacote (12 meses antes da marca) também saem. | Foram calculados em cima de presenças inventadas; ficariam mentindo no Painel. |
| P3 | Se as travas da v3 já estiverem em produção, o script desliga `enforce_class_state_rules` **só dentro da própria transação** para apagar aula com chamada. | A trava recusa apagar aula com chamada até para o sistema (§ 6), e aqui a aula é inventada. |

## Passos

1. `supabase/seed/historico_demonstracao_limpar.sql`: trava de confirmação, marca, relatório,
   exclusão, verificação e o aviso do que não tem volta. [#89][#52]
2. Teste no banco local: relatório sem apagar; com `sim`, numa transação desfeita, o pacote some e
   o que não é do pacote fica.
3. `docs/RUNBOOK.md`: como rodar em produção (backup antes, SQL Editor, conferência depois). [#96]

## Riscos e rollback

- **Risco:** apagar linha real com o mesmo `created_at`. Só se alguém tivesse gravado dado real
  dentro da mesma transação do pacote, o que não é possível. **Mitigação:** o relatório mostra as
  contagens antes, e o dono confere com o que o pacote imprimiu em 23/09.
- **Rollback** [#84]: o backup tirado antes (passo 1 do runbook).

## Verificação (banco local)

| | aulas | presenças | mensalidades | justificativas |
| --- | --- | --- | --- | --- |
| antes | 822 | 9070 | 441 | 332 |
| relatório (sem confirmar) | 822 | 9070 | 441 | 332 |
| com `sim`, dentro da transação | 198 | 2483 | 300 | 143 |

Sobrou exatamente o `demo_seed` (20:22). A trava da v3 (`enforce_class_state_rules`) voltou ligada.
