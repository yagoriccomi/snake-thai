# Entrega — 4.9b Troca de aula (G3)

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.9b-trocas.md`](PLANO-4.9b-trocas.md).
> PRs: **#73** (banco), **#74** (CI: versão fixa da CLI do Supabase) e o do app.

## O que mudou

- **Banco (`20260929190000_trocas.sql`, `20260929191000_historico_do_aluno.sql`):**
  - `pedir_troca_de_aula` com as recusas na ordem da § 9.4;
  - `decidir_troca_de_aula` (nota pela T41; a permanente abre ou encerra o período, T37);
  - `desistir_da_troca` (T36);
  - `minhas_trocas`, `minhas_trocas_permanentes`, `trocas_para_decidir` (T49) e
    `trocas_decididas`;
  - a categoria **Trocas de aula** da caixa;
  - `historico_de_aulas_do_aluno`, adiantado do 4.10 para o G3.
- **App:**
  - no menu **Escolher aulas**, **Trocar para esta** → folha **Trocar aula**: a pergunta da § 3,
    a lista das aulas dele (selo **Reposição**), o tipo **Só nesta semana** / **Permanente** e, na
    permanente, a justificativa obrigatória com o aviso da grade e "Este horário termina em
    {dd/mm}.";
  - **Desistir da troca** na linha da aula, com confirmação;
  - **Frequência › Minhas trocas**, com os rótulos da § 3 e o bloco de contato na negada;
  - **Revisar troca** pela caixa de Solicitações, com o motivo da decisão pela T41;
  - o toque em "Pedido de troca de aula" abre **Solicitações › Trocas de aula**.
- **G3 aberto em 29/09:** a consulta do § 14 dá **23** no banco local, e as RPCs estão na `main`.

## Como validar

- `scripts\db-dev test` e `reset` (verdes, no #73); `npx tsc --noEmit` e Jest (1074, verdes).
- **Roteiro no aparelho** (banco local, app DEV):
  1. Como **aluno fixo**: **Aulas › Escolher aulas**, numa aula de outra turma desta semana,
     **Trocar para esta**. A folha lista as aulas dele desta semana; escolher uma e **Pedir troca**.
  2. A aula nova aparece com **Troca pendente**; a original, com "Troca pendente para {dia}".
     **Desistir da troca** pede confirmação e desfaz.
  3. Pedir de novo. Como **professor da aula nova**: o ícone de caixa mostra 1; **Solicitações ›
     Trocas de aula › Revisar troca**: aprovar sem motivo funciona na avulsa; negar sem motivo fica
     desabilitado.
  4. Como o aluno: **Frequência › Minhas trocas** mostra "Troca aprovada por {nome}".
  5. **Permanente:** numa aula de outro horário da grade semanal, tipo **Permanente**, escrever a
     justificativa e pedir. Como admin, **Revisar troca** mostra a justificativa; aprovar com
     motivo. Na semana seguinte, a grade do aluno mostra o horário novo com **Troca permanente**.
  6. Negar uma troca: o aluno vê "Troca negada" e o contato da academia; nunca quem negou.
  7. Numa aula que já passou (reposição), a folha mostra o selo **Reposição**.
  8. Com push: "Pedido de troca de aula" abre Solicitações › Trocas de aula.
  9. Tema claro e escuro: a opção escolhida, os selos e os rótulos legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção:** as migrations do 4.9b entram no mesmo `db-push-prod.bat` das anteriores (4.6b a
  4.9b), depois da `send-push` (§ 14), com o APK novo. **G4** = G1 e G3 em produção.
- **Anexos da permanente e dos pedidos:** pelo fluxo da § 8, depois do **G2**.
- **Web (D34):** pode desenvolver a troca (G3 aberto): `menu_de_aulas`, `pedir_troca_de_aula`,
  `desistir_da_troca`, `minhas_trocas`, `minhas_trocas_permanentes`.

## Próximo passo

4.10 (Perfis e Pessoas), agora sem o `historico_de_aulas_do_aluno`, que já está na `main`.
