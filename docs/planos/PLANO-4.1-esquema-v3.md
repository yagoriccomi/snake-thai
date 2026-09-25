# Plano — Esquema completo do contrato v3 (bloco 4.1, abre o G1)

> Modo 🔁 Loop, a partir de 2026-09-25. Branch `feat/esquema-v3`. Contrato
> [`docs/CONTRATO.md`](../CONTRATO.md) v3 (revisão de 25/09): § 0.1, § 4 a § 10 (a parte de dados),
> § 5.2, § 5.4 e a conferência do G1 (§ 14). Roadmap: bloco 4.1.

## Enunciado canônico

- **Problema:** nada da v3 existe no banco. Todos os blocos seguintes (4.2 a 4.11), o servidor
  (teste integrado de `motivos`) e a web dependem das tabelas, dos enums e das travas.
- **Resultado esperado:** o esquema inteiro da v3 no banco local e na `main`, **sem as RPCs de
  comportamento**, com os backfills feitos e a conferência do G1 dando os números do § 14.
- **Como validar:** `supabase/tests/regressao_esquema_v3.sql` (a conferência do G1 e as regras do
  § 0.1) e os testes antigos continuando verdes; depois, `scripts\db-dev test` e
  `scripts\db-dev reset` (os dois recriam o banco local: só no fim, avisando os outros chats).

## Fatias (uma migration cada, na ordem)

| # | Migration | Conteúdo |
| --- | --- | --- |
| 1 | `…_v3_valores_de_enum` | **Isolada** (§ 0.1 regra 6): os 10 valores de `notification_kind` e os 2 de `media_deletion_reason` |
| 2 | `…_v3_enums_e_colunas` | Os 7 enums da § 5.1; colunas de `plans`, `class_schedules`, `classes`, `attendance`, `absence_justifications` e `academy_settings` (`contact_whatsapp` por último); `sem_repeticao`; constraints `NOT VALID` → conferência → `VALIDATE` |
| 3 | `…_v3_motivos_e_solicitacoes` | `action_reasons`, `action_reason_attachments` (gatilho de 5 anexos e o de fila), `roll_call_requests`, `attendance_audit`, `class_teacher_presence`, `class_audit`, `absence_justification_reviews`, `absence_justification_attempts`; gatilho de fila da justificativa com `'anexo_expirado'` |
| 4 | `…_v3_trocas` | `class_swaps`, `class_swap_reviews`, `class_swap_periods` (constraints e índices parciais da § 9.4), `cancelar_troca_de_aula_apagada` |
| 5 | `…_v3_periodos` | `plan_periods`, `inactive_periods`, `weekly_goals`, `student_group_periods` com os backfills (T52: antes do gatilho); `registrar_periodo_de_turma` com a T53; `enforce_plan_in_use_rules`; `excluir_turma` e `previa_exclusao_turma` (arquivar e `'group_closed'`) |
| 6 | `…_v3_leitura_e_travas` | `pode_ler_motivo` (e as políticas dos motivos), `grade_efetiva_do_fixo`, `enforce_class_state_rules`, `enforce_attendance_rules` (insert/update/delete; sai a política de delete), `enforce_absence_justification_rules` reescrito (+ `week_start not null`), o `grant` por coluna de `class_teachers`, `trg_academy_settings_proteger_guarda_de_anexos` |

Cada fatia é aplicada no banco local com `supabase migration up --local` (não apaga nada) e
testada antes da próxima.

## Escopo negativo [#8]

- **Sem RPC de comportamento** (declarar, chamada, justificativa, troca, frequência): são dos
  blocos 4.3 a 4.11. `pode_decidir_troca` e `pode_decidir_justificativa` entram só se
  `pode_ler_motivo` precisar delas; do contrário, a regra fica dentro de `pode_ler_motivo`.
