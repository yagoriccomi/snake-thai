# Referência das Edge Functions — Snake Thai

> Funções Deno hospedadas no Supabase. Existem porque cada uma precisa da
> `service_role` (que ignora a RLS) — e essa chave **nunca** pode viver no app.
> Todas verificam, pelo JWT de quem chama, a identidade e o papel.
>
> Base URL: `https://<PROJECT_REF>.supabase.co/functions/v1/`
> Todas exigem os headers `apikey: <anon key>` e `Authorization: Bearer <jwt>`.
> Deploy: `supabase functions deploy <nome>`.

Fonte: [`supabase/functions/`](../supabase/functions/).

---

## `create-student`

Cria a conta de autenticação de um aluno novo e inicializa o perfil pendente de
onboarding.

**Autorização:** o chamador precisa ser `admin` (verificado pelo JWT + consulta
a `profiles`). Sem token → `401`. Token de aluno → `403`.

**Requisição**

```json
POST /functions/v1/create-student
{
  "email": "aluno@exemplo.com",
  "groupId": "turma-manha"          // opcional; turma inicial do aluno
}
```

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true, "userId": "<uuid>" }` | conta criada |
| `400` | `{ "error": "E-mail inválido" }` | e-mail malformado |
| `401` | `{ "error": "Não autenticado" }` | sem `Authorization` |
| `403` | `{ "error": "Acesso restrito a administradores" }` | chamador não é admin |

A conta nasce com a **senha padrão** (`academy_settings.default_student_password`)
e `is_first_login = true`. Se a criação do perfil falhar, a função faz rollback
da conta de auth — não deixa usuário órfão.

---

## `reset-student-password`

Redefine a senha de um aluno para a padrão e o devolve ao onboarding.

**Autorização:** só `admin`. **O admin não pode redefinir a própria senha por
aqui** — para isso existe a troca autenticada no app, que exige a senha atual.

**Requisição**

```json
POST /functions/v1/reset-student-password
{ "userId": "<uuid do aluno>" }
```

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true }` | senha redefinida |
| `400` | `{ "error": "Identificador de usuário inválido" }` | `userId` não é UUID |
| `400` | `{ "error": "Use a troca de senha do seu perfil..." }` | admin tentou em si mesmo |
| `403` | `{ "error": "Acesso restrito a administradores" }` | chamador não é admin |
| `404` | `{ "error": "Usuário não encontrado" }` | `userId` não existe |

Após o reset, a senha volta a ser a padrão e `is_first_login` fica `true`: o
aluno é obrigado a definir uma senha própria no próximo acesso. A senha padrão
nunca se torna definitiva.

---

## `delete-my-account`

Exclui a conta do **próprio** titular (LGPD art. 18, VI). Anonimiza os dados
pessoais e encerra o acesso, **preservando o histórico financeiro** por
obrigação fiscal.

**Autorização:** qualquer usuário autenticado, mas só sobre a **própria** conta
(identificada pelo JWT — não recebe `userId`). Contas `admin` são recusadas:
devem ser removidas por outro administrador.

**Requisição**

```json
POST /functions/v1/delete-my-account
{ "confirmacao": "EXCLUIR MINHA CONTA" }
```

A `confirmacao` exata é obrigatória — evita exclusão por toque acidental.

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true, "message": "..." }` | conta excluída |
| `400` | `{ "error": "Envie confirmacao: ..." }` | confirmação ausente/errada |
| `403` | `{ "error": "Contas administrativas devem ser removidas..." }` | chamador é admin |
| `404` | `{ "error": "Perfil não encontrado" }` | perfil inexistente |

**O que a função faz, e por que assim:**

1. Anonimiza `profiles`: nome, CPF, telefone, nascimento → nulos; marca
   `anonymized_at`. A linha **permanece** para os pagamentos continuarem íntegros.
2. **Não** chama `deleteUser`. A cadeia `auth.users → profiles → payments` é toda
   `ON DELETE CASCADE`: apagar a conta derrubaria o financeiro. Em vez disso,
   troca o e-mail por um identificador aleatório, redefine a senha e **bane** a
   conta. Não sobra dado pessoal nem porta de entrada.
3. Remove `consents` (não têm valor fiscal).

Verificado de ponta a ponta em `SECURITY.md`: PII apagada, login recusado,
pagamento preservado.
