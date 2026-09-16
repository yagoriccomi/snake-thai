# PLANO DE EXECUÇÃO — T11: Guardar a chamada em andamento no aparelho (rascunho cifrado, com recuperação, conflito e expiração)

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T11` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/rascunho-chamada` |
| **Esforço** | M |
| **Depende de** | nenhuma |

## 1. Enunciado

Hoje as marcações da chamada existem só no estado React da FrequenciaScreen. Se o app for fechado ou morto pelo Android antes de "Concluir chamada", elas se perdem. O plano cria um rascunho por usuário e por aula, gravado com debounce no armazenamento cifrado que o app já tem (LargeSecureStore). Ao abrir a chamada, o rascunho é restaurado com o aviso "rascunho recuperado" e a opção de descartar. Um conflito é detectado quando outra pessoa salvou a chamada depois que o rascunho começou. O rascunho vence após N dias e é apagado quando a chamada é salva com sucesso e quando o usuário sai do login. Não precisa de migration nem de mudança no banco: é tudo no app e tudo testável com Jest.

## 2. Terreno (situação verificada)

- As marcações vivem só em estado React e voltam ao que está gravado a cada recarga. Nada é guardado no aparelho.  
  _Evidência:_ src/screens/aulas/FrequenciaScreen.tsx:83-86 (useState + useEffect setRascunho(officialByStudent)); :106-112 (marcar só faz setRascunho); o docstring em :50-53 diz 'As marcações ficam NA TELA'
- O único envio ao banco acontece em 'Concluir chamada': uma RPC salvar_chamada. Depois a tela recarrega a lista e o estado.  
  _Evidência:_ FrequenciaScreen.tsx:114-130 (save -> reload + recarregarFrequencia); src/hooks/useRollCallReview.ts:69-75 (saveRollCall + load); src/services/frequency.service.ts:120-135
- O aviso de marcações não salvas já existe, mas só cobre a saída da tela pela navegação (beforeRemove). Não protege contra o processo ser morto, e o botão 'Descartar' hoje perde tudo.  
  _Evidência:_ FrequenciaScreen.tsx:148-164 (Alert 'Descartar a chamada?' com 'Continuar marcando'/'Descartar'); rodapé 'Marcações ainda não salvas' em :323-327
- O AsyncStorage 2.2.0 e o expo-secure-store estão instalados. O AsyncStorage só é usado no LargeSecureStore, e não há zod nas dependências.  
  _Evidência:_ package.json:9 (@react-native-async-storage/async-storage 2.2.0), :22 (expo-secure-store ~57.0.1), :14 (aes-js); grep 'AsyncStorage' em src só aparece em src/lib/secureStorage.ts e num comentário de biometricPreference.service.ts:8
- O LargeSecureStore guarda o texto cifrado (AES-256-CTR) no AsyncStorage e a chave no SecureStore. Na leitura valida o JSON e apaga a entrada corrompida. Não tem método para listar chaves, e o SecureStore não enumera.  
  _Evidência:_ src/lib/secureStorage.ts:23-116 (encrypt :32-43, getItem com JSON.parse e remoção :78-96, setItem :99-105, removeItem :108-115), singleton em :119
- Pela regra do projeto, dado sensível nunca fica em texto puro. Há precedente: até um simples sinalizador (a preferência de biometria) foi para o SecureStore. As chaves do SecureStore só aceitam [A-Za-z0-9._-].  
  _Evidência:_ snake-thai/CLAUDE.md:22; src/services/biometricPreference.service.ts:7-9 e :22-25
- O backup automático do Android está desligado. Os dados do app não saem do aparelho por backup.  
  _Evidência:_ app.json:25 ("allowBackup": false)
- attendance_taken_at só é gravado na PRIMEIRA conclusão. Salvar de novo ('Salvar alterações') não muda esse campo, então ele sozinho não detecta uma correção feita por outra pessoa.  
  _Evidência:_ supabase/migrations/20260914190000_chamada_em_lote.sql:99-101; frequency.service.ts:87-101 (fetchRollCallState lê attendance_taken_at como concludedAt)
