# PLANO DE EXECUÇÃO — T10: Monitoramento de erros no aparelho (Sentry ligado ao logger existente, sem PII)

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T10` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/monitoramento-erros` |
| **Esforço** | M |
| **Depende de** | T1, T3 |

## 1. Enunciado

Hoje os erros do app só vão para o console do aparelho (logger.ts:126-137) e se perdem. Nenhuma tela tem ErrorBoundary e não existe tratador global de erros. A recomendação é usar o Sentry (@sentry/react-native ~7.11, a versão que o Expo 57 aceita). Ele captura travamentos nativos e erros de JS, sobe os source maps no build e recebe os log.error por um "sink" (saída) injetado no logger. Dado pessoal é filtrado dos dois lados: no logger e no beforeSend. O usuário é identificado por um id pseudônimo, DEV e produção ficam separados por environment e o nome do release vem da versão definida na T3. A tabela própria no Supabase fica como alternativa, mas não pega travamento nativo nem lê stack de Hermes, dá mais trabalho e entrega menos.

### Resposta às perguntas do usuário

Para o monitoramento de erros o custo é zero: o plano Developer do Sentry é grátis, com 5 mil erros por mês, 1 usuário e 30 dias de retenção (conferido em sentry.io/pricing em 2026-09-16). Isso basta para uma academia, desde que os erros de rede sejam filtrados. Se a tarefa de build no GitHub Actions for feita, o token de upload do Sentry entra lá como Secret (SENTRY_AUTH_TOKEN), e o CI de testes não é alterado.

## 2. Terreno (situação verificada)

- O logger só grava no console. O próprio código aponta emit() como o único lugar a trocar por um coletor remoto.  
  _Evidência:_ src/lib/logger.ts:116-138 (comentário nas linhas 126-127: 'Em produção este é o ponto único a trocar por um coletor remoto')
- O mascaramento olha só o NOME da chave. A lista não tem name/nome/dob, e o texto da mensagem de erro (errorMessage, que pode trazer o JSON inteiro do PostgREST) sai sem filtro.  
  _Evidência:_ src/lib/logger.ts:24-37 (SENSITIVE_KEYS), 60-74 (sanitize por chave), 106-114 (describeError usa safeJson(error) sem filtrar o conteúdo)
- Risco de PII escondido: um erro de CPF duplicado vindo do PostgREST traz o CPF no campo 'details'. Hoje o onboarding não manda esse erro para o log, mas qualquer coletor automático passaria a capturá-lo.  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:50 (cpf text not null unique); src/services/profile.service.ts:39-50 (throw error do update com cpf); src/screens/onboarding/OnboardingScreen.tsx:188-189
- Há 25 chamadas de log.error em 20 arquivos, com contexto só de ids (paymentId, classId, provedor). log.warn e log.info não são usados em lugar nenhum. createLogger aparece 53 vezes.  
  _Evidência:_ grep 'log.error' em src: PlanPicker.tsx:55, 10 hooks (ex.: useRollCallReview.ts:60), FrequenciaScreen.tsx:122/175/193, PagamentoScreen.tsx:93, ComprovanteScreen.tsx:103-106, HistoricoPagamentosAlunoScreen.tsx:84 etc.; grep 'log.warn|log.info' sem resultado
- Não existe ErrorBoundary nem tratador global (ErrorUtils/unhandled rejection). Um erro de renderização em release fecha o app sem deixar rastro.  
  _Evidência:_ grep 'ErrorBoundary|componentDidCatch|ErrorUtils|setGlobalHandler' em src, App.tsx e index.ts: nenhum resultado; App.tsx:31-42
- Não há SDK de monitoramento instalado nem metro.config.js. O Expo 57.0.14 valida @sentry/react-native ~7.11.0, enquanto a versão mais nova no npm é a 8.26.0.  
  _Evidência:_ package.json:4-31 (sem @sentry); ls metro.config.js: não existe; node_modules/expo/package.json:3 (57.0.14); node_modules/expo/bundledNativeModules.json:123 ('@sentry/react-native': '~7.11.0'); npm view @sentry/react-native version = 8.26.0
- O env.ts lança exceção já na importação quando falta variável do Supabase. Se o Sentry for inicializado depois dessa importação, a falha de boot não é capturada.  
  _Evidência:_ src/config/env.ts:18-26 e 45-53; index.ts:1-8 (importa App, que importa a cadeia supabase → env)
- O arquivo de token do plugin do Sentry (.env.sentry-build-plugin) já é ignorado pelo Git, e a pasta android/ (onde nasce o sentry.properties) também.  
  _Evidência:_ .gitignore: '.env.*' com '!.env.example'; '/android'
