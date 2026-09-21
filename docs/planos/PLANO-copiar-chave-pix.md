# Plano — Copiar a chave PIX na tela de envio do comprovante

## Enunciado canônico

- **Problema:** para pagar a mensalidade, o aluno abre a tela de envio do comprovante, **lê** a chave PIX na tela e precisa digitá-la no app do banco. Chave PIX (CNPJ, telefone ou aleatória) digitada à mão erra fácil, e o erro só aparece no banco.
- **Resultado esperado:** um botão na própria tela copia a chave cadastrada para a área de transferência, com confirmação visível de que copiou.
- **Como validar:** no app DEV, abrir uma mensalidade em aberto → "Enviar comprovante" → tocar em "Copiar chave PIX" → colar em qualquer campo de texto e conferir que saiu exatamente a chave de `academy_settings.pix_key`.

## Escopo

- Tela do aluno `src/screens/financeiro/PagamentoScreen.tsx` (a que abre ao tocar em "Enviar comprovante").
- Regra de cópia isolada num hook, com teste próprio.

## Escopo negativo [#8]

- **Não** mexe no hero da lista financeira (`StudentFinanceList`), que mostra a chave mas não foi pedido.
- **Não** gera QR Code nem PIX copia-e-cola (BR Code): a academia cadastra uma chave simples, não um payload EMV.
- **Não** muda nada no banco: a chave já vem de `academy_settings.pix_key`.

## Premissas assumidas (modo Loop)

1. **Biblioteca:** `expo-clipboard@~57.0.2`, o módulo oficial do SDK 57. O `Clipboard` do core do React Native existe, mas está formalmente depreciado e avisa no console — construir em cima dele é dívida certa. [#7]
   - **Consequência:** módulo nativo novo ⇒ **exige APK novo**. Recarregar só o JS no APK atual não basta.
2. **Chave não cadastrada:** o botão não aparece. Copiar o texto "Chave PIX não configurada" seria pior que não ter botão. [#98]
3. **Confirmação:** o próprio botão vira "Chave copiada ✓" por 2,5 s e volta ao normal — sem toast novo, que o projeto não tem. [#7]

## Decisão visual

**Mockup: não** — é um botão `secondary` do design system já existente, dentro do quadro da chave PIX que já está na tela. Sem layout novo, sem cor nova: tokens do tema, claro e escuro. [#3]

## Passos

1. `src/hooks/useCopiarChavePix.ts` — hook com a regra: copia, confirma por alguns segundos, anuncia ao leitor de tela, registra falha no log sem vazar detalhe técnico à tela. [#2][#92][#93]
2. `src/hooks/__tests__/useCopiarChavePix.test.ts` — cobre copiar, chave ausente, falha da área de transferência e a volta ao estado inicial. [#41]
3. `src/screens/financeiro/PagamentoScreen.tsx` — usa o hook, mostra o botão e a mensagem de falha; a chave vira `selectable` como saída manual. [#9]
4. `src/screens/financeiro/__tests__/PagamentoScreen.test.tsx` — cobre o botão na tela (presença, ausência sem chave, texto copiado).
5. `README.md` — registra a dependência nova. [#96]

## Impacto em dados/contrato

Nenhum. Só leitura de `academy_settings.pix_key`, que a tela já fazia.

## Riscos e rollback

- **Risco:** o APK instalado hoje no celular não tem o módulo nativo; com o JS novo pelo Metro, a tela quebraria ao copiar. **Mitigação:** gerar APK novo antes de testar no aparelho.
- **Rollback:** reverter o commit e `npm remove expo-clipboard`; nada de estado persistente foi criado.

## Definição de pronto

- [ ] `npm run typecheck` limpo
- [ ] `npx jest` verde
- [ ] Testado no aparelho: copiar e colar devolve a chave exata
- [ ] README atualizado
