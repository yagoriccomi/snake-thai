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
| P5 | Tocar na pessoa abre a **folha**, e **Ver ficha** é a primeira ação | A opção A abre a folha; o roadmap pede a ficha pelo toque: a folha dá os dois |
| P6 | A busca é por nome ou CPF (o e-mail está só no Auth) | O mockup diz "Nome, e-mail ou CPF"; o e-mail não vem na lista sem uma função nova |
| P7 | **Excluir conta** leva à edição do aluno com a confirmação já aberta | A exclusão (LGPD) já vive lá, com as mensalidades em aberto |
| P8 | A ficha do aluno fica nas abas Dados (Pessoas) e Aulas; o toque no nome, na chamada, passa a abrir a ficha (que leva à frequência completa) | D32: o professor vê o perfil detalhado, sem financeiro |
| P9 | "Sem turma desde {dd/mm}" usa o último dia do período fechado | O perfil devolve o dia do fim (`ate`); a mudança costuma ser no mesmo dia |

## Passos (4.10a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929200000_perfis.sql` | As três RPCs | [#87] [#55] | `db-dev reset` |
| 2 | `supabase/tests/regressao_perfis.sql` | P1–P5 | [#41] | `db-dev test` |

## Definição de pronto

- [x] 4.10a: `db-dev test` e `reset` verdes, tipos, PR com CI verde, Registro;
- [x] 4.10b: Jest verde, PR, entrega com o roteiro do aparelho; acessibilidade depois.
