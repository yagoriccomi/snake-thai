# Plano — Aviso de atualização do app (Fase 3A, itens 3A.2 e 3A.3)

> Modo 🔁 Loop, 2026-09-25. Branch `feat/aviso-de-atualizacao`. Contrato § 12.3 (D53, T48),
> mockup **"AtualizacaoDisponivel"** (linha H, versão 8, aprovado no G0 de 25/09).

## Enunciado canônico

- **Problema:** quando sai uma versão nova, quem tem o app instalado não fica sabendo. A 2.0.0
  vai desligar funções do APK 1.8 (T47), e o aviso só chega a quem já tiver um APK com a
  checagem.
- **Resultado esperado:** o APK de produção consulta a última release do GitHub no máximo uma vez
  por dia e, se houver versão maior que a instalada, mostra o cartão "Nova versão disponível" com
  o link do APK, em qualquer tela, sem nunca atrasar a abertura.
- **Como validar:** testes automáticos de todos os caminhos de falha da § 12.3; no aparelho
  (3A.4), o APK DEV não mostra, o de produção sem rede abre normal e **Agora não** fecha até o dia
  seguinte. A prova final com uma versão maior fica para a 2.0.0 (4.13).

## Escopo

- Regras puras (tag, versão, link, dia em SP) em `src/utils/avisoDeAtualizacao.ts`.
- Consulta ao GitHub e memória do dia em `src/services/avisoDeAtualizacao.service.ts`.
- Hook `useAvisoDeAtualizacao` (quando consultar) e componente `AvisoDeAtualizacao` (o cartão),
  montado no `App.tsx` dentro do `PortalProvider`, acima da navegação: vale para o Login.
- Token de tema `scrim` (o véu), com os valores do mockup.
- 3A.3: a convenção de release no `docs/VERSIONAMENTO.md` (`documentar-projeto`).

## Escopo negativo [#8]

- **Não bloqueia versão nenhuma** (T48, P13).
- **Não publica a 1.9.0** (3A.5 é do dono, ⚠️).
- Não usa o banco, não cruza repositório, a web não se aplica.
- Não muda o `release.yml`: ele já publica `snake-thai-vX.Y.Z.apk` na tag `vX.Y.Z`.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada |
| --- | --- | --- | --- |
| P1 | **Só 403 e 429 contam o dia** quando a consulta falha. Sem rede, tempo esgotado, outro status e JSON inválido **não** contam: a próxima volta ao primeiro plano tenta de novo. | A § 12.3 lista só 403 e 429 como "conta o dia"; os outros casos estão em "não mostra". Tentar de novo não fura o limite, porque só a resposta conta. | Gravar o dia também nos outros casos é uma linha no hook. |
| P2 | **"Dia consultado" é gravado quando a resposta chega** (inclusive quando não há versão nova). O aviso já mostrado não volta no mesmo dia, nem depois de **Baixar atualização**. | "Uma consulta e um aviso por dia." | — |
| P3 | **O cartão segue o mockup:** diálogo centralizado sobre véu, e não folha inferior (a § 12.3 diz "folha sobre a tela atual"; o mockup aprovado desenha o cartão). | O mockup é o desenho aprovado no G0; "folha" no contrato não fixa a forma. | Trocar por `BottomSheet` é mudar só o componente. |
| P4 | **A 2ª dica do mockup fica de fora** ("Baixa o APK oficial do GitHub. Depois, abra o arquivo e toque em Instalar: seus dados continuam."). | Não está na § 3 nem na § 12.3, e o roadmap manda: "todo texto de tela vem da § 3 do contrato". Só o dono aprova texto novo no contrato. | Pergunta ao dono no relatório; entra com uma linha no componente e uma no contrato. |
| P5 | **Falha ao abrir o navegador:** `log.warn` e o cartão continua aberto para tentar de novo, sem texto novo na tela. | Pelo mesmo motivo da P4 (texto de tela novo precisa do contrato). No Android, abrir `https://` num navegador praticamente não falha. | Uma mensagem inline, depois de aprovada no contrato. |
| P6 | **O dia em SP** sai do `Intl` com `timeZone: 'America/Sao_Paulo'`; se o motor não tiver o fuso, UTC−3 fixo (o Brasil não tem horário de verão desde 2019). | Hermes tem `Intl` com fuso no Android, mas a queda não pode derrubar o aviso. | — |
| P7 | **Consulta em andamento não se repete:** abrir e voltar ao primeiro plano ao mesmo tempo fazem uma consulta só. | "No máximo uma consulta por dia." | — |

