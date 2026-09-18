# Publicação da 1.7.0 — roteiro único (lacuna L7)

> Tudo o que foi feito em 2026-09-16 (T6, T7, T8, T9, T10, T11, L1, L3, L4) está na `main`,
> mas **nada disso está em produção**. Este é o caminho para publicar numa ordem que não
> quebra quem está usando o app, com **uma única reinstalação** nos celulares (a troca da
> chave de assinatura e a versão 1.7.0 juntas).
>
> Cada passo com ⚠️ altera produção e é feito por você, com o seu token e as suas senhas.
> Nenhum valor secreto passa por chat, e-mail ou Git.

## Resumo da ordem

| # | Passo | Por que nesta ordem |
|---|---|---|
| 0 | Segurança e contas | Token e senha do banco vazaram no chat; sem keystore não há APK de produção |
| 1 | Checagens somente leitura | Uma migration para de propósito se houver aula de rotina sem turma |
| 2 | ⚠️ Migrations (com backup) | O APK novo e as funções novas dependem delas |
| 3 | ⚠️ Edge Functions | Logo depois das migrations: o app antigo chamaria a exclusão de conta sem senha |
| 4 | Ajustes no app antigo ainda instalado | Senha de primeiro acesso já pode ser trocada |
| 5 | ⚠️ Versão 1.7.0 e APK assinado | Só depois do banco e das funções |
| 6 | ⚠️ Reinstalação nos celulares (uma vez) | A chave de assinatura muda |
| 7 | Configuração inicial e limpeza | Grade real, PIX real, dados de demonstração |
| 8 | Acompanhamento de 48 horas | Rotinas automáticas e erros |

---

## 0. Antes de tudo (só você)

- [ ] **Trocar a senha do banco de produção** (painel da Supabase → Database → Settings).
  Ela foi colada no chat.
- [ ] **Revogar o token de acesso da Supabase** que foi colado no chat (Account → Access
  Tokens). Gere um novo só na hora do passo 2, sem compartilhar.
- [ ] **Keystore de produção** (T2): gerar, guardar em dois lugares e testar a restauração.
  Configurar `SNAKETHAI_RELEASE_*` em `%USERPROFILE%\.gradle\gradle.properties`
  ([`RELEASE-SIGNING.md`](RELEASE-SIGNING.md)).
- [ ] **Build no GitHub Actions** (T5, opcional; senão, use o `menu.bat`): Environment
  `release`, secrets e a variável `RELEASE_CERT_SHA256`.
- [ ] **Opcionais que podem ficar para depois** (o app funciona sem eles):
  - Sentry (T10): DSN e token.
  - Expo e Firebase (T9): `EAS_PROJECT_ID` e `google-services.json`; sem eles as
    notificações ficam "indisponíveis".
- [x] **Política de Privacidade e Termos de Uso (L4):** texto aprovado em 2026-09-18.
- [ ] **Preencher os dados da academia nos termos**, e isso acontece **depois** de a
  1.7.0 estar publicada: a tela fica em *Dados → Dados dos termos e da política* e os
  valores vivem no banco de produção. Só então se gera a migration de publicação com
  `npm run legal:publicar` (ver [`legal/README`](legal/README.md)). Push e Sentry não
  devem ser ligados antes de os documentos estarem publicados.

## 1. Checagens somente leitura em produção

Com o token novo, na pasta `snake-thai`:

```bash
npx supabase migration list --linked
```

O esperado é que a última migration aplicada seja a de **2026-09-14**
(`20260914190000_chamada_em_lote`) e que as quinze abaixo apareçam só no local. Se faltar
alguma anterior, **pare** e resolva primeiro.

No SQL Editor de produção (só `select`):

```sql
-- T6: tem de dar 0. Se não der, a migration de turmas para de propósito.
select count(*) from public.classes where type = 'routine' and group_id is null;

-- T6: aulas futuras da demonstração que a grade real adotaria (decida a limpeza no passo 7).
select count(*) from public.classes where date_time > now();
```

## 2. ⚠️ Migrations (backup e dupla confirmação)

```bat
scripts\db-push-prod.bat
```

O script mostra o projeto, pede `PRODUCAO`, faz o backup em
`%USERPROFILE%\snake-thai-backups`, simula (confira se a lista é exatamente esta), pede
`APLICAR` e aplica:

