# Runbook Operacional — Snake Thai

> Procedimentos técnicos recorrentes, com o comando exato. Para desenvolvedores.
> O setup inicial está no `README.md`; aqui ficam as operações do dia a dia e as
> de manutenção. Segredos aparecem só como nome de variável — nunca com valor.

## Índice

- [Ambiente de desenvolvimento (menu.bat)](#ambiente-de-desenvolvimento-menubat)
- [Banco de dados: migrations e tipos](#banco-de-dados-migrations-e-tipos)
- [Edge Functions: deploy](#edge-functions-deploy)
- [APK: gerar e instalar](#apk-gerar-e-instalar)
- [Qualidade: o que o CI roda](#qualidade-o-que-o-ci-roda)
- [Rotação de chaves e segredos](#rotacao-de-chaves-e-segredos)

---

## Ambiente de desenvolvimento (menu.bat)

No Windows, `menu.bat` na raiz concentra o dia a dia. Ele elege um único
aparelho ADB (evita o erro `more than one device`) e cuida do `adb reverse`.

| Opção | Faz |
| --- | --- |
| `[1]` | Sobe o Metro (porta 6969, cache limpo) e cria o `adb reverse` |
| `[2]` | Conecta o aparelho por ADB Wi-Fi (mDNS) |
| `[7]` | Pareia o aparelho pela primeira vez |
| `[8]` / `[5]` | Gera APK Debug / Release |
| `[9]` | Instala o APK no aparelho |
| `[P]` | `expo prebuild` — gera a pasta `android/` |
| `[6]` | Limpeza profunda (cache Metro + build) |
| `[D]` | Desfaz conexões ADB duplicadas |

**Ritual quando o PC dorme ou o ADB reinicia:** `[2]` conectar → `[1]` Metro →
abrir o app. Só o APK instalado não basta em build debug — ele busca o
JavaScript no Metro a cada abertura.

Sem o menu, os equivalentes npm:

```bash
npm start            # Metro na porta 6969
npm run typecheck    # tsc --noEmit
npm test             # Jest
```

---

## Banco de dados: migrations e tipos

**Regra de ouro:** nunca altere o esquema pelo Dashboard. Toda mudança é uma
migration versionada (migrations first).

```bash
# 1. Criar uma migration nova
supabase migration new <nome_descritivo>

# 2. Aplicar as migrations pendentes no projeto remoto
#    (exige SUPABASE_ACCESS_TOKEN no ambiente — ver rotação de chaves)
supabase db push

# 3. Sincronizar os tipos do TypeScript com o esquema
npx supabase gen types typescript --project-id <PROJECT_REF> > src/types/database.types.ts
```

> **Sempre rode o passo 3 depois de mudar o esquema.** O TypeScript estrito vai
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

```bash
# Debug — precisa do Metro rodando; recarrega ao salvar
menu.bat  →  [8] gerar  →  [9] instalar

# Release — JS embutido, roda sem o Metro (é o que se instala "de verdade")
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
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

Nenhum segredo vive no repositório (`.env` está no `.gitignore`). Os que existem:

| Variável | Onde | Rotacionar quando |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (app) | nunca — é público |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` (app) | se comprometida; é pública, protegida pela RLS |
| `SUPABASE_ACCESS_TOKEN` | ambiente do dev (CLI) | se vazar; **nunca** commitar |
| `service_role key` | só no runtime das Edge Functions | se vazar — dá acesso total, ignora RLS |

**Se a `service_role` vazar**, rotacione **imediatamente** no painel do Supabase
(Project Settings → API). Ela ignora toda a RLS: quem a tem lê e apaga o banco
inteiro.

**A chave `anon`/publishable** pode aparecer no bundle do APK sem problema — é
pública por design, e a proteção real são as políticas de RLS. A `service_role`
e o `SUPABASE_ACCESS_TOKEN` **jamais** podem estar no app ou no Git.
