# PLANO DE EXECUÇÃO — T5: GitHub Actions: gratuidade e build/publicação automática do APK assinado (workflow de release separado do CI)

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T5` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `ci/release-android` |
| **Esforço** | M |
| **Depende de** | T2 |

## 1. Enunciado

Criar um workflow novo, `.github/workflows/release.yml`, sem mexer no `ci.yml`. Ele roda quando uma tag vX.Y.Z é enviada ou quando é disparado à mão na main. O job faz npm ci, cria o .env de produção a partir dos secrets, restaura a keystore de produção guardada em base64, roda expo prebuild e depois assembleRelease e bundleRelease. Em seguida bloqueia a publicação se o APK sair assinado com a chave de debug, e só então anexa APK, AAB e SHA256SUMS ao GitHub Release. Para este repositório (público, conta pessoal Free) o GitHub Actions é gratuito e não tem cota de minutos, por isso é recomendado no lugar do EAS Build gratuito (15 builds Android por mês, fila de baixa prioridade).

### Resposta às perguntas do usuário

Sim, o GitHub Actions é gratuito no seu caso. O snake-thai é PÚBLICO e está numa conta pessoal Free (conferido com `gh repo view` → PUBLIC e `gh api user` → plano free). A documentação do GitHub diz: "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners." Na prática:

- **Repositório público:** não há cota de minutos. O runner Linux tem 4 vCPU, 16 GB de RAM e 14 GB de SSD. Os limites são técnicos: cada job pode durar até 6 h e rodam até 20 jobs ao mesmo tempo. O cache é de 10 GB por repositório. O APK vai para o GitHub Release, que aceita arquivos de até 2 GiB, sem limite de tamanho total nem de banda. O snake-server também é público, então vale o mesmo.
- **Se fosse privado:** 2.000 minutos por mês incluídos e um runner menor (2 vCPU, 8 GB). Acima da cota, Linux custa US$ 0,006 por minuto. Sem cartão cadastrado, o uso é simplesmente bloqueado quando a cota acaba, sem cobrança surpresa. Os "larger runners" são cobrados sempre, mesmo em repositório público; o plano não usa esses runners.

Fontes (consultadas em 2026-09-16):
- docs.github.com/en/billing/concepts/product-billing/github-actions
- docs.github.com/en/actions/reference/limits
- docs.github.com/en/actions/reference/runners/github-hosted-runners
- docs.github.com/en/repositories/releasing-projects-on-github/about-releases

**Consigo configurar, sim.** O plano cria um workflow separado do CI, sem testes, respeitando o "esquece o CI":
- **Tag vX.Y.Z:** gera o APK e o AAB assinados com a keystore de produção, confere que não saíram com a chave de debug e publica no GitHub Release.
- **Botão manual na main:** gera um APK de ensaio para testar no celular antes de criar a tag.

Só você pode fazer três coisas: gerar a keystore (T2), criar o environment "release" e cadastrar os secrets no GitHub.

**Comparação com o EAS Build gratuito** (expo.dev/pricing, consultado nesta data):

| | EAS Build gratuito | GitHub Actions (seu caso) |
|---|---|---|
| Builds Android por mês | 15 | sem limite de minutos |
| Fila | baixa prioridade, pode demorar | sem fila de prioridade |
| Timeout | 45 min | 6 h por job |
| Builds simultâneos | 1 | até 20 jobs |
| Onde fica a keystore | nos servidores da Expo | na sua conta do GitHub |
| Configuração | eas.json, conta Expo e EXPO_TOKEN | workflow no próprio repositório |
| Destino do APK | expo.dev (precisa de passo extra para o GitHub Release) | direto no GitHub Release |

O plano pago Starter do EAS custa US$ 19/mês. A vantagem real do EAS é o incremento automático do número de build, o que ajudaria na tarefa de versionamento.

**Recomendação:** GitHub Actions. Custa zero, não tem cota, repete o fluxo local que já funciona (prebuild, plugin de assinatura, Gradle) e publica onde você já distribui o APK. O EAS só passa a valer a pena se o repositório virar privado e os 2.000 minutos por mês não bastarem.

**Observação lateral:** o CI atual falhou nas últimas 10 execuções, sempre nos testes SQL do banco. Não mexi nisso porque você pediu para esquecer o CI, e o workflow de release não depende dele.

## 2. Terreno (situação verificada)

- O snake-thai é PÚBLICO, pertence a uma conta pessoal e está no plano Free. O snake-server também é público.  
  _Evidência:_ `gh repo view` → visibility PUBLIC; `gh api users/yagoriccomi` → type User; `gh api user` → plan.name "free"; `gh repo view` no snake-server → PUBLIC
- GitHub Actions é gratuito para repositório público com runner padrão. Em repositório privado no Free a conta tem 2.000 min/mês, 500 MB de artefatos e 10 GB de cache. Linux 2-core custa US$ 0,006/min acima da cota. Sem forma de pagamento cadastrada, o uso é bloqueado quando a cota acaba. Larger runners são sempre cobrados.  
  _Evidência:_ docs.github.com/en/billing/concepts/product-billing/github-actions (lido via WebFetch em 2026-09-16): "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners"; tabela GitHub Free: 2,000 min / 500 MB / 10 GB; "Larger runners are always charged for, even when used by public repositories"; "If your account does not have a valid payment method on file, usage is blocked once you use up your quota."
- O runner Linux padrão tem 4 vCPU, 16 GB de RAM e 14 GB de SSD em repositório público, e 2 vCPU, 8 GB e 14 GB em privado. Um job pode durar até 6 h e o Free permite 20 jobs simultâneos. Em Release, cada arquivo pode ter até 2 GiB, sem limite de tamanho total nem de banda.  
  _Evidência:_ docs.github.com/en/actions/reference/runners/github-hosted-runners; docs.github.com/en/actions/reference/limits ("Each job in a workflow can run for up to 6 hours"); docs.github.com/en/repositories/releasing-projects-on-github/about-releases ("Each file included in a release must be under 2 GiB. There is no limit on the total size of a release, nor bandwidth usage.")
- workflow_dispatch só funciona se o arquivo do workflow estiver na branch padrão (main). Hoje a main está 10 commits atrás de feat/papel-professor.  
  _Evidência:_ docs.github.com/.../manually-run-a-workflow: "To trigger the workflow_dispatch event, your workflow must be in the default branch."; `git rev-list --count origin/main..feat/papel-professor` → 10
- Só existe um workflow, o CI. Ele dispara em push e pull_request filtrando apenas branches, então push de tag não o dispara. Usa Node 20 e actions v4, e o comentário do cabeçalho diz que o APK é gerado localmente.  
  _Evidência:_ .github/workflows/ci.yml:12-16 (`branches: ['**']`), :3-5 (comentário), :30-35 (checkout@v4, setup-node@v4, node '20'); `gh workflow list` → só "CI"
- As 10 últimas execuções do CI falharam, sempre no job de regressão SQL do banco. Está fora do escopo porque o usuário disse "esquece o CI", mas o release não pode depender desse CI.  
  _Evidência:_ `gh run list --limit 10` → todas failure; `gh run view 34896039860` → job "Regressão de segurança no banco (RLS e triggers)" falhou no passo "Executa os testes de regressão SQL"; os jobs de tipos/testes e CVE passaram
- O repositório não tem secrets, variables, environments nem rulesets. As permissões padrão do GITHUB_TOKEN são só leitura.  
  _Evidência:_ `gh secret list` e `gh variable list` → vazios; `gh api .../environments` → total_count 0; `gh api .../rulesets` → []; `gh api .../actions/permissions/workflow` → default_workflow_permissions "read"
- Existe uma única release, v1.6.0, publicada manualmente em 2026-09-14. O asset snake-thai-v1.6.0.apk tem 84.770.599 bytes e a tag aponta para 6a99b40, commit que não contém release.yml. Logo, o novo workflow não consegue gerar de novo a v1.6.0.  
  _Evidência:_ `gh release view v1.6.0 --json ...` → targetCommitish 6a99b40..., asset size 84770599; `git tag` → só v1.6.0
- A assinatura de release depende da propriedade Gradle RELEASE_STORE_FILE. Sem ela, o build cai EM SILÊNCIO na keystore de debug. Uma propriedade de projeto pode ser passada no CI por variável de ambiente ORG_GRADLE_PROJECT_*, sem gravar senha em arquivo.  
  _Evidência:_ plugins/withReleaseSigning.js:33-38 (`if (project.hasProperty('RELEASE_STORE_FILE'))`) e :47-48 (fallback `signingConfigs.debug`); android/app/build.gradle:125; a lista de nomes de propriedades em android/gradle.properties não inclui RELEASE_STORE_FILE
- Versões da toolchain: expo 57.0.14 e react-native 0.86.0. O RN aceita Node ^20.19.4, ^22.13.0 ou ^24.3.0, usa compileSdk 36, buildTools 36.0.0, NDK 27.1.12297006, AGP 8.12.0 e Kotlin 2.1.20. O Gradle wrapper é 9.3.1 e o plugin Gradle do RN usa jvmToolchain(17).  
  _Evidência:_ node_modules/expo/package.json:3; node_modules/react-native/package.json:3,23-24; node_modules/react-native/gradle/libs.versions.toml:3-10; android/gradle/wrapper/gradle-wrapper.properties (gradle-9.3.1); node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts:63
- A imagem oficial do EAS Build para o SDK 57 usa JDK 17, Node 22.23.1 e NDK 27.1.12297006, e a doc de ambiente do Expo manda instalar JDK 17. Localmente o build usa o JBR 21 do Android Studio.  
  _Evidência:_ docs.expo.dev/build-reference/infrastructure → `ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`, Node 22.23.1; docs.expo.dev/get-started/set-up-your-environment ("microsoft-openjdk17" / "zulu@17"); menu.bat:17 e `java -version` do JBR → 21.0.10
- A imagem ubuntu-24.04 do runner já traz Java 17 como padrão e Node 22.23.2, mas o NDK padrão é o 27.3.13750724. O NDK 27.1.12297006 exigido pelo RN não vem instalado.  
  _Evidência:_ github.com/actions/runner-images/.../Ubuntu2404-Readme.md (WebFetch): "17.0.20+1 (default)", NDK "27.3.13750724 (default)", "28.2...", "29.0..."
- Versões major mais recentes das actions: checkout v7.0.1, setup-node v7.0.0, setup-java v6.0.1, gradle/actions v6.3.0 e upload-artifact v7.0.1. O cache 'enhanced' do setup-gradle é gratuito para repositório público.  
  _Evidência:_ `gh api repos/<action>/releases/latest` em 2026-09-16; github.com/gradle/actions/docs/setup-gradle.md: "free for all public repositories"; o cache 'basic' (MIT) é "free for all repositories"
- app.json tem version 1.6.0 e não define versionCode, então o build gerado usa versionCode 1.  
  _Evidência:_ app.json:5 e app.json:16-26 (sem versionCode); android/app/build.gradle:95-96 (`versionCode 1`, `versionName "1.6.0"`)
- O build atual inclui 4 ABIs, e x86 e x86_64 só servem para emulador. Isso explica o APK de cerca de 85 MB e aumenta o tempo de build.  
  _Evidência:_ android/gradle.properties: `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`
- O app exige EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY e trata EXPO_PUBLIC_API_URL como opcional. A validação acontece na EXECUÇÃO, não no build: um APK gerado sem essas variáveis compila e quebra ao abrir. O .env local também tem EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME e EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET, que o código em src/ não usa.  
  _Evidência:_ src/config/env.ts:18-26 e 45-58; nomes lidos do .env sem os valores; `grep -rn EXPO_PUBLIC_CLOUDINARY src` → 0 ocorrências
- A documentação de release descreve só o build manual, e o RUNBOOK ainda diz que o release usa a chave de debug.  
  _Evidência:_ README.md:94-99; docs/RUNBOOK.md:94-110 (linha 108: "o release atual usa a chave de debug"); docs/RELEASE-SIGNING.md não tem seção sobre CI
- O cache do Actions hoje ocupa cerca de 134 MB (1 entrada, cache npm do CI), dentro do limite de 10 GB.  
  _Evidência:_ `gh api repos/yagoriccomi/snake-thai/actions/cache/usage` → active_caches_size_in_bytes 133969706, count 1

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Qual plataforma deve fazer o build e a publicação automática do APK?**

- GitHub Actions (workflow próprio no repositório)
- EAS Build no plano gratuito da Expo (disparado pelo Actions com EXPO_TOKEN)
- Continuar só com build local pelo menu.bat

➡️ _Adotado:_ GitHub Actions. Em repositório público não custa nada e não tem cota de minutos. Repete exatamente o fluxo local que já funciona (prebuild, plugin withReleaseSigning, Gradle), publica direto no GitHub Release onde o APK já é distribuído e mantém a keystore na sua conta do GitHub. O EAS gratuito tem 15 builds Android por mês, fila de baixa prioridade, timeout de 45 min e 1 build por vez. Além disso, a keystore iria para os servidores da Expo e seria preciso um passo extra para copiar o APK para o GitHub Release.

**P2. O que deve disparar o workflow?**

- Push de tag vX.Y.Z (publica) + disparo manual na main (ensaio, sem publicar)
- Só disparo manual
- Só push de tag

➡️ _Adotado:_ Tag e disparo manual. A tag v1.7.0 publica a release. O disparo manual na main gera um APK assinado de ensaio, guardado como artefato por 3 dias, para testar no celular antes de criar a tag.

**P3. Ao receber a tag, a release entra publicada direto ou como rascunho?**

- Publicar direto (vira a Latest) depois das checagens automáticas
- Criar como rascunho (draft) e você publica no site depois de testar

➡️ _Adotado:_ Publicar direto, que é o que você pediu. O workflow só publica se a tag bater com a versão do app.json, se o pacote for com.snakethai.app e se o certificado bater com a impressão digital da keystore de produção. Para testar antes, use o ensaio manual na main.

**P4. Para quais arquiteturas o APK de release deve ser gerado?**

- Só celulares reais: arm64-v8a e armeabi-v7a
- Manter as 4 atuais (inclui x86 e x86_64 de emulador)

➡️ _Adotado:_ arm64-v8a e armeabi-v7a. x86 e x86_64 só servem para emulador. Tirá-las deixa o APK bem menor e o build mais rápido, e o seu Samsung SM-S928B é arm64. A mudança vale só no workflow (-PreactNativeArchitectures) e não altera o build local.

**P5. O que fazer com o AAB (formato exigido pela Play Store)?**

- Gerar e anexar ao Release como snake-thai-vX.Y.Z-playstore.aab
- Gerar só como artefato temporário do workflow
- Não gerar por enquanto

➡️ _Adotado:_ Gerar e anexar ao Release. Aproveita a mesma compilação, não custa nada e deixa pronto um arquivo assinado para uma eventual Play Store. O sufixo -playstore evita que alguém baixe o arquivo errado.

**P6. Onde guardar os segredos (keystore e senhas)?**

- Environment 'release' restrito à branch main e às tags v*
- Repository secrets comuns (qualquer workflow de qualquer branch consegue ler)

➡️ _Adotado:_ Environment 'release' com regra de branches e tags (main + v*). É gratuito em repositório público e impede que um workflow em outra branch leia a keystore.

## 4. Ações que só o usuário pode fazer

- [ ] PRÉ-REQUISITO (T2): gerar a keystore de produção com `keytool -genkeypair ...` (as senhas são pedidas de forma interativa, ver docs/RELEASE-SIGNING.md seção 1) e guardar backup em 2 lugares. Sem ela o T5 pode ser escrito, mas não pode ser executado.
- [ ] Obter a impressão digital pública do certificado com `keytool -list -v -keystore C:\caminho\snake-thai-release.keystore -alias snake-thai`, copiar a linha SHA256 e cadastrá-la como VARIABLE (não é segredo) com o nome RELEASE_CERT_SHA256 no environment 'release'.
- [ ] Criar o environment: github.com/yagoriccomi/snake-thai → Settings → Environments → New environment → nome `release` → Deployment branches and tags → Selected branches and tags → adicionar a branch `main` e a tag `v*`.
- [ ] Cadastrar os SECRETS no environment 'release' (Settings → Environments → release → Environment secrets → Add secret) ou pelo terminal, na sua máquina: RELEASE_KEYSTORE_BASE64, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY e, se o backend estiver no ar, EXPO_PUBLIC_API_URL. Para a keystore, no PowerShell: `gh secret set RELEASE_KEYSTORE_BASE64 --env release --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\caminho\snake-thai-release.keystore')))`. Para as senhas, use `gh secret set RELEASE_STORE_PASSWORD --env release` e cole quando ele pedir. Nunca cole valores no chat.
- [ ] Copiar URL e anon key do projeto de PRODUÇÃO direto do painel da Supabase (Project Settings → API), e não do .env local, que depois da separação dev/prod pode apontar para o banco local em Docker.
- [ ] Autorizar explicitamente: push da branch com o workflow, abertura do PR, merge na main (necessário para o disparo manual aparecer) e criação e push da primeira tag de release.
- [ ] Testar o APK do ensaio no celular. Antes, DESINSTALAR o Snake Thai assinado com a chave de debug: a assinatura muda e o Android recusa a atualização por cima (a sessão salva no aparelho se perde).
- [ ] (Opcional) Proteger as tags: Settings → Rules → Rulesets → New tag ruleset, alvo `v*`, bloqueando exclusão e atualização (evita mover uma tag já publicada).

