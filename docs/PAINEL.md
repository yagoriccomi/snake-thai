# Painel do administrador — regras

> Fonte da verdade dos números da aba **Painel** e do **Relatório de
> inadimplência** (T8, 2026-09-16). Toda a conta mora no banco
> (`supabase/migrations/20260916210123_painel_admin.sql`); o app só formata.
> Refazer uma soma no aparelho criaria uma segunda versão da regra.

## Quem vê

Só o administrador. A aba nem é registrada para professor e aluno, e cada função
do banco recusa quem não é admin (`42501`) — a tela escondida não é a proteção,
o banco é.

## Definições

| Número | Regra |
|---|---|
| Aluno **ativo** | `role = 'user'`, `status = 'active'`, conta não excluída |
| Aluno **inativo** | `role = 'user'`, `status = 'inactive'` (matrícula trancada), conta não excluída |
| **Ativos sem plano** | Ativos com `plan_id` nulo: não geram mensalidade |
| **Saídas no mês** | Alunos com `deactivated_at` no mês (São Paulo), inclusive contas excluídas |
| **Hoje** e **mês** | Data de São Paulo (`America/Sao_Paulo`) |
| **Esperado** do mês | Soma de todas as mensalidades com a competência do mês |
| **Recebido** | Das mensalidades do mês, as `paid` |
| Em análise / em aberto / vencidas | Status `pending_approval` / `open` / `overdue` do mês |
| **Inadimplência** | Mensalidade `open` ou `overdue` com **vencimento antes de hoje**, de qualquer competência |
| **Dias de atraso** | Hoje − vencimento |
| **Faixas** | 1–30, 31–60 e 61+ dias, somadas por mensalidade |
| **Contas encerradas** | Inadimplência de contas excluídas (LGPD): só o valor somado, sem nome |
| **Faturamento** | Esperado × recebido por **competência**, últimos 12 meses |
| **Frequência média** | Média do percentual dos alunos ativos que tiveram **ao menos uma aula contada** |
| **Risco de evasão** | Aluno ativo abaixo de **70%** no mês atual (com pelo menos **4** aulas contadas) **ou** no último mês fechado |

## Decisões (2026-09-16, modo Loop, recomendações do plano)

1. **Painel é a primeira aba, só para admin.** A aba Financeiro já está cheia; uma
   aba própria segue a regra de não registrar a rota para quem não pode vê-la.
2. **Inadimplência não depende do cron.** `mark-overdue-payments` roda às 00:01
   UTC (21:01 de Brasília) e usa a data em UTC. O Painel compara o vencimento com
   o dia de São Paulo, então conta também a `open` vencida que o cron ainda não
   marcou. Quem já enviou o comprovante (`pending_approval`) não é cobrado.
   Consequência: no próprio dia do vencimento, entre 21:01 e meia-noite, o
   Financeiro pode mostrar "Vencida" antes de o Painel contar.
3. **Faixas por mensalidade; o aluno entra no relatório pelo maior atraso.** A
   soma das 3 faixas bate com o total da inadimplência.
4. **Aluno inativo com dívida aparece**, com o selo "Inativo": é justamente de
   quem saiu que mais se esquece de cobrar.
5. **Conta excluída (LGPD) nunca aparece por nome.** O valor dela entra só em
   "Contas encerradas". As funções usam `anonymized_at`, não o nome
   "Usuário removido".
6. **Faturamento por competência**, igual ao Financeiro por mês, para os dois não
   se contradizerem. Um pagamento atrasado feito hoje aumenta o recebido do mês
   de origem, não o do mês em que o dinheiro entrou.
7. **Risco de evasão:** limite de 70% e mínimo de 4 aulas no mês atual, para uma
   falta no começo do mês não gerar alarme. Os dois valores são parâmetros da
   função e constantes no app (`src/constants/painel.ts`).
8. **Frequência média sem denominador zero.** A regra da frequência devolve 100%
   para quem não teve aula contada; incluir essas pessoas inflaria a média. A tela
   mostra "média de N alunos".

## Rotinas automáticas (L3)

No topo do Painel aparece um aviso quando alguma rotina agendada no banco
(`pg_cron`) falhou na última execução ou nas últimas 24 horas: mensalidades,
vencidas, frequência, guarda de comprovantes, grade semanal e notificações. Sem
problema, nada aparece. O aviso traz o nome da rotina e a contagem, nunca a
mensagem de erro (o detalhe fica no banco; consulta no RUNBOOK). A função é
`saude_das_rotinas()` (só admin); se ela falhar, o resto do Painel carrega igual.

## LGPD: o que sai do banco

- Resumo, faixas e faturamento: só números agregados.
- Alunos em risco e relatório: `user_id`, nome, turma, percentuais ou valores.
  **Nunca** CPF, telefone, nascimento ou e-mail.
- O app não grava essas listas em cache nem as envia ao log (o logger não mascara
  nomes).

## Funções

| Função | Devolve |
|---|---|
| `painel_admin_resumo(p_referencia)` | 1 linha: alunos, mês atual, inadimplência, frequência |
| `painel_inadimplencia_faixas(p_referencia)` | 3 linhas, sempre: faixa, mensalidades, valor |
| `painel_faturamento_mensal(p_meses, p_referencia)` | 1 linha por mês (1 a 24), do mais antigo ao atual |
| `painel_alunos_em_risco(p_limite_percent, p_min_aulas, p_referencia)` | Alunos em risco, do menor percentual |
| `relatorio_inadimplencia(p_referencia)` | 1 linha por devedor, do maior atraso |

`p_referencia` (padrão `now()`) existe para a regressão fixar a data:
`supabase/tests/regressao_painel_admin.sql` (12 casos, datas em 2031).

## Desempenho

Medido no banco local com a demonstração (50 alunos, 300 mensalidades, 204 aulas,
2.333 presenças), `explain analyze` como admin:

| Função | Tempo |
|---|---|
| `painel_admin_resumo` | 8,2 ms |
| `painel_alunos_em_risco` | 3,5 ms |
| `relatorio_inadimplencia` | 0,9 ms |
| `painel_inadimplencia_faixas` | 0,9 ms |
| `painel_faturamento_mensal` | 0,8 ms |

Índice novo: `idx_payments_reference_month` (a unique por competência começa por
`user_id` e não atende a busca por mês).
