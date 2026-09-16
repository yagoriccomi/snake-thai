# PLANO DE EXECUÇÃO — T2: Assinatura de produção e retirada do APK debug do release v1.6.0

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T2` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/assinatura-producao` |
| **Esforço** | M |
| **Depende de** | T3 |

## 1. Enunciado

O APK publicado na v1.6.0 foi assinado com a keystore de debug do template, que é pública, e o build de release hoje cai nessa chave sem avisar quando falta a keystore de produção. O plano: o usuário gera e guarda a keystore de produção fora de android/, onde o prebuild --clean não a apaga. O build passa a falhar quando falta a keystore, o APK debug sai da v1.6.0 e uma v1.6.1 assinada é publicada, com aviso para desinstalar a versão antiga. A chave também fica pronta para o AAB da Play Store e para entrar no GitHub Actions (T5) como secret de Environment.

### Resposta às perguntas do usuário

"Tirar a chave de debug do release": o APK da v1.6.0 foi assinado com a chave de debug do template (certificado 'CN=Android Debug', SHA-256 fac61745...3b9c), que é pública, e teve 0 downloads pelo GitHub. A recomendação é apagar só o APK da v1.6.0, deixar um aviso nas notas e publicar a v1.6.1 com a chave de produção. Quem instalou a 1.6.0 por outro meio (adb, WhatsApp) vai precisar desinstalar uma única vez; depois disso as atualizações voltam a instalar por cima. A variante DEV pode continuar com a chave de debug, desde que nunca seja publicada. Sobre "GitHub Actions é gratuito?" (o plano completo é da T5): o repositório é público, e para repositórios públicos os runners padrão do GitHub não cobram minutos (confirmar a política vigente na T5). A keystore chega ao Actions com segurança como secret de um Environment protegido, cadastrada por você pelo gh secret set, sem passar por mim.

## 2. Terreno (situação verificada)

- O release v1.6.0 está publicado como Latest, não imutável, com um único asset, snake-thai-v1.6.0.apk (84.770.599 bytes). O asset tem 0 downloads pelo GitHub.  
  _Evidência:_ gh release view v1.6.0 --json assets,isImmutable: downloadCount 0, digest sha256:b46e780b...97ee, isImmutable false; gh release list mostra só 'Snake Thai 1.6.0 Latest'
- O APK publicado está assinado com o certificado 'Android Debug', o mesmo de android/app/debug.keystore. Essa keystore vem do template do Expo/React Native com senha 'android' escrita no build.gradle, então é pública: qualquer pessoa consegue assinar um APK com.snakethai.app que se instala por cima do app.  
  _Evidência:_ apksigner verify --print-certs release/snake-thai-v1.6.0.apk: 'CN=Android Debug', SHA-256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. keytool -list em android/app/debug.keystore dá a mesma impressão digital. android/app/build.gradle:100-106 tem storePassword 'android'
- Existe cópia local idêntica do APK publicado, então apagar o asset no GitHub não perde o binário.  
  _Evidência:_ sha256sum release/snake-thai-v1.6.0.apk = b46e780bd9d825ac21f68ded7b7ab04b81b25c4d762815710884227ebdfb97ee, igual ao digest do asset
- As notas da v1.6.0 já avisam que o APK usa chave de desenvolvimento, mas prometem que 'Quem já tem o app instalado recebe a atualização por cima'. Isso deixa de valer quando a assinatura mudar.  
  _Evidência:_ Corpo do release (seções 'Instalação' item 3 e 'Observações')
- O Config Plugin de assinatura existe, está registrado e já foi aplicado no build.gradle atual. Quando falta RELEASE_STORE_FILE, ele usa a chave de debug sem avisar, e foi assim que a 1.6.0 saiu.  
  _Evidência:_ app.json:34 registra ./plugins/withReleaseSigning.js; plugins/withReleaseSigning.js:14-18 e :46-48 (fallback signingConfigs.debug); android/app/build.gradle:107-125 com o bloco injetado
- Não existe keystore de produção nem propriedades de assinatura configuradas nesta máquina.  
  _Evidência:_ find (sem node_modules) acha só ./android/app/debug.keystore. Nomes de chaves em android/gradle.properties: nenhum RELEASE_*. %USERPROFILE%/.gradle/gradle.properties não existe
- O docs/RELEASE-SIGNING.md manda gerar a keystore em android/app e pôr as senhas em android/gradle.properties. Só que android/ é pasta gerada e não versionada: um 'expo prebuild --clean' apaga a keystore e as senhas junto com ela.  
  _Evidência:_ docs/RELEASE-SIGNING.md:16 e :53-62; .gitignore:37 (/android); plugins/withReleaseSigning.js:6-8; menu.bat:231 ('O prebuild regenera android/ do zero e apaga a porta customizada')
- O doc diz que a senha da chave pode ser diferente da senha da keystore. O keytool disponível é do OpenJDK 21 e gera PKCS12 por padrão; o PKCS12 ignora uma -keypass diferente, então na prática as duas senhas precisam ser iguais.  
  _Evidência:_ docs/RELEASE-SIGNING.md:28; 'Program Files/Android/Android Studio/jbr/bin/java.exe -version' = openjdk 21.0.10. O comportamento do PKCS12 é conhecido do JDK, não foi reproduzido aqui