## 5. Passos atômicos

### Passo 1

Esperar a tarefa de push/PR/merge levar feat/papel-professor para a main e então criar a branch `ci/release-android` a partir da origin/main atualizada. O workflow precisa estar na main para o disparo manual aparecer, e as tags de release serão criadas na main.

**Como verificar:** `git log --oneline origin/main | grep 6a99b40` retorna o commit e `git branch --show-current` mostra ci/release-android.

### Passo 2

Criar `.github/workflows/release.yml`, separado do CI, sem testes e sem tocar no ci.yml. Cabeçalho: `name: Release Android`; `on: push: tags: ['v*.*.*']` e `workflow_dispatch:`; `concurrency: {group: release-${{ github.ref }}, cancel-in-progress: false}`; `permissions: contents: read` no topo. Job `android`: `runs-on: ubuntu-24.04` (fixo em vez de ubuntu-latest, por reprodutibilidade), `timeout-minutes: 90`, `environment: release`, `permissions: contents: write`, env `ABIS: armeabi-v7a,arm64-v8a` e `NDK_VERSION: 27.1.12297006`. Se a tarefa dev/prod criar um app.config com APP_VARIANT, adicionar `APP_VARIANT: production`. Escrever comentários explicando o PORQUÊ em português, seguindo o padrão do ci.yml.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** O arquivo existe e `git diff origin/main --stat -- .github/workflows/ci.yml` não mostra mudança.

