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

**Ordem das migrations importa.** Uma constraint aplicada antes do backfill dos
dados existentes falha (aconteceu com `payments.paid_at`). Se a migration mexe
em dados já gravados, faça o `UPDATE` de compatibilidade **antes** da constraint,
na mesma migration.

---

## Edge Functions: deploy

```bash
supabase functions deploy create-student
supabase functions deploy reset-student-password
supabase functions deploy delete-my-account
```

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

O release é copiado para `release\snake-thai-v<versão>.apk` (produção) ou
`release\snake-thai-dev-v<versão>.apk` (DEV). Os dois apps convivem no aparelho,
porque são pacotes diferentes. **APK DEV nunca vai para o GitHub Releases.**

Sem o menu, o equivalente do release DEV:

```bash
node scripts/with-variant.js dev -- npx expo prebuild --platform android --clean
cd android && node ../scripts/with-variant.js dev -- ./gradlew assembleRelease
adb reverse tcp:55321 tcp:55321 && adb reverse tcp:3000 tcp:3000
```

**A porta do Metro é embutida no APK.** Trocar a porta 6969 exige recompilar —
ela vira um resource do binário (`react_native_dev_server_port`).

**Assinatura:** o release atual usa a chave de debug (ver `android/app/build.gradle`).
**Antes de publicar em loja, gere uma keystore própria** e configure o
`signingConfig` — a chave de debug é pública e não serve para produção.

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
| `service_role key` | só no runtime das Edge Functions | se vazar — dá acesso total, ignora RLS |

**Se a `service_role` vazar**, rotacione **imediatamente** no painel do Supabase
(Project Settings → API). Ela ignora toda a RLS: quem a tem lê e apaga o banco
inteiro.

**A chave `anon`/publishable** pode aparecer no bundle do APK sem problema — é
pública por design, e a proteção real são as políticas de RLS. A `service_role`
e o `SUPABASE_ACCESS_TOKEN` **jamais** podem estar no app ou no Git.