- attendance.updated_at não serve como versão da chamada. O gatilho genérico o atualiza em qualquer UPDATE, inclusive quando o aluno muda a própria declaração (declared_status), e o upsert do salvar_chamada regrava linhas mesmo sem mudança.  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:28-38 (handle_updated_at sempre now()) e :161-163 (trigger em attendance); 20260914120100_frequencia_fundacao.sql:22 e :49 (aluno altera declared_status/updated_at); 20260914190000_chamada_em_lote.sql:87-88 (on conflict do update set status)
- useClassAttendance começa com loading=true e objetos vazios. A cada load, officialByStudent ganha uma nova identidade, e isso dispara o reset do rascunho na tela.  
  _Evidência:_ src/hooks/useClassAttendance.ts:46-48 e :55-71; FrequenciaScreen.tsx:84-86
- Todos os caminhos de logout passam por authService.signOut: pelo contexto (DadosScreen, BiometricLockScreen) e pelo logout automático quando falta perfil. O app ainda não chama a Edge Function delete-my-account.  
  _Evidência:_ src/services/auth.service.ts:26-31; src/context/AuthProvider.tsx:129 e :194-198; src/screens/dados/DadosScreen.tsx:197; src/screens/auth/BiometricLockScreen.tsx:39; grep 'functions.invoke' em src só encontra create-student/create-staff/reset-student-password (profile.service.ts:110,165,237)
- Infra de testes: preset jest-expo, sem mock global de AsyncStorage ou SecureStore. O pacote traz um mock oficial com getAllKeys. Já existem testes de utilitário e de hook da chamada no padrão 'mockar o service + renderHook', e fake timers já são usados.  
  _Evidência:_ package.json:58-70; jest.setup.js (só mocka ícones e local-authentication); node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js:33 (getAllKeys); src/utils/__tests__/rollCall.test.ts; src/hooks/__tests__/useRollCallReview.test.ts:1-28; src/lib/__tests__/api.test.ts:149 (jest.useFakeTimers)
- Git: a branch feat/papel-professor está sincronizada com a origin, sem mudanças locais, e 10 commits à frente de origin/main.  
  _Evidência:_ git status -sb -> '## feat/papel-professor...origin/feat/papel-professor'; git log --oneline origin/main..HEAD | wc -l -> 10

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. Por quanto tempo um rascunho de chamada não concluída fica guardado no aparelho?**

- 24 horas
- 3 dias
- 7 dias

➡️ _Adotado:_ 7 dias, contados da última marcação. Cobre a chamada começada na sexta e terminada na segunda. O risco de um rascunho velho sobrescrever uma chamada salva depois fica coberto pela detecção de conflito.

**P2. Quando o professor sai da tela com marcações não salvas, quais botões o aviso mostra?**

- Manter os 2 botões atuais ('Continuar marcando' / 'Descartar'): 'Descartar' passa a apagar também o rascunho guardado; o rascunho só sobrevive se o app for fechado
- 3 botões: 'Continuar marcando' / 'Descartar' (apaga o rascunho) / 'Sair e guardar' (volta depois e recupera)

➡️ _Adotado:_ 3 botões. Com o cache, sair sem perder passa a ser possível, e 'Descartar' fica reservado para quem realmente quer jogar as marcações fora.

**P3. Ao abrir a chamada, o que fazer quando outra pessoa (professor ou admin) salvou a chamada DEPOIS que o rascunho começou?**

- Perguntar: aviso na tela com 'Usar meu rascunho' e 'Manter o que está salvo' (a lista mostra o que está salvo e fica travada até a escolha)
- Descartar o rascunho automaticamente e avisar
- Restaurar o rascunho sempre (quem salvar por último vence)

