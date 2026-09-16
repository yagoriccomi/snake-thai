# PLANO DE EXECUÇÃO — T9: Notificações push (Expo Notifications no Android) com fila de envio no Supabase

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T9` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/notificacoes-push` |
| **Esforço** | G |
| **Depende de** | T1 |

## 1. Enunciado

O plano é implantar push no Android com expo-notifications e o serviço de push da Expo, com tokens por usuário e aparelho numa tabela com RLS e opt-in explícito (permissão POST_NOTIFICATIONS). O envio sai de uma Edge Function `send-push`, chamada pelo pg_cron via pg_net, que consome uma fila no banco com deduplicação. É o mesmo padrão da `media_deletion_queue`, e o snake-server fica de fora: o plano grátis hiberna, ele recusa a service_role e cron na Render é pago. Os eventos cobertos são vencimento próximo e atraso (aluno), comprovante enviado (admin), justificativa pendente (professor/admin) e aula sem chamada (professor/admin), sempre no fuso de São Paulo, com limpeza de tokens inválidos por recibo, variante DEV separada e teste completo no Supabase local em Docker.

## 2. Terreno (situação verificada)

- expo-notifications NÃO está instalado. A versão compatível com o SDK instalado é ~57.0.12.  
  _Evidência:_ snake-thai/package.json (dependencies sem expo-notifications); node_modules/expo/package.json version 57.0.14; node_modules/expo/bundledNativeModules.json: "expo-notifications": "~57.0.12", "expo-constants": "~57.0.12"
- expo-constants existe só como dependência transitiva, fora do package.json. Ele é necessário para ler o projectId.  
  _Evidência:_ ls node_modules/expo-constants existe; package.json não lista expo-constants
- Não há projeto EAS vinculado: sem extra.eas.projectId nem owner no app.json, sem eas.json e sem eas-cli instalado. Sem projectId, getExpoPushTokenAsync não gera token.  
  _Evidência:_ app.json (sem bloco extra); `ls eas.json` → No such file; `eas --version` → command not found; docs.expo.dev/push-notifications/push-notifications-setup exige projectId
- O app.json não tem android.googleServicesFile nem plugin de notificações, e a configuração é estática (não existe app.config.*). O pacote é com.snakethai.app.  
  _Evidência:_ app.json: android.package "com.snakethai.app"; plugins = expo-secure-store, expo-font, expo-splash-screen, ./plugins/withReleaseSigning.js, expo-local-authentication, expo-image-picker
- O google-services.json já é bloqueado pelo .gitignore, e o repositório é público.  
  _Evidência:_ snake-thai/.gitignore:47 `google-services.json`
- A documentação registra que não há push hoje: o aviso de aula sem chamada existe só dentro do app, e o push de vencimento e atraso consta como FALTA.  
  _Evidência:_ docs/FREQUENCIA.md:165 e :170; docs/FUNCIONALIDADES.md:76 `[ ] P1 Push de vencimento e atraso · FALTA`
- A tela já promete uma notificação que não existe.  
  _Evidência:_ src/screens/financeiro/PagamentoScreen.tsx:159 "Você será notificado após a aprovação."
- O pg_cron já está em uso, com agenda em UTC. pg_net e Vault não são usados em nenhuma migration.  
  _Evidência:_ 20260727160100_payments_overdue_cron.sql:37 '1 0 * * *'; 20260904200000_geracao_mensalidades.sql:241 cron.schedule; 20260914140000_frequencia_regras.sql:307 '20 3 1 * *' (comentário: 00:20 SP = 03:20 UTC); grep por pg_net/vault em supabase/migrations sem resultado
- Problema de fuso que já existe: mark_overdue_payments roda às 00:01 UTC (21:01 em São Paulo do dia anterior) comparando com current_date em UTC. A mensalidade vira 'overdue' 3 horas antes de terminar o dia do vencimento em SP. Por isso o push de atraso não pode confiar no status 'overdue'.  
  _Evidência:_ 20260727160100_payments_overdue_cron.sql:24 `and due_date < current_date;` e :37 `'1 0 * * *'`
- aulas_sem_chamada() filtra pelo JWT (is_admin ou professor da aula). No contexto do cron (auth.uid() nulo) ela devolve vazio, então não serve para o cron. A regra dela é 1h de tolerância, só aulas de rotina do mês corrente em SP.  
  _Evidência:_ 20260914140000_frequencia_regras.sql:205 (definição), :221 `date_time < p_referencia - interval '1 hour'`, :225 `public.is_admin()`
- 'Comprovante enviado' é um UPDATE em payments para status='pending_approval'. Aprovar ou recusar também é UPDATE feito pelo admin.  
  _Evidência:_ src/services/proofs.service.ts:108-111 (.update({ status: 'pending_approval', ...campos })); src/services/payments.service.ts:102-109 (approvePayment) e :118-139 (rejectPayment volta para 'open')
- A justificativa entra por upsert em (class_id,user_id) e nasce 'pending'. Os professores da aula vêm de class_teachers.  
  _Evidência:_ src/services/justifications.service.ts:93-100; 20260914120100_frequencia_fundacao.sql (tabela absence_justifications, trigger enforce_absence_justification_rules); 20260903120100_professores.sql (class_teachers)
- Já existe um padrão de fila (outbox) consumida por um processo de servidor: RLS sem policy para authenticated e grants só para service_role. A falta de GRANT para service_role já derrubou produção uma vez.  
  _Evidência:_ 20260831120000_proofs_cloudinary_contract.sql seção 4 (media_deletion_queue); docs/RUNBOOK.md seção 'GRANTs importam'; 20260914120100_frequencia_fundacao.sql comentário sobre 20260901120000
- As Edge Functions são Deno com supabase-js via esm.sh e helper json()/CORS. O config.toml não tem seção [functions], então verify_jwt fica no padrão.  
  _Evidência:_ supabase/functions/delete-my-account/index.ts:30-48; `grep functions|verify_jwt supabase/config.toml` sem resultado
- delete-my-account anonimiza o perfil sem apagar auth.users. O ON DELETE CASCADE nunca dispara, então tokens de push não seriam removidos automaticamente.  
  _Evidência:_ supabase/functions/delete-my-account/index.ts:1-27 (cabeçalho) e passos 1-3
- O snake-server não é bom lugar para o despachante: o serviço web está no plano free e hiberna, o servidor trata SUPABASE_SERVICE_ROLE_KEY como variável de risco, e Cron Job na Render é pago (starter). A doc dele previa um módulo notifications.  
  _Evidência:_ snake-server/render.yaml:14 `plan: free`, :82 `plan: starter`; snake-server/src/config/env.ts:20-25; snake-server/docs/BACKEND.md:288; snake-server/docs/ARQUITETURA.md (Plano free HIBERNA)
- A navegação é condicional (Loading/Login/Onboarding/BiometricLock/Main) e não tem navigationRef. Por isso, abrir uma tela ao tocar na notificação exige um ref e uma intenção pendente até o app sair do bloqueio.  
  _Evidência:_ src/navigation/RootNavigator.tsx:66-85 (`<NavigationContainer theme={navigationTheme} onReady={onReady}>` sem ref); src/navigation/types.ts (abas Aulas/Financeiro/Dados)