- A versão nativa está com versionCode 1 e versionName 1.6.0, e o app.json não declara versionCode.  
  _Evidência:_ android/app/build.gradle:95-96; app.json:5
- O .gitignore já bloqueia arquivos de chave e binários.  
  _Evidência:_ .gitignore:40 *.jks, :41 *.keystore, :43 *.p12, :57 *.aab, :58 *.apk
- A tag v1.6.0 aponta para 6a99b40, que só existe em feat/papel-professor (não está na main). Essa branch está 10 commits à frente e 3 atrás de origin/main.  
  _Evidência:_ git branch -a --contains 6a99b40 (só feat/papel-professor local e remota); git rev-list --count origin/main..feat/papel-professor = 10 e o inverso = 3
- O repositório é público e ainda não tem Environments nem secrets de Actions. O CI atual não gera APK.  
  _Evidência:_ gh api repos/yagoriccomi/snake-thai: visibility public; gh api .../environments e gh secret list sem saída; .github/workflows/ci.yml:3-5
- O RUNBOOK ainda diz que o release usa a chave de debug. O README ensina assembleRelease e 'adb install -r' sem falar de assinatura.  
  _Evidência:_ docs/RUNBOOK.md:108-110; README.md:94-100
- O app tem allowBackup desligado. Desinstalar apaga a sessão local (SecureStore) e nada é restaurado: o usuário precisa entrar de novo. Os dados de servidor ficam no Supabase.  
  _Evidência:_ app.json:25 allowBackup false
- Não deu para confirmar qual assinatura está instalada no celular do usuário, porque nenhum aparelho respondia no adb na hora da checagem. Supor que ele tem a 1.6.0 debug é suposição.  
  _Evidência:_ adb devices: 'List of devices attached' vazio
- As ferramentas necessárias estão instaladas: keytool (JBR e JDK 21) e apksigner (build-tools 37.0.0).  
  _Evidência:_ ls '/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe'; which keytool -> /c/Program Files/Java/jdk-21/bin/keytool; $LOCALAPPDATA/Android/Sdk/build-tools/37.0.0/apksigner.bat

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Como tirar do ar o APK assinado com a chave de debug da v1.6.0?**

- (a) Apagar só o asset da v1.6.0, pôr um aviso no topo das notas e publicar uma versão nova com assinatura de produção. Tag e changelog continuam.
- (b) Trocar o asset da própria v1.6.0 por um APK assinado com a chave de produção, mantendo o número de versão.
- (c) Apagar o release inteiro e a tag v1.6.0.
- (d) Manter o APK e só reforçar o aviso nas notas.

➡️ _Adotado:_ (a). Com 0 downloads pelo GitHub, apagar o asset tem impacto praticamente nulo, e a cópia local tem o mesmo SHA-256. Descartei as outras: em (b), dois binários diferentes com o mesmo 1.6.0 e a mesma versionCode ficam indistinguíveis, e quem tem o debug receberia um erro de instalação sem entender o motivo. Em (c) some o histórico do changelog. Em (d) a porta de sequestro por atualização continua aberta.

**P2. Qual número de versão recebe o primeiro APK assinado com a chave de produção?**

- v1.6.1 agora: mesmo código da 1.6.0, muda só a assinatura e a documentação
- Esperar a próxima versão com funcionalidades (ex.: 1.7.0) e deixar o release sem APK até lá

➡️ _Adotado:_ v1.6.1 agora. É a menor mudança possível (patch), está alinhada com a meta de não inflar a versão (T3) e não deixa o release sem instalador. A versionCode segue a regra que T3 definir.

**P3. Há plano de publicar na Play Store? Isso define o papel da chave que vai ser gerada.**

- (a) Por enquanto só GitHub. A chave gerada agora serve para uma eventual Play Store.
- (b) Play Store com chave de assinatura própria, enviada ao Google pelo PEPK, mais uma upload key separada. APK do GitHub e app da Play ficam com a mesma assinatura.
- (c) Play Store com chave de assinatura gerada pelo Google. APK do GitHub e app da Play ficam incompatíveis e trocar de um para o outro exige desinstalar.

➡️ _Adotado:_ Gerar a chave agora já pensando em (b) e decidir sobre a Play depois. Se publicar, escolher 'usar minha própria chave de assinatura' no Play Console, para que quem instalou pelo GitHub possa migrar sem desinstalar de novo.

**P4. A variante DEV ('DEV Snake Thai', em T1) pode continuar assinada com a chave de debug?**

- Sim: DEV assinada com debug e nunca publicada em Releases
- Não: DEV assinada com a chave de produção também

➡️ _Adotado:_ Sim, debug. Com applicationId diferente, a DEV convive com o app de produção no mesmo aparelho e a assinatura de um não interfere no outro. Assim o build DEV (local ou no Actions) não precisa de segredo nenhum. Condição: o APK DEV só vai para aparelhos de quem desenvolve, por adb, e nunca para o GitHub Releases.

**P5. Onde ficam as cópias de segurança da keystore e da senha?**

- Gerenciador de senhas com o arquivo anexado e a senha (ex.: Bitwarden ou 1Password) mais um pendrive ou HD externo offline só com o arquivo
- Só no computador
- Nuvem pessoal com arquivo e senha na mesma pasta

