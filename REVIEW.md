# 🔍 Relatório de Auditoria e Revisão de Código

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
