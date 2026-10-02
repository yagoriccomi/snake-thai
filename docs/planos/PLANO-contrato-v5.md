# Plano — contrato v5 (D12)

> Modo 🔁 Loop, 2026-10-02. Branch `docs/contrato-v5`. Origem: D12 de `handoffs/COORDENACAO.md` (01/10).

## Enunciado canônico

- **Problema:** a auditoria da Fase 4 (`REVIEW-FASE4.md`, #79) mudou duas regras no banco (A1 e B2) e
  deixou duas funções em uso fora da lista do contrato. O contrato v4 descreve a regra antiga.
- **Resultado esperado:** `docs/CONTRATO.md` v5 descreve o que o banco já faz, sem mudar nenhum nome.
- **Como validar:** cada trecho novo bate com `20260929220000_auditoria_fase4.sql`,
  `20260929160000_cancelar_aula.sql` e `20260929180000_solicitacoes.sql`; CI verde no PR.

## Escopo negativo [#8]

- Nenhuma migration, nenhuma tela: o banco já está assim desde o #79.
- `pode_decidir_solicitacao` também está fora da lista, mas não é um dos quatro itens da D12; fica para
  a próxima revisão.

## Passos

| # | Onde | O que muda | Prática |
| --- | --- | --- | --- |
| 1 | Cabeçalho | v5 e o parágrafo "Novo na v5" | [#96] |
| 2 | § 9.1 e § 13.5 | A1: quem já estava na aula quando a justificativa chegou, ou escalado no horário | [#55][#63] |
| 3 | § 9.4 e § 6 | B2: FKs `restrict`; `encerrar_horario_da_grade` recusa com a data mínima; `excluir_turma` só encerra | [#87] |
| 4 | § 6.1 | `quem_sera_avisado(p_class_id)` | [#29] |
| 5 | § 9.3 | `solicitacao_para_decidir(p_id)` | [#29] |
| 6 | § 17 e `ROADMAP-thai.md` | Histórico (nenhum nome mudou; servidor e web sem mudança) e Registro | [#96] |

## Riscos e rollback [#84]

Só documento. O rollback é reverter o commit.
