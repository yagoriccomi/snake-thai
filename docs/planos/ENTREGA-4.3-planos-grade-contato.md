# Entrega — 4.3 Planos, grade, dias de aula e contato

> 2026-09-29, modo 🔁 Loop. Plano: [`PLANO-4.3-planos-grade-contato.md`](PLANO-4.3-planos-grade-contato.md).
> Contrato v4: § 5, § 5.2, § 5.4, § 6, T3, T4, T7, T37, T39, T44 e D58. **PRs #55 (banco), #56
> (planos, configurações e contato) e #57 (grade).**
> **Produção:** nada. Vai na 2.0.0 (4.13), na ordem do § 14.

## O que mudou

**Banco (`20260929110000_planos_grade_contato.sql`)**

- **Histórico de plano e de trancamento** mantidos por gatilho, por qualquer caminho, inclusive o
  APK 1.8. Com a T39:
  - deixar de ser fixo encerra as trocas permanentes às 00:00 do 1º dia de aula da 1ª semana
    não fixa e cancela as pendentes e as avulsas dessa semana;
  - voltar a fixo antes disso devolve os períodos;
  - trancar cancela as trocas pendentes.
- **Grade com público:**
  - `salvar_horario_da_grade` ganha `p_audience` no fim da assinatura (as chamadas de hoje
    continuam valendo);
  - o horário "só livres" pode não ter turma;
  - o público novo propaga às próximas aulas;
  - **a aula cancelada nunca é apagada nem alterada pela grade**.
- **Fim de horário:** encerra as trocas permanentes de destino no dia seguinte ao último dia,
  **nunca no passado**, e cancela as pendentes do horário. Um fim adiado ou retirado acompanha.
- **RPCs novas:** `trocas_permanentes_do_horario` (só admin) e `contato_da_academia`
  (qualquer pessoa logada; o anon recebe 42501).

**App**

| Onde | O quê |
| --- | --- |
| Dados › Planos | Modalidade (**Horário fixo · Horário livre · À vontade**), cota de 1 a 6 com − e + só no livre, o aviso da T4, selo e resumo na lista. A recusa de plano com histórico aparece com a frase do banco |
| Dados › Configurações | **Dias de aula** (chips de Seg a Dom) e **WhatsApp** com **+55** fixo. Na leitura: `+55 (DD) NNNNN-NNNN` e "Seg a Sáb" |
| Dados › Falar com a academia | Folha com WhatsApp e E-mail, só os preenchidos. Sem contato, a reserva da § 5.4. Erro com "Tentar de novo" e aviso quando o link não abre |
| `BlocoDeContato` | Pronto para os negados (4.8, 4.9a e 4.9b) |
| Turmas | Entrada **Aulas só para livres**; Excluir turma com o texto da D58 |
| Grade e horário | "Quem pode participar", selo do público e o aviso de troca permanente antes de editar e de encerrar |

## Roteiro no aparelho (👤, APK DEV com o banco local)

Antes: `scripts\db-dev reset` e `adb reverse` (o `menu.bat` cuida disso). Entre como admin.

1. **Dados › Configurações › Editar:**
   - WhatsApp `11912345678`, depois desmarque **Dom** e **Sáb** e salve;
   - na leitura, deve aparecer **+55 (11) 91234-5678** e **Seg a Sex**;
   - digite só `91234-5678` no WhatsApp e salve: o app deve recusar pedindo o DDD.
2. **Dados › Falar com a academia:**
   - aparecem **WhatsApp** e **E-mail**, e cada um abre o app certo;
   - apague os dois em Configurações: a folha diz *"A academia ainda não cadastrou um contato.
     Procure a recepção."*
3. **Dados › Planos › Novo plano:**
   - **Horário livre** mostra os botões − e +, que param em 1 e em 6;
   - crie "Livre 4x" e confira o selo **Horário livre** e "4x por semana" na lista;
   - edite um plano **em uso** (ex.: o da demonstração) e mude a modalidade: a recusa deve ser
     *"Plano com histórico: crie outro plano e mova os alunos."*
4. **Dados › Turmas › Aulas só para livres › Novo horário:**
   - aparecem "Turma: Sem turma — só livres" e "Livres" travado;
   - crie um horário e veja as aulas na aba **Aulas**.
5. **Uma turma › Grade › Novo horário:** o público vem **Fixos e livres**. Troque para
   **Livres** e salve; o cartão mostra o selo **LIVRES**.
6. **Excluir turma com alunos:** a confirmação diz *"A frequência dos alunos continua contando
   as aulas desta turma até agora."*

O aviso de troca permanente só aparece quando existir troca, e as trocas só nascem pela tela no
4.9b. No banco, ele é conferido pelo teste B9.

## Premissas e o que ficou de fora

- **T31 (recálculo do mês fechado):** entra com a conta nova, no 4.5.
- Meta semanal e menu de aulas: 4.4. O `default_weekly_goal` ainda não tem tela.
- O botão de ícone do WhatsApp não entrou: o `Button` do app não tem ícone, e os botões são só
  texto.

## Próximo passo

4.4 — Aulas do aluno, menu de aulas, extra e meta.