- O app.json já tem um plugin que edita o app/build.gradle (withReleaseSigning). O plugin do Sentry também edita esse arquivo, acrescentando um 'apply from sentry.gradle(.kts)'. Não há versionCode explícito.  
  _Evidência:_ app.json:30-47 e 16-26; plugins/withReleaseSigning.js:50-88; raw.githubusercontent.com/getsentry/sentry-react-native/main/packages/core/plugin/src/withSentryAndroid.ts
- No Android, o nome padrão do release no Sentry é '$appId@$versionName+$versionCode', e o dist é o versionCode. O script lê SENTRY_AUTH_TOKEN, SENTRY_DISABLE_AUTO_UPLOAD, SENTRY_RELEASE, SENTRY_DIST, SENTRY_ENVIRONMENT e SENTRY_DOTENV_PATH, e se pendura nas tarefas createBundle<Variant>JsAndAssets.  
  _Evidência:_ getsentry/sentry-react-native main: packages/core/sentry.gradle.kts (lido via WebFetch em 2026-09-16; a 7.11 pode usar sentry.gradle em Groovy com a mesma lógica — confirmar após instalar)
- O plano gratuito do Sentry (Developer) inclui 5 mil erros por mês, 1 usuário, 30 dias de retenção, 5M spans, 50 replays e 1 GB de anexos.  
  _Evidência:_ https://sentry.io/pricing/ (consultado em 2026-09-16)
- O Sentry guarda dados nos EUA (Iowa) ou na UE (Frankfurt). A região é escolhida ao criar a organização e não pode ser trocada depois. Conta, tokens, DSN e dados de uso ficam sempre nos EUA.  
  _Evidência:_ https://docs.sentry.io/organization/data-storage-location/
- O Sentry já coleta algumas coisas por padrão: IP deduzido no servidor, URLs com query string e logs do console como breadcrumbs. Screenshot e view hierarchy vêm desligados. O exemplo oficial de configuração do Expo liga sendDefaultPii: true e Session Replay, o que é inadequado aqui.  
  _Evidência:_ https://docs.sentry.io/platforms/react-native/data-management/data-collected/ ; https://docs.sentry.io/platforms/react-native/manual-setup/expo/
- O app faz chamadas com fetch para URLs assinadas (Cloudinary e backend). Os breadcrumbs de HTTP gravariam a query string com a assinatura.  
  _Evidência:_ src/lib/cloudinaryUpload.ts:61,72; src/lib/api.ts:94,176
- Licenças: @sentry/react-native e @sentry/core são MIT; @sentry/cli, ferramenta de build que não entra no APK, é FSL-1.1-MIT. O gate de licenças não bloqueia FSL.  
  _Evidência:_ npm view @sentry/react-native@7.11.0 license = MIT; npm view @sentry/cli@2.58.4 license = FSL-1.1-MIT; scripts/check-licenses.js:19
- O polyfill crypto.getRandomValues já está carregado no app, então dá para gerar um id de instalação aleatório sem nova dependência.  
  _Evidência:_ src/lib/secureStorage.ts:1 e 33
- O onboarding exige aceitar a 'Política de Privacidade', mas o texto da política não está no repositório. Um novo operador de dados fora do Brasil precisa entrar nesse texto.  
  _Evidência:_ src/screens/onboarding/OnboardingScreen.tsx:166 e 323-326; grep 'Política de Privacidade' nos .md: só docs/MANUAL-DO-ADMINISTRADOR.md:31
- Não sei a região do projeto Supabase de produção. Não acessei produção, por regra.  
  _Evidência:_ Suposição — não verificado

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Qual ferramenta de monitoramento usar?**

- (1) Sentry (@sentry/react-native + plugin Expo). PRÓS: pega travamento nativo (Java/C++, módulos nativos) e erros fatais de JS, que são enviados na próxima abertura; stack legível via source maps com Debug ID subidos no build; agrupa ocorrências, dispara alerta por e-mail e mostra release health (sessões sem crash); grátis até 5 mil erros/mês com 30 dias de retenção. CONTRAS: exige criar conta, DSN e token de upload; dados saem do Brasil (EUA ou UE), o que é transferência internacional pela LGPD e precisa constar na política; nova dependência nativa (+ alguns segundos a minutos no build de ~17 min); plano limitado a 1 usuário; a cota pode estourar com um loop de erro; @sentry/cli tem licença FSL (só no build).
- (2) Tabela própria no Supabase (ex.: app_error_events) recebendo eventos do logger. PRÓS: sem conta nova nem dependência nativa; dados no mesmo fornecedor já usado; consultável por SQL; controle total do que é gravado. CONTRAS: não pega travamento nativo, ANR nem OOM; erro fatal de JS mata o app antes do INSERT (seria preciso guardar no AsyncStorage e reenviar na próxima abertura); stack do Hermes em release vem minificada (index.android.bundle:1:NNNNN) e sem source maps é inútil; sem agrupamento nem alerta; RLS precisa ser só de insert (authenticated, com check user_id = auth.uid()), o que perde os erros antes do login, e liberar anon abre spam com a anon key embutida no APK; precisa de limite de tamanho por coluna, rate limit por trigger e job de retenção no pg_cron; ocupa o banco de produção (500 MB no plano free); esforço G contra M do Sentry.