### Passo 3

Passos de preparação e travas. (a) `actions/checkout@v7`. (b) Passo `modo` (id: modo): se `$GITHUB_REF_TYPE` = tag, exigir o formato `^v[0-9]+\.[0-9]+\.[0-9]+$`, ler `node -p "require('./app.json').expo.version"`, falhar com `::error::` se `v$VERSAO` for diferente de `$GITHUB_REF_NAME`, e gravar `publicar=true` e `nome=$GITHUB_REF_NAME` em $GITHUB_OUTPUT. Caso contrário, gravar `publicar=false` e `nome=ensaio-${GITHUB_SHA::7}`. (c) Liberar disco, porque o runner público tem 14 GB: `sudo rm -rf /usr/share/dotnet /opt/ghc /usr/local/.ghcup "$AGENT_TOOLSDIRECTORY/CodeQL"; df -h /`. (d) `actions/setup-node@v7` com node-version '22' e cache npm. (e) `actions/setup-java@v6` com distribution temurin e java-version '17'. (f) `gradle/actions/setup-gradle@v6`. (g) `npm ci`. (h) Instalar o NDK exigido: `yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;$NDK_VERSION" > /dev/null`.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** No primeiro run, o log de `df -h /` mostra espaço livre e o passo `modo` falha de propósito se for disparado numa tag diferente da versão do app.json (testar mentalmente ou revisar o YAML; não criar tag de teste).

