# Notificações push

> Regras, arquitetura e operação das notificações push (T9, 2026-09-16). O banco
> decide quem recebe o quê; a Edge Function `send-push` só entrega pela Expo.

## Quem recebe o quê

| Aviso | Quem recebe | Quando |
|---|---|---|
| Mensalidade vence em N dias | Aluno | 3 dias antes, às 09:00 |
| Mensalidade vence hoje | Aluno | No dia, às 09:00 |
| Mensalidade em atraso | Aluno | 1 e 7 dias depois do vencimento, às 09:00 |
| Novo comprovante para analisar | Admins | Quando o aluno envia (vários juntos viram "N comprovantes") |
| Pagamento aprovado / comprovante recusado | Aluno | Quando o admin decide |
| Justificativa de falta para revisar | Professores da aula (admins, se a aula não tem professor) | Quando o aluno envia |
| Chamada pendente | Professores da aula | 1 hora depois do início, a cada 15 min, por até 24 h |
| Aulas sem chamada hoje | Admins | Resumo às 21:00 |

Horários de São Paulo. Os lembretes de mensalidade só valem para mensalidade **em
aberto** (quem já mandou comprovante não recebe) e usam o dia de São Paulo, não o
status "vencida" do banco (o cron que marca vencida roda em UTC).

## Regras

- **Só com aparelho:** ninguém entra na fila sem ter ativado as notificações.
- **Sem dados pessoais no texto:** nada de nome, CPF ou valor. O texto passa pela
  Expo e pelo Google e aparece na tela bloqueada. Título e horário da aula podem
  aparecer.
- **Silêncio das 22:00 às 07:00:** o que acontece nesse intervalo sai às 07:00.
- **Sem duplicar:** `UNIQUE (destinatário, chave)` no banco; rodar o lembrete de
  novo não repete o aviso.
- **Avisos que perderam o sentido não saem:** mensalidade paga antes do lembrete,
  justificativa já revisada, chamada já feita, conta inativa ou excluída.
- **Primeira ativação sem enxurrada:** os atrasos só avisam em janelas de 2 dias
  (D+1 e D+7); atrasos antigos não geram aviso.
- **Retenção de 30 dias** do histórico da fila e dos envios (LGPD, minimização).
- **Conta excluída (LGPD):** os aparelhos saem do banco na hora (gatilho em
  `profiles.anonymized_at`). O export (`export_my_data`) traz aparelhos e avisos.

## Como funciona

```
evento no banco / cron diário ──► notification_outbox (fila)
pg_cron a cada minuto ──► disparar_envio_de_push()
      └─ só se houver fila vencida ou recibo a conferir
         └─ pg_net POST /functions/v1/send-push (Bearer = segredo do Vault)
               ├─ recibos: getReceipts (tickets de 15 min a 24 h) → DeviceNotRegistered apaga o aparelho
               └─ envio: reivindicar_notificacoes → Expo /push/send (lotes de 100) → registrar_envio_de_push
```

| Peça | Onde |
|---|---|
| Aparelhos | `push_devices` (RLS do titular; grava por `registrar_dispositivo_push`) — migration `push_dispositivos` |
| Fila, gatilhos, lembretes, despacho | migration `notificacoes_fila` |
| Entrega | `supabase/functions/send-push/` (contrato em [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md)) |
| App | `src/services/pushNotifications.service.ts`, `src/context/PushNotificationsProvider.tsx`, convite na aba Aulas e switch no Perfil |

Resultado de cada envio: aceito → `sent`; só aparelhos inexistentes → `cancelled`
(`sem_dispositivo`); erro passageiro (HTTP 429/5xx, rede) → volta com espera de 2,
4, 8… minutos; depois de 5 tentativas → `failed`. Envio preso há 10 minutos volta
à fila.

### Jobs (pg_cron, UTC)

| Job | Quando (UTC) | São Paulo |
|---|---|---|
| `push-lembretes-mensalidade` | `0 12 * * *` | 09:00 |
| `push-aulas-sem-chamada` | `*/15 * * * *` | a cada 15 min |
| `push-resumo-aulas-sem-chamada` | `0 0 * * *` | 21:00 |
| `push-despachar` | `* * * * *` | a cada minuto |
| `push-limpeza` | `30 6 * * *` | 03:30 (fila de 30 dias; histórico dos jobs `push-%` de 7 dias) |

## Ativar em produção (só com aprovação, nesta ordem)

Contas e arquivos que só você cria:

1. **Expo:** conta em expo.dev e projeto do app. O *projectId* (não é segredo) vai em
   `EAS_PROJECT_ID` no `.env.prod` e no `.env.dev`.
