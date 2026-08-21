# Servidor de Comprovantes (Cloudinary + Render) — Handoff

> Especificação do serviço que assina o **upload** e a **visualização** dos
> comprovantes de pagamento na Cloudinary. Para quem vai construir e publicar o
> servidor. O app **não** fala com a Cloudinary direto — ele fala com este
> servidor, que é o único lugar onde a `api_secret` existe.

## 1. Por que este servidor existe

Comprovante PIX é **dado financeiro (PII)**. Dois requisitos inegociáveis:

1. **A `api_secret` da Cloudinary nunca pode estar no app.** Tudo que é
   `EXPO_PUBLIC_*` vai embutido no APK e é extraível. A assinatura do upload e
   da URL de visualização exige a `api_secret` — logo, exige um servidor.
2. **A entrega do comprovante tem que ser privada.** Na Cloudinary o padrão é
   URL pública. Os comprovantes são enviados como `type=authenticated` (privado)
   e só são vistos por **URL assinada**, gerada por este servidor, pelo dono do
   pagamento ou por um admin.

Hoje isso já funciona com o Storage privado do Supabase; este servidor é o que
permite trocar o Storage pela Cloudinary **sem perder a privacidade**.

## 2. Onde roda — Render (plano free) e o cold start

O servidor é um **Web Service** na Render, plano gratuito. A consequência que
molda todo o desenho: **o plano free hiberna após ~15 min sem tráfego**, e a
primeira requisição depois disso leva **~30–60 s** para acordar (cold start).

Regras que decorrem disso:

- **`/health` tem que ser trivial** (sem banco, sem I/O) — a Render usa para o
  health check e o app usa para "acordar" o servidor.
- **O app pré-aquece o servidor** ao abrir a tela de pagamento (ping em
  `/health`, fire-and-forget), antes de o usuário escolher o arquivo.
- **Timeouts generosos + 1 retry** nas chamadas de assinatura (60–70 s), com UX
  de carregamento honesta ("preparando envio…"), nunca falha em 10 s.

Ver a seção 7 para o lado do app.

## 3. Variáveis de ambiente do servidor (na Render)

Só o necessário — **nenhum segredo perigoso do Supabase** entra aqui:

| Variável | O que é | Segredo? |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Nome da conta Cloudinary | não |
| `CLOUDINARY_API_KEY` | Chave de API da Cloudinary | sensível |
| `CLOUDINARY_API_SECRET` | **Segredo** da Cloudinary — assina tudo | **sim** |
| `SUPABASE_URL` | URL do projeto Supabase | não |
| `SUPABASE_ANON_KEY` | Chave pública `anon` (para validar o token do chamador) | não |
| `ALLOWED_ORIGIN` | (opcional) origem do CORS, se houver uso web | não |
| `PORT` | Porta HTTP (a Render injeta) | não |

> **Deliberadamente ausentes:** `SUPABASE_SERVICE_ROLE_KEY` e
> `SUPABASE_JWT_SECRET`. O servidor **não** precisa deles e **não** deve tê-los —
> o JWT secret permitiria FORJAR tokens, e o service_role daria acesso total ao
> banco. A autorização é feita sem nenhum dos dois (seção 5).

## 4. Endpoints (contrato)

Base: `https://<seu-servico>.onrender.com`

### `GET /health`
Sem autenticação. Resposta imediata, sem tocar em banco.
```json
200 { "ok": true }
```
Usado pela Render (health check) e pelo app (pré-aquecimento).

### `POST /proofs/sign-upload`
Autenticado. O app pede os dados para subir um comprovante.

**Headers:** `Authorization: Bearer <supabase_jwt_do_aluno>`
**Body:**
```json
{ "paymentId": "<uuid>", "contentType": "image/jpeg" }
```
**O servidor:**
1. Valida o token chamando `GET {SUPABASE_URL}/auth/v1/user` (apikey=anon,
   Authorization=token). Obtém o `user.id`. Token inválido → `401`.
2. Monta o destino a partir do **id do próprio usuário** (não do que o cliente
   mandar): `folder = comprovantes/<userId>`, `public_id = <paymentId>`. Assim
   um aluno só consegue subir na própria pasta.
