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
| 4 | **T3** — padronizar número de versão | 🟡 PR aberto | T4·1 | [PLANO-T3](planos/PLANO-T3.md) |
| 5 | **T2** — tirar a chave de debug do release e assinar com a de produção | ⬜ | T3, 👤 keystore | [PLANO-T2](planos/PLANO-T2.md) |
| 6 | **T5** — GitHub Actions: build e publicação automática do APK | ⬜ | T2, T3 | [PLANO-T5](planos/PLANO-T5.md) |
| 7 | **T11** — guardar a chamada em andamento no aparelho | ⬜ | T4·1 | [PLANO-T11](planos/PLANO-T11.md) |
| 8 | **T10** — monitoramento de erros no aparelho | ⬜ | T1, T3, 👤 conta Sentry | [PLANO-T10](planos/PLANO-T10.md) |
| 9 | **T7** — editar dados do aluno + exclusão de conta (LGPD) | ⬜ | T1 | [PLANO-T7](planos/PLANO-T7.md) |
| 10 | **T6** — aulas recorrentes (grade semanal) + renomear/excluir turma | ⬜ | T1, T7, T11 | [PLANO-T6](planos/PLANO-T6.md) |
| 11 | **T8** — Painel do admin + relatório de inadimplência e faturamento | ⬜ | T1, T6, T7 | [PLANO-T8](planos/PLANO-T8.md) |
| 12 | **T9** — notificações push | ⬜ | T1, T6, T7, 👤 Expo e Firebase | [PLANO-T9](planos/PLANO-T9.md) |

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
- [ ] APK DEV gerado (`release/snake-thai-dev-v1.6.0.apk`, conferido) e instalado no seu celular ao lado do de produção — 👤 falta conectar o celular no ADB para instalar
- [x] `snake-server` local ligado ao banco local (verificado com token local); Cloudinary de dev aguarda as credenciais abaixo
- [x] Fluxo novo: migration **primeiro no local**; produção só por `scripts\db-push-prod.bat` (backup, simulação e dupla confirmação)
- [x] PR #12 (`snake-thai`) mesclado — `c03dc6d`
- [ ] ⚠️ PR #16 (`snake-server`) — o merge dispara deploy na Render; aguarda a sua confirmação
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
- [ ] PR mesclado
- Próximas versões: com a T1 integrada já há funcionalidade nova, então o próximo APK publicado sugere **1.7.0**; uma 1.6.1 só com a assinatura exige `--forcar`

### T2 — Tirar a chave de debug do release ([plano](planos/PLANO-T2.md))

- [x] ⚠️ Apagar o APK assinado com a chave de debug do release `v1.6.0` e deixar aviso nas notas (a cópia local fica guardada; o asset teve 0 downloads) — confirmado pelo usuário e feito em 2026-09-16
- [ ] Build de release **falha** se a chave de produção não estiver configurada (hoje cai na chave de debug sem avisar), com testes
- [ ] Corrigir a documentação: a keystore fica **fora** da pasta `android/`, que o prebuild apaga
- [ ] 👤 Gerar a keystore de produção (as senhas são digitadas por você), guardar em 2 lugares e testar a restauração
- [ ] 👤 Configurar as propriedades de assinatura em `%USERPROFILE%\.gradle\gradle.properties`
- [ ] Publicar o primeiro APK assinado (1.6.1 agora, ou junto da 1.7.0 — ver decisões)
- [ ] 👤 Desinstalar a versão com chave de debug nos aparelhos e instalar a nova (só desta vez)

### T5 — Build automático no GitHub Actions ([plano](planos/PLANO-T5.md))

- [ ] Workflow `release.yml` separado do CI: **tag `vX.Y.Z` publica**; botão manual na `main` gera um APK de ensaio
- [ ] Travas: a tag precisa bater com a versão do app; o certificado precisa ser o de produção; nunca publica com chave de debug
- [ ] APK e AAB (Play Store) anexados ao release, com `SHA256SUMS`
- [ ] 👤 Criar o Environment `release` no GitHub e cadastrar os secrets (keystore, senhas, URL e chave pública da Supabase de **produção**) e a impressão digital do certificado

### T11 — Chamada em andamento no aparelho ([plano](planos/PLANO-T11.md))

- [ ] Rascunho cifrado por usuário e aula, gravado a cada marcação e ao ir para segundo plano
- [ ] Ao reabrir: aviso "rascunho recuperado" com opção de descartar
- [ ] Conflito: se outra pessoa salvou a chamada depois, pergunta qual manter
- [ ] Ao sair da tela: "Continuar marcando", "Descartar" ou "Sair e guardar"; rascunho vence em 7 dias; apagado ao sair do login
- [ ] Testes e validação no app DEV (matar o app no meio da chamada e reabrir)

