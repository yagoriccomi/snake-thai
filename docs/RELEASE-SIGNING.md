# Assinatura de release — o que só você pode fazer

> O APK que já foi compilado hoje usa a **keystore de debug**. Ela funciona
> para testar no seu aparelho, mas a **Play Store não aceita** — e, mais
> importante: **uma vez publicado o primeiro APK, toda atualização futura
> precisa ser assinada com a MESMA keystore**, para sempre. Perdê-la significa
> não conseguir mais atualizar o app — só publicar um app novo, do zero, sem
> o histórico de instalações e avaliações do anterior.
>
> Por isso ninguém além de você deve gerar essa chave, e ela nunca deve
> aparecer neste repositório, num chat ou em qualquer lugar que não seja a
> sua própria máquina (e um backup seu, guardado com cuidado).

## 1. Gerar a keystore (uma vez, para sempre)

No terminal, dentro de `snake-thai/android/app` (ou noutra pasta de sua
preferência — **fora** do repositório, se preferir manter mais seguro ainda):

```powershell
keytool -genkeypair -v -keystore snake-thai-release.keystore -alias snake-thai -keyalg RSA -keysize 2048 -validity 10000
```

Ele vai perguntar, na ordem:

1. **Senha da keystore** — invente uma forte e **anote em local seguro** (gerenciador de senhas).
2. **Repetir a senha.**
3. **Nome, organização, cidade, estado, país** — pode ser genérico, não afeta nada tecnicamente.
4. **Senha da chave** — pode ser **igual** à da keystore (mais simples de gerenciar) ou diferente.

Ao final, você terá o arquivo `snake-thai-release.keystore`. `-validity 10000`
é ~27 anos — não precisa renovar tão cedo.

⚠️ **Esse comando pede as senhas de forma interativa, digitadas por você.**
Não existe uma forma segura de eu gerar isso por você: a chave nasceria sabida
por mim, e o objetivo é o oposto disso.

## 2. Guardar a keystore com segurança

- **Backup em pelo menos 2 lugares diferentes** (ex.: um gerenciador de senha
  com anexo de arquivo + um HD externo ou nuvem privada). Se você perder este
  arquivo, perde a capacidade de atualizar o app publicado.
- **Nunca** comite este arquivo no Git. Já está protegido pelo `.gitignore`
  (`*.jks` e `*.keystore`), mas confirme antes de qualquer `git add -A`:

  ```powershell
  git check-ignore -v android\app\snake-thai-release.keystore
  ```

  Se o comando não imprimir nada, **pare** — significa que não está ignorado.

## 3. Cadastrar as senhas (sem hardcodar no código)

Crie (ou edite) o arquivo `android/gradle.properties` — que **já é ignorado
pelo Git**, junto com o restante do diretório `android/` gerado pelo
`prebuild` (o `CLAUDE.md` já registra isso) — e acrescente:

```properties
RELEASE_STORE_FILE=snake-thai-release.keystore
RELEASE_STORE_PASSWORD=<a senha da keystore>
RELEASE_KEY_ALIAS=snake-thai
RELEASE_KEY_PASSWORD=<a senha da chave>
```

Se você guardou a keystore **fora** da pasta `android/app/`, use o caminho
completo em `RELEASE_STORE_FILE`.

O `build.gradle` é lido a partir dessas quatro propriedades automaticamente —
nenhuma mudança de código é necessária a partir daqui. **Sem elas**, o build de
release continua caindo na keystore de debug, como sempre — nada quebra
enquanto você não fizer este passo.

> **Por que isso funciona mesmo depois de um `expo prebuild --clean`:** a
> pasta `android/` não é versionada — o prebuild a regenera do zero a cada
> vez, e editar `build.gradle` à mão se perderia na próxima regeneração. Por
> isso a injeção da keystore de release virou um **Config Plugin do Expo**
> (`plugins/withReleaseSigning.js`, registrado em `app.json`), que roda
> **durante** o prebuild e reaplica o bloco automaticamente. Testado de
> verdade: rodei `expo prebuild --clean` e confirmei, via
> `gradlew :app:signingReport`, que o build de release continuou apontando
> para a keystore de produção depois da regeneração completa.

## 4. Gerar o APK (ou AAB) assinado de verdade

Com o `gradle.properties` preenchido:

```powershell
cd android
.\gradlew assembleRelease
```

O arquivo sai em `android\app\build\outputs\apk\release\app-release.apk` —
mesmo caminho de sempre, mas agora assinado com a keystore de produção.

**Para publicar na Play Store**, ela pede o formato **AAB** (Android App
Bundle), não APK:

```powershell
.\gradlew bundleRelease
```

Sai em `android\app\build\outputs\bundle\release\app-release.aab`.

## 5. Confirmar qual keystore assinou o build

Se quiser conferir, a qualquer momento, qual keystore está sendo usada:

```powershell
cd android
.\gradlew :app:signingReport
```

Procure o bloco `Variant: release` — o campo `Store` mostra o caminho do
arquivo usado. Se aparecer `debug.keystore`, o `gradle.properties` não foi
lido (confira o caminho e se está na pasta certa).

## O que muda para as próximas conversas comigo

Nenhuma. Isso é orientação, não código — não peço para colar senha nem
keystore aqui. O `build.gradle` já está pronto; falta só você rodar o passo 1.
