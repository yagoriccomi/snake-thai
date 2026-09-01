# Backend próprio — o que o app precisa saber

> **Este arquivo não é a especificação do servidor.** Ele descreve apenas o que
> o `snake-thai` precisa para consumir a API — o lado de cá do contrato.
>
> **Fonte da verdade:** [`yagoriccomi/snake-server` → `docs/BACKEND.md`](https://github.com/yagoriccomi/snake-server/blob/main/docs/BACKEND.md)
> — arquitetura, endpoints, deploy e decisões de segurança do servidor moram lá,
> onde vive o código que os implementa.

## Por que este arquivo encolheu

Até 2026-08-31, a especificação inteira do servidor existia **duplicada**, byte a
byte, nos dois repositórios — sem dono declarado.

Duas cópias sem dono não permanecem iguais: elas divergem, e ninguém percebe
qual das duas está certa. Foi exatamente o que aconteceu. A spec descrevia um
contrato de dados (`proof_url` guardando o `public_id` da Cloudinary) que o app
**nunca** implementou — ele sempre gravou o path do Supabase Storage. Os dois
documentos concordavam entre si e discordavam da realidade.

Agora há um dono só, e este arquivo cobre o que é genuinamente do app. [#6][#97]

---

## O que o app precisa configurar

Uma variável, e só:

```bash
EXPO_PUBLIC_API_URL=https://<servico>.onrender.com
```

Tudo o mais — `cloudName`, assinaturas, destino do upload — vem **nas respostas**
do servidor. O app não guarda nenhum segredo de terceiro, e não deveria: um APK
publicado é um arquivo que qualquer pessoa baixa e abre.

**Se a variável estiver vazia, nada quebra.** O app continua enviando comprovante
pelo Supabase Storage, como sempre fez. É o que permite publicar uma versão antes
de o backend existir.

## Onde o app fala com o servidor

| Arquivo | Papel |
| --- | --- |
| [`src/lib/api.ts`](../src/lib/api.ts) | Cliente HTTP único: base URL, `Authorization`, timeout, retry, pré-aquecimento |
| [`src/services/proofs.service.ts`](../src/services/proofs.service.ts) | Decide o provedor, envia o comprovante e obtém a URL de visualização |
| [`src/components/WaitingState.tsx`](../src/components/WaitingState.tsx) | A espera honesta durante o cold start |

Nenhuma tela chama `fetch` cru. Toda chamada passa pelo `api.ts`. [#6][#13]

## As três coisas que doem se você não souber

### 1. O servidor hiberna, e a primeira chamada leva até um minuto

O plano free da Render dorme após ~15 min sem tráfego. Isso não é bug, é o plano.

O app lida com isso em três camadas:

- **`preAquecer()` ao ABRIR a tela** — não no momento do envio. Enquanto o aluno
  lê a chave PIX e paga no app do banco, o contêiner sobe. Quando ele volta para
  anexar o comprovante, o cold start já passou.
- **Timeout de 65 s**, dimensionado pela hibernação e não pela latência normal
  (que é de milissegundos).
- **`WaitingState`**, que depois de 4 segundos **explica** a demora em vez de
  continuar girando calado. Um spinner mudo por um minuto é indistinguível de
  aplicativo travado — e o usuário fecha o app no meio do envio do comprovante.

### 2. O retry NÃO acontece em erro do servidor

`chamarApi` repete uma vez apenas em **falha de rede**. Um 4xx é a palavra final
do servidor: repetir um 403 não muda o resultado, dobra a espera do usuário e,
num POST, pode duplicar efeito.

Se você adicionar um endpoint novo, esse comportamento vem de graça. Não o
contorne com um retry próprio.

### 3. Existem comprovantes em DOIS lugares ao mesmo tempo

O app está publicado: há APKs antigos em campo gravando no Supabase Storage
enquanto os novos gravam na Cloudinary.

**Quem decide de onde ler cada arquivo é a coluna `proof_provider` da linha do
pagamento — nunca um palpite do app.**

```ts
// Certo: a linha diz onde o arquivo está.
if (pagamento.proof_provider === 'cloudinary') { /* pede ao backend */ }
else { /* URL assinada do Storage */ }
```

Adivinhar aqui não dá erro barulhento: dá um link quebrado, em silêncio, para um
dado financeiro. Por isso as telas recebem a **referência completa** do
comprovante (`ReferenciaDeComprovante`), e não um caminho solto.

## Contratos que o app consome

Detalhes completos na fonte da verdade. O essencial:

| Endpoint | Quando o app chama |
| --- | --- |
| `POST /v1/proofs/sign-upload` | O aluno anexa o comprovante. Devolve a assinatura; o arquivo vai **direto** para a Cloudinary, sem passar pelo nosso servidor |
| `POST /v1/proofs/view-url` | O admin abre o comprovante de um pagamento já migrado |
| `GET /health` | Pré-aquecimento. Não autenticado, sem I/O |

Erros chegam padronizados como `{ error, code }` e viram `ApiError`. A mensagem
do campo `error` é escrita para ser exibida ao usuário; o `code` é para o app
decidir o que fazer.

## Banco de dados

O schema do comprovante (`proof_provider`, `proof_public_id`,
`proof_storage_path`, a fila `media_deletion_queue` e a função de eliminação da
LGPD) vive **neste** repositório, em [`supabase/migrations/`](../supabase/migrations/)
— é aqui que a Supabase CLI está configurada.

Ou seja: o **schema** é deste repo; a **API** é do outro. Cada documento no repo
que contém o código que ele descreve.