3. Assina os parâmetros com a `api_secret`
   (`cloudinary.utils.api_sign_request`), com `type: 'authenticated'`.

**Resposta:**
```json
200 {
  "cloudName": "snakethai",
  "apiKey": "1234567890",
  "timestamp": 1690000000,
  "signature": "abc123...",
  "folder": "comprovantes/<userId>",
  "publicId": "<paymentId>",
  "type": "authenticated",
  "uploadUrl": "https://api.cloudinary.com/v1_1/snakethai/auto/upload"
}
```
O app então faz o `multipart/form-data` **direto para a Cloudinary** com esses
campos + o arquivo. O servidor nunca recebe o arquivo — só assina.

### `POST /proofs/view-url`
Autenticado. Devolve a URL assinada para **ver** um comprovante.

**Headers:** `Authorization: Bearer <supabase_jwt>` (aluno dono OU admin)
**Body:**
```json
{ "paymentId": "<uuid>" }
```
**O servidor:**
1. Lê o pagamento com o **token do chamador**:
   `GET {SUPABASE_URL}/rest/v1/payments?id=eq.<paymentId>&select=user_id,proof_url`.
   A **RLS do Supabase decide a autorização**: a linha só volta se o chamador
   for o dono ou um admin. Vazio → `403`.
2. Do `proof_url` (o `public_id` na Cloudinary), gera a URL assinada:
   `cloudinary.url(publicId, { type: 'authenticated', sign_url: true, secure: true, resource_type: 'image' })`.

**Resposta:**
```json
200 { "url": "https://res.cloudinary.com/snakethai/image/authenticated/s--xxx--/comprovantes/<userId>/<paymentId>" }
```

> **Por que isto é seguro sem segredo do Supabase:** o servidor apenas repassa o
> token do chamador ao PostgREST; quem autoriza é a RLS que já existe. O servidor
> só sabe assinar a Cloudinary.

## 5. Autorização — como funciona sem segredo do Supabase

- **Identidade:** validada em `GET /auth/v1/user` (o Supabase valida a assinatura
  do JWT; o servidor não guarda o segredo do JWT nem o forja).
- **Upload:** o destino é derivado do `user.id` **verificado** — o cliente não
  escolhe a pasta, então não sobe na pasta de outro.
- **Visualização:** a RLS de `payments` (dono OU admin) decide. Se o PostgREST
  devolve a linha, está autorizado; senão, `403`.

## 6. Configuração da Cloudinary

- **Delivery type `authenticated`** em todo upload — sem isso os comprovantes
  ficam públicos por URL.
- **Pasta dedicada:** `comprovantes/<userId>/`.
- **Restrições** (no upload preset ou nos params assinados): formatos
  `jpg,jpeg,png,pdf`; tamanho máximo (ex.: 10 MB); opcional: transformação de
  entrada para remover EXIF e limitar dimensão.
- **(Opcional, hardening)** URLs de visualização com **expiração** exigem o
  recurso "Auth Token" (uma *secure delivery key* própria da Cloudinary) e
  `auth_token: { duration, key }` no `cloudinary.url`. O baseline (URL assinada
  sem expiração, só para assets autenticados) já protege; a expiração é um plus.

## 7. Como o APP se adapta ao cold start

- **Pré-aquecimento:** ao abrir a tela de Pagamento, disparar `GET /health`
  (fire-and-forget, sem travar a UI). Enquanto o aluno lê a chave PIX e escolhe
  o arquivo, o servidor acorda.
- **Timeout longo + retry:** a chamada a `/proofs/sign-upload` usa timeout de
  ~60–70 s e **um** retry automático. O upload à Cloudinary em si é rápido; a
  espera é só o cold start do assinador.
