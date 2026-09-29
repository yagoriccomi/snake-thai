# Plano — 4.5 Frequência nova

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 11 (11.1 a 11.6) e § 15, mais D5–D10, D26, D35,
> D39, D41, D55, D57, D58, T2, T3, T5, T6, T8, T9, T10, T12, T17, T29, T30, T31, T33, T35–T37,
> T50–T53. Mockups: linha B (Frequência). **Dois PRs:** 4.5a (banco) e 4.5b (app).
> O roadmap avisa: **"este é o item que não pode sair 'plausível e errado'"**. Por isso a § 11.5
> inteira vira regressão SQL antes de qualquer tela.

## Enunciado canônico

- **Problema:**
  - `frequencia_mensal` conta pela turma **de hoje** e pelo `group_since`. Não lê
    `student_group_periods`, `inactive_periods`, a grade efetiva nem as modalidades;
  - não existe conta semanal, Semana Extra, cota, oferta, abono nem meta;
  - o mês fechado é congelado com erro e tudo (`on conflict do nothing`), e o cron roda só no
    dia 1.
- **Resultado esperado:**
  - `frequencia_semanal`, `frequencia_do_mes` e `semanas_do_mes` exatamente como na § 11.6;
  - `frequencia_mensal` (legado, APK 1.8 e web) com o ritmo (§ 15);
  - `attendance_monthly` com `schedule_mode`, `expected`, `excused` e `cancelled`;
  - fechamento **diário**, que também recalcula o mês fechado que mudou (T31);
  - o Painel pelo ritmo, sem teto por aluno e sem o à vontade;
  - no app, o cartão com Semana e Mês (Meta, no à vontade) e a tela Frequência com as semanas.
- **Como validar:**
  - `regressao_frequencia_nova.sql` com a § 11.5 inteira (as tabelas do dono, a Semana Extra, os
    casos-limite, Trocas e extra, Histórico de turma) e `db-dev test` verde;
  - os testes antigos ajustados onde o contrato mandou (F2, F4, F6 e os que gravavam o formato
    antigo);
  - Jest verde e o roteiro do aparelho (4.5b).

## Escopo negativo [#8]

- **Os fluxos que mudam o estado das trocas** (a chamada que aprova ou expira, a T50 no
  cancelamento, a reativação, a retificação) são dos blocos 4.6, 4.7 e 4.9. A conta só **lê** o
  estado. A regressão monta cada linha da tabela "Trocas e extra" no **estado final** que o fluxo
  deixa, e confere o número.
- **A linha "chamada da Noite de qua 10/02 feita com atraso"** do Histórico de turma é da
  chamada (4.6, T47), não da conta.
- **Justificar pela tela nova** é o 4.8. `semanas_do_mes` já devolve `can_justify`,
  `justify_until`, `justifications_left` e `justificativas` para ele.
- **Aposentar `frequencia_mensal`** fica para o G6 (§ 15).

## Raciocínio de dados (skill banco-de-dados-projeto)

- **PII:** nenhuma coluna nova guarda dado pessoal. A fila de recálculo só guarda `user_id` e o
  mês. `approved_by_name`, em `semanas_do_mes`, só sai para o próprio aluno e a equipe, como o
  resto da função.
