# Entrega — 4.8 Justificativas novas

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.8-justificativas.md`](PLANO-4.8-justificativas.md).
> PRs: **#69** (4.8a, banco) e o do 4.8b (app).

## O que mudou

- **Banco (`20260929170000_justificativas.sql`):**
  - as 7 RPCs da § 9.1 e `pode_decidir_justificativa`;
  - a RLS nova: quem decide vê o atestado **só enquanto pendente** (D22);
  - o aviso `justificativa_pendente` para quem pode decidir e os avisos da decisão;
  - o UPDATE direto de status pelo APK 1.8 recebe "Atualize o aplicativo para decidir
    justificativas." (§ 15).
- **App:**
  - a folha da justificativa com o **motivo obrigatório**; se o anexo falhar, a justificativa fica
    só com o texto e a folha avisa;
  - **Justificar semana** na tela Frequência do próprio aluno livre, com o prazo, quantas restam e
    o estado das que já foram;
  - **Minhas justificativas**, com os rótulos da § 3, o **Reenviar** (uma vez, em até 7 dias) e o
    bloco de contato na 2ª negada;
  - **Justificativas para revisar**, com **Ver anexo** e a folha **Aprovar / Negar** com nota
    obrigatória, e o atalho com contador na agenda da equipe;
  - "Justificativa recusada" passa a "Justificativa negada" (§ 3);
  - o toque no aviso abre a tela da justificativa.

## Como validar

- `scripts\db-dev test` e `reset` (verdes, no 4.8a); `npx tsc --noEmit` e Jest (verdes).
- **Roteiro no aparelho** (banco local, app DEV):
  1. Como **aluno fixo**, tocar em **Não vou** numa aula da grade que ainda aceita justificativa e
     marcar **Acrescentar justificativa?**: sem motivo, o botão fica desabilitado; com motivo, envia.
  2. Tocar de novo em **Não vou** na mesma aula: a folha não abre mais.
  3. Como **professor da aula**: a agenda mostra **Justificativas para revisar · 1**. Abrir,
     tocar em **Revisar**, tentar **Negar** sem nota (desabilitado) e negar com nota.
  4. Como o aluno: **Frequência › Minhas justificativas** mostra "Justificativa negada · você pode
     reenviar até dd/mm". **Reenviar** com um texto novo.
  5. Como o professor: a justificativa volta com o selo **2ª tentativa**. Negar de novo.
  6. Como o aluno: o rótulo manda procurar a academia e mostra o bloco de contato; sem **Reenviar**.
  7. Como **aluno livre**, na tela Frequência: o cartão **Justificativas** mostra a semana com
     "Até dd/mm · restam N justificativas". **Justificar semana**; o professor que deu aula naquela
     semana aprova, e o aluno vê "Justificativa aprovada por {nome}".
  8. Com anexo (se a Cloudinary estiver configurada no DEV): **Ver anexo** abre o arquivo; depois
     da decisão, o professor não o vê mais.
  9. Com push: o aviso de justificativa para revisar abre a lista; o de aprovada ou negada abre
     Minhas justificativas.
  10. Tema claro e escuro: os rótulos (em análise, aprovada, negada) legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção:** a migration do 4.8a entra no mesmo `db-push-prod.bat` do 4.6b e do 4.7a, depois
  da `send-push` (§ 14), com o APK novo.
- **Anexos pela rota nova (G2):** `sign-upload {justificationId}` + `anexar_a_justificativa`; até
  lá, o anexo da aula usa a rota por aula, e a semana e o reenvio vão sem anexo.
- **Web:** Minhas justificativas e o reenvio (D34) são do `snake-web`, com as mesmas RPCs.

## Próximo passo

4.9a (Solicitações): a categoria **Faltas de alunos** passa a abrir esta lista.