### Passo 4

Segredos, sem gravar senha em disco e sem imprimir nada. (a) Passo `.env`, com os secrets passados só no `env:` do passo: validar com `: "${EXPO_PUBLIC_SUPABASE_URL:?secret ausente}"` e `: "${EXPO_PUBLIC_SUPABASE_ANON_KEY:?secret ausente}"`, e depois `umask 077; printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_ANON_KEY=%s\nEXPO_PUBLIC_API_URL=%s\n' ... > .env`. Não criar as variáveis CLOUDINARY, que o código não usa. (b) Passo keystore: `: "${RELEASE_KEYSTORE_BASE64:?secret ausente}"; umask 077; printf '%s' "$RELEASE_KEYSTORE_BASE64" | base64 --decode > "$RUNNER_TEMP/release.keystore"`. O arquivo fica em RUNNER_TEMP, que não entra no cache do setup-gradle. (c) Proibido no arquivo: `set -x`, `cat .env`, `--info` ou `--debug` do Gradle, e echo de qualquer valor. Os logs de repositório público são públicos, e o GitHub mascara o secret, mas não valores derivados dele, como a keystore decodificada.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** Revisão do YAML: nenhum `secrets.*` em `env:` de nível de job, só em passos, e nenhum comando que imprima .env ou a keystore. No run de ensaio, o log não mostra nenhum valor (buscar pelo host da Supabase no log baixado com `gh run view <id> --log`).

