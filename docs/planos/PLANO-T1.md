# PLANO DE EXECUÇÃO — T1: Separar desenvolvimento de produção: app "DEV Snake Thai" + Supabase local em Docker + snake-server de dev

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T1` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/ambiente-dev (snake-thai) e chore/ambiente-dev-local (snake-server)` |
| **Esforço** | G |
| **Depende de** | nenhuma |

## 1. Enunciado

Hoje não existe ambiente de desenvolvimento. O .env do app e o do snake-server apontam para o Supabase de produção, todas as migrations e seeds rodaram direto lá, e a senha das contas de demonstração está no repositório público. O plano cria uma variante DEV do app (package com.snakethai.app.dev, instalável ao lado da de produção, com o .env escolhido por variante e HTTP liberado só para o loopback) e sobe o banco de dev com a stack local da Supabase CLI (Postgres 17, igual à produção, em portas que não conflitam com o outro projeto que já roda na máquina). Também liga o snake-server local a esse banco com uma Cloudinary separada e inverte o fluxo: migration primeiro no local, depois em produção, por um script protegido.

## 2. Terreno (situação verificada)

- O app tem uma identidade só, sem app.config.js e sem conceito de variante. Nome, package e scheme são fixos.  
  _Evidência:_ app.json:3 "name": "Snake Thai", :7 "scheme": "snakethai", :17 "package": "com.snakethai.app". Não existe app.config.js na raiz (ls).
- O .env do app aponta para produção, tanto o Supabase quanto a API da Render. Ainda carrega nomes de variáveis obsoletas.  
  _Evidência:_ Nomes lidos sem imprimir valores: EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co e EXPO_PUBLIC_API_URL=https://<ref>.onrender.com. EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME e EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET também existem no .env, mas o README as marca como removidas.
- env.ts só valida URL e chave, e não tem trava contra apontar para o ambiente errado.  
  _Evidência:_ src/config/env.ts:45-58 (supabaseUrl, supabaseAnonKey, apiUrl opcional).
- O Expo carrega .env.<NODE_ENV>, .env.local e .env, não sobrescreve variável que já está no processo e aceita EXPO_NO_DOTENV. Por isso arquivos nomeados pelo NODE_ENV não servem para variante: o build release de DEV rodaria com NODE_ENV=production.  
  _Evidência:_ node_modules/@expo/env/build/index.js:84-86 (EXPO_NO_DOTENV), :96-124 (lista por NODE_ENV), :228 (não sobrescreve o ambiente).
- O menu.bat só conhece uma variante: confere apenas o .env, faz adb reverse só da porta do Metro e o [9] instala primeiro o APK debug.  
  _Evidência:_ menu.bat:529-538 (:CHECK_ENV), :546-555 (:ADB_REVERSE só %METRO_PORT%), :272-276 (escolha do APK), :599-625 (:GRADLE_BUILD).
- scripts/dev.bat nunca sobe o banco local, porque procura a CLI no PATH e ela só existe via npx.  
  _Evidência:_ scripts/dev.bat:17 `where supabase` → 'não foi possível localizar'. `npx --no-install supabase --version` → 2.117.0.
- config.toml usa Postgres 15, mas a produção é 17.  
  _Evidência:_ supabase/config.toml:16 major_version = 15. supabase/.temp/postgres-version = 17.6.1.155. O CI de 14/09 baixou ghcr.io/supabase/postgres:15.8.1.085.
- Há conflito de portas: a stack Supabase de outro projeto (radar-tributario) está rodando nas portas padrão que o config.toml do snake-thai usa.  
  _Evidência:_ docker ps: supabase_kong_radar-tributario 0.0.0.0:54321, supabase_db 0.0.0.0:54322, studio 54323, inbucket 54324, analytics 54327. config.toml:8,14,20 usa 54321/54322/54323.
- Existe um volume local antigo do snake-thai, provavelmente em PG15, e nenhum container do snake-thai está rodando.  
  _Evidência:_ docker volume inspect supabase_db_snake-thai → CreatedAt 2026-09-03. docker ps -a sem containers 'snake'.
- A CLI está vinculada ao projeto de produção, e `db push` usa o projeto vinculado.  
  _Evidência:_ supabase/.temp/linked-project.json ref fmmftavduunrjnbbtfmf. docs/RUNBOOK.md:53-63 manda rodar `supabase db push` direto no remoto.
- As 26 migrations constroem o esquema do zero, ao menos em PG15.  
  _Evidência:_ gh run view 34896039860 (14/09): 'Applying migration 20260727130000_init_schema.sql' até '20260914190000_chamada_em_lote.sql' e 'Seeding data from supabase/seed.sql' sem erro, no passo `supabase db start` do job banco.
- Não achei dependência de objeto criado fora das migrations. O bucket, o pg_cron e os 3 jobs estão em migration, e não há pg_net, vault nem auth hook. Só dá para confirmar drift de produção com acesso a ela.  
  _Evidência:_ 20260727130100:15-17 cria o bucket payment_proofs. 20260727160100:31-43 cria o pg_cron só se disponível, mas 20260904200000:241 e 20260914140000:305 chamam cron.schedule sem condição (a imagem Supabase tem pg_cron). 20260819150000:60 cria a linha de academy_settings. O grep por pg_net/vault/hook/custom_access_token não achou nada. Toda tabela public.* referenciada tem create table numa migration.
- A suíte SQL está quebrada, e é por isso que o CI falha em todo push: o primeiro teste insere pagamento sem reference_month.  
  _Evidência:_ CI 34896039860: 'regressao_c3_payment_whitelist.sql:19: ERROR: null value in column "reference_month"'. gh run list mostra as 8 últimas execuções em failure.
