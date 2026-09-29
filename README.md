# Snake Thai 🐍

App mobile para **gestão e controle de alunos de academia**: perfis, turmas/aulas,
presença (check-in), planos e pagamentos (comprovantes PIX). Construído com foco em
**segurança**, **acessibilidade** e **conformidade com a LGPD** para dados sensíveis
(CPF, telefone, data de nascimento).

## ✨ Features (roadmap inicial)

- Autenticação de alunos e administradores com sessão persistida de forma **cifrada**.
- Desbloqueio por **impressão digital opcional**: o app pergunta uma vez, respeita a escolha e deixa um interruptor no perfil.
- Troca de senha pelo próprio usuário (exigindo a senha atual) e **redefinição pelo admin** para a senha de primeiro acesso, que só administradores veem e trocam.
- Política de senha forte com **checklist ao vivo** do que falta (maiúscula, minúscula, número e especial).
- Cadastro de perfis com segregação rígida de acesso por papel (aluno × professor × admin).
- **Professores** com cor característica: bolinha ao lado do nome e borda da aula
  na cor deles (dividida em faixas quando a aula tem mais de um professor). O
  professor vê a agenda inteira da academia, cria aulas para si, entra em aulas
  de outros professores e gerencia a presença apenas das suas — o bloco
  financeiro não aparece para ele.
- Agenda de aulas (rotina e eventos) por turma, com **grade semanal**: o admin
  cadastra os horários fixos de cada turma e o banco gera as aulas até o fim do
  mês seguinte. Editar ou encerrar um horário só muda aulas futuras sem chamada.
- **Turmas** com renomear, excluir e reativar: a turma com histórico é arquivada
  (aulas passadas e frequência preservadas) e o admin escolhe para onde vão os
  alunos.
- **Controle de frequência**: o aluno declara se vem (só sugestivo) e a presença
  vale pela chamada do professor, efetivada em "Concluir chamada". Cada aluno
  vê "Presença em Aulas X/Y · Frequência N%" e o histórico dos meses fechados
  (congelados no dia 1). Ao avisar falta, pode enviar justificativa com
  mensagem de até 255 caracteres e imagem ou PDF, que o professor da aula ou o
  admin aprova ou recusa. Aulas que passam sem chamada geram aviso na agenda.
  Uma chamada não concluída fica guardada no aparelho e volta ao reabrir o app.
  Regras em [`docs/FREQUENCIA.md`](docs/FREQUENCIA.md).
- Gestão de pagamentos com envio e aprovação de comprovantes. Na tela de envio,
  um toque **copia a chave PIX** da academia para a área de transferência — chave
  digitada à mão erra fácil, e o erro só aparece no banco.
- **Notificações push** (Android): lembrete e atraso de mensalidade para o aluno,
  comprovante para analisar para o admin, aprovação e recusa, justificativa e aula
  sem chamada para o professor. Ativação pela pessoa (convite + switch no Perfil),
  texto sem nome nem valor, silêncio das 22h às 7h. Fila no banco, entrega por Edge
  Function pela Expo. Exige conta Expo e Firebase para funcionar; regras e
  publicação em [`docs/NOTIFICACOES.md`](docs/NOTIFICACOES.md).
- **Painel do admin** (primeira aba, só admin): alunos ativos e inativos,
  recebido x esperado do mês, inadimplência por faixa de atraso, faturamento de
  12 meses, frequência média e alunos em risco de evasão, mais o **relatório de
  inadimplência** por aluno para cobrar e dar baixa. Toda a conta é feita no
  banco. Regras em [`docs/PAINEL.md`](docs/PAINEL.md).
- **Mensalidades geradas automaticamente**: no dia 1 de cada mês para todo aluno
  ativo com plano, sem depender de o mês anterior estar quitado. Quem é
  cadastrado até o dia 10 já recebe a fatura proporcional aos dias restantes,
  vencendo no último dia do mês; depois do dia 10, entra na recorrência do mês
  seguinte. A unicidade `(aluno, competência)` impede cobrança duplicada.