➡️ _Adotado:_ Opção (1) Sentry. É a única que cumpre o objetivo (ver crash nativo e stack legível) sem reconstruir agrupamento, alerta e simbolicação na mão. O risco de LGPD fica controlado porque nenhum dado pessoal sai do aparelho (ver filtros abaixo).

**P2. Em que região criar a organização do Sentry? A escolha é irreversível.**

- UE (Frankfurt)
- EUA (Iowa)

➡️ _Adotado:_ UE (Frankfurt). Fica sob o GDPR, o que facilita justificar a transferência pelo art. 33 da LGPD. Mesmo assim, conta, tokens e DSN ficam nos EUA, e isso deve ser citado na política. Vale confirmar a base legal com assessoria (Resolução CD/ANPD nº 19/2024 trata de transferência internacional).

**P3. Como identificar o usuário nos eventos sem expor PII?**

- Id de instalação aleatório (UUID gerado no aparelho e guardado no AsyncStorage) + tag role (admin/professor/aluno). Não fica ligado à conta.
- UUID do perfil (auth.uid) + tag role. Permite achar o usuário no banco para dar suporte, mas é dado pseudonimizado e ligável à pessoa.
- Nenhum id; só a tag role.

➡️ _Adotado:_ Id de instalação aleatório + role. Mantém a contagem de 'usuários afetados', não liga o evento à pessoa sem acesso ao aparelho e não exige nova dependência. Se precisar de suporte, dá para mostrar esse código na tela de diagnóstico.

**P4. Como separar DEV de produção no Sentry?**

- Um projeto só, com environment = development | production (o APK 'DEV Snake Thai' manda environment=development; Metro/__DEV__ não manda nada).
- Dois projetos (snake-thai e snake-thai-dev), cada um com seu DSN.

➡️ _Adotado:_ Um projeto com environment. A cota de 5 mil erros é por organização de qualquer jeito, e fica mais simples de filtrar. No Metro em modo debug (__DEV__) o SDK fica desligado para não gastar cota.

**P5. log.warn também deve virar evento no Sentry?**

- Não: warn e info viram só breadcrumbs (contexto anexado ao próximo erro); só log.error vira evento.
- Sim: warn também vira evento.

➡️ _Adotado:_ Só log.error vira evento. Protege a cota, e hoje nem existe log.warn no código.

**P6. Incluir um gatilho de diagnóstico (enviar erro de teste e forçar crash nativo) visível só nos builds que não são de produção?**

- Sim, em DadosScreen, só quando environment !== 'production'
- Não; testar com código temporário e depois reverter

➡️ _Adotado:_ Sim. Permite verificar source maps e crash nativo no APK DEV a cada release sem rebuild extra, e não aparece para quem usa a versão de produção.

**P7. Onde fica o texto da Política de Privacidade que o onboarding manda aceitar? Ele será atualizado para citar o Sentry como operador?**

- Existe fora do repositório: o usuário atualiza
- Não existe: criar (fora do escopo desta tarefa)

➡️ _Adotado:_ Atualizar antes de publicar o release com Sentry, citando: dados técnicos de falha (sem nome, CPF ou e-mail), id aleatório do aparelho, região, 30 dias de retenção e a finalidade (corrigir falhas).

## 4. Ações que só o usuário pode fazer

- [ ] Criar a conta no Sentry (plano Developer, grátis), com 2FA ligado, e a organização na região escolhida (irreversível).
- [ ] Criar o projeto da plataforma React Native (sugestão de slug: snake-thai) e informar os slugs da organização e do projeto. Não são segredos.
- [ ] No projeto, em Settings > Security & Privacy: ligar 'Prevent Storing of IP Addresses', 'Data Scrubber' e 'Use Default Scrubbers'. Em Client Keys (DSN), definir um rate limit se a opção existir no plano (não verifiquei).
- [ ] Copiar o DSN e colar você mesmo em EXPO_PUBLIC_SENTRY_DSN no .env de produção e no arquivo de ambiente da variante DEV (definido na T1). O DSN vai embutido no APK e não é segredo forte, mas não precisa ser colado no chat.
- [ ] Criar um Organization Auth Token (Settings > Developer Settings > Organization Tokens) e deixá-lo SÓ na máquina de build: variável de ambiente SENTRY_AUTH_TOKEN do Windows (setx) ou arquivo .env.sentry-build-plugin na raiz do snake-thai (já ignorado pelo Git). Se a tarefa de build no GitHub Actions for feita, cadastrar também como Secret SENTRY_AUTH_TOKEN. Nunca colar no chat.
- [ ] Configurar no painel uma regra de alerta por e-mail para issue nova em environment=production.
- [ ] Atualizar a Política de Privacidade (e registrar o Sentry como operador, com a base legal da transferência internacional).
- [ ] Depois do build DEV, usar o gatilho de diagnóstico no celular (SM-S928B) e conferir no painel: evento chegou, stack aponta para src/..., sem IP, e-mail ou CPF. Só você tem acesso ao painel.

