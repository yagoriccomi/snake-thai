# Entrega — 4.5 Frequência nova

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.5-frequencia.md`](PLANO-4.5-frequencia.md).
> PRs: **#60** (4.5a, banco, mesclado) e o PR do 4.5b (app).

## O que mudou

### 4.5a — banco (PR #60)

- `supabase/migrations/20260929130000_frequencia_nova.sql`:
  - **uma conta só**, `frequencia_por_semana`, da qual saem `frequencia_semanal`,
    `frequencia_do_mes`, `semanas_do_mes`, o legado `frequencia_mensal`, o fechamento e o
    Painel;
  - `attendance_monthly` com `schedule_mode`, `expected`, `excused` e `cancelled` (antigas
    preenchidas);
  - `fechar_frequencia_do_mes` diário e a fila `attendance_recalc_queue` do T31;
  - o Painel pelo ritmo, sem teto e sem o à vontade.
- `supabase/tests/regressao_frequencia_nova.sql`: a § 11.5 inteira (80 conferências).
- Testes antigos ajustados ao contrato: F2, F4 e F6 de turma e trancamento; T1 e T14–T17 das
  regras; os que gravavam `attendance_monthly` no formato antigo; T10 do Painel.
- `supabase/seed/demo_seed_historico.sql`: recua também os períodos de turma e de plano (a
  conta os lê) e só fecha o mês cuja Semana Extra já terminou.
- `docs/FREQUENCIA.md`, `docs/PAINEL.md` e `README.md`.

### 4.5b — app

- `src/services/frequency.service.ts`: `fetchFrequenciaSemanal`, `fetchFrequenciaDoMes` e
  `fetchSemanasDoMes`, com o percentual nulo tratado como nulo.
- `src/utils/frequency.ts`: `formatarPercentual` aceita nulo ("—"). Rótulos da meta, tom do
  percentual, aviso de mês aberto, período da semana, acumulado do mês, dica e explicação da
  Semana extra.
- `src/hooks/useFrequenciaDoAluno.ts` (cartão) e `src/hooks/useFrequenciaDoMes.ts` (tela).
- `src/components/FrequencyCard.tsx`: Semana e Mês (Meta, no à vontade).
- `src/screens/aulas/HistoricoFrequenciaScreen.tsx`: a tela Frequência do mockup da linha B.
- `src/screens/aulas/StudentAulasList.tsx`: o cartão novo.
- `src/screens/painel/PainelScreen.tsx`: usa o "—" do `formatarPercentual`.
- Testes: cartão, utilitários, serviço, hooks e tela.

## Premissas da tela (4.5b)

| # | Premissa | Por quê |
| --- | --- | --- |
| A1 | Na Semana extra, a tela do mês mostra só a parte que fica **neste** mês ("neste mês: {a} de {e}"). A outra parte aparece na tela do outro mês | `semanas_do_mes` devolve a parte do mês pedido; buscar o outro mês só para essa linha dobraria as leituras |
| A2 | O cartão "Semana extra" mostra a **última** Semana extra do mês (a que pode segurar o fechamento) | Um mês pode ter duas (set/2026). A tabela mostra as duas |
| A3 | O "No mês (acumulado)" soma as presenças do mês semana a semana, sobre o esperado do mês inteiro (D8) | É o mockup. As parcelas vêm do banco; o app só soma na ordem |
| A4 | A chamada (`FrequenciaScreen`) continua lendo `frequencia_mensal` | A chamada nova é o 4.6 |
| A5 | O aviso de mês aberto usa tokens neutros (`borderStrong`, `textSecondary`) | O token `info` é #1E3A8A nos dois temas e fica ilegível no escuro (achado; ver pendências) |

## Como validar

- `scripts\db-dev test` (verde) e `scripts\db-dev reset` (verde, com os meses de demonstração
  gravados).
- `npx tsc --noEmit` e Jest (verde).
- **Roteiro no aparelho** (banco local recriado, app DEV):
  1. Entrar como aluno **livre**: o cartão da tela Aulas mostra **Semana** e **Mês**, cada um
     com "{a} de {e}". Com uma presença a mais que a cota, o número da semana fica verde e
     passa de 100%.
  2. Tocar no cartão: a tela Frequência abre no mês corrente, com o seletor de meses no topo,
     os cartões Mês e (se houver) Semana extra, e a tabela das semanas.
  3. Em **setembro/2026**, a primeira e a última linha são **Semana extra**, cada uma com
     "neste mês: {a} de {e}". Aparece o bloco "Como a semana extra se divide".
  4. Entre 01/10 e 04/10/2026, abrir setembro: aparece **"Fecha em 04/10, quando a semana
     extra terminar"**. Em outubro, não aparece.
  5. Escolher um mês fechado no seletor: o cartão Mês termina em "fechou em {dd/mm}".
  6. Entrar como aluno **à vontade**: os rótulos viram **Meta da semana** e **Meta do mês**.
  7. Aluno numa semana sem aula para livres: o cartão mostra **"—"**, nunca "0%".
  8. Modo avião: o cartão mostra "Não foi possível carregar a frequência." e a tela Frequência
     mostra o erro com **Tentar novamente**.
  9. Tema claro e escuro: o verde do "acima de 100%" e o laranja das semanas abaixo continuam
     legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção:** a migration do 4.5a vai no próximo `db-push-prod.bat`, pelo dono. Depois dela,
  a web e o APK 1.8 veem o legado com o ritmo (§ 15): `counted_classes` passa a ser o esperado
  até agora, e a justificada sai do total.
- **Achado fora do escopo:** o token `info` (`src/theme/colors.ts`) é #1E3A8A também no tema
  escuro. O texto "em análise" do `PagamentoScreen` fica quase invisível no escuro. Vale uma
  correção pequena de tema (o mockup usa #93C5FD no escuro).
- **Justificar a semana pela tela nova** é o 4.8. `semanas_do_mes` já devolve `can_justify`,
  `justify_until`, `justifications_left` e `justificativas`.

## Próximo passo

4.6 (motivos e chamada nova).