➡️ _Adotado:_ Perguntar. É uma chamada oficial que conta na frequência, e sobrescrever em silêncio o trabalho de outra pessoa é pior que um toque a mais.

**P4. Ao sair do login com uma chamada não concluída guardada, apagar direto ou avisar antes?**

- Apagar sem perguntar (privacidade em aparelho compartilhado)
- Avisar antes de sair que existe chamada não concluída neste aparelho

➡️ _Adotado:_ Apagar sem perguntar nesta entrega (KISS). Logout de professor no meio da chamada é raro, e o rascunho não pode ficar para o próximo usuário do aparelho.

## 4. Ações que só o usuário pode fazer

- [ ] Responder às 4 decisões acima (validade, botões do aviso de saída, conflito, logout). Sem resposta, o executor segue as recomendações.
- [ ] Fazer a validação manual no celular (SM-S928B): marcar alunos, fechar ou matar o app e reabrir. Use o app ou o banco de DESENVOLVIMENTO (Supabase local em Docker), nunca o de produção: o teste de conflito precisa gravar uma chamada com uma segunda conta (professor + admin).
- [ ] Estar com o celular desbloqueado e conectado por adb Wi-Fi durante o teste manual (biometria e login só você faz).

## 5. Passos atômicos

### Passo 1

Preparar a branch. A partir do ramo integrado mais recente (feat/papel-professor como está hoje, ou a main depois do merge da tarefa de PRs), crie feat/rascunho-chamada. Rode a suíte atual para ter uma linha de base.

**Como verificar:** git status -sb limpo na nova branch; `npm run typecheck` sem erros; `npm test` verde (hoje 324 testes).

### Passo 2

Criar o utilitário PURO src/utils/rollCallDraft.ts, sem import de React, Supabase ou storage. Constantes nomeadas: VERSAO_DO_RASCUNHO = 1; PREFIXO_DO_RASCUNHO = 'rollcall_draft.'; VALIDADE_DO_RASCUNHO_MS (conforme a decisão; recomendado 7*24*60*60*1000); ATRASO_PARA_GUARDAR_MS = 500. Tipos: RascunhoGuardado { versao: 1; classId: string; salvoEm: string (ISO); base: { marcacoes: Record<string, AttendanceStatus>; concluidaEm: string | null }; marcacoes: Record<string, AttendanceStatus> }, em que 'base' é o que estava gravado quando o rascunho começou. Funções com JSDoc: chaveDoRascunho(userId, classId), que remove de cada id o que não for [A-Za-z0-9_-] (restrição do SecureStore) e devolve `rollcall_draft.<user>.<aula>`; somenteMarcados(rascunho), que tira os null; mesmasMarcacoes(a, b), que compara a união das chaves tratando null como ausente; restringirAosAlunos(marcacoes, alunoIds); interpretarRascunhoGuardado(texto: string): RascunhoGuardado | null, com validação manual (JSON inválido, versão diferente, salvoEm não parseável ou status fora de 'present'/'absent' devolvem null); rascunhoVencido(salvoEmIso, agoraMs, validadeMs), em que NaN conta como vencido; avaliarRascunho({ guardado, gravado, concluidaEm, alunoIds, agoraMs }) → 'vencido' | 'identico' | 'conflito' | 'recuperar', nessa ordem de precedência. 'identico' = marcações restritas aos alunos iguais ao gravado. 'conflito' = base.marcacoes diferente do gravado OU base.concluidaEm diferente do concluidaEm atual. Por que comparar a foto da base e não timestamps: attendance_taken_at não muda ao salvar de novo, e updated_at muda com a declaração do aluno (ver situação atual). A comparação detecta exatamente mudanças na chamada, sem migration e sem depender do relógio do aparelho. Testes em src/utils/__tests__/rollCallDraft.test.ts: chave diferente por usuário e por aula; chave sem caracteres inválidos; somenteMarcados remove null; mesmasMarcacoes ignora a ordem e trata null como ausente; interpretar rejeita JSON quebrado, versão 2 e status inválido e aceita um registro válido; rascunhoVencido no limite exato (validade e validade+1 ms); avaliarRascunho em cada saída, incluindo 'vencido vence identico', 'identico vence conflito', conflito por concluidaEm null→data com as mesmas marcações, e aluno que saiu da turma não impedir o 'identico'.

