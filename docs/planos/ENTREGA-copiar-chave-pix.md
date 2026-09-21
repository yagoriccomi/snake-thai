# Entrega — Copiar a chave PIX no envio do comprovante

Plano: [`PLANO-copiar-chave-pix.md`](PLANO-copiar-chave-pix.md) · PR #33

## O que mudou

| Arquivo | O quê |
|---|---|
| `src/hooks/useCopiarChavePix.ts` | **Novo.** Copia, confirma por 2,5 s, anuncia ao leitor de tela, registra falha no log. |
| `src/hooks/__tests__/useCopiarChavePix.test.ts` | **Novo.** 6 casos, inclusive falha da área de transferência. |
| `src/screens/financeiro/PagamentoScreen.tsx` | Botão dentro do quadro da chave; chave `selectable`; aviso de falha. |
| `src/screens/financeiro/__tests__/PagamentoScreen.test.tsx` | **Novo.** 3 casos na tela. |
| `package.json` | `expo-clipboard@~57.0.2`. |
| `README.md` | Registra o botão na linha de pagamentos. |

## Validação no aparelho (Galaxy S24, 2026-09-21)

Build `1.6.0+dev.124.5e49531`, banco local, conta de aluno do seed:

1. **Com chave cadastrada** — Financeiro → mensalidade vencida → "Enviar comprovante": a tela mostrou a chave e o botão **Copiar chave PIX**.
2. **Ao tocar** — o botão virou **"Chave copiada ✓"** e, passados os segundos, voltou a "Copiar chave PIX".
3. **Prova da área de transferência** — colado num campo de texto de outra tela, saiu `12.345.678/0001-90`, idêntico ao cadastrado. Não bastava o botão mudar de texto.
4. **Sem chave cadastrada** (`pix_key` nula) — a tela mostrou "Chave PIX não configurada" e **nenhum botão**, como projetado.

Suíte: 755 testes, 103 suítes, verde. `tsc --noEmit` limpo. CI do PR verde.

## Premissas que viraram fato

- `expo-clipboard` autolinkado sem plugin de configuração; APK debug compilou e rodou.
- **APK novo é obrigatório** — módulo nativo. Recarregar o JS pelo Metro não basta.

## Armadilha encontrada no ambiente (não é da feature)

Quando o `adb reverse` cai — e ele cai a **cada reconexão do adb** —, o app DEV não diz "sem conexão": mostra uma tela de erro de bundle com stack em Kotlin (`loadJSBundleFromAssets`), porque procura o bundle nos assets ao não achar o Metro. Refazer as três portas resolve.

## Pendências

- Publicar em produção segue o roteiro normal; nada de banco mudou.
- O banco **local** ficou com a chave fictícia `12.345.678/0001-90` (antes era nula), para a tela ficar demonstrável.
