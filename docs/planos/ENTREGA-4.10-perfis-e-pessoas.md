# Entrega — 4.10 Perfis e Pessoas

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.10-perfis-e-pessoas.md`](PLANO-4.10-perfis-e-pessoas.md).
> PRs: **#76** (banco) e o do app.

## O que mudou

- **Banco (`20260929200000_perfis.sql`):** `perfil_do_aluno` (turma por período do mês, trocas
  permanentes vigentes, frequência; plano e financeiro só para o admin), `perfil_do_professor`
  (T32) e `historico_de_aulas_do_professor`, só para o admin.
- **App:**
  - **Dados › Pessoas** no lugar de "Cadastrar novo aluno", "Cadastrar professor ou admin" e
    "Gerenciar alunos": abas **Alunos · N** / **Equipe · N**, busca por nome ou CPF, filtros
    **Ativos / Pendentes / Trancados**, a linha com iniciais, nome, "Turma · Plano" e a situação;
  - a folha de ações: **Ver ficha, Editar cadastro, Trocar turma ou plano, Trancar matrícula,
    Redefinir senha de acesso, Excluir conta**; na Equipe, **Promover a administrador** e
    **Tornar professor** (com a cor pedida antes, se faltar);
  - **+ Cadastrar** no contexto da aba;
  - **Ficha do aluno** (também pelo nome na chamada, sem financeiro para o professor) e **ficha
    do professor** (só admin, por mês);
  - o **aviso ao mudar a turma** (os três textos da § 3) na folha "Trocar turma ou plano" e na
    edição do aluno, antes de salvar; a turma e o plano não mudam mais direto na linha.

## Como validar

- `scripts\db-dev test` e `reset` (verdes, no #76); `npx tsc --noEmit` e Jest (1095, verdes).
- **Roteiro no aparelho** (banco local, app DEV, como admin):
  1. **Dados › Pessoas**: as abas mostram os totais; **Pendentes** lista só quem nunca entrou.
  2. Buscar por parte do nome e por parte do CPF.
  3. Tocar num aluno: a folha lista as seis ações; **Promover a administrador** não aparece.
  4. **Trocar turma ou plano**: escolher outra turma mostra o aviso da frequência e das trocas
     antes de **Salvar**; salvar e ver a linha com a turma nova.
  5. **Ver ficha**: turma por período ("Turma X até dd/mm · Turma Y desde dd/mm"), frequência,
     histórico e financeiro. **Ver frequência** abre a tela Frequência.
  6. Aba **Equipe**: num professor, **Promover a administrador**; num admin sem cor, **Tornar
     professor** pede a cor antes.
  7. **Ver ficha** de um professor: o percentual e os números do mês; trocar o mês no seletor.
  8. **Excluir conta** abre a edição com a confirmação da exclusão aberta.
  9. Como **professor**, na chamada, tocar no nome de um aluno: a ficha abre **sem** financeiro.
  10. Tema claro e escuro: as etiquetas, a bolinha de cor da equipe e o aviso legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Acessibilidade** das telas novas (Pessoas, ficha, folhas): item do `acessibilidade-projeto`,
  junto das telas do 4.9.
- **Produção:** a migration entra no mesmo `db-push-prod.bat` das anteriores, com o APK novo.

## Próximo passo

4.11 (LGPD, abre o G5).
