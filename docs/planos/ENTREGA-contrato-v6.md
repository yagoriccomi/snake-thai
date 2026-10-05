# Entrega — contrato v6 (D20, C15)

> Modo 🔁 Loop, 2026-10-05. Branch `docs/contrato-v6`. Plano: [`PLANO-contrato-v6.md`](PLANO-contrato-v6.md).

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `docs/CONTRATO.md` | v6: cabeçalho e "Novo na v6"; abertura da § 13; §§ 13.1 e 13.2 apontam para a § 13.6; errata da § 13.5 (502/503/504, alarme só no 403, ordem das conferências); **§ 13.6 nova** (política, erros comuns, falha do Supabase e tabela por rota, com a coluna "Hoje"); § 15 com os clientes do servidor; linha v6 na § 17 |
| `ROADMAP-thai.md` | Contrato v6 no estado, na Fase 4 e nas dependências; D13 revisto no 5.1; **item 5.3 (D21)**; D20, D21 e D13 revisto em "Decisões em aberto"; duas linhas no Registro, com o que o servidor e a web ajustam |
| `docs/planos/PLANO-contrato-v6.md` e este arquivo | Plano e entrega |

## Como validar

- Coluna "Hoje" da § 13.6 contra o servidor: `src/lib/http-error.ts`, `src/middleware/error-handler.ts`,
  `src/middleware/require-user.ts`, `src/lib/supabase.ts`, `src/app.ts` e os `*.schema.ts`,
  `*.service.ts` e `*.repository.ts` de `proofs`, `justifications` e `motivos`, em `origin/main`
  (`6c2e17e`) e no #37 (`46bc9e2`). O #36 (`e59769b`) só acrescenta o `diagnosticoDeProxy`, que chama
  `next()`.
- § 15 contra os clientes: `src/lib/api.ts`, `src/utils/errors.ts` e `src/lib/monitoring/scrub.ts` em
  `v1.8.0` e `release/1.9.0`; `lib/comprovante.ts` e `lib/erros.ts` da web em `main` e `fase-6`.
- CI verde no PR.

## Premissas

As sete do plano. As que mais pesam: codes com `_` (proteção do `classifyError` do APK), 403 escondendo
"não existe" e "é de outra pessoa", e a decisão de 25/09 (banco sem `attempt` → 403) revista para 502.

## Pendências e próximo passo

- **`snake-server`:** ajustar o #37 à errata antes do merge (D19) e, depois, as outras linhas "muda" da
  § 13.6 num PR próprio, com confirmação do dono (C15). O detalhe está no Registro de 05/10.
- **`snake-web`:** C16, `lib/erros.ts` da `fase-6` com os códigos da § 13.6.
- **App:** nada agora. A D20 vale no código que o chat tocar a partir da 2.0.0 (C11 já pela D20).
