# Plano — 4.8 Justificativas novas

> Modo 🔁 Loop, 2026-09-29. Contrato **v4**: § 9.1, § 10, § 13.5 e § 15, mais D13–D16, D22, D39,
> D42, T16–T18 e T38. Mockups: linha D (justificar, revisar). **Dois PRs:** 4.8a (banco) e 4.8b
> (app).

## Enunciado canônico

- **Problema:** a decisão de justificativa pelo UPDATE direto é recusada desde o 4.1 e não há
  caminho novo; não existe justificativa da semana, reenvio, nota obrigatória, nem a regra do
  atestado (só quem decide, e só enquanto pendente).
- **Resultado esperado:** as 7 RPCs da § 9.1, `pode_decidir_justificativa`, a RLS nova e os avisos;
  no app, justificar aula e semana, reenviar, revisar com nota e as mensagens de negada.
- **Como validar:** `regressao_justificativas.sql` e `db-dev test`; Jest; roteiro do aparelho.

## Escopo negativo [#8]

- **Anexos no app** só depois do **G2** (`/v1/justifications/sign-upload`). As RPCs já gravam o
  caminho (`anexar_a_justificativa`).
- **Solicitações** (a caixa com as categorias) é o 4.9a. A revisão entra aqui numa lista própria
  ("Justificativas para revisar"), que o 4.9a passa a chamar pela categoria Faltas de alunos.

## Premissas assumidas (modo Loop)

| # | Premissa | Por quê |
| --- | --- | --- |
| P1 | `pode_decidir_justificativa` = pendente **e** (de aula: equipe da aula; de semana: T18). O admin decide qualquer uma, conferido à parte | § 9.1: "quem `pode_decidir_justificativa` ou admin" |
| P2 | A política de UPDATE continua alcançando quem vê a linha, e a trava decide o que muda; assim o APK 1.8 recebe "Atualize o aplicativo para decidir justificativas." em vez de mudar zero linhas em silêncio | § 15 |
| P3 | No reenvio, o anexo da tentativa 1 vai para `absence_justification_attempts` e **não** entra na fila de exclusão (o gatilho de fila confere se o caminho foi para o arquivo) | T16: a tentativa 1 fica para o admin; o cron dos 180 dias a apaga depois |
| P4 | Textos que o contrato não escreve: *"Você já enviou uma justificativa para esta aula."*, *"Informe a aula ou a semana."*, *"Só a primeira justificativa negada pode ser reenviada."*, *"O prazo para reenviar terminou."*, *"Esta justificativa não aceita mais anexo."*, *"Escolha aprovar ou negar."*, *"Escreva a nota da decisão, com até 500 caracteres."*, *"Esta justificativa já foi decidida."* | Frase para a pessoa |
| P5 | O aviso `justificativa_pendente` passa a ir a quem pode decidir (de semana: T18); sem ninguém, aos admins; a tentativa 2 tem a chave `:2` | § 10 |

## Passos (4.8a)

| # | Arquivo | O que muda | Prática | Verificação |
| --- | --- | --- | --- | --- |
| 1 | `supabase/migrations/20260929170000_justificativas.sql` | Trava com `snake.justificativa_rpc`; `pode_decidir_justificativa`; RLS de leitura e de UPDATE; o aviso pendente; a fila que não apaga o anexo da tentativa 1; as 7 RPCs | [#87] [#6] | `db-dev reset` |
| 2 | `supabase/tests/regressao_justificativas.sql` | J1–J12 | [#41] | `db-dev test` |

## Definição de pronto

- [ ] 4.8a: `db-dev test` e `reset` verdes, tipos, PR com CI verde, Registro (com a linha para o
  servidor: a segunda barreira da § 13.5 já pode usar `pode_decidir_justificativa`);
- [ ] 4.8b: Jest verde, PR, entrega com o roteiro do aparelho.
