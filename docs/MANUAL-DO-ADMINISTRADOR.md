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
7. [Painel e inadimplência](#7-painel-e-inadimplencia)
8. [Segurança da sua conta](#8-seguranca-da-sua-conta)
9. [Perguntas frequentes](#9-perguntas-frequentes)

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
| **Senha de primeiro acesso** | A senha provisória que toda conta nova (aluno, professor ou admin) recebe, e a que volta ao redefinir o acesso. A pessoa é obrigada a trocá-la no primeiro acesso. Só administradores a veem. Ao trocá-la, o app avisa quantas contas ainda não entraram: redefina a senha delas em Gerenciar alunos. |

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
2. Toque em cadastrar. O sistema cria a conta com a **senha de primeiro acesso**
   (a que você definiu nas Configurações) e mostra qual é.
3. Passe essa senha ao aluno. No primeiro acesso, ele é obrigado a trocá-la e a
   completar os próprios dados.

### Gerenciar quem já existe

Em **Dados → Gerenciar Alunos**, cada aluno tem uma linha com ícones de ação:

| Ícone | O que faz |
| --- | --- |
| **Lápis** | **Edita os dados** do aluno: nome, CPF, celular, nascimento, turma, plano, situação e o **e-mail de login** (útil quando foi digitado errado no cadastro). Aluno que ainda não fez o primeiro acesso tem nome e CPF travados — ele mesmo informa. |
| **Escudo** | Promove o aluno a **administrador** (ou rebaixa de volta). Um administrador vê e gerencia tudo — use com critério. |
| **Pausa** | **Tranca a matrícula** (ou reativa). O aluno trancado sai da lista de ativos e das cobranças, **mas o histórico é preservado**. Use quando alguém suspende o treino sem cancelar de vez. |
| **Chave** | **Redefine a senha** do aluno para a padrão. Use quando ele esquecer a senha. Ele terá que criar uma nova no acesso seguinte. |
| **Turma** | Muda o aluno de turma. |

> **Trancar não apaga.** A diferença importa: um aluno trancado pode voltar com
> todo o histórico de presença e pagamentos. Para apagar de vez os dados
> pessoais de alguém (a pedido dele, pela LGPD), use **Excluir conta** no fim da
> tela de edição (lápis) — veja a seção 8.

**Excluir conta (LGPD).** Na edição do aluno, em *Zona de perigo*. O app mostra o
que é apagado (dados pessoais, imagens dos comprovantes, justificativas de falta,
acesso) e o que fica sem identificação (pagamentos e presenças, por obrigação
legal), avisa se há mensalidades em aberto — excluir **não quita** débito — e pede
que você digite **EXCLUIR**. Não tem volta. Conta de administrador não é excluída:
rebaixe antes.

> **Não é possível ficar sem administrador.** Se você tentar rebaixar ou trancar
> o único administrador ativo, o sistema recusa e avisa. Promova outro antes.

---

## 5. Turmas e aulas

Como administrador, você:

- **Organiza as turmas** em **Dados → Turmas e grade semanal**: cria, renomeia,
  exclui e reativa.
- **Monta a grade semanal** de cada turma (ex.: segunda e quarta às 19:00). O app
  cria as aulas sozinho, sempre até o fim do mês seguinte.
- **Cria aulas avulsas** na aba **Aulas** (aula extra, evento).
- **Faz a chamada**: em cada aula, marca quem esteve presente.

Os alunos veem só as aulas da própria turma (e os eventos abertos a todos).

### Montar a grade semanal

1. **Dados → Turmas e grade semanal** → no cartão da turma, **Grade semanal**.
2. Toque em **Novo horário** e preencha: título, dia da semana, hora de início
   (horário de Brasília), início da vigência e, se quiser, o fim. Escolha os
   professores.
3. Ao salvar, o app diz quantas aulas entraram na agenda. Elas aparecem na aba
   **Aulas** e para os alunos da turma.

A agenda é completada todo dia de madrugada. É por isso que o contador de
presença do aluno já mostra o total do mês no dia 1.

Se já existia uma aula avulsa da mesma turma no mesmo dia e hora, ela passa a
fazer parte da grade (não duplica).

### Mudar ou encerrar um horário

- **Editar** (lápis): título, hora, vigência e professores. Só mudam as aulas
  **futuras que ainda não tiveram chamada**. Aula com chamada e aula que você
  editou à mão ficam como estão. O dia da semana não muda: encerre o horário e
  crie outro.
- **Encerrar** (botão vermelho): informe o último dia com aula. As aulas depois
  dele que ainda não tiveram chamada saem da agenda, junto com as declarações e
  justificativas dos alunos para elas.
- Para reabrir um horário encerrado, edite e apague a data de fim.

### Mudar uma aula específica

Na aba **Aulas**, abra a aula e toque em **Editar aula**. Se ela veio da grade
(selo **Grade semanal**), passa a ser independente: mudanças posteriores no
horário não a alteram mais. Cancelar só uma data (feriado) ainda não existe no
app.

### Renomear, excluir e reativar turma

- **Renomear** (lápis): o nome novo aparece em todas as aulas e frequências da
  turma, inclusive as antigas.
- **Excluir** (lixeira): antes de confirmar, o app mostra o que vai acontecer.
  - Turma que nunca teve aula dada nem frequência fechada é **apagada**.
  - Turma com histórico é **arquivada**: some dos seletores, as aulas futuras sem
    chamada saem da agenda, os horários são encerrados e o histórico (aulas
    passadas, chamadas e frequências) continua guardado.
  - Se a turma tem alunos, você escolhe a turma de destino ou marca **Sem turma**
    (o aluno passa a ver só eventos).
  - Trocar alunos de turma no meio do mês muda a frequência do mês deles:
    prefira a virada do mês.
- **Reativar**: em **Arquivadas**, no fim da lista de turmas. A turma volta aos
  seletores; os horários dela continuam encerrados.
- A chamada das aulas de uma turma arquivada fica **congelada** (só leitura).
  Para corrigir, reative a turma antes.

### Fazer a chamada

1. Abra a aula e toque em **Fazer chamada**.
2. Para cada aluno, toque no **✓** (presente) ou no **✗** (falta). O símbolo
   escolhido fica colorido e o outro fica cinza; tocar de novo desmarca.
3. Nada é gravado enquanto você marca — a lista não recarrega nem volta ao
   topo. Toque em **Concluir chamada** no rodapé para gravar tudo de uma vez.
4. Antes de gravar, o app mostra quantas presenças e faltas serão
   registradas. **Aluno sem marcação é registrado como falta.**
5. Precisa corrigir? Reabra a chamada, ajuste e toque em **Salvar
   alterações**. Se tentar sair com marcações não salvas, o app avisa.

---

## 6. Receber e aprovar pagamentos

O fluxo de pagamento é pensado para a realidade do PIX no Brasil:

1. O aluno vê a mensalidade em aberto no app, com **a sua chave PIX** e o valor.
2. Ele paga pelo banco dele e **anexa o comprovante** (foto ou PDF) no app.
3. Na aba **Financeiro**, você vê os comprovantes **aguardando aprovação**.
4. Abra o comprovante, confira, e **aprove** ou **recuse**.
   - Aprovado, o pagamento vira "pago" e some da lista de pendências.
   - Recusado, o aluno é avisado para reenviar.

### Ver o financeiro de outro mês

No topo da aba **Financeiro**, toque no **mês** que quer ver. A bolinha
colorida de cada mês já mostra onde há pendência: vermelha tem atraso, azul
tem comprovante aguardando você, amarela tem mensalidade em aberto, verde está
tudo pago. O resumo e as listas **Aprovar**, **Aberto**, **Vencidas** e
**Pagas** passam a mostrar só aquele mês.

Tocar numa mensalidade em análise abre o comprovante; nas demais, abre o
histórico daquele aluno.

### Averiguar e ajustar o histórico de um aluno

1. Na aba **Financeiro**, toque em **Histórico por aluno** e escolha o aluno
   (alunos inativos também aparecem).
2. No topo, veja quantas mensalidades estão pagas, em atraso e em aberto.
3. Cada mensalidade mostra o mês, a situação e se tem **anexo**. Toque nela
   para abrir os detalhes: valor, vencimento, quando foi paga e com quantos
   dias de atraso.
4. **Abrir anexo** mostra o comprovante enviado pelo aluno.
5. **Marcar como paga** registra o pagamento na hora, **sem exigir anexo** —
   para pagamento em dinheiro ou acerto combinado. **Marcar como não paga**
   desfaz; o anexo, se houver, continua guardado.

> O aluno, por outro lado, **sempre** precisa anexar o comprovante: o sistema
> não aceita mandar a mensalidade para análise sem o arquivo.

---

## 7. Painel e inadimplência

O **Painel** é a primeira aba, e só você (administrador) a vê. Puxe a tela para
baixo para atualizar. As regras de cada número estão em `docs/PAINEL.md`.

- **Alunos:** ativos, inativos (matrícula trancada), ativos sem plano (não geram
  mensalidade) e quem saiu no mês.
- **Mês atual:** quanto entrou do que era esperado, com a barra de progresso, e o
  restante separado em análise, em aberto e vencidas.
- **Inadimplência:** tudo que está em aberto ou vencido com vencimento **antes de
  hoje**, separado em 1 a 30, 31 a 60 e mais de 60 dias. Quem já mandou o
  comprovante não entra. Dívida de conta excluída a pedido (LGPD) aparece só
  como **Contas encerradas**, sem nome.
- **Faturamento de 12 meses:** cada coluna é o esperado do mês (contorno) com o
  recebido preenchido. É por competência: um pagamento atrasado conta no mês a
  que a mensalidade se refere.
- **Frequência:** a média deste mês e a do mês passado, só entre os alunos que
  tiveram aula com chamada. Abaixo, os alunos **em risco de evasão** (abaixo de
  50% neste mês, com pelo menos 4 aulas, ou no mês passado). Toque num aluno
  para abrir a frequência dele.

### Cobrar e dar baixa

1. No Painel, em **Inadimplência**, toque em **Ver relatório** (ou, na aba
   **Financeiro**, em **Inadimplência**).
2. A lista mostra quem deve, quanto e há quantos dias, do maior atraso para o
   menor. Filtre pela faixa no topo. Alunos inativos aparecem com o selo
   **Inativo**.
3. Toque no aluno para abrir o histórico dele e **Marcar como paga** o que ele
   acertou. Ao voltar, a lista já sai atualizada.

> No dia do vencimento, à noite, o Financeiro pode mostrar a mensalidade como
> "Vencida" um pouco antes de o Painel contar: o Painel usa o dia de Brasília.

---

## 8. Segurança da sua conta

Em **Dados → Segurança**:

- **Desbloqueio por digital** — liga/desliga a exigência da impressão digital
  para abrir o app. Só aparece se o seu celular tiver digital cadastrada.
- **Alterar minha senha** — troca a sua senha. Por segurança, **pede a senha
  atual** antes de aceitar a nova. Isso impede que alguém com o seu celular
  desbloqueado troque a sua senha e tome a conta.

---

## 9. Perguntas frequentes

**Um aluno esqueceu a senha. E agora?**
Gerenciar Alunos → ícone de **chave** no aluno. A senha volta para a padrão e
ele cria uma nova no próximo acesso.

**Um aluno quer cancelar e apagar os dados dele (LGPD).**
Ele mesmo pode fazer pelo app: **Dados → Excluir minha conta** (pede a senha dele).
Se ele pedir a você, use **Gerenciar Alunos → lápis → Excluir conta**. Nos dois
casos os dados pessoais e as imagens de comprovante são apagados, e o histórico
financeiro fica sem identificação, por obrigação legal/fiscal. Antes, o aluno pode
baixar uma cópia em **Dados → Exportar meus dados**.

**Onde eu preencho o CNPJ e os outros dados dos termos?**
Em **Dados → Dados dos termos e da política**. São 15 campos (razão social, CNPJ,
endereço, contato, encarregado, prazos de guarda, foro e os pontos que a assessoria
jurídica precisa definir). Cada um explica o que escrever. Os botões "Ver Política
de Privacidade" e "Ver Termos de Uso" mostram o texto exatamente como vai ficar; o
que faltar aparece entre chaves duplas, assim: {{cnpj}}.

Preencher **não publica nada**. A publicação é feita pela equipe técnica e faz
todos os alunos, professores e administradores aceitarem os documentos de novo ao
abrir o app — por isso não acontece com um toque.

**Onde os alunos leem a Política de Privacidade e os Termos de Uso?**
Em **Dados → Termos e privacidade**, com a data em que cada um aceitou. O texto é
publicado pela equipe técnica, depois de aprovado por você e pela assessoria
jurídica. Quando sai uma versão nova, **todos** (inclusive administradores) veem a
tela "Termos atualizados" ao abrir o app e só continuam depois de aceitar. Quem não
concordar pode sair da conta e pedir a exclusão dos dados.

**Mudei a chave PIX. Os alunos já veem a nova?**
Sim, assim que você salva. Cada cobrança nova usa a chave atual.

**Posso ter mais de um administrador?**
Sim. Promova quantos precisar em Gerenciar Alunos. Recomenda-se ter pelo menos
dois, para nunca depender de uma pessoa só.

**Troquei de celular. Perco os dados?**
Não. Seus dados ficam na nuvem (Supabase), não no aparelho. Basta instalar o app
no celular novo e entrar com o seu e-mail e senha.
