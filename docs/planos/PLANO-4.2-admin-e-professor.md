# Plano — 4.2 Admin é professor

> Modo 🔁 Loop, 2026-09-29. Contrato **v4, § 4** (e T24). Mockup: linha A, "Novo horário"
> (professores com "Júlia · admin" e a cor dele). Depende do G1 (aberto em 29/09).
> **Dois PRs:** 4.2a (banco, `create-staff` e tipos) e 4.2b (app).

## Enunciado canônico

- **Problema:** hoje só `role = 'professor'` dá aula. O admin não entra em aula e não aparece no
  seletor da grade. A constraint de cor proíbe que ele tenha cor, e promover um professor apaga a
  cor dele.
- **Resultado esperado:** o admin com cor é tratado como professor em tudo o que é dar aula. Ele
  entra e sai de aula, é escalado na grade, aparece com a bolinha para todos e recebe os avisos de
  professor da aula. Continua vendo o Financeiro. Sem cor, o app pede a cor antes de ele entrar
  (T24). Promover mantém a cor.
- **Como validar:**
  - `scripts\db-dev test` verde, com o teste novo `regressao_admin_professor.sql` e o P4 reescrito;
  - Jest verde;
  - no app DEV (roteiro do "Aparelho", no 4.2b), o admin entra numa aula e aparece no trilho de cor.

## Escopo negativo [#8]

- **Não muda `is_professor()`** (§ 4: só `'professor'`). As políticas que já liberam o admin por
  `is_admin()` ficam como estão (entrar e sair de aula, criar aula e ler a grade).
- Não cria tela de promoção (Pessoas é o 4.10). `updateUserRole` fica sem chamador, como hoje.
- Não mexe no público da grade nem no `p_audience` (4.3).
- Não cria paleta de cores: a cor continua digitada em hex, como hoje (a paleta não está no
  contrato nem no mockup).