## 5. Passos atômicos

### Passo 1

Pré-requisitos: T1 (variante DEV e variável de ambiente da variante) e T3 (versionName/versionCode padronizados) integradas. Criar a branch feat/monitoramento-erros a partir da base definida no fluxo de git. Não mexer em .github/workflows/ci.yml ('Esquece o CI').

**Como verificar:** git status limpo; git log mostra os commits de T1/T3 na base; app.json (ou app.config.*) já tem versionCode explícito.

### Passo 2

Instalar a versão validada pelo Expo: `npx expo install @sentry/react-native`, que deve resolver ~7.11.x. NÃO usar o `@sentry/wizard`: ele liga sendDefaultPii:true, replay e profiling.

_Arquivos:_ `package.json`, `package-lock.json`

**Como verificar:** package.json lista "@sentry/react-native": "~7.11.x"; `npx expo install --check` sem avisos; `npm run check:licenses` passa.

### Passo 3

Criar metro.config.js com `const { getSentryExpoConfig } = require('@sentry/react-native/metro'); module.exports = getSentryExpoConfig(__dirname);`. Isso gera Debug IDs no bundle e no source map do Hermes.

_Arquivos:_ `metro.config.js`

**Como verificar:** `npm start` sobe o Metro na porta 6969 sem erro, e o app abre no aparelho por adb reverse.

### Passo 4

Registrar o plugin no app.json (ou app.config.* se a T1 migrar), DEPOIS de ./plugins/withReleaseSigning.js: `["@sentry/react-native/expo", { "organization": "<slug-org>", "project": "snake-thai", "url": "https://sentry.io/" }]`. Se a organização for da UE, confirmar no painel qual URL a sentry-cli deve usar (o token de organização costuma trazer a região).

_Arquivos:_ `app.json`

**Como verificar:** `npx expo config --type prebuild` mostra o plugin; nenhum token aparece no arquivo.

### Passo 5

Criar src/lib/monitoring/scrub.ts com funções puras, sem importar Sentry: scrubText (troca por '[removido]' CPF com ou sem máscara, e-mail, telefone BR, JWT eyJ..., 'Bearer ...' e sequências de 11 dígitos); scrubUrl (remove query string e fragmento, mantém host e caminho); scrubEvent(event) (aplica scrubText em exception.values[].value, message, extra e contexts; apaga user.email, user.username, user.ip_address e request.headers/cookies; aplica scrubUrl em request.url); scrubBreadcrumb(crumb) (descarta categoria 'console', porque o logger já registra seus próprios breadcrumbs sanitizados; aplica scrubUrl em data.url de http/fetch/xhr); isExpectedNetworkError(error) ('Network request failed', AbortError e timeout do api.ts), para não gastar cota com aparelho sem internet.

_Arquivos:_ `src/lib/monitoring/scrub.ts`, `src/lib/monitoring/__tests__/scrub.test.ts`

**Como verificar:** Testes Jest: 'deveRemoverCpfDoDetailsDoPostgrest' (entrada: details 'Key (cpf)=(12345678900) already exists.'), 'deveRemoverQueryStringDeUrlAssinada', 'deveRemoverJwtEBearer', 'deveDescartarBreadcrumbDeConsole', 'deveApagarIpEEmailDoUsuario', 'deveReconhecerFalhaDeRede' — todos verdes.

### Passo 6

Criar src/lib/monitoring/installId.ts: lê do AsyncStorage (chave nomeada em constante) um UUID v4 gerado com crypto.getRandomValues (importar 'react-native-get-random-values'), cria o id se não existir e trata falha de leitura com fallback null. Só entra se a decisão sobre o id for 'id de instalação'.

_Arquivos:_ `src/lib/monitoring/installId.ts`, `src/lib/monitoring/__tests__/installId.test.ts`

**Como verificar:** Testes: 'deveReutilizarOMesmoIdEntreChamadas' e 'deveGerarUuidV4Valido', com AsyncStorage mockado.

### Passo 7

