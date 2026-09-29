# Plano — tempo máximo dos testes do Jest (hook de pre-commit)

> Modo 🔁 Loop, 2026-09-29. Branch `test/jest-timeout`.

## Enunciado canônico

- **Problema:** no pre-commit, a suíte inteira roda em 15 processos (máquina de 16 núcleos, com o
  Docker do Supabase local ocupado). O primeiro teste de `ExcluirTurmaSheet.test.tsx` e o de
  `EditarAlunoScreen.test.tsx` passam dos 5 s padrão do Jest e falham, em 3 de 3 commits de
  29/09. Sozinhos, os dois arquivos passam, e no CI também.
- **Resultado esperado:** o hook passa sem repetir o commit e sem `HUSKY=0`.
- **Como validar:** o commit desta branch passa pelo hook com a suíte inteira (848 testes).

## Escopo negativo [#8]

- Não reduz os processos do Jest (`--maxWorkers`): deixaria a suíte mais lenta para todo commit,
  e o problema é só o teto de tempo.
- Não mexe nos dois testes: eles não estão errados. O custo vem do primeiro `render`, que carrega
  a árvore da tela sob disputa de CPU.

## Premissas assumidas

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | `testTimeout: 15000` na configuração do Jest (`package.json`) | 3× o padrão. Cobre os 9 a 15 s medidos sob carga e ainda pega um teste pendurado de verdade [#47][#49] |

## Decisão visual

Sem superfície visual.

## Passos

| # | Arquivo | O que muda | Como verificar |
| --- | --- | --- | --- |
| 1 | `package.json` (`jest.testTimeout`) | 15000 | O commit passa pelo hook |

## Riscos e rollback [#84]

Um teste realmente travado demora 15 s para falhar, em vez de 5 s. O rollback é apagar a linha.
