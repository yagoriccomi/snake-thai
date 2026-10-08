# Roteiro do G4: da 1.9.0 à Política publicada

Este é o passo a passo para o dono. Ele leva a produção da 1.8.0 até a 2.0.0, com a Política
publicada (G5) no mesmo dia. Ele junta as decisões da coordenação de 08/10:

- **D37:** a 1.9.0 sai antes;
- **D38:** quem está desatualizado é avisado;
- **D39:** o dono testa antes de liberar;
- **D40:** a Política está aprovada;
- **D41:** o #94 entra logo antes do `db-push-prod`;
- **D42 revista:** o jeito antigo de anexar é desligado no `db-push-prod`, sem os 90 dias;
- **D43:** a equipe recebe a 2.0.0 junto com o dono;
- **D44:** sem aviso à equipe sobre os três casos do APK antigo;
- **D45:** o push de versão nova;
- **D46:** o G5 entra durante o teste;
- **D47:** o #92 vai na 2.0.0;
- **D48:** a chave do servidor já está ligada.

> ⚠️ **Falta uma aprovação sua antes do passo 2: o texto do push de versão nova (D45).** O texto
> proposto está no #96 e no handoff `snake-thai\handoff\loop\009`:
>
> - título: "Nova versão do app: 2.0.0";
> - corpo: "Abra o app para baixar ou peça o link na academia. Se já atualizou, ignore este aviso.".
>
> Se você mudar o texto, este chat ajusta o #96 antes do dia do G4.

## A ordem, de relance

