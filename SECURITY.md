# 🛡️ Relatório de Postura de Segurança — Snake Thai

> **Data:** 2026-08-19 · **Método:** pentest com exploração real contra a API de
> produção, não inspeção teórica. Cada veredicto abaixo foi **executado** com
> token de usuário real.
> **Alvo:** projeto Supabase `fmmftavduunrjnbbtfmf`, APK release, dependências.

```text
🧠 RACIOCÍNIO ADVERSARIAL
- Descompilar o APK e roubar chaves? → Só a URL e a anon key estão no bundle,
  ambas PÚBLICAS por design (a proteção real é a RLS). A secret key NÃO vazou:
  0 ocorrências do valor real. A string "sb_secret_" no bundle é código da lib
  supabase-js, não uma chave.
- Banco local cifrado em repouso? → Sessão em AES-256 (LargeSecureStore), chave
  no Keychain/Keystore. Senhas sob bcrypt do GoTrue, nunca no app [#54].
- Tokens viajam seguros? → HTTPS obrigatório (Supabase), sem cleartext no app.
- Força bruta? → Login sob o rate limiting do GoTrue; Edge Functions expõem
  autorização correta mas SEM limite próprio (ver Médio).
```

---

## Resultado dos ataques executados

Cada linha foi disparada de verdade contra a API. `✅` = ataque **bloqueado**.

| # | Ataque | Vetor | Resultado |
| --- | --- | --- | --- |
| 1 | IDOR — aluno lê perfil (CPF/telefone) de outro | `GET /profiles?id=eq.<vítima>` | ✅ `[]` |
| 2 | Enumeração — aluno lista todos os perfis | `GET /profiles` | ✅ só a própria linha |
| 3 | IDOR — aluno lê pagamentos de outro | `GET /payments?user_id=eq.<vítima>` | ✅ `[]` |
| 4 | IDOR — aluno lê presença de outro | `GET /attendance?user_id=eq.<vítima>` | ✅ `[]` |
| 5 | Elevação — aluno lê a trilha de auditoria | `GET /audit_log` | ✅ `[]` |
| 6 | **IDOR de Storage — aluno baixa comprovante PIX de outro** | `GET /storage/.../<vítima>/prova.txt` | ✅ `404 NoSuchKey` |
| 7 | IDOR de escrita — aluno faz upload na pasta de outro | `POST /storage/.../<vítima>/` | ✅ negado |
| 8 | Elevação — aluno chama `create-student` | Edge Function | ✅ `403 Acesso restrito a administradores` |
| 9 | Elevação — aluno reseta senha de outro | `reset-student-password` | ✅ `403` |
| 10 | Sem credencial — chamada anônima à Edge Function | sem `Authorization` | ✅ `401 Não autenticado` |

O teste #6 foi o mais importante: subi um comprovante **real** na pasta da vítima
(via service_role) e ataquei como outro aluno. O Storage respondeu `404` — nem
confirma que o arquivo existe — enquanto a dona baixou o conteúdo normalmente.
A segregação de comprovantes PIX é real, não presumida.

---

## 🚨 Crítico (acesso imediato do atacante)

* **Nenhum achado.**

Os três críticos da auditoria anterior (`REVIEW.md`) foram fechados e
reverificados nesta sessão. A superfície de dados está sólida: RLS efetiva nas
10 tabelas, Storage segregado por dono, Edge Functions com autorização por JWT.

---

## ⚠️ Alto / Médio (endurecimento)

### 1. `android:allowBackup` estava ligado — **corrigido**

Quebra o menor privilégio de exposição de dados [#55].

O manifesto gerado pelo prebuild vinha com `allowBackup="true"` (default do
Android). Com isso, `adb backup` ou o backup automático em nuvem poderiam
extrair o AsyncStorage do app — incluindo a sessão cifrada — para outro
aparelho, onde a chave do Keystore não existe mas o ciphertext estaria à mão
para ataque offline.

**Onde estava:** `AndroidManifest.xml` (gerado); a pasta `android/` não é
versionada, então a correção foi na fonte.

**Mitigação aplicada:** `app.json` → `expo.android.allowBackup: false`. O
prebuild passa a gerar o manifesto com o backup desligado. **Exige recompilar o
APK** para valer.

### 2. Edge Functions sem rate limiting — **aberto**

Quebra a prática [#58].

`create-student`, `reset-student-password` e `delete-my-account` verificam
autorização corretamente, mas nada limita a frequência. Um token de admin
comprometido dispararia criação de contas ou reset de senhas em lote.

**Onde está:** `supabase/functions/*/index.ts`.

**Mitigação recomendada:** contador por `caller.user.id` em janela deslizante
(tabela `rate_limits` no próprio Postgres, ou Upstash), recusando com `429`
acima do limite. Fica para a rodada de hardening.

### 3. Login sem rate limiting próprio — **aceito com ressalva**

12 tentativas de senha errada em sequência retornaram `400`, não `429`: não há
bloqueio incremental **do lado da aplicação**. O GoTrue do Supabase aplica o
próprio limite de taxa por IP, o que cobre o caso comum, mas um atacante
distribuído contornaria. Aceitável para o volume atual; revisitar se o app
crescer.

### 4. CVE em `nanoid` — **corrigido**

Prática [#62].

`nanoid@3.3.16` (via React Navigation) tinha CVE de loop infinito com `size: 0`.
Baixo risco real — a lib nunca chama `nanoid(0)` —, mas corrigido sem breaking
change: `npm audit fix` subiu para `3.3.18`. Restam 16 avisos, **todos** do
toolchain de build (Metro, `@expo/cli`, `xcode`), que roda no computador e **não
entra no APK**. Nenhum é vulnerabilidade de runtime do app.

---

## ✅ Plano de Blindagem

1. **Recompilar o APK release** para o `allowBackup=false` valer (feito no
   `app.json`; falta o build).
2. **Rate limiting nas Edge Functions** — contador por usuário, `429` acima do
   limite. Próxima rodada de hardening.
3. **SAST no pipeline** — `npm audit` e verificação de segredos como gate na
   esteira de CI (etapa 10 do roadmap, `configurar-ci-cd-projeto`), bloqueando o
   merge com CVE crítico [#64].

---

## O que foi verificado e está correto

| Camada | Veredicto |
| --- | --- |
| RLS (10 tabelas) | Efetiva — IDOR e enumeração bloqueados no ataque real |
| Storage de comprovantes | Segregado por dono; vazamento cruzado retorna 404 |
| Edge Functions | Autorização por JWT; anônimo recebe 401, aluno recebe 403 |
| Segredos no bundle | Só chaves públicas; secret key não vazou (0 ocorrências) |
| Sessão no dispositivo | AES-256, chave no enclave seguro |
| Senhas | bcrypt (GoTrue); app nunca as armazena |
| Transporte | HTTPS obrigatório; sem cleartext |
| SQL Injection | Não aplicável — cliente tipado, sem concatenação |
