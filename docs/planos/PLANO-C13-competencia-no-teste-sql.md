# Plano — C13: teste SQL do perfil que depende do dia do mês

> Modo 🔁 Loop, 2026-10-02. Branch `fix/teste-sql-competencia`. Origem: C13 de
> `handoffs/COORDENACAO.md` (02/10) e `handoffs/snake-thai/2026-10-02.md`.

## Enunciado canônico

- **Problema:** o bloco "Financeiro de F" de `supabase/tests/regressao_perfis.sql` deriva a
  competência de `current_date - 60`, `- 30`, `- 5` e `+ 25`. Nos dias 1 a 5, `- 30` e `- 5` caem no
  mesmo mês e a `payments_unico_por_competencia` derruba o job "Regressão de segurança no banco". A
  `main` está vermelha desde 02/10, e isso trava o D2 de qualquer PR.
- **Resultado esperado:** cada mensalidade do teste fica numa competência garantidamente distinta,
  em qualquer dia do ano, e o P3 continua provando o mesmo financeiro (2 pagas, 1 com atraso, 1
  inadimplente, 1 em aberto).
- **Como validar:** o arquivo antigo falha hoje (dia 2) no banco local e o novo passa; o novo
  também passa com a data trocada para dias 1, 5, 15, 31, para virada de ano e para fevereiro;
  `scripts\db-dev test` verde; CI verde no PR.

## Escopo negativo [#8]

- Não muda migration, constraint nem `perfil_do_aluno`: o defeito é só do dado do teste.
- Não mexe nos outros testes SQL: conferidos, os que gravam `payments` usam competências fixas
  (2030, 2031) ou uma só linha (`regressao_c3_payment_whitelist.sql`), e não colidem.

## Premissas assumidas

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | Competências a partir do mês corrente: paga em dia em M-3, paga com atraso em M-2, vencida em M-1, aberta em M+1; vencimento no dia 10 de cada uma | Quatro meses distintos por construção. Vencida e pagas ficam sempre no passado e a aberta sempre no futuro, como o dado antigo pretendia [#7][#48] |
| P2 | Paga em dia: `paid_at` no dia 9; com atraso: no dia 20 do mesmo mês | Mantém `paid_at` antes e depois do vencimento, que é o que o `pagas_com_atraso` mede |

## Decisão visual

Sem superfície visual.

## Passos

| # | Arquivo | O que muda | Prática | Como verificar |
| --- | --- | --- | --- | --- |
| 1 | `supabase/tests/regressao_perfis.sql` | O bloco do financeiro monta as datas a partir de `date_trunc('month', current_date)` menos N meses | [#41][#48] | Antigo falha e novo passa hoje no banco local |
| 2 | — (prova) | Rodar o novo com `current_date` trocado por datas fixas (01/10, 05/10, 15/10, 31/10, 01/01, 05/03) | [#47] | Todas passam |
| 3 | — (prova) | `scripts/db-dev.sh test`, com a hora no Registro (C3/C6) | [#49] | "Todos os testes SQL passaram." |
| 4 | `ROADMAP-thai.md` | Linha da C13 no Registro | [#96] | Linha na `main` |

## Riscos e rollback [#84]

Só muda dado de teste. O rollback é reverter o commit.

## Definição de pronto

- [ ] Provas dos passos 1–3 verdes.
- [ ] PR com o CI todo verde e mesclado (D2).
- [ ] Registro anotado.
