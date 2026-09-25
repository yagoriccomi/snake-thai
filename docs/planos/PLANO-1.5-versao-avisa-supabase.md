# Plano — `versao:verificar` avisa quando há banco ou Edge Function para publicar (item 1.5)

> Modo 🔁 Loop, 2026-09-25. Branch `feat/versao-avisa-supabase`. Item 1.5 do
> [`ROADMAP-thai.md`](../../ROADMAP-thai.md). Precisa sair antes da 1.9.0 (3A.5).

## Enunciado canônico

- **Problema:** a 1.7.1 e a 1.8.0 foram publicadas com migrations e uma Edge Function novas que
  ninguém levou para produção. A regra "migration → Edge Function → só então a APK" dependia de
  memória.
- **Resultado esperado:** `npm run versao:verificar` (e tudo que chama o `check`: `versao:tag`, o
  `[5]` do `menu.bat` e o `release.yml`) lista as migrations e as Edge Functions que mudaram desde a
  última versão publicada, com a lembrança **"publique em produção antes da APK"**.
- **Como validar:** na `main` de hoje (nada em `supabase/` desde a v1.8.0) o `check` não avisa
  nada; numa branch com uma migration nova, avisa com o nome do arquivo.

## Escopo negativo [#8]

- **É aviso, não trava.** O `check` continua saindo com 0: bloquear a APK deixaria o dono sem
  caminho quando a produção já foi atualizada pelo `db-push-prod.bat`.
- **Sem rede e sem token.** Não consulta a produção para saber se a migration já está lá (isso
  pediria credencial, e o roadmap pediu só `git diff`).
- Não muda o `release.yml` nem o `menu.bat`: os dois já chamam o `check`.

## Premissas assumidas (modo Loop)

1. **Com que versão comparar:** com a última tag **anterior à versão do app**. Na `main` durante o
   desenvolvimento (app.json 1.8.0, HEAD depois da v1.8.0), compara com a v1.8.0; entre o
   `versao:minor` e o `versao:tag`, também; **no próprio commit da tag v1.9.0**, compara com a
   v1.8.0 (senão o diff seria vazio justamente no build da publicação). [#98]
2. **`_shared`** muda o código de todas as funções que o importam: aparece como
   `_shared (todas as funções que o usam)`.
3. **Arquivo apagado** não conta (`--diff-filter=d`): não há o que publicar.
4. **Sem tag no histórico** (clone raso): o aviso é pulado em silêncio, como o `describeGit`.

## Decisão visual

Sem superfície visual (saída de terminal de uma linha por item).

## Passos

1. `scripts/version-lib.js` — `supabaseChangesFrom(caminhos)` classifica os caminhos em
   migrations e funções, e `buildSupabaseWarning({ baseTag, changes })` monta o texto (ou `null`).
   Funções puras, testáveis sem git. [#2][#41]
2. `scripts/__tests__/version-lib.test.js` — casos: nada em `supabase/`, só migration, só
   função, `_shared`, arquivo fora de `migrations/` e `functions/` (seed, tests) ignorado,
   função repetida aparece uma vez. [#41][#46]
3. `scripts/version.js` — no `conferir`, depois das checagens: acha a tag base (premissa 1), roda
   `git diff --name-only --diff-filter=d <base>..HEAD -- supabase/migrations supabase/functions`
   com `execFileSync` (argumentos separados [#52]) e imprime o aviso. [#49]
4. `docs/VERSIONAMENTO.md` — a regra da ordem de publicação e o aviso. [#96]

## Riscos e rollback

- **Risco:** o aviso aparecer no `release.yml` depois da publicação da tag. É esperado e
  inofensivo: lembra de conferir a produção.
- **Rollback** [#84]: reverter o commit do `version.js`; a lib nova fica sem uso.

## Definição de pronto

- [ ] Testes da lib passando
- [ ] `node scripts/version.js check` na branch sem migration: sem aviso
- [ ] Simulação com uma migration nova num commit temporário: aviso com o nome do arquivo
- [ ] `VERSIONAMENTO.md` atualizado