- A tela de Perfil já tem o padrão de Switch com acessibilidade (digital), que pode ser espelhado para a preferência de notificação.  
  _Evidência:_ src/screens/dados/DadosScreen.tsx:410-430
- Ferramentas locais disponíveis: Supabase CLI 2.117.0 e Deno 2.9.2. O job 'banco' do CI já sobe o Postgres local e roda TODOS os supabase/tests/*.sql.  
  _Evidência:_ `npx supabase --version` → 2.117.0; `deno --version` → 2.9.2; .github/workflows/ci.yml:85 `supabase db start` e :91 `for arquivo in supabase/tests/*.sql`
- Os testes SQL seguem o padrão transação + ROLLBACK, com `set local role authenticated` e claims de JWT, e o cabeçalho diz que podem rodar contra produção (prática que o usuário quer abandonar).  
  _Evidência:_ supabase/tests/regressao_chamada_em_lote.sql:1-12 e :55-58
- Não existe ícone de notificação (PNG branco com fundo transparente). Existe um ícone monocromático adaptativo que pode servir de base.  
  _Evidência:_ ls assets → android-icon-monochrome.png, sem notification-icon.png
- O logger do app já mascara chaves 'token', então o token de push não vaza se for logado por engano.  
  _Evidência:_ src/lib/logger.ts SENSITIVE_KEYS inclui 'token'
- Estado do repositório: branch feat/papel-professor limpa, 10 commits à frente de origin/main.  
  _Evidência:_ `git status` → working tree clean; `git rev-list --count origin/main..feat/papel-professor` → 10

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Por qual serviço mandar o push?**

- Serviço de push da Expo (conta Expo + chave FCM V1 enviada ao expo.dev; o app usa getExpoPushTokenAsync)
- FCM HTTP v1 direto do Google (sem conta Expo; a Edge Function assina OAuth com a conta de serviço; o app usa getDevicePushTokenAsync)

➡️ _Adotado:_ Serviço da Expo. É o que foi pedido, tem menos código (sem assinatura OAuth na função), recibos com DeviceNotRegistered prontos, e é grátis (limite de 600 notificações por segundo por projeto).

**P2. Onde roda o despachante?**

- Edge Function `send-push` chamada pelo pg_cron via pg_net (a cada minuto, só quando houver fila)
- snake-server na Render (módulo notifications)

➡️ _Adotado:_ Edge Function. No snake-server o plano free hiberna, o servidor recusa a service_role no serviço web e cron na Render é pago (render.yaml:82).

**P3. Como organizar o Firebase para PROD e DEV?**

- Um projeto Firebase com dois apps Android (com.snakethai.app e o pacote DEV definido na T1)
- Dois projetos Firebase separados

➡️ _Adotado:_ Um projeto com dois apps. A mesma chave FCM V1 serve aos dois application identifiers no expo.dev, e o isolamento de dados já vem do banco separado e da coluna app_variant.

**P4. O google-services.json entra no Git?**

- Não: fica fora do Git (o .gitignore já bloqueia) e é injetado no build por caminho em variável de ambiente (e por Secret no GitHub Actions)
- Sim: a Expo diz que ele só tem identificadores públicos

➡️ _Adotado:_ Manter fora do Git, porque o repositório é público e a chave de API do arquivo pode ser usada para abuso de cota. A variável fica GOOGLE_SERVICES_JSON apontando para o arquivo.

**P5. Quando lembrar do vencimento da mensalidade (aluno)?**

- 3 dias antes e no dia, às 09:00 de São Paulo
- Só 1 dia antes, às 09:00
- Só no dia do vencimento

➡️ _Adotado:_ 3 dias antes e no dia, às 09:00 SP (pg_cron '0 12 * * *' UTC). Só vale para mensalidade 'open'; quem já enviou comprovante não recebe.

**P6. Quantas vezes avisar sobre atraso (aluno)?**

- No dia seguinte ao vencimento e 7 dias depois (no máximo 2 avisos)
- Só no dia seguinte
- Toda semana até pagar

➡️ _Adotado:_ D+1 e D+7, no máximo 2 avisos. O atraso é calculado pela data de SP e não pelo status 'overdue', que muda 3h antes (ver situação atual).

**P7. Na primeira ativação, avisar mensalidades que já estavam atrasadas havia tempo?**

- Não: só eventos dentro de uma janela curta de recuperação (2 dias)
- Sim: mandar aviso para todo o atraso acumulado

➡️ _Adotado:_ Não. Evita uma enxurrada de cobranças no dia do deploy.

**P8. Quem recebe o aviso de justificativa pendente?**

- Professores da aula; o admin só quando a aula não tem professor
- Professores da aula e todos os admins, sempre
- Só admins

➡️ _Adotado:_ Professores da aula, com o admin só quando a aula não tem professor. É quem revisa (RLS/trigger já permitem) e reduz ruído para o admin.

**P9. Aviso de aula sem chamada: como avisar professor e admin?**

- Professor recebe um aviso por aula 1h após o início; admin recebe um resumo diário às 21:00 SP
- Professor e admin recebem um aviso por aula
- Só o resumo diário para todos

➡️ _Adotado:_ Professor por aula (mesma tolerância de 1h de aulas_sem_chamada) e admin com resumo diário às 21:00 SP.

**P10. O texto da notificação pode ter nome do aluno ou valor?**

- Não: texto genérico, e o detalhe aparece ao abrir o app
- Sim: nome e valor na notificação

➡️ _Adotado:_ Texto genérico. O conteúdo passa por Expo e Google (fora do Brasil) e aparece na tela bloqueada. O título da aula e o horário podem aparecer, porque não são dados pessoais.

**P11. Horário de silêncio para avisos disparados por eventos (comprovante, justificativa)?**

- Segurar entre 22:00 e 07:00 SP e entregar às 07:00
- Entregar na hora, a qualquer horário

➡️ _Adotado:_ Segurar entre 22:00 e 07:00, usando send_after na fila.

**P12. Notificar o aluno quando o comprovante for aprovado ou recusado (a tela já promete isso)?**

- Sim: incluir os tipos comprovante_aprovado e comprovante_recusado
- Não: trocar o texto de PagamentoScreen.tsx:159

➡️ _Adotado:_ Incluir. É o mesmo mecanismo, com dois tipos a mais, e cumpre a promessa da tela.

**P13. Quando pedir a permissão de notificação?**

- Cartão explicativo com 'Ativar' e 'Agora não' após o login, mais um switch no Perfil
- Pedir a permissão do sistema logo ao abrir o app

➡️ _Adotado:_ Cartão mais switch. No Android 13+ uma recusa é difícil de reverter; o prompt do sistema só aparece depois do toque em 'Ativar'.

**P14. Preferências por tipo de aviso ou um liga/desliga geral?**

- Liga/desliga geral por aparelho (v1)
- Um switch por tipo (financeiro, frequência)

➡️ _Adotado:_ Geral por aparelho no v1. Os canais Android 'Financeiro' e 'Frequência' já permitem silenciar por tipo nas configurações do sistema.

**P15. Por quanto tempo guardar o histórico de envios (fila e recibos)?**

- 30 dias
- 90 dias

➡️ _Adotado:_ 30 dias, por minimização (LGPD). Basta para depurar falhas.

**P16. Onde guardar o teste SQL de regressão das notificações, dado o 'Esquece o CI'?**

- Em supabase/tests/ (a pasta que o job 'banco' existente já percorre, sem mexer no workflow)
- Em outra pasta só para execução local (ex.: supabase/tests-local/)

➡️ _Adotado:_ supabase/tests/, seguindo a convenção do repositório e sem editar o workflow. Se o usuário quiser literalmente nada novo rodando no CI, usar supabase/tests-local/.

## 4. Ações que só o usuário pode fazer

- [ ] Criar (ou usar) uma conta em expo.dev e rodar `npx eas-cli login` e `npx eas-cli init` na pasta snake-thai. Isso grava extra.eas.projectId e owner na configuração; o login é interativo e só o usuário faz.
- [ ] Criar o projeto no console do Firebase (console.firebase.google.com) e registrar dois apps Android: com.snakethai.app e o pacote DEV definido na T1 (ex.: com.snakethai.app.dev). Não é preciso SHA-1 para o FCM.
- [ ] Baixar o google-services.json e salvar na raiz de snake-thai, sem commitar (o .gitignore já bloqueia). Conferir que o arquivo lista os dois package_name.
- [ ] Gerar a chave da conta de serviço (Firebase > Configurações do projeto > Contas de serviço > Gerar nova chave privada) e enviar em expo.dev > projeto > Credentials > Android > <application identifier> > FCM V1 service account key, repetindo para os dois identifiers. Depois apagar a cópia local do JSON, que nunca pode ir ao repositório.
- [ ] (Recomendado) Ativar 'Enhanced Push Security' no expo.dev e criar um Access Token, que vira o segredo EXPO_ACCESS_TOKEN da Edge Function.
- [ ] Aprovar e executar em PRODUÇÃO: `supabase db push` das migrations novas; `supabase secrets set PUSH_DISPATCH_SECRET=<aleatório> EXPO_ACCESS_TOKEN=<token> PUSH_APP_VARIANT=production`; `supabase functions deploy send-push --no-verify-jwt`; e no SQL Editor do painel, criar no Vault os segredos push_project_url e push_dispatch_secret. Nenhum valor passa pelo chat nem pelo Git.
- [ ] Revisar e aprovar a nova versão da Política de Privacidade (legal_documents): push, token do aparelho como dado pessoal, operadores Expo e Google, retenção de 30 dias.
- [ ] Responder às decisões listadas (horários, frequência de atraso, destinatários, texto, silêncio noturno).
- [ ] Autorizar commits, push da branch e PR/merge, conforme a regra do repositório.
- [ ] Testar no Samsung SM-S928B: tocar em 'Ativar', aceitar o prompt do Android, receber as notificações de teste e tocar nelas com o app fechado e aberto.

## 5. Passos atômicos

### Passo 1

Pré-requisitos externos (AÇÃO DO USUÁRIO, ver acoes_do_usuario): conta Expo com `eas init`, projeto Firebase com os 2 apps Android, google-services.json na raiz e chave FCM V1 enviada ao expo.dev para os 2 identifiers. Enquanto isso não fica pronto, os passos 3 a 7 e 10 a 14 podem avançar: banco, função e código não dependem das credenciais.

_Arquivos:_ `app.json (ou app.config.ts da T1): extra.eas.projectId, owner`, `google-services.json (fora do Git)`

**Como verificar:** `git check-ignore google-services.json` imprime o caminho (ignorado); o bloco extra.eas.projectId aparece em `npx expo config --type public`; o expo.dev mostra a 'FCM V1 service account key' nos dois application identifiers; um envio manual pela ferramenta https://expo.dev/notifications chega ao aparelho depois do passo 13.

### Passo 2

Criar a branch `feat/notificacoes-push` a partir da main já com a T1 integrada (variantes DEV/PROD e Supabase local em Docker). Subir o banco local com `supabase start`; é Docker local, nunca produção.

**Como verificar:** `git status` limpo na branch nova; `supabase status` mostra API em 127.0.0.1:54321 e DB em 54322.

### Passo 3

Migration A (`supabase migration new push_dispositivos`): (a) enums `public.push_platform ('android','ios')` e `public.app_variant ('production','development')`; (b) tabela `public.push_devices` com id uuid pk, user_id uuid NOT NULL references profiles(id) on delete cascade, expo_token text NOT NULL UNIQUE check `expo_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'`, platform, app_variant, created_at, updated_at (trigger handle_updated_at), last_seen_at, e índice em user_id; (c) RLS ligada com policies `push_devices_select_own` e `push_devices_delete_own` (user_id = (select auth.uid())), SEM policy de insert/update; (d) RPC `public.registrar_dispositivo_push(p_token text, p_plataforma push_platform, p_variante app_variant) returns uuid` security definer com search_path='': exige auth.uid(), recusa perfil anonimizado e faz `insert ... on conflict (expo_token) do update set user_id = auth.uid(), app_variant, last_seen_at = now()`. Isso reatribui o aparelho quando outra pessoa loga nele e a RLS não permitiria fazer por UPDATE. Mantém no máximo 5 aparelhos por usuário (constante nomeada), apagando os de last_seen_at mais antigo; (e) grants: execute da RPC só para authenticated (revoke de public e anon), `grant select, delete on push_devices to authenticated` e `grant select, insert, update, delete ... to service_role`; (f) trigger AFTER UPDATE OF anonymized_at em profiles: quando anonymized_at passa de nulo a preenchido, apaga os push_devices do titular. Cobre delete-my-account e qualquer outro caminho de exclusão LGPD.

_Arquivos:_ `supabase/migrations/<timestamp>_push_dispositivos.sql`

**Como verificar:** `supabase db reset` (local) aplica sem erro; `\d public.push_devices` no psql local; `select has_function_privilege('anon','public.registrar_dispositivo_push(text,public.push_platform,public.app_variant)','execute')` = false.

### Passo 4

Migration B (`supabase migration new notificacoes_fila`): (a) `create extension if not exists pg_net;` (b) enums `public.notification_kind` ('mensalidade_vence_em_breve','mensalidade_vence_hoje','mensalidade_atrasada','comprovante_enviado','comprovante_aprovado','comprovante_recusado','justificativa_pendente','aula_sem_chamada','aulas_sem_chamada_resumo', conforme as decisões) e `public.notification_status` ('pending','sending','sent','cancelled','failed'); (c) tabela `public.notification_outbox` com id, recipient_id → profiles on delete cascade, kind, dedupe_key text, payment_id/class_id/justification_id opcionais com FK on delete cascade, data jsonb pequeno (ex.: {"dias":3} ou {"quantidade":2}), send_after timestamptz default now(), status, attempts, last_error, created_at, sent_at; UNIQUE(recipient_id, dedupe_key) é a deduplicação; índice parcial (send_after) where status='pending'; (d) tabela `public.notification_deliveries` com id, outbox_id → outbox on delete cascade, device_id → push_devices on delete set null, expo_ticket_id, ticket_status, error_code, created_at, receipt_checked_at, e índice parcial para recibos pendentes; (e) nas duas tabelas: RLS ligada sem policy, `revoke all ... from anon, authenticated` e grants a service_role (mesmo padrão da media_deletion_queue); (f) função interna `public.enfileirar_notificacao(...)` com `on conflict do nothing`, que aplica o silêncio noturno calculando send_after para as 07:00 SP quando o horário local cai entre 22:00 e 07:00; (g) trigger AFTER UPDATE OF status em payments: quando new.status='pending_approval' e o anterior era outro, enfileira 'comprovante_enviado' para cada admin ativo e não anonimizado, com dedupe `comprovante_enviado:<payment_id>:<epoch(now())>` (reenvio depois de recusa gera novo aviso). Pelas decisões, também paid → comprovante_aprovado e pending_approval → open → comprovante_recusado para o aluno. O corpo fica em bloco `exception when others then raise warning`, com comentário do porquê: uma falha na notificação não pode impedir o aluno de enviar o comprovante; (h) trigger AFTER INSERT em absence_justifications com status='pending' enfileira 'justificativa_pendente' para os professores da aula (class_teachers) e, pela decisão, para os admins só se a aula não tiver professor. Dedupe `justificativa_pendente:<id>`; (i) `public.enfileirar_lembretes_de_mensalidade(p_agora timestamptz default now()) returns integer`: com v_hoje := (p_agora at time zone 'America/Sao_Paulo')::date, pega só alunos role='user', status='active', anonymized_at null e com ao menos um push_device. Vence em breve: status='open' e due_date entre v_hoje+2 e v_hoje+3 (dedupe `...:<payment_id>:<due_date>`). Vence hoje: status='open' e due_date=v_hoje. Atrasada: status in ('open','overdue') e due_date entre v_hoje-2 e v_hoje-1 (marco d1) ou entre v_hoje-8 e v_hoje-7 (marco d7). As janelas de 2 dias recuperam um dia perdido do cron sem enxurrada de atrasos antigos; (j) `public.enfileirar_avisos_aula_sem_chamada(p_agora timestamptz default now())`: aulas de rotina com attendance_taken_at null, date_time < p_agora - interval '1 hour' e date_time >= p_agora - interval '24 hours', uma linha por professor (dedupe `aula_sem_chamada:<class_id>`). Mais `public.enfileirar_resumo_aulas_sem_chamada(p_agora)` para os admins (dedupe `aulas_sem_chamada_resumo:<data SP>`, data.quantidade); (k) `public.reivindicar_notificacoes(p_limite integer, p_variante app_variant)`: 1) devolve para 'pending' as linhas presas em 'sending' há mais de 10 min; 2) marca 'cancelled' (last_error='obsoleta') as vencidas que perderam o sentido: pagamento já pago ou em análise para lembrete e atraso, justificativa já revisada, chamada já concluída, destinatário anonimizado ou inativo; 3) marca 'cancelled' ('sem_dispositivo') as que não têm aparelho da variante; 4) `update ... set status='sending', attempts=attempts+1 where id in (select ... where status='pending' and send_after<=now() order by created_at limit p_limite for update skip locked) returning`, com join nos push_devices de app_variant = p_variante; (l) `public.disparar_envio_de_push()` security definer: lê `push_project_url` e `push_dispatch_secret` de vault.decrypted_secrets e, se algum faltar, faz `raise warning` e retorna sem erro (CI e ambiente sem configuração não quebram). Só chama `net.http_post(url := <url>||'/functions/v1/send-push', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||<segredo>), body := '{}'::jsonb, timeout_milliseconds := 10000)` se houver fila vencida ou recibos com mais de 15 min por conferir; (m) `public.limpar_notificacoes_antigas(p_agora)`: apaga outbox e deliveries finalizadas há mais de 30 dias e `cron.job_run_details` com mais de 7 dias (o job de minuto gera cerca de 1.440 linhas por dia); (n) revoke execute de public, anon e authenticated em todas as funções internas e grant a service_role em reivindicar_notificacoes; (o) cron.schedule em UTC, com o comentário de que SP não tem horário de verão desde 2019: 'push-lembretes-mensalidade' '0 12 * * *' (09:00 SP), 'push-aulas-sem-chamada' '*/15 * * * *', 'push-resumo-aulas-sem-chamada' '0 0 * * *' (21:00 SP), 'push-despachar' '* * * * *' → select public.disparar_envio_de_push(), 'push-limpeza' '30 6 * * *' (03:30 SP). Nenhum segredo ou URL na migration.