_Arquivos:_ `src/utils/rollCallDraft.ts`, `src/utils/__tests__/rollCallDraft.test.ts`

**Como verificar:** `npx jest src/utils/__tests__/rollCallDraft.test.ts` verde; `npm run typecheck` sem erros (sem any).

### Passo 3

Adicionar ao LargeSecureStore o método `listKeys(prefix: string): Promise<string[]>`, que filtra `AsyncStorage.getAllKeys()` pelo prefixo. O JSDoc explica que o SecureStore não enumera e que o texto cifrado no AsyncStorage funciona como índice. Assim o conhecimento de onde cada parte mora não vaza para fora de src/lib. Criar src/lib/__tests__/secureStorage.test.ts com o mock oficial (`jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`), expo-secure-store mockado com um Map em memória e 'react-native-get-random-values' mockado como módulo vazio, usando globalThis.crypto do Node 22. Casos: setItem/getItem ida e volta; listKeys devolve só as chaves com o prefixo; removeItem apaga as duas partes.

_Arquivos:_ `src/lib/secureStorage.ts`, `src/lib/__tests__/secureStorage.test.ts`

**Como verificar:** `npx jest src/lib/__tests__/secureStorage.test.ts` verde. Se o polyfill de getRandomValues não carregar no Jest, testar só listKeys, com crypto mockado.

### Passo 4

Criar o service src/services/rollCallDraft.service.ts, a única porta para o armazenamento dos rascunhos, sempre via largeSecureStore (cifrado). Funções: lerRascunho(userId, classId): se o registro for inválido pelo interpretarRascunhoGuardado, apaga e devolve null. guardarRascunho(userId, registro): JSON.stringify para setItem. apagarRascunho(userId, classId). apagarRascunhosDoAparelho(): listKeys(PREFIXO_DO_RASCUNHO) e removeItem de cada chave em sequência, para não disparar N escritas simultâneas no Keystore. apagarRascunhosVencidos(agoraMs): Promise<number>. Nunca logar o conteúdo nem ids de aluno: no máximo contagens e classId, como já se faz em FrequenciaScreen.tsx:122. Testes em src/services/__tests__/rollCallDraft.service.test.ts, com @/lib/secureStorage mockado por um Map em memória: guardar e ler devolvem o mesmo registro; registro corrompido é apagado e vira null; apagarRascunhosDoAparelho não toca chaves de outro prefixo (ex.: a sessão sb-…-auth-token); apagarRascunhosVencidos remove só os vencidos e os ilegíveis.

_Arquivos:_ `src/services/rollCallDraft.service.ts`, `src/services/__tests__/rollCallDraft.service.test.ts`

**Como verificar:** `npx jest src/services/__tests__/rollCallDraft.service.test.ts` verde.

### Passo 5