2. **Firebase:** um projeto com dois apps Android, `com.snakethai.app` e
   `com.snakethai.app.dev`. Registre os **dois** antes de baixar: o
   `google-services.json` da tela do projeto traz os dois numa única cópia, e é essa
   que vai para a raiz de `snake-thai` (fica fora do Git; ou aponte
   `GOOGLE_SERVICES_JSON` para ela). Com o arquivo de um app só, o build morre no fim
   com `no matching client found for package name`.
3. **Chave FCM V1:** Firebase → Contas de serviço → gerar chave privada (é SEGREDO:
   guarde fora do repositório). O envio pelo site não serve — *Credentials → Android*
   exige cadastrar uma keystore de build, que este projeto não usa, porque compila
   localmente. Faça pela CLI, que não pede assinatura nenhuma:

   ```bash
   npx --yes eas-cli@latest login
   npx --yes eas-cli@latest credentials -p android
   ```

   No menu: perfil **`dev`** (ou `prod`) → **Google Service Account** → *Set up a
   Google Service Account Key for Push Notifications (FCM V1)* → caminho do arquivo.
   Repita para os dois pacotes e apague a cópia local depois.

   O `eas.json` da raiz existe só para esse comando ter um perfil para escolher, e os
   perfis carregam `APP_VARIANT` para o pacote certo ser resolvido. O projeto **não**
   compila na nuvem.
4. (Recomendado) **Enhanced Push Security** na Expo e um Access Token.

Publicação:

```bash
# 1. Migrations (backup e dupla confirmação)
scripts\db-push-prod.bat

# 2. Segredos da função (valores digitados por você, nunca no chat ou no Git)
npx supabase secrets set PUSH_DISPATCH_SECRET=... PUSH_APP_VARIANT=production EXPO_ACCESS_TOKEN=... --project-ref <REF>

# 3. Função
npx supabase functions deploy send-push --no-verify-jwt --project-ref <REF>
```

4. No SQL Editor de produção, os segredos do Vault (o mesmo valor de
   `PUSH_DISPATCH_SECRET`):

```sql
select vault.create_secret('https://<REF>.supabase.co', 'push_project_url');
select vault.create_secret('<mesmo PUSH_DISPATCH_SECRET>', 'push_dispatch_secret');
```

5. APK novo (com `google-services.json` e `EAS_PROJECT_ID`). APKs até a 1.6.0 não
   registram aparelho: ninguém recebe push até atualizar.

Sem os segredos do Vault, nada é enviado: `disparar_envio_de_push()` só registra um
WARNING quando há fila parada.

## Monitorar

```sql
-- Fila por situação
select kind, status, count(*) from public.notification_outbox group by 1, 2 order by 1, 2;

-- Últimas chamadas à função (401 = segredo divergente; 500 = configuração)
select status_code, content, created from net._http_response order by created desc limit 5;

-- Jobs de push
select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d join cron.job j using (jobid)
 where j.jobname like 'push-%' order by d.start_time desc limit 10;

-- Erros de credencial (InvalidCredentials / MismatchSenderId)
select error_code, count(*) from public.notification_deliveries
 where error_code is not null group by 1;
```

Nos logs da função, os eventos `credencial_push_invalida` indicam chave FCM ou
projeto Expo errados.

### Rotacionar o segredo do despachante

```sql
select vault.update_secret((select id from vault.secrets where name = 'push_dispatch_secret'), '<novo>');
```

E, logo depois, `npx supabase secrets set PUSH_DISPATCH_SECRET=<novo> --project-ref <REF>`.
Entre os dois passos as chamadas respondem 401 e a fila espera (nada se perde).

## Ensaio local (sem sair para a internet)

1. `scripts\db-dev reset`.
2. Um servidor falso no lugar da Expo (ex.: um HTTP simples na porta 8765 que
   responda `/send` e `/getReceipts` no formato da Expo).
3. Arquivo de ambiente **fora do Git** com `PUSH_DISPATCH_SECRET`,
   `PUSH_APP_VARIANT=development` e
   `EXPO_PUSH_API_URL=http://host.docker.internal:8765`, e:
   `npx supabase functions serve send-push --no-verify-jwt --env-file <arquivo>`.
4. No banco local: `vault.create_secret('http://supabase_kong_snake-thai:8000', 'push_project_url')`
   e `vault.create_secret('<mesmo segredo>', 'push_dispatch_secret')`.
5. Cadastre um aparelho de teste e gere um evento (ex.: mude uma mensalidade para
   `pending_approval`). Em até 1 minuto o `push-despachar` chama a função.
6. Ao terminar, apague os dois segredos do Vault local e o arquivo de ambiente, e
   rode `scripts\db-dev stop` e `start` para o runtime de funções voltar ao normal.

Regressões: `supabase/tests/regressao_notificacoes.sql` (20 casos) e
`deno test supabase/functions/send-push/`.