_Arquivos:_ `supabase/migrations/<timestamp>_notificacoes_fila.sql`

**Como verificar:** `supabase db reset` local sem erro; `select jobname, schedule from cron.job where jobname like 'push-%'` lista os 5 jobs; `select public.disparar_envio_de_push()` sem segredos no Vault gera só WARNING; `select has_function_privilege('authenticated','public.enfileirar_lembretes_de_mensalidade(timestamptz)','execute')` = false.

### Passo 5

Teste SQL de regressão (transação + ROLLBACK, massa com UUIDs próprios e competências em 2030, como os existentes). Cabeçalho SEM a frase 'pode rodar contra produção': roda só no banco local. Cenários: T1 aluno registra o próprio token pela RPC e lê só os seus; T2 aluno não lê token de outro nem insere direto na tabela (42501); T3 o mesmo token registrado por outro usuário muda de dono; T4 token malformado é recusado; T5 anonimizar o perfil apaga os aparelhos; T6 aluno enviando comprovante (status → pending_approval) gera 1 linha por admin ativo, e repetir o mesmo UPDATE não duplica; T7 inserir justificativa gera linhas para os professores da aula e não para professor de outra aula; T8 enfileirar_lembretes_de_mensalidade com p_agora fixo gera D-3, D0, D+1 e D+7, e rodar duas vezes não duplica; T9 caso de fuso: p_agora = 02:30 UTC do dia X (23:30 SP do dia X-1) usa a data de SP; T10 mensalidade 'pending_approval' ou 'paid' não recebe lembrete; T11 aluno inativo ou anonimizado não recebe; T12 aula com chamada concluída não gera aviso, e aula de 3 dias atrás não gera (janela de 24h); T13 reivindicar_notificacoes cancela linha obsoleta (pagamento pago depois de enfileirar) e só devolve aparelhos da variante pedida; T14 authenticated não executa as funções internas; T15 horário de silêncio: evento às 23:00 SP recebe send_after às 07:00 SP.