Criar o hook src/hooks/useRollCallDraft.ts, que passa a ser dono do estado 'rascunho' hoje na tela. Parâmetros num objeto: { userId: string | null; classId; alunoIds; gravado (officialByStudent); concluidaEm: string | null; ativo: boolean }. Retorno: { rascunho, marcar(userId, status), pronto, aviso: { tipo: 'recuperado' | 'conflito'; salvoEm: string } | null, usarMeuRascunho(), descartar(), esquecer() }. Regras: (a) antes da primeira ativação, ou com userId null, rascunho = gravado, pronto = true, nada é lido nem gravado. (b) Na primeira vez que `ativo` fica true: pronto = false; lerRascunho; avaliarRascunho. 'vencido' e 'identico' apagam e seguem com o gravado. 'recuperar' aplica restringirAosAlunos(guardado.marcacoes) e aviso 'recuperado'. 'conflito' mantém o gravado, guarda o registro num ref, mostra aviso 'conflito' e PAUSA a persistência. Depois disso avaliado = true e pronto = true. Falha de leitura: log.warn sem conteúdo e segue com o gravado. (c) Depois de avaliado, mudança de identidade de `gravado` (recarga após salvar) faz rascunho = gravado, base = { gravado, concluidaEm } e aviso = null. `ativo` voltando a false (loading durante a recarga) só pausa, não relê. (d) Persistência só com avaliado e sem conflito pendente: cada mudança de rascunho reinicia um timer de ATRASO_PARA_GUARDAR_MS. Ao disparar, se mesmasMarcacoes(rascunho, gravado) → apagarRascunho; senão guardarRascunho({ versao, classId, salvoEm: new Date().toISOString(), base, marcacoes: somenteMarcados(rascunho) }). Pula a gravação se o conteúdo, sem salvoEm, for igual ao último gravado, para abrir a tela não renovar a validade. (e) Toda operação passa por uma fila em ref (`fila = fila.then(op).catch(logar)`), para um 'guardar' atrasado nunca terminar depois de um 'apagar'. (f) Flush imediato da operação pendente quando AppState sai de 'active' (o Android pode matar o processo em segundo plano) e na desmontagem, exceto depois de descartar() ou esquecer(). (g) descartar(): cancela a pendente, rascunho = gravado, aviso = null, enfileira apagar. (h) esquecer(): cancela a pendente e enfileira apagar; nunca lança. (i) usarMeuRascunho(): rascunho = marcações guardadas, base = gravado atual (rebase, para o conflito não voltar), aviso = 'recuperado', grava na hora. (j) marcar() faz early return se !pronto ou com conflito pendente, e usa alternarMarcacao de src/utils/rollCall.ts. (k) Na montagem, `void apagarRascunhosVencidos(Date.now())`. Testes em src/hooks/__tests__/useRollCallDraft.test.ts, no padrão de useRollCallReview.test.ts (service e logger mockados, renderHook com initialProps/rerender, jest.useFakeTimers, `await act(async () => { jest.advanceTimersByTime(ATRASO_PARA_GUARDAR_MS) })`, AppState.addEventListener com spy): naoDeveApagarNemGravarAntesDeCarregar (garante que o primeiro render, com rascunho {} igual a gravado {}, NÃO apaga o rascunho guardado); deveRestaurarOsRascunhosEAvisarRecuperado; deveAcusarConflitoQuandoOGravadoMudouDesdeABase; usarMeuRascunhoDeveAplicarERebasear; deveApagarEmSilencioRascunhoIdenticoAoGravado; deveApagarEmSilencioRascunhoVencido; deveJuntarMarcacoesSeguidasNumaGravacaoSo; deveApagarQuandoAsMarcacoesVoltamAoGravado; descartarDeveCancelarGravacaoPendente; esquecerDeveApagarENaoRegravarAposARecarga; deveGravarNaHoraAoIrParaSegundoPlano; naoDeveLerNemGravarSemUsuario; falhaDoArmazenamentoNaoDeveQuebrarATela.

_Arquivos:_ `src/hooks/useRollCallDraft.ts`, `src/hooks/__tests__/useRollCallDraft.test.ts`

**Como verificar:** `npx jest src/hooks/__tests__/useRollCallDraft.test.ts` verde e sem warnings de act(); `npm run typecheck` sem erros.

### Passo 6

