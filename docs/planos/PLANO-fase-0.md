# Plano — Fase 0 do ROADMAP-thai (arrumar a casa)

> Modo 🔁 Loop, 2026-09-25. Branch `chore/fase-0-casa`. Itens 0.3 a 0.6 do
> [`ROADMAP-thai.md`](../../ROADMAP-thai.md).

## Enunciado canônico

- **Problema:** sobraram duas branches locais já mescladas; o `ci.yml` roda em Node 20, fora de
  suporte desde 30/04/2026; o `PLANO-DE-TAREFAS.md` não diz que deixou de ser a fila viva; e o CI
  da `main` ficou vermelho no merge do PR #38.
- **Resultado esperado:** só a `main` local; os dois jobs Node do CI em Node 22, como o
  `release.yml`; o plano antigo aponta para o roadmap; o CI da `main` verde.
- **Como validar:** `git branch` mostra só a `main` (e a branch desta tarefa); o CI do PR passa
  nos três jobs com "Configura Node 22"; o topo do `PLANO-DE-TAREFAS.md` leva ao roadmap.

## Escopo negativo [#8]

- **Nenhum job novo no CI** ("esquece o CI", 2026-09-16): muda só a versão do runtime.
- **Não** fixa a versão da CLI do Supabase (0.6): os runs da `main` depois do PR #38 (merges dos
  PRs #39 e #40, run `36176537979`) passaram no job "Regressão de segurança no banco". A regra do
  roadmap era fixar **só se falhar de novo**. A falha foi o limite da API do GitHub, passageira.
- **Não** mexe no `release.yml` (já está no Node 22) nem nas `actions/*@v4` (o aviso de Node 20
  das actions é do GitHub, que já as força para o Node 24; atualizar para v5 seria outra tarefa).

## Premissas assumidas (modo Loop)

1. **0.4 tem o aval do dono pela recomendação do roadmap** ("Node 22 no CI: sim, o 20 saiu de
   suporte"). O aval de verdade é o merge deste PR: nada chega à `main` sem ele. [#62][#81]
2. **Node 22 e o `package-lock.json`:** o `release.yml` já instala com `npm ci` no Node 22 e passou
   na 1.8.0, então o lockfile é compatível.

## Decisão visual

Sem superfície visual.

## Passos

1. ✅ `git branch -d` nas duas branches mescladas (0.3). Só local, e o `-d` recusa branch não
   mesclada. [#36]
2. `.github/workflows/ci.yml` — `node-version: '22'` nos jobs "Tipos, testes e licenças" e
   "Auditoria de CVE", com os nomes dos passos acompanhando (0.4). [#62][#81]
3. `docs/PLANO-DE-TAREFAS.md` — nota no topo: a fila viva é o `ROADMAP-thai.md` (0.5). [#96]
4. 0.6 — registrado como resolvido sem mudança de código (ver escopo negativo).

## Riscos e rollback

- **Risco:** alguma dependência de desenvolvimento reclamar do Node 22 no `npm ci` ou no Jest.
  Baixo: o `release.yml` já é 22 e o Node local é 24. **Mitigação:** o próprio CI do PR prova.
- **Rollback** [#84]: reverter o commit do `ci.yml`.

## Definição de pronto

- [x] Branches locais apagadas
- [ ] CI do PR verde nos três jobs, com Node 22
- [ ] Merge pelo dono (é o aval do 0.4)
