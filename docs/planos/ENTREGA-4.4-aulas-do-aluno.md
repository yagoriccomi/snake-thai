# Entrega — 4.4 Aulas do aluno, menu de aulas, extra e meta

> 2026-09-29, modo 🔁 Loop. Plano: [`PLANO-4.4-aulas-do-aluno.md`](PLANO-4.4-aulas-do-aluno.md).
> Contrato v4: § 5.3, § 9.2, § 9.5, § 12 e § 12.2. **PR #58 (banco) e PR #59 (app).**
> **Produção:** nada. Vai na 2.0.0 (4.13).

## O que mudou

**Banco (#58)**

- `aulas_do_aluno`, `menu_de_aulas`, `declarar_aula`, `definir_meta_semanal` e `meta_da_semana`.
- As travas da declaração valem também para o upsert direto do APK 1.8 e da web atual.
- **Correção de segurança do 4.1:** as travas da aula e da chamada liberavam numa sessão nova da
  API. O detalhe está no Registro.

**App (#59)**

| Onde | O quê |
| --- | --- |
| Aulas (aluno) | Lê `aulas_do_aluno` de hoje até duas semanas. **Livre:** **Vou** e **Desmarcar**, cartão "Esta semana" com a cota em barra, e o aviso de acima da cota (§ 3) com **Desfazer**, que nunca bloqueia. **À vontade:** "Sua meta: {n}x por semana" com **Mudar**. **Fixo:** **Vou / Não vou** nas aulas dele (o "Não vou" abre a justificativa quando a aula aceita), selos **Troca**, **Troca permanente**, **Troca pendente** e **Extra**, e "Trocou para…" e "no lugar de…". A aula cancelada aparece riscada, com **Cancelada** (no fixo, "Aula abonada: não conta no seu mês") |
| **Escolher aulas** → **Aulas da semana** | Abas **Esta semana** / **Próxima semana**, um bloco por dia de aula (`class_weekdays`, com "Nenhuma aula neste dia.") e as ações da tabela da § 12.2: **Vou**, **Desmarcar**, **Vou (extra)**, **Vou / Não vou**. Os dias que já passaram aparecem marcados "· JÁ PASSOU" |
| Folha da meta | "Meta da próxima semana" com − e + (de 1 a 6) e o texto do mockup ("Vale a partir de {seg dd/mm}. A meta desta semana continua {n}x…") |
| Recusas | A frase do banco aparece na tela (ex.: "Você já tem aula neste horário. Para ir nesta, peça a troca.") |
| Código | `Stepper` compartilhado com os Planos. `useStudentClasses`, `ClassCard` (sem uso), `declareAttendance`, `fetchUpcomingClassesForStudent`, `fetchOwnAttendance` e `fetchOwnJustifications` removidos |

**O que ficou para os blocos seguintes:** os botões de troca (**Trocar para esta**, **Desistir da
troca**) no 4.9b; a justificativa nova com prazo e reenvio no 4.8; "Eu estava na aula" no 4.9a;
Semana e Mês no cartão de frequência no 4.5. As colunas de todos eles já vêm do banco.

**Diferença do mockup:** a faixa de dias no topo do menu (Seg 22 · Ter 23…) não entrou. O
contrato pede um bloco por dia, e a lista já mostra todos os dias em sequência [#7].

## Roteiro no aparelho (👤, APK DEV com o banco local)

Antes: `scripts\db-dev reset` e `adb reverse`. Os alunos da demonstração são fixos. Para testar o
livre e o à vontade, mude o plano de um aluno de teste em **Dados › Gerenciar alunos**, criando
antes um plano livre 1x e um à vontade em **Planos**.

1. **Aluno livre (1x):** em **Aulas**, marque **Vou** em uma aula. Marque em uma segunda: aparece
   "Marcada, acima do plano" com o texto da cota. **Desfazer** desmarca.
2. **Aluno livre:** **Escolher aulas** → **Próxima semana**: as aulas que aceitam livres, com
   **Vou**. Aulas só de fixos não aparecem.
3. **Aluno à vontade:** o cartão "Sua meta: 4x por semana" → **Mudar** → 5 → **Salvar meta**. A
   meta desta semana continua 4x.
4. **Aluno fixo:** em **Aulas**, **Não vou** numa aula dele abre a justificativa.
5. **Aluno fixo:** **Escolher aulas**: todas as aulas da semana, de qualquer turma. Numa aula de
   outra turma, **Vou (extra)** → selo **Extra** e **Desmarcar**. Numa aula no mesmo horário da
   dele, **Vou (extra)** não aparece.
6. **Aluno fixo:** marque **Vou (extra)** numa aula e, no APK 1.8 ou na web, tente "Não vou" nela:
   a declaração só é limpa, nunca vira falta.

## Próximo passo

4.5 — Frequência nova (a conta).
