# Chave FCM de produção: passo a passo (item 3.4)

**Para que serve:** sem esta chave, o Google não entrega as notificações do app de produção
(`com.snakethai.app`). Todos os avisos ficam parados na fila: aula cancelada, justificativa
decidida, troca e versão nova. A coordenação decidiu que ela é configurada **antes do dia do G4**
(D51), e o teste de push faz parte da validação da 2.0.0 (D53).

**Tempo:** uns 15 minutos. **Você precisa de:**

- a conta Google dona do projeto do Snake Thai no Firebase;
- a conta Expo dona do projeto `snake-thai`;
- o computador com o checkout principal (`C:\Users\USER\Desktop\GIT\academy\snake-thai`).

> 🔒 **A chave é um segredo.** Ela é um arquivo `.json` que dá acesso de envio ao Firebase.
>
> - Nunca cole o conteúdo dela num chat, num e-mail ou no WhatsApp.
> - Nunca salve o arquivo dentro de `Desktop\GIT` nem em nenhuma pasta de repositório.
> - Depois de enviar à Expo, **apague o arquivo** (parte 3).
>
> **Não confunda com o `google-services.json`.** Aquele arquivo já está na pasta do projeto, é
> outro e não serve aqui.

Se você já fez este passo com o chat de coordenação, pule para **Como conferir que funcionou**.

---

## Parte 1 — Baixar a chave no Firebase

1. Abra <https://console.firebase.google.com> e entre com a conta Google do projeto.
2. Clique no cartão do projeto do Snake Thai.
3. No alto da coluna da esquerda, ao lado de **Visão geral do projeto**, clique na
   **engrenagem** ⚙️ e depois em **Configurações do projeto**.
4. Clique na aba **Contas de serviço**.
5. Clique no botão **Gerar nova chave privada** e confirme em **Gerar chave**. O navegador
   baixa um arquivo com nome parecido com `snake-thai-firebase-adminsdk-xxxxx.json`.
6. Crie uma pasta **fora** do GIT, por exemplo `C:\Users\USER\Documents\chave-fcm`, e mova o
   arquivo para lá.

**Confira antes de seguir:** ainda em **Configurações do projeto**, abra a aba **Cloud
Messaging**. A linha **API Firebase Cloud Messaging (V1)** deve dizer **Ativada**.

Se disser **Desativada**:

1. clique nos **três pontinhos** ao lado dela;
2. clique em **Gerenciar API no Google Cloud Console**;
3. na página que abrir, clique em **Ativar**.

---

## Parte 2 — Enviar a chave à Expo

O site da Expo não serve para isto: ele pede uma assinatura de build que o projeto não usa,
porque o APK sai do seu computador. O caminho é o terminal.

1. Abra o **PowerShell** e entre na pasta do projeto:

   ```powershell
   cd C:\Users\USER\Desktop\GIT\academy\snake-thai
   ```

2. Entre na conta Expo. Ele pede o usuário (ou e-mail) e a senha:

   ```powershell
   npx --yes eas-cli@latest login
   ```

   Confira com `npx --yes eas-cli@latest whoami`: aparece o seu usuário da Expo.

3. Abra o menu de credenciais do Android:

   ```powershell
   npx --yes eas-cli@latest credentials -p android
   ```

4. Ele pergunta o perfil de build. Use as setas, escolha **`prod`** e aperte **Enter**.
   O perfil `prod` é o app das pessoas (`com.snakethai.app`). O `dev` é o app de teste e não
   entra aqui.
5. No menu, escolha, com as setas e **Enter**:
   1. **Google Service Account**;
   2. **Manage your Google Service Account Key for Push Notifications (FCM V1)**;
   3. **Set up a Google Service Account Key for Push Notifications (FCM V1)**;
   4. se ele perguntar, **Upload a new service account key**.

   Os nomes podem mudar um pouco de uma versão para outra. Procure sempre **FCM V1**.
6. Ele pede o **caminho do arquivo**. Para copiar o caminho:
   1. no Explorador de Arquivos, segure **Shift**, clique com o botão direito no arquivo da
      parte 1 e escolha **Copiar como caminho**;
   2. cole no PowerShell com o botão direito do mouse;
   3. **apague as aspas** do começo e do fim e aperte **Enter**.
7. Ele mostra o resumo do `com.snakethai.app`. Na parte **Push Notifications (FCM V1)**,
   aparece a chave, com um e-mail que começa com `firebase-adminsdk-`. Confira que o **Project
   ID** é o do seu projeto no Firebase.
8. Saia do menu com **Exit**, ou com **Ctrl+C**.

---

## Parte 3 — Apagar a cópia local

1. Apague o arquivo `.json` da pasta `chave-fcm` e a própria pasta.
2. Esvazie a **Lixeira**.

A chave passa a existir só na Expo. Se um dia ela vazar ou se perder, gere outra (parte 1) e
envie de novo (parte 2). Depois, apague a antiga no Google Cloud: **IAM e administrador → Contas
de serviço → a conta `firebase-adminsdk-…` → Chaves**.

---

## Como conferir que funcionou

**1. Na Expo (agora):**

1. abra <https://expo.dev> e entre na conta;
2. abra o projeto **snake-thai**;
3. no menu da esquerda, clique em **Credentials** e depois em **Android**;
4. clique em **com.snakethai.app**.

A seção **FCM V1 service account key** mostra a chave, com o e-mail `firebase-adminsdk-…`.

**2. O resto do caminho em produção (antes do G4).** A chave sozinha não manda nada: a
`send-push` e o banco de produção também precisam dos segredos deles (`docs/NOTIFICACOES.md`,
"Publicação").

No **SQL Editor de produção**, rode:

```sql
select name from vault.secrets where name in ('push_project_url', 'push_dispatch_secret');
```

O resultado deve ter **2 linhas**.

No PowerShell, com o token da CLI do Supabase da conta do Snake Thai, rode:

```powershell
npx supabase secrets list --project-ref <PROJECT_REF>
```

A lista deve ter `PUSH_DISPATCH_SECRET` e `PUSH_APP_VARIANT`. Ela mostra só os nomes, nunca os
valores. Se faltar algum, peça ajuda ao chat do snake-thai. **Não digite os valores no chat.**

**3. O teste de verdade (com a 2.0.0, D53).** O celular só recebe com o APK da 2.0.0. No passo 4
do [`ROTEIRO-G4.md`](planos/ROTEIRO-G4.md), siga a linha **Notificações**:

1. na conta de aluno de teste, ative as notificações;
2. feche o app de vez;
3. como admin, cancele uma **aula de teste** daquele aluno;
4. o aviso "Aula cancelada" chega em até 1 minuto.

Repita com o app aberto. Tocar no aviso abre o app na aula.

---

## Se der errado

| O que aparece | O que fazer |
| --- | --- |
| `Not logged in` / `You must be logged in` | Repita o passo 2 da parte 2 (`login`) |
| O menu não mostra o projeto, ou dá erro de permissão | A conta Expo não é a dona do projeto `snake-thai`. Faça `npx --yes eas-cli@latest logout` e entre com a conta certa |
| A Expo recusa o arquivo | Provavelmente é o `google-services.json`, e não a chave. Volte à parte 1, passo 5 |
| O resumo mostra a chave em `com.snakethai.app.dev` | Você escolheu o perfil `dev`. Repita a parte 2 escolhendo `prod` |
| Depois do G4, nenhum push chega, e os logs da `send-push` mostram `credencial_push_invalida` | A chave foi apagada ou é de outro projeto. Gere outra e envie de novo (partes 1 a 3) |
