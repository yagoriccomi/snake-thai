# ENTREGA — T11: guardar a chamada em andamento no aparelho

| Campo | Valor |
|---|---|
| **Tarefa** | `T11` |
| **Plano** | [`PLANO-T11.md`](PLANO-T11.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/rascunho-chamada` |
| **Status** | 🟡 Implementado e testado (Jest); falta a validação no celular com o app DEV |

---

## 1. O que foi feito

Uma chamada pela metade não se perde mais quando o Android fecha o app. As marcações
ficam guardadas cifradas no aparelho, por usuário e por aula, até "Concluir chamada".
Ao reabrir, voltam com o aviso "Rascunho recuperado". Se outra pessoa salvou a chamada
nesse meio-tempo, a tela avisa e deixa escolher entre o que está salvo e o rascunho, em
vez de sobrescrever em silêncio. O rascunho some ao salvar, ao descartar, depois de 7
dias sem marcação nova e ao sair do login.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `src/utils/rollCallDraft.ts` | Regras puras: chave, validação do registro, validade, decisão vencido/idêntico/conflito/recuperar |
| `src/lib/secureStorage.ts` | `listKeys(prefixo)` (o SecureStore não enumera) |
| `src/services/rollCallDraft.service.ts` | Ler, guardar, apagar, apagar todos do aparelho, apagar vencidos |
| `src/hooks/useRollCallDraft.ts` | Estado das marcações, leitura na primeira ativação, debounce, fila, gravação ao ir para segundo plano e ao sair |
| `src/components/RollCallDraftNotice.tsx` | Aviso "recuperado" e "conflito" |
| `src/screens/aulas/FrequenciaScreen.tsx` | Usa o hook; esquece o rascunho ao salvar; aviso de saída com 3 botões; lista travada no conflito |
| `src/services/auth.service.ts` | `signOut` apaga os rascunhos antes de sair (falha não impede) |
| `docs/FREQUENCIA.md`, `docs/FUNCIONALIDADES.md`, `README.md` | Seção "Rascunho da chamada" e menções |

Sem migration e sem mudança no banco ou no servidor.

## 3. Como validar (app DEV, nunca produção)

1. Professor abre uma aula já iniciada, marca 3 alunos, aperta Home e, no PC, `adb shell am kill com.snakethai.app.dev`. Reabrir a aula → "Rascunho recuperado" com as 3 marcações.
2. "Descartar rascunho" → a lista volta ao que está salvo; fechar e reabrir não mostra aviso.
3. Conflito: marcar e matar o app; o admin conclui a mesma chamada em outra sessão; reabrir → aviso de conflito, lista travada, os dois botões funcionam.
4. Concluir com sucesso, matar o app e reabrir → sem aviso.
5. Com rascunho guardado, sair do login e entrar de novo → sem aviso.
6. Sair da tela com "Sair e guardar" e voltar → rascunho recuperado.
7. TalkBack ligado → o aviso é anunciado.

## 4. Verificações executadas

- [x] `rollCallDraft` 22 testes: chave por usuário/aula e aceita pelo SecureStore, validação do registro, limite exato da validade, precedência vencido > idêntico > conflito, aluno que saiu da turma
- [x] `secureStorage` 3 testes (ida e volta cifrada, `listKeys` só com o prefixo, remoção das duas partes)
- [x] `rollCallDraft.service` 6 testes (registro corrompido ou de outra aula apagado; limpeza geral não toca na sessão; vencidos e ilegíveis)
- [x] `useRollCallDraft` 14 testes (nada antes de carregar, recuperar, conflito com pausa, rebase, idêntico, vencido, debounce, apagar ao voltar ao gravado, descartar cancela pendente, esquecer não regrava, segundo plano, saída da tela, sem usuário, falha de armazenamento)
- [x] `RollCallDraftNotice` 2 testes; `auth.service` 2 testes novos (ordem e falha não impede sair)
- [x] Suíte completa: 443 testes; typecheck verde
- [ ] Cenários 1 a 7 no celular — **sem aparelho conectado e sem emulador configurado** durante a execução

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | Validade de 7 dias | Cobre chamada começada na sexta e terminada na segunda | `VALIDADE_DO_RASCUNHO_MS` em `utils/rollCallDraft.ts` |
| P2 | Três botões ao sair | Com o cache, sair sem perder passa a existir | Tirar o botão "Sair e guardar" do `beforeRemove` |
| P3 | Conflito pergunta | É chamada oficial; sobrescrever trabalho alheio em silêncio é pior que um toque | Trocar o `return` do conflito por descarte automático |
| P4 | Sair do login apaga sem perguntar | Aparelho compartilhado; logout no meio da chamada é raro | Avisar antes em `DadosScreen` |
| P5 | No conflito, "Manter o que está salvo" é o botão principal | Não desfaz o trabalho de ninguém | Inverter as variantes no `RollCallDraftNotice` |

## 6. Decisão visual

Mockup: não — cartão no padrão do aviso de aula sem chamada. A `design-de-interface-projeto`
definiu borda neutra e ícone em `primaryText` para "recuperado", borda e ícone em
`warning` para "conflito", tokens do tema nos dois modos, cartão `alert` com região ao
vivo (sem `accessible`, para os botões continuarem focáveis um a um no TalkBack) e botões
de 44 dp.

## 7. Pendências

- [ ] 👤 Validar os 7 cenários no celular com o app DEV e o banco local (precisa do celular no ADB e de duas contas locais: professor e admin)
- [ ] Na exclusão de conta (T7), encerrar a sessão por `authService.signOut`, que apaga os rascunhos
- [ ] Melhoria futura (fora do escopo): detectar conflito também com a tela aberta, com uma versão da chamada no banco

## 8. Próximo passo

**T10 — monitoramento de erros no aparelho** (depende de uma conta no Sentry).