- Os testes SQL são scripts psql (\set ON_ERROR_STOP, begin/rollback), mas o host não tem psql. Parte deles conta linhas no banco inteiro.  
  _Evidência:_ supabase/tests/*.sql linha 3-5 e rollback no final. `where psql` → não encontrado. regressao_frequencia_regras.sql:321-345 e regressao_mensalidades.sql:147-154 contam globalmente, então exigem banco sem as seeds de demo.
- As seeds de demo dependem de dados que nenhuma migration ou seed cria: contas @snake.com, turmas e plano ativo.  
  _Evidência:_ demo_seed.sql:89 professor@snake.com; demo_seed_historico.sql:312 caloteiro@snake.com; demo_seed.sql:179-180 usam public.groups e public.plans (limit 1). supabase/seed.sql só tem comentários.
- Os dados fictícios foram gravados em produção com senha literal, e essa senha está na main do repositório PÚBLICO.  
  _Evidência:_ demo_seed_historico.sql:13 'gravados direto em produção'. demo_seed.sql:9,60,157 trazem a senha literal (3 ocorrências em origin/main). gh repo view → visibility PUBLIC. O default de academy_settings.default_student_password também está em migration pública (20260819150000).
- O release não permite HTTP em texto claro, e um DEV standalone apontando para http://127.0.0.1 seria bloqueado.  
  _Evidência:_ android/app/src/debug/AndroidManifest.xml:6 e debugOptimized têm usesCleartextTraffic="true". O src/main/AndroidManifest.xml não tem cleartext nem networkSecurityConfig.
- O plugin de assinatura vale para qualquer build que tenha RELEASE_STORE_FILE, e hoje o android/gradle.properties não tem nenhuma propriedade RELEASE_*.  
  _Evidência:_ plugins/withReleaseSigning.js:33,47-48. grep em android/gradle.properties sem RELEASE_*.
- Sem EXPO_PUBLIC_API_URL, o comprovante cai no Supabase Storage (funciona no local), mas o anexo de justificativa falha.  
  _Evidência:_ src/services/proofs.service.ts:96-106 e src/services/justifications.service.ts:80-82 (AnexoIndisponivelError).
- O app não usa realtime, mas usa Edge Functions e Storage.  
  _Evidência:_ grep sem .channel/postgres_changes. profile.service.ts:110,165,237 usam functions.invoke. proofs.service.ts:176 usa storage.
- O snake-server de dev também aponta para produção e foi feito sem banco local. As pastas da Cloudinary estão fixas no código.  
  _Evidência:_ docker-compose.yml:5-7 ('NÃO há banco… Supabase remoto'), :20-21 env_file .env, :28 porta 127.0.0.1:3000. O .env tem SUPABASE_URL=https://<ref>.supabase.co. src/config/env.ts:37-43 aceita qualquer URL, inclusive http. proofs.constants.ts:10 'comprovantes', justifications.constants.ts:10 'justificativas'.
- No snake-server, a main local está atrás e há uma branch não enviada.  
  _Evidência:_ git rev-list: main..origin/main = 38; origin/main..chore/p19-resolvida = 1.
- O celular não estava conectado no adb durante a verificação. Os pacotes instalados nele não foram conferidos.  
  _Evidência:_ `adb devices` → lista vazia.

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Portas do Supabase local do snake-thai: a stack do radar-tributario já ocupa 54321-54327.**

- Mover o snake-thai para 55320-55329 (api 55321, db 55322, studio 55323, inbucket 55324, pooler 55329) e trocar uma linha do ci.yml (porta 54322 do psql) para o job existente não quebrar
- Manter as portas padrão e parar o radar-tributario (npx supabase stop no outro projeto) sempre que for trabalhar no snake-thai

➡️ _Adotado:_ Mover para 553xx. As duas stacks convivem e não é preciso lembrar de parar a outra. Mexer no ci.yml aqui só corrige a porta do job que já existe, não adiciona teste.

**P2. Como o celular chega no Supabase local e no snake-server local?**

- adb reverse (tcp:55321 e tcp:3000), com o app usando http://127.0.0.1. Funciona pelo ADB Wi-Fi que você já usa, e o menu.bat reaplica
- IP da rede local (http://192.168.x.x:55321) embutido no APK DEV, com regra no firewall do Windows e IP fixo reservado no roteador

➡️ _Adotado:_ adb reverse. O IP não fica embutido no APK, não abre portas na rede e o cleartext fica limitado a 127.0.0.1/localhost. A limitação é que o DEV só funciona com o PC por perto e o adb conectado.

**P3. Qual Cloudinary o snake-server de dev deve usar?**

- Um 'product environment' separado na mesma conta (ex.: snake-thai-dev), com credenciais próprias
- Uma conta gratuita separada só para dev
- A mesma conta de produção com prefixo de pasta (exige mudar o código de proofs/justifications e ainda usaria as credenciais de produção)
- Nenhuma por enquanto: DEV sem EXPO_PUBLIC_API_URL (comprovante vai para o Storage local; anexo de justificativa fica indisponível)

➡️ _Adotado:_ Product environment separado. Não muda código e as credenciais ficam isoladas, então o dev nunca apaga asset de produção. Se o plano gratuito não permitir mais de um ambiente (é suposição, confira no painel), use uma conta separada.

**P4. Como marcar visualmente o app DEV além do nome 'DEV Snake Thai'?**

- Trocar só a cor de fundo do ícone adaptativo (ex.: laranja) e mostrar uma faixa 'DEV · banco local' dentro do app. Não precisa de arte nova
- Ícone desenhado com faixa 'DEV' (arquivos novos em assets/dev/), mais a faixa dentro do app

➡️ _Adotado:_ Cor de fundo mais faixa no app. Resolve hoje sem depender de arte. O ícone desenhado pode vir depois.

**P5. Qual variante vale quando APP_VARIANT não é informado?**

- production (builds e automações futuras continuam como estão; sem .env.prod carregado, o app falha no boot em vez de cair no banco errado)
- development

➡️ _Adotado:_ production, com o .env antigo renomeado para .env.prod. O Expo não carrega esse nome sozinho, então um `npx expo start` sem o script falha de forma explícita.

**P6. O que fazer com os dados fictícios que hoje estão em PRODUÇÃO (50 alunos e 4 professores @demo.snakethai.com, contas de teste @snake.com, 3 meses de histórico) e cuja senha está no repositório público?**

- A) Já: trocar a senha das contas de demo e de teste em produção e manter os dados até o go-live. No go-live, rodar a opção B
- B) Limpar já: backup, demo_seed_limpar.sql e remoção das contas de teste @snake.com (menos a sua conta real de admin)
- C) Zerar produção (supabase db reset --linked). Destrutivo, apaga inclusive a sua conta de admin, e só serve se não houver nenhum dado real
- D) Manter como está (não recomendado: qualquer pessoa que leia o repositório entra como professor de demo)

➡️ _Adotado:_ A agora e B antes de cadastrar o primeiro aluno real. Com o DEV pronto, as demonstrações passam a rodar no banco local. Informe também qual e-mail é a sua conta real de admin, para ela nunca entrar na limpeza.

## 4. Ações que só o usuário pode fazer

- [ ] Autorizar e rodar você mesmo, com o seu token, a verificação SOMENTE LEITURA de produção: `npx supabase migration list --linked` (esperado: 26 aplicadas) e `npx supabase db diff --linked --schema public,storage` (esperado: nenhuma diferença). Eu não posso acessar produção.
- [ ] Criar o ambiente Cloudinary de dev (product environment ou conta) e colar as 3 credenciais direto em snake-server/.env.dev, nunca no chat.
- [ ] Renomear o seu .env do app para .env.prod, ou autorizar que eu faça isso (o arquivo é local e o valor não é exibido).
- [ ] Conectar o Samsung pelo ADB Wi-Fi (menu [2]) na hora de instalar e testar o DEV ao lado do app de produção.
- [ ] Antes de qualquer limpeza em produção: `npx supabase db dump --linked -f <pasta fora do repo>\snake-prod-schema.sql` e `npx supabase db dump --linked --data-only -f <pasta fora do repo>\snake-prod-data.sql`.
- [ ] Executar em produção (SQL Editor ou psql com a sua connection string) a troca de senha ou a limpeza das contas de demo, conforme a decisão, e informar qual e-mail é a sua conta real de admin.
- [ ] Aprovar explicitamente cada `scripts\db-push-prod.bat` (push de migration em produção) no fluxo novo.

## 5. Passos atômicos

### Passo 1

Preparar as branches sem mexer em produção. No snake-thai: `git fetch origin`; `git switch feat/papel-professor`; `git pull --ff-only`; `git switch -c feat/ambiente-dev` (se a tarefa de merge já tiver levado feat/papel-professor para a main, crie a partir de origin/main). No snake-server: `git fetch origin`; `git switch -c chore/ambiente-dev-local origin/main`, sem tocar em chore/p19-resolvida nem na main local desatualizada.

**Como verificar:** `git status -sb` limpo nos dois repositórios. `git log --oneline -1` mostra a base esperada. No snake-server, `git rev-list --count origin/main..HEAD` = 0.

### Passo 2

Alinhar o supabase/config.toml à produção e às portas livres. Mudanças: [db] major_version = 17, port = 55322, shadow_port = 55320; [db.pooler] enabled = false, port = 55329; [api] port = 55321; [studio] port = 55323; [inbucket] enabled = true, port = 55324; [analytics] enabled = false e [realtime] enabled = false (o app não usa realtime; poupa RAM com duas stacks no ar); [edge_runtime] enabled = true, policy = "per_worker", inspector_port = 8093; [auth] additional_redirect_urls = ["snakethai://", "snakethai-dev://"]. Manter [db.seed] sql_paths = ["./seed.sql"] para não mudar o CI. Em .github/workflows/ci.yml, trocar apenas 127.0.0.1:54322 por 127.0.0.1:55322 na linha do psql. Depois, na pasta snake-thai: `npx supabase stop --no-backup` (descarta o volume local antigo de 03/09, que não é produção) e `npx supabase start`.

_Arquivos:_ `supabase/config.toml`, `.github/workflows/ci.yml`

**Como verificar:** `npx supabase status` mostra API http://127.0.0.1:55321 e DB na 55322. `docker ps --filter name=snake-thai` com containers healthy, e os do radar-tributario continuam Up. `docker exec supabase_db_snake-thai psql -U postgres -c "select version()"` mostra PostgreSQL 17. `docker exec supabase_db_snake-thai psql -U postgres -c "select jobname, schedule from cron.job order by 1"` lista close-monthly-attendance, generate-monthly-payments e mark-overdue-payments. `... -c "select id from storage.buckets"` mostra payment_proofs. `npx supabase migration list --local` lista as 26. `curl -i http://127.0.0.1:55321/functions/v1/create-student` responde 401 (Edge Function servida localmente).

### Passo 3

Checar a paridade de esquema sem tocar produção. Gerar os tipos a partir do banco local e comparar com os tipos versionados, que foram gerados da produção: `npx supabase gen types typescript --local > %TEMP%\db-local.types.ts` e depois `git diff --no-index --stat src/types/database.types.ts %TEMP%/db-local.types.ts`. Qualquer diferença é drift e tem que ser investigada antes de seguir. Complementa a verificação somente leitura que você roda (migration list e db diff --linked).

_Arquivos:_ `src/types/database.types.ts`

**Como verificar:** Diff vazio, ou só diferenças explicáveis (ex.: ordem). Qualquer tabela, coluna ou função a mais de um lado vira item bloqueante, registrado antes do passo 12.

### Passo 4

Corrigir o teste SQL desatualizado e criar o executor local da suíte. Em supabase/tests/regressao_c3_payment_whitelist.sql:17-19, incluir reference_month no insert de payments (ex.: date_trunc('month', current_date)::date). Criar scripts/db-dev.bat e scripts/db-dev.sh com os subcomandos start | stop | status | reset | test | types | env. O `test` roda `npx supabase db reset --local` (só seed.sql, banco limpo, porque alguns testes contam linhas no banco inteiro) e, para cada supabase\tests\*.sql, `docker exec -i supabase_db_snake-thai psql -U postgres -d postgres -v ON_ERROR_STOP=1 < arquivo`, parando no primeiro erro. Ajustar scripts/dev.bat:17 e dev.sh:18 para usar `npx supabase` em vez de exigir a CLI no PATH.

_Arquivos:_ `supabase/tests/regressao_c3_payment_whitelist.sql`, `scripts/db-dev.bat`, `scripts/db-dev.sh`, `scripts/dev.bat`, `scripts/dev.sh`

**Como verificar:** `scripts\db-dev.bat test` termina com código 0 e cada arquivo imprime só NOTICEs 'OK Tn'. Depois: `docker exec supabase_db_snake-thai psql -U postgres -c "select count(*) from auth.users where email like '%@t.invalid'"` = 0, confirmando que os rollbacks funcionaram.

### Passo 5

Criar a seed base local e travas nas seeds de demo. Novo supabase/seed/local_base.sql: aborta com raise exception se auth.users já tiver qualquer linha (só roda em banco recém-resetado, nunca em produção); cria 1-2 planos ativos (price_cents, billing_period 'monthly', due_day 10), 3 turmas e as contas adm@snake.com (admin), professor@snake.com (professor, com cor), aluno@snake.com e caloteiro@snake.com (user, com turma e plano), com senha só local documentada no RUNBOOK e diferente da de produção. Usar o mesmo padrão de insert em auth.users de demo_seed.sql:44-64, com colunas de token em string vazia. Em demo_seed.sql e demo_seed_historico.sql, logo depois do begin, adicionar um bloco que aborta se existir conta fora de @demo.snakethai.com, @snake.com e @t.invalid, para que as seeds de demo não rodem mais num banco com gente real. O subcomando `reset` do db-dev roda `npx supabase db reset --local --sql-paths ./seed.sql --sql-paths ./seed/local_base.sql --sql-paths ./seed/demo_seed.sql --sql-paths ./seed/demo_seed_historico.sql`. Se a CLI não aceitar begin/commit ou tabela temporária nas seeds, usar como alternativa `docker exec -i supabase_db_snake-thai psql` arquivo a arquivo.

_Arquivos:_ `supabase/seed/local_base.sql`, `supabase/seed/demo_seed.sql`, `supabase/seed/demo_seed_historico.sql`, `scripts/db-dev.bat`, `scripts/db-dev.sh`

**Como verificar:** `scripts\db-dev.bat reset` termina sem erro. `docker exec supabase_db_snake-thai psql -U postgres -c "select role, count(*) from public.profiles group by 1"` → admin 1, professor 5, user ≥ 50. `... -c "select count(*) from public.classes where attendance_taken_at is not null"` > 0. Rodar o reset duas vezes dá as mesmas contagens. O login local funciona: `curl -s -o NUL -w "%{http_code}" -X POST "http://127.0.0.1:55321/auth/v1/token?grant_type=password" -H "apikey: <anon local>" -H "Content-Type: application/json" -d "{...adm@snake.com...}"` → 200, sem imprimir o token. Rodar local_base.sql uma segunda vez sem reset aborta com a mensagem da trava.

### Passo 6

Criar app.config.js para a variante, mantendo o app.json como base e fonte única da versão. `module.exports = ({ config }) => {...}` lê APP_VARIANT ('development' | 'production', padrão conforme a decisão) e lança erro para qualquer outro valor. Em development: name 'DEV Snake Thai', android.package e ios.bundleIdentifier 'com.snakethai.app.dev', scheme 'snakethai-dev', adaptiveIcon sem backgroundImage e com backgroundColor de destaque, plugins sem './plugins/withReleaseSigning.js' (DEV sempre com a chave de debug) e com './plugins/withDevCleartext.js', extra.appVariant. Em production, config idêntica ao app.json atual. Trava de build: production com EXPO_PUBLIC_SUPABASE_URL http:// ou host local lança erro; development com host *.supabase.co ou *.onrender.com também. Novo plugins/withDevCleartext.js: withAndroidManifest põe android:networkSecurityConfig="@xml/network_security_config" em <application>, e withDangerousMod grava android/app/src/main/res/xml/network_security_config.xml com base-config cleartextTrafficPermitted="false" e domain-config cleartextTrafficPermitted="true" só para 127.0.0.1 e localhost.

_Arquivos:_ `app.config.js`, `plugins/withDevCleartext.js`, `app.json`

**Como verificar:** `node scripts/with-variant.js dev -- npx expo config --type public --json` mostra name 'DEV Snake Thai', android.package 'com.snakethai.app.dev' e scheme 'snakethai-dev'. Com `prod`, os campos batem com o app.json atual (name 'Snake Thai', com.snakethai.app, snakethai). `npx expo config --type prebuild --json` na variante dev lista withDevCleartext e não withReleaseSigning, e na prod o contrário. `$env:APP_VARIANT='xyz'; npx expo config` falha com mensagem clara.

### Passo 7

Selecionar o .env pela variante sem depender do NODE_ENV. Novo scripts/with-variant.js, uso `node scripts/with-variant.js <dev|prod> -- <comando...>`: lê .env.dev ou .env.prod (KEY=VALUE, ignora comentários), exige EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY, define APP_VARIANT, EXPO_PUBLIC_APP_VARIANT e EXPO_NO_DOTENV=1, executa o comando com stdio herdado e devolve o código de saída. Novo scripts/gerar-env-dev.js (subcomando `env` do db-dev): lê `npx supabase status -o json` e grava .env.dev com EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321, EXPO_PUBLIC_SUPABASE_ANON_KEY com a chave anon local (confira o nome do campo no JSON da 2.117) e EXPO_PUBLIC_API_URL=http://127.0.0.1:3000, ou vazio conforme a decisão da Cloudinary. Localmente, `move .env .env.prod`. Reescrever o .env.example para documentar .env.dev e .env.prod, dizer que o .env simples não é mais lido e remover as variáveis obsoletas. Em package.json: start:dev, start:prod, db:start, db:reset, db:test, env:dev, e trocar supabase:types para `npx supabase gen types typescript --local > src/types/database.types.ts`. O .gitignore já cobre .env.* (linhas 25-27), sem mudança.

_Arquivos:_ `scripts/with-variant.js`, `scripts/gerar-env-dev.js`, `.env.example`, `package.json`, `.env.prod (local, não versionado)`, `.env.dev (local, não versionado)`

**Como verificar:** `node scripts/with-variant.js dev -- node -e "console.log(process.env.APP_VARIANT, new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).host)"` → 'development 127.0.0.1:55321'. Com prod → 'production <ref>.supabase.co' (só o host, sem chave). Sem .env.dev: erro claro e código ≠ 0. `git check-ignore -v .env.dev .env.prod` mostra os dois ignorados. `npx expo start` sem o script falha no boot pelo fail-fast do env.ts, como esperado.

### Passo 8

Adicionar variante e trava de runtime no app, mais a faixa visual. Em src/config/env.ts: exportar a função pura `validarAmbiente(bruto)` e o campo `appVariant` (de EXPO_PUBLIC_APP_VARIANT). Em production, Supabase e API precisam de https com host público. Em development, o host precisa ser 127.0.0.1, localhost ou IP privado, e *.supabase.co é proibido. Novo src/components/DevBanner.tsx: faixa 'DEV · banco local', accessibilityRole 'text' e rótulo descritivo, renderizada no App.tsx só quando env.appVariant === 'development'. Testes com Jest/RNTL: src/config/__tests__/env.test.ts cobre as regras chamando validarAmbiente direto (sem depender do inline de process.env) e src/components/__tests__/DevBanner.test.tsx. Atualizar o mock de '@/config/env' em src/lib/__tests__/api.test.ts se o tipo mudar.

_Arquivos:_ `src/config/env.ts`, `src/config/__tests__/env.test.ts`, `src/components/DevBanner.tsx`, `src/components/__tests__/DevBanner.test.tsx`, `App.tsx`, `src/lib/__tests__/api.test.ts`

**Como verificar:** `npm run typecheck` sem erros. `npm test` passa com os 324 testes atuais mais os novos, incluindo: production com http:// lança erro; development com *.supabase.co lança erro; o banner não aparece em production. O pre-commit do Husky passa no commit.

### Passo 9

Levar a variante e o banco para o menu.bat. Estado VARIANTE (padrão DEV no menu) mostrado no cabeçalho, com opção [V] para alternar. [1] Metro, [P] prebuild, [8] e [5] builds rodam via `node scripts\with-variant.js %VARIANTE% -- ...`. O prebuild grava o marcador android\.variante e, se a variante pedida for diferente, roda `npx expo prebuild --platform android --clean` (packageId, nome, manifesto e ícone mudam). :CHECK_ENV confere .env.dev ou .env.prod. :ADB_REVERSE, em DEV, também faz reverse de tcp:55321 e tcp:3000. :GRADLE_BUILD copia a saída para release\snake-thai-dev-v<versão>.apk ou release\snake-thai-v<versão>.apk (versão lida do app.json). [9] instala o APK da variante atual. Seção BANCO LOCAL nova: [B] subir (db-dev start), [R] resetar com seeds (db-dev reset), [T] testes SQL (db-dev test), [S] parar. Diagnóstico novo `menu.bat --variant`.

_Arquivos:_ `menu.bat`

**Como verificar:** `menu.bat --device` continua imprimindo CONEXOES/ALVO/PORTA_METRO. `menu.bat --variant` imprime VARIANTE e se o .env correspondente existe. Manual: [V] troca o cabeçalho entre DEV e PROD. [B] sobe a stack e [T] termina com código 0.

### Passo 10

Gerar e instalar o APK DEV ao lado do de produção. Pelo menu: [V]=DEV → [B] → [R] → [P] (prebuild --clean) → [5] release standalone (~17 min) → [2] conectar → [9] instalar, com o reverse das portas 55321 e 3000 aplicado. Equivalente cru: `node scripts\with-variant.js dev -- npx expo prebuild --platform android --clean`; `node scripts\with-variant.js dev -- cmd /c "cd android && gradlew.bat assembleRelease -PreactNativeDevServerPort=6969"`; `adb reverse tcp:55321 tcp:55321`; `adb reverse tcp:3000 tcp:3000`; `adb install -r release\snake-thai-dev-v1.6.0.apk`. Depois voltar para PROD ([V], [P] --clean) para garantir que o android/ fica na variante de produção.

_Arquivos:_ `release/snake-thai-dev-v1.6.0.apk (não versionado)`

**Como verificar:** `adb shell pm list packages | findstr snakethai` lista com.snakethai.app e com.snakethai.app.dev. No launcher aparecem 'Snake Thai' e 'DEV Snake Thai' com ícones diferentes. O DEV mostra a faixa e loga com adm@snake.com na senha local, com 50 alunos de demo. Criar uma turma no DEV e conferir com `docker exec supabase_db_snake-thai psql -U postgres -c "select name from public.groups order by created_at desc limit 1"`. O app de produção continua abrindo com os dados de produção. No APK: `aapt2 dump xmltree --file AndroidManifest.xml release\snake-thai-dev-v1.6.0.apk | findstr networkSecurityConfig` encontra o atributo; no APK de produção, nada. `aapt2 dump badging <apk> | findstr package:` mostra o package certo em cada um.

### Passo 11

Ligar o snake-server de dev ao Supabase local e à Cloudinary de dev. Em docker-compose.yml: env_file .env.dev (o docker-compose.prod.yml segue com .env), extra_hosts - 'host.docker.internal:host-gateway', e reescrever o comentário das linhas 5-7 (agora há banco local, via Supabase CLI do snake-thai). Em scripts/dev.bat e dev.sh, start/stop/restart/status/logs/shell exigem .env.dev e prod/prod-stop exigem .env. Em .env.example, novo bloco 'Local': SUPABASE_URL=http://host.docker.internal:55321, SUPABASE_ANON_KEY (a chave anon que `npx supabase status` mostra na pasta snake-thai) e credenciais do ambiente Cloudinary de dev. No README, seção 'Ambiente local com Supabase local', seguindo o protocolo de README. Você preenche o .env.dev com as credenciais da Cloudinary de dev.

_Arquivos:_ `../snake-server/docker-compose.yml`, `../snake-server/scripts/dev.bat`, `../snake-server/scripts/dev.sh`, `../snake-server/.env.example`, `../snake-server/README.md`, `../snake-server/.env.dev (local, não versionado)`

**Como verificar:** `scripts\dev.bat start` e `docker compose ps` com api healthy. `curl -s -o NUL -w "%{http_code}" http://127.0.0.1:3000/health` → 200. `docker compose exec api node -e "fetch(process.env.SUPABASE_URL+'/auth/v1/health',{headers:{apikey:process.env.SUPABASE_ANON_KEY}}).then(r=>console.log(r.status))"` → 200. Ponta a ponta: no app DEV, enviar uma justificativa com imagem; o asset aparece em justificativas/<uid>/ na Media Library do ambiente Cloudinary de DEV e não aparece no de produção. `npm test` do snake-server segue verde. Confirmar que o /auth/v1/user aceita o token emitido para 127.0.0.1 quando chamado via host.docker.internal; se falhar por issuer, registrar e usar alternativa.

### Passo 12

Formalizar o fluxo novo de migrations (local primeiro) e proteger o caminho para produção. Novo scripts/db-push-prod.bat: mostra o ref vinculado, pede para digitar PRODUCAO, roda `npx supabase db push --linked --dry-run`, pede confirmação de novo e só então roda `npx supabase db push --linked`. Todos os outros scripts passam --local explicitamente. Documentar o fluxo: 1) `npx supabase migration new <nome>`; 2) `scripts\db-dev.bat test`, que reseta e roda a suíte; 3) `scripts\db-dev.bat reset` com seeds e teste no app DEV; 4) `npm run supabase:types` (local) e commit; 5) PR e merge; 6) com a sua aprovação, `scripts\db-push-prod.bat`; 7) se mudou Edge Function, `npx supabase functions deploy <nome>`; 8) `npx supabase migration list --linked` para conferir. Atualizar README.md (variáveis por variante, comandos, banco local, dados de demo só no local, remover o `psql "$DATABASE_URL" -f demo_seed.sql` voltado a produção), docs/RUNBOOK.md (seções 'Ambientes DEV x PROD', 'Migrations: local primeiro', portas 553xx e reverse), docs/ARQUITETURA.md (ambientes) e CLAUDE.md §2 e §8 (tipos --local, variantes, portas).

_Arquivos:_ `scripts/db-push-prod.bat`, `README.md`, `docs/RUNBOOK.md`, `docs/ARQUITETURA.md`, `CLAUDE.md`

**Como verificar:** Testar só o caminho de recusa: rodar scripts\db-push-prod.bat e digitar outra coisa → sai com código ≠ 0 sem chamar a CLI. `grep -n "db push" docs/RUNBOOK.md README.md` só mostra o fluxo novo. Nenhum documento manda rodar seed de demo em produção.

### Passo 13

Tratar os dados fictícios em produção depois do DEV validado, conforme a decisão. Tudo é executado por você, com backup antes. Opção A (trocar senhas): `update auth.users set encrypted_password = extensions.crypt('<nova senha só sua>', extensions.gen_salt('bf')) where email like '%@demo.snakethai.com' or email in (<contas de teste que você confirmar>);`. Opção B (limpar): rodar supabase/seed/demo_seed_limpar.sql, remover as contas de teste @snake.com que não forem a sua conta real (o trigger prevent_last_admin_removal barra a remoção do último admin) e verificar public.media_deletion_queue, porque o delete em cascata enfileira exclusão de comprovantes na Cloudinary de produção. Eu preparo os SQLs, mas não executo nada em produção.

_Arquivos:_ `supabase/seed/demo_seed_limpar.sql`

**Como verificar:** A: um login em produção com a senha antiga de demo devolve 400 (invalid credentials). B: `select count(*) from auth.users where email like '%@demo.snakethai.com'` = 0, sua conta de admin continua logando, e `select motivo, count(*) from public.media_deletion_queue group by 1` confere com o esperado.

## 6. Riscos

- O CI já falha em todo push por causa do teste c3 desatualizado, e ao mudar a porta do banco para 55322 o job banco quebra se a linha do psql no ci.yml não for trocada junto. Essa é a única mudança de CI (não adiciona teste nenhum).
- As migrations só foram provadas do zero em PG15 (CI). Subir para 17 pode revelar incompatibilidade, e o passo 2 precisa ser validado antes de tudo.
- Não consigo verificar drift em produção (objeto criado pelo painel) sem acesso a ela. A comparação de tipos --local (passo 3) cobre só o schema public, sem policies, grants ou cron. A confirmação real depende do `db diff --linked` que você roda.
- A CLI está vinculada a produção e `db push` usa o projeto vinculado. Um comando digitado à mão sem --local pode aplicar em produção. Por isso os scripts passam --local sempre e o push de produção só sai pelo script com dupla confirmação.
- `expo prebuild --clean` ao trocar de variante apaga android/gradle.properties. Quando a keystore de produção for configurada, as propriedades RELEASE_* devem ficar em %USERPROFILE%\.gradle\gradle.properties, ou são perdidas a cada troca. Isso precisa ser coordenado com a tarefa da keystore.
- Cada troca de variante exige rebuild nativo completo (~17 min no release).
- O adb reverse cai quando o adb reconecta (PC dormiu, Wi-Fi trocou). O app DEV mostra erro de rede até o menu reaplicar o reverse.
- A Supabase CLI publica as portas em 0.0.0.0. O Postgres local (usuário postgres/postgres) fica acessível na rede se o firewall do Windows permitir. Manter o firewall ativo, principalmente em rede pública.
- Duas stacks Supabase ao mesmo tempo pesam na RAM. Desligar analytics e realtime no snake-thai reduz, mas pode não bastar em máquina com pouca memória.
- Seeds rodadas pela CLI (begin/commit, tabela temporária, crypt() sem schema) podem se comportar diferente do psql. O plano prevê a alternativa via `docker exec ... psql`.
- Se o .env.dev ficar com EXPO_PUBLIC_API_URL apontando para a Render de produção, o servidor de produção recebe tokens do banco local e responde 401. A trava do env.ts (passo 8) evita isso.
- Ao chamar o Supabase local via host.docker.internal, o servidor valida um token emitido para 127.0.0.1. Suponho que o GoTrue não confere o issuer, mas isso precisa ser testado no passo 11.
- A senha das contas de demo continua no histórico do repositório público mesmo depois de removida do HEAD. Só trocar a senha ou apagar as contas em produção resolve. O mesmo vale para o default de academy_settings.default_student_password se ele nunca foi alterado em produção.
- Ordem com as outras tarefas: se a tarefa de merge ou push mexer em feat/papel-professor ou na main do snake-server ao mesmo tempo, a branch deste plano precisa ser rebaseada. No snake-server, nunca partir da main local (38 commits atrás).
- O plano gratuito da Cloudinary pode não permitir um segundo product environment (é suposição, não verifiquei). Nesse caso, usar uma conta separada.

## 7. Ajustes do revisor crítico

- **Conflito com T2:** A assinatura da variante DEV aparece de dois jeitos. T1 (passo 6) tira './plugins/withReleaseSigning.js' da lista de plugins em development. T2 (passo 3) mantém o plugin nas duas variantes e passa { exigirChaveDeProducao: false } na DEV, com testes Jest para esse caso. As duas implementações seriam feitas em app.config.js e app.json ao mesmo tempo.  
  **Resolução:** Escolher a abordagem da T2: o app.config.js da T1 injeta ['./plugins/withReleaseSigning.js', { exigirChaveDeProducao: variant === 'production' }] em vez de remover o plugin. Ajustar a verificação da T1 (passo 6) para conferir a opção, e não a ausência do plugin. A T2 continua sendo dona do plugin e dos testes.
- **Conflito com T3, T5, T9, T10:** Cada plano usa um nome ou valor diferente para a variante. T1: APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production' (with-variant.js recebe dev|prod). T3 (passo 7): process.env.APP_VARIANT === 'dev', que nunca é verdadeiro com a T1, então o sufixo +dev nunca aparece. T10: lê um hipotético EXPO_PUBLIC_APP_ENV. T5: define APP_VARIANT: production, mas grava um .env sem EXPO_PUBLIC_APP_VARIANT e não passa pelo with-variant.js. T9: enum app_variant ('production', 'development').  
  **Resolução:** A T1 publica o contrato: APP_VARIANT ∈ {development, production} no processo de build e EXPO_PUBLIC_APP_VARIANT com o mesmo valor no JS. T3 compara com 'development'. T10 usa EXPO_PUBLIC_APP_VARIANT como environment do Sentry. T9 mantém o enum. No CI, a T5 grava .env.prod e roda os comandos via 'node scripts/with-variant.js prod -- ...', garantindo o mesmo caminho de carga de variáveis e as mesmas travas do build local.
- **Conflito com T3, T2, T9, T10:** Vários planos mexem no mesmo arquivo de configuração. T1 cria app.config.js para as variantes. T3 (passo 7) também cria app.config.js, 'mínimo', para o sufixo de versão. T2 altera a entrada de plugin no app.json. T9 acrescenta o plugin expo-notifications, googleServicesFile e extra.eas.projectId, este último gravado pelo 'eas init', que costuma recusar ou só instruir quando existe configuração dinâmica. T10 acrescenta o plugin do Sentry. T3 e T9 instalam expo-constants cada um por conta própria.  
  **Resolução:** O app.config.js tem um único dono, a T1, que o cria com dois pontos de extensão: overrides por variante e cálculo de version. A T3 só acrescenta buildVersionName dentro dele. Plugins estáticos (expo-notifications, Sentry, assinatura) e extra.eas.projectId ficam no app.json-base; o projectId é colado à mão se o 'eas init' recusar. Em development, a T1 sobrescreve só name, package, scheme, ícone e a opção do plugin de assinatura, sem apagar a lista de plugins. expo-constants é instalado uma única vez, por quem chegar primeiro.
- **Conflito com T4, T5:** A T1 renomeia o .env do app para .env.prod e passa a usar EXPO_NO_DOTENV=1. A T4 (passo 7) lê a URL da API de produção com '. snake-thai/.env', e o comando quebra se a T1 vier antes. A T5 grava '.env' no CI, arquivo que o fluxo da T1 deixa de ler.  
  **Resolução:** Na T4 fase 2, ler .env.prod se existir e .env caso contrário, ou rodar a fase 2 antes do rename da T1. Na T5, gravar .env.prod e usar with-variant.js (ver conflito de nomes da variante).
- **Conflito com T6, T7, T8, T9:** A T1 move a stack local para as portas 553xx (API 55321, DB 55322) porque o radar-tributario ocupa as 543xx. As outras tarefas assumem as portas antigas: T7 ('API em 127.0.0.1:54321', curl em 54321), T8 ('adb reverse tcp:54321'), T9 (psql do host em 54322, vault push_project_url 'http://host.docker.internal:54321', 'supabase status mostra 54321/54322'). A T9 também usa psql no host, que não está instalado.  
  **Resolução:** Depois da T1, trocar em todos os planos para 55321/55322. Rodar SQL sempre por 'docker exec -i supabase_db_snake-thai psql' ou pelos subcomandos do scripts/db-dev. Na T9, o Vault local usa 'http://host.docker.internal:55321' ou o nome do container Kong com a porta interna 8000. Na T8, o adb reverse passa para tcp:55321.
- **Conflito com T6, T7, T8:** Não há um jeito único de rodar os testes e as seeds locais. A T1 (passo 4) roda a suíte com 'db reset --local' e só o seed.sql, sem demo. A T8 (passos 1 e 4) semeia a demo e roda as 6 regressões com os dados de demo carregados. T6 e T7 (passo 1) exigem as 6 regressões verdes como linha de base, mas regressao_c3_payment_whitelist.sql falha hoje e só a T1 (passo 4) a corrige. A T8 (passo 1) roda demo_seed.sql direto, e ele depende de contas @snake.com, turmas e plano que só o local_base.sql da T1 (passo 5) cria. A T6 (passo 11) reescreve a seção 8 do demo_seed.sql, onde a T1 (passo 5) coloca uma trava.  
  **Resolução:** T6, T7 e T8 começam só depois dos passos 2 a 5 da T1. Entrada única: 'scripts\db-dev test' para a suíte (banco limpo) e 'scripts\db-dev reset' para as seeds. Testes novos usam UUIDs próprios e deltas, para passar nos dois estados. A edição da T6 no demo_seed.sql é feita em cima da versão com a trava da T1.
- **Conflito com T6, T7, T8, T9:** A publicação em produção não segue o fluxo novo. T6 (passo 14), T7 (passo 15) e T9 (passo 18) chamam 'supabase db push' direto, sem o script com dupla confirmação da T1; a CLI está linkada à produção e 'db push' usa o projeto linkado por padrão. A T7 fixa timestamps (20260917120000, 20260917130000) enquanto as outras usam 'migration new'. Uma migration criada depois mas com timestamp menor que a última aplicada no remoto faz o 'db push' recusar, exigindo --include-all. Ninguém prevê backup antes de cada push.  
  **Resolução:** Todo push de migration em produção passa por scripts\db-push-prod.bat (T1, passo 12), antecedido por 'npx supabase db dump --linked' para fora do repositório, feito pelo usuário. Os timestamps são gerados ('migration new' ou renomeação) no rebase final, logo antes do merge de cada tarefa, na ordem de integração T7 → T6 → T8 → T9. Nunca usar --include-all em produção sem revisão.
- **Conflito com T2, T3, T10:** Quatro planos alteram as mesmas rotinas do menu.bat ([5], [8], :GRADLE_BUILD). A T1 copia para release\snake-thai-dev-v<versão>.apk e roda via with-variant. A T3 copia para release\snake-thai-v%VERSAO_BUILD%.apk, com '+dev' no nome, e aborta se o android/ estiver desatualizado. A T2 acrescenta :VERIFY_SIGNATURE. A T10 define SENTRY_DISABLE_AUTO_UPLOAD. Os nomes de APK se contradizem e os conflitos de merge são certos.  
  **Resolução:** Editar o menu.bat em sequência, na ordem T1 → T3 → T2 → T10, cada uma rebaseada na anterior. Convenção de nome: release\snake-thai[-dev]-v<saída de 'version.js build-name'>.apk. A verificação de assinatura da T2 roda só no build PROD; em DEV, avisar sem bloquear.
- **Conflito com T3, T6, T8, T9:** Várias tarefas esbarram no 'Esquece o CI' (não adicionar testes ao CI). A T1 altera o ci.yml, só a porta do psql (necessário porque o job lê o config.toml). As regressões novas de T6, T8 e T9 em supabase/tests/ passam a rodar sozinhas no job 'banco'. Os testes Jest de T2, T3, T10 e T11 rodam no job de testes. Só a T9 levanta essa questão.  
  **Resolução:** Decisão única do usuário, aplicada a todas as tarefas. Recomendação: aceitar que testes nas pastas existentes rodem no CI atual, sem nenhum job ou passo novo, e manter a única edição do ci.yml na porta 55322. Se o usuário quiser literalmente nada novo no CI, todas as regressões novas vão para supabase/tests-local/ e o db-dev test da T1 percorre as duas pastas.
- **Afirmação a conferir:** Passo 7: 'trocar supabase:types para `npx supabase gen types typescript --local`'. Passo 3: os tipos versionados 'foram gerados da produção' e servem de base para detectar drift.  
  **Por quê:** package.json:54 já tem "supabase:types": "supabase gen types typescript --local > src/types/database.types.ts", então não há o que trocar. Não há evidência de que database.types.ts veio da produção: pelo script, foi gerado de algum banco local. A comparação do passo 3 não detecta drift de produção, e essa checagem continua dependendo só do 'db diff --linked' que o usuário roda.
- **Afirmação a conferir:** 'regressao_frequencia_regras.sql:321-345 e regressao_mensalidades.sql:147-154 contam globalmente, então exigem banco sem as seeds de demo.'  
  **Por quê:** Nas linhas citadas, as asserções são 'n < 1' (primeiro fechamento), 'n <> 0' (refechamento idempotente) e contagens filtradas por user_id (regressao_mensalidades.sql:148-154). Nenhuma falha de forma óbvia com dados de demo. É plausível, mas não está demonstrado. A T8, que assume o contrário (testes verdes com seeds), também não verificou. Rodar a suíte nos dois estados antes de fixar a convenção.
- **Afirmação a conferir:** A produção roda Postgres 17 (supabase/.temp/postgres-version = 17.6.1.155), então o local deve subir para major_version 17.  
  **Por quê:** O arquivo .temp é gravado no 'supabase link' (datado de 2026-08-10) e pode estar defasado. É provável que esteja certo, mas convém o usuário confirmar a versão no painel ou por uma consulta somente leitura antes de mudar o CI e o local para 17. As 26 migrations só foram provadas do zero em PG15 (config.toml:16 major_version = 15).
- **Decisão consolidada (T1 + T6):** O que fazer com os dados de demo em produção (senha no repositório público) e com as aulas futuras de demo que a grade da T6 adotaria?  
  **Recomendação:** Agora: trocar a senha das contas de demo e de teste em produção (opção A da T1). Antes de cadastrar o primeiro aluno real ou a grade real: backup e limpeza (opção B), com o usuário informando qual e-mail é a conta real de admin. Na mesma rodada, avaliar a senha fixa 'a senha padrão' das Edge Functions.
- **Decisão consolidada (T1):** Portas do Supabase local, acesso do celular e Cloudinary de dev.  
  **Recomendação:** Portas 553xx, convivendo com o radar-tributario. adb reverse das portas 55321 e 3000. Product environment separado na Cloudinary; se o plano gratuito não permitir, conta separada.
- **Decisão consolidada (T1 + T2):** Assinatura da variante DEV.  
  **Recomendação:** DEV assinada com a chave de debug, instalada só por adb e nunca publicada em Releases. Implementar pela opção exigirChaveDeProducao do plugin (T2), controlada pelo app.config.js da T1.
- **Decisão consolidada (T1 + T3 + T5 + T9 + T10):** Contrato da variante (nomes e valores).  
  **Recomendação:** APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production'; padrão production, com o .env antigo renomeado para .env.prod. O CI usa .env.prod e with-variant.js. Decisão técnica, só para o usuário ciente.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T1.md` escrito