➡️ _Adotado:_ A primeira opção. São duas cópias em lugares diferentes e a senha nunca fica junto do arquivo no pendrive. O .p12 já é cifrado pela senha, então a segunda cópia sem a senha é aceitável. Perder a chave impede para sempre atualizar o app por cima.

**P6. Como a senha da keystore chega ao build local?**

- Em texto claro em %USERPROFILE%\.gradle\gradle.properties, protegido pela conta do Windows e pelo BitLocker
- Por variáveis de ambiente ORG_GRADLE_PROJECT_* definidas só na sessão do PowerShell antes de cada build

➡️ _Adotado:_ O arquivo do usuário no .gradle, com BitLocker ativo. É simples, o prebuild --clean não o apaga e ele fica fora do repositório. A segunda opção é mais segura, mas exige digitar a senha a cada build de cerca de 17 minutos.

## 4. Ações que só o usuário pode fazer

- [ ] Autorizar explicitamente as ações com efeito externo: apagar o asset e editar as notas da v1.6.0, criar e enviar a tag v1.6.1 e publicar o release v1.6.1.
- [ ] Gerar a keystore de produção digitando a senha no keytool (passo 6). Ninguém mais pode fazer isso, senão a chave nasce conhecida por outra pessoa.
- [ ] Criar uma senha forte e guardar no gerenciador de senhas junto com o alias (snake-thai), a data de criação e a impressão digital SHA-256 do certificado.
- [ ] Fazer as duas cópias de segurança e testar a restauração a partir de uma delas (passo 7).
- [ ] Criar o arquivo %USERPROFILE%\.gradle\gradle.properties com as 4 propriedades SNAKETHAI_RELEASE_* (passo 8). A senha é digitada por você e nunca colada no chat.
- [ ] Passar ao agente só a impressão digital SHA-256 do certificado, que é pública. Nunca passar o arquivo nem a senha.
- [ ] Informar em quais aparelhos o Snake Thai está instalado hoje (seu Samsung e talvez professores ou alunos que receberam o APK por outro meio). Pedir para concluírem chamadas em andamento, desinstalarem e instalarem a 1.6.1, e avisar que vão precisar entrar de novo.
- [ ] Autorizar a desinstalação do app no seu celular via adb, que apaga a sessão local.
- [ ] Para T5: criar o Environment 'producao' no GitHub (com revisor obrigatório, se quiser) e cadastrar os 4 secrets pelo gh secret set (passo 15). Os valores saem da sua máquina e não passam por mim.
- [ ] Se decidir publicar na Play Store: criar a conta de desenvolvedor no Google Play Console, que é paga e está em seu nome, e fazer o envio da chave pelo PEPK.

## 5. Passos atômicos

### Passo 1

Agente, só leitura: confirmar as pré-condições antes de mexer em qualquer coisa. (a) O asset da v1.6.0 continua lá. (b) A cópia local continua íntegra. (c) Não existe keystore nem propriedades de assinatura configuradas. (d) Se o celular estiver conectado, registrar a versão instalada com 'adb shell dumpsys package com.snakethai.app | findstr versionName'.

_Arquivos:_ `release/snake-thai-v1.6.0.apk`, `android/gradle.properties`

**Como verificar:** 'gh release view v1.6.0 --repo yagoriccomi/snake-thai --json assets' lista snake-thai-v1.6.0.apk. 'sha256sum release/snake-thai-v1.6.0.apk' dá b46e780b...97ee. Nenhum SNAKETHAI_/RELEASE_ aparece em 'grep -oE ^[A-Za-z_.]+' dos dois gradle.properties.

### Passo 2

Agente, só com OK explícito do usuário: retirar o APK debug da v1.6.0. (1) Escrever as notas novas em <scratchpad>/notas-v1.6.0.md: copiar o texto atual e acrescentar no topo o aviso '> **APK retirado em 2026-09-XX.** Este pacote foi assinado com uma chave de desenvolvimento pública. Instale a versão 1.6.1 ou mais nova (é preciso desinstalar a 1.6.0 antes).'. Remover o item 3 da seção Instalação. Manter o SHA-256 antigo como registro. (2) gh release delete-asset v1.6.0 snake-thai-v1.6.0.apk --repo yagoriccomi/snake-thai --yes. (3) gh release edit v1.6.0 --repo yagoriccomi/snake-thai --notes-file <scratchpad>/notas-v1.6.0.md. Não apagar a tag. O arquivo local release/snake-thai-v1.6.0.apk fica como arquivo morto.

_Arquivos:_ `<scratchpad>/notas-v1.6.0.md`

**Como verificar:** 'gh release view v1.6.0 --repo yagoriccomi/snake-thai --json assets,body' devolve assets [] e o corpo começa com 'APK retirado'. 'git ls-remote --tags origin' ainda lista v1.6.0.

### Passo 3