- Página **"Meu plano"** para o aluno: plano contratado, benefícios e a
  mensalidade do mês — só leitura (criar e editar é exclusivo do admin).
- **Aviso de atualização** (desde a 1.9.0): uma vez por dia, o app confere a última
  release do GitHub e, se houver versão mais nova, mostra "Nova versão disponível"
  com o link do APK, em qualquer tela. Só informa, nunca bloqueia; sem rede ou no app
  DEV, não aparece. Depende da convenção de release de
  [`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md).

## 🛠️ Tecnologias

- **Mobile:** React Native + Expo (SDK 57) + TypeScript (modo estrito)
- **Backend/BaaS:** Supabase (Auth, Postgres com RLS, Storage)
- **Sessão segura:** Expo SecureStore + AsyncStorage cifrado (AES-256)
- **Monitoramento de erros:** Sentry (opcional), sem dado pessoal — ver [Runbook](docs/RUNBOOK.md#monitoramento-de-erros)

## 🚀 Rodando localmente

### Pré-requisitos do host

Este é um app **React Native (Expo)**, que roda **nativo no host** — não é
containerizável. Instale na sua máquina:

- **Node.js** 20 LTS ou superior — <https://nodejs.org>
- **Git**
- App **Expo Go** no seu celular (Android/iOS) para testar sem build nativo — ou:
  - **Android:** [Android Studio](https://developer.android.com/studio) + **JDK 17**,
    com as variáveis `ANDROID_HOME` e `JAVA_HOME` configuradas no `PATH`.
  - **iOS:** **Xcode** (somente em macOS).
- **Docker Desktop** — o banco de desenvolvimento roda nele, pela Supabase CLI
  (já vem no `npm install`; ela gerencia os próprios containers).

### Passo a passo

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Suba o banco local, popule com dados de demonstração e gere o `.env.dev`:
   ```bash
   scripts\db-dev start     # Linux/Mac: ./scripts/db-dev.sh start
   scripts\db-dev reset
   scripts\db-dev env
   ```

3. Em **outro terminal**, sirva as Edge Functions:
   ```bash
   scripts\db-dev funcoes
   ```

   O `start` sobe o banco, mas **não** as Edge Functions. Sem este comando
   rodando, cadastrar aluno, cadastrar equipe, trocar e-mail e excluir conta
   falham no app com "não foi possível" — a função não existe localmente.

4. Suba o app **DEV** (conectado ao banco local):
   ```bash
   npm start
   ```

5. Abra no **Expo Go** lendo o QR Code, ou pressione `a` (Android) / `i` (iOS).
   Num aparelho físico, o `127.0.0.1` do banco local precisa do `adb reverse`
   das portas 55321 e 3000 — o `menu.bat` faz isso sozinho.

### DEV x produção

O projeto gera **dois apps**, que convivem no mesmo celular:

| | DEV Snake Thai | Snake Thai |
| --- | --- | --- |
| Banco | local, no Docker desta máquina | Supabase de produção |
| Pacote Android | `com.snakethai.app.dev` | `com.snakethai.app` |
| Arquivo de ambiente | `.env.dev` (gerado por `scripts\db-dev env`) | `.env.prod` |
| Marca visual | faixa "DEV · banco local" e ícone âmbar | nenhuma |
| Comando | `npm start` | `npm run start:prod` |

A variante vem de `APP_VARIANT` (`development` ou `production`; sem ela, vale
produção). Os comandos passam por `scripts/with-variant.js`, que carrega o
arquivo certo. Build e app **recusam** combinações perigosas: o DEV apontando
para um servidor da internet, ou o de produção apontando para endereço local ou
sem https. O `.env` simples não é mais lido.

> **Windows:** o `menu.bat` na raiz concentra o dia a dia — subir o Metro, conectar
> o aparelho por ADB Wi-Fi, gerar o APK e instalar. Ele elege um único alvo ADB
> (`ANDROID_SERIAL`), então o erro `more than one device/emulator` não ocorre nem
> quando o mesmo celular está conectado por cabo e por Wi-Fi ao mesmo tempo.
> A opção `[V]` alterna entre DEV e produção, e a seção "Banco local" sobe,
> recria e testa o banco de desenvolvimento.

### Debug x Release — por que o app "não abre sozinho"

O APK **debug** não carrega JavaScript embutido: ele busca o bundle no Metro a
cada abertura. Se o servidor não estiver no ar (ou o `adb reverse` tiver caído),
o app mostra tela preta ou `Unable to load script`. Isso é o comportamento
normal de um build de desenvolvimento — não é falha do aplicativo.

Para usar o app no celular sem depender do computador, gere o **release**, que
empacota o JS dentro do APK:

```text
menu.bat  →  [V] escolher a variante  →  [P] preparar  →  [5] release  →  [9] instalar
```

O APK sai em `release/snake-thai-v<versão>.apk` (produção) ou
`release/snake-thai-dev-v<versão>.apk` (DEV). O DEV nunca é publicado.

> **O release de produção exige a chave de produção configurada** — sem ela o build
> falha de propósito, em vez de sair assinado com a chave de debug, que é pública.
> Como gerar e guardar: [`docs/RELEASE-SIGNING.md`](docs/RELEASE-SIGNING.md). O app DEV
> não precisa de chave.

| | Debug | Release |
| --- | --- | --- |
| Precisa do Metro rodando | Sim | Não |
| Recarrega ao salvar arquivo | Sim | Não (exige novo build) |
| Uso indicado | desenvolvimento | levar no bolso, testar de verdade |

### Porta do Metro

O projeto usa a porta **6969** em vez da 8081 padrão do React Native, que conflita
com qualquer outro projeto RN aberto na máquina. A porta é definida em três lugares
que precisam continuar coerentes:

| Onde | Para quê |
| --- | --- |
| `package.json` (`--port 6969`) | porta em que o servidor Metro sobe |
| `android/gradle.properties` (`reactNativeDevServerPort`) | porta **embutida no APK**, que o app procura ao iniciar |
| `menu.bat` (`METRO_PORT`) | servidor, build (`-PreactNativeDevServerPort`) e liberação da porta |

Como a pasta `android/` não é versionada (fluxo prebuild), um `expo prebuild --clean`
apaga a propriedade do Gradle — o `menu.bat` a reaplica sozinho antes de cada build.
**Trocar a porta exige recompilar o APK**, pois ela vira um resource do binário.

## 📝 Variáveis de Ambiente

Ficam em `.env.dev` (app DEV) e `.env.prod` (app de produção), nenhum dos dois
versionado. Modelo e exemplos de cada um em [`.env.example`](.env.example).

| Variável | Propósito |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública `anon` do Supabase (segura no cliente; proteção real vem das políticas de RLS). |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN do Sentry. **Opcional**: vazio, o monitoramento de erros fica desligado. O token de envio de source maps (`SENTRY_AUTH_TOKEN`) fica só na máquina de build, nunca aqui. |
| `EXPO_PUBLIC_API_URL` | URL do backend na Render. **Opcional**: sem ela o app envia comprovante pelo Supabase Storage, como sempre fez — nada quebra. Ver [`docs/BACKEND.md`](docs/BACKEND.md). |

> **Obsoletas, removidas em 2026-08-31:** `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` e
> `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. Estavam documentadas aqui, mas nenhuma
> linha do app as lia. O `cloudName` e o destino do upload vêm **na resposta** de
> `POST /v1/proofs/sign-upload` — derivados do token verificado, para que o app
> não escolha onde grava.

> A chave `service_role` do Supabase e a **`api_secret` da Cloudinary** **nunca**
> vão para o app nem para o `.env` público — um APK publicado é um arquivo que
> qualquer pessoa baixa e abre. A `api_secret` vive **só na Render**, dentro do
> `snake-server`, que assina o upload e a visualização do comprovante (dado
> financeiro/PII) no servidor. [#37]
>
> *(Uma versão anterior deste README dizia que ela viveria como segredo de uma
> Edge Function. Essa função nunca chegou a existir — a assinatura é feita pelo
> backend próprio.)*

## 🗄️ Banco de Dados (Supabase)

O esquema é versionado em `supabase/migrations/` (migrations first — nunca altere pelo
Dashboard). Toda mudança nasce e é testada no **banco local**; produção só recebe
migration pelo `scripts\db-push-prod.bat`, que faz backup e pede confirmação duas
vezes. O passo a passo está no [Runbook](docs/RUNBOOK.md#banco-de-dados-migrations-e-tipos).

| Comando (`scripts\db-dev …`) | Faz |
| --- | --- |
| `start` / `stop` / `status` | Sobe, para e mostra o Supabase local (portas 553xx) |
| `reset` | Recria o banco local com contas de teste e dados de demonstração |
| `test` | Recria o banco local limpo e roda os testes SQL de `supabase/tests` |
| `types` | Gera `src/types/database.types.ts` a partir do banco local |
| `env` | Gera o `.env.dev` do app |
| `funcoes` | Serve as Edge Functions locais e **fica rodando** |

## 📂 Estrutura

```
snake-thai/
├── App.tsx                 # Componente raiz (Dark Mode)
├── index.ts                # Entry point (registerRootComponent)
├── app.json                # Configuração do Expo (base; versão)
├── app.config.js           # Variante DEV x produção sobre o app.json
├── src/
│   ├── config/             # env.ts — leitura validada de variáveis de ambiente
│   ├── constants/          # theme.ts — design tokens da marca
│   ├── lib/                # supabase.ts (cliente) + secureStorage.ts (sessão cifrada)
│   │                       # + api.ts (cliente HTTP do backend na Render)
│   └── types/              # database.types.ts (gerado pelo Supabase CLI)
├── supabase/migrations/    # Migrations SQL versionadas
└── scripts/                # db-dev (banco local), with-variant, db-push-prod
```

## 📜 Scripts úteis

| Comando | Ação |
| --- | --- |
| `npm start` | Inicia o Metro/Expo do app **DEV** na porta **6969**. |
| `npm run start:prod` | Inicia o Metro/Expo do app de **produção**. |
| `npm run android` / `ios` / `web` | Abre o DEV em uma plataforma específica (mesma porta). |
| `npm run env:dev` | Gera o `.env.dev` a partir do Supabase local. |
| `npm run typecheck` | Checagem de tipos estrita (`tsc --noEmit`). |
| `npm test` | Executa os testes (Jest + React Native Testing Library). |
| `npm run supabase:types` | Gera os tipos a partir do banco local. |
| `npm run legal:publicar -- politica 1.0` | Gera a migration que publica a Política de Privacidade (ou `termos`) aprovada em `docs/legal/`. |

## 🏷️ Versões e publicação

A versão só muda quando um APK é **publicado** para os usuários; APKs de teste e o app
DEV mantêm o número e ganham só um sufixo (ex.: `1.6.0+dev.12.abc1234`). O
`versionCode` do Android é calculado da versão (1.6.0 → 1006000). O que mudou em cada
versão está no [CHANGELOG](CHANGELOG.md); o passo a passo, em
[`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md).

| Comando | Ação |
| --- | --- |
| `npm run versao:minor -- --dry-run` | Simula a próxima versão e mostra o rascunho das notas |
| `npm run versao:patch` / `minor` / `major` | Grava a versão nova e a entrada do CHANGELOG |
| `npm run versao:tag` | Commit de release e tag, sem push |
| `npm run versao:verificar` | Confere a coerência da versão |
| `npm run versao:notas -- v1.7.0` | Notas da versão para o GitHub Release |

O **push da tag** (`git push origin v1.7.0`) dispara o workflow **Release Android** no
GitHub Actions, que compila, confere a assinatura de produção e publica o APK no
GitHub Release. O **nome do APK e a tag seguem uma convenção fixa**: o aviso de
atualização dos aparelhos depende dela (ver "Convenção de release" em
`docs/VERSIONAMENTO.md`). Para um ensaio sem publicar: *Actions → Release Android → Run workflow*
na `main`. Os segredos ficam no Environment `release` do GitHub
([`docs/RELEASE-SIGNING.md`](docs/RELEASE-SIGNING.md)); o `ci.yml` não mudou.

## 📚 Documentação

A documentação completa vive em [`docs/`](docs/README.md):

- **[Manual do Administrador](docs/MANUAL-DO-ADMINISTRADOR.md)** — operar o sistema pelo celular, sem depender do dev.
- **[Arquitetura](docs/ARQUITETURA.md)** — camadas, RLS e Edge Functions (comece aqui se é dev novo no projeto).
- **[Runbook](docs/RUNBOOK.md)** — migrations, tipos, APK, rotação de chaves.
- **[Versionamento](docs/VERSIONAMENTO.md)** — quando a versão muda e como publicar.
- **[Edge Functions](docs/EDGE-FUNCTIONS.md)** — contratos das funções server-side.
- **[Notificações push](docs/NOTIFICACOES.md)** — quem recebe o quê, publicação e monitoramento.
- Auditorias: [REVIEW.md](REVIEW.md) · [SECURITY.md](SECURITY.md) · [LICENSE_AUDIT.md](LICENSE_AUDIT.md)

## ⚡ Edge Functions

Operações que exigem a `service_role` (nunca exposta no app) vivem em Edge
Functions Deno, e todas verificam pelo JWT que quem chama é **administrador**:

| Função | O que faz |
| --- | --- |
| `create-student` | Cria a conta do aluno com a senha de primeiro acesso (configurada pelo admin, guardada fora do alcance do app) e inicializa o perfil. |
| `create-staff` | Cria a conta de **professor ou admin** já com nome e CPF preenchidos (e a cor, no caso do professor). Mantém `is_first_login`, então a pessoa ainda troca a senha de primeiro acesso e aceita os termos — só não redigita o cadastro. |
| `reset-student-password` | Devolve a conta à senha de primeiro acesso e remarca `is_first_login`, forçando nova senha no próximo acesso. |

```bash
supabase functions deploy create-student
supabase functions deploy create-staff
supabase functions deploy reset-student-password
```

> A `service_role` ignora a RLS, mas **não** os GRANTs do Postgres: a migration
> `20260819120000_service_role_grants.sql` concede a ela `select/insert/update`
> em `profiles` — sem isso as funções falham com `42501`.

## 🌱 Dados de demonstração

Dados de demonstração vivem **só no banco local**. Um comando recria tudo
(50 alunos, 5 professores, turmas, mensalidades em vários estados e professores
coloridos nas aulas):

```bash
scripts\db-dev reset
```

Ele roda, em ordem, `supabase/seed/local_base.sql` (planos, turmas e as contas de
teste locais), `demo_seed.sql` e `demo_seed_historico.sql`. As seeds de
demonstração **se recusam a rodar** num banco que tenha conta fora dos domínios
de teste, justamente para não misturar dado fictício com gente real.

O histórico cria os **últimos 3 meses**: agenda, chamada concluída em toda aula já
terminada (inclusive as do mês corrente), justificativas revisadas, meses de
frequência congelados e mensalidades em dia, com atraso e em aberto. Também é
idempotente e relativo ao dia em que roda: rodar de novo depois só conclui as
chamadas das aulas que terminaram nesse meio-tempo. Chamada feita por
professor de verdade e mensalidade com comprovante nunca são sobrescritas.

> **Produção ainda tem dados fictícios de antes do banco local.** Antes de
> cadastrar o primeiro aluno real, faça backup e rode
> `supabase/seed/demo_seed_limpar.sql` no banco de produção. Ele apaga
> somente o domínio de demonstração — contas reais não são tocadas. Dado
> fictício convivendo com dado real é pior do que base vazia, porque em poucas
> semanas ninguém distingue mais um do outro.