- **UX honesta:** estado de carregamento explícito ("Preparando o envio, um
  instante…"). Se estourar mesmo assim, `ErrorState` com "tentar de novo" — nunca
  tela congelada (mesmo padrão do resto do app).
- **Variável do app:** `EXPO_PUBLIC_PROOF_SERVER_URL` aponta para o serviço na
  Render. É a única coisa que o app precisa saber da infra — `cloudName`,
  `apiKey`, assinatura, tudo vem na resposta do servidor.

## 8. Mudanças no app (quando o servidor estiver no ar)

- `payments.proof_url` passa a guardar o **`public_id` da Cloudinary**
  (`comprovantes/<userId>/<paymentId>`) em vez do path do Storage.
- `submitProof` ([src/services/payments.service.ts](../src/services/payments.service.ts)):
  pede a assinatura ao servidor → faz o `multipart` direto para a Cloudinary →
  grava `proof_url = public_id` e `status = pending_approval`.
- `createSignedProofUrl`: passa a chamar `POST /proofs/view-url` com o
  `paymentId` e usa a URL que voltar.
- O Storage do Supabase segue funcionando até a Cloudinary estar testada — a
  troca é a última coisa, atrás da variável `EXPO_PUBLIC_PROOF_SERVER_URL`.

## 9. Esqueleto do servidor (Node + Express + Cloudinary SDK)

Referência mínima — a lógica que importa, não copiar-colar cego.

```js
import express from 'express';
import rateLimit from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

const app = express();
app.use(express.json({ limit: '32kb' })); // só JSON pequeno; o arquivo não passa aqui
app.use(rateLimit({ windowMs: 60_000, max: 30 })); // trava força bruta

app.get('/health', (_req, res) => res.json({ ok: true }));

// Valida o token no Supabase e devolve o user, ou null.
async function getUser(authHeader) {
  if (!authHeader) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: authHeader },
  });
  if (!r.ok) return null;
  return r.json(); // { id, ... }
}

app.post('/proofs/sign-upload', async (req, res) => {
  const user = await getUser(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });

  const { paymentId } = req.body ?? {};
  if (!/^[0-9a-f-]{36}$/i.test(paymentId ?? '')) {
    return res.status(400).json({ error: 'paymentId inválido' });
  }

  const folder = `comprovantes/${user.id}`;
  const timestamp = Math.round(Date.now() / 1000);
  const params = { folder, public_id: paymentId, timestamp, type: 'authenticated' };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    ...params,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
  });
});

app.post('/proofs/view-url', async (req, res) => {
  const auth = req.headers.authorization;
  const user = await getUser(auth);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });

  const { paymentId } = req.body ?? {};
  // A RLS decide: a linha só volta para o dono ou admin.
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/payments?id=eq.${paymentId}&select=user_id,proof_url`,
    { headers: { apikey: ANON, Authorization: auth } },
  );
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.proof_url) return res.status(403).json({ error: 'Sem acesso' });

  const url = cloudinary.url(row.proof_url, {
    type: 'authenticated', sign_url: true, secure: true, resource_type: 'image',
  });
  res.json({ url });
});

app.listen(process.env.PORT || 3000);
```

## 10. Deploy na Render

1. Repositório do servidor (pode ser separado, ou uma pasta `server/` neste
   repo). `package.json` com `"start": "node index.js"` (ou build TS → `dist`).
2. Render → **New → Web Service** → conecta o repo → plano **Free**.
3. **Environment:** cadastra as variáveis da seção 3 (as sensíveis como
   *secret*). **Nunca** commitar esses valores.
4. **Health Check Path:** `/health`.
5. Deploy. Copia a URL pública (`https://….onrender.com`) para o
   `EXPO_PUBLIC_PROOF_SERVER_URL` do app.

`render.yaml` (blueprint) opcional:
```yaml
services:
  - type: web
    name: snakethai-comprovantes
    runtime: node
    plan: free
    healthCheckPath: /health
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
```
`sync: false` = valor preenchido no painel, não no arquivo.

## 11. Checklist de segurança

- [ ] `api_secret` só na Render (nunca no app, nunca no git).
- [ ] Upload sempre `type=authenticated` (comprovante nunca público).
- [ ] Destino do upload derivado do `user.id` **verificado**, não do cliente.
- [ ] Visualização autorizada pela **RLS** (dono ou admin), não pela palavra do app.
- [ ] Sem `service_role` e sem `JWT_secret` do Supabase no servidor.
- [ ] Rate limiting nos endpoints de assinatura.
- [ ] `/health` sem I/O, para o cold start acordar rápido.
- [ ] Se a `api_secret` já vazou em algum lugar, **rotacionar** antes de usar.