Agente: refatorar plugins/withReleaseSigning.js. (a) Extrair a transformação de texto para uma função pura exportada, injetarAssinatura(conteudo, { exigirChaveDeProducao }), e deixar o plugin só chamando essa função. (b) Renomear as propriedades para SNAKETHAI_RELEASE_STORE_FILE, SNAKETHAI_RELEASE_STORE_PASSWORD, SNAKETHAI_RELEASE_KEY_ALIAS e SNAKETHAI_RELEASE_KEY_PASSWORD. O prefixo evita que outro projeto Gradle da máquina pegue essas propriedades do gradle.properties do usuário. Hoje ninguém usa os nomes antigos (ver situação atual). (c) Com exigirChaveDeProducao=true (padrão), acrescentar ao fim do build.gradle uma trava que derruba o build: gradle.taskGraph.whenReady { grafo -> se alguma tarefa do projeto se chamar 'packageRelease' ou 'signReleaseBundle', lançar GradleException('Release sem keystore de producao: configure SNAKETHAI_RELEASE_* (docs/RELEASE-SIGNING.md)') quando faltar a propriedade SNAKETHAI_RELEASE_STORE_FILE, ou quando file(SNAKETHAI_RELEASE_STORE_FILE).exists() for falso }. A mensagem não imprime caminho nem senha. O comentário explica o porquê: foi o fallback sem aviso que publicou a 1.6.0 com debug. (d) Com exigirChaveDeProducao=false (variante DEV de T1), o plugin não altera nada e o release continua em signingConfigs.debug. (e) Em app.json, trocar a entrada do plugin por ["./plugins/withReleaseSigning.js", { "exigirChaveDeProducao": true }]. T1 passa false na variante DEV pelo app.config. Antes, confirmar os nomes das tarefas com 'android\gradlew :app:tasks --all | findstr /i "packageRelease signReleaseBundle"'.

_Arquivos:_ `plugins/withReleaseSigning.js`, `app.json`

**Como verificar:** 'npx expo prebuild --platform android --clean' termina sem erro. android/app/build.gradle contém SNAKETHAI_RELEASE_STORE_FILE uma única vez no signingConfigs e a trava taskGraph.whenReady no fim. 'npx tsc --noEmit' e 'npm test' continuam verdes.

### Passo 4

Agente: criar testes Jest para a função pura, usando como fixture sintética um trecho do build.gradle do template com o bloco debug e o buildTypes.release. Nomes dos testes: 'injeta o signingConfig release uma única vez quando chamado duas vezes'; 'lança erro quando a âncora do signingConfigs não existe'; 'troca só a linha signingConfig do buildType release e preserva a do debug'; 'acrescenta a trava de release sem keystore quando exigirChaveDeProducao é true'; 'não altera o build.gradle quando exigirChaveDeProducao é false'.

_Arquivos:_ `plugins/__tests__/withReleaseSigning.test.js`, `test fixture sintética em plugins/__tests__/fixtures/build.gradle.template.txt`

**Como verificar:** 'npx jest plugins' passa os 5 testes e 'npm test' soma 329 testes verdes. O pre-commit do Husky passa sem --no-verify.

### Passo 5

Agente: reescrever a documentação. (a) docs/RELEASE-SIGNING.md: keystore FORA de android/ e do repositório (%USERPROFILE%\.chaves\snake-thai\snake-thai-release.p12); comando keytool com PKCS12, RSA 4096 e -dname neutro, sem nome pessoal, porque o certificado vai dentro de todo APK público; senha da chave igual à da keystore (limitação do PKCS12); propriedades em %USERPROFILE%\.gradle\gradle.properties com barras '/' (a contrabarra é escape em .properties); o que a trava faz; conferência com apksigner; campo 'Impressão digital SHA-256 do certificado de produção: <preencher no passo 9>'; seção de AAB e Play App Signing (própria chave via PEPK, upload key separada); seção 'Trocar a assinatura obriga desinstalar'; seção de CI apontando para T5. Remover a frase 'Testado de verdade...' ou reescrevê-la com o que for testado no passo 10. (b) docs/RUNBOOK.md:108-110: trocar 'o release atual usa a chave de debug' pela regra nova. (c) README.md, seção Debug x Release (linhas 87-106): avisar que o release exige a keystore configurada (senão o build falha) e apontar para docs/RELEASE-SIGNING.md, cumprindo o item 2 do protocolo do README no CLAUDE.md:90-94. (d) menu.bat: depois de [5] Gerar APK Release, rodar uma sub-rotina :VERIFY_SIGNATURE com o apksigner da build-tools mais recente ('apksigner verify --print-certs'). Ela imprime o DN e o SHA-256 e mostra '[!] ASSINADO COM CHAVE DE DEBUG' em destaque se aparecer 'CN=Android Debug'.

_Arquivos:_ `docs/RELEASE-SIGNING.md`, `docs/RUNBOOK.md`, `README.md`, `menu.bat`

**Como verificar:** 'grep -n "android/app\|RELEASE_STORE_FILE=" docs/RELEASE-SIGNING.md' não sugere mais guardar a keystore em android/. 'grep -rn "usa a chave de debug" docs README.md' fica vazio. 'menu.bat --build' continua funcionando (caminho do debug intacto).

### Passo 6

Usuário: gerar a keystore uma única vez, no PowerShell, digitando a senha quando o keytool pedir: New-Item -ItemType Directory -Force "$env:USERPROFILE\.chaves\snake-thai" ; & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -keystore "$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12" -alias snake-thai -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Snake Thai, O=Snake Thai, C=BR". A validade de 10000 dias vai até cerca de 2054, dentro da exigência da Play de valer além de 2033. Não passar -storepass na linha de comando, para a senha não ir ao histórico do shell.

_Arquivos:_ `%USERPROFILE%\.chaves\snake-thai\snake-thai-release.p12 (fora do repositório)`

