# Roadmap — Snake Thai (app Android e banco)

> **Atualizado em:** 2026-09-25, com o contrato **v3** (revisão de 25/09) e os fatos de produção
> de 24/09.
> **Substitui** o [`docs/PLANO-DE-TAREFAS.md`](docs/PLANO-DE-TAREFAS.md) como fila viva: aquele
> checklist (2026-09-16) está todo feito do lado do código, e as pendências dele que ainda
> valem foram trazidas para cá.
> **Repositórios irmãos:** [`snake-server/ROADMAP.md`](../snake-server/ROADMAP.md) ·
> [`snake-web/ROADMAP.md`](../snake-web/ROADMAP.md)

**Como usar**

- Marque `[x]` quando um item terminar e anote no [Registro](#registro) no fim.
- **👤** = só você pode fazer (contas, senhas, painéis, decisões de negócio).
- **⚠️** = mexe em produção ou é irreversível. Sempre pede confirmação antes.
- A coluna **Skill** diz quem executa. Tarefa de código entra por `executar-projeto`, que
  escreve o plano antes do código e aciona `design-de-interface-projeto`,
  `banco-de-dados-projeto` e `testes-projeto` conforme o plano.
- A ordem das fases é a ordem de execução. Dentro de cada fase, a ordem dos itens também.
  **Exceção:** a Fase 3A (APK 1.9.0) não espera as Fases 2 e 3; ela só precisa sair antes de
  tudo da Fase 4.

---

## Onde estamos

| | |
| --- | --- |
| **Versão publicada** | **1.8.0** (releases 1.7.0, 1.7.1 e 1.8.0 entre 21 e 23/09). A próxima é a **1.9.0**, com o aviso de atualização (Fase 3A) |
| **`main`** | Em `384f715` (merge do PR #38, 24/09). **CI vermelho nesse merge:** o job de regressão SQL não conseguiu instalar a CLI do Supabase ("rate limit exceeded" ao resolver `version: latest`); os outros dois jobs passaram. É falha de infraestrutura, não de código (item 0.6) |
| **Branches** | Nenhuma aberta. `feat/dados-de-demonstracao` e `feat/sentry-regiao-ue` já foram mescladas e ainda existem (item 0.3) |
| **Banco local** | De pé, com um ano de histórico de demonstração |
| **Produção** | **Alcançou a 1.8.0 em 24/09:** as duas migrations foram aplicadas pelo `db-push-prod.bat` e a `create-student` foi publicada. Faltam as conferências 1.1 e 1.4 |
| **Contrato** | [`docs/CONTRATO.md`](docs/CONTRATO.md) **v3**, revisada em 25/09. Nenhum chat implementou nada dela ainda |
| **Mockups** | Versão 7 (25/09). Linhas A–F aprovadas em 24/09; G e H aguardando aprovação |
| **Fundação** | Git, GitHub, Husky, Conventional Commits e versionamento por tag funcionando. Jira adiado por escolha sua (2026-07-27) e fora deste roadmap |

**O que está faltando, em ordem de gravidade:**

1. **O primeiro acesso pode deixar a senha padrão valendo para sempre** (item 2.4). O mesmo
   defeito existe na web.
2. **Produção publicada, mas não conferida no app** (itens 1.1 e 1.4): o trigger da trava de
   promoção e o cadastro com "Não usa".
3. **CI da `main` vermelho** desde o merge do PR #38, por falha na instalação da CLI (item 0.6).
4. **Não foram testados no aparelho:** a chamada do professor, a exclusão de conta e o
   formulário de aluno sem app em tela pequena.
5. **Segurança antes do primeiro aluno real:** chaves que apareceram no chat (a `service_role`
   só gira quando o app for usado de verdade, item 3.1), senha padrão pública, dados de
   demonstração.
6. **APK 1.9.0 com o aviso de atualização** (Fase 3A): sai antes de tudo da nova direção; os textos da § 12.3 foram aprovados em 25/09 (3A.1).
7. **Nova direção do produto** (Fase 4): horário livre e à vontade, menu de aulas, troca de aula,
   aula extra, histórico de turma, chamada auditável, cancelamento, solicitações, perfis e
   contato da academia. O contrato v3 está escrito e o **G0 abriu em 25/09** (mockups versão 8 aprovados).

---

## Marco M1 — pronto para o primeiro aluno real

É o marco que importa. **Nenhum aluno real entra antes de tudo isto estar marcado.**
A lista junta os três repositórios, porque o marco é um só.

- [ ] Produção alcançou o app publicado e foi conferida — Fase 1 (falta 1.1 e 1.4)
- [ ] Primeiro acesso não deixa senha padrão para trás, no app e na web — item 2.4
- [ ] **`service_role` girada** — item 3.1. Decisão do dono: **só quando o app for usado de
  verdade**, porque hoje todos os dados são fictícios. É obrigatória antes do primeiro aluno real
- [ ] Senha do banco trocada e token da CLI revogado — item 3.2
- [ ] Senha de primeiro acesso trocada e contas pendentes redefinidas — item 3.3
- [ ] Dados de demonstração removidos de produção, com backup — item 3.5
- [ ] Política e Termos publicados com os dados reais da academia — item 3.7
- [ ] Auditoria de segurança feita no que mudou desde a última rodada — item 3.10
- [ ] Servidor aceita o domínio da web e o CI dele está verde — [`snake-server/ROADMAP.md`](../snake-server/ROADMAP.md)
- [ ] Web conferida tela por tela e com um envio real de comprovante em produção — [`snake-web/ROADMAP.md`](../snake-web/ROADMAP.md)

---

## Fase 0 — Arrumar a casa (nada vai para produção)

| # | Item | Skill | Quem |
| --- | --- | --- | --- |
| 0.1 | [x] ~~Commitar a alteração pendente em `scripts/gerar-comprovantes-demonstracao.js` na branch do PR #38~~ — **feito em 24/09** (`dc2f5bd`) | `git-flow-projeto` | 🤖 |
| 0.2 | [x] ~~Mergear o PR #38 (merge commit, como todos os outros)~~ — **feito em 24/09** (`384f715`) | — | 👤 |
| 0.3 | Apagar as branches locais `feat/sentry-regiao-ue` e `feat/dados-de-demonstracao`, já mescladas. A `main` local já está em `384f715`, igual à remota | `git-flow-projeto` | 🤖 |
| 0.4 | Subir o Node do `ci.yml` de 20 para 22 (o `release.yml` já está no 22) | `executar-projeto` | 🤖 com seu aval |
| 0.5 | Deixar no topo do `PLANO-DE-TAREFAS.md` um ponteiro para este arquivo | `documentar-projeto` | 🤖 |
| 0.6 | **CI da `main` vermelho desde o merge do PR #38:** rerodar o job "Regressão de segurança no banco"; se falhar de novo, fixar a versão da CLI do Supabase no `ci.yml` (hoje `version: latest`) | `executar-projeto` | 🤖 com seu aval |

**Detalhes:**

- **0.1.** O script agora diz em qual banco vai escrever e recusa a chave errada (o token da CLI,
  `sbp_…`, no lugar da service role). Sem isso, esquecer `SUPABASE_URL` fazia o script agir no
  banco local em silêncio e responder "nada a fazer".
- **0.4.** O Node 20 saiu de suporte em 30/04/2026. Isto **não é job novo no CI** (o "esquece
  o CI" de 2026-09-16 continua valendo): é só a versão do runtime dos jobs que já existem. Por
  mexer no CI, fica com você decidir. [#62][#81]
- **0.6.** Conferido no run `36058165042`: a falha foi no passo "Instala a CLI do Supabase",
  antes de subir o banco, com "Failed to resolve latest Supabase CLI release: rate limit
  exceeded". Os jobs "Tipos, testes e licenças" e "Auditoria de CVE" passaram. `latest` obriga o
  runner a consultar a API do GitHub a cada execução, e é essa consulta que estoura o limite.
  Fixar a versão é ajuste de um job que já existe, como o 0.4, e não job novo.

---

## Fase 1 — ⚠️ Produção alcançar o app publicado (publicada em 24/09; faltam as conferências)

**O problema (resolvido em 24/09):** a 1.7.1 e a 1.8.0 foram publicadas e instaladas, mas
produção tinha ficado na 1.7.0.

| O app publicado faz | O que acontecia em produção até 24/09 |
| --- | --- |
| Cadastro com **"Não usa"** o app (1.8.0) | A `create-student` antiga ignorava os campos novos. O aluno era criado **só com o e-mail**, e o nome, o CPF, o celular e o nascimento se perdiam sem aviso |
| Banco recusa promover aluno a admin (1.7.1) | A trava não estava ativa. O botão sumiu do app na 1.7.1, mas o banco ainda aceitava a promoção |

Conferido com `git diff v1.7.0..main`: eram **duas migrations** e **uma função**. Nada mais
mudou em `supabase/` desde a 1.7.0.

**O que aconteceu em 24/09:**

- **De manhã**, a sonda anônima (só leitura, chave pública do app) mostrou que
  `profiles.access_channel` não existia: respondia `42703`, como a coluna inventada de controle.
  A `20260923100000_aluno_sem_app` não estava aplicada. O que tinha sido rodado no SQL Editor em
  23/09 era só o pacote de demonstração (`supabase/seed/historico_demonstracao.sql`).
- **O dono rodou `scripts\db-push-prod.bat`.** Conferido pela mesma sonda: `profiles.access_channel`
  passou a responder **401/42501**, como a coluna de controle `id`, e uma coluna inexistente
  continua respondendo `42703`. **A `20260923100000` está aplicada.** Como o envio aplica as
  migrations em ordem e para no primeiro erro, a `20260922100000` também passou; o 1.1 confirma.
- **O dono publicou a Edge Function `create-student`** (saída: "Deployed Functions on project …:
  create-student"), na ordem certa: coluna antes, função depois.

**O "Não usa" já pode ser usado em produção.** O 1.4 confirma no app.

- [ ] **1.1** 👤 Conferência somente leitura no **SQL Editor de produção** (só `select`). É a
  única coisa que a chave pública não enxerga:

  ```sql
  -- 1 linha = a 20260922 está ativa (o esperado agora)
  select tgname from pg_trigger
   where tgrelid = 'public.profiles'::regclass and tgname = 'enforce_role_change_rules';
  -- as duas versões devem aparecer
  select version from supabase_migrations.schema_migrations
   where version in ('20260922100000', '20260923100000');
  ```

  Se o trigger não aparecer ou faltar uma das versões, **pare** e traga o resultado para cá antes
  de qualquer outro envio.
- [x] **1.2** ⚠️👤 ~~`scripts\db-push-prod.bat`~~ — **feito em 24/09**, conferido pela sonda
  anônima.
- [x] **1.3** ⚠️👤 ~~`npx supabase functions deploy create-student --project-ref <REF>`~~ —
  **feito em 24/09**, depois do 1.2.
- [ ] **1.4** 👤 Conferir no app de produção:
  - [x] a sonda da coluna passou de `42703` para 401/42501 (24/09);
  - [ ] cadastrar um aluno de teste com "Não usa": o nome aparece na lista e na chamada;
  - [ ] tentar promover um aluno: o banco recusa;
  - [ ] apagar o aluno de teste.
- [ ] **1.5** 🤖 `executar-projeto`: fazer o `npm run versao:verificar` **avisar quando há
  migration ou Edge Function nova desde a última tag**, com a lembrança "publique em
  produção antes da APK". É um `git diff <última tag>..HEAD -- supabase/`, sem rede e sem
  token. Foi exatamente esse passo que escapou na 1.8.0. Registrar a regra também no
  `docs/VERSIONAMENTO.md`. **Faça antes da 1.9.0 (3A.5).** [#49][#96]

> **Regra que sai desta fase:** migration → Edge Function → **só então** a APK. Já estava no
> `PUBLICACAO-1.7.0.md`, e a 1.8.0 mostrou que precisa de uma trava, não de memória.

---

## Fase 2 — Conferir o que foi entregue e ninguém viu

Tudo aqui foi escrito e passou nos testes automáticos, mas **nunca rodou no aparelho**. Você
já achou assim defeitos que nenhum teste pegaria, como o botão inalcançável.

Antes de começar, lembre: o **`adb reverse` cai** toda vez que o aparelho dorme. O sintoma é a
tela vermelha "Unable to load script", que parece defeito e não é. As portas são `55321`
(banco), `6969` (Metro), `3000` (servidor) e `3001` (web). O `menu.bat` recria o encaminhamento.

| # | O que conferir | Roteiro | Quem |
| --- | --- | --- | --- |
| 2.1 | **Cadastro de aluno sem app em tela pequena**: rolar o formulário inteiro com o teclado aberto, com "Não usa" marcado e desmarcado, até alcançar o botão | Configurações do Android → fonte grande, ou emulador de tela pequena | 👤 |
| 2.2 | **Chamada como professor** e rascunho: marcar metade, matar o app, reabrir, recuperar, salvar. Provocar o conflito com outra pessoa salvando | [`ENTREGA-T11`](docs/planos/ENTREGA-T11.md) | 👤 |
| 2.3 | **Exclusão de conta**: senha errada é recusada; senha certa exclui; o login antigo deixa de funcionar | [`ENTREGA-T7`](docs/planos/ENTREGA-T7.md) — **só com conta de teste** | 👤 |
| 2.4 | **Achado: senha padrão no primeiro acesso** (abaixo) | — | 🤖 `executar-projeto` + `testes-projeto` |

### 2.4 Achado: o primeiro acesso pode deixar a senha padrão valendo para sempre

**Onde:** `src/screens/onboarding/OnboardingScreen.tsx` (linhas ~188–203) e
`src/services/profile.service.ts` (`completeProfileOnboarding` e `finishStaffOnboarding`).

**O que acontece:** o app grava o perfil **já com `is_first_login = false`** e só depois chama
`updatePassword`. Se a troca de senha falhar e a pessoa fechar o app sem tentar de novo, ela
entra das próximas vezes com a **senha padrão, que a academia conhece**, e nunca mais é levada
a trocar. As causas possíveis são rede, a política de senha do Supabase ou senha igual à atual.
A web tem o mesmo padrão.

> O handoff descreve o risco ao contrário ("senha nova e cadastro incompleto"). O que o código
> faz hoje é o oposto: **cadastro completo e senha padrão**, que é o caso pior.

**Restrição que a correção precisa respeitar:** a ordem atual existe por um motivo, anotado no
código. `updatePassword` emite `USER_UPDATED`, que recarrega o perfil. Se a flag ainda estiver
`true` nesse momento, o Onboarding remonta no passo 1, e é aí que nasce o laço.

**Direção para o plano** (quem decide é o `executar-projeto`): gravar os dados **sem** a flag,
trocar a senha e **só então** marcar a conclusão, segurando o recarregamento enquanto o envio
está em andamento. A outra opção é deixar o banco marcar a conclusão quando a senha mudar.

**Teste obrigatório:** o caminho de falha. A troca de senha rejeita, e a flag continua `true`. [#41][#46]

**Mesma correção na web:** [`snake-web/ROADMAP.md`](../snake-web/ROADMAP.md), item 3.1. Corrigir
os dois juntos, com a mesma regra.

---

## Fase 3 — Antes do primeiro aluno real

Vem do `docs/PUBLICACAO-1.7.0.md` (passos 0, 4 e 7) e do handoff. Nenhum valor secreto passa
por chat, e-mail ou Git.

| # | Item | Quem | Observação |
| --- | --- | --- | --- |
| 3.1 | ⚠️ **Girar a `service_role` key** | 👤 | **Sem urgência agora.** Decisão do dono: girar **só quando o app for usado de verdade**; hoje todos os dados são fictícios. É obrigatório antes do primeiro aluno real (marco M1). A chave apareceu inteira no chat em 23/09. Na Render, só o **Cron Job `snakethai-media-cleanup`** usa essa chave, e é lá que ela precisa ser trocada; o serviço web nunca a teve. Trocar também no `.env` local |
| 3.2 | ⚠️ Trocar a **senha do banco** e **revogar o token da CLI** que foram colados no chat | 👤 | Gere um token novo só na hora de usar |
| 3.3 | Trocar a **senha de primeiro acesso** em Configurações e **redefinir** as contas que nunca entraram | 👤 | A atual é pública no repositório. Consulta no [`RUNBOOK`](docs/RUNBOOK.md) |
| 3.4 | **Chave FCM de produção** | 👤 | `npx eas-cli@latest credentials -p android` num terminal interativo, **perfil `prod`**, pacote `com.snakethai.app`. Depois: ativar, receber e tocar com o app fechado e aberto |
| 3.5 | ⚠️ **Dados de demonstração fora de produção** | 🤖 `executar-projeto` + `banco-de-dados-projeto`, depois 👤 | **O `demo_seed_limpar.sql` não basta.** Ele apaga só as contas `@demo.snakethai.com` e deixa, de propósito, as aulas e as contas de teste. Só que o ano de histórico gravado em produção em 23/09 (785 aulas, 463 mensalidades, presenças e justificativas) criou aulas **sem marca própria** (título "<turma> — treino") e lançamentos para todos os alunos ativos. É preciso um script de limpeza desse pacote, ou uma decisão de "zerar o operacional e manter a configuração" (planos, turmas, grade, textos legais). Backup primeiro. Diga qual e-mail é a conta real de admin |
| 3.6 | **Configuração real**: chave PIX, grade semanal de cada turma e prazo de guarda do comprovante | 👤 | Prazo recomendado: 90 dias (`update public.academy_settings set proof_retention_days = 90;`), só com aprovação |
| 3.7 | **Dados dos termos** preenchidos em produção → `npm run legal:publicar` → migration de publicação | 👤 + 🤖 | Push e Sentry só depois de publicado. O item 5.2 facilita este; se o aluno real estiver perto, puxe o 5.2 para antes |
| 3.8 | **Aluno menor de idade**: como colher o consentimento do responsável (LGPD, art. 14) | 👤 | Decisão com o jurídico. Hoje o app não cadastra responsável |
| 3.9 | **Release Android**: reativar pelo GitHub Actions ou manter a publicação local | 👤 | Recomendação: **manter local** por ora, porque é o caminho que funciona e tem o `versao:verificar`. O workflow fica desabilitado e anotado; reativar se outra pessoa passar a publicar. **Nos dois caminhos, vale a convenção de release da § 12.3 do contrato (3A.3)**: o aviso de atualização depende dela |
| 3.10 | **Auditoria de segurança e LGPD** | 🤖 `revisar-projeto` → `seguranca-projeto` | Ver abaixo |

**3.10, o foco da auditoria.** A última rodada é de 2026-08-31, mais a L1 em 16/09. Desde lá entraram:

- **o primeiro cliente de navegador** (`snake-web`), que usa as mesmas políticas de RLS em
  outro ambiente, com sessão guardada no `localStorage`;
- o aluno sem app (`access_channel`) e a trava de promoção;
- a fila de push e os documentos legais;
- os dois itens médios do [`REVIEW.md`](REVIEW.md) que continuam abertos: **paginação das
  listagens** e **limite de taxa nas Edge Functions**.

Nada sobe para aluno real sem essa auditoria. [#49][#64]

---

## Fase 3A — APK 1.9.0 com o aviso de atualização (sai antes de tudo da Fase 4)

> **Contrato:** § 12.3 (D53, T48) e § 14 ("Antes de tudo"). É a **única exceção ao G0**:
> depende só da aprovação dos textos da § 12.3, e não do banco, do servidor nem de outro portão.
> **Não espera as Fases 2 e 3.** Não usa o banco e não cruza repositório; a web não se aplica.
>
> **Mockup:** linha H, tela "Aviso de atualização — ao abrir o app".

**Por que antes de tudo:** o aviso só aparece a partir do **primeiro APK que tiver a checagem**.
Quem está na 1.8.0 nunca o verá. Todo aparelho que estiver na 1.9.0 quando a 2.0.0 sair recebe o
aviso no próprio app; quem ficar na 1.8.0 precisa ser avisado por outro canal (4.13). Quanto mais
cedo a 1.9.0 sair, menos gente fica para avisar por fora.

- [x] **3A.1** 👤 Aprovar os **textos da § 12.3** (aprovados em 25/09, com a linha H) (linha H dos mockups). Anote no Registro:
  "Textos da § 12.3 aprovados em dd/mm". **Não é o G0:** libera só esta fase.
- [ ] **3A.2** 🤖 `executar-projeto` (+ `design-de-interface-projeto` e `testes-projeto`): a
  checagem e a folha, exatamente como a § 12.3:
  - **Fonte:** `GET https://api.github.com/repos/yagoriccomi/snake-thai/releases/latest`, com
    `Accept: application/vnd.github+json`, **sem token** (o repositório é público) e tempo
    máximo de 5 s. O `releases/latest` já ignora rascunho e pré-lançamento.
  - **Versão nova:** `tag_name` precisa casar `^v(\d+)\.(\d+)\.(\d+)$`. A instalada é o núcleo
    `X.Y.Z` de `Constants.expoConfig.version`, **antes do `+`** (build fora da tag tem
    `+N.sha`). Mostra só se a nova for **maior**, comparando MAJOR, MINOR e PATCH como números.
  - **Link montado a partir da tag já validada, nunca lido da resposta** (achado S6 da revisão):
    `https://github.com/yagoriccomi/snake-thai/releases/download/vX.Y.Z/snake-thai-vX.Y.Z.apk`,
    oferecido só se a resposta tiver o asset de nome **exato** `snake-thai-vX.Y.Z.apk` com
    `browser_download_url` **exatamente igual** a esse valor. Sem esse asset, o link é
    `https://github.com/yagoriccomi/snake-thai/releases/tag/vX.Y.Z`, também montado (o
    `html_url` não é usado). O `-playstore.aab` é ignorado. **O app nunca abre outra URL nem
    outro esquema** (`intent://`, outro domínio). Abre no navegador.
  - **Uma vez por dia:** no máximo **uma consulta e um aviso por dia** por aparelho. "Dia" = data
    em `America/Sao_Paulo`, guardada no `AsyncStorage` junto com a última tag vista. Confere ao
    abrir e ao voltar ao primeiro plano. Resposta 403 ou 429 também conta o dia como consultado.
  - **Não mostra:** no APK DEV (`env.appVariant === 'development'`); sem rede; com erro ou tempo
    esgotado; com tag fora do formato; com a versão instalada igual ou maior. A falha vai para
    `log.warn` (nunca `log.error`) e **nunca trava a abertura**.
  - **Onde:** em qualquer tela, inclusive no Login, numa folha sobre a tela atual. **Nenhuma
    versão é bloqueada** (T48).
  - **Textos exatos (§ 3 e § 12.3):** título **Nova versão disponível** · corpo **"A versão
    {instalada} deste aplicativo pode apresentar mal funcionamento. Recomendamos atualizar para a
    versão {nova}."** · nota **"Este aviso aparece uma vez por dia até você atualizar."** · botões
    **Baixar atualização** (abre o link) e **Agora não** (fecha até o dia seguinte).
  - **Testes obrigatórios, pelos caminhos de falha:** o DEV não consulta; sem rede e tempo
    esgotado não travam a abertura; 403 e 429 contam o dia; tag fora do formato, versão igual e
    versão menor não mostram; a instalada com sufixo `+N.sha` compara só o núcleo `X.Y.Z`;
    asset ausente ou com
    `browser_download_url` diferente leva à página da tag; a segunda abertura no mesmo dia não
    consulta. [#41][#46]
- [ ] **3A.3** 🤖 `documentar-projeto`: registrar no `docs/VERSIONAMENTO.md` a **convenção de
  release** que o aviso pressupõe, valendo para o `release.yml` e para a publicação local
  (`gh release create`):
  - tag `vX.Y.Z`, sem sufixo, como hoje;
  - asset `snake-thai-vX.Y.Z.apk`, com esse nome exato;
  - release publicada (nem rascunho nem pré-lançamento) e marcada **Latest**; uma correção de
    linha antiga, se um dia existir, sai com `--latest=false`;
  - o `SHA256SUMS.txt` não é mais publicado (desde `3e437e5`), e o aviso não depende dele.

  Quem quebrar a convenção quebra o aviso em todos os aparelhos. [#96]
- [ ] **3A.4** 👤 Aparelho: com o APK DEV, o aviso não aparece; com o de produção e sem rede, o
  app abre normal; **Agora não** fecha até o dia seguinte. **O aviso de verdade só aparece
  quando existir uma versão maior que a instalada**, então a prova final fica para a 2.0.0
  (4.13).
- [ ] **3A.5** ⚠️👤 **Publicar a 1.9.0** pelo caminho do `docs/VERSIONAMENTO.md`
  (`npm run versao:minor` → `npm run versao:tag` → push da `main` e da tag), **nunca os dois
  caminhos para a mesma tag**. Conferir no GitHub que a release saiu **Latest**, sem
  pré-lançamento, com o asset de nome exato.
  - **Sem migration nem Edge Function nova desde a v1.8.0**, se possível (com o 1.5 feito, o
    `versao:verificar` avisa). Se houver, vale a regra da Fase 1: migration → Edge Function → APK.
  - Depois de publicar, peça a quem usa o app hoje (equipe e contas de teste) que instale a
    1.9.0.

---

## Fase 4 — Nova direção: horário livre, troca de aula, chamada auditável, solicitações e perfis

> **Contrato:** [`docs/CONTRATO.md`](docs/CONTRATO.md), **v3** (2026-09-24, revisada em
> 2026-09-25). **Nenhum chat implementou nada da v3 ainda.** **Este chat é o dono do contrato**
> e do banco, e os chats do `snake-server` e do `snake-web` leem dele.
>
> **Mockups:** artifact **"Mockups Snake Thai — Horário livre"**
> (<https://claude.ai/artifact/LKTwfN8yTV7HFVsm2a9SHd>), **versão 8** (25/09), 36 telas em oito
> linhas. **A–F** aprovadas pelo dono em 24/09; **G** (escolher aulas, aula extra e troca) e
> **H** (histórico de turma, contato da academia e aviso de atualização) aguardam aprovação.
>
> **Substitui a antiga fila de produto.**
>
> - O antigo 4.1 (Pessoas) e o antigo 4.2 (Histórico do Financeiro) entraram no bloco **4.10**.
> - O antigo 4.3 (aviso minimizável) foi **substituído** pelo botão de chamadas pendentes do
>   **4.6**; o lembrete diário foi para o **5.1a**.
> - O antigo 4.4 virou o **5.1**, e o antigo 4.5 virou o **5.2**.

**O que a v3 trouxe e onde entra:**

| Tema | Contrato | Blocos |
| --- | --- | --- |
| Menu de aulas (`menu_de_aulas`) | § 12.2, D43, T43 | 4.4 (RPC e tela); os botões de troca, no 4.9b |
| Aula extra do fixo, em qualquer aula | § 9.5, D51, D56, T40 | 4.4 (declarar), 4.5 (conta), 4.6 (chamada) |
| Troca de aula avulsa e permanente | § 9.4, D44–D50, T33–T39, T41, T42, T49 | 4.1 (tabelas e `grade_efetiva_do_fixo`), 4.3 (fim de horário), 4.6 (chamada), 4.7 (cancelamento), 4.9b (pedir, decidir, desistir e listas) |
| Abono da troca com a aula nova cancelada | D57, T50 | 4.5 (conta), 4.7 (cancelar e reativar) |
| Histórico de turma | D58, T51–T53, § 5.2 | 4.1 (tabela, gatilho, backfill, `excluir_turma`), 4.3 (Turmas), 4.4, 4.5 (conta, F2 e F6), 4.6 (chamada, T47), 4.10 (perfil e aviso ao mudar), 4.11 (LGPD) |
| Contato da academia | § 5.4, D52, T44 | 4.1 (colunas), 4.3 (RPC, Configurações e Perfil); o bloco de contato nos negados de 4.8, 4.9a e 4.9b |
| Guarda dos anexos em 180 dias | D54, T45, § 8 | 4.1 (coluna e gatilho de proteção), 4.6 (cron), 4.11 (Política) |
| T10 vetada: média do Painel sem teto | D55, § 11.6 | 4.5 |
| Notificações de troca | § 10 | 4.1 (enum), 4.7 (`send-push`), 4.9b (enfileirar, obsolescência e toque) |
| Aviso de atualização | § 12.3, D53, T48 | **Fase 3A** (APK 1.9.0) |

**Regras deste chat:**

1. **Nada começa antes de G0** (4.0), **exceto a Fase 3A** (APK 1.9.0).
2. **Os blocos seguem a ordem da tabela abaixo.** Cada bloco é um ou mais PRs pela
   `executar-projeto`: plano escrito antes do código, `design-de-interface-projeto` em toda tela
   (seguindo o mockup aprovado) e `banco-de-dados-projeto` em toda migration.
3. **Toda migration** cumpre o **§ 0.1 do contrato**, inclusive os testes de regressão que a v3
   acrescentou nele, e passa por `scripts\db-dev test` e `scripts\db-dev reset`. Depois vem
   `scripts\db-dev types`.
4. **Mudou um nome de fronteira?** Pare. A mudança vai para o contrato (com aprovação do usuário e
   versão nova), **nunca** direto no código.
5. **Portões que este chat abre:** G1, G3, G4 e G5. O G0 é aberto por você, e este chat o anota.
   Ao abrir,
   **anote no Registro:** "G1 aberto em dd/mm". **É ali que os outros chats olham.** O G2 é do
   servidor: leia o Registro do [`snake-server/ROADMAP.md`](../snake-server/ROADMAP.md) antes de
   usar anexo.
6. **Produção:** tudo sai **junto**, numa versão só, na ordem do § 14: servidor (G2) →
   `send-push` com os **dez** tipos novos e o `default` → migrations → `create-staff` → APK no
   mesmo dia → web. **Antes de tudo isso, a 1.9.0 (Fase 3A).**
   - **Por que junto:** as travas novas desligam funções do APK 1.8: decidir justificativa,
     retificar chamada e, pela T47, fazer a chamada de aula com troca, extra ou aluno que mudou de
     turma depois dela.
   - **Por isso é a 2.0.0:** pela regra de `docs/VERSIONAMENTO.md`, MAJOR = APK antigo deixa de
     funcionar.
7. **Rótulos:** todo texto de tela vem da **§ 3 do contrato**, igual no app e na web. Saem
   "Justificativa recusada" (hoje em `src/utils/frequency.ts`), "(sem contato por enquanto)",
   "média, limitada a 100% por aluno" e, para o fixo, a recusa *"Esta aula é só para alunos de
   horário livre. Para ir nela, peça a troca."* (D56).

| # | Bloco | Contrato | Mockups | Depende de | Abre |
| --- | --- | --- | --- | --- | --- |
| 4.0 | 👤 **Aprovar** as linhas G e H dos mockups e o contrato v3 (revisão de 25/09) | § 14 (G0), § 16 | A–H aprovadas (A–F em 24/09; G e H em 25/09, versão 8) | — | **G0 ✅ 25/09** |
| 4.1 | **Esquema completo** | § 0.1, § 4 a § 10 (a parte de dados), § 5.2, § 5.4 | — | G0 | **G1** |
| 4.2 | **Admin é professor** | § 4 | A (Horário) | G1 | — |
| 4.3 | **Planos, grade, dias de aula e contato** | § 5, § 5.4, § 6 | A, H (contato) | G1 | — |
| 4.4 | **Aulas do aluno, menu de aulas, extra e meta** | § 5.3, § 9.2, § 9.5, § 12, § 12.2 | B, G (escolher aulas) | 4.3 | — |
| 4.5 | **Frequência nova** | § 11 | B (Frequência) | 4.4 | — |
| 4.6 | **Motivos e chamada nova** | § 7, § 8, § 15 | C, G (Chamada — trocas e extras) | 4.2, 4.5 · anexos: **G2** | — |
| 4.7 | **Cancelar e reativar aula** | § 6.1, § 10 | C (Cancelar, Cancelada) | 4.6 | — |
| 4.8 | **Justificativas novas** | § 9.1, § 10, § 15 | B, D | 4.6 · anexos: **G2** | — |
| 4.9a | **Solicitações** | § 9.3 | D | 4.6, 4.8 | — |
| 4.9b | **Troca de aula** | § 9.4, § 10 | G (troca, meus pedidos, decidir troca) | 4.4, 4.9a · anexos da permanente: **G2** | **G3** |
| 4.10 | **Perfis e Pessoas** | § 12, D29–D32, D58 | E, H (mudar o aluno de turma) | 4.5, 4.9b | — |
| 4.11 | **LGPD** | § 12.1, § 5.2, D22, D54 | — | 4.8 a 4.10 | **G5** |
| 4.12 | **Auditoria antes de publicar** (`revisar-projeto` → `seguranca-projeto`) | tudo | — | 4.1 a 4.11 | — |
| 4.13 | ⚠️👤 **Publicar a 2.0.0** | § 14 | — | 4.12, **G2**, Fase 3A | **G4** |
| 4.14 | **Fase B** | § 15 | — | **G6** | — |

### 4.0 Aprovar (abre G0)

- [x] Linhas A–F dos mockups aprovadas pelo dono (24/09)
- [x] Textos da § 12.3 (linha H, aviso de atualização) — é o 3A.1 e pode vir antes do resto
- [x] Linha G: escolher aulas (livre e fixo), **Vou (extra)** inclusive nas aulas "só livres"
  (D56), trocar só nesta semana (repor falta), troca permanente, meus pedidos de troca (com
  "Troca abonada"), chamada com trocas e extras, decidir troca e a web
- [x] Linha H: Configurações › contato da academia, Falar com a academia, mudar o aluno de turma
  (histórico) e aviso de atualização
- [x] Contrato v3 com a revisão de 25/09. P1–P22 foram respondidas em 25/09. **P23–P25 (§ 16)
  valem como escolhidas: o dono abriu o G0 sem vetá-las**
- [x] **G0 anotado no Registro** (25/09)

### 4.1 Esquema completo (abre G1)

- [ ] Plano · [ ] Banco · [ ] Testes · [ ] Tipos gerados · [ ] **G1 anotado no Registro**

**O que entra, numa série de migrations e sem as RPCs de comportamento:**

- **Migrations isoladas** (§ 0.1): os valores novos de `notification_kind` (os seis da v2 e os
  quatro de troca: `troca_pendente`, `troca_aprovada`, `troca_negada` e
  `troca_aprovada_equipe`) e de `media_deletion_reason` (`anexo_de_motivo_removido` e
  `anexo_expirado`).
- **Enums novos** do § 5.1, inclusive `class_swap_kind`, `class_swap_status` e o
  `'class_swap_evidence'`, que nasce no `create type` de `action_reason_kind`.
- **Tabelas novas** (as 15 da conferência do G1):
  - `plan_periods`, `inactive_periods`, `weekly_goals`, `student_group_periods`;
  - `action_reasons`, `action_reason_attachments`;
  - `roll_call_requests`;
  - `attendance_audit`, `class_teacher_presence`, `class_audit`;
  - `absence_justification_reviews`, `absence_justification_attempts`;
  - `class_swaps`, `class_swap_reviews`, `class_swap_periods` (§ 9.4: constraints, índices
    únicos parciais e RLS **sem** grant nem política para `authenticated`).
- **Colunas novas** em `plans`, `classes`, `class_schedules`, `attendance`,
  `absence_justifications` e `academy_settings`: `class_weekdays` com **seg–sáb**,
  `default_weekly_goal`, `attachment_retention_days` com **180** (D54) e `contact_whatsapp` **no
  fim da tabela** (o `select('*')` do APK 1.8 não quebra).
- **Constraints** criadas `NOT VALID`, com a conferência antes do `VALIDATE`: as de caminho de
  anexo e de comprovante e, na v3, `academy_settings_email_valido` (o cliente passa a gravar
  `null` no lugar de texto vazio).
- **RLS, grants e o `grant` por coluna de `class_teachers`.** `student_group_periods` é legível
  pelo próprio aluno e por `is_staff()`.
- **`pode_ler_motivo`**, a única chamada das políticas de `action_reasons` e
  `action_reason_attachments` (§ 8). Uma subconsulta a `roll_call_requests` ou `class_swaps`
  direto na política daria `42501` em todo `select` de anexo.
- **`grade_efetiva_do_fixo`** (interna, T33): nasce aqui porque o gatilho da § 9.1 (c) já
  depende dela. É a **única** resposta para "esta aula é dele?"; nenhuma RPC calcula isso de
  outro jeito.
- **Gatilhos:** os de trava (§ 6, § 7.1, § 9.1); `registrar_periodo_de_turma` (§ 5.2, depois do
  `marcar_entrada_na_turma`, já aplicando a T53); `cancelar_troca_de_aula_apagada` (§ 9.4, com a
  T50 na aula nova apagada); `trg_academy_settings_proteger_guarda_de_anexos` (§ 5.2).
- **Backfills:** `week_start`, `plan_periods`, `inactive_periods` e `student_group_periods` (T52:
  na mesma migration que cria a tabela, **antes** de criar o gatilho).
- **`excluir_turma` e `previa_exclusao_turma`**, com as mesmas assinaturas: a turma com histórico
  passa a ser arquivada, e os períodos fechados por ela ganham `'group_closed'`. Entram nesta
  série porque a FK `on delete restrict` de `student_group_periods` faria o "apagar de vez"
  falhar.

**Testes SQL novos:**

- regras transversais: anon recebe 401/42501; tabela nova sem leitura para quem não pode;
- as travas: `attendance_taken_at` não volta a nulo; aula com chamada não é apagada; DELETE em
  `attendance` fora da RPC falha;
- o upsert do APK 1.8 continua funcionando (`week_start` preenchido pelo gatilho);
- a decisão por `update({status})` dá a mensagem de "atualize o aplicativo";
- a promoção com `color: null` mantém a cor;
- **v3 (§ 0.1):** admin mudando `academy_settings.attachment_retention_days` recebe `42501`;
  `update` direto de `profiles.group_id` como admin (o caminho do APK 1.8) grava o período em
  `student_group_periods` e aplica a T53; `select` em `student_group_periods` com o token de
  outro aluno volta vazio;
- **a conferência inteira do G1** (§ 14): 15 tabelas; os 3 valores de enum
  (`anexo_de_motivo_removido`, `class_swap_evidence`, `troca_pendente`); a coluna
  `contact_whatsapp`; a função `pode_ler_motivo`; o gatilho `registrar_periodo_de_turma` em
  `profiles`; e o backfill dando 0.

### 4.2 Admin é professor

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `is_staff()`;
- `diretorio_perfis` com os admins que têm cor e a coluna `schedule_mode`;
- os gatilhos de papel `before insert or update of teacher_id`;
- a `create-staff` com a cor opcional para admin.

**App:**

- flag `isStaff` (sem mudar `isProfessor`);
- a aba Financeiro continua para o admin;
- **MINHA COR** e **Entrar/Sair da aula** para o admin;
- ao entrar numa aula sem cor, o app pede a cor (T24);
- o seletor da grade (`ProfessorMultiPicker`) lista os admins com cor.

### 4.3 Planos, grade, dias de aula e contato

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `plans` com modalidade e cota, e a trava de plano com histórico (T4);
- os gatilhos `registrar_periodo_de_plano` e `registrar_periodo_inativo`, **já com os
  encerramentos de troca da T39** (deixar de ser fixo; trancamento);
- `salvar_horario_da_grade` com `p_audience` (DROP + CREATE);
- `ocorrencias_da_grade` com `left join`;
- o horário "só livres" sem turma;
- **fim de horário e troca permanente** (§ 6, T37, T39): `encerrar_horario_da_grade`,
  `excluir_turma` e `salvar_horario_da_grade` (com `valid_until` novo ou mudado) encerram os
  `class_swap_periods` vigentes de destino, **nunca com data passada**, e cancelam as
  permanentes pendentes; o `valid_until` adiado ou retirado devolve o fim;
- `trocas_permanentes_do_horario` (só admin);
- `contato_da_academia()` (§ 5.4): qualquer `authenticated`, nunca antes do login.

**Telas (mockups das linhas A e H):**

- **Planos:** três modalidades e a cota em escada de 1 a 6;
- **Novo horário:** "Quem pode participar" e turma opcional para "Livres";
- **Grade:** antes de encerrar ou editar um horário, **"{n} aluno(s) têm troca permanente com
  este horário."**;
- **Configurações › Dias de aula:** chips de Seg a Dom, com seg–sáb ligados;
- **Configurações › CONTATO** (`ConfiguracoesScreen`): **E-mail** · **WhatsApp** (com **+55**
  fixo) · **Telefone** · **Endereço**. O "Telefone" continua sendo só telefone e não aparece no
  contato;
- **Perfil › Falar com a academia** (a aba **Dados** do app): botões **WhatsApp**
  (`https://wa.me/<whatsapp>`) e **E-mail** (`mailto:`), só os preenchidos, com
  `Linking.openURL` e a falha tratada; sem contato, **"A academia ainda não cadastrou um
  contato. Procure a recepção."**;
- o **bloco de contato** (**"Para mais informações, fale com a academia:"** + botões) como
  componente, para os negados do 4.8, 4.9a e 4.9b. **Nunca na tela de login nem em push**;
- **Turmas:** entrada para as aulas só de livres; na confirmação de **Excluir turma** com
  alunos, **"A frequência dos alunos continua contando as aulas desta turma até agora."**

### 4.4 Aulas do aluno, menu de aulas, extra e meta

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `aulas_do_aluno` e `menu_de_aulas` **nascem juntas, com a mesma lista e a mesma ordem de
  colunas** (§ 12.2: mudar uma exige DROP + CREATE das duas na mesma migration), já com as
  colunas da v3: `origem`, `is_recurring`, `schedule_ends_on`, `can_mark_extra`,
  `can_swap_from`, `can_swap_from_permanent`, `can_swap_to`, os `swap_*` e `can_cancel_swap`;
- `menu_de_aulas` só para esta semana e a próxima (`22023` fora disso), com todas as aulas da
  semana, inclusive as que já passaram. O fixo vê **todas** as aulas de rotina, de qualquer turma
  e público. Sem vagas e sem ocupação (T43). `p_referencia` só para o sistema (testes em data
  fixa);
- `declarar_aula` com a **extra do fixo** em aula de rotina de **qualquer público**, inclusive
  "só livres" (D56); "Não vou" fora da grade só limpa; as recusas da § 9.2, inclusive *"Você já
  tem aula neste horário. Para ir nesta, peça a troca."*;
- as travas no upsert antigo: `'absent'` de um fixo fora da grade vira nulo; na original de troca
  aprovada, `23514`;
- `definir_meta_semanal` e `meta_da_semana`.

**App (mockups das linhas B e G):**

- `StudentAulasList` para as três modalidades;
- barra da semana;
- **Marcada · Desmarcar**;
- aviso de acima da cota **que não bloqueia**, com Desfazer;
- aula cancelada riscada;
- meta do à vontade com a folha "vale a partir de…";
- botão **Escolher aulas** na tela Aulas → tela **Aulas da semana**, abas **Esta semana** /
  **Próxima semana**, um bloco por dia de aula (`class_weekdays`), a mesma para livre, à vontade
  e fixo;
- fixo: selos **Sua aula**, **Extra**, **Troca**, **Troca permanente** e **Troca pendente**, e
  os botões **Vou (extra)** e **Desmarcar**, pela tabela de ações da § 12.2;
- **os botões de troca** (**Trocar para esta**, **Desistir da troca**) e a folha **Trocar aula**
  entram no **4.9b**, quando as RPCs de troca existirem. As colunas já vêm do banco desde aqui.

**Atenção:** rótulos e botões vêm **só** das colunas da RPC (§ 12 e § 12.2).

**Teste que não pode faltar:** um que falha se `aulas_do_aluno` e `menu_de_aulas` divergirem em
colunas ou ordem.

### 4.5 Frequência nova

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `frequencia_semanal`, `frequencia_do_mes` e `semanas_do_mes`;
- `frequencia_mensal` legado com o **ritmo** (§ 15);
- `attendance_monthly` (colunas novas e antigas preenchidas; `group_id` passa a ser a turma **em
  que ele terminou o mês**);
- `fechar_frequencia_do_mes` **diário**, com o recálculo do T31, que na v3 também dispara com a
  troca que muda de estado e com o período de troca permanente aberto, encerrado ou com o fim
  mudado. A mudança de turma não dispara recálculo por si;
- `painel_admin_resumo` e `painel_alunos_em_risco` com a mesma assinatura: risco pelo ritmo, à
  vontade fora dos dois e **média simples, sem teto por aluno** (D55: a T10 foi vetada nessa
  parte);
- **a conta do fixo pela `grade_efetiva_do_fixo`** (T33): a turma **da data de cada aula** (D58,
  T51), a troca permanente vigente e as trocas avulsas aprovadas; o início da contagem das
  presenças pela T52;
- a **extra** nunca entra no esperado e conta em "feitas" (acima de 100%);
- troca avulsa aprovada com a **aula nova cancelada**: a vaga fica abonada, inclusive na
  reposição e na troca aprovada pelo sistema (D57, T50).

**Regressão SQL obrigatória:** a § 11.5 inteira:

- o exemplo do dono, os cinco casos da Semana Extra e os casos-limite, inclusive o **Painel com
  150% e 50% dando 100,00%** (D55) e a T30 com oferta parcial;
- a tabela **Trocas e extra**;
- a tabela **Histórico de turma** (fev/2027);
- **reescrever o F2 e o F6 de `supabase/tests/regressao_frequencia_turma_e_trancamento.sql`**
  (§ 0.1): o F2 passa a esperar as aulas da turma antiga até a mudança (D58); o F6, que grava
  `group_since` à mão, passa a montar o cenário pelos períodos (a conta não lê mais
  `group_since`, T51).

**Este é o item que não pode sair "plausível e errado".**

**App:**

- o `FrequencyCard` com Semana e Mês (Meta, no à vontade);
- a tela **Frequência** com as semanas e a Semana extra;
- `formatarPercentual` já aceita valores acima de 100%, e a média do Painel também pode passar
  de 100%.

### 4.6 Motivos e chamada nova

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `criar_motivo` (na v3, também `'class_swap_evidence'`: só aluno ativo e `p_class_id` nulo),
  `pode_anexar_ao_motivo`, `anexar_ao_motivo`, `motivos_da_aula` e `marcar_retificacao_conferida`;
- os crons `apagar_motivos_nao_usados` e `enfileirar_anexos_expirados`. O segundo, na v3:
  - apaga o anexo **180 dias depois da decisão** (tabela de referência da § 8), ligando
    `snake.anexo_expirado`, para que os gatilhos de fila gravem `'anexo_expirado'` sem mandar o
    arquivo duas vezes;
  - a tentativa 1 (`absence_justification_attempts`) enfileira direto;
  - **antes** de apagar, cancela as trocas permanentes pendentes cuja aula nova começou há mais
    de 30 dias (P21);
- `lista_da_chamada` com as origens da v3 (`'turma'`, `'permanente'`, `'troca'`,
  `'troca_pendente'`, `'extra'`, `'trocou'`, `'marcou'`, `'incluido'`), a turma **da data da
  aula** (D58) e os `swap_*`; `professores_da_chamada`, `buscar_alunos_para_incluir` e
  `buscar_equipe_para_incluir`;
- `salvar_chamada_v2`, com a retificação, a trava da presença de professor (D28) e as **regras 7
  e 8** da § 7.2: a presença aprova a troca pendente e a ausência a expira; a presença na
  original cancela a pendente; a volta de expirada para aprovada só com a conferência da T35;
- a compatibilidade de `salvar_chamada` e `concluir_chamada` (§ 15), **com a T47**: recusam, com
  *"Atualize o aplicativo para fazer a chamada desta aula."*, a aula que tem alguém `'permanente'`,
  `'troca'`, `'troca_pendente'` ou `'extra'`, **ou um fixo `'turma'` que hoje está em outra turma
  ou sem turma** (mudou de turma depois da aula). A presença gravada pela `salvar_chamada` na
  original de uma troca pendente cancela a troca;
- `chamadas_pendentes`.

**Testes que a v3 acrescenta aqui:**

- `select` em `action_reason_attachments` com o token de um professor, de um aluno e de um admin,
  com motivos **de todos os tipos**, sem nenhum `42501` (§ 0.1);
- a T47, inclusive a chamada atrasada da turma antiga depois da mudança (último caso do histórico
  de turma na § 11.5).

**App (mockups das linhas C e G):**

- **sai o `MissedRollCallBanner`** e entra o botão **Chamadas pendentes**;
- a tela de pendentes (Minhas/Todas);
- a chamada em blocos: professores, fixos, os que marcaram e incluídos;
- os selos de troca e extra na chamada: **Troca**, **Troca pendente** (com a dica **"Marcar
  presença aprova a troca."**), **Troca permanente**, **Extra** e **"Trocou para {dia dd/mm
  hh:mm}"**;
- **Incluir aluno** e **Acrescentar professor**;
- a folha **Retificar**, com as mudanças listadas, o motivo obrigatório e os anexos;
- os selos **Editada** e **Feita X dias depois**;
- o rascunho da chamada sobe de versão (`VERSAO_DO_RASCUNHO`) e passa a guardar os incluídos.

**Anexos:** só depois de **G2**. Antes disso, a retificação só com texto funciona.

### 4.7 Cancelar e reativar aula

- [ ] Plano · [ ] Banco · [ ] Edge Function · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `cancelar_aula` e `reativar_aula`;
- os destinatários de D25, com o público e a situação. **Na v3, os fixos são os da T42:** com a
  aula na grade efetiva, com troca pendente para ela ou com extra marcada nela, em qualquer
  público, calculados no cancelamento e **de novo** na reativação (T22);
- a regra de furar o silêncio **só no primeiro cancelamento**;
- a obsolescência dos avisos;
- **as trocas no cancelamento** (§ 6.1, T50, D57):
  - aula **original** com avulsa pendente: a troca é cancelada;
  - aula **nova** com avulsa pendente: cancelada, se a original ainda não começou; **aprovada
    pelo sistema** (`decided_via = 'system'`, sem `class_swap_reviews` e sem push de aprovação),
    com a vaga abonada, se a original já começou;
  - avulsa **aprovada** para a aula: a vaga fica abonada, inclusive na reposição;
- **na reativação:** a aprovada pelo sistema volta a `'pending'` **antes** de calcular os avisos;
  a troca cancelada não volta; a aprovada por decisão ou pela chamada continua, sem o abono.

**`send-push`:** os **10 tipos novos** — os 6 da v2 e os 4 de troca (`troca_pendente`,
`troca_aprovada`, `troca_negada` e `troca_aprovada_equipe`), com os textos da § 10 em
`send-push/mensagens.ts` — e um **`default`** que não quebra o lote. **Ela vai para produção
antes das migrations** (§ 14): um tipo desconhecido trava todo push.

**App:** a folha **Cancelar aula**, que diz quem será avisado; a aula cancelada com **Reativar**;
o roteamento do toque (`notificationRouting`).

### 4.8 Justificativas novas

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- `enviar_justificativa`, `reenviar_justificativa` (D42), `anexar_a_justificativa`,
  `decidir_justificativa`, `minhas_justificativas`, `justificativas_para_revisar` e
  `justificativas_do_aluno`;
- `pode_decidir_justificativa` e a RLS nova (o atestado só enquanto está pendente);
- as notificações `justificativa_aprovada` e `justificativa_negada` (tentativa 1 ou 2);
- **v3:** a original de troca pendente ou aprovada é recusada (gatilho da § 9.1 (c), já no
  4.1), com *"Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova."*; a aula
  nova de troca aprovada se justifica como uma aula da turma.

**App:**

- justificar a aula passada (fixo) e a semana (livre);
- "Reenviar até dd/mm";
- a revisão com **nota obrigatória**;
- as duas mensagens de negada; a da **2ª tentativa** leva o **bloco de contato** (§ 3, § 5.4).

**Anexos:** usam `POST /v1/justifications/sign-upload {justificationId}` (**G2**).

### 4.9 Solicitações e troca de aula (abre G3)

Dois PRs, nesta ordem. O G3 abre no fim do 4.9b.

**4.9a — Solicitações**

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho

**Banco:**

- os 5 tipos de `roll_call_requests`;
- `abrir_solicitacao`, `decidir_solicitacao`, `minhas_solicitacoes`, `caixa_de_solicitacoes`,
  `itens_da_solicitacao` e `solicitacoes_decididas`, já com a categoria `trocas_de_aula` e o tipo
  `'troca'` (a lista só se enche no 4.9b);
- `student_was_present` também na aula nova de uma troca expirada (T35) e recusado na original
  de troca pendente ou aprovada (T38);
- a notificação `solicitacao_pendente`.

**App (mockups da linha D):**

- o atalho **Solicitações** (ícone de caixa com contador no cabeçalho da primeira aba);
- as **5 categorias**, na ordem da § 3: **Faltas de alunos · Faltas de professores ·
  Retificação de chamadas · Trocas de aula · Pagamentos de mensalidade**, cada item levando ao
  lugar de decidir;
- **Pedir ao admin** (professor): "Eu estava na aula", "Justificar ausência", "Corrigir chamada
  de outro professor" e "Me incluir nesta aula";
- **"Eu estava na aula"** (aluno, inclusive à vontade);
- **Conferido** nas retificações;
- o **bloco de contato** no "Eu estava na aula" negado e nos pedidos de professor negados (§ 5.4).

**4.9b — Troca de aula (abre G3)**

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho · [ ] **G3 anotado no Registro**

**Banco (§ 9.4):**

- `pedir_troca_de_aula`, com as recusas na ordem da tabela da § 9.4. Limpa a marcação de extra na
  aula nova, grava `used_at` no motivo da permanente e enfileira `troca_pendente`;
- `pode_decidir_troca` (com a T49) e `decidir_troca_de_aula`: nota pela T41; aprovar a permanente
  abre ou encerra `class_swap_periods` pela T37, já com o fim do horário de destino;
- `desistir_da_troca` (T36);
- as listas `minhas_trocas`, `minhas_trocas_permanentes`, `trocas_para_decidir` e
  `trocas_decididas` (só admin);
- as notificações `troca_pendente`, `troca_aprovada`, `troca_negada` e `troca_aprovada_equipe`
  pela T42 e pela D50: quem decidiu não recebe; expirada e cancelada não geram push; a aprovação
  pelo sistema (T50) não gera aviso de aprovação. A obsolescência em `reivindicar_notificacoes`
  lê o id da troca na chave.

**App (mockups da linha G):**

- no menu, **Trocar para esta** → folha **Trocar aula**:
  - **"Qual aula sua você quer trocar por esta?"**, com o selo **Reposição** na aula que já
    passou;
  - tipo **Só nesta semana** / **Permanente**;
  - na permanente, o campo **"Por que você precisa mudar de horário?"** com **Anexar arquivo**
    (até 5, imagem ou PDF, pelo fluxo da § 8 e só depois do **G2**), o aviso **"A troca
    permanente muda a sua grade a partir da próxima aula depois da aprovação."** e, com
    `schedule_ends_on`, **"Este horário termina em {dd/mm}."**;
  - botão **Pedir troca**;
- **Desistir da troca**;
- os pedidos do aluno (`minhas_trocas`): **Troca aprovada por {nome}**, **Troca abonada: a aula
  nova foi cancelada**, **Troca negada** + bloco de contato, **Troca expirada · vale a aula
  original**, **Troca cancelada** / **Você desistiu da troca**;
- **Solicitações › Trocas de aula** → tela **Revisar troca**: **Aprovar** / **Negar** e o campo
  **Motivo da decisão** (obrigatório para negar e na permanente); os anexos abrem pelo
  `/v1/motivos/view-url`;
- o toque nas notificações de troca abre **Aulas** (aluno) ou **Solicitações › Trocas de aula**
  (`troca_pendente`, equipe), pelo `notificationRouting`.

**Testes que a v3 acrescenta aqui:**

- cada recusa da § 9.4 e a tabela de encerramentos automáticos;
- **T49 (§ 0.1):** o professor que se incluiu na aula nova **depois** do pedido de troca
  permanente vê `trocas_para_decidir` vazia e recebe `pode_decidir_troca = false`. O
  `/v1/motivos/view-url` com 403 se confere com o servidor, depois do G2.

**G3 só abre com as 23 RPCs do aluno no banco local** (consulta no § 14 do contrato): as 17 da v2
mais `menu_de_aulas`, `pedir_troca_de_aula`, `desistir_da_troca`, `minhas_trocas`,
`minhas_trocas_permanentes` e `contato_da_academia`.

### 4.10 Perfis e Pessoas

- [ ] Plano · [ ] Banco · [ ] Interface · [ ] Testes · [ ] Aparelho · [ ] Acessibilidade

**Banco:**

- `perfil_do_aluno`, **na v3 com `trocas_permanentes` e `turmas_no_mes`** (D58);
- `historico_de_aulas_do_aluno`, **com `swap_kind` e `swap_other_date_time`** (a original de troca
  aprovada vem com `origem = 'trocou'`);
- `perfil_do_professor` e `historico_de_aulas_do_professor`.

**App (mockups das linhas E e H):**

- a tela **Pessoas** (a opção A aprovada em 22/09: abas Alunos/Equipe, cadastro unificado,
  ações em folha, promoção só na Equipe);
- tocar numa pessoa abre a **ficha**: frequência, histórico de aulas e financeiro (os 4
  marcadores do antigo "Histórico do Financeiro", só para o admin);
- na ficha, **a turma por período** do mês (ex.: **Turma Noite até 15/09 · Turma Manhã desde
  15/09**, § 3) e as trocas permanentes vigentes; no histórico, **"Trocou para {dia dd/mm
  hh:mm}"** no lugar de "Falta";
- **o aviso ao mudar a turma**, na edição do aluno (hoje `EditarAlunoScreen`), antes de salvar,
  com os três textos da § 3. O APK 1.8 não mostra esse aviso, mas o banco grava o histórico do
  mesmo jeito;
- a ficha do professor, **só para o admin**.

**Pontos já conhecidos do antigo 4.1:**

- o cadastro unificado carrega o "Não usa o app";
- formulário longo precisa rolar até o botão com o teclado aberto;
- a nota "a cor precisa ser apagada ao promover" **deixou de valer**: a cor fica (§ 4).

**Depois:** `acessibilidade-projeto`, porque a folha de ações e a ficha são interação nova.

### 4.11 LGPD (abre G5)

- [ ] Plano · [ ] Banco · [ ] Testes · [ ] Política · [ ] **G5 anotado no Registro**

**Banco:**

- `export_my_data` com lista explícita de colunas, continuando `security invoker`. **Na v3,
  também** `trocas` (de `minhas_trocas('-infinity', 'infinity')`), `trocas_permanentes` (de
  `minhas_trocas_permanentes()`) e `periodos_de_turma`. As duas primeiras saem das RPCs, porque
  `class_swaps` e `class_swap_periods` não têm grant para `authenticated`;
- `anonimizar_titular` com as tabelas novas: `class_swaps` primeiro (o motivo é
  `on delete restrict`), depois `class_swap_periods`, os motivos `class_swap_evidence` e o
  `student_group_periods`, este **depois** do `update` que anula `group_id`;
- `attachment_retention_days` já nasceu com **180** no 4.1 e só muda com migration **e** nova
  Política (o gatilho de proteção recusa o resto).

**Teste (§ 0.1):** `export_my_data()` como aluno com troca permanente e como aluno sem troca.

**Política nova:**

- atestado como dado de saúde e o prazo de guarda: **180 dias depois da decisão** (D22, D54);
- o professor vê todos os alunos (D32);
- metas e solicitações;
- **trocas de aula**: a justificativa da permanente pode ter dado de saúde e segue os mesmos 180
  dias;
- `npm run legal:publicar` e novo aceite no app e na web.

**Anote no Registro a versão esperada.** O chat da web confere o `/termos` com ela.

### 4.12 Auditoria antes de publicar

`revisar-projeto` → `seguranca-projeto` sobre tudo que a Fase 4 mudou. As revisões do contrato já
acharam classes de defeito que podem voltar na implementação:

- vazamento por `select` direto;
- caminho de anexo confiando no cliente;
- trava que libera sem a variável de sessão;
- **v3:** política que consulta uma tabela sem grant para `authenticated` (derruba todo `select`
  com `42501`; é por isso que existe `pode_ler_motivo`);
- **v3:** período de troca ou de turma encerrado com data no passado ("o passado não muda", D49).

### 4.13 ⚠️ Publicar a 2.0.0 (abre G4)

**Antes:**

- a **1.9.0 (Fase 3A)** já publicada: quem estiver nela recebe o aviso da 2.0.0 no próprio app;
- para quem ficou na 1.8.0, o aviso de "atualize" vai **por outro canal** (§ 12.3). Priorize
  professores e admins: o APK 1.8 deixa de decidir justificativas, de retificar chamadas e de
  fazer a chamada de aula com troca, extra ou aluno que mudou de turma depois dela (T47).

**Na ordem do § 14 do contrato:**

1. **G2** já aberto (servidor, na v3 com `allowed_formats` na assinatura e a exclusão nos três
   tipos de recurso);
2. `send-push` nova, com os **dez** tipos novos e o `default`;
3. `scripts\db-push-prod.bat`;
4. `create-staff`;
5. APK 2.0.0 no mesmo dia;
6. avisar o chat da web: **"G4 aberto em dd/mm"** no Registro, depois de rodar a conferência do
   G1 e do G3 no SQL Editor de produção.

**Depois:** num aparelho com a 1.9.0, conferir que o aviso de atualização aparece e que o link
baixa o `snake-thai-vX.Y.Z.apk` da 2.0.0 (a prova final do 3A.4).

### 4.14 Fase B (depois de G6)

Revogar o `select` direto de `reviewed_by` e de `plans.price_cents`. Aposentar `salvar_chamada`,
`concluir_chamada`, `frequencia_mensal` e a variante `{classId}` do servidor, avisando o chat do
servidor.

---

## Fase 5 — Resto da fila antiga (depois da Fase 4)

### 5.1 Notificações configuráveis + central de avisos + recado em massa

> **Entra também o lembrete diário de chamada pendente** (do antigo 4.3), como a primeira regra
> do 5.1a. E a central (5.1c) passa a guardar os tipos novos da Fase 4: aula cancelada, aula
> reativada, justificativa aprovada e negada, chamada corrigida, solicitação pendente e os quatro
> de troca.

O maior item da fila: mexe no banco, nas Edge Functions (`send-push`) e no app. **Não é uma
entrega só.** São quatro PRs, nesta ordem, cada um publicável sozinho.

**5.1a — Regras da academia** (admin)

- [ ] Plano · [ ] Interface · [ ] Banco · [ ] Testes · [ ] Aparelho · [ ] Publicado

- Tela **"Avisos da academia"** em Configurações: cada aviso com um interruptor, prazo (dias
  antes ou depois), horário e repetição.
- Os nove tipos de hoje saem de números fixos dentro das funções do banco para uma
  **tabela própria, fechada para admin**. **Não pode ser `academy_settings`**, que qualquer
  pessoa logada lê: foi assim que a senha padrão vazou uma vez.
- Mudar o horário **reprograma a rotina do pg_cron**, não é só gravar um campo.
- O texto do aviso continua no código (`send-push/mensagens.ts`) nesta etapa.

**5.1b — Preferências por pessoa** (aluno e professor)

- [ ] Plano · [ ] Interface · [ ] Banco · [ ] Testes · [ ] Aparelho · [ ] Publicado

- Tela **"Minhas notificações"** no Perfil: interruptor geral do aparelho e um por tipo.
  **Tudo vem ligado, nada é obrigatório.**
- A preferência **passa a viver no banco**. Hoje fica só no aparelho
  (`pushPreference.service.ts`) e se perde ao trocar de celular.
- **Inversão na fila:** a preferência barra o **envio**, nunca a **gravação**. Hoje a fila nem
  cria a linha quando a pessoa está sem aparelho, e isso precisa mudar para a central funcionar.
- "Silenciado pela pessoa" vira um motivo visível no diagnóstico. Senão, o sintoma vira
  "sumiu a notificação".

**5.1c — Central de avisos**

- [ ] Plano · [ ] Interface · [ ] Banco · [ ] Testes · [ ] Aparelho · [ ] Publicado

- **Sino no cabeçalho da primeira aba**, com contador de não lidos. Ícones Ionicons
  `notifications-outline` e `notifications`, sem biblioteca nova.
- Lista cronológica com os não lidos em destaque. O que chegou silenciado aparece marcado
  ("você desligou este aviso").
- **Marcação de lido por pessoa**, que hoje não existe.
- ⚠️ **Impacto legal:** a fila apaga tudo com **30 dias**. Guardar para consulta exige prazo
  maior ou tabela própria, e **prazo de guarda é conteúdo da Política de Privacidade**. Isso
  gera **uma versão nova da Política e um novo aceite**, no app **e na web**. O prazo é decisão
  sua com o jurídico, e precisa vir antes do código.

**5.1d — Recado em massa**

- [ ] Plano · [ ] Interface · [ ] Banco · [ ] Testes · [ ] Aparelho · [ ] Publicado

- **Destinos:** todos, uma turma ou a equipe. **O professor envia só para as turmas dele.**
- **Antes de enviar, diz quantas pessoas vão receber** ("50 alunos e 5 professores") e pede
  confirmação.
- **Tem limite de recados por dia**, porque aviso em massa não tem "desfazer". O número sai do
  plano.
- A opção "Tocar o celular agora", quando desligada, deixa o recado só na central. Quem estiver
  no silêncio (22h–7h) recebe às 7h.
- **Tipo de aviso novo mexe em quatro lugares:** o enum, os textos de `send-push`, o roteamento
  do toque (`notificationRouting`) e a regra de obsolescência.

> **Aluno de iPhone não recebe o recado.** A web não tem push nem central, e o aluno de iPhone
> é exatamente quem perderia "sem aula na quinta". Decisão sua, registrada em
> [`snake-web/ROADMAP.md`](../snake-web/ROADMAP.md), item 7.1. **Decida antes do 5.1c**, para a
> central nascer com o formato que as duas interfaces vão ler.

### 5.2 Dados dos termos com valores recomendados prontos

- [ ] Plano · [ ] Interface · [ ] Banco · [ ] Testes · [ ] Aparelho · [ ] Publicado

**O que é:** a tela *Dados → Dados dos termos e da política* já abre com os valores recomendados
preenchidos, e o admin só confere, ajusta e completa a identificação.

- **Prazos já decididos nos planos:** imagem do comprovante por 90 dias; registro do pagamento
  por 5 anos mais o exercício.
- **Os dados de identificação nunca têm padrão:** razão social, CNPJ, endereço, encarregado de
  dados e foro.
- O banco continua recusando publicar com campo em branco. Um valor recomendado é só um
  ponto de partida, não um campo preenchido pela academia.

**Pode ser antecipado** para antes do item 3.7, se o primeiro aluno real estiver perto: não depende da Fase 4.

---

## Fase 6 — Contínuo

| Item | Skill | Quando |
| --- | --- | --- |
| Acessibilidade das telas novas (Pessoas, ficha, chamada, solicitações, menu de aulas, Trocar aula, Revisar troca, Falar com a academia, aviso de atualização, central, recado) | `acessibilidade-projeto` | Depois dos itens 3A.2, 4.9b, 4.10 e 5.1c |
| **Documentação desatualizada:** a seção 10 do `CLAUDE.md` ainda diz "Migração para Cloudinary (em andamento)", com uma branch que já não existe; `docs/ARQUITETURA.md` e `docs/BACKEND.md` não citam o `snake-web` como segundo cliente do esquema | `documentar-projeto` | Junto da Fase 0 ou 1 |
| `docs/MANUAL-DO-ADMINISTRADOR.md`, `docs/FUNCIONALIDADES.md` e `docs/FREQUENCIA.md` com as modalidades, o menu de aulas, a troca, a extra, o histórico de turma, o contato da academia, a conta nova, a chamada auditável, as solicitações, Pessoas, avisos e recado | `documentar-projeto` | Ao fim de cada bloco da Fase 4 e da Fase 5 |
| README pelo protocolo da seção 9 do `CLAUDE.md` | `documentar-projeto` | Ao fechar cada módulo |
| Performance | — | **Nada planejado.** Não há gargalo medido [#99]. A paginação (item médio do `REVIEW.md`) volta à mesa se a lista de Pessoas crescer a ponto de pesar |

---

## Decisões em aberto (suas)

| Decisão | Recomendação | Onde |
| --- | --- | --- |
| Node 22 no CI | Sim: o 20 saiu de suporte | 0.4 |
| Fixar a versão da CLI do Supabase no CI | Sim, se o job falhar de novo ao rerodar | 0.6 |
| Publicar pelo Actions ou localmente | Localmente, por ora, com a convenção da § 12.3 nos dois caminhos | 3.9, 3A.3 |
| Consentimento do responsável por aluno menor | Definir com o jurídico | 3.8 |
| Prazo de guarda da imagem do comprovante | 90 dias | 3.6 |
| Prazo de guarda da central de avisos | Definir com o jurídico **antes** do 5.1c; entra na Política | 5.1c |
| Central de avisos também na web | Sim, só leitura | 5.1 e web 7.1 |
| Limite de recados por dia | Definido no plano do 5.1d | 5.1d |

**Decididas em 24–25/09** (saíram desta tabela): guarda do atestado e dos anexos de motivo em
**180 dias depois da decisão** (D54); T21 e T30 confirmadas; T10 vetada na média do Painel (D55);
contato da academia por WhatsApp e/ou e-mail (D52); P1–P22 respondidas (D56–D58, T41 confirmada);
**`service_role` girada só quando o app for usado de verdade** (3.1).

## Fora deste roadmap, de propósito

- **App para iPhone:** exigiria conta paga da Apple e um Mac. A web cobre esse aluno.
- **Jira:** adiado em 2026-07-27. A rastreabilidade fica nos Conventional Commits e neste arquivo.
- **Job novo no CI:** "esquece o CI" (2026-09-16).
- **Editar o texto do aviso pelo app:** é o passo seguinte ao 5.1, maior, e só com pedido.
- **Bloquear versão antiga do app:** o aviso de atualização é só informativo (T48, P13).
- **Otimização sem medição.** [#8][#99]

## Dependências com os repositórios irmãos

- **O contrato ([`docs/CONTRATO.md`](docs/CONTRATO.md), v3) é a fronteira.** Os três chats seguem
  os nomes dele; só este chat o edita, com aprovação do usuário e versão nova. Os portões do § 14
  são anotados no Registro de cada ROADMAP dono.
- **O esquema do banco mora aqui e a web lê dele.** Toda migration que mexa em `profiles`
  (inclusive o gatilho novo em `group_id`), `payments`, `classes`, `attendance`,
  `absence_justifications`, `academy_settings` (a web também lê essa tabela), no bucket
  `payment_proofs` ou nas funções `frequencia_mensal`, `documentos_legais_pendentes`,
  `documentos_legais_vigentes` e `aceitar_documentos_legais` precisa ser conferida contra o
  `snake-web` **antes do merge**.
- **A web espera o G3 para desenvolver e o G4 para publicar.** Ela acompanha o app em tudo que o
  aluno faz (D34), inclusive o menu de aulas, a troca com anexos, a extra e o contato, que ela lê
  só por `contato_da_academia`.
- **O servidor** assina o envio e a visualização dos comprovantes e das justificativas,
  consultando `payments` e `absence_justifications` pela RLS. Ele também consome a
  `media_deletion_queue` no Cron Job de limpeza. **O G2 continua pendente:** o módulo `motivos`,
  a variante `{justificationId}`, os limitadores e o worker, e na v3 o `allowed_formats` e a
  exclusão nos três tipos de recurso (§ 13). O lote de dependências do servidor (PR #22) foi
  mesclado em 25/09; o detalhe está no roadmap dele.
- **Versão nova da Política:** o aceite aparece no app **e** na web. A web já trata documento
  pendente, mas precisa ser conferida quando isso acontecer.

## Armadilhas já pagas (não descubra de novo)

- **PowerShell não aceita `<`** para redirecionar a entrada.
- **A conexão direta do Supabase só resolve IPv6** e não sai do contêiner. Use o Session pooler
  ou o SQL Editor do painel.
- **`sbp_…` é o token da CLI**, não a service role key (que é `eyJ…` ou `sb_secret_…`).
- **O `SUPABASE_ACCESS_TOKEN` global do Windows é da conta do radar-tributario**, que não
  enxerga o projeto do Snake Thai. Qualquer comando `--linked` falha com 403 ("does not have the
  necessary privileges"). Antes do `db-push-prod.bat` ou de um `functions deploy`, sobrescreva o
  token **só naquela janela** com um da conta do Snake Thai:
  `$env:SUPABASE_ACCESS_TOKEN = "<token>"`.
- **A sonda anônima enxerga se uma coluna existe, e só isso.** Com a chave pública, coluna que
  existe responde 401/42501 e coluna que não existe responde `42703`. Compare sempre com uma
  coluna de controle (`id`) e uma inventada. Trigger e histórico de migrations só no SQL Editor.
- **`scripts\db-dev start` não sobe as Edge Functions.** Elas sobem à parte, com
  `scripts\db-dev funcoes`.
- **`expo prebuild --clean` apaga o `reactNativeDevServerPort`** do `gradle.properties`.
  Reaplique, senão o APK procura o Metro na porta errada.
- **A pasta `android/` fica desatualizada entre versões.** Rode o prebuild antes de compilar o
  release e **sempre** `npm run versao:verificar` antes de publicar.
- **O `adb reverse` cai** quando o aparelho dorme. Não confunda com defeito do app.

---

## Registro

| Data | O que aconteceu |
| --- | --- |
| 2026-09-24 | Roadmap criado a partir do handoff. Conferido no código: produção atrás da 1.8.0 (duas migrations e `create-student`), primeiro acesso com a flag gravada antes da troca de senha, alteração pendente no gerador de demonstração, CI da `main` verde. |
| 2026-09-24 | **Produção conferida contra o banco real** (somente leitura, chave pública, com controles): `profiles.access_channel` não existe, então a `20260923100000` não foi aplicada. O que foi rodado no SQL Editor em 23/09 foi o `historico_demonstracao.sql` (só dados fictícios). O trigger da `20260922100000` só pode ser conferido no SQL Editor (item 1.1). Achado junto: o `demo_seed_limpar.sql` não remove o histórico de demonstração (item 3.5). |
| 2026-09-24 | Tentativa de aplicar as migrations pela sessão: **nada foi alterado**. O token do ambiente é da conta do radar-tributario (403 no projeto do Snake Thai) e não há senha do banco configurada. O passo fica com você, na sua janela, com o token certo. |
| 2026-09-24 | **Nova direção do produto.** O dono definiu: horário fixo, livre e à vontade; frequência semanal e mensal acima de 100%; Semana Extra; chamada auditável; cancelamento; solicitações; perfis; e admin como professor (D1–D42). Contrato `docs/CONTRATO.md` v1 revisado por 5 lentes adversariais (cerca de 70 achados, 3 bloqueadores) → **v2**. Mockups publicados (24 telas, artifact "Mockups Snake Thai — Horário livre"). A antiga fila foi remapeada: 4.1 e 4.2 → 4.10; 4.3 → 4.6 e 5.1a; 4.4 → 5.1; 4.5 → 5.2. **Aguardando G0.** |
| 2026-09-24 | **Produção alcançou a 1.8.0.** O dono rodou `scripts\db-push-prod.bat`; a sonda anônima confirmou: `profiles.access_channel` passou a responder 401/42501, como a coluna de controle `id`, e uma coluna inexistente responde `42703`, então a `20260923100000` está aplicada. O dono publicou a Edge Function `create-student` ("Deployed Functions on project …: create-student"). Itens 1.2 e 1.3 feitos; o 1.1 (trigger no SQL Editor) e o resto do 1.4 continuam abertos. |
| 2026-09-24 | **PR #38 mesclado** (`feat/dados-de-demonstracao`, merge `384f715`), com o `dc2f5bd` (o script de comprovantes diz em qual banco escreve e recusa a chave errada). Itens 0.1 e 0.2 feitos. **Decisão do dono sobre a `service_role`:** girar só quando o app for usado de verdade, porque hoje os dados são fictícios; fica no marco M1 (item 3.1). |
| 2026-09-24 | **Contrato v3** (D43–D55): menu de escolher aulas, troca de aula avulsa e permanente, aula extra do fixo, contato da academia, aviso de atualização do app, guarda dos anexos em 180 dias e média do Painel sem teto; T21 e T30 confirmadas, T10 vetada na média. Revisado no mesmo dia por 3 lentes adversariais (conta, segurança/LGPD, nomes; 35 achados) antes de chegar aos roadmaps. **Mockups versão 6**, com as linhas G e H novas. **Linhas A–F aprovadas pelo dono.** |
| 2026-09-25 | **Revisão da v3 com as respostas do dono às P1–P22** (continua v3, porque nenhum chat implementou nada dela): D56 (extra em qualquer aula), D57 (troca aprovada com a aula nova cancelada vira abono), D58 (histórico de turma nesta rodada: `student_group_periods`, gatilho `registrar_periodo_de_turma`, backfill pela T52, T53 nas trocas, `excluir_turma` arquiva), T41 confirmada, T50–T53; P23–P25 abertas, valendo se não houver veto até o G0. **Mockups versão 7** (36 telas; "Treino livre — noite" com Extra, "Troca abonada" em Meus pedidos, "Admin — mudar o aluno de turma"). G1 passa a 15 tabelas e G3 a 23 RPCs. |
| 2026-09-25 | **Roadmap atualizado para a v3.** Fase 1 marcada com os fatos de 24/09; `service_role` sem urgência, no M1; **Fase 3A** criada para o APK 1.9.0 com o aviso de atualização, a única exceção ao G0; Fase 4 com o mapa da v3, o bloco 4.9 dividido em 4.9a (Solicitações) e 4.9b (Troca de aula, abre G3), e a 2.0.0 dependendo da 1.9.0. Conferido nesta atualização: o CI da `main` ficou vermelho no merge do PR #38 porque a instalação da CLI do Supabase estourou o limite da API do GitHub (item 0.6), e o `release.yml` já usa Node 22 (o 0.4 fica só com o `ci.yml`). |
| 2026-09-25 | **Servidor, só como informação:** o lote de dependências do `snake-server` (PR #22) foi mesclado em 25/09. O detalhe está no [`snake-server/ROADMAP.md`](../snake-server/ROADMAP.md). O G2 continua pendente. |
| 2026-09-25 | **G0 aberto.** O dono aprovou as linhas G e H dos mockups (versão 8; A–F aprovadas em 24/09) e, com elas, os textos da § 12.3 (3A.1) e o contrato v3 com a revisão de 25/09. P23–P25 valem como escolhidas, sem veto. A versão 8 tirou do menu do fixo o cartão "Suas aulas", que nenhuma coluna do contrato traz. No mesmo dia, o dono decidiu que o 4.1 e o 4.8 do `snake-server` (correções do worker que valem para a produção de hoje) vêm primeiro. |
