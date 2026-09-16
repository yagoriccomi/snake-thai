# ENTREGA — L1: senha de primeiro acesso protegida

| Campo | Valor |
|---|---|
| **Tarefa** | `L1` (lacuna do revisor) |
| **Plano** | [`PLANO-L1.md`](PLANO-L1.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `fix/senha-padrao-protegida` |
| **Status** | 🟡 Pronto e conferido no ambiente local; **nada publicado em produção** |

---

## 1. O que foi encontrado

- **Qualquer aluno logado lia a senha de primeiro acesso.** A tabela
  `academy_settings` é legível por todo usuário logado, e a senha estava nela.
  Quem tivesse o e-mail de alguém recém-cadastrado podia entrar na conta dessa
  pessoa antes do primeiro acesso.
- **Trocar a senha em Configurações não fazia nada.** As três Edge Functions de
  conta (criar aluno, criar equipe, redefinir senha) usavam um valor fixo, público
  no repositório. O app mostrava ao admin uma senha que não era a das contas novas.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916220151_senha_padrao_protegida.sql` | `academy_secrets` (só servidor); cópia da senha vigente; coluna antiga mascarada, com gatilho que leva para a tabela protegida o que o APK 1.6.0 gravar; `senha_padrao_da_academia()` e `definir_senha_padrao_da_academia()` (só admin, mínimo de 8 caracteres); `contas_sem_primeiro_acesso()` |
| `supabase/tests/regressao_senha_padrao.sql` | 5 casos |
| `supabase/functions/_shared/senha-padrao.ts` + `create-student`, `create-staff`, `reset-student-password` | Leem a senha configurada; sem senha, recusam com 500; o literal saiu do código |
| `src/services/settings.service.ts`, `src/hooks/useDefaultStudentPassword.ts` | Leitura, troca e contagem pelas funções; sem valor de reserva |
| `ConfiguracoesScreen`, `CadastrarAlunoScreen`, `GerenciarAlunosScreen` | Senha pela função; aviso de quantas contas ainda não entraram depois de trocar |
| `src/constants/auth.ts` | Removido (literal de reserva) |
| Docs | `EDGE-FUNCTIONS`, `MANUAL-DO-ADMINISTRADOR`, `RUNBOOK` (consulta das contas sem primeiro acesso), `README`, `REVIEW`, `PLANO-DE-TAREFAS` |

## 3. Verificações executadas

- [x] **Regressão SQL** (5 casos):
  - o aluno não lê a senha pela configuração (só a máscara), pela tabela nem pela
    função, e não troca nem conta;
  - o admin lê, troca e conta;
  - senha curta e a própria máscara são recusadas;
  - o caminho do APK antigo grava na tabela protegida e deixa só a máscara;
  - a auditoria não registra a senha; a tabela protegida é só do servidor.
- [x] **Suíte SQL completa** no banco limpo.
- [x] **API local** (contas locais, nada impresso):
  - o aluno vê `********` e recebe 403/42501 na tabela e na função;
  - o admin lê e troca;
  - `create-student` cria a conta, que entra com a senha configurada e é recusada
    (400) com o literal público antigo;
  - a contagem de contas sem primeiro acesso responde;
  - a senha local foi restaurada ao final.
- [x] **Jest:** 646 testes (4 novos do serviço); typecheck e `deno check` das 3 funções.

## 4. ⚠️ Premissas assumidas (revisar)

- **Senha configurável só para admin, e não aleatória por conta.**
  - **Por quê:** mantém o jeito de trabalhar da academia.
  - **Risco que fica:** quem conhece a senha do dia pode entrar numa conta nova
    antes do dono. Senha aleatória por conta fica como evolução.
- **Nenhuma senha de conta existente foi trocada automaticamente,** pela decisão
  anterior: "não precisa mudar a senha dos demais". O app só avisa quantas contas
  ainda não entraram.
- **A coluna antiga fica,** mascarada, enquanto houver APK 1.6.0. No APK antigo, o
  cadastro mostra `********` em vez de uma senha errada.

## 5. Pendências (suas)

1. ⚠️ **Publicar, nesta ordem:**
   1. migration (`db-push-prod.bat`);
   2. `functions deploy create-student create-staff reset-student-password --project-ref <REF>`;
   3. APK novo.

   Com as funções antes da migration, o cadastro dá erro 500.
2. Logo depois, **trocar a senha de primeiro acesso em Configurações.** A atual de
   produção é o valor público do repositório.
3. **Redefinir, em Gerenciar alunos, as contas que ainda não fizeram o primeiro
   acesso** (o app avisa quantas; a consulta está no RUNBOOK).
4. **Se a senha já tinha sido trocada pelo app antigo,** o valor pode estar no
   `audit_log`, que só admins leem. Vale trocar de novo depois de publicar.
