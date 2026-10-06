# Plano — D22 Testes presos ao calendário

> Modo 🔁 Loop, 2026-10-06. Decisão **D22** e regra **C17** da coordenação
> (`handoffs/COORDENACAO.md`, entrada 2026-10-06). PR próprio a partir da main, antes do #88.
> Sem superfície visual: só testes mudam.

## Enunciado canônico

- **Problema:** o FF8 de `regressao_frequencia_nova.sql` tem a aula `t25-qui` em 01/10/2026 e,
  desde outubro, falha sempre, inclusive na main. Outros testes têm datas fixas, ou relativas a
  hoje, que vencem ou colidem com a virada do mês ou da semana.
- **Resultado esperado:** o FF8 prova o mesmo ("só mês fechado entra na fila") com datas relativas
  a hoje. Os demais achados da varredura são corrigidos. Nenhuma migration e nenhuma regra de
  negócio mudam.
- **Como validar:**
  - cada correção, quando dá, é provada como na C8: falha com a data simulada e passa depois;
  - `scripts\db-dev test` verde;
  - Jest verde;
  - CI verde e merge (D2).

## Escopo negativo [#8]

- Não muda migration, função, gatilho nem regra de negócio. Só os arquivos de teste.
- Não reescreve testes que já usam `p_referencia`/`p_agora` fixos e não dependem do relógio real.
- Não cria infraestrutura de relógio falso no banco (o Postgres não tem): onde o `now()` é de
  propósito, o teste ancora as datas nele.

## Achados da varredura e correções

| # | Arquivo | Defeito | Quando quebra | Correção | Prática |
| --- | --- | --- | --- | --- | --- |
| 1 | `regressao_frequencia_nova.sql` (FF8) | aula fixa em 01/10/2026 | sempre, desde 01/10/2026 | aula na segunda da semana corrente, com premissa conferida no próprio teste: os meses da semana de cada dia ainda estão abertos nesse dia | [#41][#48] |
| 2 | `AulasDoAluno.test.tsx` | `amanha()` com o relógio real; a cota some aos domingos e, no menu, a SectionList do teste deixa as aulas de amanhã de fora de quinta a domingo | quinta a domingo | relógio fixo (só o `Date`) no nível do arquivo, numa terça | [#48] |
| 3 | `regressao_mensalidades.sql` | o gatilho de fatura de entrada cria, do dia 1 ao 10, a fatura do mês corrente; ela colide com as competências fixas do teste | 01–10/11/2026, 01–10/12/2026, fev/2027 e mar/2027 | apagar a fatura de entrada logo depois de criar os alunos (o gatilho tem teste próprio no T12) | [#48] |
| 4 | `regressao_frequencia_regras.sql` | as aulas k1 e k2 (relativas a `now()`, para `concluir_chamada`) ficam na turma e no prefixo do cenário de novembro/2026 | novembro/2026 | turma própria (`turma-freq2-chamada`) e prefixo `-9000-` | [#48] |
| 5 | `regressao_esquema_v3.sql` (F7.9) | justificativa na semana passada; com aula de segunda a sexta, o prazo dela termina no sábado às 00:00 | todo sábado e domingo | semana corrente, que já começou e está sempre no prazo | [#48] |
| 6 | `regressao_frequencia_turma_e_trancamento.sql` (F3) | aula em `now() + 1 s` e consulta em `now() + 1 min` | último minuto de cada mês | aula e consulta no dia 15 do mês seguinte ao relógio real (o dia 1º não serve: a semana dele pode ser do mês anterior) | [#48] |
| 7 | `regressao_grade_semanal.sql` | cenário em 2030; as RPCs de edição comparam com o `now()` real | a partir de 01/03/2030 | cenário em 2086, ano com o mesmo calendário de 2030 | [#3][#48] |
| 8 | `regressao_painel_admin.sql` | alunos sem `created_at` (default `now()`); com o relógio depois da referência de 20/05/2031, eles "nascem" depois dela | a partir de maio/2031 | `created_at` fixo em 01/04/2031 | [#48] |

Os demais arquivos de `supabase/tests/` e os testes Jest foram lidos e não têm data que vença ou
colida: usam `p_referencia`/`p_agora` fixos, datas no passado sem relação com o `now()`, ou
`jest.useFakeTimers` com data fixa.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | No FF8, a aula fica na **segunda da semana corrente**; o teste confere, para os próximos 400 dias, que os meses dessa semana ainda estão abertos no dia | O FF8 precisa de um mês aberto "hoje", seja qual for o dia. A conferência transforma a suposição em teste [#41] | A conferência falha e aponta o dia |
| P2 | Na grade semanal, o ano passa a ser **2086**, e não uma data derivada de hoje | São 58 datas literais amarradas a dias da semana; o ciclo de 28 anos mantém o calendário de 2030 e o cenário igual [#7] | Trocar o ano de novo daqui a 60 anos |
| P3 | Nas mensalidades, a fatura de entrada é **apagada** depois de criar os alunos, em vez de criar os alunos sem plano | O gatilho já tem o seu teste (T12); o cenário precisa do plano no aluno [#6] | — |
| P4 | Onde o relógio não pode ser simulado (F3, k1/k2), a prova da C8 é a data em que quebra, explicada; nos demais, uma simulação com a data mudada | O Postgres não tem relógio falso; simular mexendo na migration fere a D22 | — |

## Passos

| # | Arquivo | O que muda | Como verificar |
| --- | --- | --- | --- |
| 1 | `supabase/tests/regressao_frequencia_nova.sql` | FF8 com datas relativas a hoje (achado 1) | FF8 antigo falha hoje; novo passa |
| 2 | `src/screens/aulas/__tests__/AulasDoAluno.test.tsx` | relógio fixo no arquivo (achado 2) | com o relógio num domingo, o antigo falha; o novo passa |
| 3 | `supabase/tests/regressao_mensalidades.sql` | apaga a fatura de entrada (achado 3) | simulação com a competência do mês corrente |
| 4 | `supabase/tests/regressao_frequencia_regras.sql` | k1/k2 fora do cenário (achado 4) | `db-dev test` |
| 5 | `supabase/tests/regressao_esquema_v3.sql` | F7.9 na semana corrente (achado 5) | simulação com uma semana fora do prazo |
| 6 | `supabase/tests/regressao_frequencia_turma_e_trancamento.sql` | F3 no mês seguinte (achado 6) | `db-dev test` |
| 7 | `supabase/tests/regressao_grade_semanal.sql` | cenário em 2086 (achado 7) | simulação em 2019 (mesmo calendário, já passado) |
| 8 | `supabase/tests/regressao_painel_admin.sql` | `created_at` fixo (achado 8) | simulação com o default de `created_at` depois da referência |
| 9 | `ROADMAP-thai.md` | linha no Registro com as horas do reset e das provas (C3, C6) | — |

## Riscos e rollback [#84]

- Só testes mudam: o rollback é reverter o PR.
- Risco: uma correção esconder um defeito real. Mitigação: cada teste continua provando a mesma
  regra, com as mesmas contas esperadas.

## Definição de pronto

- [x] Provas da C8 registradas na entrega
- [x] `scripts\db-dev test` verde na worktree
- [ ] Jest verde (pre-commit)
- [ ] CI verde, merge (D2), branch apagada
- [x] Registro do `ROADMAP-thai.md` atualizado
