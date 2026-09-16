# Referência das Edge Functions — Snake Thai

> Funções Deno hospedadas no Supabase. Existem porque cada uma precisa da
> `service_role` (que ignora a RLS) — e essa chave **nunca** pode viver no app.
> Todas verificam, pelo JWT de quem chama, a identidade e o papel.
>
> Base URL: `https://<PROJECT_REF>.supabase.co/functions/v1/`
> Todas exigem os headers `apikey: <anon key>` e `Authorization: Bearer <jwt>`.
> Deploy (só com aprovação, sempre com o projeto explícito):
> `npx supabase functions deploy <nome> --project-ref <PROJECT_REF>`.

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
{ "confirmacao": "EXCLUIR MINHA CONTA", "senha": "<senha atual>" }
```

A `confirmacao` exata e a **senha atual** são obrigatórias: a senha é conferida no
servidor, para um celular desbloqueado na mão de outra pessoa não apagar a conta.

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true, "comprovantes": n, "justificativas": n, "message": "..." }` | conta excluída |
| `400` | `{ "error": "Envie confirmacao: ..." }` | confirmação ausente/errada |
| `401` | `{ "error": "Sessão inválida" }` / `{ "error": "Senha incorreta" }` | sem sessão / senha errada |
| `403` | `{ "error": "Contas de administrador são removidas por outro administrador" }` | chamador é admin |
| `404` | `{ "error": "Perfil não encontrado" }` | perfil inexistente |
| `500` | `{ "error": "Não foi possível excluir a conta agora. Tente novamente." }` | falha; repetir é seguro |

**O que acontece, e por que assim** (`_shared/anonimizar-conta.ts`):

1. `anonimizar_titular(usuario, solicitante)` — **uma transação no banco**: nome,
   CPF, telefone, nascimento, turma e plano apagados; `anonymized_at` marcado;
   imagens de comprovante enfileiradas para eliminação no provedor (o registro do
   pagamento fica); justificativas de falta apagadas (o anexo vai para a fila);
   consentimentos apagados; professor sai das aulas **futuras**; auditoria com
   quem pediu. Chamar de novo devolve `ja_anonimizado` sem refazer nada.
2. **Não** chama `deleteUser`: `auth.users → profiles → payments` é `ON DELETE
   CASCADE` e levaria o financeiro. O e-mail vira um identificador aleatório, a
   senha vira uma que ninguém conhece e a conta é **banida**; as sessões de todos
   os aparelhos são encerradas.

Verificado no Supabase local (2026-09-16): login recusado depois, e-mail original
fora de `auth.users` e `auth.identities`, nenhuma sessão restante, pagamentos
preservados.

---

## `delete-user-account`

O **administrador** exclui a conta de um aluno ou professor (por exemplo, a pedido
feito na recepção). Mesma regra da autoexclusão.

**Requisição**

```json
POST /functions/v1/delete-user-account
{ "userId": "<uuid>", "confirmacao": "EXCLUIR CONTA" }
```

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true, "ja_anonimizado": false, "comprovantes": n, "justificativas": n }` | conta excluída (ou já estava: `ja_anonimizado: true`) |
| `400` | `{ "error": "..." }` | confirmação errada, `userId` inválido ou o próprio admin |
| `401` | `{ "error": "Sessão inválida" }` | sem sessão |
| `403` | `{ "error": "Acesso restrito a administradores" }` / `{ "error": "Rebaixe o administrador antes de excluir a conta." }` | chamador não é admin / alvo é admin |
| `404` | `{ "error": "Usuário não encontrado." }` | alvo inexistente |
| `500` | `{ "error": "Não foi possível excluir a conta agora. Tente novamente." }` | falha; repetir é seguro |

---

## `admin-update-user-email`

O **administrador** corrige o e-mail de login de um aluno ou professor (o e-mail
vive só no Auth). O e-mail novo já nasce confirmado.

**Requisição**

```json
POST /functions/v1/admin-update-user-email
{ "userId": "<uuid>", "email": "novo@exemplo.com" }
```

**Respostas**

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{ "success": true, "email": "novo@exemplo.com" }` | e-mail trocado |
| `400` | `{ "error": "E-mail inválido" }` / `{ "error": "Identificador de usuário inválido" }` | entrada inválida |
| `403` | `{ "error": "Acesso restrito a administradores" }` | chamador não é admin |
| `404` | `{ "error": "Usuário não encontrado" }` | alvo inexistente |
| `409` | `{ "error": "Este e-mail já está cadastrado em outra conta" }` / `{ "error": "Esta conta foi excluída" }` | e-mail em uso / conta anonimizada |

O e-mail em uso é conferido **antes** por `email_ja_cadastrado()` (só `service_role`):
o Auth responde duplicata com um 500 genérico que o supabase-js não distingue de uma
falha real.

---

## `create-staff`

O **administrador** cadastra professor ou administrador já com nome e CPF (e a cor, no
caso do professor). A pessoa ainda troca a senha padrão e aceita os termos no primeiro
acesso. Contrato em `supabase/functions/create-staff/index.ts`.