| Migration | Tarefa | O que faz em produção |
|---|---|---|
| `20260916195116_lgpd_exclusao_de_conta` | T7 | Exclusão de conta numa transação; export completo; e-mail do aluno para o admin |
| `20260916195119_retencao_comprovantes` | T7 | Prazo de guarda das imagens — **nasce desligado** |
| `20260916201935_turmas_arquivamento` | T6 | Turma arquivada; aula de rotina exige turma |
| `20260916201939_grade_semanal` | T6 | Grade semanal e geração diária das aulas (sem horários, não gera nada) |
| `20260916210123_painel_admin` | T8 | Funções do Painel (só leitura) |
| `20260916211951_push_dispositivos` | T9 | Aparelhos de push (vazio até alguém ativar) |
| `20260916211956_notificacoes_fila` | T9 | Fila e rotinas de push (sem os segredos do Vault, nada é enviado) |
| `20260916220151_senha_padrao_protegida` | L1 | Tira a senha de primeiro acesso do alcance dos alunos |
| `20260916221418_saude_das_rotinas` | L3 | Aviso de rotina com falha no Painel |
| `20260916223510_documentos_legais_aceite` | L4 | Aceite registrado por versão; nada muda até um texto ser publicado |
| `20260918190000_risco_evasao_70` | — | Risco de evasão passa a ser abaixo de 70% |
| `20260918200000_frequencia_turma_e_trancamento` | — | Frequência conta da entrada na turma e para no trancamento |
| `20260918210000_dados_dos_termos` | — | Tabelas e funções dos dados que a academia preenche nos termos |
| `20260918210100_modelo_privacy_policy` | — | Texto-modelo da Política (com marcadores) |
| `20260918210200_modelo_terms_of_use` | — | Texto-modelo dos Termos (com marcadores) |

Se os textos aprovados já estiverem prontos, as migrations `…_publicar_privacy_policy_…`
e `…_publicar_terms_of_use_…` entram por último. Com elas, todos precisam aceitar na
próxima abertura do app 1.7.0 (o 1.6.0 não pede).

Depois (só `select`):

```sql
select jobname, schedule from cron.job order by jobname;           -- 10 rotinas
select default_student_password from public.academy_settings;      -- ********
select count(*) from public.academy_secrets;                       -- 1
select kind, version from public.legal_documents where is_current; -- vazio, ou os textos aprovados
```

**Volta atrás:** o backup do passo 2 (restaurar é destrutivo e apaga o que entrou depois).
Por isso o passo 3 vem logo em seguida, e o app novo só no passo 5.

## 3. ⚠️ Edge Functions (logo depois das migrations)

```bash
npx supabase functions deploy delete-my-account --project-ref <REF>
npx supabase functions deploy delete-user-account --project-ref <REF>
npx supabase functions deploy admin-update-user-email --project-ref <REF>
npx supabase functions deploy create-student --project-ref <REF>
npx supabase functions deploy create-staff --project-ref <REF>
npx supabase functions deploy reset-student-password --project-ref <REF>
```

- **Não demore entre os passos 2 e 3.**
  - A `delete-my-account` antiga exclui a conta sem conferir a senha.
  - As três de cadastro antigas continuam com a senha pública até serem trocadas.
- **`send-push`: só se Expo e Firebase estiverem prontos.** Siga
  [`NOTIFICACOES.md`](NOTIFICACOES.md): segredos da função, deploy com `--no-verify-jwt`
  e os dois segredos do Vault. Sem isso, deixe-a sem deploy: ninguém entra na fila sem
  aparelho registrado.

**Volta atrás:**
- **Funções que já existiam na 1.6.0:** fazer o deploy de novo a partir da tag (numa cópia
  de trabalho à parte, `git worktree add ../snake-thai-v1.6.0 v1.6.0`).
- **Funções novas** (`delete-user-account`, `admin-update-user-email`): não têm versão
  anterior; apague-as no painel da Supabase se precisar.

## 4. Com o app antigo ainda instalado

- [ ] **Trocar a senha de primeiro acesso em Configurações** (o app 1.6.0 já salva na
  tabela protegida). A atual é pública no repositório.
- [ ] **Redefinir a senha das contas que ainda não fizeram o primeiro acesso**
  (Gerenciar alunos → chave). A consulta está no [`RUNBOOK`](RUNBOOK.md).
