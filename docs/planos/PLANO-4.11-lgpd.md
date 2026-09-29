# Plano — 4.11 LGPD (G5)

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 12.1, § 5.2, D22, D32, D54, D58 e o G5 (§ 14).

## Enunciado canônico

- **Problema:** `export_my_data` usa `to_jsonb` da linha inteira (uma coluna nova vazaria
  sozinha) e não traz solicitações, metas, trocas, períodos de plano, de trancamento e de turma;
  `anonimizar_titular` não apaga nada das tabelas da v3; a Política não fala de atestado, do
  professor vendo todos os alunos, de metas, pedidos nem trocas.
- **Resultado esperado:** o export com lista explícita de colunas e as chaves novas; a exclusão
  apagando as tabelas novas na ordem certa; o texto novo da Política pronto para publicar.
- **Como validar:** `regressao_lgpd_v4.sql` (L1–L5, com aluno com troca e sem troca, § 0.1) e
  `db-dev test`; o diff do texto da Política no PR.

## Escopo negativo [#8]

- **Publicar a Política** (preencher "Dados dos termos", `npm run legal:publicar`, produção) é
  do dono: o texto precisa da aprovação dele, e a publicação vale em produção. O **G5** abre
  quando a versão estiver publicada.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | A versão esperada da Política é a **1.0** | Nenhuma versão foi publicada ainda (o 3.7 está pendente); o texto novo já cobre o que o 3.7 publicaria. Se a 1.0 sair antes com o texto antigo, esta vira a 1.1 |
| P2 | O export traz, além das chaves da § 12.1, o perfil, a frequência, os pagamentos e os consentimentos com colunas escolhidas (sem ids internos de auditoria nem caminhos de arquivo) | "Lista explícita de colunas, sem `to_jsonb` de linha inteira" |
| P3 | As trocas saem com as colunas de `minhas_trocas` (via `to_jsonb` do resultado da RPC, que já é uma lista fechada) | § 12.1: "com as colunas de `minhas_trocas`" |
| P4 | O prazo dos anexos entra no texto como "180 dias depois da decisão", fixo | O gatilho do 4.1 só deixa mudar o prazo com nova Política (D54) |

## Passos

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929210000_lgpd_v4.sql` | `export_my_data` e `anonimizar_titular` | [#87] [#63] | `db-dev reset` |
| 2 | `supabase/tests/regressao_lgpd_v4.sql` | L1–L5 | [#41] | `db-dev test` |
| 3 | `docs/legal/POLITICA-DE-PRIVACIDADE.md` + `20260929211000_modelo_privacy_policy.sql` | O texto novo e o modelo (`npm run legal:modelo -- politica`) | [#96] | diff no PR |

## Definição de pronto

- [x] Banco, testes e o texto no PR, com CI verde; Registro com a versão esperada;
- [ ] **G5** (dono): texto aprovado, "Dados dos termos" preenchidos, `npm run legal:publicar --
  politica 1.0`, publicação em produção e o novo aceite no app e na web.
