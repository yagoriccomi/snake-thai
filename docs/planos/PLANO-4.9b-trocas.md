# Plano — 4.9b Troca de aula (abre o G3)

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 9.4, § 9.5, § 10, § 3 e § 14 (G3), mais D44–D50,
> T33–T42, T49 e T50. Mockups: linha G. **Dois PRs:** 4.9b-banco e 4.9b-app.

## Enunciado canônico

- **Problema:** as tabelas da troca, a grade efetiva, a chamada que resolve a avulsa e os
  encerramentos automáticos existem desde o 4.1 e os blocos 4.3 a 4.7, mas o aluno não tem como
  pedir, a equipe não tem como decidir e ninguém tem como desistir.
- **Resultado esperado:** as RPCs da § 9.4 no banco; no app, **Trocar para esta** no menu, a folha
  **Trocar aula**, **Desistir da troca**, os pedidos do aluno com os rótulos da § 3 e **Revisar
  troca** pela caixa de Solicitações; e o **G3** anotado no Registro.
- **Como validar:** `regressao_trocas.sql` (T1–T8) e `db-dev test`; a consulta do G3 (§ 14) = 23;
  Jest; roteiro do aparelho.

## Escopo negativo [#8]

- **Anexos da permanente:** pelo fluxo da § 8, só depois do **G2**; a justificativa escrita já é
  obrigatória e suficiente.
- **Encerramentos automáticos (T39, T50, T53, P21):** já existem; aqui só os testes do pedido e da
  decisão.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | **`historico_de_aulas_do_aluno` é adiantado do 4.10** para este PR | O G3 (§ 14) conta as 23 RPCs do aluno, e ela é uma delas; sem ela o G3 não abre no fim do 4.9b, como o dono pediu |
| P2 | "Outra aula da grade dele no mesmo horário" não conta aula **cancelada** | Aula cancelada não acontece; recusar por ela prenderia o aluno a uma aula que não existe |
| P3 | Na aprovação da permanente, a conferência "ainda é fixo" usa a semana de agora e o plano aberto | § 9.4, passo 1: "o aluno ainda é fixo e o plano aberto é 'fixed' ou nulo" |
| P4 | O histórico traz as aulas de `aulas_do_aluno` no período (uma regra só do que é do aluno) e, sem `p_de`/`p_ate`, vai do começo até hoje | § 12: "o histórico de aulas"; a mesma visibilidade da lista |
| P5 | As originais possíveis da folha Trocar aula saem das linhas da **mesma semana** do menu (`can_swap_from` / `can_swap_from_permanent`) | A avulsa exige a mesma semana; a permanente só precisa de uma aula dele que não começou, e a semana da aula nova sempre tem uma |
| P6 | **Desistir da troca** pede confirmação numa folha | Não tem volta (T36) |
| P7 | **Minhas trocas** fica em Frequência (só do fixo); **Revisar troca** é uma tela aberta pela caixa | § 3: "tela Revisar troca"; o acompanhamento segue o das justificativas |
| P8 | Os anexos da permanente aparecem só como contagem até o G2 | O `/v1/motivos/view-url` é do servidor novo |

## Passos (4.9b-banco)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929190000_trocas.sql` | `pedir_troca_de_aula`, `decidir_troca_de_aula`, `desistir_da_troca`, as 4 listas, o aviso `troca_pendente` e a categoria Trocas de aula da caixa | [#87] [#89] [#52] | `db-dev reset` |
| 2 | `supabase/migrations/20260929191000_historico_do_aluno.sql` | `historico_de_aulas_do_aluno` (P1) | [#87] | `db-dev reset` |
| 3 | `supabase/tests/regressao_trocas.sql` | T1–T8 | [#41] | `db-dev test` |

## Passos (4.9b-app)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 4 | `src/services/trocas.service.ts` | As chamadas e a tradução das recusas | [#22] | Jest |
| 5 | Menu de aulas | **Trocar para esta** → folha **Trocar aula** (tipo, justificativa da permanente, avisos) | [#13] [#93] | Jest |
| 6 | Lista de aulas e **Minhas trocas** | Selos e rótulos da troca, **Desistir da troca** | [#6] | Jest |
| 7 | **Revisar troca** pela caixa | Aprovar / Negar com a nota da T41 | [#93] | Jest |

## Riscos e rollback

- A aprovação da permanente escreve em `class_swap_periods`, que nunca é apagado. O `for update`
  nos períodos do aluno serializa duas aprovações. Rollback: as migrations só criam funções (e
  substituem `itens_da_solicitacao` pela mesma assinatura).

## Definição de pronto

- [x] 4.9b-banco: `db-dev test` e `reset` verdes, tipos, consulta do G3 = 23, PR com CI verde,
  Registro;
- [x] 4.9b-app: Jest verde, PR, entrega com o roteiro do aparelho, **G3 anotado no Registro**.
