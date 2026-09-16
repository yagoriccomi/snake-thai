# Assinatura de release — chave de produção

> Para quem publica o APK do **Snake Thai** (o app de produção). O app **DEV** não
> usa nada disto: assina com a chave de debug e nunca é publicado.

Todo APK Android é assinado. O Android só instala uma atualização **por cima** se ela
tiver a **mesma assinatura** do app instalado. Por isso:

- **Perder a chave de produção** = nunca mais conseguir atualizar o app instalado nas
  pessoas. Só resta publicar outro app e pedir que todos desinstalem.
- **A chave vazar** = qualquer pessoa consegue fazer um APK falso que se instala por cima
  do verdadeiro.
- A chave nasce **na sua máquina, digitada por você**. Ninguém mais gera, recebe ou vê a
  senha — nem num chat.

Até a 1.6.0 o release saía com a chave de **debug** do template, que é pública. A partir
de agora o build de release **falha** se a chave de produção não estiver configurada
(`plugins/withReleaseSigning.js`), em vez de cair na de debug sem avisar.

## 1. Gerar a keystore (uma vez, para sempre)

No PowerShell, **fora** do repositório e fora de `android/` (a pasta `android/` é
apagada e recriada pelo prebuild):

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.chaves\snake-thai"
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
  -storetype PKCS12 `
  -keystore "$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12" `
  -alias snake-thai -keyalg RSA -keysize 4096 -validity 10000 `
  -dname "CN=Snake Thai, O=Snake Thai, C=BR"
```

- O `keytool` pede a senha: **digite**, não passe `-storepass` na linha de comando (ela
  ficaria no histórico do terminal).
- Use uma senha forte. No formato PKCS12 a senha da chave é a **mesma** da keystore.
- O `-dname` é neutro de propósito: o certificado vai dentro de todo APK público, então
  nada de nome pessoal, e-mail ou endereço.
- `-validity 10000` são ~27 anos (a Play Store exige validade além de 2033).

Confira e anote a impressão digital:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v `
  -keystore "$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12"
```

Anote no gerenciador de senhas: senha, alias (`snake-thai`), data de criação e o
**SHA256** do certificado.

## 2. Duas cópias de segurança (e testar a restauração)

1. **Gerenciador de senhas** (Bitwarden, 1Password…): uma entrada com o `.p12` anexado,
   a senha, o alias, a data e o SHA256.
2. **Pendrive ou HD externo guardado offline**, só com o arquivo — **sem** a senha junto.

Nunca por e-mail, WhatsApp, chat ou pasta de projeto. **Teste a restauração**: baixe o
anexo do gerenciador numa pasta temporária, rode o `keytool -list -v` com a senha
guardada, confira o SHA256 e apague a cópia temporária.

## 3. Ensinar o build a achar a chave

Crie (ou edite) `%USERPROFILE%\.gradle\gradle.properties` — o Gradle lê esse arquivo em
todo build, ele sobrevive ao prebuild e fica fora do Git:

```properties
SNAKETHAI_RELEASE_STORE_FILE=C:/Users/<seu usuário>/.chaves/snake-thai/snake-thai-release.p12
SNAKETHAI_RELEASE_STORE_PASSWORD=<a senha>
SNAKETHAI_RELEASE_KEY_ALIAS=snake-thai
SNAKETHAI_RELEASE_KEY_PASSWORD=<a mesma senha>
```

- Caminho com `/`: em arquivo `.properties` a `\` é caractere especial.
- O prefixo `SNAKETHAI_` evita que outro projeto Gradle da máquina use estas propriedades.
- Deixe o **BitLocker** ligado no disco (`manage-bde -status C:`): a senha fica em texto
  neste arquivo, protegida pela sua conta do Windows e pela criptografia do disco.
- Nada de `RELEASE_*` em `android/gradle.properties`: essa pasta é recriada.

## 4. Conferir antes de publicar

```powershell
cd android
.\gradlew :app:signingReport
```

No bloco `Variant: release`, `Store` deve apontar para o `.p12` e o `SHA-256` deve ser o
que você anotou (e **não** `FA:C6:17:45:…:3B:9C`, que é a chave de debug).

Depois do build, o `menu.bat` `[5]` (variante PROD) mostra o certificado do APK e avisa
em destaque se ele saiu com a chave de debug. Manualmente:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\<versão>\apksigner.bat" verify --print-certs release\snake-thai-v<versão>.apk
```