## Decisão visual

- **Tem superfície visual?** Sim. **Mockup:** já existe e está aprovado (linha H). Nada novo a
  desenhar.
- **`design-de-interface-projeto`:** acionada. Cartão `surface` com borda `border`, raio 16,
  ícone de download num círculo `surfaceElevated` com `primaryText`, título Syne 19, corpo Inter 15
  com a versão nova em negrito, `Button` primário e secundário do design system, nota `caption`
  12 em `textSecondary`. Véu pelo token novo `scrim` (escuro 0,62; claro 0,45, como o mockup).
  Tema claro e escuro só por tokens [#3].
- **Acessibilidade:** `accessibilityViewIsModal`, título como cabeçalho, botões de 48 dp, o
  voltar do Android equivale a **Agora não**; o véu não fecha (a escolha é explícita nos botões).

## Passos

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `src/utils/avisoDeAtualizacao.ts` | Regras puras da § 12.3 | [#2][#11] | testes unitários |
| 2 | `src/utils/__tests__/avisoDeAtualizacao.test.ts` | Tag fora do formato, igual, menor, sufixo `+N.sha`, link com e sem asset, `browser_download_url` diferente, dia em SP | [#41][#46] | `jest` |
| 3 | `src/services/avisoDeAtualizacao.service.ts` | `GET` sem token, 5 s, resultado tipado (release, limite, falha); ler e gravar o dia no `AsyncStorage` | [#9][#93] | testes |
| 4 | `src/hooks/useAvisoDeAtualizacao.ts` | DEV não consulta; mesmo dia não consulta; abre e volta ao primeiro plano; nunca `log.error` | [#92] | testes do hook |
| 5 | `src/theme/colors.ts` | Token `scrim` | [#3] | teste de contraste continua verde |
| 6 | `src/components/AvisoDeAtualizacao.tsx` | O cartão, pelo `Portal` | [#13] | teste do componente |
| 7 | `App.tsx` | Monta o aviso dentro do `PortalProvider` | — | teste de fumaça do app |
| 8 | `docs/VERSIONAMENTO.md` | Convenção de release (3A.3) | [#96] | leitura |

## Plano de testes

- **Unidade:** as regras puras (passo 2).
- **Serviço:** 200 com JSON, 403, 429, 500, sem rede, tempo esgotado (abort), JSON sem `tag_name`.
- **Hook:** DEV não chama o `fetch`; sem rede não grava o dia e não mostra; 403/429 gravam o dia;
  versão igual e menor não mostram; a 2ª abertura no mesmo dia não consulta; outro dia consulta;
  voltar ao primeiro plano consulta; o `AsyncStorage` quebrado não trava.
- **Componente:** textos exatos; **Baixar atualização** abre o link montado; **Agora não** fecha;
  voltar do Android fecha.

## Riscos e rollback

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Limite de 60 consultas por hora por IP (Wi-Fi da academia) | Aviso não aparece naquele dia | 403/429 contam o dia (T48); tenta amanhã |
| Alguém publicar uma release fora da convenção | Aviso some ou leva à página da tag | 3A.3 documenta; o link nunca vem da resposta |
| Fuso não suportado | Dia errado | Queda para UTC−3 (P6) |

**Rollback** [#84]: reverter o PR. Nada no banco; nenhum dado do usuário.

## Definição de pronto

- [ ] Passos 1–8
- [ ] `npm run ci` verde
- [ ] Relatório `docs/planos/ENTREGA-3A-aviso-de-atualizacao.md`
- [ ] 3A.4 no aparelho (dono)