### Passo 5

Prebuild e compilação. (a) `npx expo prebuild --platform android --clean --no-install` (o `--no-install` evita reinstalar e não altera package.json). (b) Passo de build com `working-directory: android` e env `ORG_GRADLE_PROJECT_RELEASE_STORE_FILE: ${{ runner.temp }}/release.keystore`, `ORG_GRADLE_PROJECT_RELEASE_STORE_PASSWORD: ${{ secrets.RELEASE_STORE_PASSWORD }}`, `ORG_GRADLE_PROJECT_RELEASE_KEY_ALIAS: ${{ secrets.RELEASE_KEY_ALIAS }}` e `ORG_GRADLE_PROJECT_RELEASE_KEY_PASSWORD: ${{ secrets.RELEASE_KEY_PASSWORD }}`. Isso ativa o `project.hasProperty('RELEASE_STORE_FILE')` do plugin sem editar gradle.properties. Validar as três senhas e o alias com `:?` e rodar `./gradlew assembleRelease bundleRelease -PreactNativeArchitectures="$ABIS" --no-daemon`. Não gravar as senhas em ~/.gradle/gradle.properties, porque o setup-gradle faz cache do GRADLE_USER_HOME.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** No run, existem android/app/build/outputs/apk/release/app-release.apk e android/app/build/outputs/bundle/release/app-release.aab (`ls -la` num passo seguinte). Se faltar NDK ou CMake, ou houver OOM, ajustar conforme a seção de riscos.

### Passo 6

Checagem que bloqueia a publicação. Com env `CERT_ESPERADO: ${{ vars.RELEASE_CERT_SHA256 }}`: `BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"`; `CERTS=$("$BT/apksigner" verify --print-certs "$APK")`. Falhar se `grep -q 'CN=Android Debug' <<<"$CERTS"` encontrar algo. Normalizar o esperado com `tr -d ':' | tr 'A-F' 'a-f'` e exigir `SHA-256 digest: <esperado>` em $CERTS. Exigir `package: name='com.snakethai.app'` e `versionName='<versão da tag>'` em `"$BT/aapt2" dump badging "$APK" | head -1`, que pode ser impresso por não ser segredo. No AAB, rodar `keytool -printcert -jarfile app-release.aab` e comparar o mesmo SHA256. Opcional: `unzip -p "$APK" assets/index.android.bundle | grep -a -q -F "$EXPO_PUBLIC_SUPABASE_URL"`, que confirma o banco de produção embutido sem imprimir nada. Se o bytecode Hermes der falso negativo, remover essa checagem.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** Teste negativo do ensaio: rodar uma vez com RELEASE_CERT_SHA256 propositalmente errado, o job precisa falhar nesta checagem. Depois corrigir a variável e rodar de novo até passar.

### Passo 7

Saída e publicação. (a) `mkdir -p saida`, copiar para `saida/snake-thai-${NOME}.apk` e `saida/snake-thai-${NOME}-playstore.aab`, e rodar `(cd saida && sha256sum * > SHA256SUMS.txt)`. (b) `if: steps.modo.outputs.publicar == 'true'`, com env `GH_TOKEN: ${{ github.token }}`: se `gh release view "$GITHUB_REF_NAME"` existir, `gh release upload "$GITHUB_REF_NAME" saida/* --clobber` (cobre reexecução); senão, `gh release create "$GITHUB_REF_NAME" saida/* --verify-tag --generate-notes --title "Snake Thai ${GITHUB_REF_NAME#v}"`. Usar a gh CLI da imagem e nenhuma action de terceiros com acesso ao job que tem a keystore. (c) `if: steps.modo.outputs.publicar != 'true'`: `actions/upload-artifact@v7` com name snake-thai-ensaio, path saida/ e retention-days 3. (d) Último passo com `if: always()`: `rm -f "$RUNNER_TEMP/release.keystore" .env`.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** No ensaio, `gh run download <id> -n snake-thai-ensaio` baixa APK, AAB e SHA256SUMS.txt. Na release, `gh release view vX.Y.Z --json assets --jq '.assets[].name'` lista os 3 arquivos.

