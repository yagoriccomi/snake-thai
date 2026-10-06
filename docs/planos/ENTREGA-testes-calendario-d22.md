# Entrega — D22 Testes presos ao calendário

> Modo 🔁 Loop, 2026-10-06. Plano: [`PLANO-testes-calendario-d22.md`](PLANO-testes-calendario-d22.md).
> Só testes mudaram: nenhuma migration, função, gatilho ou tela.

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `supabase/tests/regressao_frequencia_nova.sql` | FF8: a aula fica na segunda da semana corrente. Uma premissa no próprio teste confere, para os próximos 400 dias, que os meses da semana de cada dia ainda estão abertos nele |
| `src/screens/aulas/__tests__/AulasDoAluno.test.tsx` | relógio fixo numa terça (só o `Date`) no nível do arquivo, também para a tela do menu e para a cota |
| `supabase/tests/regressao_mensalidades.sql` | apaga a fatura de entrada do mês corrente logo depois de criar os alunos 1 e 2 |
| `supabase/tests/regressao_frequencia_regras.sql` | as aulas k1 e k2 (relativas a `now()`) vão para a turma `turma-freq2-chamada` e para o prefixo `-9000-`, fora das contas do cenário de novembro/2026 |
| `supabase/tests/regressao_esquema_v3.sql` | F7.9 justifica a semana corrente, e não a passada |
| `supabase/tests/regressao_frequencia_turma_e_trancamento.sql` | F3: aula e consulta no dia 15 do mês seguinte |
| `supabase/tests/regressao_grade_semanal.sql` | cenário de 2030 passa para 2086 (mesmo calendário) |
| `supabase/tests/regressao_painel_admin.sql` | `created_at` fixo em 01/04/2031 nos alunos do cenário |

## Provas (C8)

Banco local, 06/10/2026 (uma terça).

| Achado | Antes (versão da `main`) | Depois |
| --- | --- | --- |
| FF8 | hoje, 10:52: `FALHOU FF8: mês aberto entrou na fila` | 10:53: premissa (0), FF8, FF9 e FF10 passam |
| `AulasDoAluno` | relógio no domingo 11/10/2026: 4 falhas, entre elas `deveMostrarACotaDaSemanaEAbrirOMenu` e as do menu | relógio fixo: 11/11 |
| Mensalidades | simulação "hoje = 05/11/2026" (a fatura de entrada movida para novembro), 11:42: `FALHOU T2: aluno cadastrado no dia 5 deveria receber fatura` | mesma simulação: 12 OK |
| Painel | simulação "agora depois de 20/05/2031" (default de `created_at` em 01/06/2031), 11:42: `FALHOU T10: média do mês <NULL> de 0 alunos` | mesma simulação: 12 OK |
| Grade semanal | simulação "agora depois do cenário" (o cenário antigo em 2019, ano com o mesmo calendário), 11:42: `FALHOU G14: total 0` | cenário em 2086: verde |
| F7.9 | simulação "semana fora do prazo" (a semana de 14 dias atrás, como a passada fica aos sábados e domingos), 11:42: `O prazo para justificar esta semana terminou.` | semana corrente: verde |
| F3 | não dá para simular: quebra entre 23:59:00 e 23:59:59 do último dia do mês | verde. A primeira tentativa (dia 1º do mês seguinte) falhou às 11:39, porque 01/11/2026 é domingo e a semana dele é de outubro; daí o dia 15 |
| k1/k2 | não dá para simular sem mudar o relógio: quebram em novembro/2026 | verde |

Os arquivos de simulação ficaram fora do repositório: a injeção é uma linha depois do `begin;` ou
depois do insert do aluno, e cada arquivo termina em `ROLLBACK`.

## Como validar

- `scripts\db-dev test`: verde, com reset, às 11:43:04–11:44:56 (horas também no Registro).
- `npx jest`: verde (pre-commit).
- CI do PR verde.

## Premissas

As quatro do plano (P1 a P4). A que vale conferir é a P2: o ano 2086 na grade semanal.

## Pendências

- Nenhuma neste PR. Teste novo, nos três repositórios, já segue a C17.
