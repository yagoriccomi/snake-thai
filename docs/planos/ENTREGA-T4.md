# ENTREGA — T4: pushs, PRs e merges pendentes

| Campo | Valor |
|---|---|
| **Tarefa** | `T4` |
| **Plano** | [`PLANO-T4.md`](PLANO-T4.md) |
| **Modo** | 🔁 Loop (merge com deploy confirmado pelo usuário) |
| **Data** | 2026-09-16 |
| **Commits** | `snake-thai`: merge `eca4c42` (PR #9). `snake-server`: `c1e6f9f` (P-20) e merge `2500111` (PR #15) |
| **Status** | ✅ Entregue (2 conferências de painel ficam com o usuário) |

---

## 1. O que foi feito

As duas `main` agora refletem o que está em produção. No `snake-thai`, os 10 commits
da 1.6.0 entraram na `main` e a tag `v1.6.0` passou a fazer parte dela. No
`snake-server`, a P-19 e as 7 atualizações seguras do Dependabot entraram num único
deploy; os 3 upgrades major que quebram a instalação foram fechados e registrados como
P-20. Nos dois repositórios sobrou só a `main`, sem PR aberto, e a exclusão automática
de branch após o merge ficou ligada.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `snake-thai` `main` | PR #9 (`feat/papel-professor`) com merge commit; conteúdo idêntico ao da `v1.6.0` (mesma árvore `4641783`) |
| `snake-thai` branches | 7 remotas e 9 locais já mescladas apagadas; `delete_branch_on_merge=true` |
| `snake-thai` `docs/` | PR #10: checklist `PLANO-DE-TAREFAS.md` e planos `PLANO-T1..T11.md` |
| `snake-server` `main` | PR #15: Dependabot #13, #11, #5, #7, #8, #9, #10 + `docs/PENDENCIAS.md` (P-19 resolvida, P-20 nova) |
| `snake-server` PRs | #3 (vitest 4), #4 (TypeScript 7), #6 (@eslint/js 10) fechados com `@dependabot ignore this major version` |
| `snake-server` branches | 4 remotas e 5 locais apagadas; `delete_branch_on_merge=true` |
| Release `v1.6.0` | APK assinado com a chave de debug removido (confirmado pelo usuário); aviso no topo das notas. Cópia local íntegra (`b46e780b…`) |

## 3. Como validar

1. `git -C snake-thai log --oneline -1 origin/main` e `git merge-base --is-ancestor v1.6.0 origin/main` → a tag está na `main`.
2. `gh pr list --state open` nos dois repositórios → vazio.
3. `gh release view v1.6.0 --repo yagoriccomi/snake-thai --json assets` → `[]`.
4. `curl <API>/health` → `{"ok":true}`; `POST /v1/proofs/sign-upload` e `/v1/justifications/sign-upload` com corpo e sem token → `401`.

## 4. Verificações executadas

- [x] Pré-checagem: SHAs iguais aos do planejamento; `git merge-tree` sem conflito em todos os merges
- [x] `snake-server` com a combinação: `npm ci`, `format:check`, `lint`, `typecheck` e `test:coverage` (235 testes) verdes; `npm audit --omit=dev --audit-level=high` sem achados
- [x] CI do PR #15: Qualidade e testes, Segurança e licenças, CodeQL e Imagem Docker = pass (já com as actions novas)
- [x] Pós-merge: API respondeu `{"ok":true}` e `401` nas duas rotas durante toda a janela de deploy (6 min, 12 checagens)
- [ ] Qual commit está no ar na Render — **não verificado**: o conector da Render não está autenticado e o `/health` não informa versão

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | Merge commit, nunca squash | Mantém a tag `v1.6.0` e os SHAs na `main` [#36] | — (histórico já integrado) |
| P2 | Os 7 PRs do Dependabot numa branch e um deploy só | Um ciclo de CI e um deploy em produção [#31] | — |
| P3 | Majors fechados com "ignore this major version" | Quebram `npm ci`; sem ganho para produção [#8] | Reabrir o PR ou pedir `@dependabot unignore` |
| P4 | Apagar branches mescladas e ligar exclusão automática | Commits continuam alcançáveis pela `main` e tags | `gh repo edit --delete-branch-on-merge=false`; recriar branch a partir do SHA |

## 6. Decisão visual

- Sem superfície visual.

## 7. Pendências

- [ ] 👤 Conferir no painel da Render se o Auto-Deploy está ligado e se o deploy do commit `2500111` ficou "Deploy live". O job "Publicar na Render" do CI falha por falta do secret do deploy hook; com o Auto-Deploy ligado, **não** cadastre esse secret (cada merge viraria dois deploys).
- [ ] 👤 Conferir no painel da Supabase que não há integração com o GitHub aplicando migrations no merge da `main`.
- A documentação do `snake-server` (`docs/DEPLOY.md`, `render.yaml`) ainda diz `autoDeploy: false`; corrigir depois da conferência acima.
- CI do `snake-thai` segue vermelho no job de regressão SQL (teste desatualizado) — corrigido na T1.

## 8. Próximo passo natural

**T1** — separar desenvolvimento de produção. Toda branch nova nasce da `main` atualizada.

## 9. Rastreabilidade

- **Jira:** não integrado (adiado por decisão do usuário).
- **`CLAUDE.md`:** nada novo.