### Passo 8

Validar a sintaxe antes do commit: `docker run --rm -v "${PWD}:/repo" --workdir /repo rhysd/actionlint:latest -color` (o Docker Desktop já roda na máquina) ou, alternativamente, conferir depois do push com `gh workflow view release.yml`.

_Arquivos:_ `.github/workflows/release.yml`

**Como verificar:** O actionlint termina com código 0, ou `gh workflow list` mostra "Release Android" como active depois do merge.

### Passo 9

Documentação, conforme o protocolo do README (mudança nos comandos de execução/publicação). (a) README.md: nova seção "Publicar uma versão" explicando que a tag vX.Y.Z publica pelo GitHub Actions, que o ensaio é o botão Run workflow na main, que a versão da tag precisa bater com app.json e como baixar o APK. Sem valores de segredo. (b) docs/RUNBOOK.md:94-110: trocar a frase da linha 108 sobre a chave de debug pelo novo fluxo, coordenando o texto com T2. (c) docs/RELEASE-SIGNING.md: nova seção "Assinatura no GitHub Actions" com a lista de NOMES dos secrets e da variável, o comando PowerShell do base64 e o environment 'release'. (d) Não editar o ci.yml, nem mesmo o comentário das linhas 3-5, que ficará desatualizado; registrar isso no README.

_Arquivos:_ `README.md`, `docs/RUNBOOK.md`, `docs/RELEASE-SIGNING.md`

**Como verificar:** `git diff --stat` mostra só release.yml e os 3 documentos; `grep -n "chave de debug" docs/RUNBOOK.md` não afirma mais que o release usa a chave de debug.

### Passo 10

Commit (Conventional Commits, o hook commit-msg valida): `ci(release): build e publicação do APK assinado por tag`. O pre-commit do Husky roda typecheck e jest localmente. Depois, com autorização explícita do usuário e junto com a tarefa de push/PR/merge: push da branch, `gh pr create` e merge na main, sem force push. O CI existente vai rodar no PR e deve falhar no job de banco, como já acontece. Isso não bloqueia porque não há ruleset exigindo checks.

**Como verificar:** `gh pr view <n> --json state` → MERGED; `git show origin/main --stat` inclui .github/workflows/release.yml.

### Passo 11

Depois que o usuário configurar o environment, os secrets e a variável: rodar o ensaio com `gh workflow run release.yml --ref main`, acompanhar com `gh run watch`, baixar o artefato, desinstalar o app com chave de debug e instalar no SM-S928B com `adb install snake-thai-ensaio-*.apk`, abrir e fazer login.

**Como verificar:** `gh secret list --env release` lista os 6 ou 7 NOMES e `gh variable list --env release` lista RELEASE_CERT_SHA256. O run termina em success. `apksigner verify --print-certs` local mostra o SHA-256 da keystore de produção, e o app abre e autentica contra a produção.

### Passo 12

Primeira release real, depois que a tarefa de versionamento definir o próximo número e o versionCode em app.json: na main, `git tag -a vX.Y.Z -m "Snake Thai X.Y.Z"` e `git push origin vX.Y.Z` (com autorização). Registrar o tempo de build frio e o do segundo run com cache, para calibrar o timeout.

**Como verificar:** `gh release view vX.Y.Z` mostra isLatest com os 3 assets; `gh release download vX.Y.Z -p '*.apk'` seguido de `sha256sum -c` contra SHA256SUMS.txt confere; o tempo dos runs aparece em `gh run list --workflow release.yml`.

## 6. Riscos