**Como verificar:** O usuário roda '& keytool.exe -list -v -keystore "$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12"', digita a senha e vê 'Tipo de área de armazenamento de chaves: PKCS12', 'Alias: snake-thai' e o SHA256 do certificado, que anota no gerenciador. O agente pode conferir sem senha que 'git -C <repo> status --ignored' não mostra o arquivo, já que ele está fora do repositório.

### Passo 7

Usuário: backup e teste de restauração. Cópia 1: entrada no gerenciador de senhas com o .p12 anexado, a senha, o alias, a data e o SHA-256. Cópia 2: o .p12 num pendrive ou HD externo guardado offline, SEM a senha junto. Nunca mandar por e-mail, WhatsApp ou chat, nem pôr em pasta de projeto. Teste: baixar o anexo do gerenciador numa pasta temporária, rodar keytool -list -v com a senha guardada, conferir o SHA-256 e apagar a cópia temporária.

**Como verificar:** O SHA-256 obtido a partir da cópia restaurada é igual ao anotado no passo 6.

### Passo 8

Usuário: criar %USERPROFILE%\.gradle\gradle.properties (o Gradle lê esse arquivo em todo build, ele sobrevive ao prebuild --clean e fica fora do Git) com: SNAKETHAI_RELEASE_STORE_FILE=C:/Users/USER/.chaves/snake-thai/snake-thai-release.p12 | SNAKETHAI_RELEASE_STORE_PASSWORD=<senha> | SNAKETHAI_RELEASE_KEY_ALIAS=snake-thai | SNAKETHAI_RELEASE_KEY_PASSWORD=<mesma senha>. Uma propriedade por linha, caminho com '/'. Confirmar que o BitLocker está ativo ('manage-bde -status C:'). Remover qualquer RELEASE_* que tenha ido parar em android/gradle.properties.

_Arquivos:_ `%USERPROFILE%\.gradle\gradle.properties (fora do repositório)`

**Como verificar:** O agente confere só os NOMES com 'grep -oE "^[A-Za-z_]+" ~/.gradle/gradle.properties': aparecem as 4 SNAKETHAI_RELEASE_*, sem imprimir valores.

### Passo 9

Agente: registrar a impressão digital pública. Rodar 'cd android; .\gradlew :app:signingReport' e, no bloco 'Variant: release', conferir que Store aponta para o .p12 e que o SHA-256 é igual ao que o usuário informou. Gravar esse SHA-256 em docs/RELEASE-SIGNING.md, no campo criado no passo 5, e numa variável pública do repositório para T5 ('gh variable set ANDROID_CERT_SHA256' só com OK do usuário). O signingReport não mostra senhas.

_Arquivos:_ `docs/RELEASE-SIGNING.md`

**Como verificar:** No signingReport, 'Variant: release' mostra Store = C:\Users\USER\.chaves\snake-thai\snake-thai-release.p12 e SHA-256 diferente de FA:C6:17:45:...:3B:9C. 'Variant: debug' continua com debug.keystore.

### Passo 10

Agente: provar que a configuração aguenta o fluxo real. (a) 'npx expo prebuild --platform android --clean', depois 'menu.bat' [P] para reaplicar a porta 6969, e signingReport de novo. O release deve continuar na chave de produção. (b) Teste negativo da trava: renomear temporariamente %USERPROFILE%\.gradle\gradle.properties para gradle.properties.bak, rodar 'cd android; .\gradlew assembleRelease --dry-run' e esperar falha com 'Release sem keystore de producao', depois voltar o nome. Se o --dry-run não disparar o whenReady, repetir sem --dry-run e cancelar assim que aparecer o erro. (c) Conferir que 'assembleDebug' continua funcionando sem as propriedades.

_Arquivos:_ `android/ (gerado, não versionado)`

**Como verificar:** (a) signingReport pós --clean aponta para o .p12. (b) O build falha com a mensagem da trava e sai com código diferente de 0. (c) assembleDebug sai com código 0. O arquivo gradle.properties do usuário está restaurado (conferir só os nomes).

### Passo 11

Agente, depois de T3 definir a regra de versionCode: gerar a v1.6.1 assinada. Subir app.json expo.version para 1.6.1 e expo.android.versionCode para o valor da regra de T3 (ex.: 10601 se T3 adotar MAJOR*10000+MINOR*100+PATCH). O valor precisa ser maior que 1, a versionCode embutida hoje. Rodar prebuild (--clean), depois 'menu.bat' [5], ou 'cd android; .\gradlew assembleRelease -PreactNativeDevServerPort=6969', e em seguida '.\gradlew bundleRelease' para ter o AAB guardado localmente (não vai para o GitHub). Copiar para release/snake-thai-v1.6.1.apk e calcular o sha256.

_Arquivos:_ `app.json`, `release/snake-thai-v1.6.1.apk (ignorado pelo Git)`, `android/app/build/outputs/bundle/release/app-release.aab (ignorado)`

**Como verificar:** 'apksigner verify --verbose --print-certs release/snake-thai-v1.6.1.apk' mostra 'Verified using v2 scheme (APK Signature Scheme v2): true', DN 'CN=Snake Thai, O=Snake Thai, C=BR' e SHA-256 igual ao do passo 9. 'aapt2 dump badging' (build-tools 37.0.0) mostra package name com.snakethai.app, versionCode da regra de T3 e versionName 1.6.1. 'jarsigner -verify -verbose -certs app-release.aab' mostra o mesmo certificado.