Criar src/lib/monitoring/index.ts, o ÚNICO arquivo que importa @sentry/react-native. Ele exporta initMonitoring(), reportError({scope, message, error, context}), addMonitoringBreadcrumb(), setMonitoringUser({role, id}), clearMonitoringUser(), monitoringEnvironment, wrapRoot() e o ErrorBoundary. Ler `process.env.EXPO_PUBLIC_SENTRY_DSN` e a variável de variante da T1 (ex.: `process.env.EXPO_PUBLIC_APP_ENV`) por acesso ESTÁTICO (o Expo só troca o valor assim) e SEM importar src/config/env.ts, que lança exceção na importação. Sentry.init: dsn; enabled = dsn !== null && !__DEV__; environment (padrão 'production'); sendDefaultPii: false; attachScreenshot: false; attachViewHierarchy: false; sem tracesSampleRate, profiles, replay ou enableLogs; maxBreadcrumbs 50; beforeSend = descartar se isExpectedNetworkError, senão scrubEvent; beforeBreadcrumb = scrubBreadcrumb. NÃO definir release/dist: usar o padrão nativo applicationId@versionName+versionCode, que vem da T3. reportError: se o erro for instanceof Error, usar captureException com tag scope, extra = contexto sanitizado e fingerprint [scope, message]; se for objeto (PostgREST), usar captureMessage(message, 'error') com extra.errorMessage filtrado. Envolver tudo em try/catch: o monitoramento nunca pode derrubar o app.

_Arquivos:_ `src/lib/monitoring/index.ts`, `src/lib/monitoring/__tests__/monitoring.test.ts`

**Como verificar:** Testes com @sentry/react-native mockado: 'naoDeveInicializarSemDsn', 'deveUsarEnvironmentDaVariante', 'reportErrorComErrorDeveChamarCaptureExceptionComScope', 'reportErrorComObjetoDeveChamarCaptureMessageSemPii', 'falhaDoSdkNaoDevePropagar'. `npm run typecheck` sem erros.

### Passo 8

Ligar ao logger por injeção, sem fazer o logger importar o Sentry. Em logger.ts, criar `export interface LogSink { error(e: {scope; message; error?: unknown; context: LogContext}): void; breadcrumb(e: {level; scope; message; context: LogContext}): void }` e `setLogSink(sink | null)`. Em emit(), depois do console: se o nível for 'error', chamar sink.error com o erro ORIGINAL (para preservar a stack que o Sentry simboliza) e o contexto já sanitizado; nos níveis 'warn' e 'info', chamar sink.breadcrumb sem stack; tudo em try/catch. Acrescentar 'name', 'nome', 'dob' e 'nascimento' a SENSITIVE_KEYS e aplicar scrubText ao errorMessage em describeError (protege também o console). initMonitoring registra o sink.

_Arquivos:_ `src/lib/logger.ts`, `src/lib/__tests__/logger.test.ts`

**Como verificar:** Os 4 testes que já existem continuam verdes, mais os novos: 'deveRepassarOErroOriginalAoSink', 'contextoEntregueAoSinkDeveEstarMascarado', 'warnDeveVirarSoBreadcrumb', 'semSinkNaoDeveLancar', 'sinkQueLancaNaoDeveQuebrarOLog', 'naoDeveVazarCpfContidoNaMensagemDoErro'.

### Passo 9

Criar src/lib/monitoring/init.ts, que só chama initMonitoring(). Importar esse arquivo como a PRIMEIRA linha de index.ts (`import './src/lib/monitoring/init';`), antes de `import App`, para capturar também as falhas de boot (env ausente).

_Arquivos:_ `index.ts`, `src/lib/monitoring/init.ts`

**Como verificar:** Com o DSN vazio no .env, o app abre normalmente pelo Metro (SDK desligado). No APK DEV, com o DSN preenchido, o log do adb (`adb logcat | findstr Sentry`) mostra a inicialização sem erro.

### Passo 10

App.tsx: `export default wrapRoot(App)` (Sentry.wrap) e um ErrorBoundary do Sentry DENTRO do ThemeProvider, com o novo componente ErrorFallbackScreen: mensagem em pt-BR ('Algo deu errado. Tente de novo.'), botão 'Tentar de novo' que chama resetError, acessibilityRole e label, área de toque de 44dp. Sem detalhe técnico na tela.

_Arquivos:_ `App.tsx`, `src/components/ErrorFallbackScreen.tsx`, `src/components/__tests__/ErrorFallbackScreen.test.tsx`

**Como verificar:** Teste RNTL: 'deveMostrarMensagemAmigavelEChamarResetAoTocar'. Visualmente no aparelho, pelo gatilho de diagnóstico de erro de renderização (passo 12).

### Passo 11

AuthProvider: depois de setProfile(loaded) em loadProfile, chamar setMonitoringUser({ role: loaded.role, id: <conforme decisão: installId ou loaded.id> }). No signOut e quando a sessão virar null, chamar clearMonitoringUser(). Nunca enviar e-mail, nome ou CPF.

