# ENTREGA — T8: Painel do admin e relatório de inadimplência

| Campo | Valor |
|---|---|
| **Tarefa** | `T8` |
| **Plano** | [`PLANO-T8.md`](PLANO-T8.md) · regras em [`docs/PAINEL.md`](../PAINEL.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/painel-admin` |
| **Status** | 🟡 Pronto e testado no ambiente local; **nada publicado em produção** |

---

## 1. O que foi feito

- **Aba Painel**, primeira aba e só para o admin. Mostra:
  - alunos ativos, inativos, ativos sem plano e saídas no mês;
  - recebido × esperado do mês, com progresso e o restante por situação;
  - inadimplência por faixa de atraso (e as contas encerradas, sem nome);
  - faturamento de 12 meses em gráfico;
  - frequência média do mês e do mês passado;
  - alunos em risco de evasão.
- **Relatório de inadimplência** por aluno, com filtro de faixa. Cada linha abre o
  histórico de pagamentos para dar baixa. Também dá para chegar nele pelo
  Financeiro.
- **Toda a conta está no banco**, em 5 funções que recusam quem não é admin. O app
  recebe só agregados e, nas listas, nome, turma e valores.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916210123_painel_admin.sql` | `painel_admin_resumo`, `painel_inadimplencia_faixas`, `painel_faturamento_mensal`, `painel_alunos_em_risco`, `relatorio_inadimplencia`; índice `idx_payments_reference_month` |
| `supabase/tests/regressao_painel_admin.sql` | 12 casos, datas em 2031 e comparação por diferença (passa com ou sem a demonstração) |
| `docs/PAINEL.md` | Definições, decisões, LGPD e medições |
| `src/services/painel.service.ts`, `src/hooks/useAdminDashboard.ts`, `useDelinquencyReport.ts`, `src/utils/painel.ts`, `src/constants/painel.ts` | Leitura conferida campo a campo, carga em paralelo, filtro por faixa, utilitários de apresentação |
| `src/components/StatTile.tsx`, `RevenueBarChart.tsx`, `OverdueBucketsCard.tsx`, `PainelStudentRows.tsx` | Componentes (gráfico só com View, sem dependência nova) |
| `src/screens/painel/PainelScreen.tsx`, `src/screens/financeiro/RelatorioInadimplenciaScreen.tsx` | Telas |
| `MainTabNavigator`, `PainelStackNavigator` (novo), `FinanceiroStackNavigator`, `types.ts`, `AdminFinanceView` | Aba só para admin; rota do relatório; botão "Inadimplência" no Financeiro |
| `src/utils/payments.ts` | `rotuloDeAtraso` exportado (reaproveitado, não duplicado) |
| Docs | `MANUAL-DO-ADMINISTRADOR` §7, `FUNCIONALIDADES` (placar), `README`, nota no `REVIEW.md`, `PLANO-DE-TAREFAS` |

## 3. Como validar no app DEV

Pré-requisito: `scripts\db-dev reset`, `adb reverse tcp:55321 tcp:55321`, APK DEV
gerado desta branch.

1. Entrar como admin local: o app abre no **Painel**. Conferir que "Ativos" dá 50 e
   que o recebido do mês bate com o Financeiro de setembro.
2. **Inadimplência → Ver relatório**: a lista abre na aba Financeiro. Filtrar
   "31–60". Tocar num aluno, **Marcar como paga** uma mensalidade vencida e voltar:
   o aluno sai da lista (ou o valor diminui).
3. Voltar ao Painel: o total em atraso diminuiu.
4. Tocar num aluno em risco: abre a frequência dele na aba Aulas, e o voltar
   funciona.
5. Entrar como professor e como aluno: a aba **Painel** não aparece.
6. Tema claro e escuro, fonte grande do sistema e TalkBack no gráfico (cada coluna
   lê "Agosto de 2026: esperado R$ …, recebido R$ …").

## 4. Verificações executadas

- [x] Suíte SQL completa verde no banco limpo (10 arquivos), incluindo `regressao_painel_admin.sql`, que também passa com a demonstração carregada:
  - aluno, professor e anon barrados;
  - contagem de alunos sem conta excluída, professor ou admin;
  - valores da competência;
  - faixas nos limites (hoje, 30, 31, 60 e 61 dias);
  - aberta vencida conta sem o cron; em análise e paga não contam;
  - relatório agrupado, com inativo e sem conta excluída;
  - faturamento contínuo entre 1 e 24 meses;
  - média sem denominador zero;
  - risco pelo mês atual (mínimo de aulas) ou pelo mês passado;
  - fuso de São Paulo.
- [x] Desempenho com a demonstração: resumo 8,2 ms; as outras 4 abaixo de 3,5 ms
- [x] API local (PostgREST + Auth):
  - como admin, os números batem com SQL direto: recebido 1.400,00; esperado 5.000,00; 50 ativos; inadimplência 3.400,00 com 29 alunos, que é a soma das faixas;
  - faturamento com 12 meses (out/25 a set/26);
  - relatório sem campos de CPF, telefone ou e-mail;
  - professor e aluno recebem 403/42501 nas 5 funções; sem login, 401.
- [x] Jest: 612 testes (35 novos: serviço, hooks, utilitários, gráfico, cartão, linhas e abas por papel); typecheck verde
- [ ] Teste no celular com o app DEV — celular não conectado

## 5. ⚠️ Premissas assumidas (revisar)

As decisões P1–P8 do plano foram seguidas como recomendado:

- Painel como primeira aba só do admin.
- Inadimplência = em aberto ou vencida com vencimento antes de hoje em São Paulo;
  "em análise" fica fora.
- Faixas 1–30 / 31–60 / 61+ por mensalidade; o aluno entra no relatório pelo maior
  atraso.
- Inativo aparece, com selo.
- Conta excluída só na soma.
- Faturamento por competência, 12 meses.
- Risco de evasão abaixo de 50%, com mínimo de 4 aulas no mês atual.
- Média de frequência sem os alunos que não tiveram aula contada.

Ajustes na execução:

- **Nulos:** o tipo gerado diz `number`/`string` para toda coluna de função, mas
  média, turma e percentual podem vir nulos. O serviço confere cada campo e aceita
  nulo onde faz sentido.
- **Gráfico:** o esperado é desenhado como contorno (texto secundário) e o recebido
  como preenchimento (cor primária), para passar de 3:1 nos dois temas.
- **Componentes:** as linhas de devedor e de aluno em risco ficaram num único
  arquivo, `PainelStudentRows.tsx`.
- **Testes da navegação:** o teste das abas conta os rótulos visíveis, com as stacks
  substituídas.

## 6. Pendências e riscos

- 👤⚠️ **Produção:** a migration (`db-push-prod.bat`) vai **antes** do APK novo.
  Com o APK antes, o Painel mostra a tela de erro. A migration só acrescenta funções
  e um índice; APKs antigos não são afetados.
- 👤 Conferir 2 ou 3 números que você conhece da academia depois da publicação.
- **No dia do vencimento, à noite**, o Financeiro pode marcar "Vencida" antes de o
  Painel contar: o cron roda em UTC e o Painel usa o dia de Brasília (documentado).
- **Minimização de dados no Financeiro:** o `AdminFinanceView` ainda baixa perfis
  completos (com CPF e telefone) só para mostrar nomes. Fica fora da T8; melhoria
  sugerida: usar o `diretorio_perfis`.
- Com 4 abas e fonte máxima do Android, os rótulos das abas podem truncar (validar
  no aparelho).

## 7. Próximo passo

Abrir o PR, mesclar e seguir para a **T9** (notificações push), que depende das
contas Expo e Firebase.
