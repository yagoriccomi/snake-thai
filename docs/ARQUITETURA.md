# Arquitetura — Snake Thai

> Para desenvolvedores. Se você acabou de chegar ao projeto, leia isto antes de
> tocar em qualquer arquivo. Ele explica **por que** as coisas são como são, não
> só o que elas são.

## O que o sistema é

Um app mobile (React Native + Expo) que uma academia usa para gerir alunos,
turmas, presença e mensalidades pagas por PIX. O diferencial de projeto: o
**cliente que compra o sistema opera sozinho** — não há painel web separado nem
dependência do desenvolvedor para o dia a dia. Toda administração acontece no
mesmo app, sob um papel de `admin`.

O backend é **Supabase** (Postgres + Auth + Storage + Edge Functions). Não há
servidor de API próprio: o app fala direto com o Supabase, e a segurança vem das
**políticas de RLS no banco**, não de uma camada intermediária.

## As três camadas do app [#22]

O código do app segue uma separação estrita. A regra mais importante do projeto,
e a primeira coisa a respeitar:

> **Nenhuma tela (`screen`) importa o cliente `supabase` diretamente.**

O acesso a dados desce por três camadas, cada uma com uma responsabilidade:

```
  screens/          O que o usuário vê. Renderiza e coleta input. Não sabe SQL.
     │  usa
     ▼
  hooks/            Estado e orquestração. Carrega, guarda em cache, expõe
     │  chama       loading/error/reload. É a ponte entre tela e dados.
     ▼
  services/         Regra de negócio + a ÚNICA camada que fala com o supabase.
     │  consulta    Converte input de domínio na forma da tabela e vice-versa.
     ▼
  Supabase (Postgres com RLS, Auth, Storage, Edge Functions)
```

Por que essa disciplina: se amanhã o backend mudar, ou uma query precisar de
ajuste, o impacto fica contido em `services/`. A tela não precisa saber se o dado
veio do Supabase, de um cache ou de outro lugar. E os testes conseguem mockar
`services/` sem renderizar nenhuma tela.

**Exemplo do caminho completo** (criar um plano):

| Camada | Arquivo | Papel |
| --- | --- | --- |
| screen | `PlanosScreen.tsx` | formulário, validação de UI, chama o hook |
| hook | `usePlans.ts` | estado da lista, `add()`, `reload()`, `error` |
| service | `plans.service.ts` | `createPlan()` — converte para centavos, insere |
| banco | migration `plans` | RLS: só `admin` insere |

## Segurança no banco (RLS) — a espinha dorsal

Como o app fala direto com o Postgres, **toda** proteção de acesso vive em
políticas de Row Level Security. Não há "if (isAdmin)" no app que proteja dado:
o app pode ter bugs, mas o banco recusa a operação de qualquer jeito.

Princípios aplicados nas 10 tabelas:

- **Cada aluno só enxerga a própria linha** em `profiles`, `payments`,
  `attendance`. Um `GET /profiles` de um aluno devolve só ele mesmo — provado no
  pentest (`SECURITY.md`).
- **Só `admin` escreve** em `plans`, `academy_settings`, `groups`, `classes`, e
  altera papel/status de outros perfis.
- **A trilha `audit_log` é somente leitura, e só para admin.** Ninguém escreve
  nela pela API: as linhas nascem de triggers.
- **O que o aluno pode mudar no próprio perfil é uma _lista de permitidos_**
  (`name`, `phone`, `dob`, `is_first_login`), imposta por trigger. Qualquer
  coluna nova nasce restrita ao admin — decisão tomada depois que uma _lista de
  proibidos_ deixou `status` e `plan_id` desprotegidos (ver `REVIEW.md`).

## Edge Functions — o que exige `service_role`

Três operações não podem acontecer só com a permissão do usuário: elas precisam
da `service_role` (que ignora a RLS), e essa chave **jamais** pode estar no app.
A solução são funções Deno server-side. Cada uma valida, pelo JWT de quem chama,
que é um administrador. Contratos em [`docs/EDGE-FUNCTIONS.md`](EDGE-FUNCTIONS.md).

| Função | Por que precisa de servidor |
| --- | --- |
| `create-student` | Criar uma conta de auth exige privilégio administrativo. |
| `reset-student-password` | Trocar a senha de **outro** usuário exige `service_role`. |
| `delete-my-account` | Anonimizar dados e banir a conta com preservação do financeiro. |

## Decisões que surpreendem (e o porquê)

- **Dinheiro em centavos (`integer`), nunca `float`.** `0,1 + 0,2` não dá `0,3`
  em ponto flutuante; somar mensalidades assim acumula erro. Todo valor trafega
  em centavos e só vira reais na borda de exibição (`utils/currency.ts`).
- **Excluir aluno = anonimizar, não deletar.** A obrigação fiscal de guardar o
  registro financeiro colide com o direito à exclusão (LGPD). A saída: apagar o
  que identifica a pessoa, manter o lançamento contábil desvinculado.
- **A cor da marca não é a cor do texto.** No tema claro, o verde neon reprova
  contraste como texto (2:1). Há dois tokens: `primary` (preenche botões) e
  `primaryText` (legível sobre o fundo). Ver `docs/A11Y.md`.
- **Porta 6969 do Metro, não 8081.** Evita conflito com outros projetos RN. A
  porta é embutida no APK (`gradle.properties`), então trocá-la exige recompilar.

## Onde cada coisa mora

```
src/
├── screens/      Telas por feature (auth, onboarding, dados, aulas, financeiro)
├── hooks/        Estado e carga de dados (um por recurso)
├── services/     Regra de negócio + acesso ao supabase (a única camada que o toca)
├── context/      AuthProvider — sessão, perfil, biometria, papel
├── components/   Design system (Card, Input, Button, ErrorState, ...)
├── lib/          supabase (cliente), secureStorage (sessão cifrada), logger
├── theme/        Paletas claro/escuro, tokens, contraste
├── utils/        currency, masks, validation, datetime
└── types/        database.types.ts (gerado pelo Supabase CLI)

supabase/
├── migrations/   Esquema versionado (migrations first, nunca alterar à mão)
└── functions/    Edge Functions Deno (create-student, reset-..., delete-...)
```

## Leitura complementar

| Documento | Cobre |
| --- | --- |
| `README.md` | Instalar, configurar `.env`, rodar |
| `docs/RUNBOOK.md` | Operações: migrations, tipos, Metro, APK, chaves |
| `docs/EDGE-FUNCTIONS.md` | Contrato das funções server-side |
| `docs/MANUAL-DO-ADMINISTRADOR.md` | Uso pelo dono da academia |
| `REVIEW.md` / `SECURITY.md` | Auditoria de código e pentest |
| `docs/A11Y.md` | Acessibilidade e contraste |
| `docs/FUNCIONALIDADES.md` | Checklist do que existe e do que falta |
