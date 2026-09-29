# 🔍 Relatório de Auditoria e Revisão de Código — Fase 4

> Bloco **4.12**, 2026-09-29. Escopo: as migrations `20260925200100` a `20260929211000` (blocos 4.1
> a 4.11) e o `src/` mudado desde 25/09 (PRs #49 a #78). Tudo foi reproduzido no banco local, em
> transação com `rollback`. **As correções marcadas ✅ estão no PR deste bloco** (migration
> `20260929220000_auditoria_fase4.sql`, regressão `regressao_auditoria_fase4.sql` e o app).
> O `REVIEW.md` da raiz é a auditoria anterior (agosto) e continua valendo.

## 📊 Resumo Executivo

App Expo/React Native (TypeScript strict) sobre Supabase (Postgres 17 com RLS, RPCs
`security definer` com `search_path = ''`), mais o `snake-server` para anexos. A Fase 4 foi
construída com as travas certas: tabelas novas sem grant para `authenticated` (tudo por RPC),
leitura de motivos e justificativas por funções definer, variáveis de sessão sempre desligadas
antes de cada `return`, caminhos de anexo derivados no banco e perfis sem CPF para a equipe.

A auditoria achou **um vazamento real de dado de saúde** (A1), **dois defeitos de integridade**
(B1, B2), uma trava frouxa não explorável (B3) e higiene de permissões (H1); no app, seis pontos de
robustez e minimização. **Todos os críticos e altos foram corrigidos.** Ficam abertos: o anexo da
justificativa ainda gravado por UPDATE do dono (espera a rota nova do servidor, G2) e a
confirmação do dono para duas erratas do contrato (A1 e B2).

**Não auditado neste bloco:** o `snake-server` (tem auditoria própria no repositório dele) e a web.

## 🔥 Top 5 Causas de Vazamento — veredicto obrigatório

| # | Causa | Veredicto | Evidência | Prática |
|---|-------|-----------|-----------|---------|
| V1 | Banco sem RLS / regras abertas | ✅ PROTEGIDO (depois de A1) | RLS em todas as tabelas novas; `roll_call_requests`, `class_swaps`, `class_swap_periods`, `class_swap_reviews` sem grant (42501 reproduzido); `absence_justifications` por `pode_decidir_justificativa`, corrigida em A1 | [#55] |
| V2 | Autorização decidida no front-end | ✅ PROTEGIDO | papel, turma, plano e situação recusados pelo banco para quem não é admin (`enforce_profile_update_rules`, `enforce_role_change_rules`, RLS de `profiles`); nenhuma escrita direta em tabela da v3 | [#51][#56] |
| V3 | IDOR (ID sem checagem de dono) | ✅ PROTEGIDO | toda RPC com `p_user_id`/`p_class_id` confere `auth.uid()`, `is_staff()`, `is_admin()`, `faz_a_chamada` ou `pode_decidir_*` | [#55] |
| V4 | Segredo chumbado no código/Git | ✅ PROTEGIDO | `.env*` no `.gitignore`, só `.env.example` versionado; nenhuma chave em `src/`, `app.config.js` ou `eas.json` | [#37][#80] |
| V5 | Input sem tratamento (XSS) | ✅ PROTEGIDO (depois de S3) | sem WebView nem HTML; a URL assinada do atestado agora só abre se for `https` do Cloudinary | [#51][#53] |

## 🚨 Risco Crítico (Segurança e LGPD)

* **✅ A1 — Atestado lido por quem se inclui numa aula futura (LGPD art. 11, D22)**: o professor pode
  se incluir em qualquer aula futura, e `pode_decidir_justificativa` aceitava qualquer membro de
  `class_teachers`. Reproduzido: com a justificativa enviada, o professor de fora se inclui e passa
  a ler o texto do atestado (e a decidir). A T18 e a T49 já fechavam essa porta para a semana e para
  a troca permanente; faltava na justificativa de aula.
* **Onde está:** `supabase/migrations/20260929170000_justificativas.sql:172-174`.
* **Como corrigir (feito):** só decide (e lê) quem já estava na aula quando a justificativa chegou
  (`class_teachers.created_at <= j.created_at`) ou quem está escalado no horário. **Errata do
  contrato (§ 9.1) para o dono confirmar.**

## 🐛 Risco Alto (Bugs e Arquitetura)

* **✅ B1 — A trava de `classes` não valia no INSERT**: o professor criava um evento já com
  `attendance_taken_at` e `attendance_edited` (aula "concluída" que ninguém apaga) ou já cancelado,
  sem passar pelas RPCs e sem `class_audit`. Quebra a § 6 e a regra 4 da § 0.1 [#51].
* **Onde está:** `supabase/migrations/20260925200600_v3_travas.sql:186-188` (gatilho só `before update or delete`).
* **Como refatorar (feito):** gatilho `before insert or update or delete`; no INSERT, sem
  cancelamento, chamada nem retificação fora do sistema ou da RPC.

* **✅ B2 — Apagar um horário apagava o período de troca e mudava o passado (D49, T37)**: as FKs de
  `class_swap_periods` eram `on delete cascade`; `encerrar_horario_da_grade` (horário que nunca
  começou) e `excluir_turma` (horário sem aula) apagavam o horário, e o período ia junto. As aulas
  passadas do horário de origem voltavam à grade do aluno como falta.
* **Onde está:** `20260925200300_v3_trocas.sql:85-86`; `20260929110000_planos_grade_contato.sql:673` e `:774`.
* **Como refatorar (feito):** FKs `on delete restrict`; `encerrar_horario_da_grade` recusa, com a
  data mínima, o horário com período; `excluir_turma` não apaga o horário com período (só encerra).
  **Errata do contrato (§ 9.4, FK) para o dono confirmar.**

## ⚠️ Risco Médio (Performance e Infraestrutura)

* **Anexo da justificativa gravado por UPDATE do dono (C1)**: o app ainda sobe o anexo pela rota
  antiga (`sign-upload {classId}`) e grava `proof_public_id` direto, que a regra (f) da § 9.1 permite
  enquanto pendente. A constraint limita o caminho à pasta do próprio aluno (gravar o caminho de outro
  aluno dá `check` — confirmado), então não há acesso nem exclusão do arquivo de outra pessoa; o risco
  é o dono trocar o próprio anexo mais de uma vez e sem `allowed_formats`.
* **Impacto:** anexo sem a validação de formato da rota nova.
* **Solução:** com o **G2**, trocar para `sign-upload {justificationId}` + `anexar_a_justificativa`
  e tirar `proof_*` das colunas do dono. Pendente do servidor.

* **✅ Erro do banco registrado inteiro no log (S2)**: o logger serializava o objeto do PostgREST,
  com `details`/`hint`, que podem trazer a linha que violou a regra (texto de justificativa). Agora
  só código e mensagem [#63]. `src/lib/logger.ts`.
* **✅ Ids de pessoa crus no log e no Sentry (C3)**: `userId`/`teacherId` entram nas chaves
  mascaradas do logger [#63]. `src/lib/logger.ts`.
* **✅ URL do atestado aberta sem validação (S3)**: `src/utils/url.ts` + `JustificativasParaRevisarScreen.tsx`.
* **✅ Pessoas carregava celular e nascimento de todos (S5)**: `fetchPessoas` seleciona só as
  colunas da lista (minimização). `src/services/profile.service.ts`.

## 💡 Risco Baixo (Clean Code e Dívida Técnica)

* **✅ B3 — A trava de papel tratava o anon como "o sistema"**: não explorável (a RLS de `profiles`
  barra o anon), mas quebrava a forma da § 0.1. `20260929100000_admin_e_professor.sql:116`.
* **✅ H1 — Revokes que faltaram**: `export_my_data` (anon), quatro funções de gatilho reescritas,
  `mark_overdue_payments` (anon e authenticated) e os grants de escrita na view `diretorio_perfis`.
* **✅ C4 — Lista antiga sem aviso quando a recarga falha**: `ErroAoAtualizar` nas seis telas novas de lista.
* **✅ C5 — Falha ao carregar os professores da agenda só no log**: aviso na agenda do admin e do professor.
* **C2 — O titular muda o próprio `name` e `is_first_login` pela API**: regra antiga (onboarding),
  anterior à Fase 4. **Recomendação:** mover a saída do primeiro acesso para uma RPC depois da troca
  de senha. Fica para o item 3.5 (antes do primeiro aluno real), junto da troca da `service_role`.
* **Anexo `-2` na tentativa 1 e troca de `proof_provider` pelo dono**: permitido pela constraint;
  o arquivo errado só sai pela varredura de órfãos (§ 13.3). **Recomendação:** amarrar o sufixo ao
  `attempt` quando a rota nova (G2) substituir o UPDATE do dono.
* **S6 — UPDATE do admin sem `.select()`**: se a RLS filtrar a linha, a tela diz que salvou.
  **Recomendação:** conferir as linhas afetadas nos updates de `profile.service.ts`.
* **S4 — Qualquer professor vê a chamada (só leitura) de qualquer aula**: é o desenho do 4.6 ("Ver
  chamada" no detalhe da aula). Sem mudança.

## ✅ Plano de Ação Imediato

1. **Feito:** A1, B1, B2, B3 e H1 no banco; S2, C3, S3, S5, C4 e C5 no app.
2. **Dono:** confirmar as duas erratas do contrato (A1, § 9.1; B2, § 9.4) na próxima revisão, junto
   de `quem_sera_avisado` e `solicitacao_para_decidir`.
3. **G2 (servidor):** anexo da justificativa pela rota nova e `proof_*` fora das colunas do dono.
4. **3.5:** saída do primeiro acesso por RPC (C2), junto da troca da `service_role`.
5. **Dívida:** conferir linhas afetadas nos updates do admin (S6).
