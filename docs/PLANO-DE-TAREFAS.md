# Plano de Tarefas — checklist de 2026-09-16

> **Para que serve:** registrar tudo que foi pedido em 2026-09-16, na ordem certa de
> execução, para nada se perder entre sessões. Cada tarefa tem um plano detalhado em
> [`docs/planos/`](planos/), com a situação verificada no código, os passos, os riscos
> e os ajustes de um revisor que cruzou as 11 tarefas.
>
> **Como usar:** marque `[x]` quando um item terminar e anote no
> [Registro de execução](#registro-de-execução). Itens com ⚠️ têm efeito em produção
> ou são irreversíveis e **sempre** pedem confirmação antes. Itens com 👤 só você pode
> fazer (contas, senhas, decisões de negócio).

Legenda de estado: ⬜ não iniciada · 🟨 em andamento · ✅ concluída · ⛔ bloqueada por ação sua

---

## Suas perguntas

**"GitHub Actions é gratuito?"** — **Sim, no seu caso.** O `snake-thai` e o `snake-server`
são públicos, e repositório público não paga minutos nos runners padrão do GitHub
(fonte: docs.github.com, *Billing for GitHub Actions*, consultado em 2026-09-16). Se um
dia virarem privados, a conta Free tem 2.000 minutos por mês.

**"Consegue configurar pra mim?"** — Sim: é a tarefa **T5** (build e publicação
automática do APK a cada versão). Ela depende da chave de assinatura de produção (T2),
que só você pode gerar.

**"Esquece o CI"** — entendido como: **nenhum job ou passo novo** no `ci.yml`. A única
edição prevista é trocar a porta do banco local (T1), para o job que já existe não
quebrar. Testes novos colocados nas pastas de sempre continuam rodando nele.

---

## Ordem de execução

| # | Tarefa | Estado | Depende de | Plano |
|---|---|---|---|---|
| 1 | **T4 · fase 1** — merges do `snake-thai` (sem efeito em produção) | ✅ | — | [PLANO-T4](planos/PLANO-T4.md) |
| 2 | **T1** — separar dev de produção (app DEV + banco local em Docker) | 🟡 #12 mesclado; #16 aguarda você | T4·1 | [PLANO-T1](planos/PLANO-T1.md) |
| 3 | **T4 · fase 2** — merges do `snake-server` (⚠️ gera deploy) | ✅ | confirmação do Auto-Deploy | [PLANO-T4](planos/PLANO-T4.md) |
| 4 | **T3** — padronizar número de versão | ✅ PR #13 | T4·1 | [PLANO-T3](planos/PLANO-T3.md) |
| 5 | **T2** — tirar a chave de debug do release e assinar com a de produção | 🟡 PR #14 mesclado; 👤 keystore | T3, 👤 keystore | [PLANO-T2](planos/PLANO-T2.md) |
| 6 | **T5** — GitHub Actions: build e publicação automática do APK | 🟡 PR #15 mesclado; 👤 secrets | T2, T3 | [PLANO-T5](planos/PLANO-T5.md) |
| 7 | **T11** — guardar a chamada em andamento no aparelho | 🟡 PR #16 mesclado; 👤 teste no celular | T4·1 | [PLANO-T11](planos/PLANO-T11.md) |
| 8 | **T10** — monitoramento de erros no aparelho | 🟡 PR #17 mesclado; 👤 conta Sentry | T1, T3, 👤 conta Sentry | [PLANO-T10](planos/PLANO-T10.md) |
| 9 | **T7** — editar dados do aluno + exclusão de conta (LGPD) | 🟡 PR #18 mesclado; 👤 publicar em produção | T1 | [PLANO-T7](planos/PLANO-T7.md) |
| 10 | **T6** — aulas recorrentes (grade semanal) + renomear/excluir turma | 🟡 PR #19 mesclado; 👤 publicar em produção | T1, T7, T11 | [PLANO-T6](planos/PLANO-T6.md) |
| 11 | **T8** — Painel do admin + relatório de inadimplência e faturamento | 🟡 PR #20 mesclado; 👤 publicar em produção | T1, T6, T7 | [PLANO-T8](planos/PLANO-T8.md) |
| 12 | **T9** — notificações push | 🟡 implementada; 👤 Expo, Firebase e produção | T1, T6, T7, 👤 Expo e Firebase | [PLANO-T9](planos/PLANO-T9.md) |

**Por que essa ordem:** os merges pendentes vêm primeiro, para toda branch nova nascer
da `main` atualizada. Em seguida o ambiente DEV, porque T6, T7, T8 e T9 mexem no banco e
precisam de um lugar para testar sem tocar produção. Versão e assinatura vêm antes do
build automático. T11 e T7 entram antes de T6, que altera as mesmas telas. T9 é a última
porque usa regras das outras e depende de contas externas.

---

## Checklist por tarefa

### T4 — Pushs, PRs e merges ([plano](planos/PLANO-T4.md))

**Fase 1 — `snake-thai`** (sem efeito em produção)
- [x] PR de `feat/papel-professor` para a `main`, com **merge commit** (mantém a tag `v1.6.0` no histórico) — PR #9, merge `eca4c42`
- [x] Atualizar a `main` local e apagar as branches já mescladas (locais e remotas)
- [x] Ligar "apagar branch automaticamente após o merge"

**Fase 2 — `snake-server`**
- [x] Branch única com a P-19 e os 7 PRs seguros do Dependabot (#13, #11, #5, #7, #8, #9, #10), validada com `npm ci` e o gate local
- [x] ⚠️ PR e merge na `main` — **dispara deploy na Render** — PR #15, merge `2500111`, confirmado pelo usuário; API respondendo normalmente
- [x] Fechar os 3 majors que quebram a instalação (#3 vitest 4, #4 TypeScript 7, #6 ESLint 10) e registrar como P-20
- [x] Apagar as branches mescladas
- [ ] 👤 Conferir no painel da Render se o Auto-Deploy está ligado
- [ ] 👤 Conferir no painel da Supabase se não há integração com o GitHub aplicando migrations

### T1 — Separar dev de produção ([plano](planos/PLANO-T1.md))

- [x] Supabase local em Docker nas portas 553xx (convive com o radar-tributario), Postgres 17 como produção
- [x] Corrigir o teste SQL desatualizado que deixa o CI vermelho; scripts `db-dev` (subir, resetar, testar, gerar tipos, gerar `.env.dev`)
- [x] Seed base local (planos, turmas, contas de teste) e travas para as seeds de demonstração nunca rodarem num banco com gente real
- [x] Variante do app: `app.config.js` com **"DEV Snake Thai"** (`com.snakethai.app.dev`), instalável ao lado do app de produção
- [x] `.env.dev` e `.env.prod` separados e trava que impede o app DEV de apontar para produção (e vice-versa); faixa "DEV · banco local" na tela
- [x] `menu.bat` com escolha de variante e comandos do banco local
- [x] APK DEV gerado e instalado no seu celular em 2026-09-17 (`1.6.0+dev.103.ac2ebfa`, por Wi-Fi), ao lado do app de produção
- [x] `snake-server` local ligado ao banco local (verificado com token local); Cloudinary de dev aguarda as credenciais abaixo
- [x] Fluxo novo: migration **primeiro no local**; produção só por `scripts\db-push-prod.bat` (backup, simulação e dupla confirmação)
- [x] PR #12 (`snake-thai`) mesclado — `c03dc6d`
- [x] ⚠️ PR #16 (`snake-server`) mesclado por você em 2026-09-17 (`0941ac5`), com deploy na Render feito
- [ ] 👤 Rodar, com o seu token, a checagem **somente leitura** de produção (`migration list` e `db diff`)
- [ ] 👤 Criar o ambiente Cloudinary de desenvolvimento e colar as credenciais no `.env.dev` do servidor
- [ ] 👤⚠️ Dados de demonstração em produção: o plano recomendava trocar agora a senha das contas de demo e de teste, mas você já tinha decidido não mudar senhas — **nada foi alterado; a decisão é sua**. **Antes do primeiro aluno real**: backup e limpeza. Informar qual e-mail é a sua conta real de admin

### T3 — Número de versão ([plano](planos/PLANO-T3.md))

**Regra nova:** a versão só muda quando um APK é **publicado** para os usuários.
PATCH = correções · MINOR = funcionalidade nova · MAJOR = APK antigo deixa de funcionar.
Builds de teste e o app DEV não mudam a versão (ganham só um sufixo, ex.: `1.6.0+dev.12.abc1234`).

- [x] Script `npm run versao:patch | minor | major | tag | verificar | notas`, com testes
- [x] `versionCode` calculado da versão (1.6.0 → 1006000; antes todos os APKs saíam com 1)
- [x] `package.json` alinhado ao `app.json` (estava em 1.0.0)
- [x] `menu.bat` recusa compilar release com versão desatualizada
- [x] `CHANGELOG.md` com o histórico reconstituído e `docs/VERSIONAMENTO.md`
- [x] Versão instalada visível no fim do Perfil; política de versão do `snake-server` (vai no PR #16)
- [x] PR #13 mesclado — `7578f13`; APK DEV com versão conferido (`versionCode 1006000`, `1.6.0+dev.25.9289a3e`)
- Próximas versões: com a T1 integrada já há funcionalidade nova, então o próximo APK publicado sugere **1.7.0**; uma 1.6.1 só com a assinatura exige `--forcar`

### T2 — Tirar a chave de debug do release ([plano](planos/PLANO-T2.md))

- [x] ⚠️ Apagar o APK assinado com a chave de debug do release `v1.6.0` e deixar aviso nas notas (a cópia local fica guardada; o asset teve 0 downloads) — confirmado pelo usuário e feito em 2026-09-16
- [x] Build de release **falha** se a chave de produção não estiver configurada, com testes — provado no Gradle: `assembleRelease` para com a mensagem da trava, `assembleDebug` segue funcionando; o app DEV não exige chave
- [x] Corrigir a documentação: a keystore fica **fora** da pasta `android/`, que o prebuild apaga (`docs/RELEASE-SIGNING.md`); `menu.bat` `[5]` mostra o certificado e alerta se for a chave de debug
- [x] PR #14 mesclado — `9b44140`
- [ ] 👤 Gerar a keystore de produção (as senhas são digitadas por você), guardar em 2 lugares e testar a restauração
- [ ] 👤 Configurar as propriedades de assinatura em `%USERPROFILE%\.gradle\gradle.properties`
- [ ] Publicar o primeiro APK assinado — com a T1 e a T3 na `main` já há funcionalidade nova, então o caminho natural é **1.7.0**; 1.6.1 exige `--forcar` (decisão sua)
- [ ] 👤 Desinstalar a versão com chave de debug nos aparelhos e instalar a nova (só desta vez)

### T5 — Build automático no GitHub Actions ([plano](planos/PLANO-T5.md))

- [x] Workflow `release.yml` separado do CI: **tag `vX.Y.Z` publica**; botão manual na `main` gera um APK de ensaio (`ci.yml` intocado; actionlint limpo)
- [x] Travas: a tag precisa bater com a versão do app; o certificado precisa ser o de produção (APK e AAB); nunca publica com chave de debug; pacote, versionCode e versionName conferidos; bundle com o Supabase de produção
- [x] APK e AAB (Play Store) anexados ao release, com `SHA256SUMS`; notas vindas do CHANGELOG
- [x] PR #15 mesclado — `c34fd62`; "Release Android" ativo no GitHub
- [ ] Primeiro ensaio real no Actions (depende da keystore e dos secrets) e ajustes do primeiro build em Linux
- [ ] 👤 Criar o Environment `release` no GitHub e cadastrar os secrets (keystore, senhas, URL e chave pública da Supabase de **produção**) e a impressão digital do certificado

### T11 — Chamada em andamento no aparelho ([plano](planos/PLANO-T11.md))

- [x] Rascunho cifrado por usuário e aula, gravado a cada marcação (debounce de 0,5 s) e ao ir para segundo plano
- [x] Ao reabrir: aviso "rascunho recuperado" com opção de descartar
- [x] Conflito: se outra pessoa salvou a chamada depois, pergunta qual manter
- [x] Ao sair da tela: "Continuar marcando", "Descartar" ou "Sair e guardar"; rascunho vence em 7 dias; apagado ao sair do login
- [x] Testes (47 novos; suíte com 443)
- [ ] 👤 Validação no app DEV (matar o app no meio da chamada e reabrir) — roteiro em [`ENTREGA-T11`](planos/ENTREGA-T11.md)
- [x] PR #16 mesclado — `35687f9`

### T10 — Monitoramento de erros ([plano](planos/PLANO-T10.md))

- [x] Endurecer o log contra dado pessoal (nome, nascimento, CPF dentro da mensagem de erro)
- [x] Sentry (grátis até 5 mil erros/mês) ligado ao log existente, sem dado pessoal, com tela de erro amigável — **desligado até existir o DSN**
- [x] DEV e produção separados; botão de diagnóstico só fora de produção
- [x] Build sem token do Sentry não quebra (`menu.bat` e `release.yml` desligam o envio e avisam)
- [x] PR #17 mesclado — `775dce1`; APK DEV com o SDK nativo compilado
- [ ] 👤 Criar a conta no Sentry (região UE), o DSN e o token de build; atualizar a Política de Privacidade

### T7 — Editar aluno e exclusão de conta ([plano](planos/PLANO-T7.md))

- [x] Corrigir o filtro "Admins" da gestão, que ficava sempre vazio
- [x] Função única de anonimização, que corrige 3 falhas encontradas: imagens de comprovante não apagadas na exclusão, anexos e textos de justificativa esquecidos, fila de eliminação duplicada — 23 casos de regressão SQL
- [x] Tela **Editar aluno** (nome, CPF, celular, nascimento, turma, plano, situação e e-mail)
- [x] Exclusão pelo admin, "Excluir minha conta" (com senha) e "Exportar meus dados" — Edge Functions testadas no Supabase local
- [x] Prazo de guarda das imagens de comprovante — varredura pronta, **criada desligada** (ligar apaga arquivos reais; recomendação: 90 dias)
- [x] PR #18 mesclado — `d71660d`
- [ ] 👤⚠️ Publicar em produção **nesta ordem**: migrations (`db-push-prod.bat`, com backup) → Edge Functions (`--project-ref`) → só depois o APK. APK antes das funções chama a exclusão antiga, sem conferir a senha
- [ ] 👤 Confirmar na Render se o Cron Job de limpeza de mídia existe (sem ele nenhum arquivo é apagado de fato)
- [ ] 👤 Validar o prazo de guarda com o contador ou advogado e aprovar o texto da política

### T6 — Grade semanal e turmas ([plano](planos/PLANO-T6.md))

- [x] Renomear turma; excluir turma **arquiva** quando há histórico e apaga só a nunca usada; o admin escolhe para onde vão os alunos
- [x] Hoje excluir turma transformaria as aulas dela em eventos visíveis a **todos** os alunos — corrigido no banco (referências RESTRICT, rotina exige turma, chamada de turma arquivada congelada)
- [x] Grade semanal por turma: as aulas são geradas sozinhas até o fim do mês seguinte; editar ou encerrar um horário nunca mexe em aula com chamada — 29 casos de regressão SQL
- [x] Telas de turmas, grade e horário para o admin; seletores sem turma arquivada; chamada de turma arquivada só leitura
- [x] PR #19 mesclado — `760da62`
- [ ] 👤 Validar no app DEV (roteiro em [`ENTREGA-T6`](planos/ENTREGA-T6.md))
- [ ] 👤⚠️ Publicar em produção depois da T7: conferir (somente leitura) que não há aula de rotina sem turma, `db-push-prod.bat`, e o APK novo antes de usar a grade
- [ ] 👤 Decidir a limpeza das aulas futuras de demonstração em produção antes de cadastrar a grade real (se coincidirem, viram aulas da grade)
- [ ] 👤 Informar a grade real de cada turma (ou cadastrar pelo app depois do deploy)

### T8 — Painel do admin ([plano](planos/PLANO-T8.md))

- [x] Aba **Painel** (só admin, primeira aba): alunos ativos e inativos, recebido x esperado do mês, inadimplência por faixa de atraso, faturamento de 12 meses em gráfico, frequência média e alunos em risco de evasão
- [x] Relatório de inadimplência por aluno, que abre o histórico para dar baixa (também pelo Financeiro)
- [x] Toda a conta no banco, só para admin, sem CPF nem telefone saindo do banco — 12 casos de regressão SQL; funções abaixo de 10 ms com a demonstração
- [x] PR #20 mesclado — `1a94448`
- [ ] 👤 Validar no app DEV (roteiro em [`ENTREGA-T8`](planos/ENTREGA-T8.md)) e conferir 2 ou 3 números que você conhece da academia
- [ ] 👤⚠️ Publicar em produção: migration (`db-push-prod.bat`) **antes** do APK novo — com o APK antes, o Painel mostra erro

### T9 — Notificações push ([plano](planos/PLANO-T9.md))

- [x] Avisos: vencimento (3 dias antes e no dia), atraso (1 e 7 dias depois), comprovante enviado, aprovado e recusado, justificativa pendente, aula sem chamada — fila no banco com 20 casos de regressão
- [x] Edge Function `send-push` (segredo próprio, recibos, lotes, retentativa) — ensaiada de ponta a ponta no banco local com a Expo substituída por um servidor falso
- [x] Ativação pelo usuário (cartão + botão no Perfil); tocar na notificação abre a tela certa; texto sem dado pessoal; silêncio entre 22h e 7h; aparelho sai do banco ao sair da conta e ao excluir a conta
- [x] PR mesclado (#21)
- [ ] 👤 Conta Expo (`EAS_PROJECT_ID`), projeto Firebase com os 2 apps (produção e DEV), arquivo `google-services.json`, chave FCM V1 enviada à Expo — passo a passo em [`NOTIFICACOES.md`](NOTIFICACOES.md)
- [ ] 👤⚠️ Publicar em produção: migrations → segredos da função e do Vault → deploy da `send-push` → APK novo
- [ ] 👤 Testar no celular (ativar, receber, tocar com o app fechado e aberto)
- [ ] 👤 Aprovar a Política de Privacidade (rascunho pronto na L4) e decidir se o build no GitHub Actions (T5) recebe o `google-services.json` como secret

---

## Lacunas encontradas pelo revisor (tarefas extras)

- [x] **L1** — A senha padrão de primeiro acesso está fixa no código das Edge Functions (repositório público). Ler da configuração ou gerar senha aleatória, forçar a troca no primeiro acesso e revisar contas que nunca entraram — **feito** ([`ENTREGA-L1`](planos/ENTREGA-L1.md)): além do literal nas funções, qualquer aluno logado lia a senha em `academy_settings`. Agora só o admin a vê; as funções usam a configurada; o app avisa quantas contas ainda não entraram
  - [ ] 👤⚠️ Publicar: migration → as 3 Edge Functions de conta → APK; e, logo depois, trocar a senha em Configurações e redefinir as contas que ainda não entraram
- [x] **L2** — Backup (`db dump`) obrigatório antes de todo envio de migration para produção — feito no `db-push-prod.bat` (T1)
- [x] **L3** — Monitorar falhas dos jobs agendados do banco (mensalidades, frequência, grade, push) — **feito** ([`ENTREGA-L3`](planos/ENTREGA-L3.md)): aviso no Painel quando uma rotina falha
  - [ ] 👤⚠️ Publicar a migration junto das demais (sem ela o Painel só não mostra o aviso)
- [x] **L4** — Uma única versão nova da Política de Privacidade cobrindo exclusão e retenção (T7), push (T9) e Sentry (T10), com novo aceite — **feito** ([`ENTREGA-L4`](planos/ENTREGA-L4.md)): rascunhos da política e dos termos em [`legal/`](legal/README.md) com os fatos do app; aceite registrado por versão no primeiro acesso; tela de novo aceite a cada versão; Perfil → Termos e privacidade. Nada publicado: o banco recusa texto com `[PREENCHER`
  - [ ] 👤⚠️ Preencher os campos, aprovar com apoio jurídico e publicar (`npm run legal:publicar`, depois a migration como as demais)
  - [ ] 👤 Decidir como cadastrar alunos menores de idade (consentimento do responsável)
- [x] **L5** — Tirar a frase "pode rodar contra produção" dos testes SQL e da documentação (T1)
- [x] **L6** — Documentar o risco das portas do banco local expostas na rede (firewall do Windows) — `docs/RUNBOOK.md` (T1)
- [x] **L7** — Plano de publicação do bloco Produto: migrations antes do APK e, se possível, uma única reinstalação (assinatura nova + 1.7.0 juntas) — **feito**: roteiro em [`PUBLICACAO-1.7.0.md`](PUBLICACAO-1.7.0.md)
  - [ ] 👤⚠️ Executar o roteiro (cada passo de produção é seu)

## Pendências de segurança herdadas

- [ ] 👤 Trocar a senha do banco de produção (foi colada no chat)
- [ ] 👤 Revogar o token de acesso da Supabase (foi colado no chat)
- [ ] 👤 Trocar a senha de primeiro acesso em **Configurações** (a atual é pública no repositório) — só surte efeito depois de publicar a L1
- [ ] 👤 Cadastrar a chave PIX real da academia
- [ ] 👤 Remover os dados de demonstração antes do primeiro aluno real (ver T1)

---

## Decisões que são suas

No modo Loop eu sigo a **recomendação** de cada decisão e registro como premissa no
plano da tarefa (seção 3). Para mudar qualquer uma, basta responder. As que mais pesam:

| Tarefa | Decisão | Recomendação adotada |
|---|---|---|
| T4 | Estratégia de merge | Merge commit sempre (nunca squash), para as tags ficarem na `main` |
| T1 | Dados de demo em produção | Backup e limpeza antes do primeiro aluno real. Troca de senha agora **não** feita: conflita com a sua decisão da 1.6.0 |
| T1 | Acesso do celular ao banco local | `adb reverse` (nada exposto na rede, nada fixo no APK) |
| T2/T3 | Primeiro APK assinado | Se todos aceitarem desinstalar uma vez agora: 1.6.1. Senão: sai junto com a 1.7.0 |
| T3 | Fórmula do `versionCode` | MAJOR×1.000.000 + MINOR×1.000 + PATCH |
| T5 | Plataforma de build | GitHub Actions (grátis e sem cota em repositório público) |
| T6 | Excluir turma com histórico | Arquivar; destino dos alunos escolhido na hora |
| T7 | Guarda da imagem do comprovante | 90 dias após o pagamento (registro do pagamento: 5 anos + exercício) |
| T8 | Onde fica o Painel | Aba própria, primeira aba, só para admin |
| T9 | Serviço de push | Expo, com envio pelo banco (Edge Function + agendamento) |
| T10 | Ferramenta | Sentry, organização na UE, sem dado pessoal |
| T11 | Validade do rascunho | 7 dias |

---

## Registro de execução

| Data | O que aconteceu |
|---|---|
| 2026-09-16 | Planejamento das 11 tarefas (12 agentes somente-leitura + revisão cruzada). Planos gravados em `docs/planos/`. |
| 2026-09-16 | **T4 fase 1 concluída.** PR #9 (`feat/papel-professor` → `main`) mesclado com merge commit `eca4c42`; conteúdo idêntico ao da `v1.6.0`, tag agora na `main`. 7 branches remotas e 9 locais já mescladas foram apagadas; exclusão automática de branch ligada. |
| 2026-09-16 | **T4 fase 2 concluída.** PR #15 do `snake-server` (P-19 + 7 atualizações do Dependabot) mesclado com confirmação do usuário (`2500111`); API respondeu `ok` e `401` durante todo o deploy. Majors #3, #4 e #6 fechados e registrados como P-20. Branches mescladas apagadas nos dois repositórios. Relatório em [`ENTREGA-T4`](planos/ENTREGA-T4.md). |
| 2026-09-16 | **T2, primeiro item:** APK assinado com a chave de debug removido do release `v1.6.0`, com aviso nas notas (confirmado pelo usuário). |
| 2026-09-16 | **T1 implementada** (PRs `snake-thai` #12 e `snake-server` #16). Banco local em PG17 nas portas 553xx, `db-dev`, seeds locais com trava, app **DEV Snake Thai** com trava de ambiente e faixa, `menu.bat` por variante, `db-push-prod.bat` com backup e dupla confirmação, servidor de dev no banco local. Faltam: instalar o APK DEV no celular, credenciais Cloudinary de dev e merges. Lacunas L2, L5 e L6 resolvidas. Relatório em [`ENTREGA-T1`](planos/ENTREGA-T1.md). |
| 2026-09-16 | **T1:** PR #12 mesclado (`c03dc6d`, CI verde). APK DEV gerado e conferido (`com.snakethai.app.dev`, banco local embutido, sem endereço de produção). PR #16 do servidor com CI verde, aguardando confirmação por causa do deploy. |
| 2026-09-16 | **T3 implementada** (branch `chore/versionamento`). Versão só muda ao publicar; `versionCode` derivado (1006000); CLI `versao:*` com CHANGELOG; sufixo de build no app DEV e em testes; `[5]` do menu confere a versão; versão no Perfil. Política do servidor no PR #16. Relatório em [`ENTREGA-T3`](planos/ENTREGA-T3.md). |
| 2026-09-16 | **T3 concluída:** PR #13 mesclado (`7578f13`). APK DEV recompilado com a versão (`1.6.0+dev.25.9289a3e`, `versionCode 1006000`). |
| 2026-09-16 | **T2, parte de código:** plugin de assinatura com trava (release de produção sem keystore não compila, provado no Gradle), propriedades `SNAKETHAI_RELEASE_*`, DEV sem exigência, alerta de certificado no `menu.bat`, `docs/RELEASE-SIGNING.md` reescrito. Aguarda você gerar a keystore para assinar e publicar. |
| 2026-09-16 | **T2:** PR #14 mesclado (`9b44140`). Release de produção não compila sem a keystore; falta a keystore (você). |
| 2026-09-16 | **T5, workflow pronto** (branch `ci/release-android`): `Release Android` por tag e ensaio manual, com travas de assinatura, pacote, versão e banco. Só roda depois que você criar o Environment `release`, os secrets e a variável do certificado. |
| 2026-09-16 | **T5:** PR #15 mesclado (`c34fd62`); workflow "Release Android" ativo, aguardando Environment, secrets e keystore. |
| 2026-09-16 | **T11 implementada** (branch `feat/rascunho-chamada`): rascunho cifrado da chamada com recuperação, conflito, validade de 7 dias, 3 botões ao sair e limpeza no logout. 47 testes novos. Falta a validação no celular. Relatório em [`ENTREGA-T11`](planos/ENTREGA-T11.md). |
| 2026-09-16 | **T11:** PR #16 mesclado (`35687f9`). |
| 2026-09-16 | **T10 implementada** (branch `feat/monitoramento-erros`): Sentry sem dado pessoal (filtros, id aleatório + papel), logger com coletor, tela de erro amigável, diagnóstico só no DEV, build sem token funcionando. Desligado até você criar a conta e colar o DSN. Relatório em [`ENTREGA-T10`](planos/ENTREGA-T10.md). |
| 2026-09-16 | **T10:** PR #17 mesclado (`775dce1`); APK DEV com Sentry compilado, envio de source maps pulado sem token. |
| 2026-09-16 | **T7 implementada** (branch `feat/editar-aluno-lgpd`): exclusão LGPD transacional (corrige imagens e justificativas esquecidas e fila duplicada), Edge Functions de conta testadas no local, editar aluno (inclui e-mail), excluir minha conta com senha, exportar meus dados, prazo de guarda criado desligado. Nada publicado em produção. Relatório em [`ENTREGA-T7`](planos/ENTREGA-T7.md). |
| 2026-09-16 | **T7:** PR #18 mesclado (`d71660d`). |
| 2026-09-16 | **T6 implementada** (branch `feat/grade-semanal-turmas`): turma arquivada em vez de apagada quando tem histórico, destino dos alunos, chamada congelada; grade semanal com geração diária até o fim do mês seguinte, edição e encerramento que não tocam aula com chamada; telas Turmas, Grade e Horário. 29 casos SQL e 577 testes Jest; chamadas conferidas na API local. Nada publicado em produção. Relatório em [`ENTREGA-T6`](planos/ENTREGA-T6.md). |
| 2026-09-16 | **T6:** PR #19 mesclado (`760da62`), CI verde. |
| 2026-09-16 | **T8 implementada** (branch `feat/painel-admin`): 5 funções agregadas no banco (só admin, dia de São Paulo, conta excluída só na soma, sem CPF/telefone/e-mail), aba Painel como primeira aba do admin, gráfico de faturamento só com View, relatório de inadimplência por faixa que abre o histórico para dar baixa. 12 casos SQL, 612 testes Jest; números conferidos contra SQL direto na API local; professor e aluno recebem 403. Nada publicado em produção. Relatório em [`ENTREGA-T8`](planos/ENTREGA-T8.md). |
| 2026-09-16 | **T8:** PR #20 mesclado (`1a94448`), CI verde. |
| 2026-09-16 | **T9 implementada** (branch `feat/notificacoes-push`): aparelhos com RLS do titular e fila de notificações no banco (gatilhos de comprovante e justificativa, lembretes pelo dia de São Paulo, aula sem chamada, silêncio 22h–7h, deduplicação, retenção de 30 dias, export LGPD), Edge Function `send-push` chamada pelo pg_cron via pg_net, ativação no app (convite + Perfil), registro e remoção do aparelho, toque que abre a aba certa respeitando a digital. 20 casos SQL, 8 testes Deno, 642 Jest; ensaio local completo com Expo falsa. Nada publicado; falta você criar as contas Expo e Firebase. Relatório em [`ENTREGA-T9`](planos/ENTREGA-T9.md). |
| 2026-09-16 | **T9:** PR #21 mesclado (`32a8652`), CI verde (um job refeito por limite de requisições do GitHub). |
| 2026-09-16 | **L1 corrigida** (branch `fix/senha-padrao-protegida`): além do literal público nas Edge Functions, a senha de primeiro acesso era legível por qualquer aluno logado. Agora fica em `academy_secrets` (só servidor), admin lê/troca por função, as 3 funções de conta usam o valor configurado, a coluna antiga guarda só a máscara (APK 1.6.0 segue salvando) e o app avisa quantas contas ainda não entraram. 5 casos SQL, 646 Jest; conferido na API local. Nada publicado. Relatório em [`ENTREGA-L1`](planos/ENTREGA-L1.md). |
| 2026-09-16 | **L1:** PR #22 mesclado (`3b6d96f`), CI verde. |
| 2026-09-16 | **L3 feita** (branch `feat/saude-das-rotinas`): `saude_das_rotinas()` só admin e aviso no topo do Painel quando uma das 10 rotinas agendadas falha, com nome amigável e sem a mensagem de erro; o Painel não cai se a consulta falhar. 4 casos SQL, Jest verde; conferido na API local com o histórico real do pg_cron. Relatório em [`ENTREGA-L3`](planos/ENTREGA-L3.md). |
| 2026-09-16 | **L3:** PR #23 mesclado (`e937026`), CI verde. |
| 2026-09-16 | **L7 feita:** roteiro único de publicação da 1.7.0 ([`PUBLICACAO-1.7.0.md`](PUBLICACAO-1.7.0.md)) — segurança e contas, checagens somente leitura, 9 migrations com backup, Edge Functions logo em seguida, ajustes com o app antigo, versão e APK assinado, reinstalação única, configuração inicial e 48 h de acompanhamento, com volta atrás por passo. |
| 2026-09-16 | **L7:** PR #24 mesclado (`8804390`), CI verde. |
| 2026-09-16 | **L4 feita** (branch `feat/politica-de-privacidade`): rascunhos da Política de Privacidade e dos Termos de Uso em `docs/legal/` com os fatos do app e campos `[PREENCHER]`; aceite registrado por versão no primeiro acesso; tela "Termos atualizados" a cada versão (sem travar sem rede); Perfil → Termos e privacidade; texto publicado imutável e publicação por migration gerada por script, que o banco recusa com campo em aberto. 9 grupos de casos SQL, 698 Jest; ensaio completo na API local. Nada publicado. Relatório em [`ENTREGA-L4`](planos/ENTREGA-L4.md). |
| 2026-09-16 | **L4:** PR #25 mesclado (`da2688a`), CI verde. Com isso, todas as tarefas (T1–T11) e lacunas (L1–L7) estão feitas do lado do código; o que resta é decisão sua ou passo de produção (marcados com 👤). |
| 2026-09-17 | **T1 (servidor):** você mesclou o PR #16 do `snake-server` (`0941ac5`) e o deploy na Render saiu. |
| 2026-09-17 | **APK DEV no celular:** `1.6.0+dev.103.ac2ebfa` instalado por Wi-Fi (adb), com as portas 55321, 3000 e 6969 encaminhadas. Falta você percorrer o roteiro de teste. |
| 2026-09-18 | **Ajustes pedidos pelo dono** (branch `feat/ajustes-painel-e-financeiro`, PR #31): risco de evasão passa a 70%; filtros do Financeiro não quebram mais em duas linhas; faixa do app DEV vai para baixo do menu, com 14 dp e a versão do build; atalho de login (Admin/Professor/Aluno) no app DEV, com as contas vindas do `.env.dev`. |
| 2026-09-18 | **Frequência auditada.** A fórmula estava certa (conferida à mão contra o SQL; correção da chamada no mês corrente testada no aparelho: 62,5% → 50%). Dois defeitos reais corrigidos: trocar de turma no meio do mês transformava em falta as aulas já chamadas da turma nova (100% → 0%; em lote, média de 83% → 55%), e aluno com matrícula trancada seguia no denominador congelando 0% todo mês. |
| 2026-09-18 | **Dados dos termos:** o admin preenche CNPJ, razão social, prazos e foro em Dados → Dados dos termos e da política; o texto vira modelo com marcadores e o banco monta o documento ao publicar. Publicar com campo em branco é recusado e mudar um valor não reescreve documento já aceito. Falta você preencher (em produção) e a equipe publicar a versão. |