_Arquivos:_ `src/context/AuthProvider.tsx`

**Como verificar:** Teste do AuthProvider (mock do módulo monitoring): 'deveDefinirUsuarioSoComRoleEId' e 'deveLimparUsuarioAoSair'. No painel, o evento mostra user.id pseudônimo e a tag role, sem e-mail nem IP.

### Passo 12

Gatilho de diagnóstico em DadosScreen: uma linha 'Diagnóstico de erros' visível só quando monitoringEnvironment !== 'production'. Abre um Alert com três opções: 'Enviar erro de teste' (log.error('Teste de monitoramento — ignorar', new Error('SNAKE_TESTE_MONITORAMENTO'))), 'Erro de tela' (lança erro no render para acionar o ErrorBoundary) e 'Travamento nativo' (Sentry.nativeCrash(), exposto pelo monitoring).

_Arquivos:_ `src/screens/dados/DadosScreen.tsx`

**Como verificar:** Teste RNTL: 'naoDeveExibirDiagnosticoEmProducao' e 'deveExibirDiagnosticoEmDevelopment'.

### Passo 13

Mock global do @sentry/react-native no jest.setup.js (init, captureException, captureMessage, addBreadcrumb, setUser, setTag, withScope, nativeCrash como jest.fn; wrap: c => c; ErrorBoundary: ({children}) => children).

_Arquivos:_ `jest.setup.js`

**Como verificar:** `npm test` roda os 324 testes existentes mais os novos, todos verdes. O hook pre-commit do Husky (typecheck + jest) passa.

### Passo 14

Build sem token não pode quebrar. Em menu.bat, nas opções [5] Release e [8] Debug, antes de :GRADLE_BUILD: no Debug, sempre `set SENTRY_DISABLE_AUTO_UPLOAD=true`; no Release, se SENTRY_AUTH_TOKEN não estiver definido e não existir .env.sentry-build-plugin, fazer `set SENTRY_DISABLE_AUTO_UPLOAD=true` e avisar: '[!] Sem token do Sentry: o stack trace deste APK ficará ilegível no painel'. Se houver a tarefa de build no GitHub Actions, passar `SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}` no passo do gradle.

_Arquivos:_ `menu.bat`, `(se existir) .github/workflows/<build-apk>.yml`

**Como verificar:** Rodar [5] sem o token: o APK é gerado e o aviso aparece. Com o token: o log do gradle mostra a tarefa de upload do Sentry na createBundleReleaseJsAndAssets, com os arquivos enviados.

### Passo 15

Checar se a regeneração convive com a assinatura: `npx expo prebuild --platform android --clean`, depois inspecionar android/app/build.gradle (precisa ter o bloco RELEASE_STORE_FILE do withReleaseSigning E a linha apply do sentry.gradle) e android/sentry.properties (org, project e url, SEM auth.token). Rodar `android\gradlew :app:signingReport`.

_Arquivos:_ `android/app/build.gradle (gerado, não versionado)`, `android/sentry.properties (gerado, não versionado)`

**Como verificar:** signingReport, Variant: release: Store continua sendo a keystore esperada (T2), e não debug.keystore. `git status` não mostra sentry.properties nem token.

### Passo 16

Validação ponta a ponta no APK DEV (release com environment=development), instalado por adb Wi-Fi no SM-S928B: (a) 'Enviar erro de teste'; (b) 'Erro de tela'; (c) 'Travamento nativo' e depois reabrir o app (o crash nativo só é enviado na abertura seguinte).

**Como verificar:** No painel (usuário): 3 issues em environment=development; release = '<applicationId>@<versionName>+<versionCode>' conforme a T3; stack de (a) e (b) com frames em src/screens/dados/DadosScreen.tsx (source map aplicado, sem index.android.bundle:1:NNNN); (c) com o stack nativo. Em 'View JSON': sem user.ip_address, email, CPF ou query string em breadcrumbs. Tag role presente.

### Passo 17

Validação do build de produção: gerar o APK de produção e confirmar que o gatilho de diagnóstico NÃO aparece e que o app abre normalmente. Opcional: provocar um erro real controlado, como abrir um comprovante com o aparelho offline, e confirmar que falha de rede NÃO vira issue.

**Como verificar:** DadosScreen sem a linha 'Diagnóstico'; o painel não recebe evento de 'Network request failed'; o primeiro evento real de produção aparece com environment=production.

### Passo 18

