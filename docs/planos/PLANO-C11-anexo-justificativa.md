# Plano — C11 Anexo da justificativa pela rota nova

> Modo Loop (coordenação de 07/10). Item C11 do 4.8 no ROADMAP-thai.md, risco médio da
> `REVIEW-FASE4.md`. Entra antes da 2.0.0, num PR próprio, **sem merge pelo chat**: a ordem com o
> `db-push-prod` (G4) é decisão do dono.

## Enunciado canônico

- **Problema:** o anexo da justificativa ainda sobe pela rota por aula (`{ classId }`) e o app grava
  `proof_*` direto na tabela. Com isso, o aluno pode escrever no próprio anexo um caminho de outra
  tentativa (`<id>-2` na tentativa 1), e a semana e o reenvio ficaram sem anexo até o G2.
- **Resultado esperado:** o app sobe o arquivo por `POST /v1/justifications/sign-upload
  { justificationId }` e liga o anexo por `anexar_a_justificativa`; o caminho novo só entra pela RPC;
  o `-2` só vale na tentativa 2; a semana e o reenvio passam a aceitar anexo.
- **Como validar:** `scripts\db-dev.bat test` (J13 e T14 novos), `reset` e `types` sem diferença da
  C11; `npx tsc --noEmit` e o jest dos arquivos tocados, e a suíte inteira no hook do commit.

## Escopo negativo [#8]

- ~~Não tira `proof_*` de vez da escrita direta: o upsert legado do APK 1.8/1.9 e da web atual grava
  `justificativas/<user_id>/<class_id>` até o G6 (§ 15). Isso fica para a Fase B.~~ **08/10, D42
  revista da coordenação:** tira, já no `db-push-prod` da 2.0.0. O upsert antigo segue só com o
  texto; com anexo, `22023`.
- Não muda o servidor nem o `view-url` (D27: sem `attempt` até o G4).
- Sem tela nova e **sem mockup**: a folha da justificativa reaproveita o seletor de imagem e de PDF
  que a aula já tinha; a semana e o reenvio só deixam de escondê-lo.
- Não publica nada: nenhum `db-push-prod`.

## Conferência da D27 (#39 do servidor)

O `view-url` aceita os três caminhos derivados (`<id>`, `<id>-2` e `<class_id>`) e escolhe o que for
igual ao `proof_public_id`, sem olhar o `attempt`. Amarrar o `-2` ao `attempt` no banco **só restringe
o que pode ser gravado**; todo caminho que a constraint nova aceita continua sendo um dos três que o
servidor lê. **Não há conflito.** Para o G4 (servidor): com a flag ligada, o `view-url` pode passar a
aceitar só o caminho da tentativa atual.

## Premissas assumidas (modo Loop)

1. Escrita direta do dono: só o anexo nulo ou o legado (`cloudinary` + `<class_id>`). O caminho novo
   só pela RPC, e depois de gravado não muda por UPDATE direto. Mantém a § 15 sem quebrar ninguém. [#51]
2. Constraint `absence_justifications_caminho_do_anexo` recriada `NOT VALID`, com a conferência dos
   dados antigos antes do `VALIDATE` (padrão da § 0.1). [#87][#89]
3. O app trata a falha do upload **e** a recusa da RPC do mesmo jeito: a justificativa fica só com o
   texto e a folha mostra o aviso (§ 9.1, fluxo 3).
4. A prop `permiteAnexo` da folha sai: existia só para a pausa até o G2 e ninguém mais a desliga. [#7]
5. `overwrite` e `allowed_formats` entram no upload só quando o servidor os assina (§ 13.2); o
   comprovante e o `{ classId }` legado não os recebem.

## Passos

1. Migration `20261007120000_c11_anexo_justificativa.sql`: gatilho e constraint.
2. Regressão: J13 em `regressao_justificativas.sql`; T14a da fundação passa pela RPC.
3. `cloudinaryUpload.ts`: repassa `overwrite` e `allowed_formats` assinados.
4. `justifications.service.ts`: `{ justificationId }` + `anexar_a_justificativa`, anexo na semana e
   no reenvio; o app não grava mais `proof_*`.
5. Telas: Justificar semana e Reenviar com anexo e com o aviso de anexo que falhou.
6. Contrato (errata da § 9.1), ROADMAP (C11 e Registro).

## Riscos e rollback [#84]

- **APK 1.8/1.9 sobre uma linha com anexo novo:** o upsert legado com `proof_*` diferente é recusado
  (`42501`). Só acontece se o mesmo aluno usar o app novo e o velho na mesma justificativa pendente.
- **Ordem com o G4:** o app novo chama `anexar_a_justificativa` e o servidor lê `attempt`; as duas
  coisas só existem em produção depois do `db-push-prod`. A 2.0.0 sai depois do G4, como já previsto.
- **Rollback:** uma migration nova que recria o gatilho da `20260929170000` e a constraint anterior.

## Definição de pronto

Gates do banco verdes, typecheck e jest verdes, PR pronto para revisão e **sem merge**; o handoff diz
o que espera pelo dono.
