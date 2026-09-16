# Versionamento — Snake Thai

> Como o número de versão do app muda, e como publicar uma versão. Para quem
> desenvolve e publica o APK.

## Regra de ouro

**A versão só muda quando um APK é publicado para os usuários.**

Não mudam a versão: commits, PRs, merges, APKs de teste, o app DEV, deploy do
`snake-server`, migrations, seeds, documentação e atualizações do Dependabot.

Antes desta regra, cada APK de teste ganhava um número novo (três versões em 14
minutos em 09/09). O número deixava de dizer qualquer coisa.

## Qual parte sobe

A versão segue `MAJOR.MINOR.PATCH`. Vale a maior mudança que o release contém:

| Parte | Quando | Exemplo |
| --- | --- | --- |
| **PATCH** | Só correções e ajustes. Várias correções juntas são uma PATCH só. | 1.6.0 → 1.6.1 |
| **MINOR** | Pelo menos uma funcionalidade nova, e todo APK instalado continua funcionando. Um bloco de funcionalidades publicado junto é **uma** MINOR. | 1.6.0 → 1.7.0 |
| **MAJOR** | Uma migration, RPC, Edge Function ou rota faz um APK já instalado falhar numa operação que antes funcionava. | 1.7.0 → 2.0.0 |

Antes de aceitar uma MAJOR, prefira a migração em duas etapas: o banco aceita o
jeito antigo e o novo, e o antigo só sai quando ninguém mais usa.

`npm run versao:<parte>` sugere a parte pelos commits (Conventional Commits): `!`
ou `BREAKING CHANGE` → major; algum `feat` → minor; o resto → patch. Pedir uma parte
**menor** que a sugerida é recusado, a não ser com `--forcar` (ex.: um `feat` que na
prática é só ajuste).

## versionCode

O Android usa um número inteiro, o `versionCode`, para decidir se um APK pode ser
instalado por cima de outro: só se for maior. Ele é **calculado**, nunca digitado:

```
versionCode = MAJOR × 1.000.000 + MINOR × 1.000 + PATCH
```

| Versão | versionCode |
| --- | --- |
| 1.6.0 | 1006000 |
| 1.6.1 | 1006001 |
| 1.7.0 | 1007000 |
| 2.0.0 | 2000000 |

MINOR e PATCH vão até 999. Até a 1.6.0 todos os APKs saíram com versionCode 1;
qualquer APK novo é maior que isso, então atualiza normalmente. Um teste Jest confere
que `app.json`, `package.json` e `package-lock.json` estão coerentes: editar a versão à
mão quebra o pre-commit.

## Nome do build (versionName)

A versão do `app.json` é a mesma para todos os builds; o `versionName` que o Android
mostra ganha um sufixo quando o build não é uma publicação (`app.config.js`):

| Build | versionName |
| --- | --- |
| Exatamente na tag `v1.7.0`, sem alteração | `1.7.0` |
| 12 commits depois da tag | `1.7.0+12.abc1234` |
| App DEV | `1.7.0+dev.12.abc1234` |
| Com alteração não commitada | `….dirty` no fim |

O versionCode do app DEV é o mesmo da última tag. Não há conflito: o DEV é outro
pacote (`com.snakethai.app.dev`).

O sufixo depende de `git describe` enxergar as tags. **Num workflow do GitHub Actions,
use `actions/checkout` com `fetch-depth: 0`** (o `release.yml` já usa); sem isso o nome
cai na versão pura (ou `+dev`).

## Publicar uma versão

1. PRs na `main` **com merge commit** (nunca squash: a tag precisa ficar no histórico
   da `main`). Depois: `git switch main` e `git pull --ff-only`.
2. Simular e conferir a sugestão e o rascunho das notas:
   ```bash
   npm run versao:minor -- --dry-run
   ```
3. Gravar a versão nova em `app.json`, `package.json`, `package-lock.json` e
   `CHANGELOG.md`, e revisar o texto do CHANGELOG (é o que as pessoas leem):
   ```bash
   npm run versao:minor
   ```
4. Commitar e criar a tag anotada — só neste computador:
   ```bash
   npm run versao:tag
   ```
5. Publicar a `main` e a tag (com a decisão explícita de publicar):
   ```bash
   git push origin main
   git push origin v1.7.0
   ```
6. **O push da tag dispara o workflow `Release Android`** (`.github/workflows/release.yml`):
   ele confere que a tag bate com a versão, compila APK e AAB assinados com a chave de
   produção, recusa publicar se a assinatura, o pacote, a versão ou o banco embutido
   não forem os de produção, e cria o GitHub Release com as notas do CHANGELOG,
   `snake-thai-v1.7.0.apk`, `snake-thai-v1.7.0-playstore.aab` e `SHA256SUMS.txt`.
   Acompanhe com `gh run watch`.

**Ensaio antes da tag:** em *Actions → Release Android → Run workflow* (na `main`), ou
`gh workflow run release.yml --ref main`. Gera o APK assinado como artefato por 3 dias,
sem publicar nada.

**Contingência (Actions fora do ar):** `menu.bat` → `[V]` PROD → `[P]` → `[5]` (confere
a versão da pasta `android/` e o certificado) e depois
`node scripts/version.js notes v1.7.0 > %TEMP%\notas.md` e
`gh release create v1.7.0 release\snake-thai-v1.7.0.apk --title "Snake Thai 1.7.0" --notes-file %TEMP%\notas.md`.
**Nunca os dois caminhos para a mesma tag.**

### Tag publicada não se move

Uma tag que já foi para o GitHub não é apagada nem movida (nada de `push --force`):
quem baixou precisa conseguir confiar no que baixou. Um erro numa versão publicada se
corrige com uma **nova PATCH**.

## Comandos

| Comando | Faz |
| --- | --- |
| `npm run versao:patch` / `minor` / `major` | Calcula e grava a versão nova (aceita `-- --dry-run` e `-- --forcar`) |
| `npm run versao:tag` | Commit `chore(release): vX.Y.Z` e tag anotada, sem push |
| `npm run versao:verificar` | Confere versionCode e `package.json` (`-- --android` confere a pasta `android/`; `-- --tag vX.Y.Z` confere a tag) |
| `npm run versao:notas -- vX.Y.Z` | Imprime as notas da versão |
| `node scripts/version.js build-name --variant dev` | Imprime o nome do build |

## Exemplos a partir da 1.6.0

| O que sai no APK | Versão |
| --- | --- |
| Só a assinatura de produção e correções | 1.6.1 (1006001) |
| Qualquer funcionalidade (chamada em andamento no aparelho, aulas recorrentes, editar aluno, Painel, exclusão de conta, push) | 1.7.0 (1007000) |
| O bloco Produto inteiro publicado junto | 1.7.0 — em duas entregas, 1.7.0 e 1.8.0 |
| Uma migration que recuse APKs 1.x | 2.0.0 (2000000) |
| Correção urgente depois da 1.7.0 | 1.7.1 (1007001) |

## snake-server

O servidor tem numeração própria, independente do app. Ver `CONTRIBUTING.md` no
repositório `snake-server`.
