# Entrega — 4.12b Atualizar o Expo (D26)

> 2026-10-07, modo 🔁 Loop. Plano: [`PLANO-4.12b-atualizar-expo.md`](PLANO-4.12b-atualizar-expo.md).
> PR #92, **aberto até o dono testar o APK de ensaio** (C18).

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `package.json` | `expo` `~57.0.27`, `react-native` `0.86.3`, `jest-expo` `~57.0.5` e os `expo-*` nas versões que o `npx expo install --check` pede no SDK 57 |
| `package-lock.json` | regerado pelo `npm install` e pelo `npm audit fix` sem `--force` |
| `scripts/version-lib.js`, `scripts/version.js`, `app.config.js` | `APP_ENSAIO` marca o versionName do APK de ensaio (`ensaio.d26.`), mesmo num build na tag |
| `scripts/__tests__/version-lib.test.js` | 3 testes da marca de ensaio |
| `docs/VERSIONAMENTO.md`, `README.md` | como gerar e reconhecer um APK de ensaio |
| `ROADMAP-thai.md` | item 4.12b antes do 4.13; o 4.13 passa a depender dele |

`docs/CONTRATO.md` não mudou. `release/1.9.0` não foi tocada.

## Prova: npm audit (C8)

| Momento | `npm audit --omit=dev` | `npm audit` completo |
| --- | --- | --- |
| Antes (`main`, `bf80931`) | 44: **31 altos**, 13 moderados, 0 crítico | 66: 53 altos, 13 moderados |
| Depois (`chore/d26-expo`) | 37: **24 altos**, 13 moderados, 0 crítico | 59: 46 altos, 13 moderados |

Saíram os 7 com correção publicada: `@xmldom/xmldom`, `brace-expansion`, `compression`,
`image-size`, `js-yaml`, `source-map-js` e `@expo/metro-file-map`.

## Por que os 31 não zeram

| Pacote na raiz | Última versão publicada | Faixa vulnerável | Chega por |
| --- | --- | --- | --- |
| `node-forge` | 1.4.0 | `<= 1.4.0` (GHSA-86w9-cpqp-85rv) | `@expo/cli`, `@expo/code-signing-certificates` |
| `braces` | 3.0.3 | `<= 3.0.3` (GHSA-vfj7-8cjw-p6xm) | `micromatch` 4.0.8 ← `metro-file-map`, `jest-haste-map`, `@jest/transform` |

Os outros 22 altos (`expo`, `metro*`, `react-native`, `@sentry/react-native`, `jest-*`, …) são
alertas herdados: o npm marca o pacote porque ele depende de um desses dois. O SDK 58 e o Metro
0.87 dependem dos mesmos pacotes, então subir de SDK também não zera. O `npm audit fix --force`
rebaixaria o `expo` para a 44 e está fora.

Os dois ficam na cadeia de **ferramentas** (CLI do Expo, Metro, Jest): rodam na máquina de quem
compila e não entram no APK. **Decisão do dono:** aceitar o resíduo até sair correção de fora, ou
pedir outro caminho (por exemplo, `overrides` com fork, que o plano deixou fora).

## Testes

- `npm run typecheck` ✅; Jest completo, 137 suítes e 1113 testes ✅ (pre-commit de cada commit).
- CI do #92 verde: tipos, testes, licenças, auditoria de CVE, regressão do banco, gitleaks e CodeQL.
- APK de ensaio: não gerado, ver abaixo.

## APK de ensaio

**Ainda não gerado: espera o dono.** O build local parou três vezes:

1. Na worktree `.claude\worktrees\d26-expo`, o CMake do `react-native-safe-area-context` estourou
   os 260 caracteres de caminho do Windows (`Filename longer than 260 characters`).
2. Com `subst W:`, o Expo não acha o `package.json` a partir da raiz de uma unidade e, um nível
   acima, o Gradle mistura caminhos `W:` e `C:` (`different roots`).
3. Numa worktree sem branch em `C:\st\d26` (mesmo commit, `node_modules` próprio por `npm ci`,
   sem junção), o build passou do ponto em que falhava e compilava o código nativo, mas o Claude
   Code o interrompeu por **falta de memória** na máquina, com os outros chats rodando juntos.

Para gerar, com a máquina mais livre (feche os outros chats ou o Android Studio):

```powershell
git -C C:\st\d26 checkout --detach origin/chore/d26-expo
Set-Location C:\st\d26
powershell -ExecutionPolicy Bypass -File C:\st\build-ensaio.ps1
```

O script faz o `prebuild` do app DEV, confere a versão e roda o `assembleRelease` só para
`arm64-v8a`, a arquitetura dos celulares atuais, com um worker, para gastar menos memória.
O APK sai em `C:\st\d26\android\app\build\outputs\apk\release\app-release.apk`, assinado com a
chave de debug, com `APP_ENSAIO=d26` e sem envio ao Sentry.

Não é release: não ganhou tag, não foi para o GitHub Release e não está no repositório (C18).

## Roteiro para o aparelho (≈ 15 min)

Antes: banco local de pé (`menu.bat` → **B**) e o aparelho conectado por USB ou pelo **2**.

1. **Instalar.** `adb install -r "<caminho do APK acima>"`. Não use o **9** do `menu.bat` do
   checkout principal: ele instala o APK de lá, não o de ensaio. O app DEV
   (`com.snakethai.app.dev`) convive com o da loja.
2. **Encaminhar o banco.** `adb reverse tcp:55321 tcp:55321` e `adb reverse tcp:3000 tcp:3000`
   (o `menu.bat` faz isso ao conectar). Sem isso, o app DEV abre sem dados.
3. **Versão.** Configurações do Android → Apps → Snake Thai DEV: a versão começa com
   `1.8.0+ensaio.d26.dev.`. Se não aparecer `ensaio`, o APK é o errado.
4. **Abrir e entrar.** A splash some, as fontes (Inter e Syne) carregam e o login funciona com um
   usuário de demonstração.
5. **Biometria.** Ative o desbloqueio por digital, feche o app e reabra: o pedido de digital aparece
   e libera.
6. **Notificações.** Na primeira abertura o Android pede permissão; aceite. Dispare uma ação que
   gera aviso (por exemplo, uma justificativa) e confira que a notificação chega.
7. **Anexos.** Ao enviar uma justificativa, anexe uma foto da galeria e depois um PDF. Os dois
   sobem sem erro.
8. **Navegação.** Passe pelas abas do painel, abra uma aula e a ficha de um aluno. Nada trava nem
   fica em branco.
9. **Erro.** Se algo quebrar, anote o passo e a tela. O Sentry do ambiente DEV recebe o erro com a
   versão `ensaio.d26`.

Tudo certo → avise no PR #92 e ele pode ser mesclado. Algo quebrou → descreva o passo e o PR
continua aberto.
