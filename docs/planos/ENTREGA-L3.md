# ENTREGA — L3: aviso de rotina automática com falha

| Campo | Valor |
|---|---|
| **Tarefa** | `L3` (lacuna do revisor) |
| **Plano** | [`PLANO-L3.md`](PLANO-L3.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/saude-das-rotinas` |
| **Status** | 🟡 Pronto e conferido no ambiente local; **nada publicado em produção** |

---

## 1. O que foi feito

Dez rotinas rodam sozinhas no banco (mensalidades, vencidas, frequência, guarda de
comprovantes, grade semanal e notificações). Quando uma falhava, ninguém ficava
sabendo. Agora:

- **O aviso:** o **Painel** mostra, no topo, "Uma rotina automática falhou" (ou
  "N rotinas…"), com o nome de cada uma em linguagem de gente e se a última
  execução falhou ou se houve falhas nas últimas 24 horas.
- **Quando aparece:** só com problema. Rotina saudável não ocupa espaço.
- **O que não mostra:** a mensagem de erro técnica. O detalhe fica no banco, com a
  consulta no RUNBOOK.
- **Se a consulta falhar** (por exemplo, com o banco ainda sem a função), o resto do
  Painel carrega normalmente.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916221418_saude_das_rotinas.sql` | `saude_das_rotinas(p_referencia)`, só admin: agenda, última execução, último status e falhas em 24 h por rotina |
| `supabase/tests/regressao_saude_das_rotinas.sql` | 4 casos |
| `src/services/painel.service.ts`, `src/hooks/useAdminDashboard.ts` | `fetchSaudeDasRotinas`; 5ª chamada do Painel, tolerante a falha |
| `src/constants/painel.ts`, `src/utils/painel.ts` | Nome amigável de cada rotina; `rotinasComProblema` |
| `src/components/SaudeDasRotinasCard.tsx`, `PainelScreen` | Aviso no topo do Painel |
| Docs | `PAINEL.md`, `RUNBOOK`, `PLANO-DE-TAREFAS` |

## 3. Verificações executadas

- [x] **Regressão SQL** (4 casos):
  - o aluno é recusado;
  - o admin vê todas as rotinas agendadas;
  - a falha recente é contada e a de 3 dias atrás fica fora da janela;
  - a falha já resolvida aparece na contagem, com a última execução ok.
- [x] **Suíte SQL completa** no banco limpo.
- [x] **API local:** o admin recebe as 10 rotinas e o aluno 403/42501. Depois de o
  `push-despachar` rodar de verdade, a função mostrou `succeeded`. Isso confirma que
  ela enxerga o histórico real do `pg_cron`, que era o risco anotado no plano.
- [x] **Jest:**
  - serviço (rotina que nunca rodou, recusa);
  - utilitário (só rotinas com problema, nome amigável, rotina nova pelo nome técnico);
  - cartão (some sem problema, avisa com problema);
  - hook (Painel não cai sem a função).
- [ ] Teste no celular — celular não conectado.

## 4. Premissas assumidas

- **Aviso dentro do app, no Painel,** e não por e-mail ou push.
- **Só falhas.** "Deixou de rodar" fica como evolução.
- **Sem a mensagem de erro na tela.**
- **Janela de 24 horas.**

## 5. Pendência (sua)

⚠️ Publicar a migration junto das demais. Sem ela, o Painel só não mostra o aviso.