Criar o componente src/components/RollCallDraftNotice.tsx (React.memo, estilos via useTheme e makeStyles, no padrão de MissedRollCallBanner.tsx). Props: { aviso; onDescartar; onUsarMeuRascunho; onManterSalvo }. Tipo 'recuperado': ícone, texto 'Rascunho recuperado — marcações de {formatFullDateTime(salvoEm)} ainda não foram salvas.' e Button variant 'secondary' 'Descartar rascunho'. Tipo 'conflito': 'Esta chamada foi salva por outra pessoa depois do seu rascunho de {data}. A lista mostra o que está salvo.' e dois botões, 'Usar meu rascunho' e 'Manter o que está salvo'. A11y: accessibilityRole='alert', accessibilityLiveRegion='polite', botões com accessibilityHint e área de toque de pelo menos 44 dp. Testes em src/components/__tests__/RollCallDraftNotice.test.tsx: renderiza o texto de cada tipo e cada botão chama o callback certo.

_Arquivos:_ `src/components/RollCallDraftNotice.tsx`, `src/components/__tests__/RollCallDraftNotice.test.tsx`

**Como verificar:** `npx jest src/components/__tests__/RollCallDraftNotice.test.tsx` verde.

### Passo 7

Integrar em src/screens/aulas/FrequenciaScreen.tsx. (1) Importar useAuth e ler session. (2) Remover o useState e o useEffect do rascunho (:81-86) e o marcar local (:106-112). Em troca: `const rascunhoDaChamada = useRollCallDraft({ userId: session?.user.id ?? null, classId, alunoIds: idsDosAlunos, gravado: officialByStudent, concluidaEm: estado?.concludedAt ?? null, ativo: editavel && !loading && erroDaLista === null && estado !== null })`. contagem e alterada continuam calculadas sobre rascunhoDaChamada.rascunho. (3) Em salvar (:114-130), depois de `await save(...)` ter sucesso e ANTES das recargas, chamar `await rascunhoDaChamada.esquecer()`. Trocar a mensagem de erro (:124) por 'Não foi possível salvar a chamada. Suas marcações continuam na tela e guardadas neste aparelho — tente de novo.' (4) Na RollCallRow, `editavel={editavel && !salvando && rascunhoDaChamada.pronto && rascunhoDaChamada.aviso?.tipo !== 'conflito'}` e ajustar as deps do renderItem. (5) No cabeçalho, antes da contagem (:293), renderizar RollCallDraftNotice quando aviso !== null. 'Descartar rascunho' pede confirmação (Alert 'Descartar o rascunho?') e chama descartar(). 'Manter o que está salvo' chama descartar(). 'Usar meu rascunho' chama usarMeuRascunho(). (6) No beforeRemove (:148-164), conforme a decisão; recomendado: título 'Chamada não concluída', texto 'As marcações ainda não foram salvas no sistema.', botões 'Continuar marcando' (cancel), 'Descartar' (destructive: await descartar(), depois dispatch) e 'Sair e guardar' (dispatch; o flush da desmontagem grava). (7) Atualizar o docstring (:47-59): as marcações ficam na tela E num rascunho cifrado no aparelho até concluir.

_Arquivos:_ `src/screens/aulas/FrequenciaScreen.tsx`

**Como verificar:** `npm run typecheck` sem erros; `npm test` verde; `npx jest src/components/__tests__/RollCallRow.test.tsx` continua verde (a RollCallRow não muda).

### Passo 8

Limpeza ao sair do login. Em src/services/auth.service.ts, signOut() passa a chamar `await apagarRascunhosDoAparelho()` ANTES de `supabase.auth.signOut()`, dentro de try/catch com log.warn (createLogger('auth.service')): falha de armazenamento nunca impede o logout. Isso cobre de uma vez o logout pela aba Dados, pela tela de biometria e o logout automático por perfil ausente (AuthProvider.tsx:129). Em src/services/__tests__/auth.service.test.ts, adicionar o mock de supabase.auth.signOut e de @/services/rollCallDraft.service, com os testes deveApagarOsRascunhosDeChamadaAoSair e deveSairMesmoQuandoALimpezaDosRascunhosFalha. Deixar anotado para a tarefa de exclusão de conta (LGPD): o fluxo de excluir conta, que o app ainda não chama, também precisa chamar apagarRascunhosDoAparelho().

