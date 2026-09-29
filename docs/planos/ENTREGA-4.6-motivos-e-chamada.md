# Entrega — 4.6 Motivos e chamada nova

> Modo 🔁 Loop, 2026-09-29. Plano: [`PLANO-4.6-motivos-e-chamada.md`](PLANO-4.6-motivos-e-chamada.md).
> PRs: **#62** (4.6a, motivos), **#63** (4.6b, chamada no banco), **#64** (4.6c, chamada no app)
> e **#65** (4.6d, chamadas pendentes).

## O que mudou

### Banco

- `20260929140000_motivos.sql`:
  - `criar_motivo`, `pode_anexar_ao_motivo`, `anexar_ao_motivo`, `motivos_da_aula` e
    `marcar_retificacao_conferida`;
  - os crons `delete-unused-reasons` (24 h) e `expire-attachments` (180 dias da decisão, com a
    P21 antes).
- `20260929150000_chamada_nova.sql`:
  - `origens_da_chamada` (uma função só decide quem está na chamada), `lista_da_chamada`,
    `professores_da_chamada`, as duas buscas e `chamadas_pendentes`;
  - `salvar_chamada_v2` com as regras 1 a 8 da § 7.2;
  - o gatilho das trocas pela presença (T35);
  - `salvar_chamada` e `concluir_chamada` com a T47;
  - `aulas_sem_chamada` sem a aula cancelada.
- Regressões `regressao_motivos.sql` (M1–M11) e `regressao_chamada_nova.sql` (C1–C17);
  `regressao_chamada_em_lote.sql` ajustada à § 15.

### App

- **Chamada nova** (`FrequenciaScreen`) em blocos, com professores, incluir aluno, acrescentar
  professor, selos, a folha **Retificar** e o rascunho **v2**.
- **Chamadas pendentes**: o botão na agenda e a tela com Minhas e Todas.
- Removidos: `MissedRollCallBanner`, `useMissedRollCalls`, `useClassAttendance`,
  `useRollCallReview`, `useMonthlyFrequency`, `JustificationReview` e as funções que só eles
  usavam.

## Como validar

- `scripts\db-dev test` e `scripts\db-dev reset` (verdes); `npx tsc --noEmit` e Jest (verdes).
- **Roteiro no aparelho** (banco local recriado, app DEV, contas de demonstração):
  1. Como **professor**, abrir uma aula da turma dele que já começou: os blocos **Professores**
     e **Da turma** aparecem. Ele começa presente; o outro professor da aula precisa ser marcado
     antes de concluir ("Confirme se cada professor deu a aula.").
  2. **Incluir aluno que apareceu**: buscar com 1 letra não busca; com 2, aparecem os ativos que
     não estão na lista. O escolhido entra em **Incluídos**, como presente.
  3. Sair da tela no meio e voltar: a chamada volta **com o incluído** ("Rascunho recuperado").
  4. **Concluir chamada**: a confirmação diz quantos viram falta e quantos ficam sem registro.
     Depois, a aula mostra o selo **Concluída**.
  5. Mudar uma presença e tocar em **Retificar chamada**: a folha lista a alteração e só salva
     com motivo. Depois, o selo **Editada** aparece, e o aluno recebe o aviso "Chamada
     corrigida".
  6. Como professor, depois da conclusão, os ✓/✗ dos professores ficam travados. Como **admin**,
     dá para corrigir.
  7. Uma aula de ontem sem chamada aparece no botão **Chamadas pendentes** da agenda, com "há 1
     dia". O admin vê **Todas**; o professor, não.
  8. Aluno com **troca pendente** para a aula aparece em **Trocas**, com "Marcar presença aprova a
     troca.". Marcar presença e concluir: a troca vira aprovada, e o aluno recebe "sua presença
     confirmou a troca".
  9. Com o **APK 1.8** (se houver aparelho com ele), a chamada dessa aula com troca responde
     "Atualize o aplicativo para fazer a chamada desta aula."
  10. Tema claro e escuro: selos, ✓/✗ e o contador legíveis nos dois.

## Pendências

- **Aparelho:** o roteiro acima, pelo dono.
- **Produção:** as duas migrations entram no próximo `db-push-prod.bat`, pelo dono. **O APK novo
  precisa sair junto:** a partir delas, o APK 1.8 não faz a chamada de aula com troca, extra,
  aluno que mudou de turma depois dela ou só para livres, e não corrige chamada já feita (§ 15).
- **Anexos da retificação:** depois do G2 (rotas `/v1/motivos/*` do servidor).
- **Decidir justificativa:** saiu da chamada e volta em Solicitações (4.8).
- **Achado do 4.5, ainda aberto:** o token `info` do tema é ilegível no escuro.

## Próximo passo

4.7 (cancelar e reativar aula).
