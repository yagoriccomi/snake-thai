# ENTREGA — T3: padronizar o número de versão

| Campo | Valor |
|---|---|
| **Tarefa** | `T3` |
| **Plano** | [`PLANO-T3.md`](PLANO-T3.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **PRs** | `snake-thai` `chore/versionamento` · `snake-server` #16 (política do servidor, junto da T1) |
| **Status** | ✅ Código e documentação prontos; nenhuma versão nova publicada (não era o objetivo) |

---

## 1. O que foi feito

A versão deixa de subir a cada APK de teste. Agora ela só muda quando um APK é
publicado, por um comando que calcula a próxima versão a partir dos commits, grava
os arquivos e escreve o CHANGELOG. O `versionCode` do Android passa a ser derivado da
versão (1.6.0 → 1006000, antes era sempre 1), então o Android recusa instalar um APK
velho por cima de um novo. APKs de teste e o app DEV mantêm o número e ganham um
sufixo de commit, e o Perfil mostra qual versão está instalada.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `scripts/version-lib.js` | Regras puras: SemVer, `versionCode`, parte sugerida pelos commits, CHANGELOG, nome do build |
| `scripts/version.js` | CLI: `patch`/`minor`/`major` (`--dry-run`, `--forcar`), `tag`, `check` (`--tag`, `--android`), `notes`, `build-name` |
| `scripts/__tests__/version-lib.test.js` | 30 testes, inclusive consistência de `app.json` × `package.json` × `package-lock.json` |
| `package.json` | `npm run versao:patch|minor|major|tag|verificar|notas`; versão 1.0.0 → 1.6.0; `expo-constants` direto |
| `app.json` | `android.versionCode: 1006000` (versão continua 1.6.0) |
| `app.config.js` | `version` com sufixo de build (`1.6.0+N.sha`, `1.6.0+dev.N.sha`) |
| `menu.bat` | `[5]` confere a versão da pasta `android/` antes de compilar; APK nomeado pelo build; `[9]` pega o release mais recente da variante |
| `src/components/AppVersionFooter.tsx`, `src/utils/versaoDoApp.ts`, `DadosScreen.tsx` | "Versão X (código)" no fim do Perfil |
| `CHANGELOG.md` | Histórico de 1.0.0 a 1.6.0 |
| `docs/VERSIONAMENTO.md`, `README.md`, `docs/RUNBOOK.md`, `docs/README.md`, `CLAUDE.md` | Política, fluxo de publicação e comandos |
| `snake-server` (`CONTRIBUTING.md`, `docs/DEPLOY.md`) | Versão própria do servidor; 1.0.0 no próximo merge de funcionalidade |

## 3. Como validar

1. `npm run versao:verificar` → "Versão 1.6.0 (versionCode 1006000) consistente."
2. `npm run versao:minor -- --dry-run` → `1.6.0 → 1.7.0 (versionCode 1007000)`, sugestão `minor`, rascunho do CHANGELOG, nenhum arquivo alterado.
3. `npm run versao:patch` → recusado: os commits pedem `minor` (use `--forcar` se for só ajuste).
4. `npm run versao:notas -- v1.6.0` → as notas da 1.6.0.
5. `node scripts/version.js build-name --variant dev` → `1.6.0+dev.N.<sha>`.
6. No app: Perfil → última linha "Versão …".

## 4. Verificações executadas

- [x] Jest: 387 testes (30 da versão, 5 do rodapé e da função de versão, app.config com sufixo e versionCode)
- [x] Typecheck verde
- [x] `check` falhou antes do alinhamento ("versionCode ausente") e passou depois
- [x] `check --android` com a pasta `android/` antiga → "versionCode 1 em android/, esperado 1006000 … rode o prebuild"
- [x] `expo config` DEV → `1.6.0+dev.18.c03dc6d…` e `versionCode 1006000`
- [x] Dry-run não altera nada (`git status` vazio); `patch` recusado com commits `feat`
- [x] `notes v9.9.9` → erro; `notes v1.0.0` não arrasta o rodapé do CHANGELOG (bug achado e corrigido com teste)
- [x] Escolha do APK no `[9]`: `snake-thai-dev-v*` e `snake-thai-v*` não se misturam
- [ ] Rodapé de versão e `versionCode` 1006000 conferidos num APK instalado — depende do celular no ADB

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | `versionCode` = MAJOR×1.000.000 + MINOR×1.000 + PATCH | Nunca falta espaço para hotfix; bem abaixo do limite | Trocar as constantes em `version-lib.js` antes da primeira publicação |
| P2 | Primeiro APK assinado: nunca trocar o binário da `v1.6.0` | O SHA das notas deixaria de bater | — |
| P3 | Tag na `main`, depois do merge com merge commit | Tag no histórico da `main` e CHANGELOG com intervalo certo | — |
| P4 | Parte menor que a sugerida é recusada sem `--forcar` | Transforma a regra em hábito | Trocar o `throw` por aviso em `version.js` |
| P5 | Versão visível no fim do Perfil | Suporte sabe qual APK a pessoa tem | Remover `<AppVersionFooter />` |
| P6 | Servidor com versão própria, 1.0.0 no próximo merge de funcionalidade | A `/v1` já está em produção | — |
| P7 | A 1.3.0 fica numerada como está | Renumerar confundiria quem instalou; o CHANGELOG registra a exceção | — |

## 6. Decisão visual

Mockup: não — uma linha de texto dentro do padrão existente. A `design-de-interface-projeto`
definiu `caption` com o token `textSecondary` (AA nos dois temas, coberto pelo teste de
contraste), centralizada após o grupo CONTA, texto selecionável para o suporte copiar,
rótulo "Versão do aplicativo X, código Y" para o leitor de tela e "Versão indisponível" +
aviso no log quando o build não traz a versão.

## 7. Pendências

- [ ] ⚠️ **1.6.1 deixou de ser o caminho natural.** Com a T1 integrada, há commits `feat` desde a `v1.6.0`: o próximo APK publicado sugere **1.7.0**. Publicar 1.6.1 só com a assinatura (T2) exige `--forcar` — decisão sua ao publicar
- [ ] Quando a T5 (GitHub Actions) existir: `fetch-depth: 0`, `version.js check --tag` e notas por `version.js notes`
- [ ] 👤 Push de tag e GitHub Release só com a sua decisão de publicar

## 8. Próximo passo

**T2 — chave de assinatura de produção** (o plugin passa a exigir a chave de produção no
build PROD; a keystore é gerada por você).
