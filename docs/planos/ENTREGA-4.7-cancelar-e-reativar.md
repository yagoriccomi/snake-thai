# Entrega — 4.7 Cancelar e reativar aula

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.7-cancelar-e-reativar.md`](PLANO-4.7-cancelar-e-reativar.md).
> PRs: **#66** (4.7a, banco), **#67** (4.7b, `send-push`) e **#68** (4.7c, app).

## O que mudou

- **Banco (`20260929160000_cancelar_aula.sql`):**
  - `cancelar_aula` e `reativar_aula`, com o motivo, o limite de 2 por professor e as trocas da
    T50/D57;
  - os avisados por `destinatarios_da_aula` (D25, T22, T42) e a prévia `quem_sera_avisado`;
  - o primeiro cancelamento fura o silêncio para os alunos;
  - a obsolescência da § 10 em `reivindicar_notificacoes`.
- **`send-push`:** os 10 tipos do contrato v4 com os textos da § 10, o corpo da justificativa
  semanal e um `default` que não derruba o lote.
- **App:**
  - no detalhe da aula, **Cancelar aula** (perigo) para a equipe da aula e os admins;
  - a folha com quem será avisado, o motivo obrigatório e a confirmação;
  - a aula cancelada com o selo **Cancelada**, título e hora riscados, o cartão **Cancelamento**
    (só para a equipe e os admins), o aviso do abono e **Reativar aula**;
  - o toque nas notificações novas abre Aulas.

## Como validar

- `scripts\db-dev test` e `reset` (verdes); `deno test supabase/functions/send-push/` (11);
  `npx tsc --noEmit` e Jest (verdes).
- **Roteiro no aparelho** (banco local, app DEV):
  1. Como professor, abrir uma aula **futura** dele e tocar em **Cancelar aula**: a folha diz
     "A aula ainda não aconteceu. O aviso sai agora, mesmo à noite, para: …", com os números de
     fixos e livres, os outros professores e os admins.
  2. Tentar sem motivo: o botão fica desabilitado. Com motivo, a aula fica riscada, com o selo
     **Cancelada** e o cartão **Cancelamento** (por quem, quando e o motivo).
  3. Como **aluno** da turma: a aula aparece riscada em Aulas, sem o motivo.
  4. **Reativar aula**: pede motivo, a aula volta ao normal.
  5. Cancelar e reativar de novo; na terceira tentativa, o professor recebe "Você já cancelou esta
     aula duas vezes. Peça ao admin." O admin cancela sem limite.
  6. Cancelar uma aula que **já passou**: a folha diz que o aviso vai só para a equipe.
  7. Com aparelho registrado para push, o aluno recebe "Aula cancelada" na hora, mesmo à noite; a
     reativação espera o fim do silêncio.
  8. Tocar na notificação abre a aba Aulas.
  9. Tema claro e escuro: o botão de perigo, o selo e o texto riscado legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção, nesta ordem (§ 14):** publicar a `send-push` (Edge Function) **antes** das
  migrations do 4.6b e do 4.7a; depois, o `db-push-prod.bat`; o APK novo sai junto.
- **Anexos do motivo:** depois do G2.
- **`quem_sera_avisado`** está fora da lista de funções do contrato (só o app a usa): entra numa
  linha do contrato na próxima revisão.

## Próximo passo

4.8 (justificativas novas).
