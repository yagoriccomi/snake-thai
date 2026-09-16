# ENTREGA — T9: notificações push

| Campo | Valor |
|---|---|
| **Tarefa** | `T9` |
| **Plano** | [`PLANO-T9.md`](PLANO-T9.md) · regras e operação em [`docs/NOTIFICACOES.md`](../NOTIFICACOES.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/notificacoes-push` |
| **Status** | 🟡 Pronto e ensaiado no ambiente local; **não chega a nenhum celular** até você criar as contas Expo e Firebase; nada publicado em produção |

---

## 1. O que foi feito

Avisos no celular, para quem ativar:

| Quem | O quê |
|---|---|
| Aluno | Mensalidade vence em 3 dias, vence hoje, atrasada (1 e 7 dias); comprovante aprovado ou recusado |
| Admin | Comprovante para analisar (vários viram um aviso só); resumo das aulas sem chamada às 21h |
| Professor | Justificativa de falta para revisar; aula dele sem chamada 1 hora depois do início |

- **O banco decide quem recebe o quê** e guarda numa fila. Uma Edge Function
  (`send-push`), chamada pelo próprio banco a cada minuto e só quando há o que
  mandar, entrega pela Expo.
- **Texto sem nome, CPF ou valor.** Nada sai entre 22h e 7h, e o mesmo aviso não
  se repete. Aviso que perdeu o sentido (mensalidade já paga, chamada já feita)
  não sai.
- **Ativação pela pessoa:** um convite na aba Aulas explica o porquê antes do
  pedido do Android, e há um switch no Perfil. Tocar na notificação abre a aba
  certa, só depois da digital.
- **Privacidade (LGPD):**
  - o aparelho sai do banco ao desativar, ao sair da conta e ao excluir a conta;
  - o histórico de envios dura 30 dias;
  - "Exportar meus dados" traz os aparelhos e os avisos.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916211951_push_dispositivos.sql` | `push_devices` (RLS do titular), `registrar_dispositivo_push` (reatribui token, até 5 aparelhos), remoção ao excluir a conta |
| `supabase/migrations/20260916211956_notificacoes_fila.sql` | `notification_outbox` e `notification_deliveries`; gatilhos de pagamento e justificativa; lembretes; aula sem chamada; reivindicação, resultado e recibos; `disparar_envio_de_push` (pg_net + Vault); limpeza; export; 5 jobs `push-*` |
| `supabase/tests/regressao_notificacoes.sql` | 20 casos |
| `supabase/functions/send-push/` | `index.ts`, `expo.ts`, `mensagens.ts` e 8 testes Deno; `[functions.send-push] verify_jwt = false` no `config.toml`; `supabase/functions/.env.example` |
| `app.json`, `app.config.js`, `assets/notification-icon.png` | Plugin `expo-notifications`; Firebase e projectId da Expo só quando existem (o build sem eles continua funcionando) |
| `src/services/pushNotifications.service.ts`, `pushPreference.service.ts`, `src/utils/notificationRouting.ts` | Canais, permissão, token, registro e remoção; escolha por usuário; rota do toque (só UUIDs, payload desconhecido não navega) |
| `src/context/PushNotificationsProvider.tsx`, `src/navigation/navigationRef.ts` | Estado, registro a cada abertura, troca de token, toque na notificação depois da digital |
| `src/components/NotificationOptInCard.tsx`, `AulasHomeScreen`, `DadosScreen`, `PagamentoScreen`, `App.tsx`, `AuthProvider` | Convite, switch, texto honesto sobre o aviso de aprovação, remoção do aparelho antes de encerrar a sessão |
| `package.json`, `jest.setup.js` | `expo-notifications`; mocks; Jest ignora `supabase/functions` |
| Docs | `NOTIFICACOES.md` (novo), `EDGE-FUNCTIONS`, `RUNBOOK`, `FREQUENCIA`, `FUNCIONALIDADES`, `README`, `.env.example` |

## 3. Verificações executadas

- [x] **Banco:** as migrations aplicam do zero e a suíte SQL completa passou.
  `regressao_notificacoes.sql` tem 20 casos:
  - aparelhos: só do titular, sem gravação direta, token muda de dono, formato recusado, limite de 5, conta excluída perde os aparelhos;
  - avisos de comprovante sem duplicar e de justificativa para o destinatário certo;
  - lembretes D-3, D0, D+1 e D+7 sem duplicar; dia de São Paulo; atraso antigo, em análise, paga e inativo fora;
  - aula sem chamada recente fora de turma arquivada; resumo do admin;
  - despacho: cancela obsoleta e sem aparelho da variante;
  - permissões; horário de silêncio;
  - resultado do envio: enviada, nova tentativa, falha após 5, aparelho inexistente;
  - recibos; retenção de 30 dias; disparo sem configuração; export.
- [x] **Edge Function:** 8 testes Deno (lotes, segredo, tickets, recibos, agrupamento, textos sem dado pessoal, horário de São Paulo) e `deno check` do `index.ts`.
- [x] **Ensaio local ponta a ponta**, sem sair para a internet (Expo substituída por um servidor falso):
  - sem segredo, a função responde 401;
  - comprovante enviado pelo gatilho real chegou à fila; em 1 minuto o `pg_cron` chamou a função via `pg_net` (HTTP 200);
  - o admin recebeu a mensagem só com o id do pagamento;
  - o token "inexistente" foi apagado; o professor só com aparelho de produção foi cancelado por falta de aparelho da variante;
  - o recibo de 20 minutos atrás foi conferido e o aparelho que "sumiu", apagado;
  - os logs da função têm só eventos e contagens, nenhum token.
  - Depois do ensaio, os segredos do Vault local e o arquivo de ambiente foram apagados.
- [x] **Jest:** 642 testes, 30 novos:
  - serviço: canais antes do token, sem projeto, sem Firebase, remoção que não trava a saída;
  - provider: não pede permissão sem toque, ativa, guarda a recusa, não navega antes da digital, professor não vai ao Financeiro;
  - rota do toque; convite; ordem do `signOut`; `app.config` com e sem Firebase.
- [x] Typecheck verde.
- [x] Build do APK DEV com o módulo nativo: `release/snake-thai-dev-v1.6.0+dev.82.98bc971.apk` (12 min 52 s). O manifesto tem `POST_NOTIFICATIONS`, o serviço de mensagens do Firebase e o ícone e a cor de notificação.
- [ ] Notificação chegando a um celular — depende das contas Expo e Firebase.

## 4. ⚠️ Premissas assumidas (revisar)

As decisões P1–P16 do plano foram seguidas como recomendado:

- Serviço da Expo, com a entrega numa Edge Function e não no snake-server.
- Um projeto Firebase com os dois apps; `google-services.json` fora do Git.
- Lembretes D-3/D0 às 9h e atraso D+1/D+7; sem enxurrada na primeira ativação.
- Justificativa para os professores da aula; aula sem chamada para o professor e resumo às 21h para o admin.
- Texto genérico; silêncio das 22h às 7h; aviso de aprovação e recusa.
- Cartão mais switch; liga/desliga geral por aparelho; retenção de 30 dias; teste em `supabase/tests`.

Ajustes na execução:

- **Só entra na fila quem tem aparelho** (minimização; evita fila parada em
  produção antes da configuração).
- **O histórico apagado pela limpeza** é só o dos jobs `push-*`, não o dos outros
  jobs (ajuste do revisor).
- **Resultado e recibos:** gravados por funções do banco (atômicas e testadas),
  não por UPDATEs soltos da função.
- **Recibos:** só com mais de 15 minutos e menos de 24 horas, que é o prazo da
  Expo; sem esse limite, um recibo que nunca vem acordaria a função a cada minuto.
- **`claimed_at`:** envio preso volta à fila pela hora em que foi pego, e não pela
  hora da criação. Isso evita reenviar um aviso antigo no meio do envio.
- **Sem conta Expo ou Firebase:** o app compila e mostra "Esta versão do app ainda
  não está pronta para notificações", em vez de falhar.
- **Tela de pagamento:** o texto passou a dizer "Com as notificações ativadas,
  você é avisado da aprovação".

## 5. O que só você pode fazer

Passo a passo completo em [`docs/NOTIFICACOES.md`](../NOTIFICACOES.md).

1. Criar o projeto na Expo e colocar o `EAS_PROJECT_ID` no `.env.dev` e no `.env.prod`.
2. Criar o projeto no Firebase com os dois apps Android e salvar o
   `google-services.json` na raiz (fica fora do Git).
3. Enviar a chave FCM V1 à Expo para os dois pacotes; ativar o Enhanced Push
   Security e gerar o Access Token.
4. ⚠️ **Produção, nesta ordem:**
   1. migrations (`db-push-prod.bat`);
   2. `supabase secrets set` da função;
   3. deploy da `send-push` com `--no-verify-jwt`;
   4. os dois segredos do Vault;
   5. APK novo.
5. Testar no celular: ativar, receber e tocar na notificação com o app aberto e fechado.
6. Aprovar a Política de Privacidade (lacuna L4: push, Expo e Google como operadores, retenção de 30 dias).
7. Decidir se o build do GitHub Actions (T5) recebe o `google-services.json` como
   secret. Sem isso, o APK do Actions sai sem push.

## 6. Pendências e riscos

- **APKs até a 1.6.0** não registram aparelho: ninguém recebe push até atualizar.
- **Trocar a keystore (T2)** obriga a reinstalar o app; os tokens antigos morrem e
  só saem pelos recibos. É esperado.
- **Horário de verão:** os horários fixos assumem São Paulo sem horário de verão.
  Se voltar a ter, os avisos saem 1 hora fora.
- **Falha ao enfileirar** um aviso de comprovante ou justificativa não impede o
  envio do aluno. Vira WARNING no log do Postgres, sem aviso na tela.