- **§ 4 (admin é professor)** é o 4.2. **Grade, `registrar_periodo_de_plano` e
  `registrar_periodo_inativo`** são do 4.3 (os backfills de `plan_periods` e `inactive_periods`
  ficam aqui).
- **Nada em produção.** A publicação é a 2.0.0 (4.13), na ordem do § 14.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | `absence_justifications.week_start` nasce **nulo** na fatia 2 (com backfill) e vira `not null` na fatia 6, junto do gatilho que o preenche. | Entre as duas fatias, o upsert do APK 1.8 no banco local continuaria funcionando. |
| P2 | `contact_email = ''` vira `null` antes do `VALIDATE`. | O app já grava `null`; `''` e `null` significam "sem e-mail". |
| P3 | `classes.audience` das aulas existentes = `'both'` (o padrão). | O contrato diz "copiada da grade", e toda grade existente nasce `'both'`. |
| P4 | Testes de regressão num arquivo novo por fatia grande, com o padrão dos atuais (transação + `rollback`, `raise exception 'FALHOU …'`). | Convenção local. |

## Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Constraint nova recusar dado de produção no `db push` | Conferência explícita antes de cada `VALIDATE`, com mensagem que diz o que corrigir; no banco local os dados de demonstração passam (conferido) |
| Trava nova quebrar o APK 1.8 | Os casos da § 15 viram teste (upsert de justificativa, `update` de `group_id`, promoção com `color: null`) |
| Banco local compartilhado | Só `migration up --local`; `test`/`reset` no fim, com aviso |

**Rollback** [#84]: no local, `scripts\db-dev reset` a partir da `main`. Em produção, nada sai
deste bloco sozinho.

## Definição de pronto (G1)

- [ ] Fatias 1–6 aplicadas no local, testes verdes
- [ ] `scripts\db-dev test` e `scripts\db-dev reset` verdes
- [ ] `scripts\db-dev types` e `npm run ci`
- [ ] Merge na `main` (dono)
- [ ] Conferência do G1 no banco local = 15 · 3 · coluna · função · gatilho · 0
- [ ] **"G1 aberto em dd/mm" no Registro**

## Progresso

| Fatia | Estado |
| --- | --- |
| 1 | ✅ aplicada no local (25/09); os 12 valores conferidos |
| 2 | ✅ aplicada no local (25/09); `regressao_esquema_v3.sql` F2.1–F2.8 verde; fixtures antigas com caminho fictício ajustadas ao formato real |
| 3 | — |
| 4 | — |
| 5 | — |
| 6 | — |

## Achados durante a execução

1. **`sem_repeticao` precisa de `grant` para `authenticated`.** Ela roda dentro da constraint com a
   permissão de quem grava: sem o grant, o admin tomava `permission denied` ao salvar
   Configurações. É pura (não lê tabela), então o grant não expõe nada. Coberto pelo F2.6.
2. **Errata do contrato (para o dono aprovar, v3 → v4): `plans_cota_coerente`.** O texto da § 5.2
   (`schedule_mode = 'free' and weekly_quota between 1 and 6`) deixa passar o plano livre **sem
   cota**: com a cota nula, `between` dá nulo, e um `check` nulo passa. A migration usa
   `weekly_quota is not null and weekly_quota between 1 and 6`, que é o que o texto pretende (D2).
   Mesmo nome, mesma regra; muda só a escrita SQL. As próximas fatias conferem esse padrão
   (`check` que dá nulo) em toda constraint do contrato.
3. **Fixtures antigas com caminho fictício** (`comprovantes/aaaa/bbbb`, `justificativas/t6/c003`…)
   em 4 testes: violavam as constraints novas de caminho. Ajustadas ao formato que o app e o
   servidor gravam de verdade (conferido no código dos dois).
4. **`regressao_frequencia_fundacao.sql` falha no banco local com dados de demonstração**
   (`profiles_cpf_key`): colide com um CPF da demonstração, não com as fatias. Precisa passar no
   `scripts\db-dev test` (banco limpo), no fim.
