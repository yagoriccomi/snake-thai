# PLANO DE EXECUÇÃO — T8: Dashboard do admin (aba Painel) e relatório de inadimplência e faturamento

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T8` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/painel-admin` |
| **Esforço** | G |
| **Depende de** | T1, T4 |

## 1. Enunciado

Criar uma aba "Painel" que só o admin vê. Ela mostra alunos ativos e inativos, recebido x esperado do mês por competência, inadimplência com valor e faixas de atraso, faturamento dos últimos 12 meses em gráfico de barras feito só com View e frequência média com alunos em risco de evasão. Junto vem um relatório de inadimplência por aluno, que abre o histórico de pagamentos. Toda a conta fica no banco, em funções SECURITY DEFINER que recusam quem não é admin (42501), cobertas por regressão SQL rodada só no banco local. O app recebe apenas agregados e a lista mínima (nome e turma, sem CPF, telefone ou e-mail).

## 2. Terreno (situação verificada)

- Dashboard e relatório de inadimplência e faturamento não existem; estão marcados como FALTA (P0).  
  _Evidência:_ docs/FUNCIONALIDADES.md:67 ('Relatório de inadimplência e faturamento · FALTA') e :81 ('Dashboard do admin ... · FALTA')
- O app tem 3 abas (Aulas, Financeiro, Dados). O mapa de ícones é tipado por keyof MainTabParamList, então uma aba nova obriga a declarar o ícone. A aba Financeiro nem é registrada para professor, e esse é o padrão a repetir para o Painel.  
  _Evidência:_ src/navigation/MainTabNavigator.tsx:23-27 (TAB_ICONS) e :78-84 ({!isProfessor && <Tab.Screen name="Financeiro" ...>}); src/navigation/types.ts:87 (MainTabParamList)
- O financeiro do admin é por competência e de um mês só. O resumo mostra só recebido, em aberto e vencidas, e os totais são somados no app depois de baixar todas as mensalidades do mês.  
  _Evidência:_ src/hooks/useAdminPayments.ts:82-113 (Promise.all + filter/sumCents no cliente); src/components/FinanceSummary.tsx:25-45; src/screens/financeiro/AdminFinanceView.tsx:137-146 (MonthSelector, FinanceSummary, botão 'Histórico por aluno')
- Para resolver nomes, o financeiro atual baixa perfis inteiros de alunos (select '*', o que inclui cpf, phone e dob). Não é minimização de dados, e o painel novo não deve repetir isso.  
  _Evidência:_ src/services/profile.service.ts:119-129 (fetchAllStudents .select('*')); consumido em src/hooks/useAdminPayments.ts:83
- O hook atual carrega duas vezes ao abrir: useEffect no hook e useFocusEffect na tela chamam reload.  
  _Evidência:_ src/hooks/useAdminPayments.ts:130-132 (useEffect load) + src/screens/financeiro/AdminFinanceView.tsx:56-60 (useFocusEffect reload)
- payments guarda valor em centavos, paid_at coerente com status, competência (reference_month) única por aluno e os status pending_approval, open, overdue e paid. Há índices em user_id, status, due_date e (status, paid_at). Não há índice só em reference_month: a unique começa por user_id.  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:21,146-148; 20260819140000_plans_and_payment_amounts.sql:62-63,69-70,81,93-95; 20260904200000_geracao_mensalidades.sql:31,46-47; grep 'index.*reference_month' em supabase/migrations sem resultado
- A marcação de vencida usa current_date em UTC, num cron às 00:01 UTC (21:01 em Brasília). Ou seja, o status 'overdue' não é a fonte confiável para dias de atraso no fuso da academia.  
  _Evidência:_ supabase/migrations/20260727160100_payments_overdue_cron.sql:24 ('due_date < current_date') e :35-39 (cron '1 0 * * *')
- O aluno tem status active ou inactive, com deactivated_at. A exclusão LGPD anonimiza em vez de apagar: role continua 'user', name vira 'Usuário removido', status fica inactive e anonymized_at é preenchido. As mensalidades em aberto são preservadas, não canceladas.  
  _Evidência:_ supabase/migrations/20260819160000_roles_status_and_audit.sql:21,27,38; 20260819180000_anonymized_profiles.sql:17-18; supabase/functions/delete-my-account/index.ts:115-130
- frequencia_mensal(uuid[], timestamptz) é SECURITY DEFINER, aceita vários alunos de uma vez e devolve 100% quando o denominador é ≤ 0. Se entrar sem filtro, uma média fica inflada por alunos sem aula contada. O histórico congelado fica em attendance_monthly, com unique (user_id, reference_month).  
  _Evidência:_ supabase/migrations/20260914140000_frequencia_regras.sql:37-54, 68-79, 118-121, 129-130; 20260914120100_frequencia_fundacao.sql:342-387
- Não há biblioteca de gráficos nem react-native-svg. Adicionar uma exigiria módulo nativo e rebuild do APK.  
  _Evidência:_ package.json:5-31 (dependencies sem svg/chart/victory/skia); 'ls node_modules/react-native-svg' → No such file or directory
