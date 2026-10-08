# PLANO DE EXECUÇÃO — 4.12b Atualizar o Expo (D26)

| Campo | Valor |
|---|---|
| **Tarefa** | `4.12b` / D26 (coordenação de 07/10) |
| **Origem** | descrição livre (prompt do dono, 07/10) |
| **Tipo** | Melhoria (segurança da cadeia de build) |
| **Modo de execução** | 🔁 Loop (sem confirmação) |
| **Data** | 2026-10-07 |
| **Branch** | `chore/d26-expo` |

---

## 1. Enunciado Canônico

- **Problema:** o `npm audit --omit=dev` acusa **31 alertas altos** (lista na
  [`ENTREGA-cve-shell-quote.md`](ENTREGA-cve-shell-quote.md)), todos da cadeia de ferramentas do
  Expo, do Metro e do Jest.
- **Resultado esperado:** o Expo e o que ele puxa (React Native, Metro, `jest-expo`, pacotes
  `expo-*`) na versão mais nova do SDK 57; os altos que têm correção publicada somem; os que não
  têm ficam listados, com o motivo.
- **Como validar:** `npm audit` antes e depois; typecheck e Jest verdes; CI verde; o dono instala o
  APK de ensaio e passa pelo roteiro da [`ENTREGA-4.12b-atualizar-expo.md`](ENTREGA-4.12b-atualizar-expo.md).

## 2. Escopo

**Vou fazer:**
- `expo` 57.0.14 → 57.0.27, `react-native` 0.86.0 → 0.86.3, `jest-expo` 57.0.2 → 57.0.5 e os
  `expo-*` nas versões que o `npx expo install --check` pede;
- `npm audit fix` sem `--force` para os pacotes folha;
- marca de **ensaio** no nome da versão (`APP_ENSAIO`), porque nada no projeto sabia fazer isso
  (C18: "a versão dele diz que é ensaio");
- APK de ensaio local e roteiro curto para o aparelho.

