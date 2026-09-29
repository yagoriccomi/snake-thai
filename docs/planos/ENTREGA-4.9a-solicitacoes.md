# Entrega — 4.9a Solicitações

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.9a-solicitacoes.md`](PLANO-4.9a-solicitacoes.md).
> PRs: **#71** (banco) e o do app.

## O que mudou

- **Banco (`20260929180000_solicitacoes.sql`):**
  - `abrir_solicitacao` com os requisitos dos 5 tipos, o prazo de 7 dias e um pedido por tipo, aula
    e pessoa;
  - `decidir_solicitacao` com nota obrigatória; a aprovação retifica a presença do aluno ou do
    professor, ou inclui o professor;
  - a caixa (`caixa_de_solicitacoes`, `itens_da_solicitacao`), `minhas_solicitacoes`,
    `solicitacoes_decididas` e `solicitacao_para_decidir`;
  - o aviso `solicitacao_pendente`.
- **App:**
  - o ícone **Solicitações** com contador no cabeçalho de Aulas (equipe) e do Painel (admin);
  - a tela **Solicitações**, com as categorias da § 3 e **Meus pedidos**;
  - os itens de cada categoria: **Decidir** (folha com nota obrigatória), **Ver chamada** e
    **Conferido** nas retificações feitas, **Abrir no Financeiro** nos comprovantes;
  - **Eu estava na aula** na linha da aula que já passou, quando o banco aceita;
  - **Pedir ao admin** no detalhe da aula do professor: "Eu estava na aula", "Justificar
    ausência", "Corrigir chamada de outro professor" e "Me incluir nesta aula";
  - **Meus pedidos**, com o bloco de contato no negado;
  - o toque em "Nova solicitação para analisar" abre Solicitações; o atalho provisório
    "Justificativas para revisar" da agenda saiu (a categoria Faltas de alunos o substitui).

## Como validar

- `scripts\db-dev test` e `reset` (verdes, no #71); `npx tsc --noEmit` e Jest (1044, verdes).
- **Roteiro no aparelho** (banco local, app DEV):
  1. Como **aluno fixo** marcado ausente numa aula de ontem com chamada feita: a linha mostra **Eu
     estava na aula**. Enviar sem motivo fica desabilitado; com motivo, a folha diz "Pedido
     enviado".
  2. Como **professor da aula**: o ícone de caixa em Aulas mostra **1**. **Solicitações ›
     Retificação de chamadas › Decidir**: aprovar sem nota fica desabilitado; aprovar com nota.
  3. Como o aluno: a chamada da aula mostra presença (selo **Editada**); **Frequência › Meus
     pedidos** mostra "Pedido aprovado por {nome}".
  4. Como **professor** marcado ausente numa aula dele: no detalhe da aula, **Pedir ao admin ›
     Eu estava na aula**. Como admin: **Painel › caixa › Faltas de professores › Decidir**; negar
     com nota. Como o professor: **Meus pedidos** mostra "Pedido negado" e o contato da academia.
  5. Como professor **de fora** de uma aula que já começou: **Me incluir nesta aula**; o admin
     aprova, e ele aparece na chamada como acrescentado, com presença.
  6. Como admin: **Retificação de chamadas** lista a retificação feita no passo 2; **Conferido**
     tira da lista.
  7. Com push: o aviso "Nova solicitação para analisar" abre Solicitações.
  8. Tema claro e escuro: o contador do ícone, os estados e os botões legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção:** a migration entra no mesmo `db-push-prod.bat` das anteriores (4.6b a 4.9a), depois
  da `send-push` (§ 14), com o APK novo.
- **Anexos dos pedidos:** pelo fluxo da § 8, depois do **G2**.
- **Contrato:** `solicitacao_para_decidir` e `quem_sera_avisado` entram na próxima revisão.
- **Trocas de aula:** a categoria se enche no 4.9b.

## Próximo passo

4.9b (troca de aula) — abre o G3.