**Impressão digital SHA-256 do certificado de produção:** _a preencher depois da geração
(é pública; o arquivo e a senha, não)._

## O que a trava faz

Com a variante de produção, o prebuild grava no `android/app/build.gradle`:

- o `signingConfig` de release lendo as quatro propriedades `SNAKETHAI_RELEASE_*`;
- uma checagem que, ao empacotar um release (`packageRelease` ou `signReleaseBundle`),
  para o build com **"Release sem keystore de producao: configure SNAKETHAI_RELEASE_\*"**
  se a propriedade faltar ou o arquivo não existir.

`assembleDebug` e o app DEV continuam funcionando sem chave nenhuma.

## Trocar a assinatura obriga desinstalar (uma vez)

Quem tem instalado um APK assinado com a chave de debug (1.6.0 ou anterior) **não**
consegue instalar por cima o primeiro APK com a chave de produção: o Android recusa
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Nesse único momento:

1. concluir qualquer chamada em andamento;
2. desinstalar o Snake Thai;
3. instalar o APK novo e entrar de novo (a sessão salva no aparelho se perde; os dados
   ficam no servidor).

Daí em diante as atualizações voltam a instalar por cima.

## Play Store (se um dia for publicar)

A loja pede **AAB**: `.\gradlew bundleRelease` (sai em
`android\app\build\outputs\bundle\release\app-release.aab`). No Play Console, em
*Assinatura do app*, escolha **usar a sua própria chave** e envie esta keystore pela
ferramenta PEPK que o próprio Console fornece, com uma *upload key* separada. Assim o APK
do GitHub e o app da loja têm a mesma assinatura e ninguém precisa desinstalar para
trocar de um para o outro. Se deixar o Google gerar a chave, os dois ficam incompatíveis.

## Build pelo GitHub Actions

O workflow `.github/workflows/release.yml` (**Release Android**) lê:

| No GitHub | Nome |
| --- | --- |
| Environment (Settings → Environments → New environment; *Deployment branches and tags*: branch `main` e tag `v*`) | `release` |
| Secret: a keystore em base64 | `RELEASE_KEYSTORE_BASE64` |
| Secrets: senha, alias, senha da chave | `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD` |
| Secrets: o app de produção (copie do painel da Supabase de **produção**, não do `.env.dev`) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` (opcional) |
| Variável pública: SHA-256 do certificado (a linha `SHA256` do `keytool -list -v`) | `RELEASE_CERT_SHA256` |

Você mesmo cadastra os secrets, sem os valores passarem por ninguém:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12")) | gh secret set RELEASE_KEYSTORE_BASE64 --env release --repo yagoriccomi/snake-thai
gh secret set RELEASE_STORE_PASSWORD --env release --repo yagoriccomi/snake-thai   # pede o valor sem mostrar
gh secret set RELEASE_KEY_ALIAS --env release --repo yagoriccomi/snake-thai
gh secret set RELEASE_KEY_PASSWORD --env release --repo yagoriccomi/snake-thai
gh secret set EXPO_PUBLIC_SUPABASE_URL --env release --repo yagoriccomi/snake-thai
gh secret set EXPO_PUBLIC_SUPABASE_ANON_KEY --env release --repo yagoriccomi/snake-thai
gh secret set EXPO_PUBLIC_API_URL --env release --repo yagoriccomi/snake-thai
gh variable set RELEASE_CERT_SHA256 --env release --repo yagoriccomi/snake-thai --body "<SHA256 do certificado>"
```

No workflow, a keystore é decodificada para `$RUNNER_TEMP` e as senhas chegam ao Gradle
como `ORG_GRADLE_PROJECT_SNAKETHAI_RELEASE_*` (o plugin não muda nada). Regras: só em
tag `v*` ou disparo manual, nunca `pull_request_target`, actions fixadas por SHA, sem
`set -x`, `.p12` apagado num passo `if: always()`, e o workflow falha se o SHA-256 do
certificado do APK for diferente de `RELEASE_CERT_SHA256`.