### Passo 12

Usuário e agente: teste real no Samsung. Com autorização, conectar pelo menu [2] e rodar 'adb install -r release\snake-thai-v1.6.1.apk'. O esperado é falhar com INSTALL_FAILED_UPDATE_INCOMPATIBLE, o que prova que a troca de assinatura exige desinstalar. Depois 'adb uninstall com.snakethai.app', 'adb install release\snake-thai-v1.6.1.apk' e teste de fumaça: login, digital, lista de aulas, abrir um comprovante.

**Como verificar:** A primeira instalação falha com INSTALL_FAILED_UPDATE_INCOMPATIBLE. Depois de desinstalar, a instalação dá 'Success'. 'adb shell dumpsys package com.snakethai.app | findstr versionName' mostra 1.6.1 e o app abre sem Metro.

### Passo 13

Agente, com decisão explícita de push: commits em Conventional Commits na branch de trabalho, ou na branch definida por T4: 'feat(build): trava release sem keystore de producao', 'test(build): cobre o plugin de assinatura' e 'docs(release): keystore fora de android/ e publicacao 1.6.1'. Recomenda-se que T4 faça o merge na main antes, para a tag nascer na main e não repetir a situação da v1.6.0. Depois: 'git tag -a v1.6.1 -m "Snake Thai 1.6.1"', 'git push origin v1.6.1' e 'gh release create v1.6.1 release/snake-thai-v1.6.1.apk --repo yagoriccomi/snake-thai --title "Snake Thai 1.6.1" --notes-file <scratchpad>/notas-v1.6.1.md --latest'. As notas dizem: primeira versão assinada com a chave de produção; quem tem a 1.6.0 ou anterior conclui as chamadas em andamento, desinstala, instala esta e entra de novo; as próximas atualizações instalam por cima. Incluem o SHA-256 do APK e o SHA-256 do certificado.

_Arquivos:_ `plugins/withReleaseSigning.js`, `plugins/__tests__/withReleaseSigning.test.js`, `app.json`, `docs/RELEASE-SIGNING.md`, `docs/RUNBOOK.md`, `README.md`, `menu.bat`, `<scratchpad>/notas-v1.6.1.md`

**Como verificar:** 'gh release view v1.6.1 --repo yagoriccomi/snake-thai --json assets,isLatest' mostra o digest igual ao sha256 local e isLatest true. 'gh release list' mostra a v1.6.1 como Latest. 'git ls-remote --tags origin' lista v1.6.1 apontando para o commit do build. Baixar o asset e rodar apksigner mostra o certificado de produção.

### Passo 14

Usuário: avisar as pessoas que têm o app instalado. Texto sugerido: 'Saiu a 1.6.1 com assinatura definitiva. Conclua qualquer chamada em andamento, desinstale o Snake Thai, instale pelo link <url do release v1.6.1> e entre de novo. Isso só é necessário desta vez.'

**Como verificar:** O usuário confirma que cada aparelho da lista está na 1.6.1 (Configurações > Apps > Snake Thai > versão 1.6.1).

### Passo 15