| Ordem | Passo | Quem faz | Quando |
| --- | --- | --- | --- |
| 1 | APK 1.9.0, tag `v1.9.0` e #54 (D37) | você; o #54 por este chat | qualquer dia antes do G4 |
| 2 | #94 e #96, `send-push`, `db-push-prod`, `create-staff` | você, com este chat | **dia do G4** |
| 3a | Servidor (#37 e a aposentadoria da rota antiga de anexo) | chat do servidor; você confirma | no dia do G4, quando o chat do servidor disser |
| 3b | Site: `fase-6` → `main` | chat da web; você confirma | logo depois do passo 3a |
| 4 | APK 2.0.0 no seu celular **e no da equipe**, e o teste (D39, D43) | você | logo depois do passo 3b |
| 4b | G5: Dados dos termos e `legal:publicar` (D46) | você, com este chat | **durante o teste**, antes do passo 5 |
| 5 | Liberar a 2.0.0 aos alunos e avisar por push (D38, D45) | você | quando o teste passar |
| 6 | Conferir G1 e G3 em produção; anotar "G4 aberto em dd/mm" | você roda; este chat anota | logo depois do passo 5 |

**Por que o site sobe antes do teste:** é a ordem da D39. O motivo para deixar o site para depois
eram as chamadas que o professor no APK antigo deixaria travadas. Com a D43, a equipe já está na
2.0.0 e esse motivo some. O aluno no APK antigo continua usando o app, como diz o passo 4.

## Antes de começar

- **Computador:** o checkout principal (`C:\Users\USER\Desktop\GIT\academy\snake-thai`), com o
  `gh` logado e o celular no cabo ou no ADB por Wi-Fi.
- **Token da CLI do Supabase da conta do Snake Thai.** O token global do Windows é de outra conta
  e dá 403. Em cada janela do PowerShell em que você for publicar algo, rode
  `$env:SUPABASE_ACCESS_TOKEN = "<token>"`. Gere o token na hora e não o cole em chat.
- **`<PROJECT_REF>`** é o "Reference ID" do projeto. Ele fica no painel do Supabase, em *Project
  Settings → General*.
- **Nada de build nativo junto com outra coisa pesada.** A máquina tem pouca memória: antes dos
  passos 1 e 4, feche o Metro, o Android Studio e os chats que estiverem rodando bateria.

**Se um passo falhar:** pare ali.

- Não pule para o passo seguinte.
- Não rode o mesmo comando várias vezes.
- Não mexa no banco pelo painel.

Copie a mensagem de erro, sem senha nem token, e peça ajuda a este chat. Cada passo diz como
voltar atrás.

---

## Passo 1 — Publicar a 1.9.0 (D37)

A 1.9.0 só traz o aviso de atualização. Não tem banco nem Edge Function nova. A tag `v1.9.0` já
existe **só no seu computador**. Ela está no último commit da `release/1.9.0` (`893d1e1`), que é a
cabeça do #54.

O workflow *Release Android* do GitHub está **desligado**. Por isso o push da tag não compila
nada, e o APK sai do seu computador, pelo `menu.bat`. Nunca use os dois caminhos para a mesma tag.

**1.1 Pôr o computador na tag.**

```bat
git fetch origin
git switch --detach v1.9.0
npm ci
npm run versao:verificar -- --tag v1.9.0
```

Confira: o `versao:verificar` termina sem erro e não mostra o aviso de banco ou de Edge Function.

**1.2 Gerar o APK de produção.** No `menu.bat`, aperte `[V]` até aparecer **PROD**, depois `[P]`
(preparar) e `[5]` (gerar o release).

Confira: o arquivo `release\snake-thai-v1.9.0.apk` existe, com exatamente esse nome, e o menu diz
que a assinatura é a de produção.

**1.3 Instalar no seu celular e abrir.** No `menu.bat`, aperte `[9]`. O app abre, entra na sua
conta e funciona como a 1.8.0. Enquanto a 1.9.0 for a versão mais nova, o aviso **não** aparece.
É o esperado.

**1.4 Publicar a tag e o release.**

```bat
git push origin v1.9.0
node scripts\version.js notes v1.9.0 > %TEMP%\notas.md
gh release create v1.9.0 release\snake-thai-v1.9.0.apk --title "Snake Thai 1.9.0" --notes-file %TEMP%\notas.md
```

Confira com `gh release list --limit 3`:

- a **1.9.0** aparece como **Latest**;
- a página do release tem o arquivo `snake-thai-v1.9.0.apk`, com esse nome exato. O aviso de
  atualização depende disso.

**1.5 Mesclar o #54.** Peça a este chat. Ele marca o PR como pronto e o mescla **com merge
commit**, nunca com squash, para a tag entrar no histórico da `main`. Para conferir, rode
`git fetch origin` e depois `git merge-base --is-ancestor v1.9.0 origin/main && echo ok`. O
resultado deve ser `ok`.

**1.6 Voltar o computador para a `main`.**

```bat
git switch main
git pull --ff-only
npm ci
```

**1.7 Pedir a quem usa o app hoje** (equipe e contas de teste) que instale a 1.9.0 pelo link do
release. Quanto mais gente estiver na 1.9.0, mais gente vê o aviso da 2.0.0 no próprio app.

**Se falhar:**

- **O build falhou ou faltou memória:** nada foi publicado. Feche o que estiver aberto e repita o
  1.2.
- **O release saiu sem ser Latest:** rode `gh release edit v1.9.0 --latest`.
- **O release saiu com o arquivo errado:** apague só o arquivo na página do release e suba o
  certo. **A tag publicada nunca se move nem é apagada.**
- **Apareceu um defeito na 1.9.0 depois de publicada:** ela fica como está, e a correção vira a
  1.9.1.

---

## Passo 2 — Dia do G4: o banco e as funções

Faça tudo no mesmo dia, nesta ordem, numa janela do PowerShell com o token da conta do Snake
Thai. **A `send-push` vem antes do banco.** O banco novo cria tipos de notificação, e a
`send-push` antiga não os conhece:

- os tipos de troca travariam todos os pushes;
- o `versao_nova` sairia com um texto genérico.

**2.1 Mesclar o #94 (C11, D41) e o #96 (D45).** Peça a este chat. Ele confere que o CI dos dois
está verde e os mescla, nesta ordem. Depois, no seu computador:

```bat
git switch main
git pull --ff-only
npm ci
```

Confira: `gh run list --branch main --limit 1` mostra o CI da `main` verde.

**2.2 Publicar a `send-push`** a partir da `main` atualizada, que já tem o texto do `versao_nova`.

```bat
npx supabase functions deploy send-push --no-verify-jwt --project-ref <PROJECT_REF>
```

Confira no painel do Supabase, em *Edge Functions → send-push*, que o último deploy tem a data de
hoje. Nos minutos seguintes, os logs dela não podem mostrar erro novo.

**2.3 Aplicar as migrations.**

```bat
scripts\db-push-prod.bat
```

O script faz o backup (em `%USERPROFILE%\snake-thai-backups`), mostra a simulação e pede duas
confirmações. Confira:

- a simulação lista **26 migrations**, da `20260925200000_v3_valores_de_enum` à
  `20261008120100_d45_avisar_versao_nova`;
- o script termina sem erro e lista as migrations de produção, com a `20261008120100` por último.

**Neste passo, o jeito antigo de anexar justificativa é desligado** (D42 revista). O APK 1.8/1.9
e o site antigo continuam mandando justificativa só com texto. Mandar com anexo passa a falhar. O
anexo antigo que já está gravado não muda.

**2.4 Publicar a `create-staff`.**

```bat
npx supabase functions deploy create-staff --project-ref <PROJECT_REF>
```

Ela passa a aceitar admin com cor (o admin que dá aula). Confira a data do deploy no painel.

**Se falhar:**

- **2.1:** o CI de um dos dois ficou vermelho, ou o merge deu conflito. Pare e não rode o 2.2.
  Este chat corrige o PR.
- **2.2:** a função não publicou. A produção continua com a função antiga e o banco antigo, e
  nada quebrou. Corrija o token ou o `<PROJECT_REF>` e repita o 2.2. **Não rode o 2.3 sem o
  2.2.**
- **2.3:** o script parou com erro. O Supabase aplica cada migration inteira ou nada dela. Copie a
  mensagem e peça ajuda a este chat. **Não aplique nada pelo painel.** O backup do script é o
  caminho de volta se algo grave acontecer, e a restauração se decide junto com este chat.
- **2.4:** a função não publicou. Só o cadastro de equipe fica com a regra antiga de cor. Repita
  o 2.4.

---

## Passo 3a — O servidor

O chat do servidor publica duas coisas:

- o #37, a segunda barreira do `view-url` (§ 13.5);
- a aposentadoria da rota antiga de anexo (`sign-upload {classId}`, D42 revista).

**A chave `MIGRATIONS_DO_G4_EM_PRODUCAO` já está ligada (D48).** Até o passo 2.3, abrir o anexo de
uma justificativa dá erro, como foi aceito. Depois do 2.3, abre normalmente.

Pela § 14, o servidor iria antes do passo 2, porque aceita o banco antigo. O chat do servidor diz a
ordem certa. Você só confirma quando ele pedir.

Confira:

- o chat do servidor anota no Registro dele o que está em produção;
- o `/health` responde ok;
- abrir o anexo de uma justificativa de teste funciona.

**Se falhar:** o chat do servidor reverte na Render. O app e o banco não dependem dele para
funcionar.

## Passo 3b — O site (`fase-6` → `main`)

O chat da web leva a `fase-6` para a `main`, e isso publica o site. Você só confirma quando ele
pedir. Confira: o site de produção abre o menu de aulas novo.

**Se falhar:** o chat da web reverte o merge na `main`. O banco não muda.

---

## Passo 4 — APK 2.0.0 para você e para a equipe, e o teste (D39, D43)

A 2.0.0 já sai com o Expo 57 (#92, D47), que está na `main` desde 08/10. Este build serve ao mesmo
tempo de ensaio do Expo novo e de teste da 2.0.0.

**4.1 Gerar a versão e a tag, sem publicar.** No seu computador, na `main` atualizada, rode:

```bat
npm run versao:major -- --dry-run
npm run versao:major
npm run versao:tag
```

Confira:

- a simulação sugere **2.0.0**;
- o CHANGELOG está em linguagem de quem usa o app, porque é o que as pessoas leem.

**Ainda não faça push da `main` nem da tag.**

**4.2 Gerar o APK.** No `menu.bat`, aperte `[V]` até aparecer **PROD**, depois `[P]` e `[5]`.
Confira: o arquivo `release\snake-thai-v2.0.0.apk` existe, e o menu diz que a assinatura é a de
produção.

**4.3 Instalar no seu celular e no da equipe (D43).** No seu, use o `menu.bat` e aperte `[9]`.
Mande o arquivo direto aos professores e aos admins, por mensagem e **fora do GitHub**. O release
só sai no passo 5. **Os alunos ainda não recebem a 2.0.0.**

**4.4 Testar.** No seu celular, use as contas de teste de cada papel: admin, professor e aluno. O
passo a passo de cada parte está nos arquivos `docs/planos/ENTREGA-4.x-*.md`, na seção "Roteiro
no aparelho".

| Parte | O que conferir | Detalhe em |
| --- | --- | --- |
| Entrar e termos | Entra nas três contas; o aceite de termos aparece só se houver documento pendente | — |
| Admin e professor | O admin com cor aparece na grade como professor; o cadastro de equipe funciona | `ENTREGA-4.2` |
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

**Lembre:** o teste roda no sistema real. Cancelar aula, decidir pedido ou retificar chamada
**avisa** por push as contas envolvidas. Use aulas e contas de teste. **Não cancele aula de verdade
durante o teste.** Quem está no APK 1.8 ou 1.9 continua vendo a aula cancelada como normal e pode
ir à academia à toa.

**Durante o teste, o aluno no APK 1.8 ou 1.9:**

- continua marcando "Vou" e "Não vou";
- só falha em aula trocada, cancelada ou de plano livre;
- manda justificativa **só com texto**. Com anexo, o envio falha com a mensagem genérica (D42
  revista);
- vê o push de tipo novo (aula cancelada, troca, justificativa decidida), mas tocar nele só abre o
  app.

A equipe já está na 2.0.0 (D43). Quem da equipe ficar no APK antigo recebe "Atualize o
aplicativo" nas ações novas. Nada se perde: o banco recusa a operação inteira.

**Se o teste achar um defeito:** não publique a 2.0.0. Este chat corrige num PR, e a versão
publicada passa a ser a **2.0.1** (`npm run versao:patch` e depois `npm run versao:tag`). A tag
`v2.0.0`, que nunca saiu do seu computador, fica sem uso, e o passo 4 recomeça do 4.2. Mande a
2.0.1 à equipe do mesmo jeito. O banco não volta atrás: a 1.8 e a 1.9 continuam funcionando com as
limitações acima.

## Passo 4b — G5 no mesmo dia, durante o teste (D46)

A Política vai ao ar **antes** de os alunos receberem a 2.0.0. Assim, o anexo de atestado entra
coberto pela Política. O texto da Política está aprovado (D40). Faltam os dados da academia, que
só a tela da 2.0.0 tem.

**Faça o 4b logo que a 2.0.0 estiver no seu celular.** O site novo já aceita atestado desde o
passo 3b, e a coordenação aceitou essas horas sem trava (D46). Quanto mais cedo a Política sair,
menor fica esse intervalo.

**4b.1 Prazo dos comprovantes (D14, 90 dias).** No SQL Editor de produção, rode:

```sql
update public.academy_settings set proof_retention_days = 90;
```

**4b.2 Preencher os Dados dos termos.** No app 2.0.0, como admin, abra *Dados → Dados dos termos e
da política*. Preencha os 15 campos (o prazo dos comprovantes é 90 dias) e use "Ver Política de
Privacidade" para ler o texto final. Nada pode ficar entre chaves duplas.

**4b.3 Gerar a migration de publicação.** Peça a este chat. Ele roda
`npm run legal:publicar -- politica 1.0` e o `scripts\db-dev test`, e abre o PR. Com o CI verde, o
PR é mesclado.

**4b.4 Publicar em produção.** No seu computador, na `main` atualizada, rode:

```bat
scripts\db-push-prod.bat
```

Confira no SQL Editor:

```sql
select version from public.legal_documents where kind = 'privacy_policy' and is_current;
```

O resultado deve ser **1.0**.

**Quem vê a Política nova:** cada pessoa a vê na próxima vez que abrir o app ou o site, e só entra
depois de aceitar. **O APK 1.8 e o 1.9 também mostram a tela "Termos atualizados"**. Ela é a
mesma nas duas versões, e o banco já monta o texto preenchido. A pergunta vem quando o app é
aberto do zero. Quem só volta ao app que estava aberto em segundo plano vê a tela na próxima
abertura.

**Se falhar:** se faltar algum campo, a publicação é recusada e nada é gravado. Volte ao 4b.2. A
Política publicada não muda: para corrigir, publica-se a versão 1.1, e todos aceitam de novo.

---

## Passo 5 — Liberar a 2.0.0 aos alunos, com o aviso (D38, D45)

**5.1 Publicar o release.**

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
  2.0.0. Essa é a prova final do 3A.4.

**5.2 Avisar por push (D45).** Só depois do 5.1, para o link do aviso já apontar a 2.0.0. No **SQL
Editor de produção**, rode:

```sql
select public.avisar_versao_nova('2.0.0');
```

O número que aparece é quantas pessoas entraram na fila do aviso: todas as ativas com o app
instalado e o push ligado, inclusive a equipe que já atualizou. Fora do horário de silêncio
(22h às 7h), o aviso sai em até 1 minuto. Dentro dele, sai às 7h. Rodar de novo devolve 0 e não
repete o aviso.

**O push só chega com a chave FCM de produção (item 3.4).** Sem ela, o aviso fica na fila e não
chega. Nesse caso, avise por mensagem quem está na 1.8.0, porque a 1.8.0 não mostra o aviso ao
abrir. Quem está na 1.9.0 vê o aviso ao abrir o app de qualquer jeito.

**Se falhar:**

- **Release sem ser Latest:** rode `gh release edit v2.0.0 --latest`.
- **Arquivo errado:** troque só o arquivo. A tag publicada não se move.
- **O `avisar_versao_nova` deu erro:** confira se a versão está escrita como `2.0.0`, sem "v".

---

## Passo 6 — Conferir o G1 e o G3 em produção, e abrir o G4

No **SQL Editor de produção** do Supabase, rode as consultas da § 14 do contrato:

```sql
-- G1: as 15 tabelas novas (esperado: 15)
select count(*) from pg_class where relname in ('plan_periods','inactive_periods','weekly_goals','action_reasons','action_reason_attachments','roll_call_requests','attendance_audit','class_teacher_presence','class_audit','absence_justification_reviews','absence_justification_attempts','class_swaps','class_swap_reviews','class_swap_periods','student_group_periods');

-- G1: os valores novos dos enums (esperado: 4)
select count(*) from pg_enum where enumlabel in ('anexo_de_motivo_removido','class_swap_evidence','troca_pendente','versao_nova');

-- G1: a coluna do contato e a função das políticas (esperado: 1 e 1)
select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'academy_settings' and column_name = 'contact_whatsapp';
select count(*) from pg_proc where proname = 'pode_ler_motivo';

-- G1: o gatilho da turma (esperado: 1) e o backfill (esperado: 0)
select count(*) from pg_trigger where tgname = 'registrar_periodo_de_turma' and tgrelid = 'public.profiles'::regclass;
select count(*) from public.profiles p where p.group_id is not null and not exists (select 1 from public.student_group_periods g where g.user_id = p.id and g.ended_at is null and g.group_id = p.group_id);

-- G3: as 23 funções do aluno (esperado: 23)
select count(distinct proname) from pg_proc where proname in ('aulas_do_aluno','declarar_aula','frequencia_semanal','frequencia_do_mes','semanas_do_mes','historico_de_aulas_do_aluno','enviar_justificativa','reenviar_justificativa','anexar_a_justificativa','minhas_justificativas','definir_meta_semanal','meta_da_semana','criar_motivo','pode_anexar_ao_motivo','anexar_ao_motivo','abrir_solicitacao','minhas_solicitacoes','menu_de_aulas','pedir_troca_de_aula','desistir_da_troca','minhas_trocas','minhas_trocas_permanentes','contato_da_academia');
```

Se todos os números baterem, diga a data a este chat. Ele anota no Registro do `ROADMAP-thai.md`
**"G4 aberto em dd/mm"** e **"G5 aberto em dd/mm"**. Se algum número não bater, não anote nada e
mande o resultado para este chat.
