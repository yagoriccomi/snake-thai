# PLANO DE EXECUÇÃO — L1: senha padrão de primeiro acesso protegida

| Campo | Valor |
|---|---|
| **Tarefa** | `L1` (lacuna encontrada pelo revisor, [`PLANO-DE-TAREFAS`](../PLANO-DE-TAREFAS.md)) |
| **Modo de execução** | 🔁 Loop (produção só com confirmação) |
| **Data** | 2026-09-16 |
| **Branch** | `fix/senha-padrao-protegida` |

## 1. Enunciado

**Problema.** A senha de primeiro acesso de alunos e equipe tem duas falhas.

- **As Edge Functions ignoram a configuração.** `create-student`, `create-staff` e
  `reset-student-password` usam um literal fixo, público no repositório. Trocar a
  senha em Configurações não muda nada, e o app mostra ao admin uma senha que não é
  a das contas novas.
- **Qualquer usuário logado lê a senha.** `academy_settings.default_student_password`
  tem RLS `select using (true)`, então qualquer aluno logado a lê. Com o e-mail de
  alguém recém-cadastrado que ainda não entrou, dá para entrar na conta dessa
  pessoa antes dela.

**Resultado esperado.**

- Só o admin lê e troca a senha.
- As três funções criam e redefinem contas com a senha configurada.
- O APK 1.6.0 continua funcionando.

**Como validar.** Verificar três pontos:

1. **Regressão SQL:** o aluno não lê a senha por nenhum caminho; o admin lê e troca;
   o caminho do app antigo grava sem expor.
2. **API local:** o admin troca a senha e cria um aluno; o login com a senha nova
   funciona e o login com o literal antigo é recusado.
3. **Jest:** o app mostra a senha só para o admin.

## 2. Premissas assumidas (Loop)

- **P1. Senha configurável, só para admin, em vez de senha aleatória por conta.**
  - **Por quê:** mantém o jeito de trabalhar da academia, com uma senha informada no
    balcão e trocada no primeiro acesso.
  - **Risco que fica:** quem conhece a senha do dia ainda pode entrar numa conta nova
    que ainda não fez o primeiro acesso. Senha aleatória por conta fica registrada
    como evolução.
- **P2. Compatível com o APK 1.6.0.**
  - A coluna antiga fica, mas passa a guardar só `********`.
  - Um gatilho leva o valor que o app antigo grava para a tabela protegida. Assim a
    tela Configurações antiga continua salvando.
  - O cadastro antigo mostra `********` em vez de uma senha errada.
  - A coluna sai numa limpeza futura, quando não houver mais APK antigo.
- **P3. Sem senha configurada, as funções recusam com 500.** Nunca voltam ao literal
  público.
- **P4. "Revisar contas que nunca entraram".**
  - Consulta no RUNBOOK e contagem no aviso de troca da senha. O texto recomenda
    trocar a senha e redefinir as contas antigas que nunca entraram.
  - Nenhuma senha de conta existente é alterada automaticamente, por decisão
    anterior do usuário: "não precisa mudar a senha dos demais".

## 3. Passos

1. **Migration `senha_padrao_protegida`.**
   - Tabela `academy_secrets` (linha única), com RLS ligada, sem policy e só a
     `service_role` com acesso.
   - Copia a senha atual de `academy_settings` e mascara a coluna antiga com
     `********`.
   - Gatilho `BEFORE UPDATE OF default_student_password`: valor diferente da máscara
     vai para a tabela protegida, e a coluna volta à máscara.
   - `senha_padrao_da_academia()` e `definir_senha_padrao_da_academia(p_senha)`:
     só admin (42501); mínimo de 8 caracteres (23514).
   - `contas_sem_primeiro_acesso()`: só admin; quantas contas ainda não fizeram o
     primeiro acesso.
2. **Regressão `supabase/tests/regressao_senha_padrao.sql`.**
3. **Edge Functions** `create-student`, `create-staff` e `reset-student-password`:
   leem `academy_secrets` com a `service_role`; sem senha, 500; o literal sai do
   código.
4. **App.**
   - `settings.service`: a senha deixa de ser campo de `academy_settings`.
   - Hook `useDefaultStudentPassword` (só admin).
   - Configurações lê e grava pela função.
   - Cadastrar aluno e Gerenciar alunos mostram a senha vinda da função, sem o
     literal de reserva.
   - Remove `src/constants/auth.ts`.
5. **Tipos regenerados**, e testes Jest do serviço e do hook.
6. **Ensaio na API local:** reiniciar o runtime de funções, trocar a senha, criar
   aluno, conferir o login.
7. **Docs:** RUNBOOK (consulta das contas sem primeiro acesso), EDGE-FUNCTIONS,
   SECURITY/REVIEW e PLANO-DE-TAREFAS (L1); `ENTREGA-L1.md`.

## 4. Riscos e rollback

- **Ordem em produção: migration → funções → APK.**
  - Funções antes da migration: `academy_secrets` não existe e o cadastro dá 500.
  - Migration antes das funções: as funções antigas seguem com o literal. Nada
    piora, e o vazamento para alunos já fecha.
- **Rollback:** apagar o gatilho e restaurar o valor na coluna a partir de
  `academy_secrets`. Nenhum dado se perde.
