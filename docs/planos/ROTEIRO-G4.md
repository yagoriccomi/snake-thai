# Roteiro do G4: da 1.9.0 à Política publicada

Este é o passo a passo para o dono. Ele leva a produção da 1.8.0 até a 2.0.0 e termina com a
Política publicada (G5). Ele junta as decisões da coordenação de 08/10: **D37** (1.9.0 antes),
**D38** (aviso a quem está desatualizado), **D39** (teste do dono antes de liberar), **D40**
(Política aprovada), **D41** (#94 logo antes do `db-push-prod`) e **D42** (90 dias de carência do
anexo antigo).

> ⚠️ **Falta uma resposta sua antes do passo 2.** Com o banco novo, o professor que ainda usa o
> APK 1.8 ou 1.9 deixa de fazer algumas coisas até ter a 2.0.0 (a lista está em "Durante o teste",
> no passo 4). A pergunta está no handoff `snake-thai\handoff\loop\008`. **Este roteiro segue a
> opção recomendada (A):** teste curto e o site novo só depois de liberar a 2.0.0. Se você
> escolher outra, o que muda está marcado com **(P1)**.

## A ordem, de relance

| Ordem | Passo | Quem faz | Quando |
| --- | --- | --- | --- |
| 1 | APK 1.9.0, tag `v1.9.0` e #54 (D37) | você; o #54 por este chat | qualquer dia antes do G4 |
| 2 | #94, `send-push`, `db-push-prod`, `create-staff` | você, com este chat | **dia do G4** |
| 3a | Servidor (#37) | chat do servidor, você confirma | no dia do G4, quando o chat do servidor disser |
| 4 | APK 2.0.0 **só no seu celular** e o teste | você | logo depois do passo 2 |
| 5 | Liberar a 2.0.0 a todos, com o aviso (D38) | você | quando o teste passar |
| 6 | Conferir G1 e G3 em produção; "G4 aberto em dd/mm" | você roda; este chat anota | logo depois do passo 5 |
| 3b | Site: `fase-6` → `main` | chat da web, você confirma | **depois do passo 6** (P1) |
| 7 | G5: Dados dos termos e `legal:publicar` (D40) | você, com este chat | depois da 2.0.0 instalada |

O site novo fica para depois porque ele deixa o aluno pedir troca e aula extra, e cada uma trava
a chamada de quem ainda está no APK antigo. Os passos 3a e 3b mantêm o número do pedido da
coordenação; só o momento é que muda.

## Antes de começar

- **Computador:** o checkout principal (`C:\Users\USER\Desktop\GIT\academy\snake-thai`), com o
  `gh` logado e o celular no cabo ou no ADB por Wi-Fi.
- **Token da CLI do Supabase da conta do Snake Thai.** O token global do Windows é de outra conta
  e dá 403. Em cada janela do PowerShell em que você for publicar algo:
  `$env:SUPABASE_ACCESS_TOKEN = "<token>"`. Gere o token na hora e não o cole em chat.
- **`<PROJECT_REF>`** é o "Reference ID" do projeto, no painel do Supabase, em *Project Settings →
  General*.
- **Nada de build nativo junto com outra coisa pesada.** A máquina tem pouca memória: feche o
  Metro, o Android Studio e os chats que estiverem rodando bateria antes dos passos 1 e 4.

**Se um passo falhar:** pare ali. Não pule para o seguinte, não rode o mesmo comando várias
vezes e não mexa no banco pelo painel. Copie a mensagem de erro (sem senha nem token) e peça a
este chat. Cada passo diz de onde se volta.

---

## Passo 1 — Publicar a 1.9.0 (D37)

A 1.9.0 só traz o aviso de atualização. Não tem banco nem Edge Function nova. A tag `v1.9.0` já
existe **só no seu computador**, no último commit da `release/1.9.0` (`893d1e1`, que é a cabeça do
#54).

O workflow *Release Android* do GitHub está **desligado**. Por isso o push da tag não compila
nada: o APK sai do seu computador, pelo `menu.bat`. Nunca use os dois caminhos para a mesma tag.

**1.1 Pôr o computador na tag.**

```bat
git fetch origin
git switch --detach v1.9.0
npm ci
npm run versao:verificar -- --tag v1.9.0
```

Confira: o `versao:verificar` termina sem erro e não mostra o aviso de banco ou Edge Function.

**1.2 Gerar o APK de produção.** `menu.bat` → `[V]` até aparecer **PROD** → `[P]` (preparar) →
`[5]` (gerar o release).

Confira: o arquivo `release\snake-thai-v1.9.0.apk` existe, com exatamente esse nome, e o menu diz
que a assinatura é a de produção.

**1.3 Instalar no seu celular e abrir.** `menu.bat` → `[9]`. O app abre, entra na sua conta e
funciona como a 1.8.0. Com a 1.9.0 ainda como a mais nova, o aviso **não** aparece. Isso é o
certo.

**1.4 Publicar a tag e o release.**

```bat
git push origin v1.9.0
node scripts\version.js notes v1.9.0 > %TEMP%\notas.md
gh release create v1.9.0 release\snake-thai-v1.9.0.apk --title "Snake Thai 1.9.0" --notes-file %TEMP%\notas.md
```

Confira com `gh release list --limit 3`: a **1.9.0** aparece como **Latest**, e a página do
release tem o arquivo `snake-thai-v1.9.0.apk` com esse nome exato. O aviso de atualização
depende disso.

**1.5 Mesclar o #54.** Peça a este chat. Ele marca o PR como pronto e o mescla **com merge
commit**, nunca squash, para a tag entrar no histórico da `main`. Confira:
`git fetch origin` e depois `git merge-base --is-ancestor v1.9.0 origin/main && echo ok`, que
mostra `ok`.

**1.6 Voltar o computador para a `main`.**

```bat
git switch main
git pull --ff-only
npm ci
```

**1.7 Pedir a quem usa o app hoje** (equipe e contas de teste) que instale a 1.9.0 pelo link do
release. Quanto mais gente estiver na 1.9.0, mais gente vê o aviso da 2.0.0 no próprio app.

**Se falhar:**

- O build falhou ou faltou memória: nada foi publicado. Feche o que estiver aberto e repita o 1.2.
- O release saiu sem ser Latest: `gh release edit v1.9.0 --latest`.
- O release saiu com o arquivo errado: apague só o arquivo na página do release e suba o certo.
  **A tag publicada nunca se move nem é apagada.**
- Achou um defeito na 1.9.0 depois de publicada: ela fica, e a correção vira a 1.9.1.

---

## Passo 2 — Dia do G4: o banco e as funções

Faça tudo no mesmo dia, nesta ordem, numa janela do PowerShell com o token da conta do Snake
Thai. **A `send-push` vem antes do banco**, porque o banco novo cria tipos de notificação que a
`send-push` antiga não conhece, e um tipo desconhecido trava todos os pushes.

**2.1 Mesclar o #94 (C11, D41).** Peça a este chat. Ele confere que o CI do #94 está verde e o
mescla. Depois, no seu computador:

```bat
git switch main
git pull --ff-only
npm ci
```

Confira: `gh run list --branch main --limit 1` mostra o CI da `main` verde.

**2.2 Publicar a `send-push`.**

```bat
npx supabase functions deploy send-push --no-verify-jwt --project-ref <PROJECT_REF>
```

Confira no painel do Supabase, em *Edge Functions → send-push*, que a data do último deploy é a
de hoje. Nos logs dela, nos minutos seguintes, não pode aparecer erro novo.

**2.3 Aplicar as migrations.**

```bat
scripts\db-push-prod.bat
```

O script faz o backup (em `%USERPROFILE%\snake-thai-backups`), mostra a simulação e pede duas
confirmações. Confira:

- a simulação lista **24 migrations**, da `20260925200000_v3_valores_de_enum` à
  `20261007120000_c11_anexo_justificativa`;
- o script termina sem erro e lista as migrations de produção, com a `20261007120000` por último.

**2.4 Publicar a `create-staff`.**

```bat
npx supabase functions deploy create-staff --project-ref <PROJECT_REF>
```

Ela passa a aceitar admin com cor (o admin que dá aula). Confira a data do deploy no painel.

**Se falhar:**

- **2.1:** o CI do #94 ficou vermelho, ou o merge deu conflito. Pare: não rode o 2.2. Este chat
  corrige o #94.
- **2.2:** a função não publicou. A produção continua com a função antiga e o banco antigo, e nada
  quebrou. Corrija o token ou o `<PROJECT_REF>` e repita o 2.2. **Não rode o 2.3 sem o 2.2.**
- **2.3:** o script parou com erro. O Supabase aplica cada migration inteira ou nada dela. Copie a
  mensagem e peça a este chat. **Não aplique nada pelo painel.** O backup do script é o caminho de
  volta se algo grave tiver acontecido, e a restauração se decide junto com este chat.
- **2.4:** a função não publicou. Só o cadastro de equipe fica com a regra antiga de cor. Repita
  o 2.4.

---

## Passo 3a — O servidor (#37)

O chat do servidor publica o #37 (a segunda barreira do `view-url`, § 13.5). Ele diz se o #37 vai
antes ou depois do passo 2: pela § 14, o servidor vai antes, porque aceita o banco antigo. Você
só confirma quando ele pedir.

Confira: o chat do servidor anota no Registro dele que o #37 está em produção, e o `/health`
responde ok.

**Se falhar:** o chat do servidor reverte o #37 na Render. O app e o banco não dependem dele para
funcionar.

---

## Passo 4 — APK 2.0.0 só no seu celular, e o teste (D39)

> **Antes de gerar a 2.0.0, falta o #92 (Expo, D26).** A D26 pede o Expo novo antes da 2.0.0, e o
> #92 só entra depois de um APK de ensaio testado por você, que ficou adiado. A pergunta P3 do
> handoff `008` propõe usar este próprio teste como ensaio, para gerar um APK nativo só. Sem essa
> resposta, a 2.0.0 sai sem o #92.

**4.1 Gerar a versão e a tag, sem publicar.** No seu computador, na `main` atualizada:

```bat
npm run versao:major -- --dry-run
npm run versao:major
npm run versao:tag
```

Confira: a simulação sugere **2.0.0**, e o CHANGELOG está em linguagem de quem usa o app (é o que
as pessoas leem). **Ainda não faça push da `main` nem da tag.**

**4.2 Gerar o APK.** `menu.bat` → `[V]` **PROD** → `[P]` → `[5]`. Confira: existe
`release\snake-thai-v2.0.0.apk`, e o menu diz que a assinatura é a de produção.

**4.3 Instalar só no seu celular.** `menu.bat` → `[9]`. Não mande o arquivo a ninguém.

**4.4 Testar.** Use as contas de teste de cada papel (admin, professor e aluno) no seu celular. O
passo a passo de cada parte está nos `docs/planos/ENTREGA-4.x-*.md`, na seção "Roteiro no
aparelho".

| Parte | O que conferir | Detalhe em |
| --- | --- | --- |
| Entrar e termos | Entra nas três contas; o aceite de termos aparece só se houver documento pendente | — |
| Admin e professor | Admin com cor aparece na grade como professor; cadastro de equipe funciona | `ENTREGA-4.2` |
| Planos, grade e contato | Planos com cota; grade da turma; "Falar com a academia" abre o WhatsApp ou o e-mail | `ENTREGA-4.3` |
| Aulas do aluno | Menu de aulas; "Vou" e "Não vou"; aula extra; aula "só livres" | `ENTREGA-4.4` |
| Frequência | Semana, mês e meta semanal batem com o que você marcou | `ENTREGA-4.5` |
| Chamada | Fazer, concluir e **retificar** uma chamada com motivo; "Chamadas pendentes" | `ENTREGA-4.6` |
| Cancelar aula | Cancelar e reativar, vendo quem será avisado | `ENTREGA-4.7` |
| Justificativas | Enviar com anexo (C11), reenviar, aprovar e negar com nota; "Ver anexo" | `ENTREGA-4.8` |
| Solicitações | "Eu estava na aula", "Pedir ao admin", decidir com nota | `ENTREGA-4.9a` |
| Trocas | Trocar só nesta semana e permanente; desistir; revisar | `ENTREGA-4.9b` |
| Pessoas e fichas | Abas, busca, filtros, ficha do aluno e do professor | `ENTREGA-4.10` |
| Dados dos termos | A tela existe em *Dados*, e "Ver Política" mostra o texto novo com os campos a preencher | `docs/legal/README.md` |
| Notificações | Se o push estiver ativo em produção (item 3.4), chegam os avisos de cancelamento, justificativa e troca | `docs/NOTIFICACOES.md` |

**Lembre:** é o sistema real. Cancelar aula, decidir pedido ou retificar chamada **avisa** as
contas envolvidas por push. Use aulas e contas de teste. **Não cancele aula de verdade durante o
teste:** quem está no APK 1.8 ou 1.9 continua vendo a aula cancelada como normal e pode ir à
academia à toa.

**Durante o teste, quem ainda está no APK 1.8 ou 1.9** (sobretudo o professor) recebe "Atualize o
aplicativo" ao:

- decidir uma justificativa (e não vê as já decididas);
- retificar uma chamada já concluída;
- fazer a chamada de aula com troca, aula extra, aula cancelada, aula "só livres" ou aula passada
  de aluno que o admin mudou de turma depois dela.

E três coisas falham **sem mensagem nenhuma** no APK antigo (P2 do handoff `008`):

- **"Entrar nesta aula" ou "Sair da aula" depois que a aula começou.** O botão não faz nada, e o
  professor que não entrou na aula também não consegue fazer a chamada dela. Peça à equipe que
  entre na aula **antes do horário**.
- **Professor criando aula com data passada.** A aula é gravada sem professor. Peça à equipe que
  não crie aula para trás até ter a 2.0.0; se acontecer, o admin exclui a aula que ficou sem
  professor.
- **Admin mudando tipo, data ou turma de uma aula que já tem chamada.** O banco recusa, como deve.

O aluno no APK antigo continua marcando "Vou" e "Não vou" e enviando justificativa com anexo; só
falha em aula trocada, cancelada ou de plano livre. O que chega por push de tipo novo (aula
cancelada, troca, justificativa decidida) aparece, mas tocar nele só abre o app.

Nada se perde: o banco recusa a operação inteira, e a chamada fica pendente até a pessoa ter a
2.0.0. **(P1)** Por isso o teste deve ser curto, de preferência no mesmo dia ou no seguinte, com a
equipe avisada antes do passo 2.

**Se o teste achar um defeito:** não publique a 2.0.0. Este chat corrige num PR, e a versão
publicada passa a ser a **2.0.1** (`npm run versao:patch` → `npm run versao:tag`). A tag
`v2.0.0`, que nunca saiu do seu computador, fica sem uso, e o passo 4 recomeça do 4.2. O banco
não volta: a 1.8 e a 1.9 continuam funcionando com as limitações acima.

---

## Passo 5 — Liberar a 2.0.0 a todos, com o aviso (D38)

```bat
git push origin main
git push origin v2.0.0
node scripts\version.js notes v2.0.0 > %TEMP%\notas.md
gh release create v2.0.0 release\snake-thai-v2.0.0.apk --title "Snake Thai 2.0.0" --notes-file %TEMP%\notas.md
```

Se a `main` estiver protegida contra push direto, este chat abre o PR do `chore(release): v2.0.0`
e o mescla com merge commit antes do push da tag.

Confira:

- `gh release list --limit 3` mostra a **2.0.0** como **Latest**, com o arquivo
  `snake-thai-v2.0.0.apk`;
- num celular com a **1.9.0**, ao abrir o app, aparece o aviso de atualização, e o link baixa a
  2.0.0. Essa é a prova final do 3A.4;
- **o aviso por push (D38) ainda não existe.** Até ele existir, avise quem ficou na 1.8.0 por
  mensagem: a 1.8.0 não tem o aviso ao abrir. A proposta está no handoff `008`.

**Se falhar:** release sem ser Latest: `gh release edit v2.0.0 --latest`. Arquivo errado: troque só
o arquivo. A tag publicada não se move.

---

## Passo 6 — Conferir o G1 e o G3 em produção, e abrir o G4

No **SQL Editor de produção** do Supabase, rode as consultas da § 14 do contrato:

```sql
-- G1: as 15 tabelas novas (esperado: 15)
select count(*) from pg_class where relname in ('plan_periods','inactive_periods','weekly_goals','action_reasons','action_reason_attachments','roll_call_requests','attendance_audit','class_teacher_presence','class_audit','absence_justification_reviews','absence_justification_attempts','class_swaps','class_swap_reviews','class_swap_periods','student_group_periods');

-- G1: os valores novos dos enums (esperado: 3)
select count(*) from pg_enum where enumlabel in ('anexo_de_motivo_removido','class_swap_evidence','troca_pendente');

-- G1: a coluna do contato e a função das políticas (esperado: 1 e 1)
select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'academy_settings' and column_name = 'contact_whatsapp';
select count(*) from pg_proc where proname = 'pode_ler_motivo';

-- G1: o gatilho da turma (esperado: 1) e o backfill (esperado: 0)
select count(*) from pg_trigger where tgname = 'registrar_periodo_de_turma' and tgrelid = 'public.profiles'::regclass;
select count(*) from public.profiles p where p.group_id is not null and not exists (select 1 from public.student_group_periods g where g.user_id = p.id and g.ended_at is null and g.group_id = p.group_id);

-- G3: as 23 funções do aluno (esperado: 23)
select count(distinct proname) from pg_proc where proname in ('aulas_do_aluno','declarar_aula','frequencia_semanal','frequencia_do_mes','semanas_do_mes','historico_de_aulas_do_aluno','enviar_justificativa','reenviar_justificativa','anexar_a_justificativa','minhas_justificativas','definir_meta_semanal','meta_da_semana','criar_motivo','pode_anexar_ao_motivo','anexar_ao_motivo','abrir_solicitacao','minhas_solicitacoes','menu_de_aulas','pedir_troca_de_aula','desistir_da_troca','minhas_trocas','minhas_trocas_permanentes','contato_da_academia');
```

Se todos os números baterem, diga a este chat a data. Ele anota no Registro do `ROADMAP-thai.md`
**"G4 aberto em dd/mm"**, que é onde o chat da web olha. Se algum número não bater, não anote:
mande o resultado para este chat.

## Passo 3b — O site (`fase-6` → `main`)

Depois do "G4 aberto", o chat da web leva a `fase-6` para a `main`, o que publica o site. Você só
confirma quando ele pedir. Confira: o site de produção abre o menu de aulas novo.

**(P1)** Se você escolheu publicar o site antes do teste, este passo vem logo depois do passo 2,
e o professor no APK antigo terá mais chamadas travadas durante o teste.

**Se falhar:** o chat da web reverte o merge na `main`. O banco não muda.

---

## Passo 7 — G5: publicar a Política (D40)

O texto da Política está aprovado (D40). Falta preencher os dados da academia, que só existem na
tela da 2.0.0.

**7.1 Prazo dos comprovantes (D14, 90 dias).** No SQL Editor de produção:

```sql
update public.academy_settings set proof_retention_days = 90;
```

**7.2 Preencher os Dados dos termos.** No app 2.0.0, como admin: *Dados → Dados dos termos e da
política*. Preencha os 15 campos (o prazo dos comprovantes é 90 dias) e use "Ver Política de
Privacidade" para ler o texto final. Nada pode ficar entre chaves duplas.

**7.3 Gerar a migration de publicação.** Peça a este chat. Ele roda
`npm run legal:publicar -- politica 1.0`, o `scripts\db-dev test` e abre o PR. Com o CI verde, o
PR é mesclado.

**7.4 Publicar em produção.** No seu computador, na `main` atualizada:

```bat
scripts\db-push-prod.bat
```

Confira no SQL Editor:

```sql
select version from public.legal_documents where kind = 'privacy_policy' and is_current;
```

O resultado é **1.0**. Na próxima vez que cada pessoa abrir o app ou o site, ela aceita a
Política nova. Diga a data a este chat, que anota **"G5 aberto em dd/mm"**.

**Se falhar:** se faltar algum campo, a publicação recusa e nada é gravado: volte ao 7.2. A
Política publicada não muda. Para corrigir, publica-se a 1.1, e todos aceitam de novo.

---

## Depois do G4: a data da D42

O jeito antigo de anexar a justificativa (o APK 1.8/1.9 grava o anexo direto) fica ligado por
**90 dias depois da publicação da 2.0.0** e então é desligado (D42 da coordenação). A data-alvo é
**a definir** até a 2.0.0 sair. No passo 5, este chat anota no ROADMAP a data da publicação e a
data-alvo (publicação + 90 dias).