_Arquivos:_ `supabase/tests/regressao_notificacoes.sql (ou supabase/tests-local/, conforme decisão)`

**Como verificar:** `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/regressao_notificacoes.sql` termina com exit 0 e ROLLBACK; os testes SQL existentes continuam passando no mesmo loop.

### Passo 6

Edge Function `send-push`. index.ts: aceita só POST; compara `Authorization: Bearer` com Deno.env PUSH_DISPATCH_SECRET em tempo constante (401 se diferente); cria o client service_role (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm do runtime). FASE RECIBOS: busca deliveries com ticket, criadas há mais de 15 min e sem receipt_checked_at; POST https://exp.host/--/api/v2/push/getReceipts com até 1000 ids; DeviceNotRegistered apaga o push_device; MessageRateExceeded e erros transitórios ficam para a próxima rodada; InvalidCredentials e MismatchSenderId geram log de erro de configuração (FCM/EAS). FASE ENVIO: rpc reivindicar_notificacoes(200, PUSH_APP_VARIANT); agrupa por destinatário e tipo agregável (comprovante_enviado vira 'N comprovantes aguardando análise'); monta as mensagens {to, title, body, data:{tipo, paymentId|classId|justificationId}, channelId:'financeiro'|'frequencia', priority:'high', ttl}; manda em lotes de 100 para https://exp.host/--/api/v2/push/send com headers Accept, Accept-Encoding gzip, Content-Type e Authorization Bearer EXPO_ACCESS_TOKEN (se definido); grava deliveries por ticket; ticket com DeviceNotRegistered apaga o aparelho; outbox fica 'sent' com ao menos um ticket ok, volta a 'pending' com send_after exponencial em HTTP 429/5xx e vira 'failed' depois de 5 tentativas. Responde JSON só com contagens. Logs em JSON com ids mascarados, sem token, nome ou texto. Módulos puros testáveis: mensagens.ts (tipo → título e corpo em pt-BR sem PII, com horário da aula formatado por Intl em America/Sao_Paulo) e expo.ts (emLotes, classificarTicket, classificarRecibo, compararSegredo).

