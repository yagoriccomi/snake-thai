# Entrega — Esquema completo do contrato v3 (bloco 4.1, abre o G1)

> 2026-09-25 · Modo 🔁 Loop · Branch `feat/esquema-v3` · Plano:
> [`PLANO-4.1-esquema-v3.md`](PLANO-4.1-esquema-v3.md) (com os 12 achados da execução).

## O que mudou

| Migration | Conteúdo |
| --- | --- |
| `20260925200000_v3_valores_de_enum` | 10 tipos de notificação e 2 motivos de exclusão, isolados |
| `20260925200100_v3_enums_e_colunas` | 7 enums; colunas de plano, grade, aula, chamada, justificativa e configuração; constraints de caminho de anexo e de e-mail (`NOT VALID` → conferência → `VALIDATE`) |
| `20260925200200_v3_motivos_e_solicitacoes` | motivos e anexos, solicitações, auditoria da chamada e da aula, decisão e 1ª tentativa da justificativa |
| `20260925200300_v3_trocas` | `class_swaps`, `class_swap_reviews`, `class_swap_periods`, gatilho da aula apagada (T39, T50) |
| `20260925200400_v3_periodos` | históricos de plano, trancamento, meta e turma, com backfills; `registrar_periodo_de_turma` (T51–T53); `excluir_turma` arquiva; `is_staff()` |
| `20260925200500_v3_leitura_e_grade` | `pode_decidir_troca`, `pode_ler_motivo` e políticas; `grade_efetiva_do_fixo`; trava do prazo de guarda; `class_teachers` por coluna |
| `20260925200600_v3_travas` | travas de aula, equipe, chamada e justificativa; compatibilidade da `salvar_chamada`/`concluir_chamada`; `plano_da_semana` e `cota_da_semana` |

Fora do banco: tipos gerados, `groups.service.ts` (horário sem turma) e fixtures de teste.

## Verificação

- `supabase/tests/regressao_esquema_v3.sql`: **49 casos**, a maioria de falha, e a
  **conferência do G1** (15 · 3 · `contact_whatsapp` · `pode_ler_motivo` · gatilho · 0) verde no
  banco local.
- Os 22 testes SQL antigos verdes no banco local, exceto `regressao_frequencia_fundacao`, que
  colide com um CPF dos dados de demonstração (não com o 4.1). O CI deste PR roda tudo num banco
  limpo.
- `npm run ci`: tipos, 762 testes e licenças.

## O que muda para quem usa o app hoje (APK 1.8 e app DEV)

- **A chamada continua funcionando** (`salvar_chamada` e `concluir_chamada` com a compatibilidade).
- **Decidir justificativa pelo APK 1.8** passa a responder *"Atualize o aplicativo para decidir
  justificativas."* (§ 15). Volta com o app novo, no bloco 4.8.
- **Professor não entra mais numa aula que já começou** nem numa aula cancelada por fora da chamada.
- **Justificar** só vale para uma aula da grade do aluno, dentro de 7 dias.
- Nada disso vai para produção antes da 2.0.0 (4.13), na ordem do § 14.

## Para o dono aprovar

1. **Errata do contrato `plans_cota_coerente`** (achado 2 do plano): o texto da § 5.2 deixaria
   passar o plano livre sem cota. A migration faz o que o texto pretende. **Recomendação:**
   corrigir o texto na v4, junto de uma nota na § 0.1 sobre `check` que dá nulo.
2. **O banco local** recebeu as 7 migrations por `migration up` (sem apagar nada). O
   `scripts\db-dev reset` (que recria o banco com os dados de demonstração) fica para quando os
   chats do servidor e da web não estiverem usando o banco local: me diga quando.

## Próximo passo

Merge deste PR → **G1 aberto** (anotado no Registro, com a conferência no banco local) → 4.2
(admin é professor) e 4.3 (planos, grade, dias de aula e contato).
