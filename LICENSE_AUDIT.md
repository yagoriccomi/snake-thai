# ⚖️ Mapa de Risco de Licenças — Snake Thai

> **Data:** 2026-08-19 · **Escopo:** dependências de **produção** e suas
> transitivas (395 pacotes), lidas da árvore real em `node_modules`.
> **Natureza:** apoio à decisão, não parecer jurídico formal. Um advogado de
> direito digital deve validar antes da primeira venda.

## 📊 Resumo Executivo

**Modelo de negócio:** software **distribuído** — o app é entregue como APK de
prateleira para academias, código fechado, não é SaaS aberto nem open source.
Isso define o gatilho relevante: só a **GPL na distribuição** contaminaria o
produto (a AGPL, de rede, sequer se aplicaria a um app instalado).

**Veredicto: risco jurídico BAIXO, sem contágio viral.** A varredura da árvore
inteira — transitivas incluídas — **não encontrou uma única licença GPL, AGPL
ou LGPL** [#62]. Nada obriga a abrir o código proprietário. Nenhuma dependência
de IA (modelo, peso ou dataset) está embarcada.

Distribuição por licença (produção, com transitivas):

| Licença | Pacotes | Faixa |
| --- | --- | --- |
| MIT | 344 | 🟢 permissiva |
| ISC | 17 | 🟢 permissiva |
| Apache-2.0 | 11 | 🟢 permissiva (+ concessão de patente) |
| BlueOak-1.0.0 | 5 | 🟢 permissiva |
| BSD-3-Clause | 5 | 🟢 permissiva |
| BSD-2-Clause | 3 | 🟢 permissiva |
| MIT AND OFL-1.1 | 2 | 🟡 atribuição (fontes) |
| 0BSD | 2 | 🟢 permissiva (sem atribuição) |
| Unlicense | 2 | 🟢 domínio público |
| CC-BY-4.0 | 1 | 🟡 atribuição (build-only) |
| MPL-2.0 | 1 | 🟡 copyleft fraco (build-only) |
| MIT OR CC0-1.0 | 1 | 🟢 permissiva |
| MIT OR Apache-2.0 | 1 | 🟢 permissiva |

**Único dever prático a cumprir:** incluir o aviso de atribuição das fontes e
das bibliotecas MIT/BSD/Apache num arquivo `NOTICE`. Já gerado nesta rodada.

---

## 🔴 Risco Crítico / Alto (Contágio Viral)

Nenhuma dependência nesta faixa. **Não há GPL, AGPL ou LGPL na árvore de
produção.**

---

## 🟡 Risco Moderado (Copyleft Fraco / Atribuição)

| Dependência | Licença | Obrigação | Ação |
| --- | --- | --- | --- |
| `@expo-google-fonts/inter` | OFL-1.1 | A fonte **vai no APK**. A OFL exige que o aviso de copyright acompanhe o arquivo e proíbe vender a fonte **isolada** — não impede embarcá-la no app nem comercializá-lo. | Creditar no `NOTICE` ✅ |
| `@expo-google-fonts/syne` | OFL-1.1 | Idem. | Creditar no `NOTICE` ✅ |
| `lightningcss` | MPL-2.0 | Copyleft fraco: obrigaria abrir só modificações **da própria lib**. Mas é **build-only** (via `@expo/metro-config`) — não entra no APK, logo a obrigação não dispara na distribuição. | Nenhuma; não modificamos a lib |
| `caniuse-lite` | CC-BY-4.0 | Licença de **dados** (tabela de compatibilidade), não de código. Também **build-only**. | Nenhuma no produto distribuído |

> **Distinção que importa:** MPL e CC-BY aqui são de ferramentas que rodam no
> **seu computador ao compilar**, não no aparelho do usuário. Como o produto
> distribuído é o APK, e esses pacotes não estão nele, a obrigação de
> compartilhamento não é acionada.

---

## 🟢 Baixo Risco (Permissivas)

386 dos 395 pacotes. MIT, ISC, Apache-2.0, BSD e equivalentes: uso comercial
livre, exigem apenas preservar o aviso de copyright. Destaque para os pilares do
app — todos permissivos:

| Dependência | Licença | Observação |
| --- | --- | --- |
| `react`, `react-native` | MIT | Núcleo |
| `expo` e módulos `expo-*` | MIT | SDK |
| `@supabase/supabase-js` | MIT | Cliente de backend |
| `@react-navigation/*` | MIT | Navegação |
| `aes-js` | MIT | Cifragem da sessão |
| `react-native-reanimated` equivalentes | MIT | — |

Apache-2.0 (11 pacotes) traz um bônus: **concessão explícita de patente** — o
autor abre mão de processar por patente sobre aquele código, proteção que a MIT
não dá.

---

## 🤖 Licenças de IA / Não-OSI

Nenhuma dependência nesta faixa. O projeto não embarca modelos, pesos nem
datasets de IA. Não há cláusula OpenRAIL, Llama, "research-only" ou
"non-commercial" a avaliar.

---

## ✅ Plano de Mitigação

1. **Incluir o `NOTICE`** com os avisos de atribuição (fontes OFL e as
   principais bibliotecas permissivas) — **feito nesta rodada**. É o único dever
   legal concreto para distribuir o APK [#96].
2. **Auditoria de licenças no CI** — adicionar `license-checker` (ou Dependabot
   com política de licenças) como gate na esteira, barrando o merge se uma
   dependência GPL/AGPL entrar na árvore de produção no futuro [#62]. Fica para
   a etapa `configurar-ci-cd-projeto`.
3. **Reavaliar a cada dependência nova de peso** — especialmente qualquer
   biblioteca de IA, PDF, geração de imagem ou vídeo, onde licenças restritivas
   e não-OSI são comuns.

> **Ressalva jurídica:** este mapa cobre as licenças **declaradas** pelos
> pacotes. Não substitui a validação de um advogado de direito digital antes da
> comercialização, sobretudo quanto à OFL das fontes e à marca do produto.
