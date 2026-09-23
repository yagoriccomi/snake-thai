# Changelog

O que muda para quem usa o app Snake Thai, versão por versão. A versão só muda
quando um APK é publicado — regras em [`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md).
As entradas novas são geradas por `npm run versao:<parte>` a partir dos commits e
revisadas antes da publicação.

## [1.7.1] - 2026-09-23

### Correções

- **Aluno não vira mais administrador.** Na lista de alunos havia um botão sem rótulo que, com um toque, dava a um aluno acesso ao financeiro da academia, ao cadastro de todo mundo e à exclusão de contas. O botão saiu da lista, e o próprio banco passou a recusar: administrador agora sai da equipe, e só um professor pode ser promovido.

## [1.7.0] - 2026-09-21

### Novidades

- **Painel do admin**, na primeira aba: alunos ativos e inativos, quanto entrou do que era esperado no mês, inadimplência por faixa de atraso, faturamento dos últimos 12 meses, frequência média e alunos em risco de evasão. Junto vem o **relatório de inadimplência** por aluno, para cobrar e dar baixa.
- **Turmas e grade semanal**: o admin cadastra os horários fixos de cada turma e as aulas passam a ser geradas sozinhas. Turma pode ser renomeada, encerrada ou reativada — e a que tem histórico é arquivada, com as aulas e a frequência preservadas.
- **Notificações no celular** (Android): vencimento e atraso da mensalidade para o aluno, comprovante para analisar para o admin, aprovação e recusa, justificativa e aula que passou sem chamada para o professor. Quem ativa é a própria pessoa, o aviso não mostra nome nem valor na tela bloqueada, e nada chega entre 22h e 7h.
- **Política de Privacidade e Termos de Uso dentro do app**, com o aceite registrado por versão. Texto novo, aceite novo.
- **Dados dos termos** (admin): uma tela para preencher razão social, CNPJ, endereço, encarregado de dados, foro e prazos, que é o que monta a Política e os Termos.
- **Excluir a própria conta** e **exportar meus dados**, exigindo a senha — e o admin passa a editar o cadastro do aluno, inclusive o e-mail.
- **Copiar a chave PIX** com um toque na tela de envio do comprovante: chave digitada à mão erra fácil, e o erro só aparece no banco.
- **A chamada não concluída fica guardada no aparelho** e volta ao reabrir o app, com aviso de que foi recuperada.
- **Aviso no Painel quando uma rotina automática falha**, dizendo qual foi.
- **A versão instalada aparece no fim do Perfil**, para saber o que está no aparelho na hora de pedir ajuda.

### Correções

- **Sem internet, o login dizia "senha inválida".** A pessoa digitava a senha certa de novo e de novo. Agora a falha de conexão é dita como tal.
- **Quem ativava as notificações ficava com o aparelho registrando sem parar** — dezenas de vezes por segundo, gastando bateria e dados. O registro acontece uma vez, e de novo só quando o token muda mesmo.
- **A senha de primeiro acesso saiu do alcance de quem não é administrador**, e as contas criadas passam a usar a senha configurada pela academia.
- **Frequência**: conta a partir da entrada do aluno na turma e para de contar enquanto a matrícula está trancada. O risco de evasão passa a ser presença abaixo de 70%.
- **Filtros do Financeiro**: os números ao lado dos nomes deixaram de se espremer e quebrar em duas linhas.

## [1.6.0] - 2026-09-14

### Novidades

- Chamada em lista única com ✓ e ✗ por aluno: o escolhido fica colorido, o outro cinza
- As marcações da chamada ficam no aparelho e são gravadas de uma vez em **Concluir chamada**; a tela não recarrega nem volta ao topo a cada toque
- Aluno sem marcação é registrado como falta, com aviso antes de gravar; sair com marcações não salvas pede confirmação
- Financeiro geral com seletor de mês, marcador de pendência e a categoria **Pagas**
- Histórico por aluno em lista expansível: situação, anexo, dias de atraso, **Abrir anexo** e **Marcar como paga / não paga** sem exigir anexo
- O aluno continua obrigado a anexar o comprovante, agora garantido também no servidor

### Correções

- A digital só é pedida ao reabrir o app ou depois de mais de 10 minutos em segundo plano; anexar comprovante pela galeria não bloqueia mais o app no meio do envio

## [1.5.0] - 2026-09-14

### Novidades

- Histórico de pagamentos por aluno, com seleção de mês

### Correções

- Campos de texto não ficam mais escondidos atrás do teclado

## [1.4.0] - 2026-09-14

### Novidades

- Controle de frequência: "Presença em Aulas X/Y · Frequência N%" e histórico mensal
- Conclusão da chamada pelo professor, aviso de aula sem chamada e fechamento mensal da frequência
- Justificativa de falta com anexo

## [1.3.0] - 2026-09-14

### Quebra de compatibilidade

- APKs anteriores à 1.3.0 passam a ser recusados pelo banco. Pela política atual isto seria a 2.0.0; a numeração foi mantida para não confundir quem já instalou

### Novidades

- A declaração de presença do aluno fica separada da chamada do professor

### Correções

- Aprovar um comprovante grava a data de pagamento junto com a situação

## [1.2.4] - 2026-09-09

### Correções

- Texto do diálogo nativo da digital

## [1.2.3] - 2026-09-09

### Correções

- A tela de bloqueio não fala mais em "painel de administrador"

## [1.2.2] - 2026-09-09

### Correções

- Envio do comprovante volta a funcionar no SDK 57
- Aba Aulas do aluno deixa de aparecer vazia por falta da agenda futura

## [1.2.0] - 2026-09-04

### Novidades

- Papel de professor de ponta a ponta, com cor própria nas aulas
- Mensalidades geradas automaticamente e plano visível para o aluno

### Correções

- Professor e administrador também passam pela troca de senha e pelo aceite dos termos

## [1.0.0] - 2026-07-27

Primeira versão. Inclui também o que foi entregue até 2026-09-03 sem mudar o número:
autenticação com onboarding LGPD, perfil, aulas, financeiro com comprovante PIX,
planos e configurações da academia, gestão de papéis, desbloqueio por digital
opcional, troca e redefinição de senha, envio de comprovante pelo backend próprio e
o redesign das telas.

---

> **1.1.0 e 1.2.1** existiram só como APKs gerados para teste, sem registro no
> `app.json` e sem publicação. Até a 1.5.0 nenhuma versão teve GitHub Release; a 1.6.0
> teve, e o APK dela foi retirado em 2026-09-16 por ter sido assinado com a chave de
> desenvolvimento.