_Arquivos:_ `supabase/functions/send-push/index.ts`, `supabase/functions/send-push/expo.ts`, `supabase/functions/send-push/mensagens.ts`, `supabase/functions/send-push/expo.test.ts`, `supabase/functions/send-push/mensagens.test.ts`, `supabase/functions/.env.example (só nomes: PUSH_DISPATCH_SECRET, EXPO_ACCESS_TOKEN, PUSH_APP_VARIANT)`, `supabase/config.toml (acrescentar `[functions.send-push]` com `verify_jwt = false`, protegida pelo segredo próprio)`

**Como verificar:** `deno test supabase/functions/send-push/` verde (lotes de 100/1000, classificação de DeviceNotRegistered, MessageRateExceeded e InvalidCredentials, textos sem nome nem valor); `deno check supabase/functions/send-push/index.ts` sem erro.

### Passo 7

Ensaio local do despachante sem o app: criar supabase/functions/.env (ignorado pelo padrão `.env` do .gitignore) com PUSH_DISPATCH_SECRET aleatório local e PUSH_APP_VARIANT=development; no psql local, `select vault.create_secret('http://host.docker.internal:54321','push_project_url'); select vault.create_secret('<mesmo segredo local>','push_dispatch_secret');` (se host.docker.internal não resolver dentro do container, usar o nome do container Kong que `docker ps` mostrar, ex.: http://supabase_kong_snake-thai:8000); `supabase functions serve send-push --env-file supabase/functions/.env --no-verify-jwt`; inserir via psql um push_device com token fictício bem formado e uma linha pendente na fila.

**Como verificar:** `curl -X POST http://127.0.0.1:54321/functions/v1/send-push` sem header → 401; com `-H "Authorization: Bearer <segredo local>"` → 200 com contagens; o token fictício volta com DeviceNotRegistered e é APAGADO de push_devices; a linha da fila fica 'cancelled' ou 'failed' com last_error; em até 1 min `select status, return_message from cron.job_run_details where jobname='push-despachar' order by start_time desc limit 3` mostra 'succeeded' e `select status_code from net._http_response order by created desc limit 3` mostra 200.

### Passo 8

Dependências e configuração nativa: `npx expo install expo-notifications expo-constants` (instala as versões ~57.0.12 do SDK). Na configuração do app (app.config.ts da T1, ou app.json se a T1 não criar): `android.googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`; plugin `['expo-notifications', { icon: './assets/notification-icon.png', color: '#39FF14', defaultChannel: 'geral' }]`; extra.eas.projectId (do passo 1); extra.appVariant 'production' ou 'development' conforme a variante. Criar assets/notification-icon.png 96x96, todo branco com fundo transparente, derivado de android-icon-monochrome.png. Documentar GOOGLE_SERVICES_JSON no .env.example.

_Arquivos:_ `package.json`, `package-lock.json`, `app.config.ts (ou app.json)`, `assets/notification-icon.png`, `.env.example`

**Como verificar:** `npx expo config --type prebuild` mostra o plugin, o googleServicesFile e o projectId; depois de `npx expo prebuild --platform android --clean` (máquina de desenvolvimento), android/app/src/main/AndroidManifest.xml final tem `android.permission.POST_NOTIFICATIONS` e android/app/google-services.json existe; `npm run typecheck` verde.

### Passo 9

Regenerar os tipos do banco a partir do banco LOCAL: `npm run supabase:types` (o script já usa `--local`).

_Arquivos:_ `src/types/database.types.ts`

**Como verificar:** O arquivo passa a conter push_devices, registrar_dispositivo_push e os enums novos; `npm run typecheck` verde.

### Passo 10

Camada de serviço e estado no app (telas nunca importam supabase nem expo-notifications direto): (a) `src/services/pushNotifications.service.ts` com configurarCanais() chamando setNotificationChannelAsync para 'financeiro' (HIGH), 'frequencia' (DEFAULT) e 'geral' ANTES de pedir permissão ou token, como o Android 13 exige; lerPermissao(); pedirPermissao(); obterTokenExpo() lendo o projectId de Constants.expoConfig.extra.eas.projectId (erro tipado se faltar); registrarDispositivo(token) chamando supabase.rpc('registrar_dispositivo_push', {p_token, p_plataforma:'android', p_variante}); removerDispositivo(token) com delete por expo_token (RLS delete_own); (b) `src/services/pushPreference.service.ts`, mesmo padrão de biometricPreference.service.ts, com estado por usuário 'ativado' | 'desativado' | 'indefinido' e o último token registrado; (c) `src/utils/notificationRouting.ts` (puro) que valida o `data` recebido (tipo conhecido e UUID válido) e devolve a rota: tipos financeiros → Main/Financeiro/FinanceiroHome, justificativa e aula → Main/Aulas/AulasHome, payload desconhecido → null; (d) `src/hooks/usePushNotifications.ts` e `src/context/PushNotificationsProvider.tsx` (dentro do AuthProvider em App.tsx): com sessão, perfil onboarded e preferência 'ativado', a cada abertura configura canais, confere permissão, obtém token e registra (atualiza last_seen_at); assina addPushTokenListener para registrar de novo; expõe status, ativar() e desativar(); (e) `Notifications.setNotificationHandler` em escopo de módulo com shouldShowBanner:true, shouldShowList:true, shouldPlaySound:false, shouldSetBadge:false (nomes a confirmar na tipagem instalada).

_Arquivos:_ `src/services/pushNotifications.service.ts`, `src/services/pushPreference.service.ts`, `src/utils/notificationRouting.ts`, `src/hooks/usePushNotifications.ts`, `src/context/PushNotificationsProvider.tsx`, `App.tsx`

**Como verificar:** `npm run typecheck` verde, sem `any`.

### Passo 11

Interface do opt-in: (a) na DadosScreen, seção 'NOTIFICAÇÕES' com Switch 'Receber notificações' (accessibilityLabel e accessibilityHint, espelhando o switch de digital em DadosScreen.tsx:410-430). Se a permissão estiver negada sem poder perguntar de novo (canAskAgain=false), mostrar o aviso e um botão 'Abrir configurações' (Linking.openSettings()); (b) componente `NotificationOptInCard` com texto curto do porquê, 'Ativar' e 'Agora não', exibido uma vez na AulasHome enquanto a preferência for 'indefinido'. 'Agora não' grava 'desativado' e não pergunta de novo; (c) se a decisão for não notificar aprovação, trocar o texto de PagamentoScreen.tsx:159.

_Arquivos:_ `src/screens/dados/DadosScreen.tsx`, `src/components/NotificationOptInCard.tsx`, `src/screens/aulas/AulasHomeScreen.tsx`, `src/screens/financeiro/PagamentoScreen.tsx (condicional)`

**Como verificar:** Teste RNTL do NotificationOptInCard ('Ativar' chama ativar; 'Agora não' grava desativado; role e label acessíveis); no aparelho, o prompt do Android só aparece depois do toque em 'Ativar'.

### Passo 12

Abrir a tela certa ao tocar na notificação: criar `navigationRef = createNavigationContainerRef<RootStackParamList>()` e passar `ref` ao NavigationContainer (RootNavigator.tsx:85). O provider escuta addNotificationResponseReceivedListener (app aberto) e getLastNotificationResponse (app fechado; conferir se o nome na versão instalada é síncrono ou Async), converte com notificationRouting e guarda a intenção pendente. A navegação só acontece quando a rota Main está montada, ou seja, sessão, perfil carregado, onboarding concluído e adminLocked=false. Assim o bloqueio por digital continua sendo respeitado.

_Arquivos:_ `src/navigation/RootNavigator.tsx`, `src/navigation/navigationRef.ts`, `src/context/PushNotificationsProvider.tsx`

**Como verificar:** Teste unitário da intenção pendente (não navega com adminLocked=true; navega ao desbloquear); no aparelho, tocar a notificação com o app morto abre o app, pede a digital se for o caso e cai na aba certa.

### Passo 13

Saída de conta e LGPD no app: em AuthProvider.signOut, ANTES de authService.signOut() (que ainda precisa do JWT), chamar removerDispositivo(ultimoToken) com try/catch e timeout curto, porque logout offline não pode travar. Se falhar, a reatribuição por token no próximo login e o recibo DeviceNotRegistered cobrem. Exclusão de conta: coberta pelo trigger da migration A (anonymized_at), sem depender de mudança em delete-my-account; avisar a tarefa de exclusão LGPD para não duplicar a lógica.

_Arquivos:_ `src/context/AuthProvider.tsx`

**Como verificar:** Teste Jest: signOut chama removerDispositivo antes de authService.signOut; se removerDispositivo rejeitar, signOut conclui mesmo assim; teste SQL T5 (passo 5) verde.

### Passo 14

Testes Jest: acrescentar `jest.mock('expo-notifications')` e `jest.mock('expo-constants')` no jest.setup.js; criar testes do service (permissão negada não chama rpc; concedida chama rpc com token e variante; sem projectId lança erro tipado; canais criados antes de pedir token), de notificationRouting (cada tipo vai para sua rota; payload malformado ou UUID inválido dá null) e da preferência.

_Arquivos:_ `jest.setup.js`, `src/services/__tests__/pushNotifications.service.test.ts`, `src/utils/__tests__/notificationRouting.test.ts`, `src/services/__tests__/pushPreference.service.test.ts`

**Como verificar:** `npm test` verde (324 existentes + novos); o pre-commit do Husky (typecheck + jest) passa no commit.

### Passo 15

Ponta a ponta LOCAL com a variante DEV no SM-S928B: gerar e instalar o APK DEV (fluxo da T1, apontando para o Supabase local, com google-services.json); logar com usuários do seed local (admin, professor, aluno); ativar notificações; manter `supabase functions serve send-push` rodando. Cenários: (1) no psql local, simular aluno enviando comprovante (UPDATE para pending_approval com JWT de aluno) com o admin logado no aparelho → chega 'Novo comprovante para analisar'; (2) `select public.enfileirar_lembretes_de_mensalidade('<data fixa>'::timestamptz)` com o aluno logado → chegam D-3, D0 e atraso, e repetir não duplica; (3) criar aula de rotina começando há 70 min sem chamada com o professor logado → aviso de chamada pendente em até 15 min; concluir a chamada antes de enviar → linha 'cancelled'; (4) justificativa inserida → professor recebe; (5) tocar em cada notificação com o app fechado e aberto; (6) desinstalar o app, reenviar, conferir o recibo depois de 15 min (dá para forçar recuando created_at da delivery no banco local) → token apagado; (7) logout → linha do aparelho some; (8) evento às 23:00 SP → send_after às 07:00.

**Como verificar:** Os 8 cenários com resultado esperado, anotados; `select kind, status, count(*) from notification_outbox group by 1,2` no banco local bate com o que chegou no aparelho; nenhuma notificação mostra nome, CPF ou valor.

### Passo 16

Documentação (protocolo do README): README.md com seção 'Notificações push' (pré-requisitos Expo e Firebase, GOOGLE_SERVICES_JSON, segredos da função só pelo nome, como ativar no app); docs/NOTIFICACOES.md novo (eventos, destinatários, horários em SP e UTC, deduplicação, silêncio noturno, limpeza de tokens, variante DEV, LGPD); docs/EDGE-FUNCTIONS.md com o contrato de send-push (autorização por segredo, respostas, sem verify_jwt); docs/RUNBOOK.md com Vault (criar e rotacionar push_dispatch_secret), deploy da função, consultas de monitoramento (cron.job_run_details, net._http_response, fila por status) e rotação da chave FCM V1; docs/FREQUENCIA.md:165-171 atualizado (push passa a existir); docs/FUNCIONALIDADES.md:76 marcado; docs/ARQUITETURA.md com a tabela de Edge Functions atualizada; migration com nova versão da política de privacidade em legal_documents só depois que o usuário aprovar o texto. snake-server: sem mudança de código; se o usuário quiser, anotar em docs/BACKEND.md §7 que notifications foi para o Supabase (commit separado no outro repositório, sob a regra de push dele).

_Arquivos:_ `README.md`, `docs/NOTIFICACOES.md`, `docs/EDGE-FUNCTIONS.md`, `docs/RUNBOOK.md`, `docs/FREQUENCIA.md`, `docs/FUNCIONALIDADES.md`, `docs/ARQUITETURA.md`, `supabase/migrations/<timestamp>_politica_privacidade_push.sql (após aprovação do texto)`

**Como verificar:** `grep -n "expo-notifications\` não está instalado" docs/FREQUENCIA.md` não encontra nada; o README lista os novos nomes de variáveis e segredos, sem valores.

### Passo 17

Versionamento e integração, COM AUTORIZAÇÃO: commits em Conventional Commits separados (feat(db): dispositivos e fila de push; feat(push): edge function send-push; feat(app): opt-in e registro de notificações; docs: notificações push), push da branch e PR para main. O número de versão segue a política da tarefa de versionamento: é mudança nativa, então pede build novo e versionCode incrementado.

**Como verificar:** `git log --oneline main..feat/notificacoes-push` mostra os commits; o PR abre com o CI existente verde (se o teste SQL ficou em supabase/tests, ele roda no job 'banco').

### Passo 18

Implantação em PRODUÇÃO, só com aprovação explícita e nesta ordem: (1) `supabase db push` (as migrations sobem os jobs, mas disparar_envio_de_push não faz nada sem os segredos do Vault, então é seguro); (2) `supabase secrets set PUSH_DISPATCH_SECRET=... EXPO_ACCESS_TOKEN=... PUSH_APP_VARIANT=production` (valores digitados pelo usuário); (3) `supabase functions deploy send-push --no-verify-jwt`; (4) no SQL Editor, `vault.create_secret('https://<ref>.supabase.co','push_project_url')` e `vault.create_secret('<mesmo PUSH_DISPATCH_SECRET>','push_dispatch_secret')`; (5) gerar o APK de release PROD (keystore de produção da outra tarefa, google-services.json) e publicar; (6) monitorar por 48h. Não criar dados de teste em produção: validar com um evento real ou com a ferramenta expo.dev/notifications usando o token do próprio aparelho do usuário.

**Como verificar:** `select jobname, status, start_time from cron.job_run_details where jobname like 'push-%' order by start_time desc limit 10` com status succeeded; logs da função sem 401 nem InvalidCredentials; `select kind, status, count(*) from notification_outbox group by 1,2` sem acúmulo de 'pending' vencido; no aparelho do usuário, push real recebido depois de instalar o APK novo e ativar.

## 6. Riscos

- Android 13+ (o SM-S928B roda Android 14+): se nenhum canal for criado antes, o prompt não aparece e o token não é gerado. Por isso configurarCanais() vem antes de pedir permissão ou token.
- Push não funciona no Expo Go do Android desde o SDK 53: exige build nativo, o que o projeto já faz (prebuild + gradle). Cada mudança de plugin ou googleServicesFile pede novo prebuild e novo APK (~17 min).
- APKs até a 1.6.0 não registram token: ninguém recebe push até atualizar. Nada quebra no app antigo, porque as tabelas e funções novas são só adições.
- Trocar a keystore de debug pela de produção (outra tarefa) obriga a reinstalar o app: os tokens antigos morrem e só são limpos pelos recibos DeviceNotRegistered. Isso é esperado, não é bug.
- O pg_cron roda em UTC. Os horários fixos (12:00 UTC = 09:00 SP) assumem que SP não tem horário de verão; se voltar a ter, os avisos saem 1h fora.
- O mark_overdue_payments marca 'overdue' às 21:01 SP do próprio dia do vencimento (current_date em UTC). A lógica de push usa a data de SP e não esse status. Corrigir o job em si fica fora do T9, mas o problema deve ser registrado para decisão.
- Se os segredos do Vault faltarem ou divergirem de PUSH_DISPATCH_SECRET, nada é enviado e só aparece WARNING, 401 na função ou status 401 em net._http_response. O RUNBOOK precisa das consultas de monitoramento.
- Custo e volume: o job de minuto gera cerca de 1.440 linhas por dia em cron.job_run_details (limpas pelo push-limpeza), e as chamadas à Edge Function só acontecem com fila ou recibos pendentes, bem abaixo da cota grátis. Sem essa guarda seriam cerca de 43 mil invocações por mês.
- O trigger de comprovante não bloqueia o envio do aluno se o enfileiramento falhar (exception → warning). A contrapartida é que uma falha na fila passa sem aviso na tela, então é preciso monitorar os logs do Postgres.
- Primeira ativação: sem as janelas curtas (2 dias), mensalidades atrasadas antigas gerariam uma enxurrada de cobranças.
- LGPD: o token do aparelho é dado pessoal e o conteúdo passa por Expo e Google (EUA). Isso exige texto genérico, atualização da política de privacidade, remoção dos tokens na anonimização (trigger) e retenção de 30 dias.
- Variante DEV apontando por engano para o banco de produção: a coluna app_variant e o PUSH_APP_VARIANT=production na função impedem que aparelhos DEV recebam avisos reais.
- Sequestro de token (alguém registrando o token de outra pessoa pela RPC) tem impacto baixo: o texto é genérico e a vítima recupera o token na próxima abertura do app. Ainda assim fica registrado.
- O google-services.json não pode ir ao repositório público (já bloqueado em .gitignore:47). O build no GitHub Actions (outra tarefa) vai precisar dele como Secret em base64 e do projectId na configuração.
- O teste SQL colocado em supabase/tests passa a rodar no job 'banco' do CI que já existe, mesmo sem mudar o workflow. Isso pode contrariar o 'Esquece o CI'; a decisão está listada.
- Suposição sobre IDs: considerei T1 como a separação dev/prod (pacote DEV, app.config por variante, Supabase local em Docker), da qual este plano depende. Se a numeração for outra, ajustar depende_de.
- Não verificado: se o nome da API de resposta a frio é getLastNotificationResponse (síncrono) ou getLastNotificationResponseAsync na versão 57.0.12, e os campos exatos do setNotificationHandler na tipagem instalada. Conferir em node_modules/expo-notifications depois de instalar.
- Não verificado: se `host.docker.internal` resolve de dentro do container do Postgres local no Docker Desktop 29 desta máquina. A alternativa é o nome do container Kong que aparecer em `docker ps`.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T3, T5, T10:** Cada plano usa um nome ou valor diferente para a variante. T1: APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production' (with-variant.js recebe dev|prod). T3 (passo 7): process.env.APP_VARIANT === 'dev', que nunca é verdadeiro com a T1, então o sufixo +dev nunca aparece. T10: lê um hipotético EXPO_PUBLIC_APP_ENV. T5: define APP_VARIANT: production, mas grava um .env sem EXPO_PUBLIC_APP_VARIANT e não passa pelo with-variant.js. T9: enum app_variant ('production', 'development').  
  **Resolução:** A T1 publica o contrato: APP_VARIANT ∈ {development, production} no processo de build e EXPO_PUBLIC_APP_VARIANT com o mesmo valor no JS. T3 compara com 'development'. T10 usa EXPO_PUBLIC_APP_VARIANT como environment do Sentry. T9 mantém o enum. No CI, a T5 grava .env.prod e roda os comandos via 'node scripts/with-variant.js prod -- ...', garantindo o mesmo caminho de carga de variáveis e as mesmas travas do build local.
- **Conflito com T1, T3, T2, T10:** Vários planos mexem no mesmo arquivo de configuração. T1 cria app.config.js para as variantes. T3 (passo 7) também cria app.config.js, 'mínimo', para o sufixo de versão. T2 altera a entrada de plugin no app.json. T9 acrescenta o plugin expo-notifications, googleServicesFile e extra.eas.projectId, este último gravado pelo 'eas init', que costuma recusar ou só instruir quando existe configuração dinâmica. T10 acrescenta o plugin do Sentry. T3 e T9 instalam expo-constants cada um por conta própria.  
  **Resolução:** O app.config.js tem um único dono, a T1, que o cria com dois pontos de extensão: overrides por variante e cálculo de version. A T3 só acrescenta buildVersionName dentro dele. Plugins estáticos (expo-notifications, Sentry, assinatura) e extra.eas.projectId ficam no app.json-base; o projectId é colado à mão se o 'eas init' recusar. Em development, a T1 sobrescreve só name, package, scheme, ícone e a opção do plugin de assinatura, sem apagar a lista de plugins. expo-constants é instalado uma única vez, por quem chegar primeiro.
- **Conflito com T1, T6, T7, T8:** A T1 move a stack local para as portas 553xx (API 55321, DB 55322) porque o radar-tributario ocupa as 543xx. As outras tarefas assumem as portas antigas: T7 ('API em 127.0.0.1:54321', curl em 54321), T8 ('adb reverse tcp:54321'), T9 (psql do host em 54322, vault push_project_url 'http://host.docker.internal:54321', 'supabase status mostra 54321/54322'). A T9 também usa psql no host, que não está instalado.  
  **Resolução:** Depois da T1, trocar em todos os planos para 55321/55322. Rodar SQL sempre por 'docker exec -i supabase_db_snake-thai psql' ou pelos subcomandos do scripts/db-dev. Na T9, o Vault local usa 'http://host.docker.internal:55321' ou o nome do container Kong com a porta interna 8000. Na T8, o adb reverse passa para tcp:55321.
- **Conflito com T1, T6, T7, T8:** A publicação em produção não segue o fluxo novo. T6 (passo 14), T7 (passo 15) e T9 (passo 18) chamam 'supabase db push' direto, sem o script com dupla confirmação da T1; a CLI está linkada à produção e 'db push' usa o projeto linkado por padrão. A T7 fixa timestamps (20260917120000, 20260917130000) enquanto as outras usam 'migration new'. Uma migration criada depois mas com timestamp menor que a última aplicada no remoto faz o 'db push' recusar, exigindo --include-all. Ninguém prevê backup antes de cada push.  
  **Resolução:** Todo push de migration em produção passa por scripts\db-push-prod.bat (T1, passo 12), antecedido por 'npx supabase db dump --linked' para fora do repositório, feito pelo usuário. Os timestamps são gerados ('migration new' ou renomeação) no rebase final, logo antes do merge de cada tarefa, na ordem de integração T7 → T6 → T8 → T9. Nunca usar --include-all em produção sem revisão.
- **Conflito com T6:** A T6 exclui turmas arquivadas de aulas_sem_chamada e congela a chamada delas. A função enfileirar_avisos_aula_sem_chamada da T9 lê classes direto e não filtra groups.archived_at, então avisaria sobre aulas de turma arquivada das últimas 24h que nunca poderão ter chamada. O job push-limpeza da T9 apaga cron.job_run_details de TODOS os jobs com mais de 7 dias, o que reduz o histórico usado para monitorar generate-scheduled-classes (T6) e os jobs financeiros.  
  **Resolução:** A T9 filtra turma arquivada e professor anonimizado ou inativo. A limpeza de cron.job_run_details fica restrita a jobname like 'push-%', ou a retenção de 7 dias é aceita e documentada no RUNBOOK.
- **Conflito com T7, T11:** A exclusão LGPD não cobre os dados novos das outras tarefas. export_my_data (T7) não inclui push_devices nem notification_outbox (T9), que são dados pessoais. O rascunho de chamada (T11) só é apagado se a autoexclusão da T7 passar por authService.signOut.  
  **Resolução:** Se a T9 já estiver integrada, a T7 inclui push_devices no export. Senão, a T9 estende export_my_data. O ExcluirContaScreen da T7 encerra a sessão por AuthProvider.signOut → authService.signOut, caminho que apaga os rascunhos (T11) e o token do aparelho (T9).
- **Conflito com T5, T10:** O release.yml da T5 não prevê os insumos que T9 e T10 tornam obrigatórios. Com a T9, o app.config lê googleServicesFile (GOOGLE_SERVICES_JSON ou ./google-services.json, fora do Git) e o prebuild falha no CI sem ele. Com a T10, o build de release precisa de SENTRY_AUTH_TOKEN, ou sai com stack ilegível. O projectId do EAS também precisa estar na configuração.  
  **Resolução:** Quando cada uma entrar, atualizar a T5: secret GOOGLE_SERVICES_JSON_BASE64, decodificado em $RUNNER_TEMP e apontado por GOOGLE_SERVICES_JSON; secret SENTRY_AUTH_TOKEN opcional, com SENTRY_DISABLE_AUTO_UPLOAD=true quando ausente. Registrar essas dependências no checklist da T5 e no RUNBOOK.
- **Conflito com T1, T3, T6, T8:** Várias tarefas esbarram no 'Esquece o CI' (não adicionar testes ao CI). A T1 altera o ci.yml, só a porta do psql (necessário porque o job lê o config.toml). As regressões novas de T6, T8 e T9 em supabase/tests/ passam a rodar sozinhas no job 'banco'. Os testes Jest de T2, T3, T10 e T11 rodam no job de testes. Só a T9 levanta essa questão.  
  **Resolução:** Decisão única do usuário, aplicada a todas as tarefas. Recomendação: aceitar que testes nas pastas existentes rodem no CI atual, sem nenhum job ou passo novo, e manter a única edição do ci.yml na porta 55322. Se o usuário quiser literalmente nada novo no CI, todas as regressões novas vão para supabase/tests-local/ e o db-dev test da T1 percorre as duas pastas.
- **Conflito com T6, T7, T8, T10, T11:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Afirmação a conferir:** Passo 5: verificação com `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres ... -f supabase/tests/regressao_notificacoes.sql`. Passo 2: 'supabase status mostra API em 54321 e DB em 54322'.  
  **Por quê:** psql não existe no host ('where psql' sem resultado, segundo T1, T6 e T7), e a T1 move o banco para 55322. O comando não roda como está escrito; o caminho correto é docker exec no container do banco.
- **Decisão consolidada (T1 + T3 + T5 + T9 + T10):** Contrato da variante (nomes e valores).  
  **Recomendação:** APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production'; padrão production, com o .env antigo renomeado para .env.prod. O CI usa .env.prod e with-variant.js. Decisão técnica, só para o usuário ciente.
- **Decisão consolidada (T9):** Serviço de push, despachante e regras de envio.  
  **Recomendação:** Serviço de push da Expo com Edge Function send-push chamada pelo pg_cron via pg_net. Um projeto Firebase com dois apps (PROD e DEV). google-services.json fora do Git. Texto genérico, sem PII. Silêncio entre 22h e 7h. Lembretes D-3/D0 e atraso D+1/D+7. Opt-in por cartão explicativo mais switch no Perfil. Retenção de 30 dias.
- **Decisão consolidada (T7 + T9 + T10):** Atualização da Política de Privacidade.  
  **Recomendação:** Uma única nova versão em legal_documents, cobrindo exclusão e retenção (T7), push com Expo e Google (T9) e Sentry (T10), aprovada pelo usuário antes do release que traz a primeira dessas funcionalidades.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T9.md` escrito