**NÃO vou fazer (escopo negativo)** [#8]:
- tocar na `release/1.9.0` ou no #54 (C18);
- SDK 58, React Native 0.87 ou Jest 30 (ver P2 e P3);
- `npm audit fix --force` (rebaixaria o `expo` para a 44 e o `@sentry/react-native` para a 5);
- `overrides` para trocar `node-forge` ou `braces` por um fork;
- mudar o `@types/jest` (30, fora do que o Expo espera, já era assim na `main`);
- tag, GitHub Release ou mudança de versão (o ensaio não é publicação).

## 3. Premissas Assumidas

| # | Premissa | Por quê | Se estiver errada… |
|---|---|---|---|
| P1 | **Zerar os 31 não é possível hoje.** Faço o que tem correção e listo o resíduo. | `node-forge` 1.4.0 e `braces` 3.0.3 são as **últimas versões publicadas** e continuam na faixa vulnerável (GHSA-86w9-cpqp-85rv, GHSA-vfj7-8cjw-p6xm). O `@expo/cli` (também no SDK 58) depende de `node-forge`; o `metro-file-map` (também na 0.87) e o `@expo/metro-file-map` dependem de `micromatch` → `braces`. Todos os 24 restantes descendem desses dois. [#57][#98] | O dono decide entre aceitar o resíduo até sair correção (recomendado) ou outro caminho; a atualização deste PR continua útil em qualquer escolha. |
| P2 | Fica no **SDK 57** (última 57.0.27). | O SDK 58 não tira nenhum dos dois pacotes e é major: risco de quebra sem ganho no audit. [#7][#99] | Se o dono quiser o 58, é outro item, com outro APK de ensaio. |
| P3 | Jest continua na **29**. | O `jest-expo` 57 é feito para o Jest 29; o Jest 30 tiraria só a cadeia do Jest, e a do Metro e do React Native continuaria alta. [#7] | Revisitar quando o `jest-expo` aceitar o 30. |
| P4 | O APK de ensaio é do **app DEV** (`com.snakethai.app.dev`), build **release** assinado com a chave de debug. | O código da `main` é a Fase 4 e precisa do banco local; o release embute o bundle e prova o caminho de build que a 2.0.0 vai usar (Hermes, minificação, Sentry). Instala ao lado do app de produção. [#81] | Se o dono preferir o de produção, só depois da 2.0.0 (o esquema de produção ainda é o da 1.8.0). |
| P5 | A marca de ensaio vem de `APP_ENSAIO`, opcional, só no build: `1.8.0+ensaio.d26.dev.N.sha`. | Uma variável no ambiente não muda nenhum build normal e chega ao `app.config.js` e ao `version.js check` pelo mesmo `buildVersionName`. [#3][#6][#80] | Sem a variável, o build é o de sempre; a regra cabe num teste. |
| P6 | Nada do `docs/CONTRATO.md` muda e não há decisão de produto. | A atualização é de patch, dentro do SDK; nenhuma tela, regra ou texto muda. | Se o aparelho mostrar diferença de comportamento, paro e pergunto. |

## 4. Decisão Visual

- **Tem superfície visual?** Não (o versionName aparece só em Configurações → Apps do Android).
- **Precisa de mockup?** Não.
- **`design-de-interface-projeto` acionada?** Não.

## 5. Terreno (o que já existe)

| Arquivo | Papel hoje | O que muda |
|---|---|---|
| `package.json` / `package-lock.json` | dependências | versões do SDK 57 mais novas; lock pelo `npm install` + `npm audit fix` |
| `scripts/version-lib.js` | `buildVersionName` | parâmetro `ensaio` e `ensaioDoAmbiente` |
| `scripts/version.js` | `check --android` e `name` | passam o ensaio do ambiente |
| `app.config.js` | versionName do build | passa o ensaio do ambiente |
| `scripts/__tests__/version-lib.test.js` | testes da versão | três casos do ensaio |
| `docs/VERSIONAMENTO.md`, `README.md` | nome do build e variáveis | `APP_ENSAIO` |
| `ROADMAP-thai.md` | fila | item 4.12b e Registro |

**Reaproveitamento** [#6]: `buildVersionName`, `with-variant.js` e o fluxo do `menu.bat` ([P] e [5]).

## 6. Passos Atômicos

| # | Arquivo alvo | O que muda (1 frase) | Prática | Como verificar |
|---|---|---|---|---|
| 1 | `package*.json` | SDK 57 mais novo e `npm audit fix` | [#57] | `npx expo install --check` só reclama do `@types/jest`; audit 31 → 24 |
| 2 | `scripts/version-lib.js` e chamadores | marca de ensaio no versionName | [#3][#45] | `jest scripts/__tests__/version-lib.test.js` |
| 3 | docs e roadmap | `APP_ENSAIO`, plano, item 4.12b | [#96] | leitura |
| 4 | — | typecheck e Jest completos | [#43] | 137 suítes verdes |
| 5 | — | APK de ensaio local, sem paralelo | [#81] | `aapt dump badging` mostra `ensaio` |

## 7. Impacto em Dados e Contratos

- **Banco de dados:** nenhum.
- **Contrato de API:** nenhum (`docs/CONTRATO.md` intocado).
- **Configuração:** `APP_ENSAIO` (opcional, só no build; não é segredo).
- **Dados pessoais (LGPD):** nenhum.

## 8. Plano de Testes

| Nível | O que cobre | Caminho de falha coberto |
|---|---|---|
| Unidade | `buildVersionName` com ensaio, `ensaioDoAmbiente` | rótulo com ponto ou maiúscula é recusado |
| Bateria | 137 suítes do Jest com o `jest-expo` 57.0.5 | regressão do preset novo |
| CI | typecheck, Jest, licenças, audit crítico, SQL, gitleaks, CodeQL | — |
| Aparelho | roteiro da ENTREGA | build nativo com o React Native 0.86.3 |

## 9. Riscos e Rollback

- **Risco:** algo nativo do React Native 0.86.3 ou de um `expo-*` se comportar diferente no
  aparelho (biometria, notificações, seletor de imagem e de documento). **Mitigação:** o roteiro
  passa por cada um.
- **Rollback** [#84]: o PR não é mesclado antes do teste; se falhar, fecha-se o PR e a `main` segue
  como está.
