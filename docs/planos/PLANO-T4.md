# PLANO DE EXECUÇÃO — T4: Pushs, PRs e merges pendentes (snake-thai e snake-server) com limpeza de branches

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T4` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `sem branch nova (integra as pendentes)` |
| **Esforço** | M |
| **Depende de** | nenhuma |

## 1. Enunciado

Primeiro vou levar para a main do snake-thai os 10 commits da versão 1.6.0 que ficaram fora dela, usando PR com merge commit. Isso não tem efeito em produção e faz a tag v1.6.0 passar a fazer parte da main. Depois vou juntar, num único PR do snake-server, o commit local da P-19 e os 7 PRs seguros do Dependabot, para que só um deploy vá para a Render. Por fim, vou fechar os 3 majors que quebram a instalação e apagar as branches já mescladas nos dois repositórios, conferindo o resultado depois de cada merge.

### Resposta às perguntas do usuário

Sim, o GitHub Actions sai de graça para os seus dois repositórios. Os dois são públicos (confirmei com `gh api`: visibility public), e em repositório público o GitHub não cobra minutos dos runners padrão. Os CIs disparados por estes PRs e merges não custam nada. O APK automático é assunto de outra tarefa.

Correções no que foi informado:
- São 10 PRs abertos do Dependabot, não 11. O #2 foi fechado e trocado pelo #13.
- A feat/papel-professor tem 10 commits fora da main, não 11.
- O 'ahead 6' da feature/comprovantes-cloudinary no snake-server não precisa de push: os 6 commits já entraram na main pelo PR #14.
- O 'ahead 3' da feat/comprovantes-cloudinary no snake-thai também não: já entrou pelo PR #8.

## 2. Terreno (situação verificada)

- snake-thai: working tree limpo. A branch local feat/papel-professor está igual à remota (6a99b40) e tem 10 commits fora da main (não 11). O primeiro deles (678ada9) vem logo depois de 4178c46, que era o head do PR #8, já mesclado.  
  _Evidência:_ `git status --porcelain` vazio; `git rev-list --count origin/main..origin/feat/papel-professor` = 10; `git log -1 --format='%H %P' 678ada9` -> pai 4178c46; `gh pr list --state all`: #8 MERGED em 2026-09-14T16:55:42Z. Não há PR aberto no snake-thai.
- A tag v1.6.0 é leve, aponta para 6a99b40 e esse commit NÃO faz parte da main. O release 'Snake Thai 1.6.0' foi publicado com o asset snake-thai-v1.6.0.apk.  
  _Evidência:_ `git ls-remote --tags origin` -> 6a99b40 refs/tags/v1.6.0; `git cat-file -t v1.6.0` = commit; `git merge-base --is-ancestor v1.6.0 origin/main` -> NO; `gh release view v1.6.0` -> target 6a99b40, publicado em 2026-09-14T20:58:01Z.
- O merge de feat/papel-professor na main é limpo e deixa a main com exatamente o conteúdo do v1.6.0.  
  _Evidência:_ `git merge-tree --write-tree origin/main origin/feat/papel-professor` -> árvore 4641783565b212d5488fd43ca01b05607c5729d1, sem conflito, idêntica a `git rev-parse 6a99b40^{tree}`. Na main só há 3 commits que não estão na branch, e os 3 são merge commits (6c359cb, 89f565d, 4f1c8e5).
- snake-thai: o 'ahead 3' da branch local feat/comprovantes-cloudinary (8fac8f8, e9d98d4, 2101f11) já está na main por meio do PR #8. Não precisa de push.  
  _Evidência:_ `git merge-base --is-ancestor feat/comprovantes-cloudinary origin/main` -> YES; aparecem no grafo de `git log --graph origin/main` abaixo do merge 6c359cb.
- snake-thai: todas as branches remotas antigas podem ser apagadas. feat/comprovantes-cloudinary e feat/financial-module já estão mescladas. feat/auth-onboarding, classes-module, design-system e initial-setup têm cada uma só o merge commit dos PRs empilhados #2-#5, com árvore idêntica a um commit que já está na main. Nenhuma branch local tem commit fora da main ou da papel-professor. telas-admin e telas-aluno só existem localmente e já estão mescladas.  
  _Evidência:_ `git branch -r --merged origin/main`; `git diff 23dc2c1 049f4dc`, `18fe554 a0e5897`, `e9ecb9a b9dd992`, `d5ccbb8 c50e8e4` -> todos vazios, com os dois pais já na main; `git rev-list --count <b> --not origin/main origin/feat/papel-professor` = 0 em todas as branches locais; local main 'behind 81' e 0 commits só locais.
- snake-thai: o CI fica vermelho em todo push. A única falha é no job de regressão SQL, porque o teste regressao_c3_payment_whitelist.sql está desatualizado. Typecheck, Jest e npm audit passam. O workflow não faz deploy.  
  _Evidência:_ `gh run view 34896039860`: 'Regressão de segurança no banco' = failure com o erro 'null value in column "reference_month" of relation "payments" violates not-null constraint' (regressao_c3_payment_whitelist.sql:19). Os outros jobs = success. .github/workflows contém só ci.yml.
- Nenhum dos dois repos protege a branch ou tem ruleset. Os dois são públicos, aceitam merge commit, squash e rebase, e têm delete_branch_on_merge=false. Todo o histórico de PRs usa merge commit.  
  _Evidência:_ `gh api repos/yagoriccomi/<repo>/branches/main/protection` -> 404 'Branch not protected'; `gh api .../rulesets` -> []; `gh api repos/yagoriccomi/<repo>`: visibility public, allow_merge_commit/squash/rebase true, delete_branch_on_merge false. Mensagens 'Merge pull request #N' em `git log origin/main`.
- snake-server: working tree limpo. chore/p19-resolvida (cde55e2) tem 1 commit, só de documentação, e ainda não foi enviada. Ela está configurada para rastrear origin/main, então um `git push` sem argumentos é arriscado.  
  _Evidência:_ `git branch -vv`: 'chore/p19-resolvida cde55e2 [origin/main: ahead 1]'; `git diff --stat origin/main chore/p19-resolvida` -> só docs/PENDENCIAS.md (+6/-1); não aparece em `git ls-remote --heads origin`; push.default não configurado (fica o padrão simple).
- snake-server: o 'ahead 6' de feature/comprovantes-cloudinary NÃO precisa de push, porque os 6 commits já entraram na main pelo PR #14. As branches feature/modulo-justificativas e feature/servidor-docker também já estão mescladas. A main local está 38 commits atrás e não tem commit só local.  
  _Evidência:_ `git log --oneline origin/main..feature/comprovantes-cloudinary` vazio (a3ccc48 aparece em `git log origin/main`); `git branch -r --merged origin/main` lista as 3 feature/*; `git rev-list --count origin/main..main` = 0.
- Há 10 PRs abertos do Dependabot, não 11: o #2 foi fechado e substituído pelo #13. A referência local ferramentas-de-desenvolvimento-aa2442301a está obsoleta. As bases dos PRs são antigas, mas package.json, package-lock.json e ci.yml não mudaram na main desde então, e a simulação não dá conflito nem com a main nem entre os PRs.  
  _Evidência:_ `gh pr list --state all`: #3 #4 #5 #6 #7 #8 #9 #10 #11 #13 OPEN, #2 CLOSED; o ref aa2442301a não aparece em `git ls-remote`; `git diff --stat d0c6189 origin/main -- package.json package-lock.json .github/workflows/ci.yml` vazio; `git merge-tree <base> origin/main <branch>` = 0 conflitos em todos.
- Os 7 PRs seguros do Dependabot são #13, #11, #5, #7, #8, #9 e #10. O #13 atualiza patch/minor de dev (lint-staged 17.3->17.4.1, tsx ^4.23.13, typescript-eslint ^8.69.0). O #11 é o major de @types/supertest 6->7.2.1, que só tem tipos. Os outros cinco são actions do CI: checkout v4->v7, setup-node v4->v7, codeql-action v3->v4, setup-buildx v3->v4 e build-push v6->v7. Todos passaram nos 4 jobs, e nenhum mexe no TypeScript de build nem em dependência de produção.  
  _Evidência:_ `gh pr view N --json files,statusCheckRollup`: Qualidade e testes, Segurança e licenças, CodeQL e Imagem Docker = SUCCESS; o #5, #7, #8, #9 e #10 alteram só .github/workflows/ci.yml; o #11 e o #13 só package.json/lock (devDependencies). O Dockerfile compila com `npm run build` (tsc), mas a versão do typescript não muda nesses PRs.
- Os 3 PRs arriscados são #3 (vitest 3->4), #4 (typescript 5.9->7.0) e #6 (@eslint/js 9->10). Os três quebram o `npm ci` com ERESOLVE porque exigem upgrade coordenado de outros pacotes. O TypeScript 7 é o de maior risco, porque é o compilador do build da imagem de produção.  
  _Evidência:_ Logs dos jobs 99985269307, 99985320478 e 99985353010: '#3 While resolving: @vitest/coverage-v8@3.2.7 Found: vitest@4.1.11'; '#4 While resolving: typescript-eslint@8.67.0 Found: typescript@7.0.2'; '#6 While resolving: @eslint/js@10.0.1 Found: eslint@9.39.5'. Os jobs Qualidade e Segurança falham em 6-12s.
- Efeito colateral no snake-server: o job 'Publicar na Render' do CI falha em todo push na main porque falta o secret do deploy hook. Mesmo assim o PR #14 foi publicado minutos depois do merge. Isso indica que o painel da Render faz deploy automático, embora o render.yaml e a documentação digam autoDeploy: false. Não consegui confirmar direto na Render porque o conector não está autenticado.  
  _Evidência:_ Run 34871685100 (merge #14): 'Publicar na Render' = failure com '##[error]Secret RENDER_DEPLOY_HOOK_URL não configurado'; `gh secret list` vazio; render.yaml 'autoDeploy: false'; docs/PENDENCIAS.md:141 fala em deploy manual, mas a resolução da P-19 (cde55e2) diz 'PR #14 mergeado ... e publicado pela Render. Conferido em produção'. O contexto do usuário também fala em deploy automático.
- O /health não identifica a versão publicada. Para confirmar qual commit entrou no ar, é preciso olhar a aba Events da Render. Pelo /health e pelas rotas autenticadas dá para confirmar só que o serviço está saudável.  
  _Evidência:_ src/app.ts:62-64 -> `res.json({ ok: true })`. A URL base da API é a variável EXPO_PUBLIC_API_URL do .env do snake-thai (valor não impresso; não é o domínio de exemplo de docs/PENDENCIAS.md:93).
- Ferramentas e ganchos: o gh CLI está autenticado como yagoriccomi com escopo repo. Os dois repos têm Husky com pre-commit (typecheck + testes) e commit-msg (Conventional Commits), sem pre-push. O servidor MCP do GitHub falhou ao conectar e o conector da Render exige autenticação, por isso usei o gh CLI.  
  _Evidência:_ `gh auth status` (token oculto); arquivos .husky/pre-commit e .husky/commit-msg; `ls .husky` não tem pre-push.

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Você autoriza explicitamente os pushs e as exclusões de branches remotas deste plano? A regra do repo é: push só com decisão explícita e nunca force push.**

- Autorizar tudo de uma vez (snake-thai e snake-server)
- Autorizar por fase: primeiro o snake-thai (sem efeito em produção) e, depois de conferir, o snake-server (gera deploy)
- Não autorizar agora

➡️ _Adotado:_ Autorizar por fase. O snake-thai não afeta produção. O merge no snake-server gera deploy na Render e vale uma confirmação separada.

**P2. Qual estratégia usar nos merges dos PRs?**

- Merge commit (gh pr merge --merge)
- Squash (gh pr merge --squash)
- Rebase (gh pr merge --rebase)

➡️ _Adotado:_ Merge commit nos dois repos. (1) O commit 6a99b40 da tag v1.6.0 passa a fazer parte da main. Com squash ou rebase a main ganharia SHAs novos e a tag ficaria apontando para um commit fora da main para sempre. (2) Os commits já estão em Conventional Commits atômicos, cada um passou pelo Husky, e mantê-los ajuda no bisect e no revert. (3) No snake-server, os commits de head dos PRs do Dependabot entram na main, e assim o GitHub os marca como mesclados automaticamente. (4) Segue o histórico atual, em que todos os PRs usaram merge commit. (5) Squash de uma branch que já foi mesclada antes, como a papel-professor, cria duplicidade e conflitos nas próximas integrações.

**P3. snake-server: como integrar a P-19 e os 7 PRs seguros do Dependabot (#13, #11, #5, #7, #8, #9, #10)?**

- Uma branch chore/dependencias-e-p19, criada a partir de chore/p19-resolvida, com merge local dos 7 PRs, um PR, um merge e um deploy
- PR separado para a P-19 e merge individual de cada PR do Dependabot pelo GitHub: 8 merges, até 8 deploys, esperando o Dependabot fazer rebase do lockfile entre um e outro
- Só a P-19 agora e o Dependabot depois

➡️ _Adotado:_ Branch única com um PR. Assim há um ciclo de CI, uma revisão e um só deploy em produção. Nenhuma das atualizações muda o runtime: o TypeScript e as dependências de produção continuam iguais. Com merge commit, os 7 PRs do Dependabot ficam marcados como mesclados.

**P4. O que fazer com os 3 majors que quebram o npm ci: #3 vitest 4, #4 TypeScript 7 e #6 @eslint/js 10?**

- Fechar os três comentando '@dependabot ignore this major version' e registrar o upgrade adiado como pendência em docs/PENDENCIAS.md
- Fazer agora o upgrade manual coordenado de vitest + @vitest/coverage-v8 4 e de eslint + @eslint/js 10 numa branch própria, fechando só o do TypeScript 7
- Deixar os três abertos

➡️ _Adotado:_ Fechar os três com ignore e registrar a pendência. São ferramentas de desenvolvimento, sem ganho para produção. O TS7 nem instala com o typescript-eslint atual e é o compilador da imagem de produção. Um upgrade coordenado é trabalho de outra tarefa, não de 'fazer merges'.

**P5. Limpeza de branches: apagar as branches remotas já mescladas e ativar a exclusão automática de branch após merge nos dois repos?**

- Apagar todas as branches mescladas (remotas e locais) e ativar 'Automatically delete head branches'
- Apagar só as branches, sem mudar a configuração do repo
- Manter as branches antigas

➡️ _Adotado:_ Apagar todas e ativar a exclusão automática. Os commits continuam alcançáveis pela main e pela tag. Os SHAs estão neste plano, caso seja preciso recriar alguma branch.

**P6. Se você confirmar que o Auto-Deploy está ligado no painel da Render, o que fazer com o job 'Publicar na Render', que fica vermelho em todo merge, e com a documentação que diz autoDeploy: false?**

- Manter o Auto-Deploy ligado, não configurar o RENDER_DEPLOY_HOOK_URL e corrigir a nota em docs/PENDENCIAS.md e docs/DEPLOY.md
- Desligar o Auto-Deploy no painel e configurar o secret RENDER_DEPLOY_HOOK_URL, para que o deploy só aconteça depois do CI verde
- Não mexer agora

➡️ _Adotado:_ Manter o Auto-Deploy ligado e corrigir a documentação no mesmo PR de dependências, já que você pediu para esquecer o CI. Nunca configure o deploy hook com o Auto-Deploy ligado, porque cada merge viraria dois deploys.

## 4. Ações que só o usuário pode fazer

- [ ] Dar a autorização explícita de push e de exclusão de branches remotas (decisão 1).
- [ ] No painel da Render, abrir o serviço snakethai-api, ir em Settings e ver se o Auto-Deploy está ligado ('On Commit'). Informe o resultado antes do merge no snake-server. O conector da Render deste ambiente não está autenticado; para eu consultar direto, autorize o plugin Render com /mcp numa sessão interativa.
- [ ] Durante o merge do snake-server, acompanhar a aba Events da Render até o deploy do commit de merge ficar 'Deploy live'. Se der errado, usar Rollback no deploy anterior (em Deploys).
- [ ] No painel da Supabase (Project Settings > Integrations > GitHub), confirmar que não existe integração que aplique migrations no merge da main do snake-thai. Pelo repositório não dá para verificar, e a migration 20260914190000_chamada_em_lote.sql entra na main nesse merge.
- [ ] Opcional: o servidor MCP do GitHub falhou ao conectar (erro 400 no header Authorization). Não bloqueia nada, porque o plano usa o gh CLI, que está autenticado.

## 5. Passos atômicos

### Passo 1

Pré-checagem nos dois repos, antes de qualquer escrita remota. Rodar `git -C C:/Users/USER/Desktop/GIT/academy/snake-thai fetch --prune origin` e `git -C C:/Users/USER/Desktop/GIT/academy/snake-server fetch --prune origin`. O prune remove o ref obsoleto ferramentas-de-desenvolvimento-aa2442301a. Depois confirmar `git status --porcelain` vazio nos dois e comparar os heads com os SHAs do levantamento: snake-thai main=6c359cb e feat/papel-professor=6a99b40; snake-server main=eed8e35. Para os PRs do Dependabot, rodar `gh pr view N --repo yagoriccomi/snake-server --json headRefOid`, com N em 3..13.

**Como verificar:** Os SHAs batem com os listados. Se algum head do Dependabot mudou (rebase ou recreate), refazer a simulação com `git merge-tree $(git merge-base origin/main <ref>) origin/main <ref> | grep -c '^+<<<<<<<'` e só seguir com 0.

### Passo 2

snake-thai: abrir o PR de feat/papel-professor para a main, sem push, porque a branch já está no remoto. Escrever o corpo em <scratchpad>/pr-thai.md com: a lista dos 10 commits (`git log --oneline origin/main..origin/feat/papel-professor`); a observação de que a migration 20260914190000_chamada_em_lote.sql e os seeds já foram aplicados em produção; a tag v1.6.0 aponta para o head; o job 'Regressão de segurança no banco' já estava vermelho antes (teste regressao_c3 desatualizado); e, no fim, a linha de atribuição padrão do Claude Code. Rodar `gh pr create --repo yagoriccomi/snake-thai --base main --head feat/papel-professor --title "feat: chamada em lote, historico de pagamentos, financeiro por mes e app 1.6.0" --body-file <scratchpad>/pr-thai.md`.

_Arquivos:_ `<scratchpad>/pr-thai.md`

**Como verificar:** `gh pr view <N> --repo yagoriccomi/snake-thai --json state,mergeable,commits --jq '{state,mergeable,n:(.commits|length)}'` deve dar state OPEN, mergeable MERGEABLE e n 10.

### Passo 3

snake-thai: fazer o merge com merge commit, sem --delete-branch e sem --admin: `gh pr merge <N> --repo yagoriccomi/snake-thai --merge`. Não tem efeito em produção, porque o workflow ci.yml não faz deploy.

**Como verificar:** `gh pr view <N> --json state,mergeCommit` deve dar MERGED. Depois do `git fetch --prune origin`: `git merge-base --is-ancestor v1.6.0 origin/main && echo OK` deve imprimir OK; `git rev-parse origin/main^{tree}` deve ser 4641783565b212d5488fd43ca01b05607c5729d1; `git rev-list --count origin/main..origin/feat/papel-professor` deve ser 0. No `gh run list --repo yagoriccomi/snake-thai --branch main --limit 1` e no `gh run view <id> --json jobs`, 'Tipos, testes e licenças' e 'Auditoria de CVE' devem ficar success. 'Regressão de segurança no banco' em failure é esperado, porque o problema já existia.

### Passo 4

snake-thai: atualizar a main local. Rodar `git switch main` e depois `git pull --ff-only origin main`. A main local está 81 commits atrás e não tem commit só local. A pasta android/ é ignorada pelo Git e não é afetada.

**Como verificar:** `git status -sb` deve mostrar '## main...origin/main', sem ahead nem behind; `git rev-parse HEAD^{tree}` deve ser 4641783565b2...; `npm run typecheck` deve passar e `npx jest --ci` deve dar os 324 testes verdes.

### Passo 5

snake-thai: apagar as branches remotas. Antes, conferir de novo. Para feat/papel-professor, feat/comprovantes-cloudinary e feat/financial-module: `git merge-base --is-ancestor origin/<b> origin/main`. Para as empilhadas: `git diff --quiet origin/feat/auth-onboarding 049f4dc && git diff --quiet origin/feat/classes-module a0e5897 && git diff --quiet origin/feat/design-system b9dd992 && git diff --quiet origin/feat/initial-setup c50e8e4`. Se tudo passar, rodar `git push origin --delete feat/papel-professor feat/comprovantes-cloudinary feat/financial-module feat/auth-onboarding feat/classes-module feat/design-system feat/initial-setup`. Nunca apagar nem mover a tag v1.6.0.

**Como verificar:** `git ls-remote --heads origin` deve listar só refs/heads/main; `git ls-remote --tags origin` deve continuar com v1.6.0 em 6a99b40; `gh release view v1.6.0 --repo yagoriccomi/snake-thai --json tagName,assets` deve continuar mostrando o asset do APK.

### Passo 6

snake-thai: apagar as branches locais só com -d, a versão segura. Rodar `git fetch --prune origin` e depois `git branch -d feat/auth-onboarding feat/classes-module feat/comprovantes-cloudinary feat/design-system feat/financial-module feat/initial-setup feat/telas-admin feat/telas-aluno feat/papel-professor`. A feat/comprovantes-cloudinary local só pode ser apagada depois do prune: enquanto o upstream existe, o git recusa, porque ela está 3 commits à frente dele. Se o -d recusar alguma branch, parar e investigar. Nunca usar -D.

**Como verificar:** `git branch -vv` deve mostrar só main, sincronizada; `git branch -r` deve mostrar só origin/HEAD e origin/main.

### Passo 7

snake-server: guardar a situação de produção antes do deploy e confirmar o Auto-Deploy com o usuário. No Git Bash, sem imprimir a variável: `set -a; . C:/Users/USER/Desktop/GIT/academy/snake-thai/.env; set +a; curl -fsS "$EXPO_PUBLIC_API_URL/health"; curl -s -o /dev/null -w '%{http_code}\n' -X POST "$EXPO_PUBLIC_API_URL/v1/proofs/sign-upload"`. Se a variável já terminar em /v1, tirar o /v1 do caminho.

**Como verificar:** O /health deve responder {"ok":true} e a rota sem token deve dar 401. O usuário confirma se o Auto-Deploy está ligado (decisão 6).

### Passo 8

snake-server: criar a branch de integração a partir de chore/p19-resolvida, que é origin/main mais o commit cde55e2. Rodar `git switch chore/p19-resolvida` e depois `git switch -c chore/dependencias-e-p19`. Em seguida, fazer os merges nesta ordem, com `git merge --no-ff --no-edit` para cada ref: origin/dependabot/npm_and_yarn/ferramentas-de-desenvolvimento-d1c97fc883 (#13), origin/dependabot/npm_and_yarn/types/supertest-7.2.1 (#11), origin/dependabot/github_actions/github/codeql-action-4 (#5), origin/dependabot/github_actions/docker/build-push-action-7 (#7), origin/dependabot/github_actions/docker/setup-buildx-action-4 (#8), origin/dependabot/github_actions/actions/checkout-7 (#9) e origin/dependabot/github_actions/actions/setup-node-7 (#10). O commitlint aceita a mensagem padrão 'Merge remote-tracking branch ...'. Se o hook commit-msg recusar, usar `-m "chore(deps): integra PR #<n> do Dependabot"`.

_Arquivos:_ `package.json`, `package-lock.json`, `.github/workflows/ci.yml`

**Como verificar:** Nenhum conflito (a simulação deu 0). `git log --oneline origin/main..HEAD` deve mostrar cde55e2, os 7 commits do Dependabot e 7 merges. `grep -n 'uses:' .github/workflows/ci.yml` deve mostrar checkout@v7, setup-node@v7, codeql-action/init@v4 e analyze@v4, setup-buildx-action@v4, build-push-action@v7, com upload-artifact@v4 inalterado. No package.json: lint-staged ^17.4.1, tsx ^4.23.13, typescript-eslint ^8.69.0, @types/supertest ^7.2.1, e typescript continua ^5.7.3.

### Passo 9

snake-server: validar localmente o lockfile combinado e o gate. Rodar `npm ci`, que falha se o lock estiver inconsistente, e depois `npm run format:check && npm run lint && npm run typecheck && npm run test:coverage`. Opcional: `docker build --target runtime -t snakethai-api:verificacao .`. Se o `npm ci` falhar, rodar `npm install` para regenerar o lock e fazer commit como `build(deps): regenera package-lock apos combinar atualizacoes` (o Husky roda lint-staged, typecheck e vitest).

_Arquivos:_ `package-lock.json`

**Como verificar:** Todos os comandos com exit 0 e a suíte vitest verde. `git status --porcelain` vazio depois do eventual commit.

### Passo 10

snake-server: registrar a documentação na mesma branch, para não gerar outro deploy. Em docs/PENDENCIAS.md, criar a P-20 'Upgrades major adiados', com os PRs #3, #4 e #6, o motivo (ERESOLVE: coverage-v8 3.x preso ao vitest 3, typescript-eslint sem suporte a TS 7, eslint 9 incompatível com @eslint/js 10) e o que um upgrade coordenado exige. Se a decisão 6 confirmar o Auto-Deploy ligado, corrigir também docs/PENDENCIAS.md:141 e docs/DEPLOY.md:33, que hoje dizem autoDeploy false/manual. Fazer commit como `docs(pendencias): registra upgrades major adiados e o modo real de deploy`. O README não muda, porque não há variável de ambiente nem comando novo.

_Arquivos:_ `docs/PENDENCIAS.md`, `docs/DEPLOY.md`

**Como verificar:** `git show --stat HEAD` deve listar só arquivos em docs/; o commit passa pelo commitlint e pelo pre-commit.

### Passo 11

snake-server: enviar a branch com refspec explícito e abrir o PR. Rodar `git push -u origin chore/dependencias-e-p19`. Nunca usar `git push` sem argumentos nesta máquina enquanto a chore/p19-resolvida rastrear origin/main. Escrever o corpo em <scratchpad>/pr-server.md com: 'Inclui os PRs do Dependabot #13, #11, #5, #7, #8, #9 e #10'; sem mudança de runtime (TypeScript e dependências de produção iguais); marca a P-19 resolvida; registra a P-20; e a linha de atribuição padrão. Rodar `gh pr create --repo yagoriccomi/snake-server --base main --head chore/dependencias-e-p19 --title "chore(deps): atualiza actions do CI e ferramentas de desenvolvimento" --body-file <scratchpad>/pr-server.md`.

_Arquivos:_ `<scratchpad>/pr-server.md`

**Como verificar:** `git ls-remote --heads origin chore/dependencias-e-p19` deve devolver o SHA local. Em `gh pr checks <N> --repo yagoriccomi/snake-server --watch`: 'Qualidade e testes', 'Segurança e licenças', 'CodeQL (SAST)' e 'Imagem Docker' = pass, já com as actions novas; 'Publicar na Render' = skipping.

### Passo 12

snake-server: fazer o merge com merge commit, só com os checks verdes e a autorização da fase 2: `gh pr merge <N> --repo yagoriccomi/snake-server --merge`. EFEITO COLATERAL: deploy em produção na Render, se o Auto-Deploy estiver ligado. Se estiver desligado, o usuário faz Manual Deploy do commit de merge.

**Como verificar:** `gh pr view <N> --json state,mergeCommit` deve dar MERGED. `gh pr list --repo yagoriccomi/snake-server --state open --author app/dependabot` deve listar só #3, #4 e #6; se algum dos 7 seguir aberto, rodar `gh pr close <n> --comment "Incluido no PR #<N>"`. No `gh run view <id-do-run-da-main> --json jobs`, os 4 jobs de gate devem dar success; 'Publicar na Render' em failure é esperado enquanto não houver secret. Na Render, em Events, o commit de merge deve chegar a 'Deploy live'. Repetir o curl do passo 7: /health {"ok":true}, POST /v1/proofs/sign-upload sem token 401 e POST /v1/justifications/sign-upload sem token 401. Rollback, se preciso: Render > Deploys > Rollback. No Git, `git revert -m 1 <merge-sha>` num novo PR, nunca force push.

### Passo 13

snake-server: fechar os majors conforme a decisão 4, com `gh pr comment 3 --repo yagoriccomi/snake-server --body "@dependabot ignore this major version"` e o mesmo comando para o #4 e o #6.

**Como verificar:** Depois de alguns minutos, `gh pr view 3|4|6 --json state` deve dar CLOSED; `gh pr list --repo yagoriccomi/snake-server --state open` deve voltar vazio; `git ls-remote --heads origin 'dependabot/*'` deve voltar vazio, porque o Dependabot apaga as próprias branches.

### Passo 14

snake-server: apagar as branches remotas. Antes, confirmar que aparecem em `git branch -r --merged origin/main` depois do `git fetch --prune origin`. Depois rodar `git push origin --delete chore/dependencias-e-p19 feature/comprovantes-cloudinary feature/modulo-justificativas feature/servidor-docker`.

**Como verificar:** `git ls-remote --heads origin` deve listar só refs/heads/main.

### Passo 15

snake-server: atualizar a main local e apagar as branches locais. Rodar `git switch main`, `git pull --ff-only origin main` (a main local está 38 commits atrás, fora o que entrou agora) e `git fetch --prune origin`. Depois, `git branch -d chore/dependencias-e-p19 chore/p19-resolvida feature/comprovantes-cloudinary feature/modulo-justificativas feature/servidor-docker`. A feature/comprovantes-cloudinary só sai depois do prune do upstream, porque está 6 commits à frente dele. Nunca usar -D.

**Como verificar:** `git branch -vv` deve mostrar só main, sincronizada com origin/main; `npm ci && npm test` verde; `git log --oneline -1` deve ser o merge do PR.

### Passo 16

Opcional, se a decisão 5 for aprovada: ativar a exclusão automática de branch após merge com `gh repo edit yagoriccomi/snake-thai --delete-branch-on-merge` e `gh repo edit yagoriccomi/snake-server --delete-branch-on-merge`.

**Como verificar:** `gh api repos/yagoriccomi/<repo> --jq .delete_branch_on_merge` deve dar true nos dois.

### Passo 17

Fechamento. Conferir o estado final dos dois repos e avisar as outras tarefas (T1..T11) que as branches novas devem nascer da main atualizada, com nomes novos. Não reaproveitar branch já mesclada, que foi a causa dos 10 commits órfãos da papel-professor.

**Como verificar:** Nos dois repos: `gh pr list --state open` vazio (salvo PRs novos do Dependabot); `git ls-remote --heads origin` só main; no snake-thai, `git merge-base --is-ancestor v1.6.0 origin/main` = OK; `git status -sb` = '## main...origin/main' nos dois.

## 6. Riscos

- Todo merge na main do snake-server provavelmente vira deploy imediato em produção pelo Auto-Deploy da Render, que diverge do render.yaml. O /health só devolve {ok:true} e não mostra o commit. Mitigação: confirmar no painel antes, acompanhar Events e deixar pronto o Rollback da Render.
- O job 'Publicar na Render' vai continuar vermelho em todo merge (falta o RENDER_DEPLOY_HOOK_URL). Se alguém configurar esse secret com o Auto-Deploy ligado, cada merge vira dois deploys.
- O Dependabot pode fazer rebase ou recriar os PRs antes da execução e mudar os SHAs dos heads. Por isso o passo 1 compara os SHAs e refaz a simulação.
- Ao combinar as mudanças de lockfile do #13 e do #11, o package-lock pode ficar inconsistente mesmo sem conflito textual. O `npm ci` do passo 9 e o CI do PR pegam isso.
- As actions v7/v4 foram validadas só nos PRs, que rodaram em 2026-09-01 em runners hospedados pelo GitHub. O Dependabot de github-actions tem limite padrão de 5 PRs abertos, então novos PRs (por exemplo, upload-artifact) podem surgir no próximo ciclo mensal.
- Se o GitHub não marcar os 7 PRs do Dependabot como mesclados, eles ficam abertos até serem fechados manualmente (tratado no passo 12).
- Depois do merge, a main do snake-thai continua com CI vermelho por causa do teste SQL desatualizado (regressao_c3_payment_whitelist.sql). Não bloqueia, porque não há proteção de branch e o usuário disse para esquecer o CI, mas esconde regressões reais do banco.
- Um `git push` sem argumentos na chore/p19-resolvida (que rastreia origin/main) pode ser recusado ou mandar para o lugar errado. Use sempre refspec explícito.
- Apagar branches remotas é difícil de desfazer pela interface. Os commits continuam alcançáveis pela main e pela tag, e dá para recriar a partir dos SHAs deste plano (ex.: feat/auth-onboarding 23dc2c1, feat/papel-professor 6a99b40).
- Não consegui verificar se há integração GitHub da Supabase que aplique migrations no merge da main do snake-thai. Se houver e a migration 20260914190000 tiver sido aplicada fora do `supabase db push`, pode haver tentativa de reaplicação em produção.
- A tarefa de tirar a chave de debug do release pode querer mexer na tag v1.6.0. Este plano não reescreve nem move tags, e qualquer mudança nelas fica para a outra tarefa, sem force push.

## 7. Ajustes do revisor crítico

- **Conflito com T2:** A T4 (passo 5, verificação) exige que 'gh release view v1.6.0' continue mostrando o asset do APK. A T2 (passo 2) apaga esse asset. A ordem entre as duas decide qual verificação falha.  
  **Resolução:** Executar a T4 fase 1 antes da retirada do asset e trocar a verificação da T4 por 'a tag v1.6.0 e o release existem', sem depender do asset.
- **Conflito com T1, T5:** A T1 renomeia o .env do app para .env.prod e passa a usar EXPO_NO_DOTENV=1. A T4 (passo 7) lê a URL da API de produção com '. snake-thai/.env', e o comando quebra se a T1 vier antes. A T5 grava '.env' no CI, arquivo que o fluxo da T1 deixa de ler.  
  **Resolução:** Na T4 fase 2, ler .env.prod se existir e .env caso contrário, ou rodar a fase 2 antes do rename da T1. Na T5, gravar .env.prod e usar with-variant.js (ver conflito de nomes da variante).
- **Afirmação a conferir:** 'O commitlint aceita a mensagem padrão Merge remote-tracking branch ...' nos merges locais dos PRs do Dependabot.  
  **Por quê:** Não foi testado. A T4 já prevê a alternativa '-m chore(deps): ...', mas a execução pode parar no hook sem aviso prévio. Os hooks do snake-server não foram lidos nesta revisão.
- **Decisão consolidada (T4 (e todas as tarefas)):** Autorização de push, PR, merge e exclusão de branches, e estratégia de merge.  
  **Recomendação:** Autorizar por fase (snake-thai primeiro, sem efeito em produção; snake-server depois de conferir o Auto-Deploy) e usar sempre merge commit, nunca squash ou rebase, para manter as tags na main. A regra vale para as branches novas de T1 a T11.
- **Decisão consolidada (T4):** PRs majors do Dependabot (#3 vitest 4, #4 TypeScript 7, #6 @eslint/js 10) e job 'Publicar na Render'.  
  **Recomendação:** Fechar os três com '@dependabot ignore this major version' e registrar como P-20. Se o Auto-Deploy estiver ligado, manter assim, não configurar o deploy hook e corrigir a documentação.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T4.md` escrito
