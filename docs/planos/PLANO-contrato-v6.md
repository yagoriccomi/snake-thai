# Plano — contrato v6 (D20, C15)

> Modo 🔁 Loop, 2026-10-05. Branch `docs/contrato-v6`. Origem: D20, C15 e C16 de `handoffs/COORDENACAO.md`
> (02/10, segunda rodada).

## Enunciado canônico

- **Problema:** o servidor responde 403 quando o Supabase falha (§ 13.5 da v5 manda fazer isso), usa o
  mesmo 403 para "sem permissão", "já decidida" e "sem anexo", e todo 4xx que ele não reconhece vira 500.
  A D20 pede um código e uma mensagem próprios para cada erro identificado, com 400 e 500 como genéricos.
- **Resultado esperado:** `docs/CONTRATO.md` v6 com a política de erros e a tabela de códigos por rota
  (§ 13.6), a errata da § 13.5 (falha do Supabase → 502, 503 ou 504, nunca 403; alarme só no 403) e a
  § 15 dizendo o que muda para o APK 1.8/1.9 e para a web `main`.
- **Como validar:** cada linha "já é assim" da tabela bate com o servidor em `origin/main` (`6c2e17e`),
  `feature/segunda-barreira-5.5` (`46bc9e2`) e `chore/diagnostico-trust-proxy` (`e59769b`); cada cliente
  da § 15 foi lido em `v1.8.0`, `release/1.9.0` (app) e `main`/`fase-6` (web); CI verde no PR.

## Escopo negativo [#8]

- Nenhum código do servidor, do app ou da web muda neste PR. O servidor muda o #37 já e o resto em PR
  próprio depois da v6 (C15); a web cobre os códigos no `lib/erros.ts` da fase-6 (C16); o app trata as
  mensagens na 2.0.0, só no código que tocar (D13, D20).
- Nenhuma rota, corpo de sucesso ou nome de banco muda. A versão da API continua `/v1` [#28]: os códigos
  novos só refinam erros que hoje já são erro.

## Premissas assumidas (modo Loop)

1. **Codes em inglês, `snake_case`, sempre com `_`.** O `classifyError` do APK lê qualquer `code` de 5
   caracteres alfanuméricos como SQLSTATE; com o `_` nenhum code cai nisso. As mensagens ficam em
   português e não usam as palavras que o APK lê como falha de rede. [#1][#24]
2. **Genéricos:** 400 `bad_request` ("Requisição inválida") para o 4xx que o servidor não identifica e
   500 `internal_error` ("Erro interno"), que já existe. [#24][#93]
3. **Supabase** (revista em 06/10 com o inventário do servidor, para usar os códigos do #37 e as três
   categorias literais da D20): rede ou 502/503 do gateway → 503 `supabase_unreachable` (substitui o
   `supabase_error`, que nenhum cliente lê); tempo esgotado (10 s ou 504 do Supabase) → 504
   `supabase_timeout`; 500 ou outro 5xx, corpo que não é JSON, formato inesperado ou 4xx do PostgREST
   que não seja 401 → 502 `supabase_invalid_response`. Vale também para o Auth: o Auth fora do ar deixa
   de virar 401 e passa a 503 (pedido do dono em 06/10). [#6][#24][#93]
4. **403 continua escondendo "não existe" e "é de outra pessoa"** (os dois dão o mesmo 403) [#55]. Os
   códigos específicos (404, 409) só aparecem para o dono ou para o leitor legítimo já confirmado, porque
   antes disso revelariam que a linha existe.
5. **A decisão de 25/09 (view-url de justificativa em banco sem `attempt` → 403) passa a 502** pela D20:
   coluna ausente é resposta inválida do banco, não falta de permissão. Confirmado pelo dono em 06/10
   (pergunta 1 do inventário): função ou coluna ausente é dependência quebrada, 502, já no PR das outras
   rotas, e não só depois do G4.
5a. **Como o servidor vai para produção antes das migrations (§ 14)**, a chamada a
   `pode_decidir_justificativa` (4.8) e a leitura de `attempt` (4.1) só são ligadas com a migration em
   produção (G4); senão o professor que hoje lê pela RLS levaria 502. A § 13.5 dizia "4.8 na `main`",
   que não protege a produção. [#84]
6. **Nenhum cliente depende de um código que muda** (§ 15). Por isso nenhum código antigo é mantido até a
   2.0.0 e não é preciso perguntar ao dono.
7. **O 429 passa a sair com `traceId`** (revista em 06/10: o inventário do servidor, achado 3, já
   prevê; o cliente não muda).

## Decisão visual

Sem superfície visual: só documento.

## Passos

| # | Onde | O que muda | Prática |
| --- | --- | --- | --- |
| 1 | Cabeçalho | v6 e o bloco "Novo na v6" | [#96] |
| 2 | § 13 (abertura) | "O que a v6 acrescenta" | [#96] |
| 3 | § 13.6 nova | Política de erros, erros comuns, erros do Supabase e tabela por rota, com a coluna "Hoje" | [#24][#55][#93] |
| 4 | § 13.1 e § 13.2 | Os "senão, 403" apontam para a § 13.6 | [#24] |
| 5 | § 13.5 | Errata: falha do Supabase → 502/503/504, nunca 403; nada é liberado; alarme só no 403 | [#55][#92] |
| 6 | § 15 | Clientes do servidor: APK 1.8/1.9 e web `main` | [#28] |
| 7 | § 17 | Linha da v6 | [#96] |
| 8 | `ROADMAP-thai.md` | Registro (v6, o que o servidor e a web ajustam), D20, D21 (item 5.3) e D13 revisto | [#96][#98] |
| 9 | Todo o PR (06/10) | `main` com a D22 trazida para a branch; complemento com o inventário do servidor (premissas 3, 5, 5a e 7) nas §§ 0, 13, 13.5, 13.6 e 17 e no Registro | [#6][#96] |

## Riscos e rollback [#84]

Só documento. O risco é a tabela divergir do servidor: a coluna "Hoje" diz qual linha já vale e qual o
servidor ainda precisa mudar, para nenhum chat ler alvo como estado. Rollback: reverter o commit.

## Definição de pronto

- [x] Contrato v6 com §§ 13.5, 13.6, 15 e 17.
- [x] Roadmap com o Registro e as decisões.
- [ ] CI verde, merge (D2), branch apagada.
- [x] `ENTREGA-contrato-v6.md`.