- Fallback silencioso para a chave de debug: o plugin (withReleaseSigning.js:33,47-48) usa a keystore de debug se RELEASE_STORE_FILE não chegar ao Gradle. Mitigação: validação `:?` de cada secret e checagem com apksigner, que falha em 'CN=Android Debug' ou num SHA-256 diferente de RELEASE_CERT_SHA256.
- APK compilado com banco errado: as EXPO_PUBLIC_* são validadas só na execução (src/config/env.ts:18-26). Um secret faltando gera um APK que compila e quebra ao abrir, e um valor de dev poria o banco local num APK público. Mitigação: `:?` no passo do .env, secrets só no environment 'release' preenchidos a partir do painel de produção e grep opcional do host no bundle.
- Primeiro build no Linux pode falhar, porque nunca rodou fora do Windows. Pontos prováveis: NDK 27.1 não instalado (mitigado com sdkmanager), disco de 14 GB (mitigado com a limpeza), memória do Gradle limitada a -Xmx2048m pelo template (mitigável com `-Dorg.gradle.jvmargs=-Xmx4g` na linha de comando) e CMake baixado sob demanda. SUPOSIÇÃO não medida: 25-40 min no build frio e 15-25 min com cache. Cada ajuste custa um ciclo inteiro.
- Não dá para gerar de novo a v1.6.0 com este workflow, porque a tag aponta para 6a99b40, que não tem o release.yml. A substituição do APK com chave de debug precisa de uma versão nova (coordenar com T2 e com a tarefa de versionamento).
- Troca de assinatura: quem instalou um APK assinado com a chave de debug precisa desinstalar antes, porque o Android recusa a atualização com INSTALL_FAILED_UPDATE_INCOMPATIBLE, e a sessão local se perde. Comunicação e decisão ficam no T2.
- Cadeia de suprimentos: toda action do job com a keystore consegue ler arquivos do runner. Mitigação: usar só actions oficiais (actions/*, gradle/actions), publicar pela gh CLI e não por action de terceiros, passar os secrets no env de cada passo, apagar a keystore com if: always() e usar environment restrito. Opcional: fixar as actions por SHA.
- Logs públicos: o repositório é público, então qualquer pessoa lê os logs. Nunca usar set -x, cat .env, --info ou --debug, nem echo de valores derivados de secrets.
- Versões das actions (checkout v7, setup-node v7, setup-java v6, gradle/actions v6, upload-artifact v7) foram verificadas em 2026-09-16. O ci.yml continua em v4 por decisão do usuário, o que gera assimetria sem impacto funcional.
- Se o repositório virar privado: 2.000 min/mês, runner com 2 vCPU e 8 GB (mais lento, com risco de OOM) e cache enhanced do setup-gradle em 'Free Preview'. Nesse caso, trocar para o cache basic (MIT) e reavaliar EAS ou build local.
- Com a tag exigindo igualdade com app.json, esquecer de subir a versão bloqueia a release. É proposital, mas precisa ser documentado. O versionCode continua 1 até a tarefa de versionamento: atualizar no aparelho funciona, mas a Play Store recusaria.
- SUPOSIÇÃO não verificada nesta sessão: limite de 48 KB por secret. Uma keystore RSA 2048 em base64 tem poucos KB e deve caber com folga.

## 7. Ajustes do revisor crítico

- **Conflito com T2:** Os dois planos definem a assinatura no GitHub Actions de formas incompatíveis. T2 renomeia as propriedades Gradle para SNAKETHAI_RELEASE_*, cria o Environment 'producao' só para tags v*, com secrets ANDROID_KEYSTORE_BASE64/ANDROID_KEYSTORE_PASSWORD/... e variável ANDROID_CERT_SHA256. T5 passa ORG_GRADLE_PROJECT_RELEASE_STORE_FILE e as demais com os nomes ANTIGOS, usa o Environment 'release' (main + v*), secrets RELEASE_KEYSTORE_BASE64/RELEASE_STORE_PASSWORD/... e variável RELEASE_CERT_SHA256. Com a trava da T2 (taskGraph.whenReady exige SNAKETHAI_RELEASE_STORE_FILE), o build da T5 falharia. O Environment da T2, restrito a tags, bloquearia o ensaio por workflow_dispatch na main previsto na T5.  
  **Resolução:** Um contrato só, definido na T2 antes de escrever o release.yml: propriedades SNAKETHAI_RELEASE_* (a T5 passa ORG_GRADLE_PROJECT_SNAKETHAI_RELEASE_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD). Um único Environment 'release' com regra main + tags v*, secrets RELEASE_KEYSTORE_BASE64, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD e variável RELEASE_CERT_SHA256. Arquivo .p12 (PKCS12, senha da chave igual à da keystore). Reescrever o passo 15 da T2 com esses nomes e revisar a T5 com o checklist de segurança da T2: actions fixadas por SHA, sem pull_request_target e sem set -x.
- **Conflito com T1, T3, T9, T10:** Cada plano usa um nome ou valor diferente para a variante. T1: APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production' (with-variant.js recebe dev|prod). T3 (passo 7): process.env.APP_VARIANT === 'dev', que nunca é verdadeiro com a T1, então o sufixo +dev nunca aparece. T10: lê um hipotético EXPO_PUBLIC_APP_ENV. T5: define APP_VARIANT: production, mas grava um .env sem EXPO_PUBLIC_APP_VARIANT e não passa pelo with-variant.js. T9: enum app_variant ('production', 'development').  
  **Resolução:** A T1 publica o contrato: APP_VARIANT ∈ {development, production} no processo de build e EXPO_PUBLIC_APP_VARIANT com o mesmo valor no JS. T3 compara com 'development'. T10 usa EXPO_PUBLIC_APP_VARIANT como environment do Sentry. T9 mantém o enum. No CI, a T5 grava .env.prod e roda os comandos via 'node scripts/with-variant.js prod -- ...', garantindo o mesmo caminho de carga de variáveis e as mesmas travas do build local.
- **Conflito com T3:** A T5 faz actions/checkout sem fetch-depth: 0. No workflow_dispatch da main o git describe não encontra tags, e o versionName da T3 cai no fallback. A T5 exige versionName igual à tag no aapt, o que quebra se o sufixo da T3 incluir '.dirty' ou '+N.sha'. A T5 publica com --generate-notes, enquanto a T3 gera as notas do CHANGELOG ('version.js notes'). A T3 (passo 14) prevê 'gh release create' manual, e a T5 cria o release automaticamente ao receber a tag: com os dois fluxos ativos, o release é duplicado ou um deles falha.  
  **Resolução:** Na T5: checkout com fetch-depth: 0; antes do build, rodar 'node scripts/version.js check --tag $GITHUB_REF_NAME'; notas via 'node scripts/version.js notes $GITHUB_REF_NAME > notas.md' e '--notes-file'. Na checagem do aapt, aceitar só a versão exata no build de tag. Depois que a T5 estiver na main, o passo manual 7 da T3 (gh release create) vira apenas plano de contingência, documentado em docs/VERSIONAMENTO.md.
- **Conflito com T2, T3:** O primeiro APK assinado (v1.6.1) tem três caminhos diferentes. T2 (passo 11) sobe app.json à mão e dá 10601 como versionCode de exemplo (fórmula MAJOR*10000...). T3 recomenda 1006001 (MAJOR*1.000.000...) e usa o script versao:patch, e o teste de consistência dela barra edição manual de app.json sem package.json. T2 (passo 13) cria a tag com 'git tag -a' e publica com 'gh release create'. Se a T5 já estiver na main, o push da tag dispara o workflow, que tenta publicar o mesmo release.  
  **Resolução:** A T2 usa 'npm run versao:patch' e 'npm run versao:tag', com a fórmula decidida na T3 (recomendada: 1006001). O usuário escolhe o caminho da 1.6.1: manual, se sair antes da T5, ou pelo Actions, se sair depois. Nunca os dois para a mesma tag. Se a T5 já estiver mergeada, a T2 não roda 'gh release create'.
- **Conflito com T1, T4:** A T1 renomeia o .env do app para .env.prod e passa a usar EXPO_NO_DOTENV=1. A T4 (passo 7) lê a URL da API de produção com '. snake-thai/.env', e o comando quebra se a T1 vier antes. A T5 grava '.env' no CI, arquivo que o fluxo da T1 deixa de ler.  
  **Resolução:** Na T4 fase 2, ler .env.prod se existir e .env caso contrário, ou rodar a fase 2 antes do rename da T1. Na T5, gravar .env.prod e usar with-variant.js (ver conflito de nomes da variante).
- **Conflito com T9, T10:** O release.yml da T5 não prevê os insumos que T9 e T10 tornam obrigatórios. Com a T9, o app.config lê googleServicesFile (GOOGLE_SERVICES_JSON ou ./google-services.json, fora do Git) e o prebuild falha no CI sem ele. Com a T10, o build de release precisa de SENTRY_AUTH_TOKEN, ou sai com stack ilegível. O projectId do EAS também precisa estar na configuração.  
  **Resolução:** Quando cada uma entrar, atualizar a T5: secret GOOGLE_SERVICES_JSON_BASE64, decodificado em $RUNNER_TEMP e apontado por GOOGLE_SERVICES_JSON; secret SENTRY_AUTH_TOKEN opcional, com SENTRY_DISABLE_AUTO_UPLOAD=true quando ausente. Registrar essas dependências no checklist da T5 e no RUNBOOK.
- **Decisão consolidada (T1 + T3 + T5 + T9 + T10):** Contrato da variante (nomes e valores).  
  **Recomendação:** APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production'; padrão production, com o .env antigo renomeado para .env.prod. O CI usa .env.prod e with-variant.js. Decisão técnica, só para o usuário ciente.
- **Decisão consolidada (T2 + T3 + T5):** Com que versão e por qual caminho sai o primeiro APK assinado com a chave de produção?  
  **Recomendação:** Retirar já o APK debug da v1.6.0 (apagar o asset e deixar aviso nas notas). Se as pessoas que têm o app aceitam desinstalar uma vez agora, publicar v1.6.1 (versionCode 1006001) pelos scripts da T3. Se preferirem uma reinstalação só, segurar a assinatura para sair junto com a 1.7.0 do bloco Produto. O caminho é o Actions, se a T5 já estiver na main, ou manual; nunca os dois para a mesma tag.
- **Decisão consolidada (T2 + T5):** Onde ficam a keystore e as senhas, e como chegam ao Actions?  
  **Recomendação:** Arquivo .p12 fora de android/ e do repositório, com duas cópias de segurança e restauração testada. Senhas em %USERPROFILE%\.gradle\gradle.properties (BitLocker ativo). No GitHub, um único Environment 'release' (main + v*), com secrets cadastrados pelo próprio usuário via 'gh secret set'.
- **Decisão consolidada (T5):** Plataforma e gatilhos do build automático.  
  **Recomendação:** GitHub Actions (grátis em repositório público): push de tag vX.Y.Z publica, disparo manual na main gera ensaio com artefato de 3 dias. Só ABIs arm64-v8a e armeabi-v7a. AAB anexado com sufixo -playstore.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T5.md` escrito