- [ ] **Avisar que vem um app novo e que será preciso reinstalar uma vez.** Quem estiver no
  meio de uma chamada deve concluí-la antes.

## 5. ⚠️ Versão 1.7.0 e APK assinado

Seguir [`VERSIONAMENTO.md`](VERSIONAMENTO.md) → *Publicar uma versão*:

```bash
git switch main && git pull --ff-only
npm run versao:minor -- --dry-run   # confere 1.7.0 e o rascunho das notas
npm run versao:minor                # revise o CHANGELOG: é o que as pessoas leem
npm run versao:tag
git push origin main
git push origin v1.7.0              # dispara o "Release Android" (T5)
```

O workflow só publica se a assinatura for a de produção e o banco embutido for o de
produção. Sem o Actions, use a contingência do `VERSIONAMENTO.md`. **Nunca os dois
caminhos para a mesma tag.**

## 6. ⚠️ Reinstalação nos celulares (uma única vez)

A 1.6.0 foi assinada com a chave de debug; a 1.7.0 usa a de produção, e o Android recusa
instalar por cima ([`RELEASE-SIGNING.md`](RELEASE-SIGNING.md)). Em cada aparelho:

1. **Primeiro o admin, depois professores e alunos.**
2. **Desinstalar o Snake Thai e instalar a 1.7.0.** A sessão salva no aparelho se perde;
   os dados ficam no servidor.
3. **Entrar de novo.** Conferir no Perfil a versão **1.7.0** e, no admin, a aba **Painel**.

Guarde o APK 1.6.0: se a 1.7.0 tiver um problema grave, dá para voltar, com outra
desinstalação.

## 7. Configuração inicial e limpeza (com a 1.7.0 instalada)

- [ ] **Dados de demonstração:** decidir e fazer a limpeza com backup antes do primeiro
  aluno real (T1). Informar qual e-mail é a conta real de admin.
- [ ] **Chave PIX real** em Configurações.
- [ ] **Grade semanal real** de cada turma (Dados → Turmas e grade semanal).
  - As aulas futuras de demonstração no mesmo dia e hora seriam adotadas pela grade.
- [ ] **Prazo de guarda das imagens de comprovante** (T7, recomendação: 90 dias), só com
  aprovação: `update public.academy_settings set proof_retention_days = 90;`
- [ ] **Cron Job de limpeza de mídia na Render:** conferir se existe (sem ele, nenhum
  arquivo é apagado de fato).
- [ ] **Push e Sentry:** ligar só depois de publicar a Política de Privacidade (L4).

## 8. Acompanhamento de 48 horas

- **Painel do admin:** um aviso de "rotina automática falhou" mostra qual rotina.
  Detalhe no SQL:

  ```sql
  select j.jobname, d.status, d.return_message, d.start_time
    from cron.job_run_details d join cron.job j using (jobid)
   where d.status = 'failed' order by d.start_time desc limit 10;
  ```

- **No dia seguinte:** `generate-scheduled-classes` com `succeeded` (se já houver grade)
  e, no dia 1, `generate-monthly-payments`.
- **Sentry** (se ligado): erros novos da 1.7.0.
- **Exclusão de conta:** testar com uma conta de teste que a senha errada é recusada.
- **Aceites** (se os textos foram publicados): quem ainda não aceitou, pela consulta em
  [`legal/README.md`](legal/README.md).

## O que ainda depende de decisão sua

| Decisão | Recomendação | Onde |
|---|---|---|
| Limpeza dos dados de demonstração | Backup e limpeza antes do primeiro aluno real | T1 |
| Prazo de guarda das imagens de comprovante | 90 dias | T7 |
| Grade real de cada turma | Cadastrar pelo app depois da 1.7.0 | T6 |
| Texto da Política de Privacidade e dos Termos de Uso | Preencher os campos e aprovar com apoio jurídico | L4 |
| Consentimento do responsável por aluno menor de idade | Definir com o jurídico; o app ainda não cadastra responsável | L4 |
| Contas Expo, Firebase e Sentry | Depois da política | T9, T10 |
| Build pelo Actions ou pelo `menu.bat` | Actions | T5 |
| Merge do PR #16 do `snake-server` (deploy na Render) | Pode ser independente da 1.7.0 | T1 |
