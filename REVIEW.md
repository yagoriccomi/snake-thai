# 🔍 Relatório de Auditoria e Revisão de Código

> ✅ **Os três achados críticos foram corrigidos e reverificados** — ver
> `## Correções aplicadas` ao final. O relatório abaixo preserva o diagnóstico
> original, com a evidência de exploração de cada um.
>
> **Projeto:** Snake Thai — gestão de alunos de academia
> **Data:** 2026-08-19 · **Branch:** `feat/financial-module` · **Commit:** `00227bd`
> **Escopo:** base completa (app React Native, migrations SQL, Edge Functions Deno)

```text
🧠 CHECKPOINT DE COBERTURA
- Autenticação/Autorização ....... [LIDO] src/context/AuthProvider.tsx, src/services/auth.service.ts
- Políticas de acesso (RLS) ...... [LIDO] pg_policies consultado no banco real; 10 tabelas
- Acesso a dados ................. [LIDO] src/services/*.ts (8 serviços)
- Configuração / segredos ........ [LIDO] .env.example, src/config/env.ts, .gitignore
- Edge Functions ................. [LIDO] create-student, reset-student-password
- Storage (comprovantes PIX) ..... [LIDO] políticas do bucket payment_proofs
- Pontos de log com PII .......... [LIDO] src/lib/logger.ts + audit_log (testado no banco)
- Docker / CI-CD ................. [NÃO ENCONTRADO] projeto sem Dockerfile (correto: RN exige
                                    SDK do host) e SEM pipeline de CI — ver Risco Médio
Stack confirmada: React Native 0.86 + Expo SDK 57 · TypeScript estrito · Supabase
Lacunas: nenhuma. Achados de acesso foram PROVADOS contra a API real, não inferidos.
```

## 📊 Resumo Executivo

A base está **saudável na estrutura e frágil num ponto específico de autorização**.
Os pontos fortes são reais: RLS habilitada nas 10 tabelas, nenhum segredo no
código, senha sob o GoTrue (bcrypt), sessão persistida cifrada em AES-256,
queries sempre parametrizadas pelo cliente tipado (SQL Injection não se aplica),
125 testes verdes e log com mascaramento de PII.

O problema é de **Broken Access Control** e nasceu de uma omissão minha nesta
mesma rodada: as colunas `status` e `plan_id` foram adicionadas a `profiles`
depois que o trigger de proteção foi escrito, e ninguém atualizou a lista de
campos protegidos. **Confirmei explorando de verdade**, com um token de aluno
comum: ele trancou a própria matrícula e migrou o próprio plano.

**Nível de risco atual: ALTO** — não pelo volume de achados, mas porque um deles
tem consequência financeira direta e é explorável hoje, com o app publicado.

---

## 🚨 Risco Crítico (Segurança e LGPD)

### 1. Aluno altera o próprio plano e o próprio status da matrícula

