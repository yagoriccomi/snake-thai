# Entrega — 4.2 Admin é professor

> 2026-09-29, modo 🔁 Loop. Plano: [`PLANO-4.2-admin-e-professor.md`](PLANO-4.2-admin-e-professor.md).
> Contrato v4, § 4 e T24. **PR #52** (banco, mesclado) e **PR do 4.2b** (app).
> **Produção:** nada. Vai na 2.0.0 (4.13), na ordem do § 14: `create-staff` depois das migrations,
> e a APK no mesmo dia.

## O que mudou

**Banco (4.2a, `20260929100000_admin_e_professor.sql`)**

- `profiles_color_by_role`: professor sempre tem cor, aluno nunca, admin pode ter.
- O admin com cor entra em aula e é escalado na grade. Sem cor, o banco recusa com *"Escolha
  a sua cor antes de entrar na aula."*
- Promover mantém a cor. O admin escalado em aula futura não consegue apagar a cor.
- `diretorio_perfis` mostra o admin com cor para todos e ganha `schedule_mode` no fim.
- Os avisos de professor da aula (justificativa e chamada pendente) chegam ao admin escalado.
- A `create-staff` aceita a cor do admin, que é opcional.

**App (4.2b)**

| Arquivo | Mudança |
| --- | --- |
| `src/context/AuthProvider.tsx` | `isStaff` (professor ou admin). `isProfessor` não muda: a aba Financeiro continua para o admin |
| `src/utils/cor.ts` (novo) | Formato, mensagem e cor sugerida num lugar só (antes estavam duplicados) |
| `src/components/CampoDeCor.tsx` (novo) | Campo hex com a bolinha de prévia, usado nas três telas |
| `src/components/PedirCorSheet.tsx` (novo) | Folha "Escolha a sua cor" (T24): salva a cor e entra na aula |
| `src/screens/aulas/DetalheAulaScreen.tsx` | Entrar/Sair da aula para o admin. As falhas de entrar, de sair e de carregar os professores passam a aparecer na tela (antes só iam para o log) |
| `src/screens/dados/DadosScreen.tsx` | MINHA COR para a equipe. O admin pode apagar a cor |
| `src/screens/dados/CadastrarEquipeScreen.tsx` | Cor opcional para o admin. Ele começa sem cor, e o professor com a sugerida |
| `src/components/ProfessorMultiPicker.tsx` | Lista professores e admins com cor. O admin aparece como "{nome} · admin" |
| `src/services/profile.service.ts` | `fetchTeachingStaff` substitui `fetchAllProfessors`. `updateOwnColor` aceita `null` e mostra a frase do banco. Promover não manda mais `color: null` |
| `src/services/classes.service.ts` | Entrar e sair da aula mostram a frase do banco (`23514`) |
| `docs/MANUAL-DO-ADMINISTRADOR.md` | "Dar aula como administrador" |

**Testes:** SQL `regressao_admin_professor.sql` (A1 a A13) e o P3/P4 reescritos. Jest:
`DetalheAulaScreen.test.tsx` (7), `CadastrarEquipeScreen.test.tsx` (4), `DadosScreen.cor.test.tsx`
(5) e `AuthProvider.papeis.test.tsx` (3), além do seletor da grade e dos serviços.

## Roteiro no aparelho (👤, APK DEV com o banco local)

Antes: `scripts\db-dev reset`, `scripts\db-dev funcoes` num terminal e `adb reverse` (o `menu.bat`
cuida disso). Entre como um admin da demonstração.

1. **Dados → Minha cor** aparece. O campo diz "(opcional)". Apague a cor e salve: aparece "Cor
   atualizada com sucesso.".
2. **Aulas → uma aula futura → Entrar nesta aula.** Sem cor, abre a folha **Escolha a sua cor**.
   Digite `laranja`: aparece "Cor inválida — use o formato #RRGGBB.". Digite `#FB923C` e toque em
   **Salvar e entrar**: a folha fecha, a sua bolinha aparece no cartão da aula e o botão vira
   **Sair da aula**.
3. **Dados → Minha cor**: apague a cor e salve. O app recusa com "Você está em aulas que ainda
   vão acontecer. Saia delas antes de apagar a sua cor.".
4. Volte à aula → **Sair da aula** → a bolinha some.
5. **Dados → Turmas e grade semanal → Grade semanal → Novo horário → Professores:** você aparece
   como "**{seu nome} · admin**", com a sua cor.
6. **Dados → Cadastrar professor ou admin → Administrador:** o campo de cor vem vazio e
   "(opcional)". Cadastrar sem cor funciona.
7. Entre como **aluno** da turma da aula do passo 2: a sua bolinha (do admin) aparece na aula.

## Premissas (do plano) e o que ficou de fora

- A trava de apagar a cor olha **qualquer aula futura**, inclusive a cancelada (P1).
- A cor continua digitada em hex. **A paleta não entrou**, porque não está no contrato nem no
  mockup.
- Pessoas e a promoção pela tela ficam no 4.10.

## Próximo passo

4.3 — Planos, grade, dias de aula e contato.
