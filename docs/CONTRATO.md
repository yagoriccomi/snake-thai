# Contrato entre os projetos — Snake Thai

> **Versão:** v3 · 2026-09-24, revisada em 2026-09-25 · **Estado:** regras de negócio aprovadas
> pelo dono (§ 1), **com as perguntas P1–P22 respondidas em 25/09** (§ 16); decisões técnicas
> vetáveis (§ 2); telas aguardando a aprovação dos mockups ("Mockups Snake Thai — Horário
> livre", **versão 8**, de 25/09: menu de aulas e troca na linha G; histórico de turma, contato e aviso de atualização na linha H).
> **Nada é implementado antes do portão G0 (§ 14), exceto o APK 1.9.0 com o
> aviso de atualização (§ 12.3), que depende só da aprovação dos textos da § 12.3.**
>
> **Novo na v3:** menu de aulas (§ 12.2), troca de aula (§ 9.4), aula extra do fixo (§ 9.5),
> contato da academia (§ 5.4), aviso de atualização do app (§ 12.3), guarda dos anexos em
> 180 dias (§ 8) e média do Painel sem teto (§ 11.6). **Na revisão de 25/09:** extra em
> qualquer aula (D56), abono da troca com a aula nova cancelada (D57, T50) e **histórico de
> turma** (D58, `student_group_periods`, § 5.2).
>
> **Caminho absoluto** (para os chats de outros repositórios):
> `C:\Users\USER\Desktop\GIT\academy\snake-thai\docs\CONTRATO.md`

## 0. Como usar este documento

Três chats diferentes vão trabalhar ao mesmo tempo, um por repositório:

| Repositório | Chat executa | Dono de |
| --- | --- | --- |
| `snake-thai` | [`ROADMAP.md`](../ROADMAP.md) | **O banco** (migrations, RPCs, RLS, Edge Functions) e o app Android |
| `snake-server` | `../snake-server/ROADMAP.md` | As rotas `/v1/*` e o worker de limpeza de mídia |
| `snake-web` | `../snake-web/ROADMAP.md` | A web do aluno |

**Regras:**

1. **Todo nome que cruza a fronteira de um repositório está aqui**: tabela, coluna, enum e
   valores, função SQL, RPC com parâmetros, rota HTTP com corpo, pasta de arquivo, tipo de
   notificação, rótulo de tela compartilhado. Se não está aqui, não é contrato. Cada chat
   escolhe os nomes internos do próprio código.
2. **Ninguém inventa um nome de fronteira.** Precisou de algo que não está aqui? Pare,
   registre a pendência no seu ROADMAP e peça ao usuário. Só o chat do `snake-thai` edita
   este arquivo, e só depois de o usuário aprovar a mudança.
3. **O contrato vence o código.** Se o código divergir, o código está errado.
4. **Versão:** toda mudança sobe a versão (v3 → v4) e entra no [histórico](#17-histórico).
   Cada ROADMAP diz qual versão implementa.
5. **Os portões da § 14 dizem quando um repositório pode usar o que o outro entrega.** Não
   comece a consumir algo antes de o portão abrir.

### 0.1 Regras transversais de banco (valem para TODO objeto novo ou reescrito)

1. **"Sistema"** (cron, migration, `postgres`, `service_role`):
   `(select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon'`.
   **Nunca** use só `auth.uid() is null`, que também é verdadeiro para quem chama com a chave
   pública.
2. **Toda função nova:**
   - `security definer`, `stable` quando só lê, `set search_path = ''`;
   - `revoke execute on function ... from public, anon`;
   - `grant execute` explícito: RPC de cliente para `authenticated`; interna só para
     `service_role`, ou nenhum grant.
3. **Toda tabela nova:**
   - `enable row level security`;
   - `revoke all on ... from anon, authenticated`;
   - só então os grants escritos neste contrato;
   - `grant all ... to service_role`.
4. **Variáveis de sessão `snake.*`** (`snake.aula_rpc`, `snake.chamada_rpc`, `snake.anexo_expirado`):
   - são ligadas só com `set_config('snake.<x>', 'on', true)` dentro de uma RPC `security definer`,
     imediatamente antes da escrita protegida;
   - são **desligadas (`'off'`) antes de cada `return`**, porque o `pg_graphql` roda várias
     mutations numa transação só;
   - nenhuma função exposta recebe o nome de uma variável por parâmetro;
   - **uma trava nunca libera pela ausência da variável.**
5. **`CREATE OR REPLACE` não muda o tipo de retorno nem os parâmetros.** Mudou a assinatura ou o
   retorno: `DROP` + `CREATE` + refazer os `revoke` e `grant`, na mesma migration.
6. **Valor novo de enum** (`ALTER TYPE ... ADD VALUE`): numa **migration isolada**, antes da que o
   usa.
7. **Constraint nova sobre dado existente:** crie com `NOT VALID`, confira com um `select` os
   dados antigos e só então rode `VALIDATE CONSTRAINT`.
8. **Teste de regressão SQL obrigatório** (`supabase/tests/`), com o aluno anônimo incluído:
   `POST /rest/v1/rpc/<nova>` com a chave pública precisa dar 401/42501. **Na v3, também:**
   - admin tenta mudar `academy_settings.attachment_retention_days` → `42501` (§ 5.2);
   - professor que se incluiu na aula nova **depois** do pedido de troca permanente →
     `trocas_para_decidir` vazia, `pode_decidir_troca = false` e `/v1/motivos/view-url` 403 (T49);
   - `export_my_data()` chamada como aluno com troca permanente e como aluno sem troca (§ 12.1);
   - `select` em `action_reason_attachments` com o token de um professor, de um aluno e de um
     admin, com motivos de todos os tipos, sem nenhum `42501` (§ 8);
   - **(25/09)** `update` direto de `profiles.group_id` como admin (o caminho do APK 1.8) grava
     o período em `student_group_periods` e aplica a T53; `select` em `student_group_periods`
     com o token de outro aluno volta vazio (§ 5.2). Em `regressao_frequencia_turma_e_trancamento.sql`,
     o F2 passa a esperar as aulas da turma antiga até a mudança (D58), e o F6, que grava
     `group_since` à mão, passa a montar o cenário pelos períodos (a conta não lê mais
     `group_since`, T51).

---

## 1. Decisões do dono

Numeradas para citação. **Não mudam sem o dono.** Entre parênteses, a data da decisão.

| # | Decisão |
| --- | --- |
| D1 | O plano tem **modalidade**: *horário fixo* (o sistema de hoje: aluno numa turma, esperado = aulas da turma), *horário livre* (cota semanal) ou *à vontade* (sem cota). (24/09) |
| D2 | O plano **livre** tem cota semanal. O plano **à vontade** não tem cota. (24/09) |
| D3 | Cada horário da grade (e cada aula avulsa de rotina) define o **público**: só fixos, só livres ou ambos. **O padrão é ambos.** Os alunos à vontade contam como livres. (24/09) |
| D4 | O aluno livre **vê todas as aulas que aceitam livres** e **declara** no app em quais vai. **Pode declarar além da cota**; o app só avisa. (24/09) |
| D5 | O aluno pode aparecer de surpresa: **o professor ou o admin o inclui na chamada** daquela aula. **A palavra do professor é a única confiável.** (24/09) |
| D6 | O aluno **fixo** pode ir a outra aula (de outra turma ou outro horário) ~~só se o professor o incluir~~ **quando o professor o inclui ou quando ele marca "Vou (extra)" (D51)**. Conta como presença a mais. Para **trocar** uma aula dele por outra, vale a D44. (24/09; ampliada na v3) |
| D7 | A frequência pode **passar de 100%**, sem teto. (24/09) |
| D8 | Frequência **semanal e mensal**. Mensal = presenças do mês ÷ esperado do mês **inteiro**. Exemplo do dono, plano 2x com 4 semanas (8 aulas): S1 = 3 → 150% / mês 37,5%; S2 = 1 → 50% / 50%; S3 = 0 → 0% / 50%; S4 = 4 → 200% / 100%. (24/09) |
| D9 | Os **dias de aula da semana são configuráveis pelo admin**. **Padrão: segunda a sábado.** Domingo não tem aula. (24/09) |
| D10 | **Semana Extra** (semana que atravessa dois meses): as aulas feitas preenchem a cota na ordem em que acontecem, e cada uma fica no mês em que caiu. O que faltar é **dividido pela metade entre os dois meses** (plano 2x sem ir nenhuma vez = 1 falta em cada mês). **Se sobrar uma, ela fica no mês novo**, onde o aluno ainda pode compensar. **O mês só fecha quando a Semana Extra termina.** (24/09) |
| D11 | **Abono tira 1 aula do esperado**, para fixo e para livre. (24/09) |
| D12 | Justificativa do **fixo** é anexada à aula perdida e abona aquela aula. Justificativa do **livre** é **por semana**: cada aprovada devolve **uma** aula (para duas aulas, duas justificativas). (24/09) |
| D13 | **Prazo para justificar: 7 dias**, até 23:59 (SP), contados da data da aula (fixo) ou do **último dia de aula configurado da semana** (livre). (24/09) |
| D14 | A justificativa do livre pode ser decidida por **qualquer professor que deu aula naquela semana** ou por um admin. A do fixo, pelos professores da aula ou por um admin. (24/09) |
| D15 | **Quem decide precisa escrever o motivo.** A negada **não é apagada**: fica guardada. Os admins veem quem aprovou ou negou. (24/09) |
| D16 | **O aluno não sabe quem negou nem o motivo**: vê só "Negada". **Quando aprovada, vê quem aprovou.** (24/09) |
| D17 | **Retificação da chamada**: o admin retifica qualquer aula. **Qualquer professor da aula** retifica a chamada dela. **Qualquer mudança depois de salvar a chamada é retificação**, mesmo no mesmo dia. (24/09) |
| D18 | Toda retificação, todo cancelamento e toda reativação exigem **justificativa: texto obrigatório e anexos opcionais** (imagem ou PDF, vários). (24/09) |
| D19 | A retificação grava **quem editou o quê e quando**, **o valor anterior** da última edição e quem fez a chamada original. Guarda só o último estado dos valores. (24/09) |
| D20 | **Só admins veem os detalhes da retificação** (quem, quando, texto, anexos, valor anterior). O professor da aula e o aluno veem **apenas a marca de editada**. (24/09) |
| D21 | **O aluno afetado é avisado** quando a presença ou a falta dele é retificada. (24/09) |
| D22 | **Atestado é dado de saúde** (LGPD art. 11): acesso só de quem precisa, **prazo de guarda definido** e menção na Política de Privacidade, com uma nova versão e um novo aceite. **Prazo: 180 dias depois da decisão (D54).** (24/09; prazo definido na v3) |
| D23 | Na tela Aulas **sai o card de aulas atrasadas** e entra um **botão para as chamadas pendentes**. A chamada que não foi feita até **23:59 do dia da aula** fica marcada **"feita X dias depois"**. (24/09) |
| D24 | **Cancelar aula**: os professores da aula ou um admin podem cancelar, **antes ou depois** da aula. Cancelar e reativar exigem justificativa (D18). (24/09) |
| D25 | Cancelamento **antes** da aula avisa **na hora**: os **fixos ativos da turma** (se a aula aceita fixos), **todos os livres e à vontade ativos** (se a aula aceita livres), os outros professores da aula e os admins. Quem cancelou não é avisado. Cancelamento **depois** da aula avisa só os professores da aula e os admins. **O aviso de cancelamento toca sempre na hora**, mesmo no silêncio das 22h às 7h. (24/09) · *v3: "fixos da turma" passa a ser "fixos com a aula na grade", o que inclui quem veio por troca ou marcou extra (T42).* |
| D26 | Aula cancelada: o **fixo tem a aula abonada**, e o total do mês diminui. O **livre não é afetado**, exceto quando já tinha marcado aquela aula antes do cancelamento ou quando foi a uma aula cancelada depois. **Ninguém se inclui em aula cancelada.** Ela **não some da grade**: aparece riscada e com aviso. (24/09) |
| D27 | Na chamada, **quem a faz confirma a presença dos outros professores** da aula e pode **acrescentar um professor que não estava previsto** e foi dar a aula. (24/09) |
| D28 | O professor que **ficou sem presença** na chamada **pede ao admin** a retificação, com uma justificativa como a do aluno; o admin aprova ou nega. (24/09) |
| D29 | **Área de solicitações**, para professores e admins, separada por categoria: **Faltas de alunos**, **Faltas de professores**, **Retificação de chamadas**, **Trocas de aula** e **Pagamentos de mensalidade**. Cada item é um link para o lugar certo de aprovar ou recusar. (24/09; "Trocas de aula" entrou na v3) |
| D30 | Em **Retificação de chamadas** entram: (a) o **aluno** dizendo "eu estava na aula"; (b) o **professor** pedindo ao admin para **corrigir a chamada de outro professor** por erro, ou para **se incluir numa aula** que deu sem estar vinculado; (c) o **aviso ao admin** de cada retificação feita, só para conferir, sem aprovar. (24/09) |
| D31 | **Perfil do professor**, **visível só para o admin**: aulas esperadas no mês, aulas dadas, aulas canceladas e o histórico de aulas, **como o do aluno**. (24/09) |
| D32 | **Perfil detalhado do aluno**: frequência, histórico de aulas e financeiro. **O professor vê todos os alunos**, sem mensalidades e sem dados de contato (CPF, telefone, nascimento). (24/09) |
| D33 | **Admins são professores com privilégios extras.** O admin pode dar aula, mas não é obrigado. (24/09) |
| D34 | **A web acompanha o app em tudo que o aluno faz**: declarar e desmarcar aulas (com o aviso de acima da cota); frequência semanal e mensal (Semana extra e "Fecha em"); aula cancelada riscada; meta do à vontade; justificativa por aula ou por semana **com anexo** e o reenvio; "Eu estava na aula"; o acompanhamento de justificativas e solicitações; e o histórico de aulas. **Na v3, também:** o **menu de escolher aulas** (D43), a **troca de aula** com justificativa e anexos (D44), a **aula extra** (D51) e o **contato da academia** (D52). (24/09; ampliada na v3) |
| D35 | **À vontade:** a frequência é só a vontade do aluno. Ele cadastra uma **meta de aulas por semana** para acompanhar, e ela **não entra em risco de evasão nem em alerta de frequência baixa**. (24/09) |
| D36 | **A meta padrão é 4x por semana**, como incentivo (4 de 6 dias ≈ 67%). (24/09) |
| D37 | **A conta usa a meta declarada antes de a semana começar.** Mudar no meio da semana **registra o valor para a semana seguinte**, e a da semana atual permanece. **Prazo: 23:59 de domingo.** (24/09) |
| D38 | **Sem meta nova, repete-se a da semana anterior.** (24/09) |
| D39 | O aluno à vontade **não precisa justificar falta**: a falta só afeta a meta dele. (24/09) |
| D40 | O aluno à vontade **pode pedir a inclusão** numa aula cuja chamada saiu errada ("eu estava na aula"), para alguém aprovar, **como os outros alunos**. (24/09) |
| D41 | **Aula cancelada que o aluno à vontade tinha marcado não afeta a meta dele.** (24/09) |
| D42 | **Justificativa negada:** o aluno tem **mais 7 dias depois da negativa** para reenviar uma nova justificativa. **Se a nova também for negada**, ele é avisado de que, **para mais informações, deve procurar o professor responsável pela aula ou a administração da academia**, com o **contato da academia** na tela (D52). (24/09; contato na v3) |
| D43 | **Menu de escolher aulas:** o aluno livre e o à vontade escolhem as aulas da semana num menu, a grade da semana (seg–sáb) por dia. **O aluno de horário fixo vê o mesmo menu.** (24/09) |
| D44 | **Troca de aula (fixo):** pelo menu, o fixo pede a troca de **uma** aula dele por outra aula. Dois tipos: **só nesta semana** (vale só naquela semana; **sem limite de quantidade**; **não exige** justificativa) e **permanente** (exige **justificativa escrita** e aceita **anexos**, imagem ou arquivo). (24/09) |
| D45 | **Quem decide a troca:** qualquer **professor da aula nova** ou um **admin** aprova ou nega. (24/09) |
| D46 | **Quando pedir a troca só nesta semana:** antes da aula original **e também depois de faltar** (reposição). A aula nova tem de ser na **mesma semana**. Se a troca for aprovada e ele for, **a falta da original some**. (24/09) · *25/09: com a aula nova cancelada pela academia, a falta da original também não conta (D57).* |
| D47 | **Destino da troca:** qualquer aula, **inclusive as de público "só livres"**. (24/09) |
| D48 | **Pedido sem resposta até a aula nova começar:** o aluno aparece na chamada da aula nova como **"Troca pendente"**. **Marcar presença aprova a troca.** Se a chamada for concluída **sem a presença dele**, a troca **expira** e vale a aula original. (24/09) |
| D49 | **A troca permanente vale a partir da próxima aula depois da aprovação** (pode ser no meio da semana): a grade fixa dele muda dali em diante; **o passado não muda**. (24/09) |
| D50 | **Avisos da troca decidida:** o **aluno** (sempre, aprovada ou negada), os **professores da aula antiga** e os **professores da aula nova**; os **admins só na permanente**. Vale D16: o aluno não sabe quem negou (vê só "Negada") e pode ver quem aprovou. (24/09) |
| D51 | **Aula extra do fixo:** o fixo **pode marcar "Vou"** numa aula que não é a dele, como **extra, sem aprovação**. A presença conta **acima de 100%**; **não ir não vira falta**. O professor continua podendo incluí-lo na chamada (D5, D6). (24/09) · *25/09: em qualquer público, inclusive "só livres" (D56).* |
| D52 | **Contato da academia:** campo em Configurações da academia (admin) com **WhatsApp e/ou e-mail**. Aparece **(a)** em **todo pedido negado** (troca, "Eu estava na aula", pedidos de professor); **(b)** na **justificativa negada pela 2ª vez** (D42); **(c)** em **Perfil › "Falar com a academia"**. **Não aparece na tela de login.** (24/09) |
| D53 | **Aviso de atualização:** quando uma versão nova do app é publicada (release do GitHub), o app mostra ao abrir, **uma vez por dia até o usuário atualizar**, que a versão atual **pode apresentar mal funcionamento**, recomendando atualizar, com o link do APK novo. **O APK DEV não mostra.** (24/09) |
| D54 | **Guarda dos anexos** (atestados e anexos de motivo): **180 dias depois da decisão**. A decisão fica guardada para sempre; só o arquivo é apagado. (24/09) |
| D55 | **A média de frequência do Painel não tem teto de 100% por aluno** (pode passar de 100%). Veta a parte da T10 que limitava. (24/09) |
| D56 | **A aula extra do fixo (D51) vale em qualquer aula de rotina, inclusive as de público "só livres"**, como o destino da troca (D47). Veta a parte da T40 que restringia a extra às aulas que aceitam fixos. (25/09, P1) |
| D57 | **Troca avulsa já aprovada (inclusive a reposição) e a academia cancela a aula nova: vira abono.** O cancelamento é da academia: a aula nova é abonada como qualquer aula cancelada do fixo (D26) e **a falta da aula original não conta**. Veta a exceção da reposição na T39. (25/09, P18) |
| D58 | **Histórico de turma:** quando o admin muda o aluno de turma, **a frequência conta as aulas da turma antiga até o momento da mudança e as da turma nova a partir dele**, como a grade da troca permanente (D49): **o passado não muda e o mês não recomeça**. O aluno aparece na chamada da turma em que estava na data da aula, e o perfil do aluno mostra a turma de cada período do mês. Substitui o "recomeço do mês" da correção do PR #31, que continua valendo numa parte: as aulas da turma nova **anteriores** à mudança nunca viram falta. (25/09, P10: "Sim, nesta rodada") |

> Na v3, o dono também **confirmou T21 e T30** (§ 2) e decidiu o **contato da academia** (D52),
> fechando as pendências da v2 (§ 16). **Em 25/09**, respondeu às perguntas P1–P22 (§ 16): D56,
> D57 e D58, a **T41 confirmada** (P2) e as demais escolhas **valendo sem veto**.

## 2. Decisões técnicas (tomadas na montagem do contrato — o dono pode vetar)

| # | Decisão | Por quê |
| --- | --- | --- |
| T2 | **Semana de segunda a domingo** (calendário, SP); `week_end` é sempre o domingo. **O mês de cada semana** sai só dos dias de aula configurados dela: todos em M → é semana de M; nenhum em M → fica fora de M; parte em M1 e parte em M2 → é **Semana Extra**. **Presença em dia não configurado conta normalmente**, no mês da data dela na Semana Extra e no mês da semana nos outros casos. | Cobre a virada de mês em que só um lado tem aula, e nunca descarta presença registrada (D5). |
| T3 | **Modalidade e cota valem para a semana inteira**: são as do `plan_periods` aberto às 00:00 (SP) do **primeiro dia de aula** da semana. Troca feita a partir desse momento vale na semana seguinte. Sem plano nesse momento, vale o primeiro plano que começou dentro da semana, com a cota proporcional (T8). | Evita semana com duas cotas e o aluno novo com 166% por falta de esperado. |
| T4 | **Plano com histórico** (qualquer linha em `plan_periods`) **não muda de modalidade nem de cota e não é apagado.** Para mudar, crie outro plano e mova os alunos. | Mudar o plano reescreveria a frequência passada. |
| T5 | **Aluno sem plano conta como fixo.** | Mantém o comportamento de hoje. |
| T6 | **O livre pode ter turma, mas ela não conta para o esperado.** O fixo sem turma continua permitido (esperado 0). | Não quebra cadastros existentes. |
| T7 | **Horário ou aula "só livres" pode não ter turma.** Os de fixos ou de ambos continuam exigindo turma. | Uma aula só para livres não pertence a turma nenhuma. |
| T8 | **Trancamento vira histórico** (`inactive_periods`). Reativar deixa de fazer as aulas trancadas voltarem a contar. Cota proporcional = ⌊cota × (dias de aula configurados da semana em que o aluno esteve ativo em algum momento do dia) ÷ (dias de aula configurados da semana)⌋. | Corrige um defeito atual: reativar apaga a data do trancamento. |
| T9 | **Mensal e semanal usam o esperado INTEIRO** do período (D8). **Presença só conta em aula com chamada concluída** (`attendance_taken_at` não nulo). Com esperado 0, o percentual é **nulo** e a tela mostra "—". | Um só modelo de conta para as duas modalidades. |
| T10 | **Risco de evasão usa o ritmo:** presenças ÷ esperado **até agora** < 70%, com esperado até agora ≥ 4, **ou** último mês fechado < 70%. ~~A média do Painel limita cada aluno a 100%~~ **Vetado pelo dono em 24/09 (D55): a média do Painel é a média simples, sem teto por aluno, e o rótulo "limitada a 100%" não existe.** **O à vontade fica fora dos dois** (D35). | Com o mensal cumulativo, todo aluno pareceria em risco no começo do mês. |
| T11 | **Livre ou à vontade que declarou e não veio** aparece na chamada, e sem marcação fica **sem registro** (não vira falta). O **fixo** sem marcação continua virando falta **nas aulas da grade dele (T33)**; na **extra** (D51) e na **troca pendente** (D48), sem marcação fica sem registro. | A falta do livre não tem efeito na conta; gravar "falta" seria dizer algo falso. |
| T12 | O professor **pode incluir qualquer aluno ativo** em qualquer aula não cancelada, e a presença conta para ele (D5, D6). O público da aula restringe só o que o **livre** vê e declara. **O fixo marca extra e troca em qualquer público** (D47, D56). | "A palavra do professor é a única confiável." |
| T13 | **Chamadas pendentes:** todas as aulas de rotina passadas, sem chamada e não canceladas, **de qualquer mês**, com 1 h de tolerância. Eventos ficam de fora. | Hoje a pendência some na virada do mês. |
| T14 | **"Feita X dias depois"** = diferença, em dias de calendário no fuso de SP, entre a data da aula e a da **primeira** conclusão. Aparece só com X > 0. `attendance_taken_at` nunca é reescrito (§ 6). | Dado confiável, sem coluna nova. |
| T15 | **O motivo de cada retificação fica guardado**, porque ele justifica as linhas que mudou. Os valores guardam só o anterior e o atual (D19). | Um motivo novo não pode apagar a justificativa de uma linha que outra pessoa mudou antes. |
| T16 | **Uma linha de justificativa por aula e por aluno** (fixo), com **duas tentativas** (D42): o reenvio usa a mesma linha, e a primeira tentativa negada vai para um arquivo só do admin. | Mantém o `unique (class_id, user_id)` e não quebra o APK 1.8.0 nem a web atual. |
| T17 | **Justificativa semanal:** no máximo **`cota_W`** linhas por semana, **contando as negadas**, e `week_start` nunca no futuro. O abono aplicado nunca passa do que faltou para cumprir a cota. | Senão, justificar sem faltar inflaria a frequência e daria para reenviar sem fim. |
| T18 | **"Professor que deu aula na semana"** (D14) = professor com **presença confirmada** numa aula não cancelada da semana. Sem nenhum, só o admin decide. | Só quem a chamada registrou; incluir-se numa aula futura não dá acesso a atestado. |
| T19 | **Solicitações aceitam anexos** pelo mesmo fluxo dos motivos (§ 8). **Uma por tipo, aula e pessoa**, sem reenvio (a regra D42 é só das justificativas). Prazo: 7 dias depois da aula. | O dono pediu a falta do professor "como a justificativa do aluno", que tem anexo. |
| T20 | **Falta de professor (D28)** tem duas formas: "eu estava na aula" (vira presença) e "justificar ausência" (abona a aula no esperado do professor). | "Uma justificativa como do aluno" cobre as duas. |
| T21 | **Motivo do cancelamento:** os professores da aula e os admins veem o texto e os anexos. **O aluno vê só "Cancelada".** | O professor da aula pode cancelar e reativar, então precisa saber por quê. É diferente de D20. **Confirmada pelo dono (24/09).** |
| T22 | **Reativar avisa as pessoas da D25 e da T42, calculadas no momento da reativação** (antes ou depois da aula, como no cancelamento), menos quem reativou, mas **respeita o silêncio** (22h–7h). Quem tinha troca **para** a aula cancelada por aquele cancelamento não entra: a troca não volta (§ 6.1). **(25/09)** A troca que aquele cancelamento **aprovou pelo sistema** (T50) volta a pendente **antes** do cálculo, e o aluno entra (troca pendente para a aula, T42); quem tem troca aprovada para ela entra (a aula voltou à grade dele). | O dono decidiu furar o silêncio só no cancelamento. Avisar "Aula confirmada de novo" a quem não está mais na lista faria o aluno ir contando com uma troca que já acabou. |
| T23 | **Aula cancelada depois de acontecer:** as presenças dela não contam, e o livre ou à vontade que foi ou tinha marcado recebe o abono. A chamada fica guardada e volta se a aula for reativada. | Nada se perde; reativar desfaz o efeito. |
| T24 | **Admin só entra numa aula se tiver cor.** Sem cor, o app pede a cor antes. Promover professor→admin **mantém** a cor. | O trilho de cor das aulas depende disso. |
| T25 | **Anexos:** até **5 por motivo**; até 10 MB cada; JPG, PNG, WEBP, HEIC ou PDF (conferido no cliente e, **na v3, também na assinatura do upload**: `allowed_formats`, § 13.1). **Sem Cloudinary** (API ausente ou `uploadUrl` com `PREENCHER` no DEV), o anexo fica **indisponível** e **nunca** vai para o Storage. O texto continua obrigatório e suficiente. | Mesmo padrão da justificativa de hoje. |
| T26 | **Declarar só até o início da aula.** Depois disso, só o professor inclui. Não é possível declarar duas aulas no mesmo horário. | A declaração é intenção; depois da aula vale a chamada. |
| T27 | **À vontade conta como "livre"** para o que ele vê e declara. Sem cota, **nunca recebe o aviso de acima da cota**. | "Aulas livres (à vontade)", nas palavras do dono. |
| T28 | **Meta de 1 a 6.** O padrão (4) fica em `academy_settings.default_weekly_goal`, editável pelo admin. **O admin também define a meta** de um aluno. | O teto segue os seis dias de aula. |
| T29 | **Na conta**, a aula cancelada que o livre ou à vontade tinha marcado **sai do esperado da semana** (D26, D41). **Só as primeiras `cota_W` declarações** da semana (por `declared_at`) geram esse abono. | Evita marcar todas as aulas só para ganhar abono em qualquer cancelamento. |
| T30 | **Oferta da semana (livre e à vontade):** o esperado da semana nunca passa do número de aulas que aceitavam livres naquela semana (**teto = mínimo entre cota/meta e oferta**). **Confirmada pelo dono (24/09).** | Semana de feriado ou academia fechada não pode virar falta. |
| T31 | **Mês fechado que muda depois** (justificativa aprovada no prazo, retificação, chamada atrasada, cancelamento ou reativação; **na v3, também troca que muda de estado** — aprovada, expirada, cancelada, de volta a aprovada **ou de volta a pendente (T50)** — **e período de troca permanente aberto, encerrado ou com o fim mudado**) **é recalculado** para os alunos afetados. O fechamento não congela um erro. **A mudança de turma (D58) não dispara o recálculo por si:** o período de turma só abre e fecha em `now()`, e o passado não muda; as trocas que ela cancela (T53) disparam como qualquer troca. | Respeita D10 ("fecha quando a Semana Extra termina") sem gravar falta que não existiu. |
| T32 | **% do professor = aulas dadas (inclusive as não previstas) ÷ (esperadas − abonadas)**, sem teto. | "Como o do aluno" (D31). |
| T33 | **Grade efetiva do fixo** = aulas de rotina da turma **em que ele estava na data da aula** (período de turma vigente, T51; público fixos ou ambos) **+** as do horário de destino de uma troca permanente vigente **−** as do horário de origem dessa troca **−** as originais de trocas avulsas aprovadas **+** os destinos delas. Só nas semanas em que ele é fixo (T3, T5) e fora de `inactive_periods` (**25/09:** o corte por `group_since` saiu; quem marca o começo é o período de turma). **Uma função interna só** (`grade_efetiva_do_fixo`, § 9.4) alimenta a conta, a chamada, a declaração, as listas do aluno e os avisos. | Se cada RPC calcular "esta aula é dele?" do seu jeito, a conta diverge da tela. |
| T34 | **Troca só nesta semana:** a original é uma aula da grade dele **que não seja destino de outra troca avulsa**; a nova é uma **aula de rotina** (nunca evento), não cancelada, **que ainda não começou**, na **mesma semana seg–dom** (T2) e sem outra aula da grade dele no mesmo `date_time`. **Reposição** = pedido feito depois do início da original, **sem presença dele nela**. | Evento nunca conta: trocar por evento viraria abono de graça. A semana é a da T2, para a conta da Semana Extra fechar. |
| T35 | **Troca avulsa pendente e a chamada:** a **primeira conclusão** da chamada da aula nova resolve a troca: presença → **aprovada** (quem fez a chamada é o aprovador); sem presença → **expirada**, e nada é gravado para ele na aula nova. Essa aprovação faz a mesma conferência de `decidir_troca_de_aula`: se ele já tem presença na original, a troca é **cancelada** (`'system'`) e a presença na aula nova conta como a mais. **Presença na aula original** com a troca ainda pendente **cancela** a troca, venha de qualquer RPC (inclusive a `salvar_chamada` do APK 1.8, § 15). Presença registrada **depois** na aula nova (retificação, inclusão ou "Eu estava na aula" aprovado) **faz a troca expirada voltar a aprovada, só se**, naquele momento, a original ainda estiver na grade efetiva dele, sem presença, sem outra troca avulsa `pending` ou `approved` com a mesma original ou a mesma aula nova e sem justificativa nem "Eu estava na aula" pendente ou aprovado nela (T38); senão, a troca continua **expirada**, a presença nova conta como a mais e nada dá erro. Retirar a presença de uma troca aprovada pela chamada a devolve a **expirada**. A troca **permanente** não passa pela chamada: espera a decisão, até o prazo da P21. | D48 literal, e a chamada continua sendo a palavra do professor. A conferência na volta impede duas trocas aprovadas saindo da mesma aula (e o `23505` do índice). A permanente muda a grade dali em diante e tem justificativa: alguém precisa lê-la. |
| T36 | **Troca aprovada é a vaga que mudou de aula:** faltar à aula nova é falta (a original não volta). O aluno **desiste** de uma troca pendente a qualquer momento, e de uma avulsa aprovada **só antes de as duas aulas começarem**. A permanente aprovada não se desfaz: para voltar, ele pede outra troca permanente. | Sem isso, aprovar e não ir apagaria a falta das duas aulas. |
| T37 | **Troca permanente = histórico de grade por horário** (`class_swap_periods`): vale para as aulas com `date_time` **depois do instante da aprovação**, dos dois lados. Na semana da aprovação o aluno pode ficar **com uma aula a mais ou a menos** (ex.: aprovada na quinta, a quarta já passou e a sexta entra). Trocar de novo uma aula que já veio de permanente **encerra** o período e abre outro a partir do horário **original** (nunca há corrente); voltar ao horário original só encerra. A aula original e a aula nova escolhidas no pedido são **só ponteiros para os horários**: as duas precisam ainda não ter começado, e a permanente **nunca é reposição**. **Período vigente** no instante t = `started_at <= t and (ended_at is null or ended_at > t)`: um período com `ended_at` no futuro ainda vale e conta como vigente em toda regra. **Um período nunca termina no passado** (`ended_at >= now()` em todo encerramento), e o período aprovado para um horário que já tem fim marcado nasce com esse fim (§ 9.4). **Não mexe em `group_id` nem no histórico de turma** (`student_group_periods`, T51): a turma continua a mesma. | D49 literal ("dali em diante; o passado não muda"). Mudar `group_id` trocaria **todas** as aulas da turma dali em diante, e não só as do horário trocado (e encerraria as próprias trocas permanentes, T53). |
| T38 | **O que não convive:** (a) troca permanente e troca avulsa ativa envolvendo uma aula **futura** de um dos dois horários (o pedido que chega depois é recusado; a reposição de uma aula que já passou é aceita); (b) troca e justificativa da mesma aula original, pendente ou aprovada; (c) troca e "Eu estava na aula" da mesma aula original. | Evita abono em dobro e semana com a conta impossível de explicar. |
| T39 | **Encerramentos automáticos** (sem aviso próprio; tabela completa na § 9.4): aula **original** cancelada ou apagada com troca avulsa pendente, ou qualquer das duas **apagada** com troca permanente pendente → troca **cancelada**; aula **nova** cancelada ou apagada com a avulsa **pendente** → T50 (original já começada: aprovada pelo sistema e abonada; senão, cancelada); aula nova cancelada ou apagada com a avulsa **aprovada** → a vaga é **abonada** (D26), **inclusive na reposição** (D57: a exceção que devolvia a falta da original saiu em 25/09); **mudança de turma** → T53 (as avulsas que saem de aula ainda por vir são canceladas, as outras seguem; períodos permanentes encerrados e permanentes pendentes canceladas); **deixar de ser fixo** (T3) → períodos encerrados no início da primeira semana não fixa (voltam a valer se a semana voltar a ser fixa antes disso) e permanentes pendentes canceladas; **trancamento** → pendentes canceladas (os períodos continuam); **fim do horário de destino** → períodos encerrados no dia seguinte ao último dia dele, **nunca com data passada** (`greatest(now(), ...)`), e permanentes pendentes canceladas; **permanente pendente sem decisão** → cancelada 30 dias depois da aula nova escolhida (P21). | Uma troca não pode sobreviver ao motivo de existir, e o aluno não pode herdar uma aula que a academia tirou da grade. O fim nunca é passado porque a D49 diz que "o passado não muda". |
| T40 | **Aula extra do fixo:** em **aula de rotina** de **qualquer público**, inclusive "só livres" (D56). **No evento**, ele marca **Vou** como qualquer aluno (§ 9.2): `origem = 'marcou'`, sem selo Extra. Recusada se ele tiver aula da grade no mesmo `date_time` (aí é troca). **"Não vou" numa aula fora da grade só limpa** a marcação; nunca grava falta. | ~~A extra não passa por aprovação, então o público continuava valendo para ela~~ **Vetado pelo dono em 25/09 (D56): o público não restringe a extra.** O evento continua sem Extra porque evento não conta na frequência (§ 11.1): marcar Vou nele não é presença a mais. |
| T41 | **Nota da decisão da troca:** obrigatória para **negar** qualquer troca e para decidir a **permanente**; opcional para **aprovar a avulsa**. A aprovação pela chamada não tem nota. A nota fica só para o admin (D16). | A avulsa é frequente e sem justificativa; exigir texto para aprovar viraria "ok". Negar sempre exige, como na D15. **Confirmada pelo dono (25/09, P2).** |
| T42 | **Avisos da troca:** o **pedido pendente** vai aos professores da aula nova (sem nenhum, aos admins) e, na **permanente**, também aos admins. **Quem decidiu não recebe o aviso da decisão.** Troca **expirada ou cancelada não gera push** (a tela mostra). No **cancelamento e na reativação de aula** (D25, T22), "fixos ativos da turma" vira **fixos com a aula na grade (T33), com troca avulsa pendente para ela ou que marcaram extra nela**, **em qualquer público** (D47, D56), **calculados no momento de cada um**; quem trocou essa aula por outra fica de fora. | D50 fala da troca decidida; o resto segue o padrão do contrato (quem cancelou não é avisado) e evita ruído, porque a avulsa não tem limite. |
| T43 | **Menu de aulas:** mostra **esta semana e a próxima** (seg–dom, T2), inclusive as aulas já passadas da semana. **Não há limite de vagas**, e o menu **não mostra ocupação**. | A troca avulsa é da mesma semana; duas semanas bastam para escolher. Vagas não existem no banco. Vetável (§ 16). |
| T44 | **Contato:** **coluna nova `contact_whatsapp`** (E.164 sem o `+`); o `contact_phone` de hoje continua sendo só "Telefone". App e web leem pela RPC `contato_da_academia()`, que não existe antes do login. Sem contato cadastrado, a tela mostra um texto de reserva (§ 5.4). | O telefone pode ser fixo e hoje é gravado sem o 55; o link `wa.me` precisa do DDI. |
| T45 | **Guarda de 180 dias:** conta da **decisão** de cada item (tabela de referência na § 8); o que ainda está pendente não expira (a troca permanente pendente tem prazo próprio: P21). O cron **apaga a linha do anexo** (ou anula o `proof_*`) com `snake.anexo_expirado = 'on'`, e o próprio gatilho de fila grava o motivo `'anexo_expirado'`. | D54 literal. Enfileirar no cron e depois apagar a linha mandaria o mesmo arquivo duas vezes para a fila. |
| T46 | **Anexos da troca permanente = os do motivo** (T25): até 5, JPG, PNG, WEBP, HEIC ou PDF, 10 MB cada. **"Arquivo" = PDF.** | Mesmo fluxo e mesmo worker; outros formatos não abrem no celular sem app extra. |
| T47 | **APK ≤ 1.8 não faz chamada de aula com troca ou extra:** `salvar_chamada` e `concluir_chamada` recusam, com *"Atualize o aplicativo para fazer a chamada desta aula."*, a aula cuja lista (§ 7.2) tem alguém com `origem` `'permanente'`, `'troca'`, `'troca_pendente'` ou `'extra'`. **A aula original de uma troca pendente não é recusada** (o aluno aparece como `'turma'`): a presença gravada nela pelo APK 1.8 **cancela** a troca, como na regra 8 da § 7.2 (§ 15). **(25/09)** Também recusam a aula cuja lista tem um fixo com `origem = 'turma'` que **hoje não está na turma da aula** (`profiles.group_id` diferente de `classes.group_id`: mudou de turma depois dela, D58). | O APK 1.8 só vê a turma **atual**: a primeira conclusão por ele expiraria as trocas pendentes e perderia as presenças que ele não enxerga, e daria falta a quem mudou de turma depois da aula sem que o professor o visse. |
| T48 | **Aviso de atualização:** no máximo **uma consulta e um aviso por dia** por aparelho, sem token; falha (sem rede, 403, 429, tempo esgotado) é silenciosa e **nunca trava a abertura**. O aviso é **só informativo**: nenhuma versão é bloqueada. | 60 consultas por hora por IP, e na Wi-Fi da academia vários celulares dividem o IP. Bloquear versão exigiria outro mecanismo. |
| T49 | **Quem decide a troca permanente, fora o admin** (D45): o professor vinculado à aula nova **antes do pedido** (`class_teachers.created_at <= class_swaps.created_at`) ou escalado no horário de destino (`class_schedule_teachers` de `to_schedule_id`, que só o admin edita). Quem se inclui na aula nova depois do pedido **não lê a justificativa nem decide** a permanente. A avulsa segue a D45 sem ressalva (não tem justificativa). | Mesmo raciocínio da T18: o professor pode se incluir em qualquer aula futura (política `class_teachers_insert_admin_or_self`), e isso não pode dar acesso a atestado (D22). |
| T50 | **Troca avulsa pendente com a aula nova cancelada ou apagada** (D57): se a aula **original ainda não começou**, a troca é **cancelada** (`'system'`) e ele volta a ter a original; se a original **já começou** (ele não foi: com presença, a troca já teria caído, T35), a troca é **aprovada pelo sistema** (`status = 'approved'`, `decided_via = 'system'`, `decided_by` nulo, sem linha em `class_swap_reviews` e sem push de aprovação: o aviso é o `aula_cancelada`, T42), e a vaga fica **abonada** como na D57. **Reativar a aula nova** devolve essa troca a `'pending'` (`decided_via` e `decided_at` nulos), e a D48 volta a valer (a chamada aprova ou expira). A troca aprovada **por decisão ou pela chamada** não muda na reativação: a aula volta à grade dele, e o abono some. "Já começou" é conferido no momento do cancelamento (ou de apagar). | A pendente é intenção, como a declaração do livre, e a D26 já abona o livre que tinha marcado a aula cancelada (T29). Quem deixou de ir à original contando com a troca não tem mais como repor, e a falta seria culpa do cancelamento, que é da academia (D57). Se a original ainda vai acontecer, nada se perde: ele vai a ela. "Aprovada pelo sistema" reaproveita a conta da D57 (a original sai, a nova cancelada abona) sem estado novo; reativar desfaz o efeito do cancelamento (T23) sem deixar aprovada uma troca que ninguém decidiu. Substitui a escolha da P9 para a original já começada. |
| T51 | **Histórico de turma** (D58): `student_group_periods` (§ 5.2) guarda cada período do aluno numa turma. A aula `c` é da turma do período se `started_at <= c.date_time and (ended_at is null or c.date_time < ended_at)`: o período vale **a partir do próprio instante**, como o `group_since` de hoje (o da troca permanente só vale depois do instante, T37). **Quem grava é o banco:** o gatilho `registrar_periodo_de_turma` em `profiles`, qualquer que seja o caminho (cadastro pela `create-student`, edição pelo app novo ou pelo APK 1.8 com `update` direto, `excluir_turma`, `anonimizar_titular`). No cadastro, o período começa no `created_at`; **na mudança, fecha o período aberto em `now()` e abre o novo em `now()`, nunca com data passada nem futura**. **"A turma dele", sem data, no contrato, é a do período aberto** (= `profiles.group_id`). `group_since` continua mantido pelo `marcar_entrada_na_turma` (e é igual ao `started_at` do período aberto) só para o APK 1.8 e o legado: **a conta, a chamada e as listas não o leem mais**. | O APK 1.8 continua mudando a turma por `update` direto (§ 15): só um gatilho garante o histórico sem depender do app. Mesmo desenho de `plan_periods` e `inactive_periods` (T8) e a mesma regra da troca permanente: o passado não muda (D49). |
| T52 | **Backfill do histórico de turma:** um período aberto por perfil com `group_id`, com `started_at = coalesce(group_since, created_at)` e `start_reason = 'backfill'`. **O que veio antes não é reconstruído.** **Início da contagem das presenças do fixo** (`feitas`, § 11.2): `created_at`, exceto para quem tem período `'backfill'` com `started_at` depois do `created_at` (mudou de turma entre 18/09 e a migration): para esses, esse `started_at`. | `group_since` é a data mais antiga em que a turma atual é certa: quem não mudou de turma desde 18/09 tem `group_since = created_at` (a migration daquele dia preencheu assim), e quem mudou depois tem o instante da mudança; começar antes faria as aulas já chamadas da turma nova virarem falta (o defeito que a correção do PR #31 tirou). Reconstruir pelo `audit_log` não é confiável (ele começa em 19/08 e não guarda a turma do cadastro) e mudaria meses que o aluno já viu, alguns fechados, contra "o passado não muda"; os backfills de `plan_periods` e `inactive_periods` seguem o mesmo critério. O início da contagem mantém o número de hoje de quem mudou entre 18/09 e a migration: sem o esperado da turma antiga, as presenças nela inflariam o mês. Da migration em diante, toda presença conta. |
| T53 | **Mudança de turma e as trocas** (D58), no gatilho `registrar_periodo_de_turma`, no instante `t` da mudança: **troca avulsa (pendente ou aprovada) cuja aula original ainda não começou → cancelada** (`'system'`: a original sai da grade dele com a mudança); **cuja original já começou → segue** (a original continua na grade pela turma antiga; a pendente continua esperando a decisão ou a chamada, D48); **períodos permanentes vigentes (T37) → encerrados em `t`** (`'group_changed'`, inclusive os que já tinham fim no futuro); **permanentes pendentes → canceladas**. Se a aula nova de uma troca que segue tiver o mesmo `date_time` de uma aula da turma nova, as duas ficam na grade e ele pode justificar a que perder (§ 9.1). | Com o histórico, a aula da turma antiga que já passou continua sendo dele: cancelar a reposição dela devolveria uma falta causada pela mudança, que é da academia (o mesmo espírito da D57). A aula futura da turma antiga deixa de ser dele, e a troca que sai dela perde o objeto. A permanente é de um horário da turma antiga ou para dentro da nova e não sobrevive à mudança (P10). Substitui a regra anterior ("avulsa aprovada cancelada se a aula nova ainda não começou"), feita quando a mudança recomeçava o mês. |

> T1 saiu: virou parte de D10. T29 foi reescrita depois de D41. **Na v3:** a média da T10 foi
> vetada (D55); T21 e T30 foram confirmadas; T11 e T12 foram ajustadas pela troca e pela extra.
> Na revisão da v3, entrou a T49, e T22, T25, T35, T37, T39, T40, T42, T45 e T47 foram ajustadas.
> **Em 25/09:** a restrição de público da T40 foi vetada (D56) e a exceção da reposição da T39
> também (D57); a T41 foi confirmada; entraram T50–T53; T12, T22, T31, T33, T37, T42 e T47
> foram ajustadas.

## 3. Glossário e rótulos de tela (app e web usam OS MESMOS textos)

| Conceito | Identificador | Rótulo na tela |
| --- | --- | --- |
| Modalidade fixa | `plan_schedule_mode = 'fixed'` | **Horário fixo** |
| Modalidade livre | `plan_schedule_mode = 'free'` | **Horário livre** |
| Modalidade à vontade | `plan_schedule_mode = 'unlimited'` | **À vontade** |
| Cota (livre) | `plans.weekly_quota` | **{n}x por semana** |
| Meta (à vontade) | `meta_da_semana` | **Meta: {n}x por semana**; frequência: **Meta da semana · {p}%** e **Meta do mês · {p}%** |
| Mudar a meta | `definir_meta_semanal` | **"Vale a partir de {seg dd/mm}. A meta desta semana continua {n}x."** |
| Público: fixos | `class_audience = 'fixed'` | selo **Fixos** |
| Público: livres | `class_audience = 'free'` | selo **Livres** |
| Público: ambos | `class_audience = 'both'` | sem selo · no formulário: **Fixos e livres** |
| Aula cancelada | `classes.cancelled_at is not null` | selo **Cancelada**, título e hora **riscados** |
| Declarar (livre e à vontade) | `declarar_aula(..., true)` | **Vou** · marcada: **Marcada** + **Desmarcar** |
| Declarar (fixo) | `declarar_aula(..., true/false)` numa aula da grade dele | **Vou** / **Não vou** |
| Acima da cota | `acima_da_cota = true` | aviso que não bloqueia: **"Você marcou {m} aulas nesta semana e seu plano é {n}x. Pode ir: fica registrado acima do plano."** + **Desfazer** |
| Frequência semanal | `frequencia_semanal` | **Semana · {p}%** e **{a} de {e}** |
| Frequência mensal | `frequencia_do_mes` | **Mês · {p}%** e **{a} de {e}** |
| Esperado zero | `frequency_percent is null` | **—** |
| Semana Extra | `semanas_do_mes.is_split = true` | **Semana extra** |
| Mês ainda aberto | `frequencia_do_mes.is_closed = false` e hoje > último dia de M | **"Fecha em {dd/mm}, quando a semana extra terminar"**. Não aparece no mês corrente comum |
| Justificativa pendente | `status = 'pending'` | **Justificativa em análise** |
| Justificativa aprovada | `status = 'approved'` | **Justificativa aprovada por {nome}** |
| Negada, 1ª vez | `status = 'rejected'`, `attempt = 1` | **Justificativa negada · você pode reenviar até {dd/mm}** |
| Negada, 2ª vez | `status = 'rejected'`, `attempt = 2` | **Justificativa negada. Para mais informações, procure o professor da aula ou a administração da academia.** + **bloco de contato** (§ 5.4) |
| Chamada atrasada | T14 | **Feita {x} dia(s) depois** |
| Chamada retificada | `attendance.edited` / `classes.attendance_edited` | selo **Editada** |
| Aluno incluído | `attendance.included` | selo **Incluído** |
| Aluno que marcou | `origem = 'marcou'` | selo **Marcou** |
| Solicitações | `caixa_de_solicitacoes` | **Solicitações**: **Faltas de alunos · Faltas de professores · Retificação de chamadas · Trocas de aula · Pagamentos de mensalidade** |
| Menu de aulas | `menu_de_aulas` (§ 12.2) | botão **Escolher aulas** (na tela Aulas) · tela **Aulas da semana** · abas **Esta semana** / **Próxima semana** · um bloco por dia de aula (`class_weekdays`) |
| Aula da grade do fixo | `origem = 'turma'` | selo **Sua aula** |
| Aula extra (fixo) | `declarar_aula(..., true)` fora da grade, em aula de rotina de **qualquer público**, inclusive "só livres" (D56; no evento é **Vou**, T40) · `origem = 'extra'` | botão **Vou (extra)** · marcada: selo **Extra** + **Desmarcar** |
| Pedir troca | `pedir_troca_de_aula` | botão **Trocar para esta** · folha **Trocar aula**: **"Qual aula sua você quer trocar por esta?"** · tipo: **Só nesta semana** / **Permanente** · botão **Pedir troca** |
| Justificativa da permanente | `criar_motivo('class_swap_evidence', null, ...)` | campo **"Por que você precisa mudar de horário?"** (obrigatório) + **Anexar arquivo** (até 5) · aviso **"A troca permanente muda a sua grade a partir da próxima aula depois da aprovação."** · horário com fim: **"Este horário termina em {dd/mm}."** |
| Troca pendente | `swap_status = 'pending'` | aula nova: selo **Troca pendente** · aula original: **"Troca pendente para {dia dd/mm hh:mm}"** · botão **Desistir da troca** |
| Troca aprovada (avulsa) | `origem = 'troca'` / `origem = 'trocou'` | aula nova: selo **Troca** + **"no lugar de {dia dd/mm hh:mm}"** · aula original: **"Trocou para {dia dd/mm hh:mm}"** |
| Troca permanente vigente | `origem = 'permanente'` | selo **Troca permanente** |
| Troca aprovada (acompanhamento) | `minhas_trocas.status = 'approved'` | **Troca aprovada por {nome}** · com `decided_via = 'system'` (T50): **Troca abonada: a aula nova foi cancelada** (sem nome) |
| Troca negada | `swap_status = 'rejected'` | **Troca negada** + **bloco de contato** (§ 5.4). Nunca mostra quem negou (D16) |
| Troca expirada | `swap_status = 'expired'` | **Troca expirada · vale a aula original** |
| Troca cancelada | `swap_status = 'cancelled'` | `swap_decided_via = 'student'` (em `minhas_trocas`, `decided_via`): **Você desistiu da troca** · senão: **Troca cancelada** (inclusive a cancelada pelo cancelamento da aula, § 6.1) |
| Reposição | `is_makeup = true` | selo **Reposição** (em **Revisar troca** e na folha **Trocar aula**, na aula original que já começou; nunca na permanente) |
| Troca na chamada | `lista_da_chamada.origem` | **Troca** · **Troca pendente** (dica: **"Marcar presença aprova a troca."**) · **Troca permanente** · **Extra** · **"Trocou para {dia dd/mm hh:mm}"** |
| Revisar troca | `decidir_troca_de_aula` | tela **Revisar troca** · botões **Aprovar** / **Negar** · campo **Motivo da decisão** (obrigatório para negar e na permanente, T41) |
| Contato da academia | `contato_da_academia` (§ 5.4) | **Falar com a academia** · botões **WhatsApp** e **E-mail** · sem contato: **"A academia ainda não cadastrou um contato. Procure a recepção."** |
| Bloco de contato (pedido negado) | § 5.4 | **"Para mais informações, fale com a academia:"** + botões **WhatsApp** / **E-mail** (só os preenchidos) |
| Configurações › CONTATO | `academy_settings` | **E-mail** · **WhatsApp** (com **+55** fixo) · **Telefone** · **Endereço** |
| Aviso de atualização | § 12.3 | título **Nova versão disponível** · botões **Baixar atualização** / **Agora não** |
| Turma por período (perfil do aluno, D58) | `perfil_do_aluno.turmas_no_mes` (§ 12) | cada período do mês, em ordem, separado por **·**: começou antes do mês e está aberto: **{turma}** (como hoje); começou antes e fechou: **{turma} até {dd/mm}**; começou no mês e está aberto: **{turma} desde {dd/mm}**; começou no mês e fechou: **{turma} de {dd/mm} a {dd/mm}**; se o último está fechado, no fim: **Sem turma desde {dd/mm}**. Ex.: **Turma Noite até 15/09 · Turma Manhã desde 15/09** (mudança em 15/09 às 10h: as aulas da Noite de 15/09 antes das 10h ainda eram dele) |
| Aviso ao mudar a turma (admin, D58) | edição do aluno, turma escolhida diferente da atual, antes de salvar | de uma turma para outra: **"A frequência continua contando as aulas da {turma atual} até agora e passa a contar as da {turma nova} a partir de agora. Trocas de aula que saem de aulas futuras e trocas permanentes deste aluno serão canceladas."** · para sem turma: **"A frequência continua contando as aulas da {turma atual} até agora. Trocas de aula que saem de aulas futuras e trocas permanentes deste aluno serão canceladas."** · de sem turma para uma turma: **"As aulas da {turma nova} passam a contar a partir de agora."** · na confirmação de **Excluir turma** com alunos: **"A frequência dos alunos continua contando as aulas desta turma até agora."** |

> **Rótulos antigos que saem:** "Justificativa recusada" (app) e "Recusada", "Aceita" e
> "Em análise" (web). **Na v3:** "(sem contato por enquanto)" e "média, limitada a 100% por
> aluno" deixam de existir. **Em 25/09:** a recusa *"Esta aula é só para alunos de horário
> livre. Para ir nela, peça a troca."* deixa de existir para o fixo (D56).

---

## 4. Papéis — admin também é professor (dono: `snake-thai`)

| Objeto | Mudança |
| --- | --- |
| `public.is_staff() returns boolean` | **NOVA.** `role in ('professor','admin')`. `security definer`, `stable`, `search_path ''`. Toda regra nova de "quem dá aula" usa `is_staff()`. |
| `public.is_professor()` | **NÃO MUDA** (só `'professor'`). |
| constraint `profiles_color_only_for_professor` | **Substituída** por `profiles_color_by_role`: `check ((role <> 'professor' or color is not null) and (role <> 'user' or color is null))`. |
| `public.enforce_class_teacher_is_professor()` | Mesmo nome. Aceita `role in ('professor','admin')` com `color is not null` (T24). Os gatilhos `trg_class_teachers_enforce_professor` e `trg_class_schedule_teachers_enforce_professor` passam a ser **`before insert or update of teacher_id`**: papel e cor só são conferidos ao criar o vínculo. |
| `public.enforce_role_change_rules()` | Na promoção professor→admin, `new.color := coalesce(new.color, old.color)`, porque o APK ≤ 1.8 manda `color: null`. Tirar a cor de um admin é outro `update`, recusado (`23514`) se ele estiver em `class_teachers` de aula futura. |
| `public.salvar_horario_da_grade` / `public.gerar_aulas_da_grade` | Aceitam e copiam equipe ativa com cor (`role in ('professor','admin')`). |
| view `public.diretorio_perfis` | Mostra a todos `role = 'professor'` **ou** `(role = 'admin' and color is not null)`. `(is_professor() and p.role='user')` vira `(is_staff() and p.role='user')`. Coluna nova **no fim**: `schedule_mode public.plan_schedule_mode` (a do aluno pelo plano atual, `'fixed'` sem plano; nula para a equipe). |
| Notificações de professor | `notificar_justificativa_pendente` e `enfileirar_avisos_aula_sem_chamada` usam `class_teachers` sem filtrar `role = 'professor'`. |
| Edge Function `create-staff` | Cor opcional para admin (válida se enviada), obrigatória para professor. |

---

## 5. Planos, perfis e configuração (dono: `snake-thai`)

### 5.1 Enums novos (podem nascer na mesma migration que os usa)

```sql
create type public.plan_schedule_mode      as enum ('fixed', 'free', 'unlimited');
create type public.class_audience          as enum ('fixed', 'free', 'both');
create type public.justification_scope     as enum ('class', 'week');
create type public.action_reason_kind      as enum
  ('roll_call_edit', 'class_cancel', 'class_reactivate', 'request_evidence',
   'class_swap_evidence');                                   -- v3: justificativa da troca permanente
create type public.roll_call_request_kind  as enum
  ('student_was_present', 'teacher_was_present', 'teacher_absence',
   'teacher_asks_edit', 'teacher_asks_inclusion');
-- v3 (§ 9.4):
create type public.class_swap_kind         as enum ('once', 'permanent');
create type public.class_swap_status       as enum
  ('pending', 'approved', 'rejected', 'expired', 'cancelled');
```

> `action_reason_kind` ainda não existe no banco: `'class_swap_evidence'` nasce no `create type`.
> Se o enum já tiver sido criado quando a v3 for implementada, o valor entra por
> `ALTER TYPE ... ADD VALUE` numa migration isolada (§ 0.1).

### 5.2 Colunas e tabelas

| Objeto | Definição | Quem escreve |
| --- | --- | --- |
| `plans.schedule_mode` | `public.plan_schedule_mode not null default 'fixed'` | admin |
| `plans.weekly_quota` | `smallint null`. Constraint `plans_cota_coerente`: `(schedule_mode in ('fixed','unlimited') and weekly_quota is null) or (schedule_mode = 'free' and weekly_quota between 1 and 6)` | admin |
| gatilho `enforce_plan_in_use_rules` | Em `plans`: recusa (`23514`) mudar `schedule_mode`/`weekly_quota` **e** o DELETE de plano referenciado por qualquer `plan_periods` (T4): *"Plano com histórico: crie outro plano e mova os alunos."* | — |
| `public.plan_periods` | `id uuid pk default gen_random_uuid()`, `user_id uuid not null → profiles on delete cascade`, `plan_id uuid not null → plans on delete restrict`, `started_at timestamptz not null`, `ended_at timestamptz null`. No máximo um aberto por aluno (índice único parcial `plan_periods_um_aberto` em `(user_id) where ended_at is null`). Mantida pelo gatilho `registrar_periodo_de_plano` em `profiles` (insert e update de `plan_id`). Backfill: um período aberto desde `created_at` para quem tem plano. | só gatilho |
| `public.inactive_periods` | `id uuid pk`, `user_id uuid not null → profiles on delete cascade`, `started_at timestamptz not null`, `ended_at timestamptz null`. Mantida pelo gatilho `registrar_periodo_inativo` em `profiles` (mudança de `status`). Backfill: aberto desde `deactivated_at` para quem está `inactive`. | só gatilho |
| `public.student_group_periods` | **25/09 (D58, T51).** O histórico de turma. `id uuid pk default gen_random_uuid()`, `user_id uuid not null → profiles on delete cascade`, `group_id text not null → groups on delete restrict` (como toda referência a turma desde o arquivamento: turma com histórico é arquivada, nunca apagada), `started_at timestamptz not null`, `start_reason text not null`, `ended_at timestamptz null`, `end_reason text null`. Constraints: `student_group_periods_inicio_valido`: `start_reason in ('signup', 'group_changed', 'backfill')`; `student_group_periods_fim_coerente`: `(ended_at is null) = (end_reason is null) and (ended_at is null or ended_at > started_at)`; `student_group_periods_motivo_valido`: `end_reason in ('group_changed', 'group_closed')`. Único parcial `student_group_periods_um_aberto` em `(user_id) where ended_at is null`; índice `student_group_periods_por_turma` em `(group_id, started_at)` (a chamada procura pela turma da aula). **Vigência na aula `c`:** `started_at <= c.date_time and (ended_at is null or c.date_time < ended_at)` (T51). Nunca é apagado (exceto na conta excluída, § 12.1, e no período desfeito antes de valer, abaixo), e **um período fechado não muda mais** (fora o `end_reason` que a `excluir_turma` ajusta na mesma transação). | só o gatilho `registrar_periodo_de_turma` (abaixo) e `excluir_turma` (só o `end_reason`, abaixo) |
| gatilho `registrar_periodo_de_turma` | **25/09.** Função e gatilho com o mesmo nome (como o `marcar_entrada_na_turma`). `after insert or update of group_id on public.profiles`, `for each row`, `security definer`, `search_path ''`, `revoke execute ... from public, anon, authenticated`. Roda **depois** do `marcar_entrada_na_turma` (que não muda e continua preenchendo `group_since`). **INSERT** com `group_id`: abre um período com `started_at = new.group_since` (= `coalesce(group_since, created_at)`) e `start_reason = 'signup'`. **UPDATE** com `group_id` diferente: fecha o período aberto com `ended_at = now()` e `end_reason = 'group_changed'` (se ele começou em `now()` ou depois, é **apagado** em vez de fechado: mudança desfeita antes de valer); se `new.group_id` não é nulo, abre outro com `started_at = now()` e `start_reason = 'group_changed'`; e aplica a **T53** às trocas do aluno. **Não depende do app:** vale para o APK 1.8, a `create-student`, `excluir_turma` e `anonimizar_titular`. | — |
| `excluir_turma` e `previa_exclusao_turma` (25/09) | **Assinaturas não mudam.** Depois de mover os alunos, `excluir_turma` troca `'group_changed'` por **`'group_closed'`** no `end_reason` dos períodos desta turma que o próprio `update` acabou de fechar (mesmo `now()`). A turma com algum `student_group_periods` passa a ser **arquivada**, nunca apagada: a condição de "apagar de vez" das duas funções ganha `and not exists (select 1 from public.student_group_periods g where g.group_id = p_group_id)`. | — |
| `public.weekly_goals` | `user_id uuid not null → profiles on delete cascade`, `effective_week_start date not null`, `goal smallint not null` (`weekly_goals_meta_valida`: 1..6), `set_by uuid null → profiles on delete set null`, `set_at timestamptz not null default now()`. **PK `(user_id, effective_week_start)`**. | só RPC |
| `academy_settings.class_weekdays` | `smallint[] not null default '{1,2,3,4,5,6}'` (0 = domingo; **padrão seg–sáb**, D9). Constraint `academy_settings_dias_de_aula_validos`: `cardinality(class_weekdays) between 1 and 7 and class_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] and public.sem_repeticao(class_weekdays)`. A função `public.sem_repeticao(smallint[])` é `sql immutable`: `select count(distinct d) = cardinality($1) from unnest($1) d`. | admin |
| `academy_settings.default_weekly_goal` | `smallint not null default 4` (`academy_settings_meta_padrao_valida`: 1..6) | admin |
| `academy_settings.attachment_retention_days` | `smallint not null default 180`, constraint `academy_settings_guarda_de_anexos_valida`: `attachment_retention_days between 30 and 3650`. **Prazo de guarda do atestado e dos anexos de motivo: 180 dias depois da decisão (D22, D54).** A data de referência de cada item está na § 8. | **ninguém pelo app:** o gatilho `trg_academy_settings_proteger_guarda_de_anexos` (`before update of attachment_retention_days`) recusa (`42501`, *"O prazo de guarda dos anexos só muda com uma nova Política de Privacidade."*) qualquer mudança de valor que não venha do sistema (§ 0.1), porque o `update` direto do admin em `academy_settings` continua liberado (grant e `academy_settings_update_admin`). Mudar exige migration **e** nova versão da Política (G5) |
| `academy_settings.contact_whatsapp` | **v3.** Ver § 5.4. | admin |
| `academy_settings.contact_email` | **Já existe**; ganha validação na v3 (§ 5.4). | admin |

**Grants e RLS (`select` para `authenticated`):**

| Tabela | Quem lê |
| --- | --- |
| `plan_periods` | o próprio aluno, `is_admin()` (**não** a equipe toda: o plano leva ao preço) |
| `inactive_periods` | o próprio aluno, `is_staff()` |
| `weekly_goals` | o próprio aluno, `is_staff()` |
| `student_group_periods` (25/09) | o próprio aluno, `is_staff()` (a turma não leva a dado sensível; o professor já vê a turma de todos, D32) |

**Escrita direta: nenhuma.** O `plans.price_cents` continua legível até a Fase B (§ 15).

**Backfill de `student_group_periods`** (T52), na mesma migration que cria a tabela, **antes** de
criar o gatilho: um período aberto para cada perfil com `group_id` não nulo, com
`started_at = coalesce(group_since, created_at)` e `start_reason = 'backfill'`. Depois, a
conferência do G1 (§ 14) precisa dar 0.

### 5.3 Meta semanal do à vontade

```sql
public.definir_meta_semanal(p_meta smallint, p_user_id uuid default null) returns jsonb
  -- {"meta": smallint, "vale_a_partir": date}
public.meta_da_semana(p_user_id uuid, p_week_start date) returns smallint
```

**`definir_meta_semanal`:**

- **Quem:** o próprio aluno (`p_user_id` nulo) ou um admin para qualquer aluno.
- **Recusa** (`23514`) quem não tem plano `'unlimited'` vigente.
- **Vale a partir de:** `date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7`.
  Até 23:59 de domingo, isso é a semana que começa no dia seguinte. A partir de segunda, a meta
  vale só para a outra semana, e a atual permanece (D37).
- **Grava ou substitui** `(user_id, vale_a_partir)`.

**`meta_da_semana`:**

- devolve o `goal` mais recente com `effective_week_start <= p_week_start` (D38);
- sem nenhum, devolve `academy_settings.default_weekly_goal` (D36).
- **Quem:** o próprio aluno, `is_staff()` e o sistema.

### 5.4 Contato da academia (D52, T44)

| Objeto | Definição | Quem escreve |
| --- | --- | --- |
| `academy_settings.contact_whatsapp` | **NOVA**, no fim da tabela (o `select('*')` do APK 1.8 não quebra). `text null`, **só dígitos, E.164 sem o `+`**. Constraint `academy_settings_whatsapp_valido`: `contact_whatsapp is null or contact_whatsapp ~ '^55[1-9][1-9][0-9]{8,9}$'` (55 + DDD + 8 ou 9 dígitos). | admin, em Configurações › CONTATO, campo **WhatsApp** com **+55** fixo na frente |
| `academy_settings.contact_email` | **Já existe.** Ganha `academy_settings_email_valido`: `contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')`. Nasce `NOT VALID`; os dados atuais são conferidos antes do `VALIDATE` (§ 0.1). | admin |
| `academy_settings.contact_phone` | **Já existe e não muda.** Continua sendo o **Telefone** (só dígitos, sem o 55) e **não** aparece em "Falar com a academia". | admin |

O cliente grava `null` no lugar de texto vazio (as duas constraints recusam `''`).

```sql
public.contato_da_academia() returns jsonb
  -- {"whatsapp": "5511912345678" | null, "email": "contato@exemplo.com" | null}
```

- **Quem chama:** qualquer `authenticated` (aluno, professor, admin). `revoke ... from public, anon`:
  a tela de login não tem como ler (D52), e o teste de regressão confere o 401/42501 (§ 0.1).
- `stable`, `security definer`, `search_path ''`.
- **App e web leem o contato só por esta RPC**, nunca por `select` em `academy_settings`.
- **Links:** WhatsApp `https://wa.me/<whatsapp>`; e-mail `mailto:<email>`. O app abre com
  `Linking.openURL` e trata a falha; a web usa um link comum.
- **Exibição do WhatsApp:** `+55 (DD) NNNNN-NNNN` (ou `NNNN-NNNN` com 8 dígitos).

**Onde aparece (lista fechada):**

| Tela | Quem vê | O quê |
| --- | --- | --- |
| Troca negada (menu, Aulas, minhas trocas) | aluno | bloco de contato |
| "Eu estava na aula" negado (`minhas_solicitacoes`, `status = 'rejected'`) | aluno | bloco de contato |
| Pedido de professor negado (`teacher_was_present`, `teacher_absence`, `teacher_asks_edit`, `teacher_asks_inclusion`) | professor | bloco de contato |
| Justificativa negada, **2ª tentativa** (§ 3) | aluno | texto da § 3 + bloco de contato |
| App: **Perfil › "Falar com a academia"** · Web: **"Falar com a academia"** no rodapé das páginas logadas (a web não tem Perfil) | todos | **Falar com a academia** + botões |

- **Não aparece:** na tela de login (app e web), antes do login, na justificativa negada pela
  1ª vez (o aluno ainda pode reenviar) nem em push (§ 10: push não leva contato).
- **Sem contato cadastrado:** o bloco dos pedidos negados mostra só a frase, sem botões; em
  "Falar com a academia", **"A academia ainda não cadastrou um contato. Procure a recepção."**

---

## 6. Aulas, grade e cancelamento (dono: `snake-thai`)

| Objeto | Definição |
| --- | --- |
| `class_schedules.audience` | `public.class_audience not null default 'both'` |
| `class_schedules.group_id` | **Passa a aceitar nulo.** Constraint `class_schedules_turma_coerente`: `audience = 'free' or group_id is not null` (T7) |
| `classes.audience` | `public.class_audience not null default 'both'`, copiada da grade |
| constraint `classes_rotina_exige_turma` | **Substituída** por `classes_rotina_turma_coerente`: `check (type <> 'routine' or audience = 'free' or group_id is not null)` |
| `classes.cancelled_at` | `timestamptz null`: é o único dado de cancelamento legível por todos (a aula aparece riscada) |
| `classes.attendance_edited` | `boolean not null default false`: a marca "Editada" |
| `public.class_audit` | `class_id uuid pk → classes on delete cascade`, `attendance_taken_by uuid null`, `attendance_edited_by uuid null`, `attendance_edited_at timestamptz null`, `cancelled_by uuid null`, `cancel_reason_id uuid null → action_reasons on delete restrict`, com todas as FKs de pessoa `→ profiles on delete set null`. **`select` só `is_admin()`**. Os professores da aula veem o motivo do cancelamento só por `motivos_da_aula` (T21). |
| gatilho `enforce_class_state_rules` | Em `classes`: `cancelled_at`, `attendance_taken_at` e `attendance_edited` só mudam dentro das RPCs (`snake.aula_rpc = 'on'`) ou pelo sistema. `attendance_taken_at` **preenchida nunca volta a nulo**. Com `attendance_taken_at` preenchida, `type`, `date_time`, `group_id` e `audience` ficam imutáveis, e o DELETE da aula é recusado (`23514`, *"Aula com chamada: cancele em vez de apagar"*). |
| `public.salvar_horario_da_grade` | **DROP + CREATE**, mesmo nome, com `p_audience public.class_audience default null`: nulo na criação vira `'both'`; nulo na edição **mantém** o público atual. Público novo propaga para as aulas futuras sem chamada, não canceladas e não desvinculadas, como o título. `p_group_id` pode ser nulo com público `'free'`. A trava de duplicidade usa `s.group_id is not distinct from p_group_id`. |
| `public.ocorrencias_da_grade` | `left join public.groups g on g.id = s.group_id`, com `where s.group_id is null or g.archived_at is null` (o horário sem turma gera aula). Mudou o retorno: DROP + CREATE (§ 0.1). |
| `gerar_aulas_da_grade`, `encerrar_horario_da_grade`, `excluir_turma` | Copiam `audience`. **Nunca apagam nem alteram aula cancelada.** |
| Fim de horário e trocas permanentes (v3, T37, T39) | `encerrar_horario_da_grade`, `excluir_turma` e `salvar_horario_da_grade` com `valid_until` novo ou mudado **encerram** os `class_swap_periods` **vigentes** (T37, inclusive os que já têm `ended_at` no futuro) com `to_schedule_id` = esse horário, com `ended_at = greatest(now(), 00:00 SP do dia seguinte ao último dia)` e `end_reason = 'schedule_ended'`, e **cancelam** as trocas permanentes pendentes que envolvem esse horário. **Um período nunca é encerrado com data passada:** hoje essas funções aceitam último dia no passado (`salvar_horario_da_grade` aceita qualquer `valid_until >= valid_from`; `encerrar_horario_da_grade`, ontem), e a grade efetiva de antes de `now()` não muda por fim de horário (D49). **Se o `valid_until` for adiado ou retirado**, os períodos com `end_reason = 'schedule_ended'` e `ended_at` ainda no futuro ganham o novo fim (ou voltam a nulo, com `end_reason` nulo). O período aprovado **depois** de o horário ganhar fim já nasce com ele (§ 9.4). Os períodos com `from_schedule_id` = esse horário continuam (não têm mais aula para tirar). Nenhuma assinatura muda por causa disso. |
| `public.trocas_permanentes_do_horario(p_schedule_id uuid)` | **NOVA (v3).** `returns table (user_id uuid, student_name text, papel text /* 'origem' \| 'destino' */, started_at timestamptz)`: os períodos **vigentes agora** (T37) que usam o horário. **Só `is_admin()`**. A tela da grade mostra, antes de encerrar ou editar: **"{n} aluno(s) têm troca permanente com este horário."** |
| `class_teachers` | `revoke select on public.class_teachers from authenticated; grant select (class_id, teacher_id, created_at) on public.class_teachers to authenticated`. **Aula cancelada:** inclusão e exclusão de `class_teachers` por `authenticated` são recusadas (`23514`); só o admin mexe. **Aula já iniciada:** só pelas RPCs de chamada (a trava deixa passar a cascata quando a aula já não existe). |

### 6.1 RPCs de cancelamento

```sql
public.cancelar_aula(p_class_id uuid, p_motivo_id uuid) returns void
public.reativar_aula(p_class_id uuid, p_motivo_id uuid) returns void
```

- **Quem:** `is_admin()` ou membro de `class_teachers` da aula; senão, `42501`. Um não-admin faz
  **no máximo 2 cancelamentos por aula** (`23514`).
- **Motivo:** `action_reasons` do tipo certo (`class_cancel` ou `class_reactivate`), da mesma aula,
  do autor = quem chama e **ainda não usado** (§ 8). A RPC grava `used_at`.
- **`cancelar_aula`:**
  - recusa aula já cancelada (`23514`);
  - grava `classes.cancelled_at` e, em `class_audit`, `cancelled_by` e `cancel_reason_id`;
  - **preserva** a chamada e as declarações (T23);
  - enfileira `aula_cancelada` (§ 10).
- **`reativar_aula`:** limpa os dois lados e enfileira `aula_reativada`. **(25/09)** Antes de
  calcular os avisos, devolve a `'pending'` (`decided_via` e `decided_at` nulos) as trocas
  avulsas `approved` com `decided_via = 'system'` e `to_class_id` = esta aula (T50).
- **Efeitos no resto do sistema:**
  - aula cancelada não aceita declaração nem chamada (`23514`, *"Aula cancelada."*);
  - sai de `chamadas_pendentes`, `aulas_sem_chamada` e dos avisos de chamada;
  - **continua** em `aulas_do_aluno` e nas listas, com `cancelled = true`;
  - dispara o recálculo dos meses fechados afetados (T31);
  - **v3:** cancela (`decided_via = 'system'`) as trocas avulsas **pendentes** em que a aula é
    a original; nas **pendentes** em que ela é a **nova**, vale a T50 (original ainda por vir:
    cancelada; original já começada: **aprovada pelo sistema**, com a vaga abonada). A troca
    **aprovada** para ela continua e a vaga fica **abonada**, **inclusive na reposição** (D57: a
    falta da original não conta), antes ou depois de a aula acontecer (T23);
  - **v3, reativação:** a troca cancelada **não** volta (na tela, **Troca cancelada**, § 3); a
    aprovada pelo sistema volta a pendente (T50); a aprovada por decisão ou pela chamada
    continua, e a aula volta à grade dele **sem o abono** (faltar a ela é falta, T36);
  - **v3:** os fixos avisados (D25, T22) são os de T42 — grade efetiva, troca pendente para a
    aula ou extra marcada —, **calculados no momento do cancelamento e, de novo, no da
    reativação**; quem trocou a aula por outra fica de fora, e quem tinha troca **para** esta aula cancelada
    por esse cancelamento não recebe `aula_reativada` (quem a tinha como aula original volta a
    tê-la na grade e recebe; quem tinha a troca aprovada, pelo sistema ou não, também recebe,
    T22).

---

## 7. Chamada, retificação e presença do professor (dono: `snake-thai`)

### 7.1 Onde cada dado mora (quem lê)

| Objeto | Definição | Quem lê direto |
| --- | --- | --- |
| `attendance.edited` | `boolean not null default false` (marca "Editada") | como hoje: o aluno lê a sua linha; a equipe da aula lê as da aula |
| `attendance.included` | `boolean not null default false` (selo "Incluído") | idem |
| `attendance.declared_at` | `timestamptz null`, carimbada pelo gatilho quando `declared_status` vira `'present'` (T29) | idem |
| `public.attendance_audit` | `attendance_id uuid pk → attendance on delete cascade`, `taken_by uuid`, `added_by uuid`, `previous_status public.attendance_status`, `edited_by uuid`, `edited_at timestamptz`, `edit_reason_id uuid → action_reasons on delete restrict`, com as pessoas `→ profiles on delete set null` | **só `is_admin()`** |
| `public.class_teacher_presence` | PK `(class_id, teacher_id)` `→ class_teachers (class_id, teacher_id) on delete cascade`, `present boolean not null`, `added_in_roll_call boolean not null default false`, `set_by uuid`, `previous boolean`, `edited_by uuid`, `edited_at timestamptz`, `edit_reason_id uuid → action_reasons on delete restrict` | **só `is_admin()`** (a equipe da aula usa `professores_da_chamada`) |

**Travas:**

- **Gatilho `enforce_attendance_rules`** (mesmo nome), agora **`before insert or update or delete`**:
  - fora das RPCs de chamada (`snake.chamada_rpc = 'on'`) ou do sistema, `status`, `edited` e
    `included` não mudam; no INSERT, `status` nasce nulo e `edited` e `included` nascem `false`;
  - linha com `status` ou `included` só é apagada pela RPC, pelo sistema ou pela cascata da aula;
  - o aluno continua mudando só `declared_status`, pelas regras de § 9.2.
- **A política `attendance_delete_admin_or_teacher` é removida.**
- **As tabelas de auditoria** só recebem escrita das RPCs.

### 7.2 RPCs

```sql
public.lista_da_chamada(p_class_id uuid) returns table (
  user_id uuid, name text, schedule_mode public.plan_schedule_mode,
  weekly_target smallint,         -- cota (livre) ou meta (à vontade) da semana; nulo para fixo
  origem text,                    -- 'turma' | 'permanente' | 'troca' | 'troca_pendente' | 'extra'
                                  -- | 'trocou' | 'marcou' | 'incluido'   (v3; ver abaixo)
  declared_status public.attendance_status, status public.attendance_status,
  edited boolean,
  previous_status public.attendance_status, edited_by_name text, edited_at timestamptz,
  taken_by_name text,             -- estes 4: SÓ admin; nulos para os demais
  justification_id uuid, justification_status public.justification_status,
  week_attended int, week_expected int, -- de frequencia_semanal; nulos para fixo
  swap_id uuid, swap_kind public.class_swap_kind, swap_status public.class_swap_status,
  swap_role text,                 -- 'origem' | 'destino': o papel DESTA aula na troca (v3)
  swap_other_date_time timestamptz -- a outra aula da troca; os 5 swap_*: só troca pendente ou aprovada
)
public.professores_da_chamada(p_class_id uuid) returns table (
  teacher_id uuid, name text, color text, scheduled boolean, present boolean,
  added_in_roll_call boolean, edited boolean
)
public.buscar_alunos_para_incluir(p_class_id uuid, p_busca text) returns table (
  user_id uuid, name text, schedule_mode public.plan_schedule_mode, group_name text
)  -- ativos fora da lista; no máximo 20
public.buscar_equipe_para_incluir(p_class_id uuid, p_busca text) returns table (
  teacher_id uuid, name text, color text
)  -- equipe ativa com cor, fora de class_teachers
public.chamadas_pendentes(p_somente_minhas boolean default true) returns table (
  class_id uuid, title text, date_time timestamptz, group_id text, group_name text,
  audience public.class_audience, dias_em_aberto int
)  -- T13; admin com p_somente_minhas=false vê todas
```

**Quem chama cada RPC:**

- **`lista_da_chamada`:** `is_staff()`.
- **`professores_da_chamada` e as duas `buscar_*`:** `is_admin()` ou membro de `class_teachers`
  da aula; senão, `42501`.
- **`p_busca`:** de 2 a 60 caracteres; `%` e `_` são tratados como texto.

**Quem entra na lista da chamada:**

- **Aula de rotina** (v3; cada aluno aparece uma vez, com a primeira `origem` que se aplica):
  - `'turma'`, `'permanente'`, `'troca'`: fixos com a aula na **grade efetiva** (T33), pela turma,
    por troca permanente vigente ou por troca avulsa aprovada. **A turma é a da data da aula
    (D58, T51):** quem mudou de turma depois dela continua na chamada da turma antiga, e quem
    entrou depois não aparece como `'turma'` na da turma nova. Se ele tiver troca avulsa
    **pendente saindo** desta aula, os `swap_*` vêm preenchidos (`swap_role = 'origem'`);
  - `'troca_pendente'`: fixos com troca avulsa **pendente** para esta aula (D48);
  - `'trocou'`: fixos que trocaram esta aula por outra, com troca avulsa **aprovada**;
  - `'extra'`: fixos que marcaram **"Vou (extra)"** (D51), em aula de qualquer público (D56);
  - `'marcou'`: livres e à vontade que declararam `present`;
  - `'incluido'`: quem já tem linha com `included = true` ou com `status` e não se encaixa acima.
- **Evento:** todos que declararam `present`, de qualquer modalidade (`origem = 'marcou'`), mais
  quem já tem linha (`'incluido'`). **Evento nunca tem `'extra'`, `'turma'` nem origem de troca**
  (T40), então a T47 não o recusa.

```sql
public.salvar_chamada_v2(
  p_class_id uuid,
  p_presentes uuid[], p_ausentes uuid[],
  p_professores_presentes uuid[], p_professores_ausentes uuid[],
  p_remover_incluidos uuid[] default '{}',
  p_motivo_id uuid default null
) returns jsonb  -- {"concluida_em": timestamptz, "retificada": boolean, "alteracoes": int}
```

**Regras de `salvar_chamada_v2`:**

1. **Quem:** `is_admin()` ou membro de `class_teachers` da aula (D17).
   - Recusa aula cancelada, de turma arquivada ou que ainda não começou.
   - Recusa (`42501`) o não-admin com `present = false` naquela aula.
2. **Lista completa obrigatória.**
   - Todo aluno com `status` ou `included` precisa estar em `p_presentes`, `p_ausentes` ou
     `p_remover_incluidos`.
   - Todo professor de `class_teachers` precisa estar numa das listas de professores.
   - Faltou alguém: `22023`, *"Lista incompleta."*
3. **Aluno fora da lista** (v3: a lista acima, com todas as origens) vira incluído
   (`included = true`, `attendance_audit.added_by`).
   **Professor fora de `class_teachers`** entra com `added_in_roll_call` (precisa ter cor).
   `p_remover_incluidos` só aceita linhas com `included = true`.
4. **Primeira conclusão** (`attendance_taken_at` nulo **e** nenhuma linha da aula com `status`):
   - não pede motivo;
   - grava `attendance_taken_at`, `class_audit.attendance_taken_by`, `attendance_audit.taken_by`
     e `class_teacher_presence.set_by`.
5. **Depois da conclusão, qualquer diferença é retificação** (D17):
   - `p_motivo_id` é obrigatório: tipo `roll_call_edit`, mesma aula, autor = quem chama, **não
     usado**. Sem ele, `22023`, *"Para retificar, informe o motivo."*
   - Em cada linha que mudou, grava `edited = true`, `previous_status`, `edited_by`, `edited_at`
     e `edit_reason_id`.
   - Grava `classes.attendance_edited` e `class_audit.attendance_edited_*`.
   - Grava `used_at` no motivo.
   - Avisa cada aluno cuja presença mudou (`chamada_retificada`, D21).
   - Dispara o recálculo do mês fechado (T31).
   - **Presença de professor só o admin retifica.** Se um não-admin mandar diferença na presença
     de professor (a própria inclusive), a resposta é `42501`, *"Presença de professor só o admin
     corrige: peça em Solicitações."* (D28).
6. **Sem nenhuma diferença:** não faz nada e não pede motivo.
7. **Sem marcação** (v3):
   - `'marcou'`, `'extra'` e `'trocou'` ficam sem registro (T11, D51);
   - `'troca_pendente'` fica sem registro e a troca **expira** (regra 8);
   - `'turma'`, `'permanente'` e `'troca'` o cliente envia em `p_ausentes` (falta).
8. **Trocas** (v3, D48, T35):
   - **Primeira conclusão**, para cada troca avulsa **pendente para esta aula**:
     - em `p_presentes` → grava a presença e **aprova** a troca (`decided_via = 'roll_call'`,
       `decided_by` = quem chama, linha em `class_swap_reviews` sem nota) e enfileira os avisos
       de aprovação (§ 10, `pela_chamada = 1`), menos para quem chama. Antes, faz a mesma
       conferência de `decidir_troca_de_aula`: se ele já tem presença na original, a troca é
       **cancelada** (`decided_via = 'system'`) e a presença aqui conta como a mais;
     - em `p_ausentes` ou sem marcação → a troca **expira** (`decided_via = 'roll_call'`) e
       **nada é gravado** para ele nesta aula.
   - `'trocou'` em `p_ausentes` é ignorado (sem registro); em `p_presentes`, a presença conta
     como a mais.
   - **Troca avulsa pendente saindo desta aula** e o aluno em `p_presentes` → a troca é
     **cancelada** (`decided_via = 'system'`): ele foi à aula original. Vale para presença
     gravada por **qualquer** RPC, na primeira conclusão ou depois, inclusive a `salvar_chamada`
     do APK 1.8 (§ 15).
   - **Depois da conclusão** (retificação ou inclusão): presença nova de quem tem troca
     `'expired'` para esta aula → a troca volta a `'approved'` (`decided_via = 'roll_call'`,
     com os avisos, `pela_chamada = 1`) **só se**, naquele momento, a original ainda estiver na
     grade efetiva dele, sem presença, sem outra troca avulsa `pending` ou `approved` com a mesma
     original ou a mesma aula nova e sem justificativa nem "Eu estava na aula" pendente ou
     aprovado nela (T35, T38). Senão, a troca continua `'expired'`, a presença conta como a mais
     (como a extra) e nada dá erro. Presença retirada de quem teve a troca aprovada **pela
     chamada** → volta a `'expired'`. A troca aprovada **por decisão** não muda com a chamada.
   - Toda troca que muda de estado dispara o recálculo do mês fechado (T31).

A compatibilidade de `salvar_chamada`, `concluir_chamada` e `aulas_sem_chamada` está em § 15.

---

## 8. Motivos e anexos (dono: `snake-thai`; rotas: `snake-server`)

| Objeto | Definição |
| --- | --- |
| `public.action_reasons` | Colunas: `id uuid pk default gen_random_uuid()`; `kind public.action_reason_kind not null`; `class_id uuid null → classes on delete cascade` (**v3:** nulo **só** em `class_swap_evidence`, constraint `action_reasons_aula_coerente`: `(kind = 'class_swap_evidence') = (class_id is null)`; a justificativa da troca pertence à troca, não a uma aula, e não pode sumir quando uma aula futura é apagada); `author_id uuid null → profiles on delete set null`, carimbado com `auth.uid()`; `body text not null` (`action_reasons_texto_valido`: `char_length(btrim(body)) between 1 and 500`); `created_at timestamptz not null default now()`; **`used_at timestamptz null`**, gravado pela RPC que consome o motivo; `audited_at timestamptz null`; `audited_by uuid null → profiles on delete set null`. |
| `public.action_reason_attachments` | Colunas: `id uuid pk`, **gerado pelo cliente** (é o `anexoId`); `reason_id uuid not null → action_reasons on delete cascade`; `uploaded_by uuid not null → profiles`, carimbado; `provider public.media_provider not null`; `public_id text not null`; `created_at timestamptz not null default now()`. Constraint `action_reason_attachments_caminho`: `public_id = 'motivos/' \|\| uploaded_by::text \|\| '/' \|\| id::text`. No máximo 5 por motivo (gatilho). |
| enum `public.media_deletion_reason` | Valores novos, **em migration isolada**: `'anexo_de_motivo_removido'` e `'anexo_expirado'`. |
| gatilho `enfileirar_exclusao_de_anexo_de_motivo` | `after delete on action_reason_attachments`. Enfileira `(provider, 'motivos/' \|\| old.uploaded_by \|\| '/' \|\| old.id, <motivo>)`, com o caminho **derivado** e **sem referência à linha apagada** (não existe FK de fila para esta tabela). **`<motivo>`** (v3, T45) = `'anexo_expirado'` quando `snake.anexo_expirado = 'on'`, senão `'anexo_de_motivo_removido'`. |
| gatilho `enfileirar_exclusao_de_anexo_justificativa` | **Já existe** (`after update or delete` em `absence_justifications`). **v3:** usa `'anexo_expirado'` quando `snake.anexo_expirado = 'on'`, senão `'justificativa_removida'`, como hoje. |
| constraint `payments_caminho_do_comprovante` | **A mesma brecha existe no comprovante.** O aluno grava `proof_*` do próprio pagamento, e a fila de exclusão copia o valor gravado. A constraint exige `(proof_public_id is null or proof_public_id = 'comprovantes/' \|\| user_id::text \|\| '/' \|\| id::text) and (proof_storage_path is null or (proof_storage_path like user_id::text \|\| '/%' and position('..' in proof_storage_path) = 0))`. Nasce `NOT VALID`; os dados antigos são conferidos antes do `VALIDATE` (§ 0.1). |

**RLS (`select`):** as políticas de `action_reasons` e de `action_reason_attachments` são uma
chamada só, `public.pode_ler_motivo(id)` e `public.pode_ler_motivo(reason_id)` (assinatura
abaixo). A expressão de uma política roda com os privilégios de quem consulta, e
`roll_call_requests` e `class_swaps` **não têm grant nem política para `authenticated`**: um
`exists (select ... from class_swaps ...)` na política daria `42501` em todo `select` de
anexo (e derrubaria o `/v1/motivos/view-url` de qualquer motivo). A função é `security
definer` e acha a solicitação ou a troca pelo `motivo_id`. Quem ela libera:

- **`roll_call_edit`:** só `is_admin()` (D20).
- **`class_cancel` e `class_reactivate`:** `is_admin()` ou membro de `class_teachers` da aula (T21).
- **`request_evidence`:**
  - o autor;
  - `is_admin()`;
  - enquanto a solicitação (`roll_call_requests.motivo_id`) estiver pendente, quem pode
    decidi-la (§ 9.3).
- **`class_swap_evidence`** (v3):
  - o autor;
  - `is_admin()`;
  - enquanto a troca que usa o motivo (`class_swaps.motivo_id`) estiver `pending`, quem
    `pode_decidir_troca` (§ 9.4, com a T49). **Depois da decisão, só o autor e o admin** (a
    justificativa pode ter dado de saúde, D22).
- **Anexos:** seguem o motivo a que pertencem.
- **Escrita direta:** nenhuma; só as RPCs abaixo.

```sql
public.criar_motivo(p_kind public.action_reason_kind, p_class_id uuid, p_texto text) returns uuid
  -- equipe: is_admin() ou membro de class_teachers (roll_call_edit/class_cancel/class_reactivate);
  -- request_evidence: quem pode abrir a solicitação (§ 9.3);
  -- class_swap_evidence (v3): só aluno (role 'user') ativo; p_class_id OBRIGATORIAMENTE nulo
  --   (22023 'Motivo de troca não leva aula.'). O resto é conferido em pedir_troca_de_aula.
public.pode_ler_motivo(p_motivo_id uuid) returns boolean
  -- v3: a regra de leitura acima, num lugar só; usada pelas políticas de action_reasons e
  -- action_reason_attachments. stable, security definer, grant execute para authenticated
  -- (a política roda como quem consulta). Motivo inexistente: false.
public.pode_anexar_ao_motivo(p_motivo_id uuid) returns boolean
  -- true só para o autor, com used_at nulo e menos de 5 anexos (o servidor consulta antes de assinar)
public.anexar_ao_motivo(p_motivo_id uuid, p_anexo_id uuid,
                        p_provider public.media_provider default 'cloudinary') returns void
  -- mesmas condições de pode_anexar_ao_motivo; grava public_id = 'motivos/<auth.uid()>/<p_anexo_id>'
public.motivos_da_aula(p_class_id uuid) returns table (
  id uuid, kind public.action_reason_kind, author_name text, created_at timestamptz,
  body text, anexos jsonb   -- [{"id": uuid, "provider": text}]
)  -- mesma visibilidade da RLS
public.marcar_retificacao_conferida(p_motivo_id uuid) returns void
  -- só admin; recusa (42501) o próprio motivo (author_id = auth.uid())
```

- **Motivo não usado há mais de 24 h** é apagado pelo cron `apagar_motivos_nao_usados()`. O
  gatilho manda os anexos para a fila.
- **Anexo expirado** (v3, D54, T45): o cron diário `enfileirar_anexos_expirados()` apaga os
  anexos cuja data de referência + `attachment_retention_days` (180) já passou. **O texto e a
  decisão ficam para sempre; só o arquivo sai.**

| Anexo | Data de referência (a "decisão") |
| --- | --- |
| Justificativa, tentativa atual (`absence_justifications.proof_*`) | `reviewed_at` |
| 1ª tentativa negada (`absence_justification_attempts.proof_*`) | `reviewed_at` da tentativa |
| `request_evidence` | `roll_call_requests.reviewed_at` |
| `class_swap_evidence` | `class_swaps.decided_at` (aprovada, negada, expirada ou cancelada, inclusive a cancelada por falta de decisão, P21) |
| `roll_call_edit`, `class_cancel`, `class_reactivate` | `used_at` (a ação é a própria decisão) |
| Qualquer item ainda **pendente** | não expira. A troca permanente pendente é **cancelada** 30 dias depois da data da aula nova escolhida (P21), e daí vale a linha de `class_swap_evidence` |

**Como o cron apaga, sem mandar o arquivo duas vezes para a fila:** liga
`snake.anexo_expirado = 'on'` (§ 0.1), **apaga** as linhas de `action_reason_attachments` e
**anula** `proof_provider`/`proof_public_id` em `absence_justifications`; os gatilhos acima
enfileiram com `'anexo_expirado'`. A tentativa 1 (`absence_justification_attempts`) não tem
gatilho: o cron enfileira direto, com `'anexo_expirado'`, e anula as colunas. Desliga a
variável antes de terminar. A regra do worker da § 13.3 (entrega do servidor no G2, **ainda
não publicada**) aceita `'anexo_expirado'` em `justificativas/` e `motivos/`.

**Troca permanente pendente sem decisão** (P21): o mesmo cron diário, **antes** de apagar os
anexos, cancela (`decided_via = 'system'`, `decided_at = now()`, sem push, T42) as trocas
permanentes `pending` cuja aula nova escolhida começou há mais de 30 dias (a aula apagada já
cancela a troca, § 9.4). O anexo segue os 180 dias a partir daí.

**Fluxo do cliente (app), sempre nesta ordem:**

1. `criar_motivo(...)`, que devolve o `motivoId`.
2. Para cada arquivo:
   1. gerar o `anexoId` (UUID v4);
   2. `POST /v1/motivos/sign-upload {motivoId, anexoId}`;
   3. enviar à Cloudinary com os campos assinados, **incluindo `overwrite=false`** e, na v3,
      **`allowed_formats`** (§ 13.1);
   4. `anexar_ao_motivo(motivoId, anexoId)`.
3. A ação que consome o motivo: `salvar_chamada_v2`, `cancelar_aula`, `reativar_aula`,
   `abrir_solicitacao` ou, na v3, `pedir_troca_de_aula` (troca permanente, § 9.4).

**Na web** (v3, D34): o mesmo fluxo, pela mesma rota `/v1/motivos/*` (o CORS do servidor é
global, § 13.4).

Se um anexo falhar, o app avisa e deixa tentar de novo ou seguir sem ele (D18).

---

## 9. Justificativas, solicitações, troca de aula e aula extra (dono: `snake-thai`)

### 9.1 `absence_justifications` (mesma tabela, ampliada)

| Mudança | Definição |
| --- | --- |
| `scope` | `public.justification_scope not null default 'class'` |
| `class_id` | **Passa a aceitar nulo.** |
| `week_start` | `date not null`. **Preenchido pelo gatilho no INSERT:** com `scope = 'class'`, a segunda-feira (SP) da data da aula, ignorando o valor enviado. É isso que mantém o upsert do APK 1.8 e da web atual funcionando. Com `scope = 'week'`, exige uma segunda-feira que não esteja no futuro (`22023`). Backfill a partir da aula. |
| constraint `absence_justifications_escopo_coerente` | `(scope = 'class' and class_id is not null) or (scope = 'week' and class_id is null)` |
| `absence_justifications_unica_por_aula` | **Continua** `unique (class_id, user_id)` (T16). |
| `attempt` | `smallint not null default 1`, com `check (attempt in (1, 2))` (D42) |
| constraint `absence_justifications_caminho_do_anexo` | `check (proof_public_id is null or proof_public_id = 'justificativas/' \|\| user_id::text \|\| '/' \|\| id::text or proof_public_id = 'justificativas/' \|\| user_id::text \|\| '/' \|\| id::text \|\| '-2' or (class_id is not null and proof_public_id = 'justificativas/' \|\| user_id::text \|\| '/' \|\| class_id::text))`, criada como `NOT VALID` (§ 0.1). |
| `public.absence_justification_reviews` | `justification_id uuid pk → absence_justifications on delete cascade`, `reviewer_id uuid → profiles on delete set null`, `review_note text not null` (1..500), `decided_at timestamptz not null`. **`select` só `is_admin()`**. **A nota nunca fica na tabela principal** (D16). |
| `public.absence_justification_attempts` | Guarda a **primeira tentativa negada** quando o aluno reenvia (D42, T16): `justification_id uuid pk → absence_justifications on delete cascade`, `message text`, `proof_provider public.media_provider`, `proof_public_id text`, `reviewer_id uuid`, `reviewed_at timestamptz`, `review_note text`. **`select` só `is_admin()`**. |
| `reviewed_by` na linha principal | **Na negativa, o gatilho grava `reviewed_by = null`**: quem negou fica só em `absence_justification_reviews` (D16). Na aprovação, fica o aprovador. |

**Gatilho `enforce_absence_justification_rules`, reescrito:**

- **(a)** deixa de exigir `declared_status = 'absent'`.
- **(b)** aplica o prazo (D13).
- **(c) `scope = 'class'`:** só para aluno fixo, em aula de rotina não cancelada **da grade
  efetiva dele** (v3, T33: turma **da data da aula**, D58, com público fixos ou ambos, troca
  permanente ou troca avulsa aprovada). **Recusa** (`23514`) a aula original de uma troca pendente ou aprovada (T38):
  *"Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova."*
- **(d) `scope = 'week'`:** só para aluno **livre**, nunca à vontade (D39), com o teto T17.
- **(e) INSERT:** só com `user_id = auth.uid()`. A política vira `absence_justifications_insert_own`,
  e todo INSERT nasce `pending`, `attempt = 1`.
- **(f) UPDATE pelo dono, enquanto pendente:** só `message`, `proof_provider` e `proof_public_id`.
  `scope`, `week_start`, `class_id`, `user_id` e `attempt` nunca mudam por UPDATE direto.
- **(g) Linha decidida:** nenhuma coluna muda por UPDATE direto, nem para o admin.
- **(h) Decisão por UPDATE direto de `status`** (APK ≤ 1.8): `22023`, *"Atualize o aplicativo para
  decidir justificativas."*
- **(i) DELETE:** só o dono, com a linha pendente. O admin não apaga justificativa decidida (D15).

**Quem lê (`select`, política reescrita):**

- o dono;
- `is_admin()`;
- **enquanto pendente**, quem `public.pode_decidir_justificativa(id)`:
  - `scope = 'class'`: membro de `class_teachers` da aula;
  - `scope = 'week'`: T18.

A função é `security definer` e `stable`, e é a mesma usada pelo gatilho e pelas RPCs. **Depois
da decisão, só o dono e o admin.** É isso que atende D22, e o `/v1/justifications/view-url`
segue essa política.

**Prazos (D13, D42):**

- **Aula:** até 23:59 (SP) do 7º dia depois da data da aula.
- **Semana:** até 23:59 (SP) do 7º dia depois do último dia de aula configurado da semana.
- **Reenvio:** até 23:59 (SP) do 7º dia depois de `reviewed_at` da primeira negativa.

```sql
public.enviar_justificativa(
  p_scope public.justification_scope, p_class_id uuid, p_week_start date, p_texto text
) returns uuid        -- p_texto OBRIGATÓRIO: btrim 1..255 (22023 'Escreva o motivo da falta.')
public.reenviar_justificativa(p_id uuid, p_texto text) returns void
  -- só o dono; só status 'rejected' com attempt = 1 e dentro do prazo de reenvio.
  -- Copia a tentativa 1 para absence_justification_attempts e volta a linha para
  -- 'pending', attempt = 2, com o texto novo e sem anexo.
public.anexar_a_justificativa(p_id uuid, p_provider public.media_provider default 'cloudinary') returns void
  -- só o dono, só pendente, sem anexo; grava proof_public_id = 'justificativas/<user_id>/<id>'
  -- (attempt 1) ou 'justificativas/<user_id>/<id>-2' (attempt 2)
public.decidir_justificativa(p_id uuid, p_decisao public.justification_status, p_nota text) returns void
  -- p_decisao em ('approved','rejected'); p_nota 1..500; só pendente; só quem
  -- pode_decidir_justificativa ou admin; grava absence_justification_reviews;
  -- avisa o aluno; dispara o recálculo do mês fechado (T31)
public.minhas_justificativas() returns table (
  id uuid, scope public.justification_scope, class_id uuid, class_title text,
  class_date_time timestamptz, week_start date, message text, has_attachment boolean,
  status public.justification_status, attempt smallint,
  approved_by_name text,        -- SÓ quando approved (D16)
  can_resend boolean, resend_until timestamptz,
  created_at timestamptz, reviewed_at timestamptz
)
public.justificativas_para_revisar() returns table (
  id uuid, scope public.justification_scope, user_id uuid, student_name text,
  class_id uuid, class_title text, class_date_time timestamptz, week_start date,
  message text, has_attachment boolean, attempt smallint, created_at timestamptz
)  -- só as pendentes que quem chama pode decidir
public.justificativas_do_aluno(p_user_id uuid default null, p_de date default null, p_ate date default null)
returns table (
  id uuid, scope public.justification_scope, user_id uuid, student_name text,
  class_id uuid, class_title text, class_date_time timestamptz, week_start date,
  status public.justification_status, attempt smallint, approved_by_name text,
  reviewed_by_name text, review_note text, first_attempt jsonb,   -- estes 3: SÓ admin
  reviewed_at timestamptz, created_at timestamptz
)  -- is_staff(); p_user_id nulo = todos (só admin)
```

**Fluxo (app e web), nesta ordem:**

1. `enviar_justificativa(...)` (ou `reenviar_justificativa(...)`).
2. Se houver arquivo:
   1. `POST /v1/justifications/sign-upload {justificationId}`;
   2. enviar à Cloudinary, com `overwrite=false`;
   3. `anexar_a_justificativa(id)`.
3. Se o anexo falhar, a justificativa fica só com o texto. Sem Cloudinary, o anexo fica
   indisponível (T25).

### 9.2 Declaração de presença

```sql
public.declarar_aula(p_class_id uuid, p_vou boolean) returns jsonb
  -- {"marcadas_na_semana": int, "cota": int|null, "acima_da_cota": boolean}
```

- **Livre e à vontade:**
  - `true` grava `declared_status = 'present'`; `false` limpa a declaração;
  - só aula com público livres ou ambos;
  - **nunca bloqueia pela cota** (D4);
  - o à vontade recebe `cota = null` e `acima_da_cota = false` (T27).
- **Fixo** (v3; sem plano conta como fixo, T5):
  - **aula da grade efetiva** (T33): `true` grava `'present'` e `false` grava `'absent'`, como
    antes;
  - **outra aula de rotina = extra** (D51, T40, § 9.5): `true` grava `'present'` (fica
    **Extra**); `false` **limpa** a declaração e nunca grava `'absent'`. **Em qualquer público,
    inclusive "só livres"** (D56, 25/09);
  - **aula com troca** (`23514`): na original de uma troca avulsa aprovada, *"Você trocou esta
    aula por outra."*; na aula nova de uma troca pendente, *"Você já pediu troca para esta
    aula."*;
  - devolve `{"marcadas_na_semana": <extras marcadas na semana, só em aula de rotina>, "cota": null, "acima_da_cota": false}`.
- **Evento** (`type = 'event'`): qualquer aluno ativo declara, sem olhar público nem turma. O
  fixo que marca **Vou** num evento **não** marca extra: na lista, `origem = 'marcou'` (§ 7.2),
  sem selo Extra (T40).
- **Recusa** (`23514`):
  - aula cancelada;
  - aula que já começou (T26);
  - outra aula declarada no mesmo `date_time` (T26);
  - **fixo, em aula de rotina fora da grade:** outra aula da grade dele no mesmo `date_time`:
    *"Você já tem aula neste horário. Para ir nesta, peça a troca."* (v3);
  - aula fora do público, **só para o livre e o à vontade** (o fixo não é recusado pelo
    público, D56).
- O **upsert direto** em `attendance.declared_status` (APK 1.8 e web atual) passa pelas mesmas
  travas no gatilho. **v3:** `'absent'` de um fixo numa aula fora da grade dele é gravado como
  nulo (o "Não vou" da web atual numa aula de outra turma só limpa), **exceto na aula original
  de uma troca avulsa aprovada**, que recusa `'present'` e `'absent'` com `23514`, *"Você trocou
  esta aula por outra."* (§ 15).

### 9.3 Solicitações (D28, D29, D30, D40)

| Objeto | Definição |
| --- | --- |
| `public.roll_call_requests` | `id uuid pk`, `kind public.roll_call_request_kind not null`, `class_id uuid not null → classes on delete cascade`, `requester_id uuid null → profiles on delete set null` (carimbado pela RPC), `subject_id uuid not null → profiles on delete cascade`, `motivo_id uuid not null → action_reasons on delete restrict` (tipo `request_evidence`: o texto e os anexos), `status public.justification_status not null default 'pending'`, `reviewed_by uuid null → profiles on delete set null`, `reviewed_at timestamptz null`, `review_note text null`, `created_at timestamptz not null default now()`. **Único `roll_call_requests_uma_por_pessoa` em `(kind, class_id, subject_id)`**, sem filtro de status (sem reenvio, T19). |
| RLS | Ligada, **sem nenhuma política nem grant para `authenticated`**. Tudo pelas RPCs. `reviewed_by` e `review_note` nunca saem para quem pediu (D16). |

**Tipos e efeitos:**

| `kind` | Quem abre | Requisitos | Quem decide | Categoria | Ao aprovar |
| --- | --- | --- | --- | --- | --- |
| `student_was_present` | aluno, **inclusive à vontade** (D40); `subject_id` = ele | aula que conta, não cancelada, **com chamada concluída**, que **aparece para ele em `aulas_do_aluno`** (§ 12; **v3:** inclusive a aula nova de uma troca avulsa `'expired'` dele; as linhas do `menu_de_aulas` que não estão em `aulas_do_aluno` não valem) e `status` dele ≠ `'present'`. **v3:** recusada na aula original de troca pendente ou aprovada (T38): *"Esta aula foi trocada."* | equipe da aula ou admin | Retificação de chamadas | o banco retifica para `present`, com um motivo `roll_call_edit` do revisor (texto = a nota). **Sem linha na chamada, inclui o aluno** (`included = true`). **v3:** se ele tinha troca `'expired'` para esta aula, vale a T35, **com a conferência dela**: a troca volta a aprovada ou, se não puder, a presença conta como a mais |
| `teacher_was_present` | professor escalado e marcado ausente; `subject_id` = ele | chamada concluída | admin | Faltas de professores | `present = true`, retificado |
| `teacher_absence` | professor escalado | — | admin | Faltas de professores | abona a aula no esperado do professor (T20) |
| `teacher_asks_edit` | professor, sobre aula em que **não** está escalado; `subject_id` = ele | chamada concluída | admin | Retificação de chamadas | só marca como resolvida. O admin retifica pela tela da chamada |
| `teacher_asks_inclusion` | professor que deu a aula **sem estar vinculado**; `subject_id` = ele | aula já começou | admin | Retificação de chamadas | entra em `class_teachers` com `added_in_roll_call = true` e `present = true` |

Prazo de todos: 7 dias depois da aula (T19).

```sql
public.abrir_solicitacao(p_kind public.roll_call_request_kind, p_class_id uuid, p_motivo_id uuid) returns uuid
public.decidir_solicitacao(p_id uuid, p_decisao public.justification_status, p_nota text) returns void
public.minhas_solicitacoes() returns table (
  id uuid, kind public.roll_call_request_kind, class_id uuid, class_title text,
  class_date_time timestamptz, status public.justification_status,
  approved_by_name text, created_at timestamptz     -- quem negou nunca aparece
)
public.caixa_de_solicitacoes() returns table (categoria text, quantidade int)
  -- 'faltas_de_alunos' | 'faltas_de_professores' | 'retificacao_de_chamadas'
  -- | 'trocas_de_aula' (v3) | 'pagamentos_de_mensalidade'
public.itens_da_solicitacao(p_categoria text) returns table (
  tipo text,  -- 'justificativa' | 'solicitacao' | 'retificacao_feita' | 'troca' (v3) | 'comprovante'
  id uuid, class_id uuid, payment_id uuid, user_id uuid, nome text,
  titulo text, quando timestamptz, criado_em timestamptz
)  -- tipo 'troca': id = class_swaps.id, class_id = a aula nova, quando = date_time da aula nova
public.solicitacoes_decididas(p_de date, p_ate date) returns table (
  id uuid, kind public.roll_call_request_kind, class_id uuid, class_title text,
  requester_name text, subject_name text, status public.justification_status,
  reviewed_by_name text, review_note text, reviewed_at timestamptz
)  -- SÓ is_admin()
```

**O que entra em cada categoria:**

| Categoria | Conteúdo | Quem vê |
| --- | --- | --- |
| `faltas_de_alunos` | justificativas pendentes que quem chama pode decidir | equipe e admin |
| `faltas_de_professores` | `teacher_was_present` e `teacher_absence` | só admin |
| `retificacao_de_chamadas` | `student_was_present` que quem chama pode decidir; `teacher_asks_edit` e `teacher_asks_inclusion` (só admin); retificações feitas e ainda não conferidas (`kind = 'roll_call_edit' and used_at is not null and audited_at is null`, só admin) | equipe e admin |
| `trocas_de_aula` (v3) | trocas `pending` que quem chama pode decidir (`pode_decidir_troca`): as da aula nova em que ele está em `class_teachers` (na permanente, só com a T49); o admin vê todas. O item leva à tela **Revisar troca** (§ 9.4) | equipe e admin |
| `pagamentos_de_mensalidade` | `payments.status = 'pending_approval'` | só admin |

A ordem das categorias na tela é a do rótulo da § 3.

### 9.4 Troca de aula (D44–D50; dono: `snake-thai`)

**Só alunos (`role = 'user'`) pedem troca**, e só nas semanas em que são fixos (T3, T5). Por
isso ninguém decide a própria troca. A troca é sempre de **uma aula** por **uma aula**.

**Tabelas.** RLS ligada nas três, **sem política nem grant para `authenticated`**: tudo passa
pelas RPCs, como em `roll_call_requests`. O APK 1.8 não conhece nenhuma delas.

| Objeto | Definição |
| --- | --- |
| `public.class_swaps` | `id uuid pk default gen_random_uuid()`; `user_id uuid not null → profiles on delete cascade` (o aluno, carimbado pela RPC); `kind public.class_swap_kind not null`; `from_class_id uuid null → classes on delete set null` (a aula original); `to_class_id uuid null → classes on delete set null` (a aula nova); `from_schedule_id uuid null → class_schedules on delete set null` e `to_schedule_id uuid null → class_schedules on delete set null` (**só na permanente**, copiados das duas aulas no pedido); `motivo_id uuid null → action_reasons on delete restrict` (**só na permanente**, tipo `class_swap_evidence`); `status public.class_swap_status not null default 'pending'`; `decided_via text null`; `decided_by uuid null → profiles on delete set null`; `decided_at timestamptz null`; `created_at timestamptz not null default now()`. |
| constraints de `class_swaps` | `class_swaps_tipo_coerente`: `(kind = 'once' and motivo_id is null and from_schedule_id is null and to_schedule_id is null) or (kind = 'permanent' and motivo_id is not null)`. `class_swaps_fim_coerente`: `(status = 'pending') = (decided_at is null) and (status = 'pending') = (decided_via is null)`. `class_swaps_via_valida`: `decided_via in ('review', 'roll_call', 'student', 'system')`. `class_swaps_aprovador_coerente`: `status = 'approved' or decided_by is null` (**na negada, quem negou fica só em `class_swap_reviews`**, D16). |
| índices de `class_swaps` | Únicos parciais: `class_swaps_uma_ativa_por_origem` em `(user_id, from_class_id) where kind = 'once' and status in ('pending', 'approved')`; `class_swaps_uma_ativa_por_destino` em `(user_id, to_class_id) where kind = 'once' and status in ('pending', 'approved')`; `class_swaps_uma_permanente_pendente` em `(user_id, from_schedule_id) where kind = 'permanent' and status = 'pending'`. Comum: `class_swaps_pendentes_por_destino` em `(to_class_id) where status = 'pending'`. |
| gatilho `cancelar_troca_de_aula_apagada` | `before update of from_class_id, to_class_id on class_swaps`. Quando a FK anula uma das aulas (a aula foi apagada), a troca `pending` vira `cancelled` (`decided_via = 'system'`, `decided_at = now()`), **exceto a avulsa cuja aula nova foi apagada com a original já começada, que vira `approved` pelo sistema** (`decided_via = 'system'`, `decided_at = now()`, T50); a `approved` continua (T39). É a **única** escrita em `class_swaps` fora das RPCs, dos gatilhos da T39 e da T53 (`registrar_periodo_de_turma`, § 5.2) e do cron diário da § 8 (P21). |
| `public.class_swap_reviews` | `swap_id uuid pk → class_swaps on delete cascade`, `reviewer_id uuid null → profiles on delete set null`, `review_note text null` (`class_swap_reviews_nota_valida`: `review_note is null or char_length(btrim(review_note)) between 1 and 500`), `decided_via text not null` (`'review'` ou `'roll_call'`), `decided_at timestamptz not null`. Guarda a **última** aprovação ou negativa (a volta de expirada para aprovada, T35, substitui a linha). **Sem grant nem política para `authenticated`**, como as outras duas: o admin lê pela `trocas_decididas`. A nota nunca fica na tabela principal (D16). |
| `public.class_swap_periods` | **O histórico da grade permanente** (T37). `id uuid pk default gen_random_uuid()`, `user_id uuid not null → profiles on delete cascade`, `swap_id uuid null → class_swaps on delete set null`, `from_schedule_id uuid not null → class_schedules on delete cascade`, `to_schedule_id uuid not null → class_schedules on delete cascade` (um horário só é apagado se nunca começou, § 6), `started_at timestamptz not null`, `ended_at timestamptz null`, `end_reason text null`. Constraints: `class_swap_periods_fim_coerente`: `(ended_at is null) = (end_reason is null) and (ended_at is null or ended_at >= started_at)`; `class_swap_periods_motivo_valido`: `end_reason in ('replaced', 'reverted', 'group_changed', 'plan_changed', 'schedule_ended')`; `class_swap_periods_horarios_diferentes`: `from_schedule_id <> to_schedule_id`. Únicos parciais: `class_swap_periods_uma_aberta_por_origem` em `(user_id, from_schedule_id) where ended_at is null` e `class_swap_periods_uma_aberta_por_destino` em `(user_id, to_schedule_id) where ended_at is null`. **Os índices só enxergam `ended_at` nulo**, e um período com `ended_at` no futuro ainda é **vigente** (T37): a regra "no máximo **um período vigente** por origem e por destino" é conferida por quem escreve, com `for update` nos períodos do aluno. **Nunca é apagado** (exceto a conta excluída, § 12.1). O `ended_at` **nunca vai para o passado**: só é gravado ou **antecipado** (nunca para antes de `now()`) enquanto ainda está no futuro; as únicas outras mudanças são o fim `'schedule_ended'` ainda no futuro, que acompanha o `valid_until` do horário (§ 6), e o fim `'plan_changed'` ainda no futuro, que volta a nulo se a semana voltar a ser fixa (tabela abaixo). Escrita: só `decidir_troca_de_aula`, as funções da grade da § 6 e os gatilhos da T39 (inclusive o `registrar_periodo_de_turma`, T53). |

**Grade efetiva do fixo (T33).** A única resposta para "esta aula é dele?":

```sql
public.grade_efetiva_do_fixo(p_user_ids uuid[], p_de timestamptz, p_ate timestamptz)
returns table (user_id uuid, class_id uuid, fonte text)   -- fonte: 'turma' | 'permanente' | 'troca'
```

- **Interna:** `security definer`, `stable`, `search_path ''`, `revoke execute ... from public,
  anon, authenticated` e nenhum grant. Só as funções do banco a chamam.
- Considera aulas de rotina (**canceladas incluídas**; quem chama filtra) com `date_time` em
  `[p_de, p_ate)`, **só nas semanas em que o aluno é fixo** (T3, T5) e fora de
  `inactive_periods`. **(25/09)** O corte `date_time ≥ coalesce(group_since, created_at)` saiu:
  o começo é o do período de turma (T51).
- **Período de troca (`class_swap_periods`) vigente para a aula `c`:** `started_at <
  c.date_time and (ended_at is null or c.date_time < ended_at)`.
  1. **`'turma'`:** existe um `student_group_periods` G do aluno com `G.group_id = c.group_id`
     **vigente na aula** (`G.started_at <= c.date_time and (G.ended_at is null or c.date_time <
     G.ended_at)`, T51: a turma **da data da aula**, D58), `c.audience in ('fixed', 'both')` e
     nenhum período de troca vigente com `from_schedule_id = c.schedule_id`;
  2. **`'permanente'`:** existe período vigente com `to_schedule_id = c.schedule_id`, com
     **qualquer público** (D47);
  3. **menos** as `from_class_id` das trocas avulsas `approved` dele;
  4. **mais** as `to_class_id` das trocas avulsas `approved` dele (`'troca'`, qualquer público).
- **Quem usa:** § 7.2, § 9.1 (c), § 9.2, esta seção, § 9.5, § 10 (T42), § 11.2, § 12 e § 15.

**Pedido:**

```sql
public.pedir_troca_de_aula(
  p_de uuid,                        -- a aula original (da grade dele)
  p_para uuid,                      -- a aula nova
  p_tipo public.class_swap_kind,    -- 'once' = Só nesta semana · 'permanent' = Permanente
  p_motivo_id uuid default null     -- obrigatório na permanente; proibido na avulsa
) returns uuid                      -- class_swaps.id
```

- Grava `pending` com `user_id = auth.uid()`. Na permanente, copia os dois `schedule_id` e grava
  `used_at` no motivo.
- Se ele tinha marcado "Vou (extra)" na aula nova, a marcação é limpa (vira o pedido).
- Enfileira `troca_pendente` (§ 10).
- **Destino:** qualquer aula de rotina, **inclusive "só livres"** (D47).

**Recusas de `pedir_troca_de_aula`** (conferidas nesta ordem):

| Vale para | Situação | Código | Mensagem |
| --- | --- | --- | --- |
| as duas | quem chama não é aluno ativo | `42501` | *"Troca de aula é só para alunos."* |
| as duas | `p_tipo` nulo | `22023` | *"Escolha o tipo da troca."* |
| as duas | uma das aulas não existe | `P0002` | *"Aula não encontrada."* |
| as duas | não é fixo na semana da aula original (T3) | `23514` | *"Troca de aula é só para alunos de horário fixo. No seu plano, é só marcar Vou na aula que quiser."* |
| as duas | a original não está na grade efetiva dele | `23514` | *"Esta aula não é sua."* |
| as duas | uma das duas é evento (T34; pergunta P20) | `23514` | *"Troca só entre aulas de rotina."* |
| as duas | a nova está cancelada | `23514` | *"Aula cancelada."* |
| as duas | a nova já começou | `23514` | *"Esta aula já começou."* |
| as duas | a nova já está na grade efetiva dele | `23514` | *"Esta aula já é sua."* |
| as duas | a nova já é destino de outra troca avulsa dele, pendente ou aprovada | `23514` | *"Você já pediu troca para esta aula."* |
| as duas | outra aula da grade dele (fora a original) no mesmo `date_time` da nova | `23514` | *"Você já tem aula neste horário."* |
| avulsa | `p_motivo_id` não nulo (pergunta P19) | `22023` | *"Troca só nesta semana não leva justificativa."* |
| avulsa | as duas em semanas (seg–dom, T2) diferentes | `23514` | *"A aula nova precisa ser na mesma semana da aula original."* |
| avulsa | a original é destino de outra troca avulsa pendente ou aprovada | `23514` | *"Esta aula já é uma troca. Desista dela para pedir outra."* |
| avulsa | a original está cancelada | `23514` | *"Esta aula foi cancelada e já está abonada."* |
| avulsa | ele tem presença na original | `23514` | *"Você já fez esta aula."* |
| avulsa | a original já tem troca avulsa pendente ou aprovada | `23514` | *"Esta aula já tem uma troca em andamento."* |
| avulsa | a original tem justificativa pendente ou aprovada (T38) | `23514` | *"Esta aula já tem justificativa."* |
| avulsa | a original tem "Eu estava na aula" pendente (T38) | `23514` | *"Esta aula tem um pedido de 'Eu estava na aula' em análise."* |
| avulsa | a original ainda não começou e há troca permanente pendente com o horário dela ou o da nova (T38) | `23514` | *"Você pediu a troca permanente deste horário. Aguarde a decisão ou desista dela."* |
| permanente | o plano aberto agora (`plan_periods` com `ended_at` nulo) não é `'fixed'` nem nulo (T5): a mudança de plano já foi feita e vale na semana seguinte (T3) | `23514` | *"Seu plano muda na próxima semana: a troca permanente não vale mais."* |
| permanente | a original já começou (a permanente não repõe falta, T37) | `23514` | *"Para a troca permanente, escolha uma aula sua que ainda não aconteceu. Para repor esta, peça a troca só nesta semana."* |
| permanente | motivo ausente, de outro tipo, de outro autor ou já usado | `22023` | *"Para a troca permanente, escreva a justificativa."* |
| permanente | uma das duas não vem da grade semanal (`schedule_id` nulo), a original é uma troca avulsa, as duas são do mesmo horário ou um dos horários já terminou | `23514` | *"Só aulas da grade semanal podem ter troca permanente. Peça a troca só nesta semana."* |
| permanente | já existe permanente pendente do mesmo horário | `23514` | *"Você já pediu a troca permanente desta aula."* |
| permanente | há troca avulsa pendente ou aprovada com uma aula **futura** de um dos dois horários (T38) | `23514` | *"Você tem uma troca só desta semana com este horário. Peça a permanente depois dela."* |

**Decisão:**

```sql
public.pode_decidir_troca(p_id uuid) returns boolean
  -- true se a troca está 'pending' e quem chama é is_admin() ou membro de class_teachers
  -- da aula NOVA (D45). Na troca PERMANENTE, para quem não é admin, só vale o vínculo com
  -- class_teachers.created_at <= class_swaps.created_at ou o professor escalado no horário de
  -- destino (class_schedule_teachers de to_schedule_id): quem se incluiu na aula nova depois
  -- do pedido não lê a justificativa nem decide (T49).
  -- stable, security definer; grant para authenticated (pode_ler_motivo, § 8, usa).
public.decidir_troca_de_aula(p_id uuid, p_decisao public.class_swap_status, p_nota text default null) returns void
```

- `p_decisao` só `'approved'` ou `'rejected'`: senão, `22023`, *"Decisão inválida."*
- Troca inexistente: `P0002`, *"Troca não encontrada."* Não `pending`: `23514`, *"Esta troca já
  foi decidida."* Sem `pode_decidir_troca`: `42501`, *"Só um professor da aula nova ou um admin
  decide esta troca."* Aula nova sem professor: só o admin decide.
- **Nota (T41):** obrigatória, de 1 a 500 caracteres, para negar e na permanente (`22023`,
  *"Escreva o motivo da decisão."*); opcional para aprovar a avulsa.
- Grava `class_swap_reviews` (`decided_via = 'review'`) e, na linha principal, `status`,
  `decided_via = 'review'`, `decided_at` e `decided_by` (**só na aprovada**, D16).
- Pode decidir **depois do início da aula nova**, enquanto a chamada dela não foi concluída
  (depois disso a avulsa não está mais pendente, T35). A permanente espera a decisão até **30
  dias depois da data da aula nova escolhida**; depois, é cancelada pelo cron da § 8 (P21).
- **Aprovar a avulsa** confere de novo que a original ainda é dele e que ele não tem presença
  nela: senão, `23514`, *"O aluno já fez a aula original: a troca não vale mais."*
- **Aprovar a permanente** (T37), com `v_agora = now()` e `for update` nos períodos do aluno:
  1. **confere de novo, pelo horário** (a aula escolhida é só ponteiro e pode já ter passado:
     isso não impede a decisão): o aluno ainda é fixo e o plano aberto é `'fixed'` ou nulo;
     `from_schedule_id` ainda é da grade dele (horário da turma sem período vigente saindo
     dele, ou destino de um período vigente); `to_schedule_id` ainda **não** é (nem da turma
     sem período saindo dele, nem destino de período vigente: senão, *"Esta aula já é sua."*,
     o que evita o `23505` de duas permanentes pendentes para o mesmo destino); nenhum dos dois
     horários tem `valid_until` antes de hoje; e a T38. Falhou: recusa (`23514`) com a mensagem
     do pedido;
  2. se a aula original veio de um período P **vigente** em `v_agora` (T37;
     `P.to_schedule_id = from_schedule_id`), encerra P com `ended_at = v_agora`, **mesmo que P
     já tivesse um `ended_at` futuro** (antecipar é permitido): se o horário novo for
     `P.from_schedule_id`, com `end_reason = 'reverted'` e **sem abrir outro**; senão, com
     `'replaced'` e abrindo um período de `P.from_schedule_id` para `to_schedule_id`;
  3. senão, abre um período de `from_schedule_id` para `to_schedule_id`;
  4. o período novo tem `started_at = v_agora` e `swap_id = p_id`. **Se `to_schedule_id` tiver
     `valid_until`, ele já nasce com `ended_at = greatest(v_agora, 00:00 SP do dia seguinte ao
     valid_until)` e `end_reason = 'schedule_ended'`** (o encerramento da § 6 rodou antes e
     não o alcança).
- Enfileira os avisos (§ 10) e dispara T31.

**Desistência:**

```sql
public.desistir_da_troca(p_id uuid) returns void
```

- Só o dono. Outra pessoa ou id inexistente: `P0002`, *"Troca não encontrada."*
- `pending` → `cancelled` (`decided_via = 'student'`).
- Avulsa `approved` → `cancelled` só se **nenhuma das duas aulas começou** (T36); senão,
  `23514`, *"Não dá mais para desistir: uma das aulas já começou."*
- Permanente `approved`: `23514`, *"Troca permanente aprovada não se desfaz. Para voltar ao
  horário antigo, peça outra troca permanente."*
- Troca terminada (`rejected`, `expired`, `cancelled`): `23514`, *"Esta troca já terminou."*
- Não gera push; os avisos ainda não enviados caem (§ 10).

**Listas** (todas `stable`, `security definer`, grant para `authenticated`, com a permissão
conferida por dentro):

```sql
public.minhas_trocas(p_de date default null, p_ate date default null) returns table (
  id uuid, kind public.class_swap_kind, status public.class_swap_status,
  decided_via text,                         -- 'review' | 'roll_call' | 'student' | 'system'
  from_class_id uuid, from_title text, from_date_time timestamptz,
  to_class_id uuid, to_title text, to_date_time timestamptz,   -- nulos se a aula foi apagada
  is_makeup boolean,                        -- reposição: pedida depois do início da original
  motivo_texto text,                        -- só na permanente: o texto que ele mesmo escreveu
  approved_by_name text,                    -- SÓ quando approved (D16); nulo com decided_via 'system' (T50)
  can_cancel boolean,
  created_at timestamptz, decided_at timestamptz
)  -- sempre do próprio aluno; filtra pela data da aula nova (com a aula nova apagada,
   -- pela created_at); p_de e p_ate nulos = as dos últimos 60 dias e as futuras;
   -- p_de = '-infinity' e p_ate = 'infinity' = TODAS (é assim que a exportação chama, § 12.1)
public.minhas_trocas_permanentes() returns table (
  from_weekday smallint, from_start_time time, from_group_name text,
  to_weekday smallint, to_start_time time, to_group_name text,   -- group_name nulo sem turma
  started_at timestamptz, ended_at timestamptz                   -- ended_at nulo = sem fim
)  -- v3: TODOS os class_swap_periods do próprio aluno (vigentes e encerrados), por started_at.
   -- Existe para a exportação (§ 12.1): class_swap_periods não tem grant para authenticated.
public.trocas_para_decidir() returns table (
  id uuid, kind public.class_swap_kind, user_id uuid, student_name text,
  from_class_id uuid, from_title text, from_date_time timestamptz, from_group_name text,
  from_status public.attendance_status,     -- a marcação dele na original (reposição)
  to_class_id uuid, to_title text, to_date_time timestamptz, to_group_name text,
  to_schedule_ends_on date,                 -- permanente: último dia do horário novo, se houver
  is_makeup boolean,
  motivo_id uuid, motivo_texto text, anexos jsonb,   -- só permanente; [{"id": uuid, "provider": text}]
  created_at timestamptz
)  -- só as pendentes com pode_decidir_troca; mais antigas primeiro
public.trocas_decididas(p_de date, p_ate date) returns table (
  id uuid, kind public.class_swap_kind, user_id uuid, student_name text,
  from_class_id uuid, from_date_time timestamptz, to_class_id uuid, to_date_time timestamptz,
  status public.class_swap_status, decided_via text,
  reviewer_name text, review_note text, decided_at timestamptz
)  -- SÓ is_admin() (D15: o admin vê quem aprovou ou negou); pelo decided_at
```

`is_makeup` = a aula original começou antes de `created_at` (sempre `false` na permanente,
que recusa original já começada). Os anexos abrem pelo
`/v1/motivos/view-url` (§ 13.1), com a RLS da § 8.

**Encerramentos automáticos (T39):**

| Evento | Avulsa pendente | Avulsa aprovada | Permanente pendente | Período vigente (T37) |
| --- | --- | --- | --- | --- |
| Aula **original** cancelada (`cancelar_aula`) | cancelada (a original fica abonada, D26) | segue; a vaga está na aula nova (sem abono) | segue | segue |
| Aula **nova** cancelada (`cancelar_aula`), antes ou depois de acontecer | original ainda por vir: cancelada (ele volta à original); original já começada: **aprovada pelo sistema**, e a vaga é abonada (T50) | segue; a aula nova cancelada é **abonada** (D26) e a falta da original não conta, **inclusive na reposição** (D57) | segue | segue |
| Aula nova **reativada** (`reativar_aula`) | — (a troca cancelada não volta) | a aprovada pelo sistema (T50) volta a `'pending'`; a aprovada por decisão ou pela chamada segue, e a aula volta à grade **sem o abono** | — | — |
| Aula **original** apagada (a FK anula) | cancelada | segue; sem a original, nada a tirar | cancelada | segue |
| Aula **nova** apagada (a FK anula) | como na aula nova cancelada (T50): cancelada ou, com a original já começada, aprovada pelo sistema e a vaga some da conta | segue; sem a aula nova, a vaga some da conta | cancelada | segue |
| **Presença na original** pela chamada (qualquer RPC, inclusive a `salvar_chamada` legada, § 15) | cancelada (T35) | segue; a presença conta a mais | segue | — |
| **Mudança de turma** (gatilho `registrar_periodo_de_turma`, T53) | cancelada se a **original** ainda não começou; senão, segue | idem | cancelada | encerrado no instante da mudança (`'group_changed'`), inclusive o que já tinha fim no futuro |
| **Deixa de ser fixo** (gatilho `registrar_periodo_de_plano`, T3) | cancelada se a semana dela deixa de ser fixa | idem | cancelada (e o pedido novo é recusado enquanto a mudança estiver marcada, § 9.4) | encerrado às 00:00 (SP) do 1º dia de aula da 1ª semana não fixa (`'plan_changed'`, `greatest(now(), ...)`); **se o plano voltar a fixo antes desse instante**, o gatilho devolve a nulo os períodos com `'plan_changed'` ainda no futuro |
| **Trancamento** (gatilho `registrar_periodo_inativo`) | cancelada | segue (as aulas trancadas já não contam) | cancelada | segue (vale de novo ao reativar) |
| **Fim do horário** (§ 6) | — | — | cancelada, se envolve o horário | encerrado se o horário é o de destino (`'schedule_ended'`, nunca com data passada); o aprovado depois já nasce com o fim |
| **Permanente pendente sem decisão** 30 dias depois da aula nova escolhida (cron da § 8, P21) | — | — | cancelada | — |
| **Conta excluída** (`anonimizar_titular`) | apagada | apagada | apagada | apagado (§ 12.1) |

Todos com `decided_via = 'system'` (a volta a pendente na reativação limpa `decided_via` e
`decided_at`); nenhum gera push próprio (T42); os que mudam a conta disparam T31.

**Na chamada:** § 7.2 (origens `'troca'`, `'troca_pendente'`, `'trocou'` e `'permanente'`;
regras 7 e 8).

**Fluxo do cliente (app e web, D34):**

- **Só nesta semana:** `pedir_troca_de_aula(de, para, 'once')`.
- **Permanente:**
  1. `criar_motivo('class_swap_evidence', null, texto)`, que devolve o `motivoId`;
  2. os anexos pelo fluxo da § 8 (`/v1/motivos/sign-upload`, Cloudinary, `anexar_ao_motivo`);
     se um falhar, avisa e deixa tentar de novo ou seguir sem ele;
  3. `pedir_troca_de_aula(de, para, 'permanent', motivoId)`.
- **No servidor, nada muda para a troca:** `pode_anexar_ao_motivo` já responde pelo autor, e a
  pasta continua `motivos/<uid>/<id>`. As duas mudanças da v3 no servidor (`allowed_formats` e
  o worker, § 13) valem para todo anexo.

### 9.5 Aula extra do fixo (D51, T40)

Não tem tabela nem RPC própria: é a declaração da § 9.2 numa aula **fora da grade efetiva**
(T33).

| Tema | Regra |
| --- | --- |
| Marcar | `declarar_aula(aula, true)`: grava `declared_status = 'present'` e `declared_at`. **Sem aprovação.** Só em **aula de rotina**, de **qualquer público, inclusive "só livres"** (D56), não cancelada, que não começou e sem aula da grade dele no mesmo `date_time`. O evento segue a § 9.2, sem selo Extra (`origem = 'marcou'`). |
| Desmarcar | `declarar_aula(aula, false)`: limpa. Nunca grava falta. |
| Na chamada | `origem = 'extra'`, selo **Extra**. Presente → presença. Sem marcação → sem registro (T11). |
| Na conta (§ 11.2) | **Não entra no esperado.** A presença entra em "feitas": conta **acima de 100%** (D7). Faltar não conta. |
| Extra cancelada | Não muda a conta (não estava no esperado). Ele recebe o aviso de cancelamento (T42). |
| Extra × troca | **Extra:** a aula dele continua e ele vai a mais uma, sem pedir. **Troca:** a aula dele sai e a nova entra, com aprovação; faltar à nova é falta. No mesmo horário da aula dele, só troca. |
| Inclusão pelo professor | Continua (D5, D6, T12): o fixo incluído numa aula fora da grade conta presença a mais, como na extra. |
| Pedir troca para uma aula marcada como extra | A marcação é limpa e vira o pedido (§ 9.4). |

---

## 10. Notificações (dono: `snake-thai`)

**Valores novos em `public.notification_kind`** (migration **isolada**):

`'aula_cancelada'`, `'aula_reativada'`, `'justificativa_aprovada'`, `'justificativa_negada'`,
`'chamada_retificada'`, `'solicitacao_pendente'` e, **na v3**, `'troca_pendente'`,
`'troca_aprovada'`, `'troca_negada'`, `'troca_aprovada_equipe'`

**Sem coluna nova na fila (v3):** `enfileirar_notificacao` e `notification_outbox` não mudam.
Nos tipos de troca, o `class_id` da linha é a aula citada no texto, e o id da troca vai **na
chave** (`<tipo>:<swap_id>`), de onde a obsolescência o lê. A `send-push` continua montando o
`data` do push só com `tipo` e os ids de hoje.

| Tipo | Para quem | Chave | Título / corpo (`send-push/mensagens.ts`) | Canal |
| --- | --- | --- | --- | --- |
| `aula_cancelada` | D25: alunos pelo público e pela situação (**v3:** os fixos da T42); equipe da aula e admins; quem cancelou fica de fora | alunos: `aula_cancelada:<class_id>` · equipe: `aula_cancelada:<class_id>:<ms>` | "Aula cancelada" / "`<descricaoDaAula>`." | `frequencia` |
| `aula_reativada` | T22: os destinatários da D25 e da T42 **calculados no momento da reativação** (antes ou depois da aula, como no cancelamento), menos quem reativou; quem tinha troca **para** a aula cancelada por aquele cancelamento não entra (a troca não volta, § 6.1); quem tem troca aprovada para ela entra, inclusive a aprovada pelo sistema, que volta a pendente antes do cálculo (T50) | `aula_reativada:<class_id>:<ms>` | "Aula confirmada de novo" / "`<descricaoDaAula>`." | `frequencia` |
| `justificativa_aprovada` | o aluno | `justificativa_aprovada:<id>:<attempt>` | "Justificativa aprovada" / "Sua falta foi abonada." | `frequencia` |
| `justificativa_negada` | o aluno; `data = {"tentativa": 1\|2}` | `justificativa_negada:<id>:<attempt>` | tentativa 1: "Justificativa negada" / "Você pode reenviar em até 7 dias." · tentativa 2: "Justificativa negada" / "Para mais informações, procure o professor da aula ou a administração da academia." | `frequencia` |
| `chamada_retificada` | o aluno afetado | `chamada_retificada:<class_id>:<user_id>:<ms>` | "Chamada corrigida" / "`<descricaoDaAula>`: sua presença foi atualizada." | `frequencia` |
| `solicitacao_pendente` | quem pode decidir | `solicitacao_pendente:<request_id>` | "Nova solicitação para analisar" / "Abra Solicitações no app." | `frequencia` |
| `troca_pendente` (v3) | T42: professores da aula nova; sem nenhum, os admins; na **permanente**, também os admins. `class_id` = aula nova | `troca_pendente:<swap_id>` | "Pedido de troca de aula" / "`<descricaoDaAula>`. Abra Solicitações no app." | `frequencia` |
| `troca_aprovada` (v3) | o aluno (D50). `class_id` = aula nova; `data = {"permanente": 0\|1, "pela_chamada": 0\|1}`, com `pela_chamada = 1` quando `decided_via = 'roll_call'` (a chamada aprovou, inclusive a volta de expirada, T35) | `troca_aprovada:<swap_id>` | avulsa: "Troca aprovada" / "`<descricaoDaAula>`: esperamos você nesta aula." · avulsa com `pela_chamada = 1`: "Troca aprovada" / "`<descricaoDaAula>`: sua presença confirmou a troca." · permanente: "Troca permanente aprovada" / "Sua grade de aulas mudou. Veja no app." | `frequencia` |
| `troca_negada` (v3) | o aluno (D50). `class_id` = aula nova | `troca_negada:<swap_id>` | "Troca negada" / "Veja os detalhes no app." | `frequencia` |
| `troca_aprovada_equipe` (v3) | D50: professores da aula antiga (`data.entrada = 0`, `class_id` = aula antiga) e da aula nova (`entrada = 1`, `class_id` = aula nova); **admins só na permanente** (`entrada = 1`). Quem aprovou (ou fez a chamada que aprovou) fica de fora. Quem está nas duas aulas recebe só o da nova. `data = {"permanente": 0\|1, "entrada": 0\|1, "pela_chamada": 0\|1}` (`pela_chamada` como em `troca_aprovada`) | `troca_aprovada_equipe:<swap_id>` | título: "Troca de aula" (avulsa) ou "Troca permanente" · corpo: entrada 1: "`<descricaoDaAula>`: um aluno vem por troca." · entrada 1 com `pela_chamada = 1`: "`<descricaoDaAula>`: um aluno veio por troca." · entrada 0: "`<descricaoDaAula>`: um aluno trocou esta aula por outra." | `frequencia` |

**Regras:**

- **`public.enfileirar_notificacao` não muda de assinatura.** Por dentro, `send_after = p_agora`
  (fura o silêncio) **só** quando `p_tipo = 'aula_cancelada'` e a chave é a dos alunos, ou seja,
  **no primeiro cancelamento de cada aula**. `aula_reativada` respeita o silêncio (T22).
- **`justificativa_pendente`:**
  - destinatários: quem `pode_decidir_justificativa`;
  - na semanal (`class_id` nulo), os de T18; sem nenhum, os admins;
  - corpo da semanal: "Justificativa semanal para revisar.";
  - na tentativa 2, a chave é `justificativa_pendente:<id>:2`.
- **Obsolescência em `reivindicar_notificacoes`:**
  - `aula_cancelada` cai se a aula não estiver mais cancelada;
  - `aula_reativada` cai se a aula voltou a ser cancelada;
  - `aula_sem_chamada` e `justificativa_pendente` caem se a aula foi cancelada;
  - **v3:** `troca_pendente` cai se a troca (id em `split_part(dedupe_key, ':', 2)`) não estiver
    mais `pending` ou não existir; `troca_aprovada` e `troca_aprovada_equipe` caem se ela não
    estiver mais `approved` ou não existir.
- **Trocas (v3, T42):** a troca expirada ou cancelada **não gera push**; a volta de expirada para
  aprovada (T35) gera os avisos de aprovação com as mesmas chaves (quem já recebeu não recebe de
  novo). Todos respeitam o silêncio das 22h às 7h. **(25/09)** A aprovação pelo sistema (T50)
  **não gera** `troca_aprovada` nem `troca_aprovada_equipe` (o aluno recebe o `aula_cancelada`),
  e a volta dela a pendente na reativação não repete o `troca_pendente` (mesma chave); ela
  reaparece em Solicitações. A mudança de turma (T53) não gera push.
- **Nenhum texto leva nome, motivo, valor nem contato.** O título da aula continua como hoje. O
  contato da academia aparece só nas telas (§ 5.4).
- **`mensagens.ts` ganha um `default`** que devolve um texto genérico em vez de quebrar o lote
  (§ 14, ordem de publicação).
- **Web:** não tem push. O aluno de iPhone vê a aula riscada, as mensagens e o estado das trocas
  nas telas.
- **Toque na notificação (app):** os tipos de troca abrem **Aulas** (aluno) ou **Solicitações ›
  Trocas de aula** (`troca_pendente`, equipe). O roteador do app passa a aceitar esses tipos.

---

## 11. Frequência (dono: `snake-thai`) — a conta

### 11.1 Definições

- **Semana** e **mês de cada semana:** T2.
- **Dias de aula:** `academy_settings.class_weekdays`.
- **Aula que conta:** `type = 'routine'` e **não cancelada**. Evento nunca conta.
- **Presença:** `attendance.status = 'present'` numa aula que conta, **com `attendance_taken_at`
  não nulo**, de qualquer turma e público (D5, D6, T12).

### 11.2 Aluno fixo (por período P, semana ou mês)

- **esperado(P):** aulas que contam, com data em P, **da grade efetiva do aluno** (v3, T33:
  as da turma **em que ele estava na data de cada aula** (D58, T51) com público fixos ou ambos,
  mais a troca permanente vigente e as trocas avulsas aprovadas, já sem as aulas que ele
  trocou) e fora de `inactive_periods`.
  - **Menos:** dessas mesmas aulas, as que têm justificativa `scope = 'class'` aprovada e nenhuma
    presença.
  - **Troca avulsa aprovada** (D46): a original sai e a nova entra, **cada uma no mês da sua
    data** (na Semana Extra, a troca pode levar a aula de um mês para o outro). A falta gravada na
    original **deixa de contar**; faltar à nova é falta (T36). **Com a aula nova cancelada**
    (antes ou depois de acontecer), a vaga fica abonada: a nova não conta e a original continua
    fora (D26, D57), inclusive na reposição e na troca aprovada pelo sistema (T50).
  - **Troca pendente, expirada, negada ou cancelada** não muda nada: vale a original.
  - **Troca permanente** (D49, T37): muda a grade só para as aulas depois da aprovação; o que já
    passou fica como estava.
  - **Aula extra** (D51) nunca entra no esperado.
- **feitas(P):** presenças com data em P, a partir do **início da contagem** (T52: `created_at`,
  ou o início do período de backfill de quem mudou de turma entre 18/09 e a migration) e fora de
  `inactive_periods`, de qualquer turma e público (inclusive a extra e a presença numa aula que
  ele trocou por outra).
- **%** = feitas ÷ esperado × 100, com 2 casas, sem teto (D7). Esperado 0 → nulo (T9).
- **Mudança de turma (D58):** a turma antiga conta até o instante da mudança e a nova a partir
  dele; **o mês não recomeça**, e as aulas da turma nova anteriores à mudança nunca entram (a
  parte da correção do PR #31 que continua). A troca permanente não mexe em `group_id` nem no
  histórico de turma (T37).

### 11.3 Aluno livre, semana W

- **`cota_W`:** T3, proporcional por T8.
- **`oferta_W`:** aulas de W que contam e aceitam livres, mais as canceladas de W que entram em
  `abonos_W`.
- **`teto_W`** = `min(cota_W, oferta_W)` (T30).
- **`abonos_W`:**
  - justificativas `scope = 'week'`, `week_start` = segunda de W e `status = 'approved'`;
  - **mais** as aulas de rotina **com data em W**, com `cancelled_at` não nulo, em que ele tem
    `declared_status = 'present'` entre as **primeiras `cota_W` declarações** da semana (T29), ou
    `status = 'present'`;
  - **cada aula conta no máximo 1 vez.**
- **Abono aplicado** = `min(abonos_W, max(teto_W − feitas_W, 0))` (T17).
- **`esperado_W`** = `teto_W − abono aplicado`.
- **% semanal** = `feitas_W ÷ esperado_W × 100`, sem teto.

### 11.4 Aluno livre, mês M

- **Semana de M** (T2): `esperado_W` e `feitas_W` entram inteiros em M.
- **Semana Extra** (dias de aula em M1 e em M2):
  - **Feitas:** cada presença conta no mês em que aconteceu.
  - **Esperado:**
    - as presenças, em ordem, preenchem até `esperado_W` vagas, e cada vaga preenchida vai para
      o mês daquela presença;
    - as vagas **não preenchidas** são divididas pela metade;
    - **se o número for ímpar, a sobra vai para M2** (D10).
  - **`excused` e `cancelled` da semana contam em M2.**
  - **M1 só fecha depois do domingo de W** (D10).
- **% mensal** = Σ feitas ÷ Σ esperado × 100, sem teto (D7).
- **Mês com troca de modalidade:** o mês é a soma das semanas, e cada semana usa a modalidade dela
  (T3). Semana de fixo: § 11.2, com P = os dias de W que estão em M. A `schedule_mode` devolvida é
  a da semana que contém `min(hoje, último dia de M)`.

### 11.4b Aluno à vontade

Mesma conta do livre (§ 11.3 e § 11.4), com duas diferenças:

- `cota_W` é trocada por `meta_da_semana(user_id, week_start)`.
- `abonos_W` só tem aulas canceladas (D39, D41).

Aparece como **meta** e fica fora do Painel (D35, T10).

### 11.5 Conferência obrigatória (vira regressão SQL)

Plano 2x, mês com 4 semanas inteiras:

| Semana | Feitas | % semana | Feitas no mês | % mês (÷ 8) |
| --- | --- | --- | --- | --- |
| S1 | 3 | 150% | 3 | 37,5% |
| S2 | 1 | 50% | 4 | 50% |
| S3 | 0 | 0% | 4 | 50% |
| S4 | 4 | 200% | 8 | 100% |

**Semana Extra** (plano 2x):

| Caso | Esperado M1 | Esperado M2 |
| --- | --- | --- |
| seg–ter em M1, qua–sáb em M2; foi qua e qui | 0 | 2 |
| idem, foi 1 em cada mês | 1 (feita) | 1 (feita) |
| idem, não foi nenhuma vez | 1 | 1 |
| seg–qui em M1, sex–sáb em M2; foi só na segunda | 1 (feita) | 1 (a sobra ímpar vai para M2) |
| plano 3x, seg–ter em M1, qua–sáb em M2, não foi nenhuma vez | 1 | 2 |

**Casos-limite que o teste também cobre:**

- presença extra dentro da Semana Extra;
- justificativa aprovada numa semana já cumprida (o percentual não muda);
- fixo incluído em outra turma (150%);
- fixo que troca de turma no meio do mês e vai a todas as aulas: 100%, não 180% (D58: cada
  turma no seu período; ver a tabela do histórico de turma abaixo);
- semana de feriado sem aula livre: esperado 0, "—";
- aluno novo cadastrado na terça: não dá 166%;
- mês com troca de modalidade (T3);
- chamada feita depois do fechamento: T31 recalcula;
- **Painel (D55):** dois alunos com 150% e 50% no mês → média **100,00%** (não 75%);
- **T30 com oferta parcial:** livre 2x numa semana com uma só aula que aceita livres, e ele foi a
  ela → esperado 1, 100%.

**Trocas e extra (v3)**, fixo com 2 aulas por semana (qua e sex), numa semana:

| Caso | Esperado | Feitas | % semana |
| --- | --- | --- | --- |
| extra na terça, foi às três | 2 | 3 | 150% |
| extra marcada e não foi; foi qua e sex | 2 | 2 | 100% |
| avulsa qua → qui aprovada; foi qui e sex | 2 (qui, sex) | 2 | 100% |
| avulsa qua → qui aprovada; não foi à qui | 2 (qui, sex) | 1 | 50% (a falta é na qui) |
| reposição: faltou na qua (falta gravada), qua → sáb aprovada e foi | 2 (sex, sáb) | 2 | 100% |
| avulsa pendente, chamada da qui concluída sem ele (expira); faltou na qua | 2 (qua, sex) | 1 | 50% |
| troca pendente para a qui, foi à qua (cancela) e à sex | 2 (qua, sex) | 2 | 100% |
| permanente qua → sáb aprovada na **quinta**: a qua já passou e fica; o sáb entra | 3 (qua, sex, sáb) | — | semana de transição (T37); da semana seguinte em diante: sex e sáb |
| permanente qua → seg aprovada na **terça**: a seg já passou; a qua sai | 1 (sex) | — | semana de transição (T37) |
| avulsa qua → qui aprovada; depois a **qui** é cancelada; foi à sex | 1 (sex) | 1 | 100% (a vaga é abonada, D26; a qua não volta) |
| avulsa qua → qui aprovada; depois a **qua** é cancelada; foi à qui e à sex | 2 (qui, sex) | 2 | 100% (sem abono: a vaga está na qui) |
| reposição **pendente** qua → sáb (faltou na qua); o sáb é cancelado; foi à sex | 1 (sex) | 1 | 100% (a qua já passou: a troca é aprovada pelo sistema e a vaga abonada, T50) |
| reposição **aprovada** qua → sáb (faltou na qua); o sáb é cancelado antes da aula; foi à sex | 1 (sex) | 1 | 100% (a vaga é abonada e a falta da qua não conta, D57) |
| avulsa **pendente** qua → sáb, pedida na segunda; o sáb é cancelado na **terça** (antes da qua); foi à qua e à sex | 2 (qua, sex) | 2 | 100% (a troca é cancelada e vale a qua, T50) |
| avulsa **pendente** qua → sáb, pedida na segunda; não foi à qua, contando com a troca; o sáb é cancelado na **sexta**; foi à sex | 1 (sex) | 1 | 100% (a qua já passou: aprovada pelo sistema e abonada, T50) |
| reposição **aprovada** qua → sáb (faltou na qua); o sáb é cancelado e **reativado** antes da aula; foi à sex e não foi ao sáb | 2 (sex, sáb) | 1 | 50% (reativar desfaz o abono; a falta é no sáb, T36) |
| reposição **pendente** qua → sáb (faltou na qua); o sáb é cancelado (abono, T50) e **reativado**; foi à sex e ao sáb, e a chamada do sáb marcou presença | 2 (sex, sáb) | 2 | 100% (a troca voltou a pendente e a chamada a aprovou, D48) |
| a mesma, mas ele foi só à sex (a chamada do sáb expira a troca) | 2 (qua, sex) | 1 | 50% (vale a original, D48) |
| extra numa aula **"só livres"** da terça; foi às três | 2 | 3 | 150% (D56) |
| aula nova **antes** da original: avulsa sex → qui, chamada da qui com presença (aprova); foi à qua | 2 (qua, qui) | 2 | 100%; na sex, "Trocou para qui" |
| avulsa qua → qui **expirada** (chamada da qui sem ele); faltou na qua; foi à sex; depois a retificação marca presença na qui | 2 (qui, sex) | 2 | 100% (a troca volta a aprovada, T35) |
| a mesma, mas antes da retificação ele pediu e fez a reposição qua → sáb (aprovada) | 2 (sex, sáb) | 3 (qui, sex, sáb) | 150% (a qua → qui continua expirada; a presença na qui conta a mais, T35) |
| avulsa qua → qui aprovada **pela chamada**; a retificação tira a presença da qui; faltou na qua; foi à sex | 2 (qua, sex) | 1 | 50% (a troca volta a expirada) |
| extra na terça, que é **cancelada**; foi à qua e à sex | 2 | 2 | 100% |
| **Semana Extra** (2026: seg 28/09 a dom 04/10; a qua 30/09 é de setembro, a sex 02/10 é de outubro): avulsa qua 30/09 → qui 01/10 aprovada; foi à qui e à sex | setembro 0 (era 1: sai a qua 30/09) · outubro 2 (entra a qui 01/10; a sex 02/10 já era de outubro) | setembro 0 · outubro 2 | 100%; cada aula fica no mês da sua data; setembro só fecha depois de 04/10 (D10) |

**Histórico de turma (D58, T51–T53)**: fixo que passa da Turma Noite (seg e qua, 19h) para a
Turma Manhã (ter e qui, 7h), num mês com 4 semanas inteiras (fev/2027: seg 01/02 a dom 28/02;
Noite: 01, 03, 08, 10, 15, 17, 22, 24; Manhã: 02, 04, 09, 11, 16, 18, 23, 25), todas as aulas
com chamada:

| Caso | Esperado | Feitas | % |
| --- | --- | --- | --- |
| mudança na seg 15/02 às 12h; foi a todas | mês: 8 (Noite 01, 03, 08, 10 · Manhã 16, 18, 23, 25; a Noite de 15/02, às 19h, já não é dele) | 8 | 100% |
| a mesma mudança; faltou às 4 da Noite e foi às 4 da Manhã | mês: 8 | 4 | 50% (antes da D58: 4 de 4, 100%, porque o mês recomeçava) |
| mudança na qua 10/02 às 21h, depois da aula da Noite das 19h; foi a todas | mês: 9 (Noite 01, 03, 08, 10 · Manhã 11, 16, 18, 23, 25) | 9 | 100%; a S2 tem 3 aulas (seg 08 e qua 10 da Noite, qui 11 da Manhã; a ter 09 da Manhã foi antes da mudança), como a semana de transição da T37 |
| mudança na seg 15/02 às 12h; foi a todas e ainda foi incluído na aula da Manhã de ter 02/02 | mês: 8 | 9 | 112,50% (a presença na Manhã antes da mudança conta a mais) |
| mudança para **sem turma** na seg 15/02 às 12h; foi a todas da Noite | mês: 4 | 4 | 100% |
| avulsa qua 17/02 (Noite) → sex 19/02 (outra turma) aprovada na sex 12/02; mudança na seg 15/02 às 12h; foi à ter 16 e à qui 18 | S3: 2 (ter 16, qui 18) | 2 | 100% (a original ainda não tinha começado: a troca é cancelada, T53) |
| reposição: faltou à Noite de qua 10/02; qua 10 → sáb 13/02 (outra turma) aprovada; mudança na sex 12/02 às 12h; foi à seg 08 e ao sáb 13 | S2: 2 (seg 08, sáb 13; a ter 09 e a qui 11 da Manhã foram antes da mudança) | 2 | 100% (a original já tinha passado: a troca segue, T53) |
| chamada da Noite de qua 10/02 feita com atraso em 16/02, depois da mudança de seg 15/02 | — | — | ele aparece nela como `'turma'` e **não** aparece como `'turma'` na da Manhã de ter 09/02; o APK 1.8 recusa essa chamada da Noite (T47) |

### 11.6 Funções

```sql
public.frequencia_semanal(p_user_ids uuid[], p_de date, p_ate date,
                          p_referencia timestamptz default now()) returns table (
  user_id uuid, week_start date, week_end date,
  schedule_mode public.plan_schedule_mode,
  weekly_target smallint,             -- cota (livre) ou meta (à vontade); nulo para fixo
  expected int, attended int, excused int, cancelled int,
  frequency_percent numeric(7,2)      -- nulo com expected = 0
)  -- uma linha por semana (seg–dom) com ao menos um dia em [p_de, p_ate]
public.frequencia_do_mes(p_user_ids uuid[], p_mes date,
                         p_referencia timestamptz default now()) returns table (
  user_id uuid, reference_month date, schedule_mode public.plan_schedule_mode,
  expected int, attended int, excused int, cancelled int,
  frequency_percent numeric(7,2),
  closes_on date,                     -- domingo da última semana de M (ou da Semana Extra final)
  is_closed boolean,
  expected_to_date int, attended_to_date int    -- ritmo (T10)
)  -- p_mes: qualquer dia do mês (date_trunc('month', p_mes))
public.semanas_do_mes(p_user_id uuid, p_mes date, p_referencia timestamptz default now())
returns table (
  week_start date, week_end date, label text,   -- 'S1'..'S5' | 'Semana extra' (não consome número)
  is_split boolean, expected_week int, attended_week int, week_percent numeric(7,2),
  expected_in_month int, attended_in_month int, excused_week int,
  can_justify boolean, justify_until timestamptz, justifications_left int,  -- só livre
  justificativas jsonb   -- [{"id","status","attempt","approved_by_name"}]
)
```

**Quem chama:** o próprio aluno, `is_staff()` ou o sistema (§ 0.1).

**Definições das colunas:**

- **`excused`:** no fixo, as aulas descontadas por justificativa; no livre, a soma do abono
  aplicado.
- **`cancelled`:** no fixo, as canceladas que estariam no esperado; no livre, as canceladas que
  entraram em `abonos_W`.
- **Ritmo (T10):**
  - fixo: `expected_to_date` = aulas do esperado com `date_time ≤ agora` **e chamada concluída**;
  - livre: soma de `esperado_W` das semanas já terminadas + `min(feitas_W, esperado_W)` da semana
    em curso;
  - `attended_to_date` = presenças de M até agora.

**`public.attendance_monthly`:**

- saem `attendance_monthly_percentual_valido` e `attendance_monthly_contagens_coerentes`;
- entram `schedule_mode`, `expected`, `excused` e `cancelled`;
- `frequency_percent` vira `numeric(7,2)` e **continua `not null`**, porque só são gravados alunos
  com `expected > 0`;
- as colunas antigas continuam preenchidas: `total_classes = expected`,
  `counted_classes = expected`, `attended = attended`, `justified = excused`;
- **(25/09)** `group_id` passa a ser a turma **em que ele terminou o mês** (a do último
  `student_group_periods` que tocou M; nulo sem nenhum), e não a turma do dia do fechamento.

**`public.fechar_frequencia_do_mes`:**

- o cron `close-monthly-attendance` passa a ser **diário**;
- fecha cada mês M no dia seguinte a `closes_on`;
- sem nada a fechar, devolve 0 (sem erro);
- recalcula os meses fechados que mudaram (T31).

**`painel_admin_resumo(timestamptz)` e `painel_alunos_em_risco(numeric, integer, timestamptz)`:**

- **mantêm assinatura e colunas**;
- o risco usa o ritmo (T10);
- **a média é a média simples dos percentuais, ignorando nulos, sem teto por aluno** (v3, D55;
  o `least(%, 100)` e o rótulo "limitada a 100%" saíram);
- o à vontade fica fora dos dois.

**`public.frequencia_mensal`** (legado): o mapeamento está em § 15.

---

## 12. Aulas do aluno, histórico, perfis, LGPD, menu de aulas e aviso de atualização (dono: `snake-thai`; consumidores: app e web)

```sql
public.aulas_do_aluno(p_de timestamptz, p_ate timestamptz) returns table (
  class_id uuid, title text, type public.class_type, date_time timestamptz,
  group_id text, group_name text, audience public.class_audience,
  cancelled boolean, declared_status public.attendance_status, status public.attendance_status,
  justification_id uuid, justification_status public.justification_status,
  schedule_mode public.plan_schedule_mode,   -- a da semana da aula (T3)
  weekly_target smallint, marked_in_week int,
  can_justify boolean, justify_until timestamptz,    -- fixo
  can_contest boolean, contest_until timestamptz,    -- "Eu estava na aula"
  teachers jsonb,       -- [{"id": uuid, "name": text, "color": text}]
  -- v3 (§ 9.4, § 9.5, § 12.2):
  origem text,          -- mesmo vocabulário de lista_da_chamada (§ 7.2); nulo = aula que não é dele
  is_recurring boolean, -- veio da grade semanal (schedule_id não nulo): pode entrar em troca permanente
  schedule_ends_on date,-- último dia do horário, se tiver fim (nulo nos demais casos)
  can_mark_extra boolean,  -- fixo: pode marcar "Vou (extra)" agora: aula de rotina fora da grade,
                           -- de QUALQUER público, inclusive "só livres" (D56), não cancelada, que
                           -- não começou, sem aula da grade dele no mesmo date_time e sem troca
                           -- pendente dele para ela (§ 9.2, § 9.5)
  can_swap_from boolean,   -- fixo: pode ser a aula ORIGINAL de uma troca SÓ NESTA SEMANA agora
  can_swap_from_permanent boolean, -- fixo: pode ser a aula ORIGINAL de uma troca PERMANENTE
                           -- agora: origem 'turma' ou 'permanente', is_recurring, ainda não
                           -- começou e sem as recusas da permanente (§ 9.4). Aula cancelada
                           -- também serve: na permanente, a aula é só ponteiro (T37)
  can_swap_to boolean,     -- fixo: pode ser a aula NOVA de uma troca agora (os dois tipos)
  swap_id uuid, swap_kind public.class_swap_kind, swap_status public.class_swap_status,
  swap_decided_via text,   -- 'review' | 'roll_call' | 'student' | 'system'; nulo se pendente
  swap_role text,          -- 'origem' | 'destino'
  swap_other_class_id uuid, swap_other_date_time timestamptz,
  can_cancel_swap boolean  -- os swap_*: a troca mais recente em que a aula é original ou nova
)
```

- **Sempre do próprio aluno.**
- **Fixo vê** (v3): a **grade efetiva** (T33: turma da data de cada aula, D58, troca
  permanente e troca aprovada; depois de mudar de turma, as aulas passadas da turma antiga
  continuam aqui e as da turma nova anteriores à mudança não aparecem), as
  aulas que ele **trocou por outra** (`origem = 'trocou'`), as aulas novas de troca **pendente**,
  as aulas novas de troca avulsa **expirada** (`origem` nula, `swap_status = 'expired'`,
  `swap_role = 'destino'`, com `can_contest` e `contest_until` pela T19: é por elas que a T35
  volta a valer), as **extras** marcadas, os eventos e as aulas em que já tem linha.
- **Livre e à vontade veem:** todas as aulas de rotina com público livres ou ambos, os eventos e
  as aulas em que já têm linha.
- **Aula cancelada aparece** (`cancelled = true`).
- **`can_justify` e `can_contest`** são `false` na aula original de troca pendente ou aprovada
  (T38); na aula nova de troca aprovada, valem como numa aula da turma. **`can_contest`** é
  `true` só nas aulas que esta função devolve (é o "visível ao aluno" do `student_was_present`,
  § 9.3).
- **App e web escolhem rótulos, botões e o aviso da cota só por estas colunas.**
- Corrige o defeito atual da web, que mostra as aulas de todas as turmas.
- Na v3, a função ainda não existe no banco: nasce já com as colunas novas (sem DROP).

```sql
public.historico_de_aulas_do_aluno(p_user_id uuid, p_de date, p_ate date) returns table (
  class_id uuid, date_time timestamptz, title text, group_name text,
  audience public.class_audience, cancelled boolean,
  status public.attendance_status, declared_status public.attendance_status,
  origem text, justification_status public.justification_status,
  approved_by_name text,             -- só quando approved
  edited boolean,
  edited_at timestamptz, previous_status public.attendance_status, edited_by_name text,  -- SÓ admin
  attendance_delay_days int,         -- T14, nulo quando 0
  swap_kind public.class_swap_kind, swap_other_date_time timestamptz   -- v3: troca aprovada da aula
)  -- o próprio aluno ou is_staff(). As justificativas semanais aparecem em semanas_do_mes / justificativas_do_aluno.
   -- origem: vocabulário da § 7.2. A aula original de troca aprovada vem com origem 'trocou'
   -- e a tela mostra "Trocou para {dia dd/mm hh:mm}" no lugar de "Falta".
```

```sql
public.perfil_do_aluno(p_user_id uuid) returns jsonb
  -- is_staff().
  -- Chaves: nome, turma, modalidade, cota_ou_meta, situacao, na_academia_desde,
  --         frequencia_semana, frequencia_mes,
  --         trocas_permanentes (v3): os períodos vigentes agora (T37), [{"de": {"weekday", "start_time",
  --         "group_name"}, "para": {"weekday", "start_time", "group_name"}, "desde": date}],
  --         turmas_no_mes (25/09, D58): os student_group_periods que tocam o mês corrente (SP),
  --         por started_at: [{"turma": text, "desde": date, "ate": date | null}], com
  --         desde = data (SP) de started_at e ate = data (SP) de (ended_at - 1 microssegundo)
  --         (nulo no aberto). Rótulo na § 3. A chave "turma" continua (a turma de hoje).
  -- SÓ admin: plano_nome e o bloco "financeiro" (meses_na_academia, pagas,
  --           pagas_com_atraso, inadimplentes, em_aberto).
  -- NUNCA: CPF, telefone, nascimento, preço (D32).
```

```sql
public.perfil_do_professor(p_teacher_id uuid, p_mes date) returns jsonb
  -- SÓ is_admin() (D31).
  -- Chaves: nome, cor, esperadas, dadas, dadas_fora_da_escala, canceladas,
  --         faltas, abonadas, pendentes, percentual (T32).
public.historico_de_aulas_do_professor(p_teacher_id uuid, p_de date, p_ate date) returns table (
  class_id uuid, date_time timestamptz, title text, group_name text,
  cancelled boolean, scheduled boolean, present boolean, added_in_roll_call boolean,
  attendance_delay_days int, edited boolean
)  -- SÓ is_admin()
```

**Definições do perfil do professor:**

| Campo | Significado |
| --- | --- |
| esperadas | aulas de rotina no mês em que estava escalado, não canceladas |
| dadas | `present = true`, inclusive as não previstas |
| faltas | escalado com `present = false` e sem `teacher_absence` aprovada |
| abonadas | `teacher_absence` aprovadas |
| pendentes | aulas passadas sem chamada |
| sem registro | chamada concluída e `present` nulo (legado, § 15): não conta como dada nem como falta |

### 12.1 LGPD

**`public.export_my_data()`** é reescrita com **lista explícita de colunas**, sem `to_jsonb` de
linha inteira.

| Chave | Conteúdo |
| --- | --- |
| `presencas` | `class_id`, `declared_status`, `status`, `edited` |
| `justificativas` | `id`, `scope`, `class_id`, `week_start`, `message`, `status`, `attempt`, `reviewed_at` e, só quando `approved`, `approved_by_name` |
| `solicitacoes` | de `minhas_solicitacoes` |
| `metas` | as do aluno |
| `periodos_de_plano` | os do aluno |
| `periodos_inativos` | os do aluno |
| `trocas` (v3) | **todas** as linhas de `class_swaps` do titular, sem filtro de data e inclusive as de aula apagada, com as colunas de `minhas_trocas`: `minhas_trocas('-infinity', 'infinity')` (nunca com os padrões, que trazem só 60 dias) |
| `trocas_permanentes` (v3) | de `minhas_trocas_permanentes()`: todos os `class_swap_periods` do aluno, com dia e hora de origem e de destino, `started_at` e `ended_at` |
| `periodos_de_turma` (25/09, D58) | todos os `student_group_periods` do aluno: nome da turma (`groups.name`), `started_at`, `ended_at`. Lidos direto: a RLS da § 5.2 deixa o titular ler os seus, e `groups` é legível por todo `authenticated` |

**`export_my_data` continua `security invoker`** (a RLS continua valendo, como hoje).
`class_swaps` e `class_swap_periods` não têm grant para `authenticated`, então a função **não
lê as duas tabelas direto** (daria `42501` e derrubaria a exportação de todo titular): as duas
chaves saem das RPCs `security definer` acima, que filtram por `auth.uid()`. Ninguém ganha grant
nas tabelas. O teste de regressão chama `export_my_data()` como aluno com troca permanente e
como aluno sem troca (§ 0.1).

**Nunca sai no export:** `review_note`, o revisor de uma negada, `edited_by`, `previous_status`
nem nada das tabelas de auditoria (inclusive `class_swap_reviews`).

**`public.anonimizar_titular`** também apaga:

- `roll_call_requests` com `subject_id` ou `requester_id` do titular;
- `weekly_goals`;
- os `action_reasons` de `request_evidence` do titular (os anexos vão para a fila);
- **v3:** as `class_swaps` do titular (primeiro, porque o motivo é `on delete restrict`; as
  `class_swap_reviews` vão em cascata), os `class_swap_periods` dele e os `action_reasons` de
  `class_swap_evidence` dele (os anexos vão para a fila);
- **25/09:** os `student_group_periods` dele, **depois** do `update` de `profiles` que anula
  `group_id` (o gatilho `registrar_periodo_de_turma` fecharia o período aberto nesse `update`).
  Nas chamadas passadas, o titular passa a aparecer só como `'incluido'` (onde tem linha), como
  já acontece hoje com `group_id` nulo.

### 12.2 Menu de aulas (D43, T43; consumidores: app e web)

```sql
public.menu_de_aulas(p_semana date, p_referencia timestamptz default now()) returns table (...)
  -- EXATAMENTE a mesma lista e a mesma ORDEM de colunas de aulas_do_aluno (acima), uma linha
  -- por aula visível da semana. Mudar uma exige mudar a outra na mesma migration
  -- (DROP + CREATE das duas, § 0.1).
  -- p_semana: qualquer dia da semana (normalizado para a segunda, T2).
  -- p_referencia: o "agora" de "esta semana ou a próxima" e dos can_*. Só o sistema (§ 0.1:
  -- testes de regressão em data fixa) passa outro valor; para authenticated, vale now().
```

- **Quem:** o próprio aluno (`role = 'user'`); outro papel: `42501`.
- **Semana:** só **esta semana ou a próxima** (T43); outra: `22023`, *"Escolha esta semana ou a
  próxima."* Vêm **todas** as aulas da semana, inclusive as que já passaram (a reposição parte
  de uma aula que já aconteceu).
- **Dias do menu:** `academy_settings.class_weekdays` (leitura direta, como hoje); aula num dia não
  configurado aparece no dia dela.
- **O que cada um vê:**
  - **livre e à vontade:** o mesmo de `aulas_do_aluno` (rotina com público livres ou ambos,
    eventos e aulas em que têm linha);
  - **fixo** (inclusive sem plano, T5): **todas** as aulas de rotina da semana, de **qualquer
    turma e público** (D47, D56: em todas elas ele pode marcar **Vou (extra)** e pedir troca),
    os eventos e as aulas em que tem linha.
- **Aula cancelada:** aparece riscada, com o selo **Cancelada**, e sem nenhuma ação (D26).
- **Vagas:** não há limite nem contagem (T43).
- **As colunas seguem as mesmas regras nas duas funções.** Nas linhas do menu que **não**
  aparecem em `aulas_do_aluno` (aula de outra turma em que o fixo não tem nada), `can_justify`
  e `can_contest` são `false` (§ 9.3).

**Ações de cada linha** (o app e a web decidem só pelas colunas; o banco confere tudo de novo):

| Aluno | Linha | Mostra | Ações |
| --- | --- | --- | --- |
| livre e à vontade | aula que aceita livres, sem `declared_status` | — | **Vou** |
| livre e à vontade | `declared_status = 'present'` | **Marcada** | **Desmarcar** · aviso de acima da cota (§ 3) |
| fixo | `origem = 'turma'` / `'permanente'` / `'troca'` | **Sua aula** / **Troca permanente** / **Troca** + "no lugar de {dia dd/mm hh:mm}" | **Vou** / **Não vou** (antes do início) |
| fixo | aula dele com troca pendente saindo (`swap_role = 'origem'`) | **"Troca pendente para {dia dd/mm hh:mm}"** | **Desistir da troca** |
| fixo | `origem = 'trocou'` | **"Trocou para {dia dd/mm hh:mm}"** | **Desistir da troca** (se `can_cancel_swap`) |
| fixo | `origem = 'troca_pendente'` | **Troca pendente** | **Desistir da troca** |
| fixo | outra aula com `can_mark_extra` | — | **Vou (extra)** |
| fixo | `origem = 'extra'` | **Extra** | **Desmarcar** |
| fixo | outra aula com `can_swap_to` | — | **Trocar para esta** → folha **Trocar aula** |
| fixo | troca mais recente `rejected` / `expired` / `cancelled` | **Troca negada** + bloco de contato / **Troca expirada · vale a aula original** / **Troca cancelada** ou **Você desistiu da troca** (por `swap_decided_via`) | as da linha, como se não houvesse troca |
| todos | `cancelled = true` | **Cancelada**, título e hora riscados | nenhuma |

**Folha "Trocar aula"** (a partir da aula nova):

1. **"Qual aula sua você quer trocar por esta?"**: as aulas da mesma semana com
   `can_swap_from` **ou** `can_swap_from_permanent`. As que já passaram e em que ele faltou
   (só `can_swap_from`) vêm com o selo **Reposição**.
2. **Tipo:** **Só nesta semana** só aparece se a escolhida tiver `can_swap_from`;
   **Permanente**, se a escolhida tiver `can_swap_from_permanent` e a aula nova tiver
   `is_recurring = true`. Com as duas opções, o padrão é **Só nesta semana**. Na
   **Permanente**, com `schedule_ends_on` na aula nova, mostra **"Este horário termina em
   {dd/mm}."**
3. **Permanente:** campo **"Por que você precisa mudar de horário?"** (obrigatório, até 500
   caracteres) + **Anexar arquivo** (até 5, T46) + o aviso **"A troca permanente muda a sua grade
   a partir da próxima aula depois da aprovação."**
4. **Pedir troca** → fluxo da § 9.4.

### 12.3 Aviso de atualização do app (D53, T48; dono: `snake-thai`; a web não se aplica)

Não usa o banco nem cruza repositório. Está aqui para fixar os textos e a convenção que o
`.github/workflows/release.yml` precisa manter.

| Item | Regra |
| --- | --- |
| Fonte | `GET https://api.github.com/repos/yagoriccomi/snake-thai/releases/latest`, com `Accept: application/vnd.github+json` e **sem token** (o repositório é público). Tempo máximo: 5 s. O `releases/latest` já ignora rascunho e pré-lançamento. |
| Versão nova | `tag_name` precisa casar `^v(\d+)\.(\d+)\.(\d+)$`. A instalada é o núcleo `X.Y.Z` de `Constants.expoConfig.version`, **antes do `+`** (build fora da tag tem `+N.sha`). Mostra só se a nova for **maior**, comparando MAJOR, MINOR e PATCH como números. Tag fora do formato: não mostra. |
| Link | **Montado a partir da tag já validada, nunca lido da resposta:** `https://github.com/yagoriccomi/snake-thai/releases/download/vX.Y.Z/snake-thai-vX.Y.Z.apk`. Ele só é oferecido se a resposta tiver o asset de nome **exato** `snake-thai-vX.Y.Z.apk` com `browser_download_url` **exatamente igual** a esse valor. Sem esse asset, o link é `https://github.com/yagoriccomi/snake-thai/releases/tag/vX.Y.Z`, também montado (o `html_url` não é usado). O `-playstore.aab` é ignorado. **O app nunca abre outra URL nem outro esquema** (`intent://`, outro domínio). Abre no navegador (o Android pede a permissão de instalar). |
| Frequência | No máximo **uma consulta e um aviso por dia** por aparelho. "Dia" = data em `America/Sao_Paulo`, guardada no `AsyncStorage` (dado não sensível) junto com a última tag vista. Confere ao abrir e ao voltar ao primeiro plano. Resposta 403 ou 429 também conta o dia como consultado. |
| Não mostra | APK DEV (`env.appVariant === 'development'`); sem rede; erro ou tempo esgotado; tag fora do formato; versão instalada igual ou maior. A falha vai para `log.warn` (nunca `log.error`) e **nunca trava a abertura**. |
| Onde | Em qualquer tela, inclusive no Login (não tem dado pessoal), numa folha sobre a tela atual. |
| Bloqueio | Nenhum: o aviso é só informativo (T48). |

**Textos:**

- Título: **Nova versão disponível**
- Corpo: **"A versão {instalada} deste aplicativo pode apresentar mal funcionamento. Recomendamos
  atualizar para a versão {nova}."**
- Nota: **"Este aviso aparece uma vez por dia até você atualizar."**
- Botões: **Baixar atualização** (abre o link) · **Agora não** (fecha até o dia seguinte).

**Convenção de release (`release.yml`), que o aviso pressupõe:**

- tag `vX.Y.Z`, sem sufixo, como hoje;
- asset `snake-thai-vX.Y.Z.apk`, com esse nome exato;
- release publicada (nem rascunho nem pré-lançamento) e marcada **Latest**. Uma correção de uma
  linha antiga, se um dia existir, sai com `--latest=false`;
- o `SHA256SUMS.txt` não é mais publicado (desde `3e437e5`), e o aviso não depende dele.

**Quando passa a valer:** só a partir do **primeiro APK que tiver a checagem**. Quem está na
1.8.0 nunca verá o aviso. Por isso ele sai no **próximo APK (1.9.0), antes da 2.0.0** (§ 14). Para
quem continuar na 1.8.0, o aviso da 2.0.0 vai por outro canal (ROADMAP 4.13).

---

## 13. `snake-server` — rotas (dono: `snake-server`)

> **Estado de hoje:** o `snake-server` ainda não tem o módulo `motivos`, a variante
> `{justificationId}` nem o motivo `'anexo_expirado'` no worker. São entregas da v2 (§ 13.1 a
> § 13.4), e o **G2 continua pendente**.
>
> **O que a v3 acrescenta ao servidor (só isto):** a assinatura do upload leva
> `allowed_formats` (§ 13.1 e § 13.2) e o worker e a varredura de órfãos apagam `motivos/` e
> `justificativas/` nos três tipos de recurso da Cloudinary (§ 13.3), para que a guarda de 180
> dias (D54) e a exclusão de conta alcancem todo anexo. A justificativa da troca permanente
> (`class_swap_evidence`) usa o módulo `motivos` como está: `pode_anexar_ao_motivo` e a RLS de
> `action_reason_attachments` decidem, e a pasta continua `motivos/<uid>/<id>`.

### 13.1 Módulo novo `motivos`

**`POST /v1/motivos/sign-upload`**

- **Corpo:** `{ "motivoId": "<uuid>", "anexoId": "<uuid>" }`.
- **Antes de assinar:** chama `rpc/pode_anexar_ao_motivo` com `{ p_motivo_id }` e o token de quem
  chama. Se não for `true`, responde 403.
- **200:** `UploadAssinado`, com `folder = "motivos/<userId do token>"`, `public_id = "<anexoId>"`,
  `type = "authenticated"`, **`overwrite = false`** e (**v3**) **`allowed_formats =
  "jpg,png,webp,heic,pdf"`** dentro da assinatura (T25, T46). O cliente envia os dois campos
  como os recebeu; sem eles, a Cloudinary recusa a assinatura. Um `.docx` ou um vídeo enviado
  por um cliente modificado é recusado na própria Cloudinary.

**`POST /v1/motivos/view-url`**

- **Corpo:** `{ "anexoId": "<uuid>", "pagina"?: 1..999 }`.
- **Leitura:** `action_reason_attachments?id=eq.<anexoId>&select=id,uploaded_by,provider,public_id`,
  com o token de quem chama (a RLS decide).
- **403:** linha ausente ou provedor diferente de `'cloudinary'`.
- **Caminho derivado:** `motivos/<uploaded_by>/<id>`, nunca lido do `public_id` (achado C-2).
- **200:** `{ "url", "paginas", "pagina" }`.

**Constantes e limites:**

```
PASTA_MOTIVOS = 'motivos'
TABELA_ANEXOS_DE_MOTIVO = 'action_reason_attachments'
COLUNAS_DO_ANEXO_DE_MOTIVO = 'id,uploaded_by,provider,public_id'
RPC_PODE_ANEXAR = 'pode_anexar_ao_motivo'
FORMATOS_DE_ANEXO = 'jpg,png,webp,heic,pdf'   -- v3: allowed_formats (motivos e {justificationId})
```

- `limitadorDeComprovantes` (20/min) em `/v1/proofs`, **`/v1/justifications` e `/v1/motivos`**.
- **Nenhuma variável de ambiente nova.**

### 13.2 `justifications` (compatível com o que está instalado)

**`POST /v1/justifications/sign-upload`**

- **Corpo:** **exatamente um** de dois (o `zod` recusa os dois juntos ou nenhum).
- **Legado `{ "classId": "<uuid>" }`:**
  - comportamento de hoje: `public_id = classId`, sem consulta ao banco;
  - vale até a Fase B.
- **Novo `{ "justificationId": "<uuid>" }`:**
  - o servidor lê
    `absence_justifications?id=eq.<id>&select=id,user_id,status,attempt,proof_public_id` com o
    token de quem chama;
  - só assina se `user_id` for o do token, `status = 'pending'` e `proof_public_id` for nulo;
    senão, 403;
  - `public_id` = `<id>` com `attempt = 1`, ou `<id>-2` com `attempt = 2`;
  - `overwrite = false` e (**v3**) `allowed_formats = "jpg,png,webp,heic,pdf"` na assinatura,
    como em § 13.1. A variante legada `{classId}` **não** ganha `allowed_formats` (o APK 1.8
    não envia o campo e a assinatura deixaria de bater).

**`POST /v1/justifications/view-url`**

- **Corpo:** `{ "justificationId": "<uuid>", "pagina"?: 1..999 }`.
- `COLUNAS_DA_JUSTIFICATIVA` = `'id,user_id,class_id,attempt,proof_provider,proof_public_id'`.
- **Caminho:** calcula os caminhos derivados (`justificativas/<user_id>/<id>`, `…/<id>-2` e, com
  `class_id`, `…/<class_id>`) e usa **o que for igual** a `proof_public_id`. Se nenhum for, 403.

### 13.3 Worker `snakethai-media-cleanup`

**Antes de apagar (provedor `cloudinary`):**

- exige `asset_ref` no formato `^(comprovantes|justificativas|motivos)/[0-9a-f-]{36}/[0-9a-f-]{36}(-2)?$`;
- exige a pasta certa para o motivo:

| `motivo` | Pasta aceita |
| --- | --- |
| `comprovante_recusado`, `migrado_de_provedor`, `retencao_expirada` | `comprovantes/` |
| `justificativa_removida` | `justificativas/` |
| `anexo_de_motivo_removido` | `motivos/` |
| `anexo_expirado` | `justificativas/` ou `motivos/` |
| `conta_excluida` | qualquer uma das três |

**Provedor Storage (`payment_proofs`):**

- recusa caminho com `..`;
- monta a URL com `encodeURIComponent` em cada segmento.

**Falha de validação** é terminal: marca `prefixo_invalido`, sem nova tentativa e **sem apagar**.

**Tipo de recurso (v3):** hoje o `destroy` usa só `resource_type: 'image'`, e `"not found"` conta
como sucesso: um arquivo guardado como `raw` ou `video` nunca seria apagado. Para `motivos/` e
`justificativas/`, o worker tenta `image`, depois `raw`, depois `video` (sempre com
`type: 'authenticated'`): o item é concluído quando um deles responde `"ok"` ou os três
respondem `"not found"`. `comprovantes/` continua como está.

**Varredura diária de órfãos:** assets em `motivos/` e `justificativas/` com mais de 24 h e sem
linha correspondente (em `action_reason_attachments` ou em `proof_public_id` e nas tentativas)
são apagados. **v3:** a varredura lista os três tipos de recurso.

### 13.4 Configuração

`ALLOWED_ORIGIN=https://snake-web-eight.vercel.app` (sem barra), para a web chamar
`/v1/justifications/*`, `/v1/proofs/*` e, na v3, **`/v1/motivos/*`** (anexos da troca
permanente, D34). **Conferido pelo dono em 24/09** na Render. O CORS do servidor é global
(`src/app.ts`), então a mesma variável cobre as três rotas, sem mudança.

---

## 14. Portões e ordem de publicação

| Portão | Quem abre | O que significa | Como conferir | Quem espera |
| --- | --- | --- | --- | --- |
| **G0** | usuário | Contrato **v3** (com a revisão de 25/09) e mockups aprovados, **inclusive o menu de aulas, a folha "Trocar aula", a aula extra, "Revisar troca" e "Falar com a academia"** (D43; linhas G e H, **versão 8**, 25/09). **Desde 25/09, também:** **Vou (extra)** nas aulas "só livres" do menu (D56) e os textos novos da § 3 (turma por período no perfil do aluno e aviso ao mudar a turma, D58), já na versão 8 ("Treino livre — noite" com Extra, "Troca abonada" em Meus pedidos e a tela "Admin — mudar o aluno de turma") | registro no `ROADMAP.md` do snake-thai | todos, **exceto o APK 1.9.0** com o aviso de atualização (§ 12.3), que espera só a aprovação dos textos da § 12.3 |
| **G1** | snake-thai | **Esquema completo** (§ 4 a § 10: enums, tabelas, colunas, constraints, RLS e grants) na `main` e no banco local, **sem** as RPCs de comportamento | no banco local (55322): `select count(*) from pg_class where relname in ('plan_periods','inactive_periods','weekly_goals','action_reasons','action_reason_attachments','roll_call_requests','attendance_audit','class_teacher_presence','class_audit','absence_justification_reviews','absence_justification_attempts','class_swaps','class_swap_reviews','class_swap_periods','student_group_periods')` = 15 **e** `select count(*) from pg_enum where enumlabel in ('anexo_de_motivo_removido','class_swap_evidence','troca_pendente')` = 3 **e** a coluna `academy_settings.contact_whatsapp` existe **e** a função `pode_ler_motivo` (usada pelas políticas da § 8) existe **e** (25/09) `select count(*) from pg_trigger where tgname = 'registrar_periodo_de_turma' and tgrelid = 'public.profiles'::regclass` = 1 **e** o backfill confere: `select count(*) from public.profiles p where p.group_id is not null and not exists (select 1 from public.student_group_periods g where g.user_id = p.id and g.ended_at is null and g.group_id = p.group_id)` = 0 | servidor (teste integrado de `motivos`) |
| **G2** | snake-server | Módulo `motivos`, variante `{justificationId}`, limitadores e worker **em produção**; **na v3**, com `allowed_formats` na assinatura e a exclusão nos três tipos de recurso (§ 13) | `POST /v1/motivos/sign-upload` com `{"motivoId":"00000000-0000-4000-8000-000000000000","anexoId":"00000000-0000-4000-8000-000000000000"}` e **sem token** → **401** `no_token`. `POST /v1/justifications/sign-upload` com `{"justificationId":"<mesmo uuid>"}` sem token → **401** (o servidor antigo dá 400). Commit do worker publicado no Cron Job | app e web (anexos) |
| **G3** | snake-thai | RPCs do aluno (§ 5.3, § 5.4, § 9.1 a § 9.4, § 11.6, § 12, § 12.2) na `main` e no banco local | `select count(distinct proname) from pg_proc where proname in ('aulas_do_aluno','declarar_aula','frequencia_semanal','frequencia_do_mes','semanas_do_mes','historico_de_aulas_do_aluno','enviar_justificativa','reenviar_justificativa','anexar_a_justificativa','minhas_justificativas','definir_meta_semanal','meta_da_semana','criar_motivo','pode_anexar_ao_motivo','anexar_ao_motivo','abrir_solicitacao','minhas_solicitacoes','menu_de_aulas','pedir_troca_de_aula','desistir_da_troca','minhas_trocas','minhas_trocas_permanentes','contato_da_academia')` = 23 | web (desenvolver) |
| **G4** | snake-thai | G1 e G3 **em produção** | a mesma consulta no SQL Editor de produção | web (publicar) |
| **G5** | snake-thai + usuário | Nova versão da Política publicada: D22 (atestado, **180 dias depois da decisão**, D54), D32 (professor vê todos os alunos), metas, solicitações e **trocas de aula** (a justificativa da permanente pode ter dado de saúde e segue os mesmos 180 dias) | `select version from public.legal_documents where kind = 'privacy_policy' and is_current` = o valor anotado no ROADMAP do snake-thai | APK e web com justificativa com anexo e perfil do aluno |
| **G6** | usuário | Todos os aparelhos e a web nas versões novas → **Fase B** (§ 15) | versão mínima conferida no Painel ou no Sentry | snake-thai |

**Antes de tudo (v3):** o **APK 1.9.0 com o aviso de atualização** (§ 12.3). É a **única
exceção ao G0**: depende só da aprovação dos textos da § 12.3, não do banco, do servidor nem de
outro portão, e precisa estar instalado antes da 2.0.0 para que o aviso da 2.0.0 chegue a quem
o tiver.

**Ordem de publicação em produção** (cada entrega):

1. **servidor** (G2);
2. **Edge Function `send-push`**, já com os tipos novos e o `default`;
3. **migrations**;
4. **`create-staff`**;
5. **APK**, no mesmo dia das migrations;
6. **web**.

O servidor e a `send-push` vêm antes porque aceitam o banco antigo. As migrations antes da
`send-push` nova travariam **todo** push: um tipo desconhecido quebra o lote. **Na v3**, a
`send-push` do passo 2 já precisa ter os quatro tipos de troca (§ 10).

## 15. Compatibilidade com o que está instalado (até G6)

| Cliente antigo faz | O banco novo responde |
| --- | --- |
| Upsert de justificativa `{class_id, user_id, message, proof_*}` (APK 1.8, web atual) | Funciona: `scope = 'class'` e `week_start` preenchidos pelo gatilho, e o `unique (class_id, user_id)` mantido. |
| Professor decide justificativa com `update({status})` (APK 1.8) | `22023`, *"Atualize o aplicativo para decidir justificativas."* **O APK novo sai no mesmo dia das migrations.** |
| `select('*')` em `absence_justifications` (APK 1.8) | Não vê nota nem quem negou: a nota está em outra tabela, e a negada tem `reviewed_by` nulo. O professor deixa de ver as decididas. |
| `salvar_chamada` (APK ≤ 1.8), primeira conclusão | Aceita. **Aula com público `'free'`:** recusa, com `22023`, *"Atualize o aplicativo para fazer a chamada desta aula."* **Nas outras:** grava de `p_ausentes` só os fixos esperados (**v3:** os da grade efetiva, T33) e ignora os demais ids (T11); quem estiver em `p_presentes` e não for esperado vira incluído. Grava `taken_by` e `present = true` para quem chama. **v3:** aula com troca ou extra é recusada (linha abaixo). **v3:** presença gravada por ele na **aula original de uma troca avulsa pendente** (o aluno aparece como da turma) **cancela** a troca (`decided_via = 'system'`), como na regra 8 da § 7.2, e dispara a T31. |
| `salvar_chamada` com a chamada já concluída e alguma diferença | `22023`, *"Atualize o aplicativo para corrigir uma chamada já feita."* |
| `concluir_chamada` | Grava `attendance_taken_by` e `present = true` para quem chama. |
| `aulas_sem_chamada` | Mesmo retorno; exclui a aula cancelada. |
| `frequencia_mensal` (APK 1.8, web atual) | Mesma assinatura e colunas, **com o ritmo**: `total_classes` = esperado do mês; `counted_classes` = `expected_to_date`; `attended` = `attended_to_date`; `justified` = `excused`; `frequency_percent` = `attended_to_date ÷ expected_to_date × 100`, ou 100 com esperado 0. |
| `select('*')` em `attendance_monthly` | As colunas antigas continuam preenchidas (§ 11.6). |
| `salvar_horario_da_grade` sem `p_audience` | Criação: `'both'`. Edição: mantém o público. |
| Promoção com `color: null` (APK 1.8) | Mantém a cor antiga (§ 4). |
| Upsert direto de `declared_status` | Passa pelas travas de § 9.2. |
| `select` em `class_teachers` com as colunas `class_id, teacher_id, created_at` | Funciona (grant por coluna). |
| **v3:** `salvar_chamada` ou `concluir_chamada` (APK ≤ 1.8) numa aula cuja lista (§ 7.2) tem alguém com `origem` `'permanente'`, `'troca'`, `'troca_pendente'` ou `'extra'`, **ou (25/09) um fixo com `origem = 'turma'` que hoje está em outra turma ou sem turma** | `22023`, *"Atualize o aplicativo para fazer a chamada desta aula."* (T47). Sem isso, a primeira conclusão pelo APK velho expiraria as trocas pendentes e daria falta a quem mudou de turma depois da aula (D58), que ele não mostra. |
| **v3:** professor com APK 1.8 abre a chamada | Vê só a turma **atual** dos alunos, como hoje. O aluno que trocou a aula por outra aparece como da turma; marcá-lo ausente não grava nada (não é esperado). Quem veio por troca ou extra não aparece: a chamada dessa aula só sai pelo APK novo (linha acima). **25/09:** quem entrou na turma depois da aula aparece, mas não é esperado nela (ausente não grava nada; presente vira incluído); quem saiu da turma depois da aula não aparece, e a chamada dessa aula só sai pelo APK novo (linha acima). |
| **25/09:** admin muda a turma pelo APK 1.8 (`update` direto de `profiles.group_id`), a `create-student` cadastra com turma ou `excluir_turma` move os alunos | O gatilho `registrar_periodo_de_turma` grava o histórico e aplica a T53 **em todos os caminhos** (§ 5.2). O APK 1.8 não mostra o aviso da § 3 ao mudar a turma. |
| **25/09:** `select('*')` em `profiles` (APK 1.8, web atual) com `group_since` | Continua vindo, mantido pelo `marcar_entrada_na_turma` e igual ao início do período aberto; a conta não o usa mais (T51). |
| **v3:** aluno com APK 1.8 | Vê as aulas da turma, inclusive a que trocou pela web; **Vou/Não vou** nela: `23514`, *"Você trocou esta aula por outra."* Não vê menu, troca, extra nem contato (só a partir do APK novo ou da web nova). |
| **v3:** web atual: "Vou" (upsert de `declared_status`) numa aula de outra turma, sendo fixo | Vira **extra**, em aula de qualquer público (D56, 25/09). "Não vou" numa aula fora da grade é gravado como nulo (§ 9.2). |
| **v3:** upsert de justificativa (APK 1.8, web atual) na aula original de troca pendente ou aprovada | `23514`, *"Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova."* (§ 9.1 c). |
| **v3:** `select('*')` em `academy_settings` (APK 1.8) | Recebe `contact_whatsapp` a mais. Não quebra: é o contato público da academia. |
| **v3:** `frequencia_mensal` (APK 1.8, web atual) | Mesmo mapeamento acima, já com a grade efetiva (T33): troca, reposição e extra aparecem certos no número. |

**Fase B (depois de G6):**

- revogar o `select` direto de `reviewed_by` pelo aluno;
- revogar `plans.price_cents` para quem não é admin, com o preço servido por RPC;
- aposentar `salvar_chamada`, `concluir_chamada`, `frequencia_mensal` e a variante `{classId}`.

## 16. Pendências do dono (o contrato não inventa)

**Resolvidas na v3 (24/09):**

| Pendência da v2 | Resposta do dono | Onde entrou |
| --- | --- | --- |
| Prazo de guarda do atestado e dos anexos de motivo | **180 dias depois da decisão**; a decisão fica para sempre | D22, D54, § 5.2, § 8, G5 |
| Confirmar T21 (o professor da aula vê o motivo do cancelamento) | **Confirmada** | T21 |
| Confirmar T30 (semana sem aula livre suficiente não vira falta) | **Confirmada** | T30 |
| Confirmar T10 (média do Painel limitada a 100% por aluno) | **Vetada:** a média não tem teto | D55, T10, § 11.6 |
| Contato da academia para "procure a administração" (D42) | **WhatsApp e/ou e-mail** em Configurações | D42, D52, § 5.4 |

**Resolvidas em 25/09 (as perguntas da v3).** O dono respondeu P1, P10 e P18, confirmou a P2 e
deixou as demais **valendo como escolhidas, sem veto**. Nenhuma das P1–P22 continua aberta.

| # | Pergunta | Resposta do dono (25/09) | Onde entrou |
| --- | --- | --- | --- |
| P1 | O fixo pode marcar **extra** numa aula "só livres"? (a D47 fala só da troca) | **Sim, em qualquer aula** (o contrato tinha escolhido "não") | D56, T12, T40, T42, § 3, § 7.2, § 9.2, § 9.5, § 12, § 12.2, § 15 |
| P2 | Aprovar ou negar a troca exige escrever o motivo, como na D15? | **Confirmada:** negar, sempre; decidir a permanente, sempre; aprovar a avulsa, opcional | T41 |
| P3 | A regra da chamada (presença aprova, ausência expira) vale para a troca **permanente**? | Vale a escolhida: **não**, a permanente espera a decisão, até o prazo da P21 | T35 |
| P4 | A troca **expirada** avisa o aluno por push? Quem recebe o aviso de **pedido pendente**? | Vale a escolhida: sem push na expirada (a tela mostra); pendente: professores da aula nova (sem nenhum, os admins) e, na permanente, também os admins | T42 |
| P5 | Permanente aprovada no meio da semana pode deixar aquela semana **com uma aula a mais ou a menos**? | Vale a escolhida: **sim**, literal à D49 | T37 |
| P6 | O aluno pode **desistir** de uma troca já aprovada? | Vale a escolhida: só da avulsa, antes de as duas aulas começarem | T36 |
| P7 | Troca aprovada e ele **não vai** à aula nova: a falta fica na nova ou volta para a original? | Vale a escolhida: **na nova** | T36 |
| P8 | Troca **expirada** volta a valer se a presença na aula nova for corrigida depois? | Vale a escolhida: **sim**, se a original ainda estiver livre; senão, a presença conta como a mais | T35 |
| P9 | Aula nova **cancelada** com a troca pendente | Vale a escolhida com a original **ainda por vir** (a troca é cancelada e ele vai à original). **Ajustada em 25/09 pela coerência com a D57:** com a original **já começada**, a troca é aprovada pelo sistema e a vaga abonada, em vez de a falta ficar | T50, § 6.1, § 9.4, § 11.5 |
| P10 | O admin **muda o aluno de turma**: e as trocas? E o mês "recomeçar" na troca de turma (PR #31)? | **"Sim, nesta rodada":** histórico de turma; a turma antiga conta até a mudança e a nova a partir dela. As permanentes continuam acabando e as pendentes, canceladas; as avulsas só caem se a original ainda não começou | D58, T51–T53, § 3, § 5.2, § 7.2, § 9.4, § 11, § 12, § 12.1, G1, § 15 |
| P11 | **Vagas:** existe limite por aula? O menu mostra quantos vão? | Vale a escolhida: sem limite e sem contagem | T43 |
| P12 | O **WhatsApp** é o mesmo campo "Telefone"? | Vale a escolhida: campo novo; o "Telefone" continua e não aparece no contato | T44 |
| P13 | O aviso de atualização **bloqueia** alguma versão antiga? | Vale a escolhida: não, só informa | T48 |
| P14 | Professor com **APK 1.8** faz a chamada de uma aula com troca ou extra? | Vale a escolhida: recusa, pedindo para atualizar (em 25/09, também a aula com aluno que mudou de turma depois dela) | T47 |
| P15 | "Arquivo" na troca permanente inclui Word e outros? | Vale a escolhida: não, imagem ou PDF | T46 |
| P16 | Trocar uma aula que **já é troca** | Vale a escolhida: avulsa, não (desiste e pede de novo); permanente, sim, sempre a partir do horário original | T34, T37 |
| P17 | **Mockups** do menu de aulas, da troca, da extra, de "Revisar troca" e de "Falar com a academia" | **Publicados** no artifact "Mockups Snake Thai — Horário livre" (versão 6 em 24/09; **versões 7 e 8 em 25/09**, com as respostas de 25/09 e sem o cartão "Suas aulas", que nenhuma coluna traz), **linhas G e H** (menu, troca, extra, "Revisar troca", "Falar com a academia", aviso de atualização e mudança de turma). A aprovação continua sendo o G0 | G0 (§ 14) |
| P18 | **Reposição já aprovada** e a aula nova é **cancelada** antes de ele ir: a falta da original some ou volta? | **Vira abono** (o contrato tinha escolhido "volta"): o cancelamento é da academia; a aula nova é abonada como qualquer aula cancelada do fixo, e a falta da original não conta. Vale para toda troca avulsa aprovada, reposição ou não | D57, T39, T50, § 6.1, § 9.4, § 11.2, § 11.5 |
| P19 | A troca **só nesta semana** pode levar uma **justificativa opcional** (a D44 diz só que ela "não exige")? | Vale a escolhida: **não**; quem faltou por doença justifica a aula original em vez de trocar | § 9.4, T38 |
| P20 | A troca pode ter como destino um **evento**? (a D47 diz "qualquer aula") | Vale a escolhida: **não**; para ir ao evento, o fixo só marca **Vou** | T34, T40 |
| P21 | **Troca permanente pendente** que ninguém decide: fica pendente para sempre (com o atestado guardado e legível por quem decide)? | Vale a escolhida: **não**; é cancelada sozinha 30 dias depois da data da aula nova escolhida, e o anexo segue os 180 dias da D54 a partir daí | § 8, T39 |
| P22 | Um professor que **se inclui na aula nova depois do pedido** pode decidir a troca **permanente** e ler a justificativa (que pode ser atestado)? (a D45 diz "qualquer professor da aula nova") | Vale a escolhida: **não**; na permanente, só quem já estava vinculado à aula nova no pedido ou está escalado no horário de destino, além do admin | T49 |

**Abertas na revisão de 25/09.** Consequências das respostas acima em que o contrato precisou
escolher; o caminho vale se o dono não vetar até o G0:

| # | Pergunta | O que o contrato escolheu |
| --- | --- | --- |
| P23 | Troca **pendente** (ainda sem decisão) e a academia cancela a aula nova **depois de a aula original já ter passado** (ele não foi à original contando com a troca): abono ou falta? | **Abono**, como a D57: a troca é aprovada pelo sistema e a vaga abonada; se a aula for reativada, a troca volta a pendente e a chamada decide (D48). Com a original ainda por vir, a troca cai e ele vai à original (T50) |
| P24 | Na **mudança de turma**, a troca avulsa que sai de uma aula da turma antiga **que já passou** (ex.: faltou na quarta, reposição no sábado, mudou de turma na sexta) continua? | **Sim**: a aula que já passou continua sendo dele pela turma antiga, e cancelar a reposição devolveria a falta. Só cai a troca que sai de aula da turma antiga **ainda por vir** (T53) |
| P25 | O histórico de turma começa na migration: quem mudou de turma **entre 18/09 e a migration** fica, naquele mês, com a conta de hoje (só a turma nova desde a mudança)? | **Sim**: o período anterior não é reconstruído pelo `audit_log`, e as presenças de antes da mudança continuam fora, como hoje (T52) |

**25/09:** o dono abriu o G0 (mockups versão 8) sem vetar P23–P25; valem como escolhidas.

## 17. Histórico

| Versão | Data | Mudança |
| --- | --- | --- |
| v1 | 2026-09-24 | Primeira versão, a partir das decisões do dono e do mapeamento do código. |
| v2 | 2026-09-24 | Revisão adversarial por 5 lentes (fidelidade, banco, conta, dessincronia, segurança/LGPD), com cerca de 70 achados; decisões novas do dono: à vontade (D35–D41), reenvio (D42), seg–sáb (D9), qualquer professor retifica (D17) e "pede ao admin" nos dois sentidos (D30). **Mudanças estruturais:** tabelas laterais só para admin (auditoria da chamada, presença do professor, nota da decisão, tentativas); regras transversais (§ 0.1); compatibilidade em seção própria (§ 15); motivos de uso único; caminhos de anexo travados no banco e no worker; portões com checagem completa. |
| v3 | 2026-09-24 | Decisões novas do dono (D43–D55): menu de escolher aulas para as três modalidades; troca de aula do fixo, só nesta semana ou permanente, decidida pela equipe da aula nova ou por um admin, com "Troca pendente" resolvida pela chamada; aula extra do fixo sem aprovação; contato da academia; aviso de atualização do app; guarda de 180 dias; média do Painel sem teto. T21 e T30 confirmadas, T10 com a média vetada; D6, D22, D29, D34 e D42 ampliadas. **Estrutura nova:** § 9.4 (`class_swaps`, `class_swap_reviews`, `class_swap_periods` e a função única `grade_efetiva_do_fixo`), § 9.5, § 5.4, § 12.2 e § 12.3; T33–T48; § 16 com as perguntas abertas P1–P17. **Revisão adversarial da v3 no mesmo dia, antes de chegar aos ROADMAPs**, por 3 lentes (conta, segurança/LGPD, nomes), com 35 achados; a versão continua v3 porque nenhum chat implementou nada dela. **Mudanças da revisão:** período permanente "vigente" definido (T37), nunca encerrado no passado e já nascido com o fim do horário de destino; permanente recusada com mudança de plano marcada e com a original já começada; conferência na volta de expirada para aprovada (T35); aula nova de troca expirada visível e contestável; T49 (quem decide a permanente); `pode_ler_motivo` para a RLS dos motivos; `minhas_trocas_permanentes` e exportação completa; gatilho que protege `attachment_retention_days`; link do aviso de atualização montado pela tag; `can_swap_from_permanent`, `swap_decided_via`, `pela_chamada`; evento sem `'extra'`; destinatários de `aula_reativada`; § 11.5 corrigida e ampliada; perguntas P18–P22. **No servidor, a v3 acrescenta só** `allowed_formats` na assinatura e a exclusão nos três tipos de recurso (§ 13); os anexos da troca usam `/v1/motivos`. |
| v3 (revisão) | 2026-09-25 | **Respostas do dono às P1–P22** (§ 16), ainda antes de qualquer chat implementar a v3 (por isso continua v3). **D56:** o fixo marca extra em qualquer aula, inclusive "só livres" (veta o público da T40). **D57:** troca avulsa aprovada, inclusive a reposição, com a aula nova cancelada pela academia vira abono (veta a exceção da T39); **T50** estende à troca pendente com a original já começada (aprovada pelo sistema; a reativação a devolve a pendente). **D58: histórico de turma nesta rodada** — tabela `student_group_periods` gravada pelo gatilho `registrar_periodo_de_turma` em qualquer caminho (inclusive o APK 1.8), backfill a partir de `group_since` (T52), `grade_efetiva_do_fixo` pela turma da data da aula (T33, T51), trocas na mudança de turma pela T53, `excluir_turma` arquiva a turma com histórico e marca `'group_closed'`, `turmas_no_mes` no perfil do aluno, `periodos_de_turma` na exportação, `anonimizar_titular` apaga o histórico, T47 recusa no APK 1.8 a chamada com aluno que mudou de turma depois da aula, G1 com 15 tabelas. **T41 confirmada** (P2). P17: mockups publicados em 24/09 (versão 6, linhas G e H). § 3 com os rótulos da troca abonada, da turma por período e do aviso ao mudar a turma; § 11.5 com os casos novos; perguntas P23–P25. |