**Broken Access Control (OWASP A01)** — quebra a prática **[#55]** (menor privilégio).

A política `profiles_update_own_or_admin` permite que o titular atualize a
própria linha, e o trigger `enforce_profile_update_rules` é quem restringe
**quais colunas**. A lista dele cobre `id`, `role`, `cpf` e `created_at` — mas
as colunas `status`, `deactivated_at` e `plan_id`, criadas na migration
`20260819140000` / `20260819160000`, **ficaram de fora**.

**Onde está:** `supabase/migrations/20260819130000_service_role_is_admin.sql:34-40`
(corpo do trigger) combinado com `20260819160000_roles_status_and_audit.sql:22-28`
(colunas novas) e `20260819140000_plans_and_payment_amounts.sql:98-101`.

**Prova de exploração** (token de aluno comum, sem privilégio):

```text
PATCH /rest/v1/profiles?id=eq.<aluno>  {"role":"admin"}
  → 42501 Operação negada  ✅ bloqueado (controle do teste)

PATCH /rest/v1/profiles?id=eq.<aluno>  {"status":"inactive"}
  → 200 OK                 ❌ ACEITO

PATCH /rest/v1/profiles?id=eq.<aluno>  {"plan_id":"<plano>"}
  → 200 OK                 ❌ ACEITO
```

**Impacto:** o aluno migra sozinho para o plano mais barato (ou para um de
cortesia) e paga menos; ou se marca como inativo para sumir das cobranças e dos
relatórios de inadimplência. É prejuízo financeiro direto, silencioso, e a
academia só descobre no fechamento do mês.

**Como corrigir** — nova migration ampliando a lista protegida:

```sql
create or replace function public.enforce_profile_update_rules()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if public.is_admin() then return new; end if;

  if new.id <> old.id
     or new.role <> old.role
     or (old.cpf is not null and new.cpf is distinct from old.cpf)
     or new.created_at <> old.created_at
     -- Colunas de negócio: quem decide plano e matrícula é a academia.
     or new.status is distinct from old.status
     or new.deactivated_at is distinct from old.deactivated_at
     or new.plan_id is distinct from old.plan_id then
    raise exception 'Operação negada: campo restrito ao administrador.'
      using errcode = '42501';
  end if;
  return new;
end; $$;
```

> **Lição estrutural:** a lista de campos protegidos é uma *denylist*, e denylist
> envelhece mal — toda coluna nova nasce desprotegida por padrão. O correto a
> médio prazo é inverter para *allowlist*: o aluno só pode alterar `name`,
> `phone`, `dob` e `is_first_login`; qualquer outra diferença é recusada.

### 2. Trilha de auditoria grava PII em claro

Quebra a prática **[#63]** (mascaramento de PII) — LGPD art. 6º (necessidade).

O gatilho `record_audit()` grava o par antes/depois de **todos** os campos
alterados. Quando o aluno atualiza telefone ou CPF, o dado pessoal é copiado
para `audit_log`, tabela que o administrador lê integralmente.

**Onde está:** `supabase/migrations/20260819160000_roles_status_and_audit.sql:118-127`.

**Prova** (executada no banco):

```json
{"phone": {"de": "11976543210", "para": "11999998888"}}
```

**Impacto:** multiplica a superfície de exposição do dado pessoal e — pior —
**sobrevive à exclusão do titular**, porque `audit_log.actor_id` é
`ON DELETE SET NULL` e a coluna `changes` permanece intacta. Na prática, apagar
a conta não apaga o telefone.

**Como corrigir:** mascarar os campos sensíveis dentro do gatilho, registrando
que houve mudança sem registrar o conteúdo:

```sql
-- dentro de record_audit(), antes do insert
campos_alterados := (
  select jsonb_object_agg(
    chave,
    case when chave in ('cpf','phone','dob')
         then '"[alterado]"'::jsonb
         else valor end)
  from jsonb_each(campos_alterados) as t(chave, valor)
);
```

### 3. Não existe fluxo de exclusão dos dados do titular

LGPD art. 18, VI (eliminação) — **a ausência é, por si só, achado crítico**.

A portabilidade foi implementada (`public.export_my_data()`,
`20260819150000_academy_settings_and_lgpd.sql:107`), mas **não há** contraparte
de exclusão. O titular não consegue pedir a remoção pelo app, e não existe
procedimento server-side para atender ao pedido.

**Onde está:** ausência em `supabase/migrations/` e em `supabase/functions/`.

**Como corrigir:** Edge Function `delete-my-account` que, com `service_role`,
(a) anonimiza `profiles` do titular — `name`, `cpf`, `phone`, `dob` a `null`,
(b) preserva os registros financeiros exigidos por obrigação legal/fiscal, já
desvinculados, e (c) remove o usuário de `auth.users`. O `on delete cascade` já
existente cuida de `attendance` e `consents`.

---

## 🐛 Risco Alto (Bugs e Arquitetura)

* **Nenhum achado novo nesta categoria.**

O bug de descrição de plano gravada como string vazia em vez de `null`
(`?? null` não cobre `''` pós-`trim`) foi encontrado pela suíte de testes desta
mesma rodada e **já corrigido** em `src/services/plans.service.ts:117-123` [#3].

A separação de camadas está respeitada [#22]: nenhuma tela importa `supabase`
diretamente — todo acesso passa por `src/services/`, com hooks intermediando
estado. Tipagem estrita sem `any` nas fronteiras [#11].

---

## ⚠️ Risco Médio (Performance e Infraestrutura)

### 1. Nenhuma listagem tem paginação

Quebra a prática **[#67]** (paginação incondicional).

`fetchAllStudents`, `fetchPlans`, `fetchGroups`, `fetchStudentPayments` e as
consultas de `classes.service.ts` usam `select('*')` sem `range()` nem `limit()`.

**Onde está:** `src/services/classes.service.ts:29,50,85,124,139`,
`src/services/groups.service.ts:9`, `src/services/payments.service.ts:22`,
`src/services/profile.service.ts` (`fetchAllStudents`).

**Impacto:** hoje é irrelevante — 10 alunos e 65 aulas. Com 500 alunos e dois
anos de histórico, a tela de gestão passa a baixar tudo a cada abertura,
consumindo dados móveis do administrador e travando a lista na renderização.
O teto padrão do PostgREST (1000 linhas) mascara o problema até virar dado
truncado silenciosamente.

**Solução:** paginar por `range()` com rolagem infinita nas listas de alunos,
pagamentos e histórico de aulas — as três que crescem sem limite.

### 2. Edge Functions sem limitação de taxa

Quebra a prática **[#58]** (rate limiting).

`create-student` e `reset-student-password` verificam autorização corretamente,
mas nada impede que um administrador comprometido — ou um token vazado — dispare
milhares de chamadas, criando contas em massa ou redefinindo senhas em lote.

**Onde está:** `supabase/functions/create-student/index.ts:38`,
`supabase/functions/reset-student-password/index.ts:41`.

**Solução:** contador por `caller.user.id` em janela deslizante (tabela ou
Upstash/Redis), recusando com 429 acima do limite.

### 3. Nenhuma esteira de CI

Quebra as práticas **[#49]** e **[#76]** (testes no pipeline; integração contínua).

Existem 125 testes e um `pre-commit` com typecheck, mas o gate é **local**: um
`--no-verify` ou um push de outra máquina entra sem verificação.

**Onde está:** ausência de `.github/workflows/`.

**Solução:** é a etapa 10 do roadmap em andamento (`configurar-ci-cd-projeto`).

---

## 💡 Risco Baixo (Clean Code e Dívida Técnica)

* **Constantes órfãs mantidas por compatibilidade.** `DEFAULT_STUDENT_PASSWORD`
  e `ACADEMY_PIX_KEY` seguem no código como fallback de boot, já marcadas
  `@deprecated` com o motivo documentado. Recomendação: remover quando o
  carregamento das configurações virar bloqueante no boot [#12].

* **Ausência de índice em `payments.due_date`.** Os relatórios de inadimplência
  filtrarão por vencimento; hoje há índice em `(status, paid_at)` e em
  `plan_id`, mas não em `due_date` [#71]. Sem impacto no volume atual.

* **`logo_url` sem upload correspondente.** A coluna existe em
  `academy_settings`, mas a tela de Configurações não oferece envio de imagem —
  o campo fica inalcançável pela interface. Está registrado como pendência em
  `docs/FUNCIONALIDADES.md`.

---

## ✅ Plano de Ação Imediato

1. **Fechar a brecha de `status`/`plan_id`** (Crítico 1) — migration ampliando o
   trigger. É o único achado explorável hoje e com custo financeiro direto.
2. **Mascarar PII no `audit_log`** (Crítico 2) — o dado pessoal não pode
   sobreviver à exclusão da conta.
3. **Implementar `delete-my-account`** (Crítico 3) — obrigação legal, e requisito
   para vender o sistema a terceiros sem transferir o risco ao cliente.
4. **Paginar as três listas que crescem** (Médio 1) — antes do primeiro cliente
   com centenas de alunos, não depois.
5. **Subir a esteira de CI** (Médio 3) — já previsto no roadmap.

---

### O que foi verificado e está correto

Registrado para não ser reauditado à toa:

| Verificação | Resultado |
| --- | --- |
| SQL Injection [#52] | Não aplicável — cliente tipado, queries parametrizadas |
| Segredos no código [#37] | Nenhum; `.env` ignorado, chaves via ambiente |
| Senha [#54] | bcrypt pelo GoTrue; app nunca armazena senha |
| Sessão [#56] | AES-256 com chave no Keychain/Keystore |
| RLS | Ativa nas 10 tabelas, com política em cada uma |
| Escalada para admin | Bloqueada — testada contra a API real |
| Storage de comprovantes | 4 políticas; leitura restrita ao dono ou admin |
| PII em log de aplicação [#63] | Mascarada em `src/lib/logger.ts:24-38` |
| Portabilidade LGPD | `export_my_data()` respeitando RLS |
| Dinheiro [#3] | Centavos em `integer`; nenhum float em cálculo financeiro |


---

## ✅ Correções aplicadas (mesma sessão)

### Crítico 1 — controle de acesso · `20260819170000_harden_profile_updates.sql`

A lista de proibidos virou **lista de permitidos**: o titular só altera `name`,
`phone`, `dob` e `is_first_login`. Qualquer outra diferença é recusada nomeando
o campo. Coluna nova passa a nascer restrita ao administrador — o padrão agora
é negar.

Reexecutei o mesmo exploit:

```text
{"status":"inactive"} → 42501 Operação negada: o campo "status" só pode ser
                               alterado por um administrador   ✅ FECHADO
{"plan_id":"..."}     → 42501 Operação negada: o campo "plan_id" ...   ✅ FECHADO
{"phone":"..."}       → 200 OK  ✅ sem regressão (o aluno segue editando o seu)
```

### Crítico 2 — PII na auditoria · mesma migration

Campos pessoais entram como `{"alterado": true}`. A trilha continua provando que
houve mudança, sem copiar o conteúdo. As linhas gravadas em claro **antes** da
correção foram expurgadas pela própria migration.

Verificado: `{"phone": {"alterado": true}}`.

### Crítico 3 — exclusão do titular · `delete-my-account` + `20260819180000`

Edge Function publicada, exigindo confirmação explícita no corpo. Durante o teste
descobri um erro grave na **primeira versão da própria função**: ela chamava
`auth.admin.deleteUser`, e a cadeia `auth.users → profiles → payments` é toda
`ON DELETE CASCADE`. Ou seja, apagaria todo o histórico financeiro — o oposto do
que a mensagem de sucesso prometia ao usuário.

A versão corrigida não apaga a linha de autenticação: substitui o e-mail por um
identificador aleatório, troca a senha por outra que ninguém conhece e bane a
conta. Não sobra dado pessoal nem porta de entrada.

Também foi preciso criar a coluna `profiles.anonymized_at`, porque a constraint
`profiles_complete_when_onboarded` exige nome e CPF em perfil integrado. A saída
preguiçosa seria marcar `is_first_login = true`, mas isso mentiria no modelo — a
pessoa não está aguardando onboarding, ela saiu. Estado mal representado vira
relatório errado depois.

Verificado de ponta a ponta, com um titular que tinha um pagamento quitado:

| Verificação | Resultado |
| --- | --- |
| Nome, CPF, telefone e nascimento | ✅ apagados |
| E-mail em `auth.users` | ✅ `removido-<uuid>@anonimizado.invalid` |
| Conta banida | ✅ sim |
| Login com a senha antiga | ✅ recusado |
| **Histórico financeiro** | ✅ **preservado** — 1 pagamento, 12990 centavos |

**Permanecem abertos:** os achados de Risco Médio (paginação, rate limiting nas
Edge Functions e esteira de CI) e os de Risco Baixo. Nenhum é explorável hoje.

---

# 🔍 Auditoria — Rodada 2026-08-31 (migração dos comprovantes para a Cloudinary)

**Escopo:** o que mudou na branch `feature/comprovantes-cloudinary` e o par dela no app
(`snake-thai@feat/comprovantes-cloudinary`): a migration do contrato de comprovante, o
script de migração de dados, `src/modules/proofs/`, e no app `src/lib/api.ts` e
`src/services/proofs.service.ts`.

## 📊 Resumo Executivo

A migração está bem construída — contrato de dados explícito e validado por constraint,
convivência preservada para os APKs antigos, 204 testes no servidor (96,9% de cobertura)
e 170 no app. **Mas o deploy NÃO deve sair como está:** a troca do Supabase Storage pela
Cloudinary removeu, sem substituto, uma barreira de autorização que existia na camada de
armazenamento — e isso abre um IDOR sobre dado financeiro de terceiros (C-2).

Há também um achado **anterior a esta rodada**, encontrado de passagem, que é mais grave
em termos de negócio: um aluno consegue alterar o valor da própria mensalidade (C-3).

**Não auditado:** as políticas de RLS **em produção**. Só foi possível ler o que está
versionado em `supabase/migrations/`; o que efetivamente roda no projeto hospedado pode
divergir. A pendência P-10 continua aberta.

## 🔥 Top 5 Causas de Vazamento — veredicto

| # | Causa | Veredicto | Evidência | Prática |
|---|-------|-----------|-----------|---------|
| V1 | Banco sem RLS / regras abertas | ✅ PROTEGIDO | `init_schema.sql:247-330`; `media_deletion_queue` nega `authenticated` por padrão (verificado no Postgres local) | [#55][#87] |
| V2 | Autorização decidida no front-end | ✅ PROTEGIDO | `AuthProvider.tsx:74` só esconde botão; a decisão real é `public.is_admin()` no banco | [#51][#56] |
| V3 | IDOR (ID sem checagem de dono) | 🚨 **VULNERÁVEL** | `src/modules/proofs/proofs.service.ts` — ver **C-2** | [#55] |
| V4 | Segredo chumbado no código/Git | ✅ PROTEGIDO | varredura de padrões sem ocorrência; `.env` ignorado e **não rastreado** nos dois repos | [#37][#80] |
| V5 | Input sem tratamento (XSS) | ➖ NÃO SE APLICA | React Native não renderiza HTML; zero `innerHTML`/`eval`/`dangerouslySetInnerHTML` nos dois repos. Entrada validada por Zod na borda do servidor | [#51][#53] |

## 🚨 Risco Crítico (Segurança e LGPD)

### C-2 — IDOR: o servidor assina o `public_id` que o próprio aluno gravou

* **O problema:** `obterUrlDeVisualizacao` usa o `proof_public_id` **lido do banco** para
  gerar a URL assinada. Essa coluna é gravável pelo aluno no próprio pagamento: a RLS
  permite (a linha é dele) e o trigger `enforce_payment_update_rules` não a bloqueia.

  Ataque, com o token de um aluno comum:
  1. `PATCH /rest/v1/payments?id=eq.<pagamento-proprio>` com
     `proof_public_id = "comprovantes/<user_de_outro>/<pagamento_de_outro>"` e
     `proof_provider = "cloudinary"` — a constraint de coerência é satisfeita;
  2. `POST /v1/proofs/view-url { paymentId: <pagamento-proprio> }`;
  3. `conferirDono` **passa** (o pagamento é mesmo dele) e o servidor assina o
     comprovante do outro titular.

  **Por que isto não existia antes:** no Supabase Storage a defesa não era do app — era
  da RLS de `storage.objects`, que compara `(storage.foldername(name))[1]` com
  `auth.uid()`. Um caminho adulterado morria ali. A Cloudinary não tem RLS: ao trocar de
  provedor, a barreira sumiu e nada ocupou o lugar dela.

* **Onde está:** `src/modules/proofs/proofs.service.ts` (`obterUrlDeVisualizacao`, uso de
  `pagamento.proof_public_id`).
* **Impacto LGPD:** acesso não autorizado a dado pessoal financeiro de outro titular
  (art. 46 — falha de segurança). O comprovante PIX carrega nome, banco e valor.
* **Como corrigir:** parar de **ler** o identificador e passar a **derivá-lo**. Ele já é
  determinístico e o servidor tem as duas metades verificadas:

  ```ts
  // Não confie no que o cliente pôde gravar: derive do que você verificou. [#55]
  const publicId = `${PASTA_COMPROVANTES}/${pagamento.user_id}/${paymentId}`;
  return deps.midia.gerarUrlDeVisualizacao(publicId);
  ```

  O `proof_public_id` continua útil como **flag** ("existe comprovante?"), mas deixa de
  ser a fonte do caminho. Assim, mesmo com a linha adulterada, a URL assinada aponta
  sempre para o comprovante correto.

* **Defesa complementar (recomendada):** bloquear a escrita direta dessas colunas pelo
  aluno no trigger, deixando-as por conta do fluxo do servidor. Ver **A-2**.

### C-3 — Aluno pode alterar o valor da própria mensalidade (anterior a esta rodada)

* **O problema:** `enforce_payment_update_rules` é uma **blacklist** — proíbe `id`,
  `user_id`, `plan_id`, `due_date` e `created_at`. A coluna `amount_cents` foi
  acrescentada **depois** e nunca entrou na lista.

  Com o token de um aluno comum:
  `PATCH /rest/v1/payments?id=eq.<pagamento-proprio>` com `{ "amount_cents": 1 }`.
  A RLS permite (é o pagamento dele) e o trigger não reclama. A dívida cai para R$ 0,01.

  O valor adulterado passa a alimentar a tela do admin e o indicador "recebido no mês"
  (`fetchReceivedThisMonthCents` soma `amount_cents`).

* **Onde está:** `snake-thai/supabase/migrations/20260727160200_system_context_triggers.sql:24-31`
  (coluna criada em `20260819140000_plans_and_payment_amounts.sql:63`).
* **Como corrigir:** inverter a lógica para **whitelist** — o aluno só pode tocar nas
  colunas do fluxo de comprovante e no `status` (limitado a `pending_approval`); qualquer
  outra diferença entre `new` e `old` é negada. Isso conserta `amount_cents` **e** impede
  que a próxima coluna nasça desprotegida.

## 🐛 Risco Alto (Bugs e Arquitetura)

### A-2 — A blacklist do trigger faz toda coluna nova nascer sem proteção

* **Explicação:** é a causa-raiz de C-3, e as três colunas de comprovante desta rodada
  entraram pelo mesmo buraco (nelas o efeito é desejado, o que mascara o problema).
  Uma lista de proibições precisa ser lembrada a cada `alter table`; uma lista de
  permissões falha fechado. [#55]
* **Onde está:** `20260727160200_system_context_triggers.sql:13-40`.
* **Como refatorar:** whitelist explícita, com o conjunto de colunas do fluxo do aluno
  declarado no próprio trigger. Toda coluna futura fica negada por padrão até que alguém
  decida o contrário — que é a decisão certa para uma tabela financeira.

## ⚠️ Risco Médio (Performance e Infraestrutura)

* **`scripts/migrar-comprovantes.ts` usa `SUPABASE_SERVICE_ROLE_KEY`.** O isolamento está
  correto (programa separado, fora do servidor web, documentado no cabeçalho), e o
  servidor continua sem a chave. Ainda assim é o único ponto do repositório que a exige:
  ela deve ser exportada só na sessão de terminal que roda a migração e **nunca**
  cadastrada na Render. [#55]
* **Fila de exclusão sem consumidor.** `media_deletion_queue` é alimentada por gatilho,
  mas nada a processa ainda — os arquivos continuam no provedor até que o worker exista.
  A obrigação de eliminar (art. 16, I) só se cumpre quando ele rodar.

## 💡 Risco Baixo (Clean Code e Dívida Técnica)

* **Mensagem de erro do trigger desatualizada:** diz "aluno só pode alterar proof_url e
  status", mas agora são quatro colunas de comprovante. Mensagem que descreve errado o
  sistema atrapalha o diagnóstico. [#1]
* **`Linking.openURL(signedUrl)`** (`ComprovanteScreen.tsx:154`) abre uma URL vinda do
  servidor. Risco baixo (origem controlada), mas vale validar o esquema `https` antes de
  abrir, já que o valor passa por um provedor externo.

## ✅ Plano de Ação Imediato

1. **C-2** — derivar o `public_id` do par verificado em vez de ler o gravado.
   Bloqueia o deploy: é vazamento de PII financeira entre titulares.
2. **C-3 + A-2** — migration convertendo o trigger para whitelist, fechando `amount_cents`
   e impedindo que colunas futuras nasçam abertas.
3. **Testes de regressão** para os dois: um aluno tentando ler comprovante alheio via
   `public_id` adulterado, e um aluno tentando baixar o próprio `amount_cents`.
4. **Worker da fila de eliminação**, sem o qual a promessa de exclusão da LGPD não se
   cumpre de fato.
5. **P-10** — confirmar no Supabase de produção que as políticas realmente batem com as
   migrations versionadas.
