# PLANO DE EXECUÇÃO — L3: monitorar falhas das rotinas agendadas

| Campo | Valor |
|---|---|
| **Tarefa** | `L3` (lacuna do revisor, [`PLANO-DE-TAREFAS`](../PLANO-DE-TAREFAS.md)) |
| **Modo de execução** | 🔁 Loop (produção só com confirmação) |
| **Data** | 2026-09-16 |
| **Branch** | `feat/saude-das-rotinas` |

## 1. Enunciado

**Problema.** Dez rotinas rodam sozinhas no banco (`pg_cron`):
- mensalidades;
- vencidas;
- frequência;
- guarda de comprovantes;
- grade semanal;
- 5 de notificações.

Quando uma falha, ninguém fica sabendo. O erro só aparece em
`cron.job_run_details`, que ninguém abre. Uma geração de mensalidades que falhou
no dia 1 só é notada quando falta cobrança.

**Resultado esperado.** O admin vê, no Painel, um aviso quando alguma rotina falhou
nas últimas 24 horas ou quando a última execução falhou. O aviso diz qual rotina,
em linguagem de gente.

**Como validar.**
- Regressão SQL com uma falha simulada no histórico.
- Teste Jest do cartão (com falha e sem falha).
- API local: o aluno recebe 403 e o admin vê as rotinas.

## 2. Premissas assumidas (Loop)

- **P1. Dentro do app, no Painel.** Sem e-mail nem push: evita um canal novo e
  segredos novos. O Painel já é onde o admin olha a academia.
- **P2. Só falhas.** "Deixou de rodar" (cron parado) exigiria interpretar a
  agenda de cada rotina. Fica como evolução; o RUNBOOK já tem a consulta.
- **P3. Sem a mensagem de erro no app.**
  - Ela pode trazer detalhes internos: vai só o nome da rotina e a contagem.
  - O detalhe fica no SQL do RUNBOOK.
- **P4. Janela de 24 horas.** Cobre as rotinas diárias; as mensais aparecem pelo
  último status.

## 3. Passos

1. **Migration `saude_das_rotinas`:** `saude_das_rotinas(p_referencia timestamptz
   default now())`, só admin (42501). Devolve, por rotina: nome, última execução,
   último status e falhas nas últimas 24 horas.
2. **Regressão `supabase/tests/regressao_saude_das_rotinas.sql`:**
   - aluno recusado;
   - admin vê as 10 rotinas;
   - falha simulada contada na janela;
   - falha antiga fora da janela;
   - último status.
3. **Tipos regenerados.** No app:
   - `fetchSaudeDasRotinas` no `painel.service`;
   - o hook do Painel carrega junto (5ª chamada);
   - cartão `SaudeDasRotinasCard`, que só aparece com problema e lista as rotinas
     pelo nome amigável;
   - testes.
4. **Docs:** `PAINEL.md`, `RUNBOOK` e `PLANO-DE-TAREFAS` (L3); `ENTREGA-L3.md`.

## 4. Riscos

- **Histórico dos jobs de push:** fica só 7 dias (limpeza da T9), mas a janela é de
  24 horas.
- **Produção:** as rotinas rodam como `postgres` e a função é `SECURITY DEFINER`
  do mesmo dono, então a política do `cron.job_run_details` (`username =
  current_user`) mostra as linhas. Conferir no primeiro uso real.
