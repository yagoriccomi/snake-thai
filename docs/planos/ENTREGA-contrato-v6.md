# Entrega — contrato v6 (D20, C15)

> Modo 🔁 Loop, 2026-10-05. Branch `docs/contrato-v6`. Plano: [`PLANO-contrato-v6.md`](PLANO-contrato-v6.md).

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `docs/CONTRATO.md` | v6: cabeçalho e "Novo na v6"; abertura da § 13; §§ 13.1 e 13.2 apontam para a § 13.6; errata da § 13.5 (502/503/504, alarme só no 403, ordem das conferências); **§ 13.6 nova** (política, erros comuns, falha do Supabase e tabela por rota, com a coluna "Hoje"); § 15 com os clientes do servidor; linha v6 na § 17 |
| `ROADMAP-thai.md` | Contrato v6 no estado, na Fase 4 e nas dependências; D13 revisto no 5.1; **item 5.3 (D21)**; D20, D21 e D13 revisto em "Decisões em aberto"; duas linhas no Registro, com o que o servidor e a web ajustam |
| `docs/planos/PLANO-contrato-v6.md` e este arquivo | Plano e entrega |

**Complemento de 06/10**, antes do merge, com o inventário do servidor
(`docs/planos/INVENTARIO-erros-D20.md` de `feature/segunda-barreira-5.5`) e as respostas do dono:

| Onde | Mudança |
| --- | --- |
| § 13.6, falha do Supabase | Os códigos do #37: 503 `supabase_unreachable` (rede ou gateway 502/503; `supabase_unavailable` some), 504 `supabase_timeout`, 502 `supabase_invalid_response` (no lugar de `supabase_bad_response`), com as mensagens do servidor |
| § 13.6, pergunta 1 | Função ou coluna ausente (`PGRST202`, `42703`) é dependência quebrada: 502 já no PR das outras rotas |
| § 13.6, erros comuns | Linha nova: o Auth fora do ar ao validar o token dá 503 (504/502 conforme a falha), e não mais 401 `bad_token` |
| § 13.6, 429 | Passa a sair com `traceId` |
| § 13.5 "Quando" e § 13.6 "Para quem implementa" | `pode_decidir_justificativa` (4.8) e a leitura de `attempt` (4.1) só são ligadas com a migration **em produção** (G4), e não "na `main`" |
| Cabeçalho, abertura da § 13, § 17 | Linha "v6 (complemento)" |
| Branch | `main` trazida com a D22 (#89), que conserta o FF8 vermelho |

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

As do plano (1 a 7 e a 5a). As que mais pesam: codes com `_` (proteção do `classifyError` do APK), 403
escondendo "não existe" e "é de outra pessoa", função ou coluna ausente → 502 (confirmado pelo dono em
06/10) e a chamada que depende de migration nova ligada só com ela em produção.

**Divergências com o inventário que a v6 mantém** (o servidor ajusta): 400 `bad_request` como genérico
do 4xx não identificado (o inventário usa `bad_input`); `bad_input` com a frase do primeiro problema do
`zod`; 404/409 próprios para o dono ou o leitor legítimo (o inventário mantém `forbidden`); `attempt`
fora de 1–2 → 502; 401 do PostgREST → 401 `bad_token` (o #37 dá 403); qualquer 4xx do Auth → 401 (o
inventário fala em 401/403).

## Pendências e próximo passo

- **`snake-server`:** no #37, antes do merge (D19): os nomes já batem; falta deixar a chamada a
  `pode_decidir_justificativa` desligada até o 4.8 em produção (G4) e o 401 do PostgREST como
  `bad_token`. Depois, as outras linhas "muda" da § 13.6 num PR próprio, com confirmação do dono (C15).
  O detalhe está no Registro de 06/10.
- **`snake-web`:** C16, `lib/erros.ts` da `fase-6` com os códigos da § 13.6; se já usou
  `supabase_unavailable` ou `supabase_bad_response` do texto de 05/10, troca pelos nomes finais.
- **App:** nada agora. A D20 vale no código que o chat tocar a partir da 2.0.0 (C11 já pela D20).