Documentação, conforme o protocolo do README: README.md (integração Sentry, nova variável EXPO_PUBLIC_SENTRY_DSN, token só na máquina de build); .env.example (EXPO_PUBLIC_SENTRY_DSN opcional, com comentário explicando que vai no APK e que o SENTRY_AUTH_TOKEN NUNCA leva o prefixo EXPO_PUBLIC_); docs/RUNBOOK.md (seção 'Monitoramento de erros': onde ver, como testar, o que fazer quando a cota estourar, como rotacionar o token); LICENSE_AUDIT.md (@sentry/* MIT; @sentry/cli FSL-1.1-MIT só no build); SECURITY.md (o que sai do aparelho e o que é filtrado); .gitignore (acrescentar .sentryclirc por precaução).

_Arquivos:_ `README.md`, `.env.example`, `docs/RUNBOOK.md`, `LICENSE_AUDIT.md`, `SECURITY.md`, `.gitignore`, `CLAUDE.md (§7, estrutura: src/lib/monitoring)`

**Como verificar:** `git grep -n SENTRY_AUTH_TOKEN` só encontra texto explicativo, nenhum valor; README cita a variável nova.

### Passo 19

Commits em Conventional Commits (ex.: 'feat(monitoramento): captura de erros e crashes com Sentry sem PII', 'docs: monitoramento de erros') e push/PR conforme a regra de git da tarefa de integração. Subir a versão pela regra da T3 (feature nova = minor).

**Como verificar:** O hook commit-msg aceita; o PR mostra só os arquivos listados; nenhum .env ou token no diff (`git diff --stat` e `git diff | findstr /i "sntrys_ auth.token"` vazios).

## 6. Riscos

- Vazamento de PII pelo texto do erro: o details do PostgREST traz o valor que violou a UNIQUE (CPF), e o mascaramento atual é só por chave. Mitigação: scrubText no logger e no beforeSend, com teste de regressão específico, mais o Data Scrubber ligado no painel.
- Breadcrumbs automáticos de console e HTTP levariam os logs JSON, com stack e mensagem, e as URLs assinadas da Cloudinary e do backend. Mitigação: descartar a categoria console e tirar a query string em beforeBreadcrumb.
- Conflito entre plugins que editam o app/build.gradle (withReleaseSigning e Sentry) pode fazer a keystore de debug voltar em silêncio. Mitigação: passo 15 (prebuild --clean + signingReport) a cada mudança de plugin.
- O build de release falha se a sentry-cli não tiver token. Mitigação: SENTRY_DISABLE_AUTO_UPLOAD no menu.bat quando faltar o token (o APK sai, mas com stack ilegível) e aviso explícito.
- Cota de 5 mil erros/mês e 1 usuário no plano grátis: um erro em loop de render, ou aparelhos offline, esgotam a cota e o resto do mês fica sem eventos. Mitigação: filtro de erro de rede, fingerprint [scope, message], só log.error vira evento, SDK desligado em __DEV__ e rate limit da Client Key (disponibilidade no plano grátis não verificada).
- LGPD: dados técnicos vão para EUA ou UE, a região é irreversível e a conta fica sempre nos EUA. Id pseudônimo ainda é dado pessoal se der para ligar à pessoa. Precisa atualizar a Política de Privacidade (cujo texto não está no repositório) antes de publicar.
- O DSN embutido no APK pode ser extraído e usado para mandar eventos falsos (poluição e consumo de cota). Mitigação: rate limit por chave e filtros de entrada no painel. A chave pode ser trocada sem afetar o token de build.
- Travar a versão em ~7.11 (a validada pelo Expo 57) enquanto o npm já está na 8.26: um PR do Dependabot subindo a major pode quebrar o build nativo. Só atualizar junto com o SDK do Expo.
- Ordem de import: se o monitoring importar src/config/env.ts, ou não for a primeira linha de index.ts, as falhas de boot deixam de ser capturadas.
- Suposição sobre a numeração: considerei T1 como a separação DEV/produção (variante e variável de ambiente) e T3 como a padronização de versão. Se a T1 não criar uma variável de variante acessível ao JS, o environment precisa de outra fonte (ex.: applicationId via expo-application).
- O release depende do versionCode: sem a T3, todos os builds saem como '+1' e o Sentry não distingue builds da mesma versionName.
- Crash nativo só é enviado na próxima abertura do app: um usuário que desinstala logo depois do crash não gera evento.
- O script sentry.gradle da 7.11 pode ser a versão Groovy e diferir da .kts lida na main. Os nomes das variáveis (SENTRY_AUTH_TOKEN, SENTRY_DISABLE_AUTO_UPLOAD) devem ser reconfirmados em node_modules/@sentry/react-native depois da instalação.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T3, T5, T9:** Cada plano usa um nome ou valor diferente para a variante. T1: APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production' (with-variant.js recebe dev|prod). T3 (passo 7): process.env.APP_VARIANT === 'dev', que nunca é verdadeiro com a T1, então o sufixo +dev nunca aparece. T10: lê um hipotético EXPO_PUBLIC_APP_ENV. T5: define APP_VARIANT: production, mas grava um .env sem EXPO_PUBLIC_APP_VARIANT e não passa pelo with-variant.js. T9: enum app_variant ('production', 'development').  
  **Resolução:** A T1 publica o contrato: APP_VARIANT ∈ {development, production} no processo de build e EXPO_PUBLIC_APP_VARIANT com o mesmo valor no JS. T3 compara com 'development'. T10 usa EXPO_PUBLIC_APP_VARIANT como environment do Sentry. T9 mantém o enum. No CI, a T5 grava .env.prod e roda os comandos via 'node scripts/with-variant.js prod -- ...', garantindo o mesmo caminho de carga de variáveis e as mesmas travas do build local.
- **Conflito com T1, T3, T2, T9:** Vários planos mexem no mesmo arquivo de configuração. T1 cria app.config.js para as variantes. T3 (passo 7) também cria app.config.js, 'mínimo', para o sufixo de versão. T2 altera a entrada de plugin no app.json. T9 acrescenta o plugin expo-notifications, googleServicesFile e extra.eas.projectId, este último gravado pelo 'eas init', que costuma recusar ou só instruir quando existe configuração dinâmica. T10 acrescenta o plugin do Sentry. T3 e T9 instalam expo-constants cada um por conta própria.  
  **Resolução:** O app.config.js tem um único dono, a T1, que o cria com dois pontos de extensão: overrides por variante e cálculo de version. A T3 só acrescenta buildVersionName dentro dele. Plugins estáticos (expo-notifications, Sentry, assinatura) e extra.eas.projectId ficam no app.json-base; o projectId é colado à mão se o 'eas init' recusar. Em development, a T1 sobrescreve só name, package, scheme, ícone e a opção do plugin de assinatura, sem apagar a lista de plugins. expo-constants é instalado uma única vez, por quem chegar primeiro.
- **Conflito com T1, T2, T3:** Quatro planos alteram as mesmas rotinas do menu.bat ([5], [8], :GRADLE_BUILD). A T1 copia para release\snake-thai-dev-v<versão>.apk e roda via with-variant. A T3 copia para release\snake-thai-v%VERSAO_BUILD%.apk, com '+dev' no nome, e aborta se o android/ estiver desatualizado. A T2 acrescenta :VERIFY_SIGNATURE. A T10 define SENTRY_DISABLE_AUTO_UPLOAD. Os nomes de APK se contradizem e os conflitos de merge são certos.  
  **Resolução:** Editar o menu.bat em sequência, na ordem T1 → T3 → T2 → T10, cada uma rebaseada na anterior. Convenção de nome: release\snake-thai[-dev]-v<saída de 'version.js build-name'>.apk. A verificação de assinatura da T2 roda só no build PROD; em DEV, avisar sem bloquear.
- **Conflito com T5, T9:** O release.yml da T5 não prevê os insumos que T9 e T10 tornam obrigatórios. Com a T9, o app.config lê googleServicesFile (GOOGLE_SERVICES_JSON ou ./google-services.json, fora do Git) e o prebuild falha no CI sem ele. Com a T10, o build de release precisa de SENTRY_AUTH_TOKEN, ou sai com stack ilegível. O projectId do EAS também precisa estar na configuração.  
  **Resolução:** Quando cada uma entrar, atualizar a T5: secret GOOGLE_SERVICES_JSON_BASE64, decodificado em $RUNNER_TEMP e apontado por GOOGLE_SERVICES_JSON; secret SENTRY_AUTH_TOKEN opcional, com SENTRY_DISABLE_AUTO_UPLOAD=true quando ausente. Registrar essas dependências no checklist da T5 e no RUNBOOK.
- **Conflito com T6, T7, T8, T9, T11:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Decisão consolidada (T1 + T3 + T5 + T9 + T10):** Contrato da variante (nomes e valores).  
  **Recomendação:** APP_VARIANT e EXPO_PUBLIC_APP_VARIANT com 'development' | 'production'; padrão production, com o .env antigo renomeado para .env.prod. O CI usa .env.prod e with-variant.js. Decisão técnica, só para o usuário ciente.
- **Decisão consolidada (T10):** Ferramenta e região do monitoramento de erros.  
  **Recomendação:** Sentry (plano Developer, grátis), organização na UE (escolha irreversível). Identificação por id de instalação aleatório mais papel (role). Um projeto só, separado por environment. Só log.error vira evento. Gatilho de diagnóstico só fora de produção.
- **Decisão consolidada (T7 + T9 + T10):** Atualização da Política de Privacidade.  
  **Recomendação:** Uma única nova versão em legal_documents, cobrindo exclusão e retenção (T7), push com Expo e Google (T9) e Sentry (T10), aprovada pelo usuário antes do release que traz a primeira dessas funcionalidades.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T10.md` escrito