- **Produção:** a migration e a `create-staff` só vão na 2.0.0 (4.13), na ordem do § 14.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê | Se estiver errada… |
| --- | --- | --- | --- |
| P1 | **Tirar a cor de um admin** é recusado (`23514`) se ele estiver em `class_teachers` de aula com `date_time > now()`, **cancelada ou não**. A regra roda em `enforce_role_change_rules`, que passa a disparar em `before update of role, color` | O § 4 manda recusar e põe a regra nessa função. Olhar só a data é o mais simples, e a aula cancelada pode ser reativada [#7] | Afrouxar depois é uma linha |
| P2 | O `coalesce(new.color, old.color)` vale **só** na promoção professor→admin, como diz o § 4, e também sem sessão | É o que o APK 1.8 manda (`color: null`). Rebaixar continua exigindo cor | — |
| P3 | Na grade e na geração de aulas, o filtro vira `role in ('professor','admin') and color is not null`, com a mensagem *"Só professores e administradores ativos com cor podem ser escalados na grade."* | O § 4 fala em "equipe ativa com cor". A mensagem não é rótulo da § 3 | Troca de texto |
| P4 | `diretorio_perfis.schedule_mode` = modalidade do **plano atual** (`profiles.plan_id`), `'fixed'` sem plano, nula para a equipe | Literal do § 4 | — |
| P5 | No app, **"pedir a cor"** (T24) é uma folha com o mesmo campo hex da seção MINHA COR. Salva a cor e então entra na aula | Reaproveita o componente e a validação que já existem [#6] | Vira a paleta, se o dono pedir |
| P6 | O admin **sem cor** pode apagar a cor em MINHA COR. O professor, não: a constraint exige cor dele | § 4 ("tirar a cor de um admin é outro `update`") | — |
| P7 | No seletor da grade, o admin aparece como **"{nome} · admin"** | Mockup da linha A | — |

## Decisão visual (4.2b)

- **Superfície visual:** sim. MINHA COR para o admin, Entrar/Sair da aula para o admin, a folha
  "Qual a sua cor?" do T24 e o rótulo "· admin" no seletor.
- **Mockup novo:** não. A linha A já mostra o seletor. O resto repete padrões existentes (a seção
  MINHA COR, os botões do detalhe da aula e a `BottomSheet`).
- **`design-de-interface-projeto`:** acionada no 4.2b, para a folha e os estados (carregando,
  erro e cor inválida).

## Passos — 4.2a (banco)

| # | Arquivo | O que muda | Prática | Como verificar |
| --- | --- | --- | --- | --- |
| a1 | `supabase/migrations/20260929100000_admin_e_professor.sql` | `profiles_color_only_for_professor` → `profiles_color_by_role` (`NOT VALID` → conferência → `VALIDATE`) | [#87] | Teste A1 |
| a2 | idem | `enforce_class_teacher_is_professor` aceita equipe com cor. Os dois gatilhos passam a `before insert or update of teacher_id` | [#11] | A2 a A4 |
| a3 | idem | `enforce_role_change_rules`: `coalesce` na promoção e trava de tirar a cor (P1). Gatilho `before update of role, color` | [#9] | A5, A6 e o P4 reescrito |
| a4 | idem | `gerar_aulas_da_grade` e `salvar_horario_da_grade` (mesmas assinaturas) com o filtro da P3 | [#6] | A7 e A8 |
| a5 | idem | `diretorio_perfis` com o filtro novo e `schedule_mode` no fim (`create or replace view`, com as colunas antigas na mesma ordem) | [#28] | A9 a A11 |
| a6 | idem | `notificar_justificativa_pendente` e `enfileirar_avisos_aula_sem_chamada` sem o filtro `role = 'professor'` | [#6] | A12 e A13 |
| a7 | `supabase/tests/regressao_admin_professor.sql` | Testes A1 a A13, mais o anon | [#41][#46] | `scripts\db-dev test` |
| a8 | `supabase/tests/regressao_promocao_de_papel.sql` | P3 confere que a cor ficou; P4 passa a esperar "promover mantém a cor" | [#41] | idem |
| a9 | `supabase/functions/create-staff/index.ts` | Cor opcional para admin, validada se enviada | [#51] | Leitura. Não há teste Deno da função |
| a10 | `src/types/database.types.ts` | `scripts\db-dev types` (`schedule_mode` na view) | [#11] | `tsc` |

## Passos — 4.2b (app)

| # | Arquivo | O que muda | Como verificar |
| --- | --- | --- | --- |
| b1 | `src/context/AuthProvider.tsx` | `isStaff` (professor ou admin). `isProfessor` não muda | Teste das flags |
| b2 | `src/services/profile.service.ts` | `fetchAllProfessors` → equipe ativa com cor (`role in (professor, admin)`, `color` não nula), com o `role` no retorno | Teste do serviço |
| b3 | `src/components/ProfessorMultiPicker.tsx` | Rótulo "{nome} · admin" | `GradePickers.test.tsx` |
| b4 | `src/screens/dados/DadosScreen.tsx` | MINHA COR para `isStaff`. O admin pode deixar vazio (P6) | Teste novo |
| b5 | `src/screens/aulas/DetalheAulaScreen.tsx` + folha nova | Entrar/Sair para o admin. Sem cor, a folha do T24 pede a cor antes | Teste novo |
| b6 | `src/utils/cor.ts` (novo) | `HEX_COLOR_REGEX` num lugar só (hoje duplicado) | Testes existentes |
| b7 | `src/screens/dados/CadastrarEquipeScreen.tsx` | Cor opcional para admin | Teste novo |
| b8 | Aba Financeiro | **Sem mudança** (`!isProfessor` já inclui o admin) | `MainTabNavigator.test.tsx` |

## Riscos e rollback [#84]

- **APK 1.8 com o banco novo:** a promoção com `color: null` passa a manter a cor (o § 15 prevê).
  O professor com APK 1.8 passa a ver o admin com cor no trilho, que só lê a view.
- **Ordem de produção:** a `create-staff` nova aceita cor de admin; a antiga recusa. As duas
  convivem com o banco novo, porque a constraint aceita admin com e sem cor.
- **Rollback:** migration nova revertendo a constraint e as funções. Como é a primeira migration
  da série, o `db-dev reset` volta ao estado anterior.

## Definição de pronto

- [ ] 4.2a: `db-dev test` e `reset` verdes, tipos gerados, PR mesclado com o CI verde
- [ ] 4.2b: Jest e `tsc` verdes, PR mesclado com o CI verde
- [ ] Roteiro de aparelho escrito na entrega (o teste no celular é seu)
- [ ] Roadmap e Registro atualizados
