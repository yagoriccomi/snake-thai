# Entrega — Primeiro acesso: a flag só cai depois da senha (item 2.4)

> 2026-09-25 · Modo 🔁 Loop · Branch `fix/primeiro-acesso-senha-antes-da-flag` · Plano:
> [`PLANO-2.4-senha-antes-da-flag.md`](PLANO-2.4-senha-antes-da-flag.md).

## O que mudou

| Arquivo | O quê |
| --- | --- |
| `src/services/profile.service.ts` | `saveOnboardingProfile` grava os dados **sem** a flag; `finishOnboarding` só baixa a flag (antes `completeProfileOnboarding` e `finishStaffOnboarding`) |
| `src/screens/onboarding/OnboardingScreen.tsx` | Ordem nova: aceite → dados → **senha** → flag → `refreshProfile`. Se só a flag falhar, repetir não troca a senha de novo |
| `src/context/AuthProvider.tsx` | Recarga do mesmo usuário sem "Carregando" (a tela não é desmontada); resposta de carga antiga descartada |

**Efeito colateral bom:** a renovação do token (a cada hora) também passava pela tela
Carregando e desmontava a tela aberta. Deixou de passar.

## Verificação

- `npm run ci` no gate dos commits: **774 testes**, tipos.
- **Caminho de falha obrigatório coberto:** a troca de senha rejeita ⇒ `finishOnboarding` nunca é
  chamado (a flag continua `true`) e o erro aparece; também para o aluno, com os dados já
  gravados.
- **Testes de mutação:** pôr a flag antes da senha derruba 5 testes; tirar a recarga silenciosa
  derruba 2; tirar o descarte da carga antiga derruba 2.
- **Não rodou no aparelho.**

## Como validar no aparelho (com conta de teste, no DEV)

1. Admin redefine a senha de um aluno de teste (volta ao primeiro acesso).
2. Entrar com a senha padrão, preencher tudo e **ligar o modo avião antes de "Concluir
   cadastro"**: aparece o erro de conexão, e a tela continua no passo dos termos.
3. Fechar o app, desligar o modo avião, entrar de novo **com a senha padrão**: o app volta ao
   primeiro acesso (antes da correção, entrava direto com a senha padrão).
4. Concluir normalmente: entra no app sem voltar ao passo 1.

## Pendências

- **Web:** mesmo defeito, mesma regra (item 3.1 do `ROADMAP-web.md`). Anotado no Registro para
  o chat da web.
- **Recomendação para depois (não feito):** o titular ainda consegue baixar a própria flag por
  `update` direto (a whitelist de `enforce_profile_update_rules` permite `is_first_login`). Um
  gatilho que só aceite baixar a flag junto da troca de senha fecharia isso no banco. Fica para a
  auditoria (3.10).
