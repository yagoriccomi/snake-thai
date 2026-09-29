# Plano — 4.10 Perfis e Pessoas

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 12, § 3, D29–D32, D58, T32. Mockups: linha E
> (**opção A** de "Gerenciar pessoas", aprovada em 22/09) e linha H (mudar o aluno de turma).
> **Dois PRs:** 4.10a (banco) e 4.10b (app).

## Enunciado canônico

- **Problema:** a lista de alunos mistura cargo e situação, esconde os professores, tem quatro
  ícones sem rótulo por linha (um deles promove a admin) e não há ficha de aluno nem de professor.
- **Resultado esperado:** `perfil_do_aluno`, `perfil_do_professor` e
  `historico_de_aulas_do_professor` no banco; no app, a tela **Pessoas** (abas Alunos/Equipe,
  ações em folha, promoção só na Equipe), as fichas e o aviso ao mudar a turma (§ 3).
- **Como validar:** `regressao_perfis.sql` (P1–P5) e `db-dev test`; Jest; roteiro do aparelho.

## Escopo negativo [#8]

- `historico_de_aulas_do_aluno` já veio no 4.9b (G3).
- Busca por e-mail/CPF no servidor, paginação e importação em massa: sem gargalo medido [#99].

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | `situacao` do perfil: `trancado` (conta inativa), `primeiro_acesso` (ainda não entrou) ou `ativo` | Os três filtros da opção A (Ativos, Pendentes, Trancados) |
| P2 | `financeiro`: `pagas` = pagas; `pagas_com_atraso` = pagas depois do vencimento (data de SP); `inadimplentes` = vencidas; `em_aberto` = abertas ou em análise; `meses_na_academia` conta o mês de entrada | Os quatro marcadores do antigo Histórico do Financeiro, mais o tempo de casa |
| P3 | Professor: "escalado" = na aula sem ter sido acrescentado na chamada; `faltas` só com `present = false` (sem marcação não é falta, § 15); `pendentes` = rotina passada, não cancelada, sem chamada | As definições da § 12, lidas por aula |
| P4 | `frequencia_semana` e `frequencia_mes` do perfil trazem `percentual`, `feitas` e `esperadas` | A § 12 nomeia as chaves sem o formato; é o mesmo par da tela Frequência |

## Passos (4.10a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929200000_perfis.sql` | As três RPCs | [#87] [#55] | `db-dev reset` |
| 2 | `supabase/tests/regressao_perfis.sql` | P1–P5 | [#41] | `db-dev test` |

## Definição de pronto

- [x] 4.10a: `db-dev test` e `reset` verdes, tipos, PR com CI verde, Registro;
- [ ] 4.10b: Jest verde, PR, entrega com o roteiro do aparelho; acessibilidade depois.
