# Plano — 4.3 Planos, grade, dias de aula e contato

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 5, § 5.4, § 6, T3, T4, T7, T37, T39 e T44.
> Mockups: linha A (Planos, Novo horário, Dias de aula) e linha H (contato da academia e "Falar
> com a academia"). Depende do G1.
> **Três PRs:** 4.3a (banco), 4.3b (planos, configurações e contato) e 4.3c (grade: público,
> "só livres" e avisos de troca).

## Enunciado canônico

- **Problema:** o esquema da v3 existe desde o 4.1, mas nada o usa. O plano não guarda
  histórico ao mudar, a grade não tem público nem horário sem turma, o fim de um horário
  deixa trocas permanentes órfãs, e não há contato da academia.
- **Resultado esperado:**
  - o admin cria planos fixo, livre (com cota de 1 a 6) e à vontade;
  - a grade tem "Quem pode participar" e horário "só livres" sem turma;
  - encerrar ou mudar o fim de um horário acompanha as trocas permanentes, e a tela avisa antes;
  - Configurações ganham Dias de aula e WhatsApp;
  - todos têm "Falar com a academia", e o bloco de contato fica pronto para os negados.
- **Como validar:**
  - `regressao_planos_grade_contato.sql` (B1 a B11) e `scripts\db-dev test` verdes;
  - Jest verde;
  - no aparelho, o roteiro da entrega.

## Escopo negativo [#8]

- **O recálculo do mês fechado (T31)** que os encerramentos pedem entra com a conta nova, no
  4.5. Antes disso não existe mês fechado pela conta nova.
- **Meta semanal e menu de aulas** ficam para o 4.4. O `default_weekly_goal` fica sem tela
  aqui, porque o mockup não traz.
- **Trancar e mudar plano pela tela:** os gatilhos valem para qualquer caminho, inclusive o APK
  1.8. As telas continuam as de hoje (a ficha do aluno é o 4.10).
- Nada vai para a produção antes da 2.0.0.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | `p_audience` entra **no fim** da assinatura de `salvar_horario_da_grade` | As chamadas de hoje, por posição (testes) ou por nome (app), continuam valendo [#28] | — |
| P2 | Horário sem turma e com público diferente de `'free'` é recusado com `22023`, *"Horário sem turma só pode ser para alunos de horário livre."* | Mensagem legível antes de a constraint (T7) falar em inglês | Troca de texto |
| P3 | A **1ª semana não fixa** é a atual se o 1º dia de aula dela ainda não começou; senão, a seguinte | T3 literal: a modalidade da semana é a do instante 00:00 do 1º dia de aula | — |
| P4 | A avulsa "da semana" que deixa de ser fixa = a semana da **aula original** | A troca sai da aula original, que é o que a grade tira | — |
| P5 | Adiar ou antecipar um fim também cancela as permanentes pendentes do horário | "`valid_until` novo **ou mudado**" (§ 6) | Afrouxar é uma linha |
| P6 | A geração só adota aula avulsa **não cancelada**, e a adoção sem turma casa `group_id` nulo com nulo | § 6: "nunca apagam nem alteram aula cancelada" | — |
| P7 | Criar `inicio_da_semana_de_aula` e fazer `plano_da_semana` usá-la (mesma regra) | A T3 num lugar só [#6] | — |
| P8 | Plano com histórico: o app mostra a recusa do banco (T4) com a frase dele, em vez de adivinhar antes | O banco é quem sabe se há histórico [#7] | Ler `plan_periods` antes, se o dono pedir |

## Decisão visual

- **Superfície visual:** sim (4.3b e 4.3c).
- **Mockups:** já aprovados (linhas A e H). Nenhum mockup novo.
- **`design-de-interface-projeto`:** acionada em cada PR de tela.

## Passos — 4.3a (banco)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| a1 | `20260929110000_planos_grade_contato.sql` | `inicio_da_semana_de_aula` e `plano_da_semana` lendo dela | [#6] | Suíte existente |
| a2 | idem | Gatilho `registrar_periodo_de_plano`, com a T39 de deixar de ser fixo e a volta a fixo | [#87] | B1 a B3 |
| a3 | idem | Gatilho `registrar_periodo_inativo`, com a T39 do trancamento | [#87] | B4 |
| a4 | idem | `ajustar_trocas_ao_fim_do_horario` (interna) | [#6] | B7, B8 |
| a5 | idem | `ocorrencias_da_grade` (DROP + CREATE, `left join` e `audience`) e `gerar_aulas_da_grade` (copia o público) | [#87] | B5 |
| a6 | idem | `salvar_horario_da_grade` (DROP + CREATE, com `p_audience`, turma opcional para livres, público propagado, cancelada intocada e o fim acompanhando as trocas) | [#28] | B5 a B7 |
| a7 | idem | `encerrar_horario_da_grade` e `excluir_turma` (mesmas assinaturas; nunca apagam a cancelada; fim das trocas) | [#89] | B8, B11 |
| a8 | idem | `trocas_permanentes_do_horario` (só admin) e `contato_da_academia` (logado) | [#55] | B9, B10 |
| a9 | `supabase/tests/regressao_planos_grade_contato.sql` | B1 a B11, com os caminhos de recusa | [#41] | `db-dev test` |
| a10 | `src/types/database.types.ts` | `scripts\db-dev types` | [#11] | `tsc` |

## Passos — 4.3b (planos, configurações e contato)

| # | Arquivo | O que muda |
| --- | --- | --- |
| b1 | `plans.service.ts` e `PlanosScreen.tsx` | Modalidade (três) e cota em escada de 1 a 6, só no livre. A recusa da T4 com a frase do banco |
| b2 | `settings.service.ts` e `ConfiguracoesScreen.tsx` | **Dias de aula** (chips de Seg a Dom, com seg–sáb ligados, pelo menos um) e **WhatsApp** com **+55** fixo, validado como o banco (`^55[1-9][1-9][0-9]{8,9}$`) |
| b3 | `src/services/contato.service.ts` + `src/utils/contato.ts` | `contato_da_academia()`, links `wa.me` e `mailto:`, e o WhatsApp exibido como `+55 (DD) NNNNN-NNNN` |
| b4 | `src/components/BlocoDeContato.tsx` | "Para mais informações, fale com a academia:" + botões (só os preenchidos). Sem contato, só a frase. Pronto para o 4.8, o 4.9a e o 4.9b |
| b5 | `DadosScreen.tsx` | Seção **Falar com a academia** (todos), com a reserva *"A academia ainda não cadastrou um contato. Procure a recepção."* |
| b6 | `ExcluirTurmaSheet.tsx` | Texto da D58: *"A frequência dos alunos continua contando as aulas desta turma até agora."* |

## Passos — 4.3c (grade)

| # | Arquivo | O que muda |
| --- | --- | --- |
| c1 | `schedules.service.ts` | `p_audience`, turma opcional, horários sem turma e `trocas_permanentes_do_horario` |
| c2 | `HorarioFormScreen.tsx` | "Quem pode participar" (Fixos · Livres · Fixos e livres). No "só livres" sem turma, a turma aparece como "Sem turma — só livres" |
| c3 | `GradeTurmaScreen.tsx` e `TurmasScreen.tsx` | Entrada **Aulas só para livres** (horários sem turma). Antes de encerrar ou editar: **"{n} aluno(s) têm troca permanente com este horário."** |

## Riscos e rollback [#84]

- **APK 1.8 com o banco novo:** o `salvar_horario_da_grade` sem `p_audience` cria `'both'` e
  mantém na edição (§ 15). Mudar o plano ou trancar pelo APK 1.8 passa pelos gatilhos, como
  deve ser.
- **Os dados de demonstração** passaram pelo gatilho novo no `db-dev reset`: 50 de 50 alunos
  com plano ficaram com o período aberto certo.
- **Rollback:** migration nova que volta às definições anteriores. É só função e gatilho, sem
  dado apagado.

## Definição de pronto

- [ ] 4.3a: `db-dev test` e `reset` verdes, tipos gerados, PR mesclado com o CI verde
- [ ] 4.3b e 4.3c: Jest e `tsc` verdes, PRs mesclados
- [ ] Roteiro de aparelho na entrega; roadmap e Registro atualizados