- As regressões SQL rodam numa transação com ROLLBACK e simulam o usuário com set local role authenticated + request.jwt.claims. O cabeçalho diz que 'pode rodar contra produção'. Os prefixos de UUID a0000000 a f0000000 já estão em uso.  
  _Evidência:_ supabase/tests/regressao_mensalidades.sql:1-5; supabase/tests/regressao_chamada_em_lote.sql:57-58; grep dos prefixos em supabase/tests/*.sql
- O ambiente local está configurado, mas com conflito: o config.toml do snake-thai usa as portas 54321/54322, que já estão ocupadas pela stack Supabase do projeto radar-tributario em execução. Além disso, psql não está no PATH.  
  _Evidência:_ supabase/config.toml:4,13-16 (project_id snake-thai, db port 54322, major_version 15); docker ps → supabase_db_radar-tributario 0.0.0.0:54322, supabase_kong_radar-tributario 0.0.0.0:54321; 'which psql' → no psql; npx supabase --version → 2.117.0
- Os tipos TypeScript são gerados a partir do banco local, e as RPCs de tabela já saem tipadas, que é o padrão a seguir.  
  _Evidência:_ package.json script 'supabase:types' (supabase gen types typescript --local); src/types/database.types.ts:753-776 (aulas_sem_chamada, frequencia_mensal)
- As telas de destino do relatório já existem e recebem { userId, name }: HistoricoPagamentosAluno na stack Financeiro e HistoricoFrequencia na stack Aulas.  
  _Evidência:_ src/navigation/types.ts:56 e :83; src/navigation/FinanceiroStackNavigator.tsx (Stack.Screen HistoricoPagamentosAluno); src/navigation/AulasStackNavigator.tsx (Stack.Screen HistoricoFrequencia)
- O logger mascara cpf, phone, email e token, mas não 'name': linhas do relatório não podem ir para o log.  
  _Evidência:_ src/lib/logger.ts:24-37 (SENSITIVE_KEYS)
- O REVIEW.md afirma que falta índice em payments.due_date, mas o índice existe desde a migration inicial. A afirmação está desatualizada.  
  _Evidência:_ REVIEW.md:233-235 vs supabase/migrations/20260727130000_init_schema.sql:148 (idx_payments_due_date)
- Estado do git: a branch feat/papel-professor está limpa e sincronizada com a origin, com 10 commits à frente da origin/main e 3 atrás (merges).  
  _Evidência:_ git status --short vazio; git branch -vv → [origin/feat/papel-professor]; git rev-list --left-right --count origin/main...HEAD → '3 10'

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Onde o Painel fica no app?**

- Aba nova 'Painel' só para admin, como PRIMEIRA aba (o admin abre o app direto nela)
- Aba nova 'Painel' só para admin, entre Financeiro e Dados
- Bloco no topo da aba Financeiro (sem aba nova)
- Item/atalho dentro da aba Dados

➡️ _Adotado:_ Aba nova 'Painel', só para admin e como primeira aba. A aba Financeiro já tem cabeçalho, seletor de mês, resumo, botão e segmentos, e mais um bloco ali ficaria apertado. Uma aba própria segue o padrão de não registrar a rota para quem não pode vê-la. Professor e aluno continuam com as 3 abas de hoje.

**P2. O que conta como inadimplência?**

- Mensalidade 'em aberto' ou 'vencida' com vencimento ANTES de hoje (fuso de São Paulo); 'em análise' (comprovante enviado) fica fora e aparece separada
- Só o que o banco já marcou como 'vencida' (status overdue)
- Incluir também 'em análise' vencida

➡️ _Adotado:_ A primeira opção. Não depende do horário do cron, que roda em UTC e marca a vencida às 21:01 de Brasília. Também não cobra de quem já mandou o comprovante e só espera a aprovação do admin.

**P3. Faixas de atraso e como classificar o aluno**

- 1–30, 31–60 e 61+ dias; valores somados por mensalidade; no relatório, o aluno entra na faixa do seu MAIOR atraso
- As mesmas faixas, contando alunos em vez de mensalidades
- Outras faixas (ex.: 1–15, 16–30, 31+)

➡️ _Adotado:_ 1–30 / 31–60 / 61+ por mensalidade, e o aluno classificado pelo maior atraso. Assim '60+' não se sobrepõe a '31–60' e a soma das faixas bate com o total devido.

**P4. Aluno INATIVO (matrícula trancada) com dívida aparece no relatório?**

- Sim, com selo 'Inativo'
- Não, só alunos ativos

➡️ _Adotado:_ Sim, com selo 'Inativo'. A dívida continua existindo e é justamente de quem saiu que mais se esquece de cobrar. O histórico por aluno já inclui inativos pelo mesmo motivo.

**P5. Conta excluída pela LGPD (anonimizada) com mensalidade em aberto: como tratar?**

- Fora da lista por aluno; valor somado numa única linha agregada 'Contas encerradas', sem identificação
- Fora da lista e fora de qualquer total de inadimplência
- Na lista, como 'Usuário removido'

➡️ _Adotado:_ Fora da lista, com o valor numa linha agregada sem identificação. O admin vê a perda real sem que alguém anonimizado volte a aparecer numa lista, a mesma regra do diretorio_perfis. Se a T9 passar a cancelar as cobranças em aberto na exclusão, essa linha zera sozinha.

**P6. Faturamento: base e período do gráfico**

- Por COMPETÊNCIA (esperado x recebido do mês a que a mensalidade se refere), últimos 12 meses
- Por competência, últimos 6 meses
- Por CAIXA (soma pelo dia do pagamento, paid_at), 12 meses
- As duas séries (competência e caixa)

➡️ _Adotado:_ Competência, 12 meses, igual ao Financeiro por mês, que já é por competência. Assim os números do Painel e do Financeiro não se contradizem. Vale saber que um pagamento atrasado feito hoje aumenta o 'recebido' do mês de origem, e isso vai documentado.

**P7. Critério de 'risco de evasão' por frequência**

- Frequência abaixo de 50% no último mês fechado OU no mês corrente, este só com pelo menos 4 aulas já contadas
- Só o último mês fechado abaixo de 50%
- Só o mês corrente abaixo de 50%
- Outro limiar (ex.: 60% ou 70%)

➡️ _Adotado:_ A primeira opção, com limiar de 50% e mínimo de 4 aulas. O mês fechado é estável, e o corrente pega a queda cedo. O mínimo de aulas evita alarme falso no começo do mês, quando uma falta sozinha já derruba o percentual. Os dois valores ficam como parâmetros e constantes nomeadas, fáceis de ajustar.

**P8. Frequência média: considerar alunos sem nenhuma aula contada no período?**

- Não: a média só considera quem teve ao menos 1 aula com chamada (a regra devolve 100% para denominador zero)
- Sim: média de todos os ativos

➡️ _Adotado:_ Não. Alunos com denominador zero entram como 100% e inflam a média. A tela mostra 'média de N alunos com aula no mês'.

## 4. Ações que só o usuário pode fazer

- [ ] Responder às decisões acima ou dizer que aceita as recomendações. Sem resposta, a execução segue as recomendações.
- [ ] Autorizar explicitamente a aplicação da migration nova no banco de PRODUÇÃO (projeto fmmftavduunrjnbbtfmf), depois da validação no banco local. O planejador e o executor não aplicam nada em produção sem essa ordem.
- [ ] Aprovar o PR e o merge na main, conforme a política de push e merge definida na T4.
- [ ] Na conferência final em produção, entrar como admin real no celular e conferir 2 ou 3 números que conhece da academia (ex.: alunos ativos, quanto entrou no mês). As credenciais reais são só dele.
- [ ] Se a T1 não resolver o conflito de portas: decidir entre parar a stack Supabase local do projeto radar-tributario ou mudar as portas do snake-thai (ela ocupa 54321/54322, as mesmas do supabase/config.toml).

## 5. Passos atômicos

### Passo 1

Base de trabalho isolada. Depois que a T4 integrar feat/papel-professor na main, criar a branch feat/painel-admin a partir da main atualizada. Subir o Supabase LOCAL definido na T1 com 'npx supabase start' e 'npx supabase db reset', que aplica as migrations no Postgres do Docker. Semear dados de demonstração SÓ no local. Como psql não está no PATH, usar o container: 'docker exec -i supabase_db_snake-thai psql -U postgres -d postgres < supabase/seed/demo_seed.sql' e depois o mesmo comando com demo_seed_historico.sql. Resolver antes o conflito de portas com a stack radar-tributario (ver T1). Nunca usar a connection string de produção neste ciclo.

_Arquivos:_ `supabase/config.toml`, `supabase/seed/demo_seed.sql`, `supabase/seed/demo_seed_historico.sql`

**Como verificar:** 'git branch --show-current' mostra feat/painel-admin; 'npx supabase status' lista a API e o DB do projeto snake-thai; no container local, 'select count(*) from public.profiles where role = ''user''' dá ≥ 50 e 'select count(distinct reference_month) from public.payments' dá ≥ 3.

### Passo 2

Escrever a especificação docs/PAINEL.md como fonte da verdade, no mesmo estilo de docs/FREQUENCIA.md, com as decisões do usuário. Definições: aluno ativo = role 'user', status 'active', anonymized_at nulo. Inativo = status 'inactive' e não anonimizado. Esperado da competência = soma de amount_cents de todas as mensalidades com reference_month = mês. Recebido = só as 'paid'. Em análise, em aberto e vencida seguem o status. Inadimplência = status em (open, overdue) e due_date < data de hoje em America/Sao_Paulo. Dias de atraso = hoje (SP) − due_date. Faixas 1–30 / 31–60 / 61+. Contas anonimizadas entram só numa linha agregada. Frequência média exclui denominador zero. Risco de evasão conforme o limiar decidido. Incluir também a seção de LGPD (quais campos saem do banco) e a observação sobre o cron em UTC.

_Arquivos:_ `docs/PAINEL.md`

**Como verificar:** Cada indicador da tela tem definição escrita e cada decisão do usuário está registrada com a data (2026-09-16). Revisar se o texto bate com as recomendações aceitas.

### Passo 3

Criar a migration com 'npx supabase migration new painel_admin'. Se T6, T7 ou T9 criarem migrations em paralelo, o timestamp tem de ficar depois das delas. Todas as funções seguem as regras: LANGUAGE plpgsql, STABLE, SECURITY DEFINER, SET search_path = '', diretiva '#variable_conflict use_column' e colunas sempre qualificadas por alias, porque RETURNS TABLE com nomes como user_id ou reference_month gera 'column reference is ambiguous'. Primeira instrução: if not public.is_admin() then raise exception 'Operação negada: painel exclusivo do administrador.' using errcode = '42501'. Hoje = (p_referencia at time zone 'America/Sao_Paulo')::date, com p_referencia timestamptz default now() para dar testabilidade, como frequencia_mensal. Depois de cada função: revoke execute from public, anon; grant execute to authenticated; comment on function. Funções: (a) painel_admin_resumo(p_referencia) → 1 linha: alunos_ativos, alunos_inativos, alunos_ativos_sem_plano, saidas_no_mes (deactivated_at no mês SP), competencia, esperado_cents, recebido_cents, em_analise_cents, em_aberto_cents, vencido_cents, mensalidades_total, mensalidades_pagas, inadimplencia_cents, alunos_inadimplentes (distintos, não anonimizados), inadimplencia_contas_encerradas_cents, frequencia_media_mes (avg filter where counted_classes − justified > 0 sobre public.frequencia_mensal(array(ativos), p_referencia)), alunos_com_aula_no_mes, ultimo_mes_fechado, frequencia_media_ultimo_mes (attendance_monthly do mês anterior, mesmo filtro). Somas em ::bigint com coalesce(…, 0). (b) painel_inadimplencia_faixas(p_referencia) → 3 linhas (faixa text '1-30'|'31-60'|'60+', ordem int, mensalidades int, valor_cents bigint), a partir de (values ('1-30',1,1,30),('31-60',2,31,60),('60+',3,61,null)) LEFT JOIN nas mensalidades inadimplentes de perfis não anonimizados, para as 3 faixas sempre aparecerem. (c) painel_faturamento_mensal(p_meses int default 12, p_referencia) → uma linha por mês, do mais antigo ao atual, via generate_series(0, least(greatest(p_meses,1),24)−1) LEFT JOIN payments on reference_month = mes: reference_month, esperado_cents, recebido_cents (filter status = 'paid'), pendente_cents (filter status <> 'paid'). Meses sem cobrança vêm com zero. (d) painel_alunos_em_risco(p_limite_percent numeric default 50, p_min_aulas int default 4, p_referencia) → user_id, nome (coalesce(name,'Aluno pendente')), turma (groups.name), frequencia_mes_atual (só quando counted − justified ≥ p_min_aulas), frequencia_ultimo_mes (só quando counted − justified > 0), apenas alunos ativos abaixo do limiar em algum dos dois, ordenado do menor percentual. (e) relatorio_inadimplencia(p_referencia) → user_id, nome, turma, aluno_ativo boolean, mensalidades int, total_devido_cents bigint, maior_atraso_dias int, vencimento_mais_antigo date; só perfis não anonimizados; order by maior_atraso_dias desc, total_devido_cents desc. Nenhuma função devolve cpf, phone, dob ou e-mail. Índice extra: 'create index if not exists idx_payments_reference_month on public.payments (reference_month);', que atende o faturamento e o fetchPaymentsForMonth já existente.

_Arquivos:_ `supabase/migrations/<timestamp>_painel_admin.sql`

**Como verificar:** 'npx supabase db reset' termina sem erro no local. No container, '\df+ public.painel_*' e '\df+ public.relatorio_inadimplencia' mostram security definer e search_path=''. 'select has_function_privilege(''anon'', ''public.relatorio_inadimplencia(timestamptz)'', ''execute'')' devolve false.

### Passo 4

Criar a regressão supabase/tests/regressao_painel_admin.sql no padrão das existentes: \set ON_ERROR_STOP on, begin … rollback, raise notice 'OK Tn' e raise exception 'FALHOU Tn'. O cabeçalho deve dizer que ela roda SÓ no banco local, nunca em produção. UUIDs de fixture com prefixo novo (ex.: '9d000000-0000-4000-8000-…'). Alunos das fixtures com plan_id nulo, para o trigger de fatura de entrada não gerar cobranças. Mensalidades inseridas explicitamente, com reference_month e due_date num ano distante (ex.: 2031) e p_referencia fixo (ex.: '2031-05-20 12:00-03'). Nos contadores globais, comparar o delta entre antes e depois das fixtures, dentro da mesma transação, para não depender dos dados de demo. Casos: T1 aluno e T2 professor recebem 42501 nas 5 funções. T3 anon sem execute. T4 ativos e inativos contam só role 'user', excluem anonimizado, professor e admin. T5 esperado, recebido, em análise, em aberto e vencida da competência batem com a massa. T6 faixas nos limites: vencimento hoje = não inadimplente; hoje−1 e hoje−30 = '1-30'; hoje−31 e hoje−60 = '31-60'; hoje−61 = '60+'. T7 'open' vencida (cron não rodou) conta; 'pending_approval' e 'paid' vencidas não contam. T8 o relatório agrupa por aluno (soma, maior atraso, vencimento mais antigo, ordenação), inclui inativo com aluno_ativo = false e omite anonimizado, cujo valor aparece em inadimplencia_contas_encerradas_cents. T9 faturamento devolve exatamente p_meses linhas contínuas, com zero nos meses vazios, e respeita os limites 1 e 24. T10 frequência média ignora aluno com denominador zero. T11 risco lista quem ficou abaixo do limiar e ignora mês corrente com menos aulas que p_min_aulas. T12 fuso: 23h30 do último dia do mês em SP ainda é o mês corrente. Para simular papéis: set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'; reset role entre os blocos.

_Arquivos:_ `supabase/tests/regressao_painel_admin.sql`

**Como verificar:** 'docker exec -i supabase_db_snake-thai psql -U postgres -d postgres < supabase/tests/regressao_painel_admin.sql' imprime OK T1…T12 e termina em ROLLBACK. Uma consulta depois mostra zero linhas com o prefixo 9d000000 em profiles, payments e auth.users. Rodar também as 6 regressões existentes no local, que devem continuar verdes.

### Passo 5

Medir o desempenho no banco local com a seed de demo. No container: begin; set local role authenticated; set local request.jwt.claims com o UUID do admin de demo; e então 'explain (analyze, buffers) select * from public.painel_admin_resumo();', repetido para as outras 4 funções. O resultado vai em docs/PAINEL.md. Se algum passar de ~50 ms, investigar o plano antes de seguir (ex.: índice parcial em payments(due_date) where status in ('open','overdue')).

_Arquivos:_ `docs/PAINEL.md`

**Como verificar:** As 5 funções executam em < 50 ms com a seed de demo (50 alunos, 3+ meses de histórico) e o tempo fica anotado no documento.

### Passo 6

Regenerar os tipos TS a partir do banco local com 'npm run supabase:types', após rebase na main e com o local igual ao que irá para produção.

_Arquivos:_ `src/types/database.types.ts`

**Como verificar:** O diff de database.types.ts só acrescenta as 5 funções (Args/Returns) e nada de outras branches. 'npm run typecheck' passa.

### Passo 7

Criar as constantes e utilitários puros, sem React e sem Supabase. Em src/constants/painel.ts: MESES_DO_GRAFICO = 12, LIMIAR_RISCO_EVASAO_PERCENT = 50, MIN_AULAS_PARA_RISCO = 4, FAIXAS_DE_ATRASO (chave '1-30'|'31-60'|'60+' → rótulo '1 a 30 dias' etc.). Em src/utils/painel.ts: percentualRecebido(recebidoCents, esperadoCents), que devolve inteiro de 0 a 100 com aritmética inteira, ou null quando esperado = 0; alturasDasBarras(valores, alturaMaxima), com proporção inteira e zero sem divisão por zero quando o máximo é 0; rotuloAcessivelDoMes(mes, esperado, recebido), no formato 'agosto de 2026: esperado R$ X, recebido R$ Y'; rotuloDeAtraso(dias), reaproveitando o texto de src/utils/payments.ts em vez de duplicar. Dinheiro sempre em centavos, formatado só com formatCents.

_Arquivos:_ `src/constants/painel.ts`, `src/utils/painel.ts`, `src/utils/__tests__/painel.test.ts`

**Como verificar:** 'npx jest src/utils/__tests__/painel.test.ts' passa, cobrindo esperado zero, recebido maior que esperado (limita a 100), todos os valores zero no gráfico e arredondamento sem float.

### Passo 8

Criar o serviço src/services/painel.service.ts com fetchPainelResumo(), fetchInadimplenciaFaixas(), fetchFaturamentoMensal(meses), fetchAlunosEmRisco(limite, minAulas) e fetchRelatorioInadimplencia(). Cada um chama supabase.rpc, lança o erro quando error !== null (padrão de frequency.service.ts), converte snake_case para camelCase e aplica Number() em bigint e numeric. Documentar em JSDoc que a regra vive no banco (docs/PAINEL.md) e que o app não recalcula nada.

_Arquivos:_ `src/services/painel.service.ts`, `src/services/__tests__/painel.service.test.ts`

**Como verificar:** O teste com supabase.rpc mockado confere o nome da RPC e os argumentos, o mapeamento de campos, a conversão numérica e a propagação do erro.

### Passo 9

Criar os hooks. src/hooks/useAdminDashboard.ts faz Promise.all das 4 chamadas do Painel e devolve { resumo, faixas, faturamento, emRisco, loading, error, reload }. src/hooks/useDelinquencyReport.ts devolve { linhas, totalCents, loading, error, reload } e aceita filtro de faixa em memória. Os dois seguem o padrão de useAdminPayments para loading, erro e retry, com duas diferenças: não usam useEffect de carga, porque a tela chama reload via useFocusEffect e isso evita a carga dupla que existe hoje; e mantêm os dados anteriores na tela durante o recarregamento. Log só com log.error('Falha ao carregar painel', erro), nunca com as linhas, que contêm nomes. Nada é gravado em AsyncStorage nem em cache.

_Arquivos:_ `src/hooks/useAdminDashboard.ts`, `src/hooks/useDelinquencyReport.ts`, `src/hooks/__tests__/useAdminDashboard.test.ts`, `src/hooks/__tests__/useDelinquencyReport.test.ts`

**Como verificar:** Com o serviço mockado, os testes verificam: 1 chamada por RPC por reload; erro vira mensagem amigável; o filtro de faixa reduz a lista e recalcula o total; e o logger não recebe nenhuma linha com nome.

### Passo 10

Criar os componentes visuais sem dependência nova, acionando antes a skill design-de-interface-projeto para alinhar com Identidade-Visual.md e os tokens de src/theme/colors.ts. StatTile é o rótulo mais o número em tabular-nums. RevenueBarChart tem 12 colunas de View: trilho com altura do esperado em colors.border e preenchimento com altura do recebido em colors.primary ou success, mês curto (formatMonthShort) embaixo, accessible com accessibilityLabel por coluna e um resumo acessível no container. OverdueBucketsCard mostra o total, as 3 faixas com valor e quantidade, a linha 'Contas encerradas' quando for > 0 e o botão 'Ver relatório'. DelinquentStudentRow (altura fixa para getItemLayout) mostra nome, turma, selo Inativo, 'N mensalidades · X dias de atraso' e o total em colors.error. AtRiskStudentRow mostra nome, turma e os percentuais do mês atual e do último mês, com formatarPercentual. Todos com React.memo, estilos via useMemo e área de toque ≥ 44 dp, e sem cor como único sinal: a faixa também vai escrita.

_Arquivos:_ `src/components/StatTile.tsx`, `src/components/RevenueBarChart.tsx`, `src/components/OverdueBucketsCard.tsx`, `src/components/DelinquentStudentRow.tsx`, `src/components/AtRiskStudentRow.tsx`, `src/components/__tests__/RevenueBarChart.test.tsx`, `src/components/__tests__/OverdueBucketsCard.test.tsx`, `src/components/__tests__/DelinquentStudentRow.test.tsx`

**Como verificar:** Os testes RNTL checam: gráfico com 12 colunas e rótulos acessíveis corretos; com tudo zero, renderiza sem crash e sem NaN; o card mostra as 3 faixas e esconde 'Contas encerradas' quando é 0; a linha dispara onPress com userId e nome.

### Passo 11

Criar as telas. src/screens/painel/PainelScreen.tsx usa ScrollView com RefreshControl e useFocusEffect(reload). Seções: cabeçalho com overline 'PAINEL' e chip ADMIN (mesmo estilo do AdminFinanceView); 'Alunos' (ativos, inativos, ativos sem plano, saídas no mês); 'Mês atual' (recebido / esperado com barra de progresso e percentual, mais em análise, em aberto e vencidas); 'Inadimplência' (OverdueBucketsCard); 'Faturamento — 12 meses' (RevenueBarChart com legenda); 'Frequência' (média do mês com 'de N alunos', média do último mês fechado e até 5 AtRiskStudentRow com 'Ver todos' expandindo na própria tela). Estados com ErrorState e retry, e EmptyState quando não há dados. src/screens/financeiro/RelatorioInadimplenciaScreen.tsx usa FlatList (keyExtractor, getItemLayout, removeClippedSubviews) com cabeçalho do total devido, número de alunos e SegmentedControl Todas | 1–30 | 31–60 | 60+. Tocar numa linha faz navigation.navigate('HistoricoPagamentosAluno', { userId, name }) na mesma stack, onde o admin já consegue dar baixa. No foco de volta, o relatório recarrega.

_Arquivos:_ `src/screens/painel/PainelScreen.tsx`, `src/screens/financeiro/RelatorioInadimplenciaScreen.tsx`

**Como verificar:** 'npm run typecheck' passa. Na navegação manual (passo 14), dar baixa num aluno e voltar faz ele sumir do relatório e o total diminuir.

### Passo 12

Ligar a navegação. Em types.ts: PainelStackParamList = { PainelHome: undefined }, a entrada Painel: NavigatorScreenParams<PainelStackParamList> em MainTabParamList, RelatorioInadimplencia: undefined em FinanceiroStackParamList e o tipo PainelStackScreenProps. Criar PainelStackNavigator.tsx no mesmo molde das outras stacks, com título 'Painel'. Em MainTabNavigator.tsx: TAB_ICONS.Painel = 'stats-chart-outline' (existe no glyphmap do Ionicons instalado) e '{isAdmin && <Tab.Screen name="Painel" …/>}' registrado primeiro, com comentário [#55] explicando que a rota nem existe para professor ou aluno. Em FinanceiroStackNavigator.tsx: Stack.Screen RelatorioInadimplencia com título 'Inadimplência'. Em AdminFinanceView.tsx: botão secundário 'Inadimplência' ao lado de 'Histórico por aluno'. Navegação entre abas a partir do Painel: navigation.navigate('Financeiro', { screen: 'RelatorioInadimplencia', initial: false }) e navigation.navigate('Aulas', { screen: 'HistoricoFrequencia', params: { userId, name }, initial: false }). O initial: false mantém a home da aba de destino por baixo, para o voltar funcionar.

_Arquivos:_ `src/navigation/types.ts`, `src/navigation/PainelStackNavigator.tsx`, `src/navigation/MainTabNavigator.tsx`, `src/navigation/FinanceiroStackNavigator.tsx`, `src/screens/financeiro/AdminFinanceView.tsx`, `src/navigation/__tests__/MainTabNavigator.test.tsx`

**Como verificar:** O teste com useAuth mockado confere que admin vê as abas Painel, Aulas, Financeiro e Dados; professor vê Aulas e Dados; aluno vê Aulas, Financeiro e Dados (sem Painel). 'npm run typecheck' passa.

### Passo 13

Rodar o gate local completo antes de qualquer commit. O Husky roda o mesmo gate, mas convém rodar antes: 'npm run typecheck && npm test'.

**Como verificar:** typecheck sem erros e jest verde, com os 324 testes atuais e os novos, sem nenhum teste antigo alterado.

### Passo 14

Validar no celular (adb Wi-Fi) contra o banco LOCAL, pelo app de dev da T1 ('DEV Snake Thai') ou pelo Metro com EXPO_PUBLIC_SUPABASE_URL apontando para o Supabase local, via 'adb reverse tcp:54321 tcp:54321' ou IP da LAN, conforme a T1. Primeiro, entrar como admin de demo e conferir cada número do Painel com SQL direto no container: 'select sum(amount_cents) filter (where status=''paid'') from payments where reference_month = date_trunc(''month'', now() at time zone ''America/Sao_Paulo'')::date' e equivalentes. Depois, abrir o relatório, filtrar por faixa, abrir o histórico e dar baixa. Em seguida, tocar num aluno em risco para abrir a frequência. Por fim, entrar como professor e como aluno de demo e confirmar que a aba Painel não aparece. Testar tema claro e escuro, fonte grande do sistema (4 rótulos de aba) e TalkBack lendo o gráfico.

**Como verificar:** Todos os números conferem com o SQL; o voltar retorna à aba e tela corretas; professor e aluno não têm a aba; o TalkBack lê 'mês: esperado R$ X, recebido R$ Y'; nada quebra em 360 dp de largura.

### Passo 15

Documentação no mesmo ciclo (protocolo do README). Em docs/FUNCIONALIDADES.md: marcar [x] no item D 'Relatório de inadimplência e faturamento' e no F 'Dashboard do admin', e atualizar o placar. Em docs/MANUAL-DO-ADMINISTRADOR.md: nova seção 'Painel' (como ler cada número, faixas, risco de evasão e como abrir o relatório e dar baixa). README.md: módulo finalizado. docs/PAINEL.md: marcar como entregue. Em REVIEW.md: nota corrigindo o item do índice em due_date, que já existia.

_Arquivos:_ `docs/FUNCIONALIDADES.md`, `docs/MANUAL-DO-ADMINISTRADOR.md`, `README.md`, `docs/PAINEL.md`, `REVIEW.md`

**Como verificar:** Os documentos citam os nomes reais das funções e telas; o placar soma corretamente; o README menciona o Painel.

### Passo 16

Commits, PR e ida para produção, só com aprovação do usuário. Commits em Conventional Commits: 'feat(banco): funcoes agregadas do painel do admin', 'test(banco): regressao do painel do admin', 'feat(painel): aba painel e relatorio de inadimplencia', 'docs: painel do admin'. Push da branch e PR para main conforme a T4. Com ordem explícita do usuário, aplicar a migration em produção pelo fluxo definido na T1 (ex.: 'npx supabase db push' ligado ao projeto de produção). A migration só acrescenta funções e um índice pequeno, e APKs antigos não são afetados. A migration vai ANTES do APK novo; se o APK chegar antes, o Painel mostra ErrorState (RPC inexistente). A regressão NÃO roda em produção. A conferência lá é somente leitura: o admin abre o Painel no celular. A versão do app sobe como minor, conforme a política da T3, e o build e a publicação seguem T2/T5.

_Arquivos:_ `supabase/migrations/<timestamp>_painel_admin.sql`, `app.json`

**Como verificar:** PR verde e mergeado; em produção, 'select proname from pg_proc where proname like ''painel_%'' or proname = ''relatorio_inadimplencia''' (rodado pelo fluxo aprovado, sem imprimir segredos) lista as 5 funções; o admin real abre o Painel sem erro e confirma os números que conhece.

## 6. Riscos

- plpgsql com RETURNS TABLE: as colunas de saída (user_id, reference_month…) viram variáveis e causam 'column reference is ambiguous' em tempo de execução, que o db reset não pega. Mitigação: '#variable_conflict use_column', aliases em tudo e a regressão chamando cada função.
- Fuso: mark_overdue_payments usa current_date em UTC (21:01 em Brasília). O relatório usa due_date < hoje em SP, então no dia do vencimento, entre 21:01 e 00:00, a aba Financeiro pode mostrar 'Vencida' enquanto o relatório ainda não mostra. Fica documentado em docs/PAINEL.md; corrigir o cron é outra tarefa.
- Regressão contaminada pelos dados já existentes no banco local (seed de demo): usar deltas, filtro pelos UUIDs das fixtures e datas em 2031, nunca valores absolutos.
- A cultura atual é rodar regressão e seed direto em produção (o cabeçalho de regressao_mensalidades.sql diz que pode). Este plano depende da T1 para ter o banco local funcionando. Hoje as portas 54321/54322 estão ocupadas pela stack do radar-tributario e o psql não está no PATH (usar docker exec).
- A frequência média fica inflada se entrarem alunos com denominador zero (a regra devolve 100%). O filtro counted_classes − justified > 0 é obrigatório e está coberto pelo T10 da regressão.
- A semântica das contas anonimizadas pode mudar com a T9 (exclusão LGPD), por exemplo se passar a cancelar as cobranças abertas. As funções devem depender só de anonymized_at, e não do nome 'Usuário removido', para continuarem certas.
- Migrations em branches paralelas (T6, T7, T9) podem colidir em ordem ou timestamp. Renomear o arquivo antes do merge e regenerar database.types.ts depois do rebase, senão entram tipos de outra branch.
- Navegação entre abas: sem initial: false, o voltar sai da aba de destino em vez de voltar à home dela, e a aba em destaque troca para Financeiro ou Aulas, o que é esperado e deve ser validado no aparelho.
- Com 4 abas e fonte grande do Android, os rótulos podem truncar. Testar com escala de fonte máxima.
- LGPD: o relatório expõe nome, turma e valor devido. É só para admin (validado no banco, não só na UI) e já protegido pelo bloqueio por digital. Não gravar em AsyncStorage (não misturar com o cache da chamada de outra tarefa), não logar linhas (o logger não mascara 'name') e não adicionar exportação CSV neste escopo.
- O AdminFinanceView atual continua baixando perfis completos com CPF e telefone só para resolver nomes (profile.service.ts:119-129). Isso fica fora do escopo da T8, mas convém registrar como melhoria (usar diretorio_perfis).
- Ordem de publicação: se o APK novo chegar antes da migration em produção, o Painel mostra erro. A migration tem de ir primeiro.
- Os IDs de dependência (T1 = separação dev/produção com banco local; T4 = pushes, PRs e merges) foram deduzidos da ordem do pedido do usuário e não foram confirmados pelo orquestrador.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T6, T7, T9:** A T1 move a stack local para as portas 553xx (API 55321, DB 55322) porque o radar-tributario ocupa as 543xx. As outras tarefas assumem as portas antigas: T7 ('API em 127.0.0.1:54321', curl em 54321), T8 ('adb reverse tcp:54321'), T9 (psql do host em 54322, vault push_project_url 'http://host.docker.internal:54321', 'supabase status mostra 54321/54322'). A T9 também usa psql no host, que não está instalado.  
  **Resolução:** Depois da T1, trocar em todos os planos para 55321/55322. Rodar SQL sempre por 'docker exec -i supabase_db_snake-thai psql' ou pelos subcomandos do scripts/db-dev. Na T9, o Vault local usa 'http://host.docker.internal:55321' ou o nome do container Kong com a porta interna 8000. Na T8, o adb reverse passa para tcp:55321.
- **Conflito com T1, T6, T7:** Não há um jeito único de rodar os testes e as seeds locais. A T1 (passo 4) roda a suíte com 'db reset --local' e só o seed.sql, sem demo. A T8 (passos 1 e 4) semeia a demo e roda as 6 regressões com os dados de demo carregados. T6 e T7 (passo 1) exigem as 6 regressões verdes como linha de base, mas regressao_c3_payment_whitelist.sql falha hoje e só a T1 (passo 4) a corrige. A T8 (passo 1) roda demo_seed.sql direto, e ele depende de contas @snake.com, turmas e plano que só o local_base.sql da T1 (passo 5) cria. A T6 (passo 11) reescreve a seção 8 do demo_seed.sql, onde a T1 (passo 5) coloca uma trava.  
  **Resolução:** T6, T7 e T8 começam só depois dos passos 2 a 5 da T1. Entrada única: 'scripts\db-dev test' para a suíte (banco limpo) e 'scripts\db-dev reset' para as seeds. Testes novos usam UUIDs próprios e deltas, para passar nos dois estados. A edição da T6 no demo_seed.sql é feita em cima da versão com a trava da T1.
- **Conflito com T1, T6, T7, T9:** A publicação em produção não segue o fluxo novo. T6 (passo 14), T7 (passo 15) e T9 (passo 18) chamam 'supabase db push' direto, sem o script com dupla confirmação da T1; a CLI está linkada à produção e 'db push' usa o projeto linkado por padrão. A T7 fixa timestamps (20260917120000, 20260917130000) enquanto as outras usam 'migration new'. Uma migration criada depois mas com timestamp menor que a última aplicada no remoto faz o 'db push' recusar, exigindo --include-all. Ninguém prevê backup antes de cada push.  
  **Resolução:** Todo push de migration em produção passa por scripts\db-push-prod.bat (T1, passo 12), antecedido por 'npx supabase db dump --linked' para fora do repositório, feito pelo usuário. Os timestamps são gerados ('migration new' ou renomeação) no rebase final, logo antes do merge de cada tarefa, na ordem de integração T7 → T6 → T8 → T9. Nunca usar --include-all em produção sem revisão.
- **Conflito com T1, T3, T6, T9:** Várias tarefas esbarram no 'Esquece o CI' (não adicionar testes ao CI). A T1 altera o ci.yml, só a porta do psql (necessário porque o job lê o config.toml). As regressões novas de T6, T8 e T9 em supabase/tests/ passam a rodar sozinhas no job 'banco'. Os testes Jest de T2, T3, T10 e T11 rodam no job de testes. Só a T9 levanta essa questão.  
  **Resolução:** Decisão única do usuário, aplicada a todas as tarefas. Recomendação: aceitar que testes nas pastas existentes rodem no CI atual, sem nenhum job ou passo novo, e manter a única edição do ci.yml na porta 55322. Se o usuário quiser literalmente nada novo no CI, todas as regressões novas vão para supabase/tests-local/ e o db-dev test da T1 percorre as duas pastas.
- **Conflito com T6, T7, T9, T10, T11:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Afirmação a conferir:** Decisão 5 e riscos citam 'a T9 (exclusão LGPD)' como a tarefa que pode mudar a semântica das contas anonimizadas.  
  **Por quê:** A exclusão LGPD é a T7. A T9 é notificações push. A numeração está trocada e pode levar o executor a coordenar com a tarefa errada.
- **Afirmação a conferir:** O container do banco local se chama 'supabase_db_snake-thai'.  
  **Por quê:** Só existe o volume supabase_db_snake-thai; nenhum container do projeto está rodando (docker ps -a da T1). O nome segue o padrão da CLI e é provável, mas nenhum plano confirmou. Todos os comandos 'docker exec' dependem disso.
- **Decisão consolidada (T8):** Local do Painel e critérios de inadimplência e de risco de evasão.  
  **Recomendação:** Aba 'Painel' só para admin, como primeira aba. Inadimplente = mensalidade open ou overdue com vencimento antes de hoje no fuso de São Paulo. Faixas 1-30, 31-60 e 61+ dias. Contas anonimizadas somadas numa linha agregada. Faturamento por competência, 12 meses. Risco de evasão abaixo de 50%, com mínimo de 4 aulas no mês corrente.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T8.md` escrito
