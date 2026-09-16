# Runbook Operacional — Snake Thai

> Procedimentos técnicos recorrentes, com o comando exato. Para desenvolvedores.
> O setup inicial está no `README.md`; aqui ficam as operações do dia a dia e as
> de manutenção. Segredos aparecem só como nome de variável — nunca com valor.

## Índice

- [Ambientes: DEV x produção](#ambientes-dev-x-produção)
- [Ambiente de desenvolvimento (menu.bat)](#ambiente-de-desenvolvimento-menubat)
- [Banco de dados: migrations e tipos](#banco-de-dados-migrations-e-tipos)
- [Edge Functions: deploy](#edge-functions-deploy)
- [APK: gerar e instalar](#apk-gerar-e-instalar)
- [Monitoramento de erros](#monitoramento-de-erros)
- [Qualidade: o que o CI roda](#qualidade-o-que-o-ci-roda)
- [Rotação de chaves e segredos](#rotacao-de-chaves-e-segredos)

---

## Ambientes: DEV x produção

| | DEV Snake Thai | Snake Thai (produção) |
| --- | --- | --- |
| Banco | Supabase CLI no Docker desta máquina | projeto Supabase de produção |
| Pacote Android | `com.snakethai.app.dev` | `com.snakethai.app` |
| Ambiente | `.env.dev` — `scripts\db-dev env` | `.env.prod` — copiado do `.env.example` |
| Marca | faixa "DEV · banco local", ícone âmbar | — |

**Portas do Supabase local:** API 55321, banco 55322, Studio 55323, e-mails de
teste 55324. Não são as 543xx padrão porque outro projeto da máquina já as usa.

**Celular falando com o banco local:** o app DEV usa `http://127.0.0.1:55321`,
e no celular esse endereço é o próprio celular. O `adb reverse` das portas 55321
e 3000 leva a conexão para o PC; o `menu.bat` cria sozinho ao subir o Metro e
depois de instalar. Se o adb reconectar (PC dormiu, Wi-Fi trocou), o DEV mostra
erro de rede até o reverse ser refeito (`[2]` e depois `[1]`). O HTTP sem TLS é
liberado só no DEV e só para `127.0.0.1`, `localhost` e `10.0.2.2`.

**Contas de teste locais** (admin, professor, aluno em dia e aluno inadimplente):
e-mails e senha no cabeçalho de `supabase/seed/local_base.sql`. Existem só no
banco local, que é recriado a cada `scripts\db-dev reset`.

**Trava de ambiente:** `src/config/regrasDeAmbiente.js` é lido no build
(`app.config.js`, `with-variant.js`) e no boot do app (`env.ts`). DEV com
endereço da internet, ou produção com endereço local ou sem https, param ali —
antes de gravar qualquer coisa.

**Firewall:** a Supabase CLI publica as portas em todas as interfaces. Mantenha o
firewall do Windows ativo, principalmente em rede pública: o Postgres local usa
usuário e senha padrão.

---

## Ambiente de desenvolvimento (menu.bat)

No Windows, `menu.bat` na raiz concentra o dia a dia. Ele elege um único
aparelho ADB (evita o erro `more than one device`) e cuida do `adb reverse`.

O menu abre na variante **DEV**; cabeçalho e cor mostram qual está ativa.

| Opção | Faz |
| --- | --- |
| `[V]` | Alterna a variante DEV / produção |
| `[1]` | Sobe o Metro (porta 6969, cache limpo) e cria o `adb reverse` |
| `[2]` | Conecta o aparelho por ADB Wi-Fi (mDNS) |
| `[7]` | Pareia o aparelho pela primeira vez |
| `[8]` / `[5]` | Gera APK Debug / Release da variante (recusa se `android/` for da outra) |
| `[9]` | Instala o APK da variante no aparelho |
| `[P]` | `expo prebuild` — gera `android/` para a variante (troca de variante = `--clean`) |
| `[B]` / `[S]` | Sobe / para o banco local (o `[B]` gera o `.env.dev` se faltar) |
| `[R]` | Recria o banco local com dados de demonstração (pede confirmação) |
| `[T]` | Testes SQL no banco local, recriado limpo (pede confirmação) |
| `[6]` | Limpeza profunda (cache Metro + build) |
| `[D]` | Desfaz conexões ADB duplicadas |

**Ritual quando o PC dorme ou o ADB reinicia:** `[B]` banco local (se parou) →
`[2]` conectar → `[1]` Metro → abrir o app. Só o APK instalado não basta em build debug — ele busca o
JavaScript no Metro a cada abertura.

Sem o menu, os equivalentes npm:

```bash
npm start            # Metro do DEV na porta 6969
npm run start:prod   # Metro do app de produção
npm run typecheck    # tsc --noEmit
npm test             # Jest
```

---

## Banco de dados: migrations e tipos

**Regra de ouro:** nunca altere o esquema pelo Dashboard. Toda mudança é uma
migration versionada (migrations first), provada **no banco local primeiro**.

> A CLI está vinculada ao projeto de produção: um `db push` ou `db reset` digitado
> sem `--local` acerta o banco real. Os scripts `db-dev` passam `--local` sempre,
> e produção só muda pelo `db-push-prod.bat`.

```bash
# 1. Criar a migration
npx supabase migration new <nome_descritivo>

# 2. Provar no banco local limpo: aplica todas as migrations e roda supabase/tests
scripts\db-dev test

# 3. Recriar com dados de demonstração e testar no app DEV
scripts\db-dev reset

# 4. Sincronizar os tipos do TypeScript com o banco local e commitar
scripts\db-dev types

# 5. PR e merge na main

# 6. Aplicar em produção — backup, simulação e confirmação dupla
#    (exige SUPABASE_ACCESS_TOKEN; os backups ficam em %USERPROFILE%\snake-thai-backups)
scripts\db-push-prod.bat

# 7. Se mudou Edge Function
npx supabase functions deploy <nome>
```

O `db-push-prod.bat` termina listando as migrations de produção
(`migration list --linked`), para conferir que a nova entrou.

> **Sempre rode o passo 4 depois de mudar o esquema.** O TypeScript estrito vai
> acusar qualquer coluna que a migration criou e o código ainda não conhece —
> é o que pega o mock de teste desatualizado antes de virar bug.

### Jobs agendados do banco (pg_cron)

Os jobs são criados nas próprias migrations e rodam em UTC.

| Job | Quando (UTC) | O que faz |
|---|---|---|
| `mark-overdue-payments` | 00:01 todo dia | Marca mensalidades vencidas |
| `generate-monthly-payments` | 00:10 do dia 1 | Gera as mensalidades do mês |
| `expire-payment-proofs` | 02:30 todo dia | Prazo de guarda das imagens de comprovante (desligado sem prazo) |
| `close-monthly-attendance` | 03:20 do dia 1 | Fecha e congela a frequência do mês anterior |
| `generate-scheduled-classes` | 03:40 todo dia (00:40 em São Paulo) | Gera as aulas da grade semanal até o fim do mês seguinte |
| `push-*` (5 jobs) | ver [`NOTIFICACOES.md`](NOTIFICACOES.md) | Lembretes, avisos de chamada, despacho (a cada minuto) e limpeza |

Falha de job aparece como aviso no **Painel** do admin (L3, `saude_das_rotinas()`),
sem a mensagem de erro. Para ver o detalhe, no SQL Editor:

```sql
select j.jobname, d.status, d.return_message, d.start_time
  from cron.job_run_details d join cron.job j using (jobid)
 order by d.start_time desc
 limit 20;
```

### Senha de primeiro acesso

Vive em `academy_secrets` (só `service_role`); o admin lê e troca em
Configurações, e as Edge Functions de conta usam esse valor. A coluna
`academy_settings.default_student_password` é obsoleta e guarda só `********`
(o APK 1.6.0 ainda a lê e grava; um gatilho leva o que ele gravar para a tabela
protegida). Contas que ainda não fizeram o primeiro acesso — continuam com a
senha vigente quando foram criadas:

```sql
select p.id, p.role, p.created_at
  from public.profiles p
 where p.is_first_login and p.anonymized_at is null and p.status = 'active'
 order by p.created_at;
```

Depois de trocar a senha, redefina essas contas pelo app (Gerenciar alunos → chave).

### Política de Privacidade e Termos de Uso

- **Publicação:** só por migration gerada a partir do texto aprovado
  (`npm run legal:publicar -- politica 1.0`).
- **Imutável:** documento publicado não muda; para corrigir, publica-se outra versão, e
  todos aceitam de novo.
- **Recusa:** `publicar_documento_legal` recusa texto com `[PREENCHER`.
- **Consultas:** quem ainda não aceitou e a prova de aceite de uma pessoa estão em
  [`legal/README.md`](legal/README.md).

**Ordem das migrations importa.** Uma constraint aplicada antes do backfill dos
dados existentes falha (aconteceu com `payments.paid_at`). Se a migration mexe
em dados já gravados, faça o `UPDATE` de compatibilidade **antes** da constraint,
na mesma migration.

---

## Edge Functions: deploy

Só com aprovação, **sempre com o projeto explícito** (a CLI está vinculada à
produção):

```bash
npx supabase functions deploy create-student --project-ref <PROJECT_REF>
npx supabase functions deploy create-staff --project-ref <PROJECT_REF>
npx supabase functions deploy reset-student-password --project-ref <PROJECT_REF>
npx supabase functions deploy delete-my-account --project-ref <PROJECT_REF>
npx supabase functions deploy delete-user-account --project-ref <PROJECT_REF>
npx supabase functions deploy admin-update-user-email --project-ref <PROJECT_REF>
npx supabase functions deploy send-push --no-verify-jwt --project-ref <PROJECT_REF>
```

A `send-push` também precisa dos segredos `PUSH_DISPATCH_SECRET`,
`PUSH_APP_VARIANT` e `EXPO_ACCESS_TOKEN` (`npx supabase secrets set`) e de
`push_project_url` e `push_dispatch_secret` no Vault — passo a passo, monitoramento
e rotação em [`NOTIFICACOES.md`](NOTIFICACOES.md).

As de conta (`delete-*`, `admin-update-user-email`) dependem das funções SQL da
migration `lgpd_exclusao_de_conta`: aplique a migration **antes** de publicá-las.

No banco local, uma função **nova** só aparece depois de `scripts\db-dev stop` e
`start` (a lista de funções é fixada quando o contêiner nasce).

Os segredos (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
são injetados automaticamente pelo runtime das Edge Functions — não precisam ser
configurados manualmente. Contratos em [`EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md).

**GRANTs importam.** A `service_role` ignora a RLS, mas **não** os GRANTs do
Postgres. Uma função que escreve numa tabela nova precisa de
`grant ... to service_role` na migration, senão falha com `42501`.

---

## APK: gerar e instalar

```text
# Escolha a variante primeiro ([V]); troca de variante exige [P] de novo.

# Debug — precisa do Metro rodando; recarrega ao salvar
menu.bat  →  [P] preparar  →  [8] gerar  →  [9] instalar

# Release — JS embutido, roda sem o Metro (é o que se instala "de verdade")
menu.bat  →  [P] preparar  →  [5] gerar  →  [9] instalar
```

O release é copiado para `release\snake-thai-v<nome do build>.apk` (produção) ou
`release\snake-thai-dev-v<nome do build>.apk` (DEV) — ex.: `snake-thai-v1.7.0.apk`
num build exatamente na tag. Antes de compilar, o `[5]` confere se a pasta
`android/` está com o versionCode e o versionName atuais; se não, rode `[P]`.

**Publicar uma versão** (número novo, tag, GitHub Release) segue o passo a passo de
[`VERSIONAMENTO.md`](VERSIONAMENTO.md). A versão só muda quando um APK é publicado; o
push da tag dispara o workflow **Release Android**, que compila e publica. Os dois apps convivem no aparelho,
porque são pacotes diferentes. **APK DEV nunca vai para o GitHub Releases.**

Sem o menu, o equivalente do release DEV:

```bash
node scripts/with-variant.js dev -- npx expo prebuild --platform android --clean
cd android && node ../scripts/with-variant.js dev -- ./gradlew assembleRelease
adb reverse tcp:55321 tcp:55321 && adb reverse tcp:3000 tcp:3000
```

**A porta do Metro é embutida no APK.** Trocar a porta 6969 exige recompilar —
ela vira um resource do binário (`react_native_dev_server_port`).

**Assinatura:** o release de **produção** só compila com a keystore de produção
configurada (`SNAKETHAI_RELEASE_*` em `%USERPROFILE%\.gradle\gradle.properties`); sem
ela o build para com "Release sem keystore de producao". O `[5]` em PROD mostra o
certificado do APK e avisa se saiu com a chave de debug. O app **DEV** assina com a
chave de debug e não é publicado. Gerar, guardar e cadastrar a chave:
[`RELEASE-SIGNING.md`](RELEASE-SIGNING.md).

---

## Monitoramento de erros

Erros e travamentos do app vão para o **Sentry** (plano gratuito: 5 mil erros por
mês, 30 dias de retenção). Código em `src/lib/monitoring` — o único lugar que
importa o SDK.

**Desligado** sem `EXPO_PUBLIC_SENTRY_DSN` e no Metro em modo debug. Um `.env` sem
DSN gera um app que funciona normalmente, só sem monitoramento.

**O que sai do aparelho:** o erro (tipo, mensagem filtrada e stack), a versão do app,
o modelo e o sistema do aparelho, um **id aleatório da instalação** e o **papel**
(admin/professor/aluno). **Não sai:** nome, e-mail, CPF, telefone, IP, token, query
string de URL, captura de tela, logs do console. Os filtros estão em
`src/lib/monitoring/scrub.ts`; falha de rede (aparelho sem internet) não vira evento.

**O que vira evento:** `log.error` (via o logger), erro de renderização
(`AppErrorBoundary`) e travamento nativo. `log.warn` e `log.info` só viram trilha
anexada ao próximo erro. DEV e produção ficam separados pelo `environment`.

**Configurar (uma vez):**

1. No Sentry: organização (a região, UE ou EUA, não muda depois), projeto React
   Native, e em *Settings → Security & Privacy* ligar "Prevent Storing of IP
   Addresses" e os *Data Scrubbers*.
2. DSN do projeto em `EXPO_PUBLIC_SENTRY_DSN` no `.env.dev` e no `.env.prod`.
3. Token de organização (*Settings → Developer Settings → Organization Tokens*) só
   na máquina de build, junto com os slugs: arquivo `.env.sentry-build-plugin` na
   raiz (ignorado pelo Git) com `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT`.
   No GitHub Actions: secret `SENTRY_AUTH_TOKEN` e variáveis `SENTRY_ORG` e
   `SENTRY_PROJECT` no Environment `release`, e o DSN no secret `EXPO_PUBLIC_SENTRY_DSN`.
4. Uma regra de alerta por e-mail para *issue* nova em `environment:production`.

**Sem o token**, o build não quebra: o `menu.bat` e o workflow desligam o envio de
source maps e avisam — o erro chega ao painel, mas com o stack ilegível
(`index.android.bundle:1:NNNN`).

**Testar:** no app **DEV**, Perfil → *Diagnóstico de erros* → "Enviar erro de
teste", "Erro de tela" ou "Travamento nativo" (o travamento só é enviado na próxima
abertura). A linha não existe no app de produção. No painel, o evento deve mostrar
frames em `src/…`, `environment: development` e nenhum dado pessoal.

**Se a cota estourar:** procure a *issue* que mais cresceu (costuma ser um erro em
laço), corrija, e enquanto isso use *Spike Protection*/rate limit da Client Key no
painel. **Rotação:** um token vazado é revogado em *Organization Tokens*; o DSN
exposto pode ser trocado criando outra Client Key (exige novo APK).

---

## Qualidade: o que o CI roda

A cada push e PR (`.github/workflows/ci.yml`):

```bash
npm run typecheck      # tipos
npm test               # 125 testes
npm run check:licenses # barra GPL/AGPL na árvore de produção
npm run audit:prod     # CVE crítico de produção (bloqueia)
npm run audit:report   # CVE high (informativo, não bloqueia)
```

Para reproduzir o gate localmente antes de commitar: `npm run ci`.

O `pre-commit` (Husky) já roda o `typecheck` como gate local. O CI repete e
adiciona testes, licenças e CVE.

---

## Rotação de chaves e segredos

Nenhum segredo vive no repositório (`.env.*` está no `.gitignore`). Os que existem:

| Variável | Onde | Rotacionar quando |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env.prod` / `.env.dev` (app) | nunca — é público |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env.prod` / `.env.dev` (app) | se comprometida; é pública, protegida pela RLS |
| `SUPABASE_ACCESS_TOKEN` | ambiente do dev (CLI) | se vazar; **nunca** commitar |
| `EXPO_PUBLIC_SENTRY_DSN` | `.env.prod` / `.env.dev` (app) | se for abusado (eventos falsos); vai no APK |
| `SENTRY_AUTH_TOKEN` | `.env.sentry-build-plugin` (máquina de build) e secret do Actions | se vazar; **nunca** no app nem no Git |
| `service_role key` | só no runtime das Edge Functions | se vazar — dá acesso total, ignora RLS |

**Se a `service_role` vazar**, rotacione **imediatamente** no painel do Supabase
(Project Settings → API). Ela ignora toda a RLS: quem a tem lê e apaga o banco
inteiro.

**A chave `anon`/publishable** pode aparecer no bundle do APK sem problema — é
pública por design, e a proteção real são as políticas de RLS. A `service_role`
e o `SUPABASE_ACCESS_TOKEN` **jamais** podem estar no app ou no Git.
