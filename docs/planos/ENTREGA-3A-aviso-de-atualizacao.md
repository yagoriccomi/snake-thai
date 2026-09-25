# Entrega — Aviso de atualização do app (3A.2 e 3A.3)

> 2026-09-25 · Modo 🔁 Loop · Branch `feat/aviso-de-atualizacao` · Plano:
> [`PLANO-3A-aviso-de-atualizacao.md`](PLANO-3A-aviso-de-atualizacao.md) · Contrato § 12.3.

## O que mudou

| Arquivo | O quê |
| --- | --- |
| `src/utils/avisoDeAtualizacao.ts` | Regras puras: tag `vX.Y.Z`, núcleo da instalada (antes do `+`), comparação numérica, link montado pela tag, dia em São Paulo |
| `src/services/avisoDeAtualizacao.service.ts` | `GET releases/latest` sem token, 5 s; 403/429 = limite; memória `{dia, ultimaTag}` no `AsyncStorage` |
| `src/hooks/useAvisoDeAtualizacao.ts` | Ao abrir e ao voltar ao primeiro plano; uma consulta por dia; nunca no DEV; só `log.warn` |
| `src/components/AvisoDeAtualizacao.tsx` | Cartão do mockup da linha H, pelo `Portal`, com os textos exatos |
| `src/theme/colors.ts` | Token `scrim` (véu): 0,62 no escuro, 0,45 no claro |
| `App.tsx` | Aviso montado dentro do `PortalProvider`, fora da navegação (vale no Login) |
| `docs/VERSIONAMENTO.md`, `README.md` | Convenção de release (3A.3) e a funcionalidade |

## Verificação

- `npm run ci`: tipos, **826 testes** (64 novos) e licenças, tudo verde.
- Os caminhos de falha da 3A.2 têm teste: o DEV não consulta; sem rede e tempo esgotado não
  travam nem gravam o dia; 403 e 429 contam o dia; tag fora do formato, versão igual e menor não
  mostram; `+N.sha` compara só o núcleo; asset ausente ou com `browser_download_url` diferente
  leva à página da tag; a 2ª abertura no mesmo dia não consulta.
- **Não rodou no aparelho** (3A.4 é seu).

## Premissas (detalhe no plano)

P1 só 403/429 contam o dia na falha · P2 o dia conta quando a resposta chega · P3 cartão
centralizado, como o mockup · **P4 a 2ª dica do mockup ficou de fora** · **P5 navegador que não
abre: `log.warn` e o cartão fica aberto** · P6 queda para UTC−3 · P7 uma consulta em andamento.

## Perguntas ao dono

1. **A 2ª dica do mockup entra?** *"Baixa o APK oficial do GitHub. Depois, abra o arquivo e toque
   em Instalar: seus dados continuam."* Está no mockup aprovado, mas não na § 3 nem na § 12.3.
   Se sim, entra no contrato (v3 → v4) e depois no cartão (uma linha). **Recomendação: sim.**
   Ajuda quem nunca instalou um APK fora da loja.
2. **Mensagem quando o navegador não abre?** Hoje o cartão só fica aberto. Uma frase como *"Não
   foi possível abrir o navegador. Tente de novo."* também precisaria entrar na § 3.
   **Recomendação: não.** No Android isso praticamente não acontece.

## Como validar no aparelho (3A.4)

1. APK **DEV**: o aviso nunca aparece.
2. APK de **produção** em modo avião: o app abre normal.
3. **Agora não**: fecha, e o cartão não volta no mesmo dia.
4. O cartão só aparece com uma release **maior** que a instalada, e hoje a última é a v1.8.0.
   Para vê-lo antes da 2.0.0 (opcional): um APK de produção de teste com o `app.json` em `1.7.0`,
   só no seu computador e **sem commit**, vê a v1.8.0 como nova. A prova final é a 2.0.0 (4.13).

## Próximo passo

3A.4 no aparelho → 3A.5 (publicar a 1.9.0, ⚠️ com a sua aprovação), depois do 1.5 (PR #42) na `main`.
