# PLANO DE EXECUÇÃO — T3: Padronizar o número de versão do app (SemVer + versionCode derivado + script de publicação)

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T3` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `chore/versionamento` |
| **Esforço** | M |
| **Depende de** | nenhuma |

## 1. Enunciado

Hoje a versão do app sobe a cada APK gerado para teste, inclusive 3 versões em 14 minutos e 4 MINORs num único dia. Além disso, todos os APKs saem com versionCode 1, então o Android não impede instalar um APK antigo por cima de um novo. O plano adota SemVer com uma regra simples: a versão só muda quando um APK é publicado para os usuários. PATCH = só correções. MINOR = tem funcionalidade nova. MAJOR = um APK já instalado deixa de funcionar com o servidor ou o banco. O versionCode passa a ser calculado pela fórmula MAJOR*1.000.000 + MINOR*1.000 + PATCH (1.6.0 = 1006000). Builds de teste e a variante DEV ganham um sufixo de commit no versionName sem mexer na versão. Um script sem dependências (npm run versao:patch|minor|major, versao:tag, versao:verificar, versao:notas) atualiza app.json/package.json, gera a entrada do CHANGELOG, cria o commit e a tag local. A próxima versão será 1.6.1 (1006001) se trouxer só assinatura e correções, 1.7.0 (1007000) se trouxer qualquer funcionalidade, e 2.0.0 só se algo recusar os APKs 1.x.

### Resposta às perguntas do usuário

A versão crescia rápido porque cada APK gerado para testar no celular ganhava um número novo. Aconteceu 3 vezes em 14 minutos em 09/09 (1.2.2, 1.2.3, 1.2.4) e 4 vezes em 14/09 (1.3.0 a 1.6.0), mas só a 1.6.0 foi publicada. Com a nova regra, a versão muda apenas quando um APK é publicado para os usuários. Builds de teste e a variante DEV mantêm o número e ganham só um sufixo de commit (ex.: 1.6.0+dev.12.abc1234). A próxima versão será 1.6.1 se trouxer só a assinatura de produção e correções, 1.7.0 se trouxer qualquer funcionalidade (o bloco Produto inteiro publicado junto continua sendo um único 1.7.0) e 2.0.0 apenas se alguma mudança no banco ou no servidor fizer os APKs 1.x pararem de funcionar.

## 2. Terreno (situação verificada)

- A versão do app vive só em app.json (1.6.0). Não há android.versionCode, runtimeVersion nem ios.buildNumber.  
  _Evidência:_ snake-thai/app.json:5 "version": "1.6.0"; bloco android em app.json:14-24 sem versionCode
- Todos os APKs gerados até hoje têm versionCode 1. Pela regra do Android, versionCode igual ou maior permite instalar por cima. Por isso nada impede instalar a 1.2.0 sobre a 1.6.0. (Inferência pela regra da plataforma, não testei no aparelho.)  
  _Evidência:_ android/app/build.gradle: versionCode 1 / versionName "1.6.0"; android/app/build/outputs/apk/release/output-metadata.json elements[0].versionCode = 1
- O package.json do app está desatualizado (1.0.0) e não bate com o app.json.  
  _Evidência:_ snake-thai/package.json:3 "version": "1.0.0"; package-lock.json:3 e :9 "1.0.0"
- Histórico da versão no app.json: 1.0.0 (3adb36e, 27/07) → 1.2.0 (0cfd959, 04/09) → 1.2.2 (084789d, 09/09 10:55) → 1.2.3 (320c1b7, 11:12) → 1.2.4 (1ee1d9a, 11:18) → 1.3.0 (6dfe7aa, 14/09 09:07) → 1.4.0 (4178c46, 11:15) → 1.5.0 (4aff466, 14:39) → 1.6.0 (ce91eca, 16:43).  
  _Evidência:_ git log -p -- app.json | grep version (snake-thai)
- A versão subia a cada APK de teste. As versões 1.1.0 e 1.2.1 existem só como APKs locais, sem commit no app.json. As 1.2.2, 1.2.3 e 1.2.4 foram geradas em 14 minutos.  
  _Evidência:_ ls release/: snake-thai-v1.1.0.apk (04/09 16:45), v1.2.1 (08/09 10:01), v1.2.2 11:10, v1.2.3 11:17, v1.2.4 11:24 (09/09); 11 APKs de 1.0.0 a 1.6.0; *.apk ignorado em .gitignore:58
- Só existe a tag v1.6.0 (local e remota). Ela aponta para 6a99b40 na branch feat/papel-professor, que ainda não está na origin/main (lá o app.json está em 1.4.0, 10 commits atrás).  
  _Evidência:_ git tag -l → v1.6.0; git ls-remote --tags origin → refs/tags/v1.6.0; git merge-base --is-ancestor v1.6.0 origin/main → falso; git show origin/main:app.json → 1.4.0; git rev-list --count origin/main..feat/papel-professor → 10
- Há um único GitHub Release (Snake Thai 1.6.0), com o asset snake-thai-v1.6.0.apk. As notas dizem que o APK foi assinado com chave de desenvolvimento e que versões anteriores à 1.3.0 não funcionam com o servidor atual.  
  _Evidência:_ gh release list → 'Snake Thai 1.6.0 Latest v1.6.0 2026-09-14'; gh release view v1.6.0 --json body
- A 1.3.0 quebrou a compatibilidade (APKs antigos passaram a ser recusados pelo banco), mas foi numerada como MINOR.  
  _Evidência:_ docs/FREQUENCIA.md:20-21 'APKs anteriores à 1.3.0 ... passam a receber recusa do banco'
- Não existem CHANGELOG, script de versão nem exibição da versão dentro do app. O expo-constants está instalado só como dependência transitiva do expo.  
  _Evidência:_ Grep em src/ por Constants/expo-constants/versionCode sem uso (só database.types.ts); ls CHANGELOG* inexistente; node_modules/expo-constants presente, ausente do package.json
- Os hooks já seguem Conventional Commits e aceitam '!' para quebra de compatibilidade, o que permite sugerir PATCH/MINOR/MAJOR a partir dos commits. O pre-commit roda typecheck + jest.  
  _Evidência:_ .husky/commit-msg: pattern '^(feat|fix|...)(\([a-z0-9._-]+\))?!?: .{1,}'; .husky/pre-commit: npm run typecheck + npx jest --ci
- A opção [5] do menu.bat compila o release sem conferir a versão e não renomeia o APK. Como android/ é gerada pelo prebuild, versionCode e versionName ficam fixos no build.gradle até o próximo prebuild.  
  _Evidência:_ menu.bat:242-248 (:APK_RELEASE) e :GRADLE_BUILD (menu.bat ~600-622); .gitignore:37 /android
- Os PRs entram na main por merge commit, o que mantém as tags no histórico da main. O repositório também permite squash.  
  _Evidência:_ origin/main 6c359cb 'Merge pull request #8'; gh repo view → mergeCommitAllowed/squashMergeAllowed/rebaseMergeAllowed true
- Os testes em scripts/__tests__ seriam executados pelo jest atual, sem mudar configuração. O tsconfig permite importar JS (allowJs). Todos os JSON usam LF.  
  _Evidência:_ jest-expo getPlatformPreset.js testMatch **/__tests__/**; package.json jest.testPathIgnorePatterns só node_modules e dist; node_modules/expo/tsconfig.base.json allowJs true; git ls-files --eol → app.json/package.json i/lf w/lf
- O snake-server está em 0.1.0 desde a criação, sem tags nem CHANGELOG. Cada push na main dispara deploy pelo job 'deploy' do CI (autoDeploy da Render desligado), e não pelo painel, como o contexto supunha.  
  _Evidência:_ snake-server/package.json:3 0.1.0 (e8daa20, 21/08); git tag -l vazio; origin/main:.github/workflows/ci.yml:240-245 'deploy' if github.ref == refs/heads/main; render.yaml:31 autoDeploy: false

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Qual fórmula usar para o versionCode do Android?**

- A) MAJOR*1.000.000 + MINOR*1.000 + PATCH (1.6.0 → 1006000; até 999 por parte)
- B) MAJOR*10.000 + MINOR*100 + PATCH (1.6.0 → 10600; até 99 por parte)
- C) Contador que soma 1 a cada publicação (não dá para calcular a partir da versão; depende do histórico)

➡️ _Adotado:_ A. Custa o mesmo que a B, nunca trava um hotfix por falta de espaço e continua bem abaixo do limite de 2.100.000.000. Qualquer um dos números já é maior que o versionCode 1 instalado hoje, então os aparelhos atualizam normalmente.

**P2. Com que versão sai o primeiro APK assinado com a chave de produção (coordenar com a tarefa da chave de release)?**

- Substituir o asset da release v1.6.0 existente, mantendo 1.6.0
- Publicar 1.6.1 (só assinatura e correções)
- Publicar 1.7.0 se já levar alguma funcionalidade (ex.: chamada em andamento no cache)
- Publicar 2.0.0 para sinalizar que é preciso desinstalar e reinstalar

➡️ _Adotado:_ Nunca trocar o binário de uma tag já publicada: o SHA-256 das notas deixaria de bater. Publicar 1.6.1 se for só a troca de chave e correções, ou 1.7.0 se incluir funcionalidade. A desinstalação obrigatória vem da troca de assinatura, não de quebra com o servidor. Basta avisar nas notas, sem MAJOR.

**P3. Em que momento a tag de versão é criada?**

- Na main, depois do merge do PR (merge commit)
- Na branch de trabalho, antes de abrir o PR

➡️ _Adotado:_ Na main, depois do merge, sempre com merge commit e nunca squash. Assim a tag fica no histórico da main e o intervalo 'desde a última tag' do CHANGELOG fica correto.

**P4. Se a parte escolhida for menor que a sugerida pelos commits (ex.: versao:patch com um commit feat), o script deve bloquear ou só avisar?**

- Bloquear e exigir --forcar
- Apenas avisar e seguir

➡️ _Adotado:_ Bloquear e exigir --forcar. Essa é justamente a regra que se quer tornar hábito, e o --forcar cobre um feat que na prática é só um ajuste.

**P5. Mostrar a versão dentro do app (rodapé do Perfil: 'Versão 1.7.0 (1007000)' ou '1.6.0+dev.12.abc1234')?**

- Sim, com expo-constants adicionado como dependência direta (npx expo install expo-constants)
- Não, conferir só em Configurações > Apps do Android

➡️ _Adotado:_ Sim. É barato e evita perguntar a um aluno qual APK ele instalou. Fica como passo opcional no fim desta tarefa.

**P6. Versionar também o snake-server?**

- Sim: SemVer próprio e independente do app, com npm version e tag vX.Y.Z criada por marco (não a cada deploy), começando em 1.0.0
- Não por enquanto: manter 0.1.0 e deixar o contrato da API expresso só pelo /v1

➡️ _Adotado:_ Sim, de forma leve: 1.0.0 no próximo merge de funcionalidade na main, porque a API /v1 já está em produção e o APK publicado depende dela. PRs do Dependabot, docs e CI não sobem versão. Sem CHANGELOG manual: usar gh release --generate-notes.

## 4. Ações que só o usuário pode fazer

- [ ] Responder às 6 decisões acima. Sem a primeira (fórmula) e a terceira (quando criar a tag), os passos 2 a 6 não começam.
- [ ] Autorizar explicitamente o push dos commits desta tarefa e de cada tag de versão (git push origin <branch> e git push origin vX.Y.Z). Regra do repositório: push só com decisão explícita e nunca force push, então uma tag publicada errada é corrigida com uma nova PATCH, nunca movendo a tag.
- [ ] Em cada publicação, dizer o que entra no APK e confirmar a parte (patch, minor ou major). Principalmente o MAJOR: só você sabe se ainda há alunos com APK antigo que precisam continuar funcionando.
- [ ] Garantir que os PRs para a main continuem com 'Create a merge commit', e não squash, no botão de merge do GitHub.

## 5. Passos atômicos

### Passo 1

Partir da branch certa. Se feat/papel-professor ainda não entrou na main, criar chore/versionamento a partir dela (ela contém a tag v1.6.0). Se já entrou com merge commit, criar a partir da main atualizada (git switch main && git pull --ff-only). Conferir que a última tag alcançável é v1.6.0.

**Como verificar:** git describe --tags --long retorna 'v1.6.0-<n>-g<sha>' e não 'fatal: No names found'. git status --porcelain vazio.

### Passo 2

Criar a biblioteca pura scripts/version-lib.js: CommonJS, sem dependências, com JSDoc, identificadores em inglês como em src/ e mensagens em pt-BR. Funções: parseVersion('1.6.0'), que aceita o 'v' opcional e rejeita qualquer formato fora de MAJOR.MINOR.PATCH; bumpVersion(v, 'patch'|'minor'|'major'), em que minor zera o patch e major zera minor e patch; versionCodeFrom(v) = MAJOR*1_000_000 + MINOR*1_000 + PATCH (ou a fórmula decidida), com constantes nomeadas e erro se MINOR ou PATCH passar de 999 ou o código passar de 2_100_000_000; suggestBump(commits), em que '!' antes dos dois-pontos ou 'BREAKING CHANGE' no corpo dá major, qualquer feat dá minor e o resto dá patch; buildChangelogSection({version, date, commits}), com os grupos 'Quebra de compatibilidade', 'Novidades' (feat) e 'Correções' (fix, perf), omitindo docs/chore/ci/test/style/build/refactor e tirando o prefixo tipo(escopo); buildVersionName({version, describe, variant}), que devolve '1.6.0' quando o commit está exatamente na tag e sem alterações, '1.6.0+12.abc1234' fora da tag, '1.6.0+dev.12.abc1234' na variante dev e acrescenta '.dirty' quando há alteração não commitada; e describeGit(), que usa execFileSync('git', ['describe','--tags','--long','--dirty','--match','v[0-9]*']) e devolve null se o git ou as tags faltarem, por exemplo num clone raso.

_Arquivos:_ `scripts/version-lib.js`

**Como verificar:** node -e "const l=require('./scripts/version-lib');console.log(l.versionCodeFrom('1.6.0'), l.bumpVersion('1.6.0','minor'))" imprime 1006000 1.7.0

### Passo 3

Criar os testes jest em scripts/__tests__/version-lib.test.js, com nomes em pt-BR que dizem condição e resultado. Casos: patch/minor/major zeram as partes certas; 1.6.0→1006000, 1.6.1→1006001, 1.7.0→1007000, 2.0.0→2000000; uma lista de versões em ordem SemVer gera códigos estritamente crescentes; 1.1000.0, '1.6' e 'abc' são recusados; feat! e BREAKING CHANGE sugerem major, feat sugere minor, fix/docs sugerem patch; o CHANGELOG agrupa e omite os tipos internos; buildVersionName cobre exatamente na tag, fora da tag, dev e dirty. Incluir um teste de consistência que lê app.json e package.json: versionCode === versionCodeFrom(version) e package.json.version === app.json expo.version. Esse teste roda no pre-commit (Husky) e barra edição manual. ci.yml não é alterado.

_Arquivos:_ `scripts/__tests__/version-lib.test.js`

**Como verificar:** npx jest --listTests | findstr version-lib mostra o arquivo. npx jest scripts passa, exceto o teste de consistência, que só passa depois do passo 6. npm test continua verde com os 324 testes + os novos.

### Passo 4

Criar a CLI scripts/version.js, que usa a lib e chama o git sempre via execFileSync, sem montar comando em string. Subcomandos: (a) patch|minor|major [--dry-run] [--forcar]. Exige working tree limpo e a última tag (git describe --tags --abbrev=0 --match v[0-9]*) igual à versão do app.json. Aborta com 'Nenhum commit desde vX: nada a publicar' se não houver commits (git log vX..HEAD --no-merges). Calcula a nova versão e o versionCode e exige que o código seja maior que o da última tag (git show vX:app.json; ausente conta como 1). Exige que a tag nova não exista local nem remotamente (git ls-remote --tags origin refs/tags/vNOVA, que só lê). Compara a parte pedida com suggestBump e bloqueia sem --forcar. Grava expo.version e expo.android.versionCode no app.json, version no package.json e version + packages[''].version no package-lock.json (JSON.stringify com 2 espaços + '\n', LF), insere a seção nova no topo do CHANGELOG.md e não faz commit. No --dry-run só imprime. (b) tag: exige que só app.json, package.json, package-lock.json e CHANGELOG.md estejam alterados, roda check, confere que o CHANGELOG tem '## [X.Y.Z]' e avisa se a branch não é a main. Depois roda git add nesses 4 arquivos, git commit -m 'chore(release): vX.Y.Z' (os hooks rodam normalmente) e git tag -a vX.Y.Z -F <arquivo temporário com a seção>. Não faz push e imprime os comandos de push. (c) check [--tag vX.Y.Z] [--android]: confere versionCode = fórmula, package.json igual a app.json e, com --tag, tag = 'v'+version. Com --android, lê android/app/build.gradle (versionCode e versionName) e aborta com 'android/ desatualizada: rode npx expo prebuild --platform android (menu [P])' se não bater. (d) notes vX.Y.Z: imprime a seção do CHANGELOG para gh release create --notes-file. (e) build-name [--variant dev|prod]: imprime buildVersionName.

_Arquivos:_ `scripts/version.js`

**Como verificar:** No estado atual, node scripts/version.js minor --dry-run aborta com 'Nenhum commit desde v1.6.0'. node scripts/version.js check falha com 'versionCode ausente' antes do passo 6. node scripts/version.js build-name imprime '1.6.0' quando HEAD está em 6a99b40 sem alterações.

### Passo 5

Adicionar ao package.json os scripts npm: "versao:patch": "node scripts/version.js patch", "versao:minor": "node scripts/version.js minor", "versao:major": "node scripts/version.js major", "versao:tag": "node scripts/version.js tag", "versao:verificar": "node scripts/version.js check", "versao:notas": "node scripts/version.js notes". Argumentos extras passam com '--' (ex.: npm run versao:minor -- --dry-run).

_Arquivos:_ `package.json`

**Como verificar:** npm run versao:patch -- --dry-run executa a CLI e mostra a mesma saída do passo 4.

### Passo 6

Fazer o alinhamento único do estado atual, sem criar versão nova: incluir "versionCode": 1006000 em expo.android no app.json (versão continua 1.6.0) e mudar package.json e package-lock.json (raiz e packages['']) de 1.0.0 para 1.6.0. Não mover a tag v1.6.0 nem recriar a release. Não criar tags retroativas das 1.0.0 a 1.5.0: esse histórico fica registrado no CHANGELOG (passo 9).

_Arquivos:_ `app.json`, `package.json`, `package-lock.json`

**Como verificar:** npm run versao:verificar sai com código 0. npx expo config --type public --json mostra version '1.6.0' e android.versionCode 1006000. git diff --stat mostra só essas linhas. O teste de consistência do passo 3 passa.

### Passo 7

Adicionar o sufixo de build ao versionName. É o que diferencia um build de teste ou DEV de uma publicação sem inflar a versão. Coordenar com a tarefa da variante DEV (suponho que seja a T1). Se já existir app.config.js/ts, só aplicar version: buildVersionName({ version: config.version, describe: describeGit(), variant: process.env.APP_VARIANT === 'dev' ? 'dev' : 'prod' }). Se não existir, criar um app.config.js mínimo que recebe ({ config }), devolve { ...config, version: <acima> } e mantém o app.json como fonte. Regras: o versionCode da DEV é igual ao da última tag, sem conflito porque o applicationId da DEV será outro; o versionName carrega +dev.<commits desde a tag>.<sha>. Registrar o contrato em docs/VERSIONAMENTO.md para quem montar o workflow de build no GitHub Actions: é preciso fetch-depth: 0 para o git describe enxergar as tags.

_Arquivos:_ `app.config.js (ou o app.config.ts criado na tarefa da variante DEV)`, `scripts/version-lib.js`

**Como verificar:** Com HEAD fora de tag, npx expo config --type public --json mostra version '1.6.0+N.<sha>'. Com set APP_VARIANT=dev, mostra '1.6.0+dev.N.<sha>'. Num checkout exato de v1.6.0 sem alterações, mostra '1.6.0'. npm run typecheck continua verde.

### Passo 8

Proteger o build de release no menu.bat [5], mantendo CRLF. Antes de chamar :GRADLE_BUILD assembleRelease, rodar 'call npm run --silent versao:verificar -- --android'. Se falhar, mostrar a mensagem, pausar e voltar ao menu, sem compilar 17 minutos com versionCode velho. Depois de um build bem-sucedido, obter o nome com for /f "delims=" %%v in ('node scripts\version.js build-name') do set "VERSAO_BUILD=%%v" e copiar android\app\build\outputs\apk\release\app-release.apk para release\snake-thai-v%VERSAO_BUILD%.apk, a convenção já usada. Se a tarefa da variante DEV também mexer no menu.bat, fazer as duas mudanças na mesma branch ou em sequência para evitar conflito.

_Arquivos:_ `menu.bat`

**Como verificar:** Com o android/ atual (build.gradle com versionCode 1), a opção [5] aborta na hora com 'android/ desatualizada'. Depois de rodar o prebuild (menu [P]), findstr /R "versionCode versionName" android\app\build.gradle mostra 1006000 e o sufixo, e o check passa. A cópia nomeada só é conferida no próximo build real.

### Passo 9

Criar o CHANGELOG.md em pt-BR, no formato do Keep a Changelog, com cabeçalho apontando para docs/VERSIONAMENTO.md e o histórico reconstituído. [1.6.0] 2026-09-14: texto das notas do gh release view v1.6.0 (commits f2816da, fb2eed7, 77842e3). [1.5.0] 2026-09-14: 1dd6389, 9ba244f, 3e935f9. [1.4.0] 2026-09-14: 65aa64b, 00be4e9, 536b55c. [1.3.0] 2026-09-14: 6dfe7aa, b85cab5, com a seção 'Quebra de compatibilidade: APKs anteriores à 1.3.0 são recusados pelo banco' e a nota 'pela política atual seria 2.0.0; numeração mantida'. [1.2.4]/[1.2.3] 2026-09-09: 1ee1d9a, 320c1b7 (biometria). [1.2.2] 2026-09-09: 084789d, ae0b28f. [1.2.0] 2026-09-04: 2101f11, 4f9ffe2, d380710, 3c41946. [1.0.0]: base até e9d98d4. Nota final: 1.1.0 e 1.2.1 foram APKs locais sem commit e sem publicação; só a 1.6.0 tem GitHub Release. O parser do subcomando notes exige cabeçalhos no formato exato '## [X.Y.Z] - AAAA-MM-DD'.

_Arquivos:_ `CHANGELOG.md`

**Como verificar:** npm run versao:notas -- v1.6.0 imprime exatamente a seção 1.6.0. npm run versao:notas -- v9.9.9 sai com erro.

### Passo 10

Documentar. docs/VERSIONAMENTO.md traz: (1) regra de ouro: a versão só muda ao publicar APK para usuários; commits, PRs, merges, builds de teste, DEV, deploy do servidor, migrations, seeds, docs e Dependabot não mudam; (2) PATCH só correções e ajustes, vários fixes viram uma PATCH; MINOR quando há ao menos uma funcionalidade nova compatível, e um bloco entregue junto é um único MINOR; MAJOR quando uma migration, RPC, Edge Function ou rota faz um APK já instalado falhar numa operação que antes funcionava, preferindo migração expand/contract para evitar; a escolha segue a maior mudança contida no release; (3) a fórmula do versionCode; (4) o sufixo de build e da DEV; (5) o fluxo de publicação passo a passo (passo 14); (6) a tabela de exemplos a partir da 1.6.0; (7) tag publicada é imutável, erro vira nova PATCH. Atualizar também: docs/README.md (índice), docs/RUNBOOK.md (a seção 'Release', linhas ~95-110, passa a apontar para o fluxo versionado), README.md (seção curta 'Versões e publicação' com os comandos npm, exigida pela §9 do CLAUDE.md para mudança de comandos) e CLAUDE.md §10 (uma linha com a política e o link).

_Arquivos:_ `docs/VERSIONAMENTO.md`, `docs/README.md`, `docs/RUNBOOK.md`, `README.md`, `CLAUDE.md`

**Como verificar:** Todos os links relativos abrem, conferido com grep -n VERSIONAMENTO docs/README.md README.md CLAUDE.md. O README não contém valores de segredo.

### Passo 11

Fazer os commits locais em Conventional Commits, deixando os hooks rodarem, sem --no-verify: 'build(versao): versionCode derivado da versao e script de publicacao', 'test(versao): cobre incremento, versionCode monotonico e consistencia do app.json', 'build(menu): release confere a versao e nomeia o APK', 'docs(versao): politica de versionamento e CHANGELOG reconstituido'. Depois, ensaiar sem publicar: npm run versao:patch -- --dry-run. O push só acontece com autorização do usuário e segue a tarefa de pushs/PRs.

**Como verificar:** Os commits passam no hook. O dry-run imprime '1.6.0 → 1.6.1 (versionCode 1006001)', sugestão 'patch' (só há commits build/test/docs desde v1.6.0) e um rascunho de CHANGELOG sem seções de novidades. git status continua limpo depois do dry-run.

### Passo 12

Passo opcional, se a decisão 5 for 'sim': rodar npx expo install expo-constants para torná-lo dependência direta na versão do SDK 57 e mostrar no rodapé da tela de Perfil 'Versão {Constants.expoConfig?.version} ({Constants.expoConfig?.android?.versionCode})', com accessibilityLabel, texto secundário do tema e sem cor fixa. Teste RNTL simples com o expo-constants mockado.

_Arquivos:_ `package.json`, `package-lock.json`, `src/screens/<tela de Perfil existente>`, `src/screens/__tests__/<teste do rodapé>`

**Como verificar:** npm test verde. Num APK DEV, o Perfil mostra '1.6.0+dev.N.<sha> (1006000)'. Confirmar no aparelho que, no release, expoConfig.version reflete o sufixo do build. Isso é suposição sobre o embutimento do expo-constants no build Gradle e precisa ser verificado.

### Passo 13

Passo opcional, se a decisão 6 for 'sim', no snake-server. Registrar a política em CONTRIBUTING.md e docs/DEPLOY.md: versão independente do app; MINOR quando a API /v1 ganha rota ou campo usado por um APK novo; PATCH para correção relevante em produção; MAJOR só junto de uma /v2; Dependabot, docs e CI não sobem. Na main, depois do merge que merece versão: npm version <parte> -m "chore(release): v%s" (atualiza package.json e lock, faz commit, que passa no commitlint e no lint-staged, e cria a tag vX.Y.Z), e publicar a release com gh release create vX.Y.Z --generate-notes, somente com autorização. Primeira versão sugerida: 1.0.0. Não alterar /health, para não expor fingerprint da versão.

_Arquivos:_ `snake-server/CONTRIBUTING.md`, `snake-server/docs/DEPLOY.md`, `snake-server/package.json (via npm version, no momento da publicação)`

**Como verificar:** No snake-server, git tag -l mostra v1.0.0 depois da primeira publicação autorizada. npx commitlint --from HEAD~1 passa. O deploy continua disparado pelo job 'deploy' do CI, sem mudança.

### Passo 14

Fluxo de cada publicação futura, documentado no passo 10 e executado só quando houver release. (1) PRs na main com merge commit; git switch main && git pull --ff-only. (2) npm run versao:<parte> -- --dry-run e conferir sugestão e notas. (3) npm run versao:<parte> e revisar ou editar o CHANGELOG.md. (4) npm run versao:tag. (5) Com autorização: git push origin main e git push origin vX.Y.Z. (6) npx expo prebuild --platform android e menu.bat [5], ou o workflow de build do GitHub Actions disparado pela tag, que deve rodar 'node scripts/version.js check --tag $GITHUB_REF_NAME' antes do build. (7) node scripts\version.js notes vX.Y.Z > %TEMP%\notas.md, depois gh release create vX.Y.Z release\snake-thai-vX.Y.Z.apk --title "Snake Thai X.Y.Z" --notes-file %TEMP%\notas.md. Exemplos a partir da 1.6.0: só assinatura de produção, variante DEV e correções = 1.6.1 (1006001); qualquer funcionalidade (cache da chamada, aulas recorrentes, editar aluno/turma, dashboard, exclusão de conta, push) = 1.7.0 (1007000), e o bloco Produto inteiro publicado junto é um único 1.7.0 (em duas entregas, 1.7.0 e 1.8.0); migration do bloco que recuse APKs 1.x = 2.0.0 (2000000); hotfix depois da 1.7.0 = 1.7.1 (1007001); build DEV 12 commits depois da 1.6.0 = versionName 1.6.0+dev.12.<sha>, versionCode 1006000.

_Arquivos:_ `app.json`, `package.json`, `package-lock.json`, `CHANGELOG.md`

**Como verificar:** Depois da publicação: gh release view vX.Y.Z mostra o asset. aapt dump badging (ou adb shell dumpsys package com.snakethai.app | findstr version) no aparelho mostra versionCode = fórmula e versionName = X.Y.Z sem sufixo. Instalar por cima de uma versão menor funciona; tentar instalar um APK de versionCode menor falha com INSTALL_FAILED_VERSION_DOWNGRADE.

## 6. Riscos

- A tag v1.6.0 ainda não está na origin/main. Se feat/papel-professor entrar por squash ou rebase, a tag sai do histórico da main, e o 'git describe' e o intervalo do CHANGELOG ficam errados. Mitigação: merge commit, como no PR #8.
- O android/ fica desatualizado porque versionCode e versionName são gravados no build.gradle pelo prebuild. Compilar sem novo prebuild gera APK com versionCode 1. Mitigação: o check --android no menu.bat [5], e o workflow do Actions deve rodar o prebuild.
- Depois que um APK com versionCode 1006001 ou maior for instalado, APKs antigos (versionCode 1) não instalam mais por cima (INSTALL_FAILED_VERSION_DOWNGRADE). É o comportamento desejado, mas para testar um APK antigo é preciso desinstalar antes.
- Um build DEV feito numa branch que não contém a tag mais recente gera versionCode menor que o DEV já instalado e a instalação falha. Mitigação: desinstalar o DEV ou fazer rebase na main.
- A troca da chave de debug pela de produção (outra tarefa) obriga a desinstalar independentemente da versão. Esta tarefa não resolve isso, só evita que a versão seja usada para mascarar o problema.
- Conflito com a tarefa da variante DEV (suponho T1), que provavelmente cria app.config e mexe no menu.bat. Executar as duas em sequência na mesma branch ou definir quem cria o app.config primeiro. Não conheço a numeração exata das outras tarefas, por isso depende_de ficou vazio.
- O workflow de build do GitHub Actions precisa de actions/checkout com fetch-depth: 0. Sem isso, o git describe não acha tags e o sufixo cai no fallback.
- O teste de consistência entra na suíte jest, que o ci.yml existente já roda com npm test. Não há mudança no CI, o que respeita o 'Esquece o CI', mas um app.json editado à mão passa a quebrar o CI além do pre-commit.
- Tag publicada não pode ser movida (regra de nunca fazer force push). Uma tag errada exige nova PATCH, por isso o fluxo tem dry-run e a separação entre versao:<parte> e versao:tag.
- A exibição da versão no app pressupõe que o expo-constants embute a configuração resolvida no build Gradle. É suposição e precisa ser verificada no aparelho (passo 12).
- A numeração da 1.3.0 (quebra tratada como MINOR) fica como está. Renumerar retroativamente confundiria quem já instalou; o CHANGELOG registra a exceção.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T5, T9, T10:** Cada plano usa um nome ou valor diferente para a variante. T1: APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production' (with-variant.js recebe dev|prod). T3 (passo 7): process.env.APP_VARIANT === 'dev', que nunca é verdadeiro com a T1, então o sufixo +dev nunca aparece. T10: lê um hipotético EXPO_PUBLIC_APP_ENV. T5: define APP_VARIANT: production, mas grava um .env sem EXPO_PUBLIC_APP_VARIANT e não passa pelo with-variant.js. T9: enum app_variant ('production', 'development').  
  **Resolução:** A T1 publica o contrato: APP_VARIANT ∈ {development, production} no processo de build e EXPO_PUBLIC_APP_VARIANT com o mesmo valor no JS. T3 compara com 'development'. T10 usa EXPO_PUBLIC_APP_VARIANT como environment do Sentry. T9 mantém o enum. No CI, a T5 grava .env.prod e roda os comandos via 'node scripts/with-variant.js prod -- ...', garantindo o mesmo caminho de carga de variáveis e as mesmas travas do build local.
- **Conflito com T1, T2, T9, T10:** Vários planos mexem no mesmo arquivo de configuração. T1 cria app.config.js para as variantes. T3 (passo 7) também cria app.config.js, 'mínimo', para o sufixo de versão. T2 altera a entrada de plugin no app.json. T9 acrescenta o plugin expo-notifications, googleServicesFile e extra.eas.projectId, este último gravado pelo 'eas init', que costuma recusar ou só instruir quando existe configuração dinâmica. T10 acrescenta o plugin do Sentry. T3 e T9 instalam expo-constants cada um por conta própria.  
  **Resolução:** O app.config.js tem um único dono, a T1, que o cria com dois pontos de extensão: overrides por variante e cálculo de version. A T3 só acrescenta buildVersionName dentro dele. Plugins estáticos (expo-notifications, Sentry, assinatura) e extra.eas.projectId ficam no app.json-base; o projectId é colado à mão se o 'eas init' recusar. Em development, a T1 sobrescreve só name, package, scheme, ícone e a opção do plugin de assinatura, sem apagar a lista de plugins. expo-constants é instalado uma única vez, por quem chegar primeiro.
- **Conflito com T5:** A T5 faz actions/checkout sem fetch-depth: 0. No workflow_dispatch da main o git describe não encontra tags, e o versionName da T3 cai no fallback. A T5 exige versionName igual à tag no aapt, o que quebra se o sufixo da T3 incluir '.dirty' ou '+N.sha'. A T5 publica com --generate-notes, enquanto a T3 gera as notas do CHANGELOG ('version.js notes'). A T3 (passo 14) prevê 'gh release create' manual, e a T5 cria o release automaticamente ao receber a tag: com os dois fluxos ativos, o release é duplicado ou um deles falha.  
  **Resolução:** Na T5: checkout com fetch-depth: 0; antes do build, rodar 'node scripts/version.js check --tag $GITHUB_REF_NAME'; notas via 'node scripts/version.js notes $GITHUB_REF_NAME > notas.md' e '--notes-file'. Na checagem do aapt, aceitar só a versão exata no build de tag. Depois que a T5 estiver na main, o passo manual 7 da T3 (gh release create) vira apenas plano de contingência, documentado em docs/VERSIONAMENTO.md.
- **Conflito com T2, T5:** O primeiro APK assinado (v1.6.1) tem três caminhos diferentes. T2 (passo 11) sobe app.json à mão e dá 10601 como versionCode de exemplo (fórmula MAJOR*10000...). T3 recomenda 1006001 (MAJOR*1.000.000...) e usa o script versao:patch, e o teste de consistência dela barra edição manual de app.json sem package.json. T2 (passo 13) cria a tag com 'git tag -a' e publica com 'gh release create'. Se a T5 já estiver na main, o push da tag dispara o workflow, que tenta publicar o mesmo release.  
  **Resolução:** A T2 usa 'npm run versao:patch' e 'npm run versao:tag', com a fórmula decidida na T3 (recomendada: 1006001). O usuário escolhe o caminho da 1.6.1: manual, se sair antes da T5, ou pelo Actions, se sair depois. Nunca os dois para a mesma tag. Se a T5 já estiver mergeada, a T2 não roda 'gh release create'.
- **Conflito com T1, T2, T10:** Quatro planos alteram as mesmas rotinas do menu.bat ([5], [8], :GRADLE_BUILD). A T1 copia para release\snake-thai-dev-v<versão>.apk e roda via with-variant. A T3 copia para release\snake-thai-v%VERSAO_BUILD%.apk, com '+dev' no nome, e aborta se o android/ estiver desatualizado. A T2 acrescenta :VERIFY_SIGNATURE. A T10 define SENTRY_DISABLE_AUTO_UPLOAD. Os nomes de APK se contradizem e os conflitos de merge são certos.  
  **Resolução:** Editar o menu.bat em sequência, na ordem T1 → T3 → T2 → T10, cada uma rebaseada na anterior. Convenção de nome: release\snake-thai[-dev]-v<saída de 'version.js build-name'>.apk. A verificação de assinatura da T2 roda só no build PROD; em DEV, avisar sem bloquear.
- **Conflito com T1, T6, T8, T9:** Várias tarefas esbarram no 'Esquece o CI' (não adicionar testes ao CI). A T1 altera o ci.yml, só a porta do psql (necessário porque o job lê o config.toml). As regressões novas de T6, T8 e T9 em supabase/tests/ passam a rodar sozinhas no job 'banco'. Os testes Jest de T2, T3, T10 e T11 rodam no job de testes. Só a T9 levanta essa questão.  
  **Resolução:** Decisão única do usuário, aplicada a todas as tarefas. Recomendação: aceitar que testes nas pastas existentes rodem no CI atual, sem nenhum job ou passo novo, e manter a única edição do ci.yml na porta 55322. Se o usuário quiser literalmente nada novo no CI, todas as regressões novas vão para supabase/tests-local/ e o db-dev test da T1 percorre as duas pastas.
- **Afirmação a conferir:** 'Cada push na main dispara deploy pelo job deploy do CI (autoDeploy da Render desligado), e não pelo painel, como o contexto supunha.'  
  **Por quê:** O job existe (snake-server origin/main:.github/workflows/ci.yml:240-270) e render.yaml:31 diz autoDeploy: false. Mas a T4 mostra que 'Publicar na Render' falha em todo merge por falta de RENDER_DEPLOY_HOOK_URL, e mesmo assim o PR #14 foi publicado. O deploy real provavelmente vem do Auto-Deploy do painel. Não dá para afirmar sem o usuário conferir o painel.
- **Afirmação a conferir:** Passo 11: o dry-run sugerirá 'patch' porque 'só há commits build/test/docs desde v1.6.0'.  
  **Por quê:** Só vale se a T3 for executada antes de qualquer outra branch com commits feat (T1, T2, T11). Na ordem recomendada, com a T1 integrada antes, a sugestão será 'minor' e a v1.6.1 da T2 exigirá '--forcar', ou mudará para 1.7.0.
- **Decisão consolidada (T1 + T3 + T5 + T9 + T10):** Contrato da variante (nomes e valores).  
  **Recomendação:** APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production'; padrão production, com o .env antigo renomeado para .env.prod. O CI usa .env.prod e with-variant.js. Decisão técnica, só para o usuário ciente.
- **Decisão consolidada (T2 + T3 + T5):** Com que versão e por qual caminho sai o primeiro APK assinado com a chave de produção?  
  **Recomendação:** Retirar já o APK debug da v1.6.0 (apagar o asset e deixar aviso nas notas). Se as pessoas que têm o app aceitam desinstalar uma vez agora, publicar v1.6.1 (versionCode 1006001) pelos scripts da T3. Se preferirem uma reinstalação só, segurar a assinatura para sair junto com a 1.7.0 do bloco Produto. O caminho é o Actions, se a T5 já estiver na main, ou manual; nunca os dois para a mesma tag.
- **Decisão consolidada (T3):** Fórmula do versionCode e momento da tag.  
  **Recomendação:** MAJOR*1.000.000 + MINOR*1.000 + PATCH. Tag na main depois do merge, criada por 'npm run versao:tag'. A versão só muda quando um APK é publicado; builds DEV e de teste levam o sufixo +dev.N.sha.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T3.md` escrito
