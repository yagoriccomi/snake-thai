# Plano — Primeiro acesso: a flag só cai depois da senha trocada (item 2.4)

> Modo 🔁 Loop, 2026-09-25. Branch `fix/primeiro-acesso-senha-antes-da-flag`. Item 2.4 do
> [`ROADMAP-thai.md`](../../ROADMAP-thai.md). A web tem o mesmo defeito (item 3.1 do
> `ROADMAP-web.md`), e a regra abaixo vale para as duas.

## Enunciado canônico

- **Problema:** o Onboarding grava o perfil **já com `is_first_login = false`** e só depois chama
  `updatePassword`. Se a troca de senha falhar (rede, política do Supabase, senha igual) e a pessoa
  fechar o app, ela entra dali em diante com a **senha padrão, que a academia conhece**, e nunca
  mais é levada a trocar.
- **Resultado esperado:** a conclusão do primeiro acesso só é gravada **depois** de a senha nova
  valer. Se a troca falhar, a flag continua `true` e o próximo login volta ao Onboarding.
- **Como validar:** teste com `updatePassword` rejeitando → a flag nunca é baixada. No aparelho,
  com uma conta de teste: primeiro acesso completo → entra no app, sem voltar ao passo 1.

## A regra (vale para o app e para a web)

1. Aceite dos documentos (como hoje).
2. Dados do cadastro, **sem** a flag.
3. Troca da senha.
4. **Só então** `is_first_login = false`.

## Por que o laço existia e como sai

`updatePassword` emite `USER_UPDATED`; o `AuthProvider` recebe a sessão nova e recarrega o perfil
com `loadingProfile = true`; o `RootNavigator` troca o Onboarding pela tela **Carregando** e o
**desmonta**. Quando o perfil volta com a flag ainda `true`, o Onboarding **remonta no passo 1**,
com o formulário vazio. Era por isso que a flag caía antes da senha.

**Correção no `AuthProvider`:**

- **Recarga silenciosa:** se o perfil carregado já é do mesmo usuário, recarregar **não** liga o
  `loadingProfile`. A tela atual não é desmontada. De quebra, a renovação do token (a cada hora)
  deixa de passar pela tela Carregando.
- **Só vale a última carga:** cada carga ganha um número; a resposta de uma carga antiga que chega
  depois de uma mais nova é descartada. Sem isso, a recarga do `USER_UPDATED` (pedida antes de a
  flag cair) poderia chegar depois do `refreshProfile` e devolver `is_first_login = true`.

## Escopo negativo [#8]

- **Não** muda o banco. A alternativa "o banco marca a conclusão quando a senha muda" exigiria
  gatilho em `auth.users` e publicação em produção; fica como recomendação.
- **Não** muda os textos nem o layout do Onboarding.
- **Não** corrige a web (outro repositório); o Registro avisa o chat da web com a regra.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada |
| --- | --- | --- | --- |
| P1 | **Correção no cliente**, e não no banco. | Não mexe em produção, sai no próximo APK e é a primeira direção do roadmap. [#7] | O gatilho no banco pode vir depois, sem desfazer isto. |
| P2 | **Senha já trocada nesta tela não é trocada de novo** ao repetir o envio, se a senha digitada for a mesma. | Se a senha passou e só a flag falhou (rede), repetir `updatePassword` com a mesma senha dá erro de "senha igual" e travaria a pessoa. | — |
| P3 | **"Senha igual" não conta como sucesso.** | A senha padrão pode passar na política do app: tratar "igual" como sucesso deixaria a senha padrão valendo. | — |
| P4 | Com o app fechado entre a senha e a flag, a pessoa entra com a senha **nova** e refaz o Onboarding, escolhendo outra senha (se repetir a atual, o Supabase recusa e a mensagem aparece). | Caso raro (a flag é um `update` de uma linha); o importante é a senha padrão nunca valer. | — |

## Decisão visual

Sem superfície visual: muda a ordem das chamadas e o carregamento do perfil. As mensagens de erro
continuam as de hoje (`describeError`).

## Passos

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `src/services/profile.service.ts` | `completeProfileOnboarding` vira `saveOnboardingProfile` (dados, **sem** a flag); `finishStaffOnboarding` vira `finishOnboarding` (só a flag), para todos | [#2][#1] | testes do serviço |
| 2 | `src/context/AuthProvider.tsx` | Recarga silenciosa do mesmo usuário e descarte de carga antiga | [#9] | testes do provider |
| 3 | `src/screens/onboarding/OnboardingScreen.tsx` | Nova ordem: aceite → dados → senha → flag → `refreshProfile`; não repete a senha já trocada | [#98] | testes da tela |
| 4 | testes (`testes-projeto`) | Caminho de falha obrigatório: senha rejeitada ⇒ flag intacta; flag falha ⇒ repetir não troca a senha de novo; ordem das chamadas; recarga silenciosa; carga antiga descartada | [#41][#46] | `npm run ci` |

## Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Alguma tela dependia do "Carregando" a cada renovação do token | Nenhuma lê `loadingProfile` além do `RootNavigator` (conferido com busca) |
| A recarga silenciosa mostrar perfil velho por um instante | É o mesmo usuário; o perfil novo substitui assim que chega |

**Rollback** [#84]: reverter o PR. Nada no banco.

## Definição de pronto

- [x] Passos 1–4
- [x] `npm run ci` verde (774 testes)
- [x] Relatório `docs/planos/ENTREGA-2.4-senha-antes-da-flag.md`
- [ ] Aparelho (dono): primeiro acesso completo com conta de teste
