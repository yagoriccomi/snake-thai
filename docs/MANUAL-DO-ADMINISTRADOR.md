# Manual do Administrador — Snake Thai

> Este manual é para **quem administra a academia**, não para programadores.
> Ele cobre tudo o que você faz no aplicativo pelo celular, passo a passo. Não é
> preciso saber nada de técnica: se você usa aplicativo de banco, consegue usar
> isto.

## Índice

1. [Primeiro acesso](#1-primeiro-acesso)
2. [Configurar a sua academia](#2-configurar-a-sua-academia)
3. [Planos e mensalidades](#3-planos-e-mensalidades)
4. [Cadastrar e gerenciar alunos](#4-cadastrar-e-gerenciar-alunos)
5. [Turmas e aulas](#5-turmas-e-aulas)
6. [Receber e aprovar pagamentos](#6-receber-e-aprovar-pagamentos)
7. [Segurança da sua conta](#7-seguranca-da-sua-conta)
8. [Perguntas frequentes](#8-perguntas-frequentes)

---

## 1. Primeiro acesso

Você recebe um e-mail e uma senha provisória de quem instalou o sistema.

1. Abra o app **Snake Thai** e digite o e-mail e a senha provisória.
2. O app vai pedir que você **complete o cadastro**: nome, celular, CPF e data
   de nascimento, e que **crie uma senha nova**.
   - A tela mostra, enquanto você digita, o que a senha precisa ter: pelo menos
     8 caracteres, uma letra maiúscula, uma minúscula, um número e um símbolo
     (como `@` ou `!`). Cada item fica verde quando cumprido.
3. Aceite os Termos e a Política de Privacidade e conclua.
4. Se o seu celular tiver digital cadastrada, o app pergunta **uma vez** se você
   quer usá-la para abrir o app. Você pode ativar agora ou depois, na aba Dados.

Pronto. A partir daqui você é o administrador.

> **Guarde bem a sua senha.** Como administrador, você é a chave do sistema. O
> app tem uma proteção que **impede o último administrador de ser removido** —
> mas isso não substitui lembrar da própria senha.

---

## 2. Configurar a sua academia

Tudo que é "a cara" da sua academia fica em **Dados → Configurações da
Academia**. É aqui que o sistema deixa de ser genérico e passa a ser o **seu**.

| Campo | Para que serve |
| --- | --- |
| **Nome da academia** | Aparece no app para os alunos. |
| **Cor principal** | A cor dos botões e destaques. Use o formato `#RRGGBB` (ex.: `#39FF14` para verde). |
| **Chave PIX** | A chave para onde os alunos enviam a mensalidade. **Sem ela, o aluno não consegue pagar.** |
| **Nome do titular do PIX** | Aparece para o aluno conferir antes de pagar. |
| **Dia de vencimento padrão** | O dia do mês (1 a 28) usado como sugestão ao criar planos. |
| **Contato e endereço** | Informações da academia. |
| **Senha padrão do aluno** | A senha provisória que todo aluno novo recebe. O aluno é obrigado a trocá-la no primeiro acesso. |

Toque em **Salvar configurações**. A mudança vale na hora — inclusive a cor,
que muda o app imediatamente.

> **Por que o dia de vencimento vai só até 28?** Porque todo mês tem dia 28,
> mas nem todo mês tem 29, 30 ou 31. Isso evita mensalidade que "some" em
> fevereiro.

---

## 3. Planos e mensalidades

Em **Dados → Planos e Mensalidades** você define quanto custa treinar.

### Criar um plano

1. Preencha o **nome** (ex.: "Mensal 3x por semana").
2. Digite o **valor**. Pode usar vírgula: `129,90`.
3. Escolha a **periodicidade**: Mensal, Trimestral, Semestral ou Anual.
4. Defina o **dia de vencimento** (1 a 28).
5. Toque em **Criar plano**.

### Editar ou desativar

- O **lápis** edita um plano. Mudar o preço **não altera cobranças já geradas** —
  só vale para as próximas. Ninguém é cobrado a mais retroativamente.
- O **arquivo** (caixa) desativa um plano. Ele some das novas contratações, mas
  **não é apagado**: os pagamentos que já apontavam para ele continuam
  intactos. Por isso não existe "excluir plano" — só desativar.

---

## 4. Cadastrar e gerenciar alunos

### Cadastrar um aluno novo

Em **Dados → Cadastrar Novo Aluno**:

1. Digite o **e-mail** do aluno.
2. Toque em cadastrar. O sistema cria a conta com a **senha padrão** (a que você
   definiu nas Configurações) e mostra qual é.
3. Passe essa senha ao aluno. No primeiro acesso, ele é obrigado a trocá-la e a
   completar os próprios dados.

### Gerenciar quem já existe

Em **Dados → Gerenciar Alunos**, cada aluno tem uma linha com ícones de ação:

| Ícone | O que faz |
| --- | --- |
| **Escudo** | Promove o aluno a **administrador** (ou rebaixa de volta). Um administrador vê e gerencia tudo — use com critério. |
| **Pausa** | **Tranca a matrícula** (ou reativa). O aluno trancado sai da lista de ativos e das cobranças, **mas o histórico é preservado**. Use quando alguém suspende o treino sem cancelar de vez. |
| **Chave** | **Redefine a senha** do aluno para a padrão. Use quando ele esquecer a senha. Ele terá que criar uma nova no acesso seguinte. |
| **Turma** | Muda o aluno de turma. |

> **Trancar não apaga.** A diferença importa: um aluno trancado pode voltar com
> todo o histórico de presença e pagamentos. Para apagar de vez os dados
> pessoais de alguém (a pedido dele, pela LGPD), veja a seção 8.

> **Não é possível ficar sem administrador.** Se você tentar rebaixar ou trancar
> o único administrador ativo, o sistema recusa e avisa. Promova outro antes.

---

## 5. Turmas e aulas

Na aba **Aulas**, como administrador, você:

- **Cria turmas** (ex.: Turma Manhã, Turma Noite) e atribui alunos a elas.
- **Cria aulas** com data, horário e turma.
- **Lança a presença**: em cada aula, marca quem esteve presente.

Os alunos veem só as aulas da própria turma (e os eventos abertos a todos).

---

## 6. Receber e aprovar pagamentos

O fluxo de pagamento é pensado para a realidade do PIX no Brasil:

1. O aluno vê a mensalidade em aberto no app, com **a sua chave PIX** e o valor.
2. Ele paga pelo banco dele e **anexa o comprovante** (foto ou PDF) no app.
3. Na aba **Financeiro**, você vê os comprovantes **aguardando aprovação**.
4. Abra o comprovante, confira, e **aprove** ou **recuse**.
   - Aprovado, o pagamento vira "pago" e some da lista de pendências.
   - Recusado, o aluno é avisado para reenviar.

Você também vê, separados, os pagamentos **em aberto** (ainda não pagos) e os
**vencidos** (passaram da data) — o sistema marca o vencimento sozinho.

---

## 7. Segurança da sua conta

Em **Dados → Segurança**:

- **Desbloqueio por digital** — liga/desliga a exigência da impressão digital
  para abrir o app. Só aparece se o seu celular tiver digital cadastrada.
- **Alterar minha senha** — troca a sua senha. Por segurança, **pede a senha
  atual** antes de aceitar a nova. Isso impede que alguém com o seu celular
  desbloqueado troque a sua senha e tome a conta.

---

## 8. Perguntas frequentes

**Um aluno esqueceu a senha. E agora?**
Gerenciar Alunos → ícone de **chave** no aluno. A senha volta para a padrão e
ele cria uma nova no próximo acesso.

**Um aluno quer cancelar e apagar os dados dele (LGPD).**
O próprio aluno faz isso pelo app dele (função de excluir conta). Os dados
pessoais (nome, CPF, telefone) são apagados; o histórico financeiro é mantido
sem identificação, por obrigação legal/fiscal. Você, como admin, não precisa
fazer nada.

**Mudei a chave PIX. Os alunos já veem a nova?**
Sim, assim que você salva. Cada cobrança nova usa a chave atual.

**Posso ter mais de um administrador?**
Sim. Promova quantos precisar em Gerenciar Alunos. Recomenda-se ter pelo menos
dois, para nunca depender de uma pessoa só.

**Troquei de celular. Perco os dados?**
Não. Seus dados ficam na nuvem (Supabase), não no aparelho. Basta instalar o app
no celular novo e entrar com o seu e-mail e senha.