_Arquivos:_ `src/services/auth.service.ts`, `src/services/__tests__/auth.service.test.ts`

**Como verificar:** `npx jest src/services/__tests__/auth.service.test.ts` verde.

### Passo 9

Documentação. docs/FREQUENCIA.md: na seção 'Chamada em lote', trocar 'As marcações ficam no aparelho' e 'Sair com marcações não salvas pede confirmação' por uma subseção 'Rascunho da chamada (data, versão)' com: onde fica (cifrado, por usuário e aula), quando grava (debounce e ao ir para segundo plano), recuperação e descarte, a regra de conflito (compara a foto da base; por que não attendance_taken_at/updated_at), validade, limpeza ao salvar e ao sair do login, e a limitação conhecida (toque feito menos de ~0,5 s antes de um force-stop pode se perder). docs/FUNCIONALIDADES.md:44 e README.md:22: uma frase dizendo que a chamada não concluída é recuperada ao reabrir o app. Sem tags [#N] no README.

_Arquivos:_ `docs/FREQUENCIA.md`, `docs/FUNCIONALIDADES.md`, `README.md`

**Como verificar:** Ler o diff (`git diff docs README.md`) e conferir que o texto bate com o comportamento implementado e com as decisões escolhidas.

### Passo 10

Gate e commit. Rodar typecheck e a suíte completa e fazer o commit em Conventional Commits (o husky pre-commit roda typecheck + jest), ex.: `feat(chamada): guarda o rascunho da chamada no aparelho e recupera ao reabrir`. Push e PR seguem o fluxo definido na tarefa de pushs, PRs e merges. O número de versão (hoje 1.6.0 em app.json) muda conforme a política da tarefa de versionamento: é funcionalidade nova, portanto minor.

_Arquivos:_ `app.json`

**Como verificar:** `npm run typecheck` sem erros; `npm test` verde com 324 + os novos testes (estimativa: ~35); hook do husky passa sem --no-verify; `git log -1` mostra a mensagem com a atribuição.

### Passo 11

Validação manual no celular com o app e o banco de DEV (nunca produção). Cenários: (1) professor abre uma aula já iniciada, marca 3 alunos, aperta Home, e no PC `adb shell am kill <pacote>` (mata o processo em segundo plano, como o Android faz). Ao reabrir e abrir a aula, aparece 'Rascunho recuperado' com as 3 marcações. (2) 'Descartar rascunho' volta a lista ao que está salvo; fechar e reabrir não mostra aviso. (3) Conflito: o aparelho marca e é morto; o admin conclui a mesma chamada em outra sessão; ao reabrir, aparece o aviso de conflito, a lista travada e os dois botões funcionando. (4) Concluir com sucesso, matar o app e reabrir: sem aviso. (5) Com rascunho guardado, sair do login e entrar de novo: sem aviso. (6) Sair da tela com 'Sair e guardar' e voltar: rascunho recuperado. (7) Aparelho com TalkBack: o aviso é anunciado. A validade é coberta pelos testes unitários; opcionalmente, adiantar o relógio do aparelho além da validade.

**Como verificar:** Os 7 cenários se comportam como descrito. `adb logcat` sem erro JS e sem ids de aluno ou marcações nos logs do app.

## 6. Riscos

- Corrida na abertura: o efeito de persistência, vendo rascunho {} igual a gravado {} no primeiro render, apagaria o rascunho guardado antes de ele ser lido. Mitigação: persistência só depois de 'avaliado', e um teste dedicado (naoDeveApagarNemGravarAntesDeCarregar).
- Um toque feito menos de ATRASO_PARA_GUARDAR_MS (~0,5 s) antes de um force-stop ou crash, sem passar por segundo plano, pode se perder. O flush ao sair de 'active' cobre o caso comum (Home, troca de app, morte pelo sistema). A limitação fica documentada.
- Conflito residual: se outra pessoa salvar ENQUANTO a tela está aberta (depois da restauração), ninguém detecta; vence quem salvar por último, como já acontece hoje (salvar_chamada não tem trava otimista). Fechar isso exigiria uma migration com versão da chamada (ex.: classes.attendance_saved_at atualizado a cada salvar_chamada) e o banco de dev separado. Fica fora do escopo e anotado como melhoria.
- Custo do LargeSecureStore: cada gravação escreve uma chave nova no Keystore/SecureStore. O debounce limita isso a no máximo ~2 escritas por segundo durante a chamada. Em aparelho fraco, medir; se pesar, subir o atraso para 800-1000 ms.
- Se a escrita for interrompida entre a chave (SecureStore) e o texto cifrado (AsyncStorage), a leitura gera lixo, e o getItem do LargeSecureStore apaga a entrada em silêncio (secureStorage.ts:92-95). O pior caso é perder o rascunho, nunca travar a tela.
- LGPD: o rascunho é dado pessoal em repouso no aparelho (ids de aluno + presença/falta, sem nome). Mitigações: cifrado, allowBackup=false, validade curta, limpeza no logout. A tarefa de exclusão de conta precisa chamar apagarRascunhosDoAparelho(), e o aviso de privacidade pode citar o cache local.
- Um logout com chamada não concluída apaga o rascunho sem aviso (conforme a decisão recomendada). Uma sessão perdida sem signOut (token revogado) deixa o rascunho até vencer; ele fica inacessível a outro usuário porque a chave inclui o userId.
- Teste manual de conflito e de conclusão grava no banco. Fazer só no Supabase local de dev, que depende da tarefa de separar dev e produção. No banco de produção seria gravar chamada real.
- Testes com fake timers e promessas encadeadas podem ficar instáveis (flaky) ou gerar warnings de act(). Usar `await act(async () => ...)` e jest.runOnlyPendingTimers; o polyfill react-native-get-random-values pode não carregar no Jest, então mockar no teste do secureStorage.
- Mudar o dono do estado 'rascunho' para o hook mexe no fluxo de salvar e recarregar da tela. Regressões possíveis: botão 'Salvar alterações' habilitado errado, contagem ou beforeRemove. A suíte existente não tem teste da FrequenciaScreen; cobrir no teste do hook e no roteiro manual.

## 7. Ajustes do revisor crítico

- **Conflito com T7, T9:** A exclusão LGPD não cobre os dados novos das outras tarefas. export_my_data (T7) não inclui push_devices nem notification_outbox (T9), que são dados pessoais. O rascunho de chamada (T11) só é apagado se a autoexclusão da T7 passar por authService.signOut.  
  **Resolução:** Se a T9 já estiver integrada, a T7 inclui push_devices no export. Senão, a T9 estende export_my_data. O ExcluirContaScreen da T7 encerra a sessão por AuthProvider.signOut → authService.signOut, caminho que apaga os rascunhos (T11) e o token do aparelho (T9).
- **Conflito com T6, T7, T8, T9, T10:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Afirmação a conferir:** O container do banco local se chama 'supabase_db_snake-thai'.  
  **Por quê:** Só existe o volume supabase_db_snake-thai; nenhum container do projeto está rodando (docker ps -a da T1). O nome segue o padrão da CLI e é provável, mas nenhum plano confirmou. Todos os comandos 'docker exec' dependem disso.
- **Decisão consolidada (T11):** Validade do rascunho, botões de saída e conflito.  
  **Recomendação:** Validade de 7 dias. Três botões ao sair ('Continuar marcando', 'Descartar', 'Sair e guardar'). Em conflito, perguntar ao usuário. Apagar os rascunhos ao sair do login.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T11.md` escrito
