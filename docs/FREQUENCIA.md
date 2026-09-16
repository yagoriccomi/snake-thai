# Controle de Frequência — especificação e plano

> **Estado:** Fases 0 a 3 entregues e em produção em 2026-09-14 (app 1.4.0 e
> módulo de justificativas do `snake-server`, PR #14).
> Decisões tomadas com o cliente em 2026-09-09; este documento é a fonte da
> verdade das regras de cálculo.

### Entregue na Fase 1 (2026-09-14)

- Migrations `20260914120000_motivo_justificativa_removida` (isolada) e
  `20260914120100_frequencia_fundacao`, aplicadas em produção.
- Regressão `supabase/tests/regressao_frequencia_fundacao.sql`: 22 casos,
  verdes contra o banco real, em transação com ROLLBACK.
- As 160 respostas que existiam viraram **declarações**; nenhuma virou
  presença oficial (nenhuma aula tinha chamada concluída).
- App adaptado: o aluno grava em `declared_status`; a chamada grava em
  `status`; "desfazer chamada" zera só a chamada e preserva a declaração.
  Confirmado de ponta a ponta com logins reais: o upsert do professor não
  apaga o que o aluno declarou.
- **Compatibilidade:** APKs anteriores à 1.3.0 gravam a declaração em
  `status` e passam a receber recusa do banco. Todo aparelho precisa da 1.3.0.

### Entregue nas Fases 2 e 3 (2026-09-14)

**Banco** — migration `20260914140000_frequencia_regras`, aplicada em produção;
regressão `supabase/tests/regressao_frequencia_regras.sql` com 18 casos verdes.

| Peça | Quem usa | O que faz |
| --- | --- | --- |
| `frequencia_mensal(ids[])` | aluno, professor, admin | A conta desta página, ao vivo, para vários alunos numa chamada |
| `concluir_chamada(aula)` | professor da aula, admin | Grava `attendance_taken_at`; recusa aula que ainda não começou |
| `aulas_sem_chamada()` | professor (as suas), admin (todas) | Rotinas do mês passadas há mais de 1 h sem chamada |
| `fechar_frequencia_do_mes()` | cron `close-monthly-attendance`, dia 1 às 00:20 (Brasília) | Congela o mês anterior em `attendance_monthly` |

**App** — o que cada papel vê:

- **Aluno:** card "Presença em Aulas X/Y · Frequência N%" no topo das aulas,
  que abre o histórico dos meses fechados. Ao avisar falta, uma folha oferece
  "Acrescentar justificativa?" (mensagem com contador de 255 e anexo de
  imagem ou PDF). A linha da aula mostra se a justificativa está em análise,
  aprovada ou recusada. Depois da revisão, a folha não reabre: o banco não
  aceita editar justificativa já revisada.
- **Professor / admin:** na chamada, frequência do mês por aluno, a
  justificativa com "Ver anexo", "Aprovar" e "Recusar", e toque no nome para
  abrir o histórico. Na agenda, o aviso de aulas sem chamada leva direto à aula.

### Chamada em lote (2026-09-14, app 1.6.0)

A primeira versão gravava cada toque e recarregava a lista, que voltava ao
topo. Agora:

- Uma lista só, em ordem alfabética, com ✓ e ✗ por aluno: o marcado fica
  colorido, o outro cinza. As marcações ficam **no aparelho** (ver "Rascunho da
  chamada", abaixo).
- "Concluir chamada" (ou "Salvar alterações", se já concluída) envia tudo em
  **uma** chamada a `salvar_chamada(aula, presentes[], ausentes[])`, que grava
  e conclui na mesma transação. Salvar de novo corrige sem reescrever o
  momento da conclusão.
- **Aluno sem marcação vai como falta**, e a tela avisa antes. Na conta ele já
  seria falta (aula concluída sem presença); gravar explícito evita um "sem
  marcação" enganoso ao reabrir.
- Sair com marcações não salvas pergunta: **Continuar marcando**, **Descartar**
  ou **Sair e guardar**.
- Regressão: `supabase/tests/regressao_chamada_em_lote.sql`, 12 casos verdes.
  `concluir_chamada` continua no banco para os APKs 1.4.x e 1.5.x.

### Rascunho da chamada (2026-09-16, T11)

O Android fecha o app em segundo plano; antes, uma chamada pela metade sumia
quando o professor atendia o telefone. Agora ela fica guardada até ser salva.

- **Onde:** no aparelho, cifrado (`largeSecureStore`, o mesmo da sessão), um
  rascunho por **usuário e aula** (`rollcall_draft.<usuário>.<aula>`). Tem id de
  aluno e presença/falta, sem nome. O backup do Android está desligado.
- **Quando grava:** meio segundo depois do último toque (toques seguidos viram
  uma gravação), na hora ao ir para segundo plano e ao sair da tela.
- **Ao abrir a chamada**, o que está guardado é comparado com o que está no banco:
  - **vencido** (mais de **7 dias** sem marcação nova) ou **idêntico** ao salvo →
    apagado em silêncio;
  - **conflito** → aviso "Chamada alterada por outra pessoa"; a lista mostra o que
    está salvo e fica travada até escolher **Manter o que está salvo** (apaga o
    rascunho) ou **Usar meu rascunho** (as marcações voltam; valem só depois de
    salvar);
  - senão → **"Rascunho recuperado"**, com as marcações de volta e a opção
    **Descartar rascunho** (pede confirmação).
- **Conflito, como é detectado:** o rascunho guarda a foto do que estava salvo
  quando começou (marcações e momento da conclusão). Se o banco mudou desde
  então, outra pessoa salvou. Não dá para usar datas: `attendance_taken_at` não
  muda ao salvar de novo, e `updated_at` da presença muda quando o aluno altera
  a própria declaração.
- **Apagado:** ao salvar a chamada com sucesso, ao descartar e ao **sair do
  login** (todos os rascunhos do aparelho, de qualquer usuário).
- **Limitações conhecidas:** um toque feito menos de ~0,5 s antes de o app ser
  encerrado à força, sem passar por segundo plano, pode se perder. Se outra
  pessoa salvar **enquanto** a tela está aberta, ninguém é avisado e vale quem
  salvar por último (como antes); fechar isso exige uma versão da chamada no
  banco.
- Código: `utils/rollCallDraft.ts` (regras), `services/rollCallDraft.service.ts`
  (armazenamento), `hooks/useRollCallDraft.ts` (tela) e
  `components/RollCallDraftNotice.tsx` (aviso).

**Servidor:** o anexo sobe por `POST /v1/justifications/sign-upload` e é visto
por `/view-url`, do `snake-server` (no ar desde 2026-09-14, PR #14). Se a API
estiver fora, a justificativa **só com mensagem** continua funcionando; com
anexo, o envio falha com mensagem genérica e nada é gravado.

## Por que este documento existe

As regras abaixo são fáceis de implementar de um jeito plausível e **errado** —
o denominador da porcentagem tem três exceções que não são óbvias olhando só o
código. Registrar aqui evita que uma refatoração futura "simplifique" a conta e
quebre a frequência de todo mundo em silêncio.

## O que o cliente pediu

- Cada aluno tem um contador de presença e um percentual de frequência.
- Exemplo dado: mês com 4 semanas × 3 aulas = 12 aulas. No começo do mês
  aparece `Presença em Aulas: 0/12` e `Frequência: 100%`.
- A porcentagem considera as aulas esperadas **até agora** no mês; por isso o
  dia 1 é sempre 100%.
- Registro mensal salvo, visível para aluno, professor e admin.
- **A presença só é efetivada pela chamada do professor.** O que o aluno marca
  no app é apenas sugestivo.
- Ao declarar que não vai, o aluno pode marcar "Acrescentar justificativa?",
  escrever até 255 caracteres e anexar imagem ou PDF.
- Professor ou admin aprovam a justificativa: ela **não conta como presença**,
  mas **não afeta a frequência**.

## Decisões tomadas (2026-09-09)

| Questão | Decisão | Consequência |
| --- | --- | --- |
| Aula sem chamada do professor | **Sai da conta** | Esquecimento do professor não derruba a turma inteira; a aula volta a contar quando ele fizer a chamada |
| Total de aulas esperadas | **Das aulas cadastradas na agenda** | Acompanha feriado e semana cheia sozinho; nada para configurar |
| Eventos globais (sem turma) | **Não entram** | Faltar num campeonato de sábado não derruba a frequência |
| Histórico mensal | **Fecha o mês e congela** | O passado não muda se alguém editar uma chamada antiga |

## A conta

```
presenças confirmadas pelo professor
─────────────────────────────────────────────────────  × 100
(aulas de rotina da turma, já ocorridas, COM chamada feita)
  − (justificativas aprovadas nessas aulas)
```

Com **duas** particularidades que a implementação precisa respeitar:

1. **Denominador zero devolve 100%.** É o caso do dia 1 e o do aluno cuja turma
   ainda não teve aula com chamada. Zero aulas não é 0% de frequência.
2. **O contador e a porcentagem usam bases diferentes.** `0/12` usa o total de
   aulas do mês; a porcentagem usa só as que já aconteceram. É o que faz
   "0/12 e 100%" no dia 1 ser coerente, e não uma contradição.

## Plano de execução

### Fase 0 — Corrigir a aprovação de comprovante (independente)

`approvePayment` grava `status: 'paid'` sem `paid_at`, violando a constraint
`payments_paid_at_matches_status`. Erro reproduzido no banco. Corrigir também o
`paid_at: null` na recusa, hoje ausente — uma cobrança reaberta ficaria com data
de pagamento.

### Fase 1 — Fundação de dados

- `attendance.declared_status`: o que o ALUNO declara (sugestivo). O `status`
  atual passa a significar **somente a chamada do professor**. Os dados
  existentes são declarações de aluno → migram para `declared_status`, deixando
  a chamada vazia (coerente com "aula sem chamada sai da conta").
- `classes.attendance_taken_at`: marca a chamada como concluída. **É o campo que
  viabiliza a decisão da tabela acima** — sem ele não há como distinguir "aula
  sem chamada" de "aula em que todos faltaram".
- `absence_justifications`: mensagem (limite de 255 no BANCO, não só na tela),
  anexo reusando o caminho Cloudinary dos comprovantes — inclusive a fila de
  eliminação LGPD, sem inventar um segundo mecanismo —, status
  pendente/aprovada/recusada, quem revisou e quando.
- `attendance_monthly`: fecha o mês anterior no dia 1, no mesmo cron das
  mensalidades.

### Fase 2 — Regras no banco

Função de cálculo + regressão SQL rodada contra o banco real (mesmo método da
geração de mensalidades). RLS: o aluno cria e vê a própria justificativa; o
professor **daquela aula** e o admin aprovam.

### Fase 3 — Telas

- **Aluno:** card com contador e percentual, histórico dos meses fechados, e a
  checkbox "Acrescentar justificativa?" ao declarar ausência.
- **Professor/Admin:** botão "Concluir chamada" (é o que efetiva as presenças),
  fila de justificativas e a frequência por aluno.

## Aviso de aula sem chamada (decidido em 2026-09-14)

`attendance_taken_at` cria uma responsabilidade nova: se o professor nunca
concluir a chamada, aquelas aulas somem da conta de todos — em silêncio. Por
isso, quando uma aula de rotina passa sem chamada concluída:

- **o admin** é avisado (de todas as aulas);
- **os professores daquela aula** são avisados (só das suas).

O aviso é **dentro do app** — o projeto não tem push notification
(`expo-notifications` não está instalado). A lista vem de uma consulta ao
banco, protegida por RLS, e não de estado guardado no aparelho: assim ela some
sozinha no momento em que alguém conclui a chamada, sem sincronização manual.

Push de verdade (avisar com o app fechado) fica registrado como evolução
possível, não incluída no escopo.