Preparação para T5, feita pelo usuário com o agente orientando: criar o Environment 'producao' (Settings > Environments). Em repositório público dá para exigir revisor e limitar a tags 'v*'. Cadastrar os secrets pelo PowerShell do usuário, sem o agente ver os valores: [Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.chaves\snake-thai\snake-thai-release.p12")) | gh secret set ANDROID_KEYSTORE_BASE64 --env producao --repo yagoriccomi/snake-thai ; gh secret set ANDROID_KEYSTORE_PASSWORD --env producao --repo yagoriccomi/snake-thai (o comando pede o valor sem ecoar) ; o mesmo para ANDROID_KEY_ALIAS e ANDROID_KEY_PASSWORD. Regras que o workflow de T5 deve seguir: gatilho só em push de tag 'v*' ou workflow_dispatch; job com 'environment: producao' e permissions mínimas (contents: write só no job de release); nunca pull_request_target nem checkout de código de PR com secrets (PRs de fork e do Dependabot não recebem secrets); decodificar para "$RUNNER_TEMP/release.p12" com 'base64 -d'; passar as senhas por env ORG_GRADLE_PROJECT_SNAKETHAI_RELEASE_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD (o plugin funciona sem alteração); apagar o .p12 num passo 'if: always()'; nunca publicar android/ como artifact nem usar 'set -x'; conferir no fim com apksigner que o SHA-256 do certificado é igual a vars.ANDROID_CERT_SHA256 e falhar se não for; actions fixadas por SHA. A variante DEV (T1) no Actions compila com exigirChaveDeProducao=false e não usa o Environment.

_Arquivos:_ `.github/workflows/release.yml (criado em T5, não em T2)`

**Como verificar:** 'gh secret list --env producao --repo yagoriccomi/snake-thai' lista os 4 nomes. 'gh api repos/yagoriccomi/snake-thai/environments --jq .environments[].name' mostra producao. 'gh secret list --repo yagoriccomi/snake-thai' (nível do repositório) continua sem esses secrets.

### Passo 16

Opcional e futuro, só se o usuário decidir pela Play Store: no Play Console, criar o app com.snakethai.app, escolher 'Usar uma chave de assinatura diferente / exportar e enviar de um keystore Java' e rodar o PEPK que o próprio Console fornece, com --keystore apontando para o .p12, --alias=snake-thai e a chave pública de criptografia do Google. Gerar uma upload key separada (snake-thai-upload.p12, com o mesmo cuidado de backup) e registrar o certificado dela. A partir daí o AAB enviado é assinado com a upload key e o Google reassina com a chave de produção, então o APK do GitHub e o da Play ficam compatíveis. Documentar em docs/RELEASE-SIGNING.md.

_Arquivos:_ `docs/RELEASE-SIGNING.md`

**Como verificar:** Em Play Console > Integridade do app > Assinatura do app, o SHA-256 do 'Certificado da chave de assinatura do app' é igual ao do passo 9.

## 6. Riscos

- Se a keystore ou a senha se perderem, ninguém consegue mais atualizar o app por cima: todos teriam que desinstalar de novo, e na Play Store (com chave própria) o app não recebe mais atualizações. Mitigação: passo 7, com duas cópias e restauração testada.
- Seguir o doc atual (keystore em android/app, senhas em android/gradle.properties) faz a chave desaparecer no próximo 'expo prebuild --clean'. Por isso o passo 5 corrige o doc antes do passo 6.
- A troca de assinatura obriga desinstalar a 1.6.0 em todo aparelho. Isso apaga a sessão local (allowBackup false) e, na 1.6.0, as marcações de chamada ainda não concluídas, que só existem no aparelho. Sem aviso claro, a pessoa só vê 'App não instalado'.
- Enquanto houver aparelhos com a 1.6.0 assinada com a chave pública de debug, qualquer APK com.snakethai.app assinado com essa chave instala por cima e pode roubar a sessão. É o motivo para retirar o asset logo (passo 2), mesmo antes da 1.6.1.
- Apagar o asset no GitHub não tem volta. Mitigação: a cópia local tem o SHA-256 conferido (passo 1).
- A trava do passo 3 depende dos nomes 'packageRelease' e 'signReleaseBundle' da versão do Android Gradle Plugin usada pelo RN 0.86, que não foi verificada: conferir com ':app:tasks --all'. Se o nome estiver errado, a trava não dispara e o fallback silencioso para debug volta.
- Para a trava de T1: se a variante DEV não passar exigirChaveDeProducao=false, o build release da DEV passa a exigir a chave. Se a produção passar false por engano, a trava some. O teste do passo 4 e o teste negativo do passo 10 cobrem esse caso.
- A senha fica em texto claro em %USERPROFILE%\.gradle\gradle.properties. Isso é aceitável com BitLocker e conta do Windows protegida, mas qualquer processo do usuário consegue ler o arquivo.
- Renomear as propriedades para SNAKETHAI_* quebra quem seguiu o doc antigo. Hoje não há ninguém (verificado): o doc e o plugin precisam mudar no mesmo commit.
- O DN do certificado vai dentro de todo APK público e não dá para trocar depois. Não pôr nome pessoal nem e-mail (LGPD).
- No CI (T5), um workflow com pull_request_target, 'set -x' ou upload da pasta android/ pode vazar a chave num repositório público. As regras do passo 15 precisam virar checklist na revisão de T5.
- Tags fora da main: a v1.6.0 existe só em feat/papel-professor. Publicar a v1.6.1 antes do merge de T4 repete a inconsistência.
- O build release leva cerca de 17 minutos e o prebuild --clean refaz o android/ inteiro. Os passos 10 e 11 juntos podem passar de 40 minutos.

## 7. Ajustes do revisor crítico

- **Conflito com T5:** Os dois planos definem a assinatura no GitHub Actions de formas incompatíveis. T2 renomeia as propriedades Gradle para SNAKETHAI_RELEASE_*, cria o Environment 'producao' só para tags v*, com secrets ANDROID_KEYSTORE_BASE64/ANDROID_KEYSTORE_PASSWORD/... e variável ANDROID_CERT_SHA256. T5 passa ORG_GRADLE_PROJECT_RELEASE_STORE_FILE e as demais com os nomes ANTIGOS, usa o Environment 'release' (main + v*), secrets RELEASE_KEYSTORE_BASE64/RELEASE_STORE_PASSWORD/... e variável RELEASE_CERT_SHA256. Com a trava da T2 (taskGraph.whenReady exige SNAKETHAI_RELEASE_STORE_FILE), o build da T5 falharia. O Environment da T2, restrito a tags, bloquearia o ensaio por workflow_dispatch na main previsto na T5.  
  **Resolução:** Um contrato só, definido na T2 antes de escrever o release.yml: propriedades SNAKETHAI_RELEASE_* (a T5 passa ORG_GRADLE_PROJECT_SNAKETHAI_RELEASE_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD). Um único Environment 'release' com regra main + tags v*, secrets RELEASE_KEYSTORE_BASE64, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD e variável RELEASE_CERT_SHA256. Arquivo .p12 (PKCS12, senha da chave igual à da keystore). Reescrever o passo 15 da T2 com esses nomes e revisar a T5 com o checklist de segurança da T2: actions fixadas por SHA, sem pull_request_target e sem set -x.
- **Conflito com T1:** A assinatura da variante DEV aparece de dois jeitos. T1 (passo 6) tira './plugins/withReleaseSigning.js' da lista de plugins em development. T2 (passo 3) mantém o plugin nas duas variantes e passa { exigirChaveDeProducao: false } na DEV, com testes Jest para esse caso. As duas implementações seriam feitas em app.config.js e app.json ao mesmo tempo.  
  **Resolução:** Escolher a abordagem da T2: o app.config.js da T1 injeta ['./plugins/withReleaseSigning.js', { exigirChaveDeProducao: variant === 'production' }] em vez de remover o plugin. Ajustar a verificação da T1 (passo 6) para conferir a opção, e não a ausência do plugin. A T2 continua sendo dona do plugin e dos testes.
- **Conflito com T1, T3, T9, T10:** Vários planos mexem no mesmo arquivo de configuração. T1 cria app.config.js para as variantes. T3 (passo 7) também cria app.config.js, 'mínimo', para o sufixo de versão. T2 altera a entrada de plugin no app.json. T9 acrescenta o plugin expo-notifications, googleServicesFile e extra.eas.projectId, este último gravado pelo 'eas init', que costuma recusar ou só instruir quando existe configuração dinâmica. T10 acrescenta o plugin do Sentry. T3 e T9 instalam expo-constants cada um por conta própria.  
  **Resolução:** O app.config.js tem um único dono, a T1, que o cria com dois pontos de extensão: overrides por variante e cálculo de version. A T3 só acrescenta buildVersionName dentro dele. Plugins estáticos (expo-notifications, Sentry, assinatura) e extra.eas.projectId ficam no app.json-base; o projectId é colado à mão se o 'eas init' recusar. Em development, a T1 sobrescreve só name, package, scheme, ícone e a opção do plugin de assinatura, sem apagar a lista de plugins. expo-constants é instalado uma única vez, por quem chegar primeiro.
- **Conflito com T3, T5:** O primeiro APK assinado (v1.6.1) tem três caminhos diferentes. T2 (passo 11) sobe app.json à mão e dá 10601 como versionCode de exemplo (fórmula MAJOR*10000...). T3 recomenda 1006001 (MAJOR*1.000.000...) e usa o script versao:patch, e o teste de consistência dela barra edição manual de app.json sem package.json. T2 (passo 13) cria a tag com 'git tag -a' e publica com 'gh release create'. Se a T5 já estiver na main, o push da tag dispara o workflow, que tenta publicar o mesmo release.  
  **Resolução:** A T2 usa 'npm run versao:patch' e 'npm run versao:tag', com a fórmula decidida na T3 (recomendada: 1006001). O usuário escolhe o caminho da 1.6.1: manual, se sair antes da T5, ou pelo Actions, se sair depois. Nunca os dois para a mesma tag. Se a T5 já estiver mergeada, a T2 não roda 'gh release create'.
- **Conflito com T4:** A T4 (passo 5, verificação) exige que 'gh release view v1.6.0' continue mostrando o asset do APK. A T2 (passo 2) apaga esse asset. A ordem entre as duas decide qual verificação falha.  
  **Resolução:** Executar a T4 fase 1 antes da retirada do asset e trocar a verificação da T4 por 'a tag v1.6.0 e o release existem', sem depender do asset.
- **Conflito com T1, T3, T10:** Quatro planos alteram as mesmas rotinas do menu.bat ([5], [8], :GRADLE_BUILD). A T1 copia para release\snake-thai-dev-v<versão>.apk e roda via with-variant. A T3 copia para release\snake-thai-v%VERSAO_BUILD%.apk, com '+dev' no nome, e aborta se o android/ estiver desatualizado. A T2 acrescenta :VERIFY_SIGNATURE. A T10 define SENTRY_DISABLE_AUTO_UPLOAD. Os nomes de APK se contradizem e os conflitos de merge são certos.  
  **Resolução:** Editar o menu.bat em sequência, na ordem T1 → T3 → T2 → T10, cada uma rebaseada na anterior. Convenção de nome: release\snake-thai[-dev]-v<saída de 'version.js build-name'>.apk. A verificação de assinatura da T2 roda só no build PROD; em DEV, avisar sem bloquear.
- **Decisão consolidada (T1 + T2):** Assinatura da variante DEV.  
  **Recomendação:** DEV assinada com a chave de debug, instalada só por adb e nunca publicada em Releases. Implementar pela opção exigirChaveDeProducao do plugin (T2), controlada pelo app.config.js da T1.
- **Decisão consolidada (T2 + T3 + T5):** Com que versão e por qual caminho sai o primeiro APK assinado com a chave de produção?  
  **Recomendação:** Retirar já o APK debug da v1.6.0 (apagar o asset e deixar aviso nas notas). Se as pessoas que têm o app aceitam desinstalar uma vez agora, publicar v1.6.1 (versionCode 1006001) pelos scripts da T3. Se preferirem uma reinstalação só, segurar a assinatura para sair junto com a 1.7.0 do bloco Produto. O caminho é o Actions, se a T5 já estiver na main, ou manual; nunca os dois para a mesma tag.
- **Decisão consolidada (T2 + T5):** Onde ficam a keystore e as senhas, e como chegam ao Actions?  
  **Recomendação:** Arquivo .p12 fora de android/ e do repositório, com duas cópias de segurança e restauração testada. Senhas em %USERPROFILE%\.gradle\gradle.properties (BitLocker ativo). No GitHub, um único Environment 'release' (main + v*), com secrets cadastrados pelo próprio usuário via 'gh secret set'.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T2.md` escrito
