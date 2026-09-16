# ENTREGA — T1: separar dev de produção

| Campo | Valor |
|---|---|
| **Tarefa** | `T1` |
| **Plano** | [`PLANO-T1.md`](PLANO-T1.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **PRs** | `snake-thai` #12 (`feat/ambiente-dev`) · `snake-server` #16 (`chore/ambiente-dev-local`) |
| **Status** | 🟡 Código pronto e verificado; faltam instalação no celular, credenciais Cloudinary de dev e a decisão sobre os dados de demo em produção |

---

## 1. O que foi feito

Agora existem dois apps e dois bancos. O **DEV Snake Thai** (pacote `com.snakethai.app.dev`,
faixa âmbar "DEV · banco local") fala só com um Supabase que roda no Docker desta
máquina, com as mesmas 27 migrations de produção, contas de teste próprias e os dados de
demonstração. O **Snake Thai** continua igual e fala só com produção. Uma regra única,
conferida no build e no boot do app, recusa as combinações perigosas. Produção passa a
receber migration apenas por um script com backup e confirmação dupla.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/config.toml` | Postgres 17 (igual a produção), portas 553xx, realtime/analytics desligados, redirect `snakethai-dev://` |
| `.github/workflows/ci.yml` | Só a porta do `psql` (54322 → 55322) |
| `supabase/tests/regressao_c3_payment_whitelist.sql` | Insert com `reference_month` (o CI estava vermelho) |
| `supabase/tests/*.sql` | Cabeçalhos: rodar só no banco local |
| `supabase/seed/local_base.sql` | Planos, turmas e 4 contas de teste locais; aborta se o banco já tiver contas |
| `supabase/seed/demo_seed*.sql` | Trava: abortam se houver conta fora dos domínios de teste |
| `scripts/db-dev.bat` / `.sh` | `start`, `stop`, `status`, `reset`, `test`, `types`, `env` — tudo `--local` |
| `scripts/db-push-prod.bat` | Único caminho para produção: confirmação, backup, `--dry-run`, confirmação, push, conferência |
| `scripts/with-variant.js`, `scripts/gerar-env-dev.js` | Carregam `.env.dev`/`.env.prod`; geram o `.env.dev` do banco local |
| `src/config/regrasDeAmbiente.js` (+ `.d.ts`) | A regra DEV × produção, usada no build e no boot |
| `app.config.js`, `plugins/withDevCleartext.js` | Variante DEV sobre o `app.json`; HTTP só para endereços locais e só no DEV |
| `src/config/env.ts` | `appVariant` e trava no boot |
| `src/components/DevBanner.tsx`, `App.tsx`, `src/theme/colors.ts` | Faixa DEV com tokens `devBanner`/`onDevBanner` (10,3:1) e área segura própria |
| `menu.bat` | `[V]` variante, prebuild por variante, reverse 55321/3000, banco local `[B] [S] [R] [T]`, `--variant` |
| `package.json`, `.env.example` | `start` = DEV, `start:prod`, `env:dev`; tipos do banco local |
| `README.md`, `docs/RUNBOOK.md`, `docs/ARQUITETURA.md`, `CLAUDE.md` | Ambientes, portas, fluxo "local primeiro", demo só no local |
| `snake-server` | Compose de dev lê `.env.dev` (Supabase local via `host.docker.internal`, Cloudinary de dev); scripts e docs |
| Local, fora do Git | `.env` → `.env.prod`; `.env.dev` do app e do servidor gerados; `android/` gerada para a variante DEV (`[V]` + `[P]` volta para produção) |

## 3. Como validar

1. `scripts\db-dev start` e depois `scripts\db-dev test` → "Todos os testes SQL passaram."
2. `scripts\db-dev reset` → contas: 1 admin, 5 professores, 50+ alunos.
3. `node scripts/with-variant.js dev -- npx expo config --type public --json` → `DEV Snake Thai`, `com.snakethai.app.dev`.
4. `menu.bat --variant` → `VARIANTE=dev`, `ENV=.env.dev presente`.
5. No celular: `menu.bat` → `[2]` conectar → `[9]` instalar → abrir **DEV Snake Thai** e entrar com uma conta de `supabase/seed/local_base.sql`.

## 4. Verificações executadas

- [x] 27 migrations aplicadas do zero em PG17; cron jobs e bucket presentes
- [x] Esquema `public` local = tipos versionados (nenhuma diferença)
- [x] `db-dev test`: todas as regressões verdes; `db-dev reset`: admin 1, professor 5, user 50, 139 chamadas, 3 meses congelados
- [x] Login local 200 (senha errada 400); seeds de demo recusadas num banco com conta real
- [x] `expo config` das duas variantes; produção idêntica ao `app.json`
- [x] Typecheck + Jest: 349 testes (25 novos)
- [x] Prebuild DEV: pacote, nome, scheme, ícone âmbar e `network_security_config`
- [x] `menu.bat --variant`, `--device`; `[V]` troca e avisa sobre produção
- [x] `db-push-prod.bat` recusa sem chamar a CLI
- [x] `snake-server` dev: `/health` 200; `sign-upload` 200 com token do Supabase local (o emissor do token não atrapalha); 235 testes
- [x] APK DEV gerado (`release/snake-thai-dev-v1.6.0.apk`, 14 min): `aapt2` mostra `com.snakethai.app.dev` / "DEV Snake Thai" e `networkSecurityConfig` só nele (o APK de produção não tem); o JavaScript embutido aponta para `127.0.0.1:55321` e não contém o endereço de produção
- [x] CI dos PRs #12 e #16 verde (inclui a regressão SQL na porta 55322)
- [ ] APK DEV instalado ao lado do de produção — **nenhum aparelho conectado** durante a execução
- [ ] Envio real de arquivo no DEV — depende das credenciais Cloudinary de desenvolvimento

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | Portas 553xx | Convive com a stack do radar-tributario | Trocar em `config.toml`, `ci.yml`, `regrasDeAmbiente`/docs |
| P2 | `adb reverse` em vez de IP da rede | Nada exposto na rede nem fixo no APK | Liberar o IP em `regrasDeAmbiente.js` (faixas privadas já aceitas) e no plugin de cleartext |
| P3 | Cloudinary de dev separada | Teste local nunca apaga arquivo real | — |
| P4 | Cor de fundo do ícone + faixa, sem arte nova | Resolve sem depender de designer | Ícone próprio em `assets/dev/` |
| P5 | Sem `APP_VARIANT`, vale produção | Nunca cair num banco de teste sem querer | — |
| P6 | Só o APK de **release** é copiado para `release/` | O debug depende do Metro e não serve para distribuir | Chamar `:COPIA_RELEASE` também no `[8]` |

## 6. Decisão visual

Mockup: não — componente pequeno dentro do padrão existente. A `design-de-interface-projeto`
definiu a faixa "DEV · banco local" abaixo da barra de status (que fica na cor do fundo,
para os ícones do sistema continuarem legíveis), tokens nos dois temas, `accessibilityRole="text"`
com rótulo descritivo e um `SafeAreaProvider` próprio para o conteúdo não somar a área segura duas vezes.

## 7. Pendências

- [ ] 👤 Conectar o celular (`menu.bat` → `[2]`) para instalar o APK DEV mais recente de `release\` (`snake-thai-dev-v1.6.0+dev.25.9289a3e.apk`, com a T3) ao lado do app de produção
- [ ] 👤 Criar o ambiente Cloudinary de desenvolvimento e colar as 3 credenciais em `snake-server/.env.dev` (hoje com marcadores `PREENCHER_AMBIENTE_DEV`)
- [ ] 👤 Checagem somente leitura de produção com o seu token: `npx supabase migration list --linked` e `npx supabase db diff --linked --schema public,storage`
- [ ] 👤⚠️ **Dados de demonstração em produção — decisão sua.** O plano recomendava trocar agora a senha das contas de demo e de teste. Mas, na publicação da 1.6.0, você disse que não era preciso mudar a senha dos demais, então **nada foi alterado**. Antes do primeiro aluno real: backup e `supabase/seed/demo_seed_limpar.sql`, e informar qual e-mail é a sua conta real de admin
- [ ] ⚠️ Merge do PR #16 do `snake-server` dispara deploy na Render (mesmo código; só compose, scripts e docs mudam) — com a sua confirmação
- [ ] Observação: o `.env` local do `snake-server` tem `SUPABASE_SERVICE_ROLE_KEY`, que o README manda manter só na sessão do script de migração. Não foi mexido; vale remover se não estiver em uso

## 8. Próximo passo

**T3 — número de versão** (script de versão, `versionCode` calculado e sufixo `+dev` no app DEV,
aproveitando o `app.config.js` desta tarefa).