- **Integridade:** a fila tem PK própria e FK para `profiles` com `on delete cascade` [#86]. A
  unicidade `(reference_month, user_id) nulls not distinct` impede fila duplicada. O `user_id`
  nulo quer dizer "todos os alunos" [#89].
- **Hardcode:** os dias de aula saem de `academy_settings.class_weekdays` e a cota, de `plans`.
  O limite de risco continua sendo parâmetro da função (70 e 4) [#3].
- **Paridade:** tudo numa migration versionada [#87], testada com `db-dev test` e `db-dev reset`.
  A produção só recebe pelo `db-push-prod.bat`, pelo dono.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | **O mês de cada semana sai da T2 para as três modalidades.** Numa semana de M, tudo vai para M. Na Semana Extra, o fixo vai pela data de cada aula e presença, e o livre e o à vontade vão pela divisão da § 11.4 | A T2 é geral ("o mês de cada semana"), e a § 11.4 diz "semana de fixo: P = os dias de W que estão em M" justamente no caso da Semana Extra. Assim a semana nunca some de um mês nem aparece em dois | Uma presença de fixo num domingo de outro mês, numa semana que não é Semana Extra, muda de mês |
| P2 | **`closes_on`** = o domingo da última semana que é de M (inteira ou Semana Extra) | § 11.6 literal | — |
| P3 | **"Declarações da semana" (T29)** = as linhas com `declared_status = 'present'` em aula de rotina da semana, canceladas ou não, em ordem de `declared_at`. As `cota_W` primeiras abonam se a aula for cancelada | T29 literal. As desmarcadas já não estão como `'present'` | — |
| P4 | **À vontade:** `cota_W` = `meta_vigente(user, segunda)`, sem proporcionalidade | § 11.4b literal ("é trocada por `meta_da_semana`") | Um à vontade trancado a semana inteira fica com esperado igual à meta. Ele está fora do Painel (D35) |
| P5 | **Início da contagem (T52)** e **fora de `inactive_periods`** valem para as presenças **do fixo** | § 11.2 e T52 falam do fixo. No livre, a cota proporcional (T8) já cuida do trancamento | — |
| P6 | **Média do Painel no mês atual** = média simples do **ritmo** (`attended_to_date ÷ expected_to_date`), de quem tem `expected_to_date > 0`. No último mês fechado = média de `attendance_monthly.frequency_percent`. À vontade fora | § 11.6: "a média é a média simples dos percentuais, ignorando nulos". O mês cheio em andamento daria média baixíssima no começo do mês, o mesmo motivo da T10. É o comportamento de hoje, sem o teto | Trocar a coluna somada |
| P7 | **Último mês fechado** (Painel) = o mês anterior se `closes_on` dele já passou; senão, o anterior a ele | Com a Semana Extra, o mês anterior pode ainda não ter fechado nos primeiros dias | — |
| P8 | **Recálculo (T31)** por uma **fila** (`attendance_recalc_queue`) que gatilhos enchem: `attendance`, `classes` (cancelamento, reativação, chamada, apagar), `absence_justifications` (status), `class_swaps` (status) e `class_swap_periods` (início e fim). O fechamento diário processa a fila, recalcula os meses já fechados (upsert) e apaga a linha se o esperado virou 0 | Recalcular todos os meses de todos os alunos todo dia pesaria sem motivo. A fila recalcula só o que mudou | — |
| P9 | `fechar_frequencia_do_mes(p_mes, p_agora)` mantém a assinatura. Sem `p_mes`: fecha os meses cujo `closes_on` passou e ainda não foram fechados (o anterior e o de antes) e processa a fila. Com `p_mes`: fecha (ou recalcula) aquele mês, e recusa com `22023` se ele ainda não pode fechar | Os seeds de demonstração chamam com `p_mes` | — |
| P10 | **Quem chama as funções novas:** o próprio aluno (só com o próprio id), `is_staff()` ou o sistema. Outro id → `42501` | § 11.6 e § 0.1. O legado `frequencia_mensal` continua descartando em silêncio os ids que a pessoa não pode ver, como hoje | — |
| P11 | Linhas antigas de `attendance_monthly` recebem `schedule_mode = 'fixed'`, `expected = max(counted_classes − justified, 0)`, `excused = justified` e `cancelled = 0` | Era o denominador da fórmula antiga. O fechamento novo não reescreve o passado sozinho | — |
| P12 | `schedule_mode` do mês usa a semana de `min(hoje, último dia de M)`, sem passar do primeiro dia de M | § 11.4. O "sem passar do primeiro dia" só vale para mês futuro | — |

## Desenho (4.5a)

1. **`meses_da_semana(segunda)`** (interna): o mês inicial e o final dos dias de aula da semana
   (T2). São iguais numa semana de M e diferentes na Semana Extra.
2. **`fim_do_mes_de_frequencia(mes)`** (interna): o `closes_on` (P2).
3. **`frequencia_por_semana(user_ids, primeira_segunda, ultima_segunda, referencia)`**
   (interna, a única conta): uma linha por aluno, semana e **pedaço de mês**, com os totais da
   semana e a parte do mês:
   - **fixo:** `grade_efetiva_do_fixo` da semana. A cancelada vai para `cancelled`, a justificada
     sem presença vai para `excused` e o resto vai para o esperado (e para o ritmo, se já passou e
     teve chamada). As presenças contam em qualquer aula que conta, desde o início da contagem e
     fora do trancamento;
   - **livre e à vontade:** cota ou meta, oferta, teto, abonos (T29 e justificativa semanal),
     abono aplicado (T17) e esperado. Na Semana Extra, as presenças preenchem as vagas em ordem, e
     o resto se divide ao meio, com a sobra para M2 (D10).
4. **`frequencia_semanal`**, **`frequencia_do_mes`** e **`semanas_do_mes`**: somas da interna,
   com as colunas da § 11.6.
5. **`frequencia_mensal`** (legado): mesma assinatura e mapeamento da § 15.
6. **`attendance_monthly`**:
   - saem `_contagens_coerentes` e `_percentual_valido`;
   - entram `schedule_mode`, `expected`, `excused` e `cancelled` (backfill P11, depois
     `not null`);
   - `frequency_percent numeric(7,2) not null`, com `check (expected > 0)` `NOT VALID` → conferência
     → `VALIDATE` só se os dados antigos passarem (senão fica `NOT VALID` e o motivo vai no
     Registro).
7. **Fila e gatilhos** do T31 (P8).
8. **`fechar_frequencia_do_mes`** (P9) e o cron **diário** `close-monthly-attendance`.
9. **Painel:** `painel_admin_resumo` e `painel_alunos_em_risco` com a mesma assinatura (P6, P7).

## Passos (4.5a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929130000_frequencia_nova.sql` | Itens 1 a 9 do desenho | [#87] [#6] | `db-dev reset` |
| 2 | `supabase/tests/regressao_frequencia_nova.sql` | § 11.5 inteira + chamadas negadas (anônimo, outro aluno) | [#41] | `db-dev test` |
| 3 | `regressao_frequencia_turma_e_trancamento.sql` | F2 (D58), F4 (trancamento por período), F5 e F6 (pelos períodos), no formato novo | § 0.1 | `db-dev test` |
| 4 | Testes que gravavam `attendance_monthly` no formato antigo ou dependiam do mês congelado e do cron mensal | Ajuste ao formato novo, sem mudar o que eles provam | [#42] | `db-dev test` |
| 5 | `supabase/seed/*` | Seeds chamam o fechamento novo | — | leitura |
| 6 | `src/types/database.types.ts` | `db-dev types` | [#11] | `tsc` |
| 7 | `docs/FREQUENCIA.md` e `docs/PAINEL.md` | A regra nova, para quem chega depois | [#96] | leitura |

## Passos (4.5b, app) — skill design-de-interface-projeto

**Decisão visual:** sem mockup novo. Os da linha B foram aprovados: o cartão "Semana · Mês" (e
"Meta da semana · Meta do mês") nas telas Aulas do livre, do fixo e do à vontade, e a tela
"Frequência — semanas e semana extra". Cores só por token do tema; carregando, erro e "—"
tratados. As premissas da tela estão na entrega.


- `frequency.service.ts`: `fetchFrequenciaDoMes`, `fetchSemanasDoMes` e `fetchFrequenciaSemanal`
  com o percentual nulo tratado;
- `formatarPercentual`: nulo vira "—", acima de 100% aparece como vem;
- `FrequencyCard`: Semana e Mês (Meta, no à vontade);
- tela **Frequência**: as semanas do mês, com a Semana extra, e o histórico;
- testes Jest de serviço, utilitário e tela (carregando, erro e vazio).

## Riscos e rollback [#84]

- **Conta errada e plausível:** mitigada pela § 11.5 inteira na regressão, com números fechados.
- **Desempenho:** a conta roda por aluno e por semana. Para o Painel (todos os ativos, um mês),
  são cerca de 5 semanas por aluno. Numa academia pequena, fica bem abaixo de 1 s. Se pesar,
  dá para guardar a semana em cache depois; nada disso muda assinatura.
- **Web:** lê `frequencia_mensal` com `?? 0`. O legado continua devolvendo 100 com esperado 0 e
  nunca devolve nulo.
- **Rollback:** a migration é local até o dono rodar o `db-push-prod.bat`. Voltar = reverter o
  PR e `db-dev reset`.

## Definição de pronto

- [x] `db-dev test` e `db-dev reset` verdes; `db-dev types` rodado;
- [x] CI verde, PR 4.5a (#60) mesclado e Registro na main;
- [ ] 4.5b: Jest verde, PR mesclado e roteiro do aparelho em `ENTREGA-4.5`.
