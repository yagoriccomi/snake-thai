# Controle de Frequência — especificação e plano

> **Estado:** Fases 0 e 1 entregues em 2026-09-14; Fases 2 e 3 pendentes.
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

Ainda **não** existem: a função de cálculo, a conclusão da chamada
(`attendance_taken_at` só é gravável pelo admin até a Fase 2), o fechamento
mensal, o aviso de aula sem chamada e as telas de justificativa e frequência.

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