### T10 — Monitoramento de erros ([plano](planos/PLANO-T10.md))

- [ ] Endurecer o log contra dado pessoal (nome, nascimento, CPF dentro da mensagem de erro) — **pode começar já**
- [ ] Sentry (grátis até 5 mil erros/mês) ligado ao log existente, sem dado pessoal, com tela de erro amigável
- [ ] DEV e produção separados; botão de diagnóstico só fora de produção
- [ ] 👤 Criar a conta no Sentry (região UE), o DSN e o token de build; atualizar a Política de Privacidade

### T7 — Editar aluno e exclusão de conta ([plano](planos/PLANO-T7.md))

- [ ] Corrigir o filtro "Admins" da gestão, que hoje fica sempre vazio — **pode começar já**
- [ ] Função única de anonimização, que corrige 3 falhas encontradas: imagens de comprovante não apagadas na exclusão, anexos e textos de justificativa esquecidos, fila de eliminação duplicada
- [ ] Tela **Editar aluno** (nome, CPF, celular, nascimento, turma, plano, situação e e-mail)
- [ ] Exclusão pelo admin, "Excluir minha conta" (com senha) e "Exportar meus dados"
- [ ] Prazo de guarda das imagens de comprovante (recomendado: 90 dias após o pagamento)
- [ ] 👤 Confirmar na Render se o Cron Job de limpeza de mídia existe (sem ele nenhum arquivo é apagado de fato)
- [ ] 👤 Validar o prazo de guarda com o contador ou advogado e aprovar o texto da política

### T6 — Grade semanal e turmas ([plano](planos/PLANO-T6.md))

- [ ] Renomear turma; excluir turma **arquiva** quando há histórico e apaga só a nunca usada; o admin escolhe para onde vão os alunos
- [ ] Hoje excluir turma transformaria as aulas dela em eventos visíveis a **todos** os alunos — corrigido no banco
- [ ] Grade semanal por turma: as aulas são geradas sozinhas até o fim do mês seguinte; editar ou encerrar um horário nunca mexe em aula com chamada
- [ ] Telas de turmas, grade e horário para o admin
- [ ] 👤 Informar a grade real de cada turma (ou cadastrar pelo app depois do deploy)

### T8 — Painel do admin ([plano](planos/PLANO-T8.md))

- [ ] Aba **Painel** (só admin, primeira aba): alunos ativos e inativos, recebido x esperado do mês, inadimplência por faixa de atraso, faturamento de 12 meses em gráfico, frequência média e alunos em risco de evasão
- [ ] Relatório de inadimplência por aluno, que abre o histórico para dar baixa
- [ ] Toda a conta no banco, só para admin, sem CPF nem telefone saindo do banco

### T9 — Notificações push ([plano](planos/PLANO-T9.md))

- [ ] Avisos: vencimento (3 dias antes e no dia), atraso (1 e 7 dias depois), comprovante enviado, aprovado e recusado, justificativa pendente, aula sem chamada
- [ ] Ativação pelo usuário (cartão + botão no Perfil); tocar na notificação abre a tela certa; texto sem dado pessoal; silêncio entre 22h e 7h
- [ ] 👤 Conta Expo, projeto Firebase com os 2 apps (produção e DEV), arquivo `google-services.json`, chave FCM e segredos do envio
- [ ] 👤 Aprovar o texto da Política de Privacidade

---

## Lacunas encontradas pelo revisor (tarefas extras)

- [ ] **L1** — A senha padrão de primeiro acesso está fixa no código das Edge Functions (repositório público). Ler da configuração ou gerar senha aleatória, forçar a troca no primeiro acesso e revisar contas que nunca entraram
- [x] **L2** — Backup (`db dump`) obrigatório antes de todo envio de migration para produção — feito no `db-push-prod.bat` (T1)
- [ ] **L3** — Monitorar falhas dos jobs agendados do banco (mensalidades, frequência, grade, push)
- [ ] **L4** — Uma única versão nova da Política de Privacidade cobrindo exclusão e retenção (T7), push (T9) e Sentry (T10), com novo aceite
- [x] **L5** — Tirar a frase "pode rodar contra produção" dos testes SQL e da documentação (T1)
- [x] **L6** — Documentar o risco das portas do banco local expostas na rede (firewall do Windows) — `docs/RUNBOOK.md` (T1)
- [ ] **L7** — Plano de publicação do bloco Produto: migrations antes do APK e, se possível, uma única reinstalação (assinatura nova + 1.7.0 juntas)

## Pendências de segurança herdadas

- [ ] 👤 Trocar a senha do banco de produção (foi colada no chat)
- [ ] 👤 Revogar o token de acesso da Supabase (foi colado no chat)
- [ ] 👤 Trocar a senha padrão de novos alunos em **Configurações** (ela é pública no repositório)
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
