# ENTREGA — T10: monitoramento de erros no aparelho

| Campo | Valor |
|---|---|
| **Tarefa** | `T10` |
| **Plano** | [`PLANO-T10.md`](PLANO-T10.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/monitoramento-erros` |
| **Status** | 🟡 Código pronto, testado e compilando; fica desligado até você criar a conta no Sentry e colocar o DSN |

---

## 1. O que foi feito

Até hoje um erro no celular de um aluno só ia para o console do aparelho e se perdia, e
um erro de renderização fechava o app sem rastro. Agora:

- os erros registrados pelo app (`log.error`), os erros de tela e os travamentos nativos
  vão para o **Sentry**;
- nenhum dado pessoal sai do aparelho: sem nome, e-mail, CPF, telefone, IP, token ou query
  string, e o "usuário" é um id aleatório da instalação mais o papel;
- um erro de tela mostra "Algo deu errado / Tentar de novo" em vez de fechar o app;
- no app DEV, o Perfil tem um diagnóstico para testar tudo de ponta a ponta.

Tudo fica **desligado** enquanto não houver `EXPO_PUBLIC_SENTRY_DSN`, e o build não quebra
sem o token do Sentry.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `package.json` | `@sentry/react-native ~7.11.0` (versão validada pelo Expo 57) |
| `metro.config.js` | Debug IDs para o stack legível |
| `app.json` | Plugin `@sentry/react-native/expo`, sem slugs (vêm de `SENTRY_ORG`/`SENTRY_PROJECT` no build) |
| `src/lib/monitoring/` | `index.ts` (único ponto do SDK), `scrub.ts` (filtros de PII), `installId.ts`, `init.ts` |
| `src/lib/logger.ts` | `setLogSink` para o coletor remoto; mensagem de erro filtrada; `name`/`nome`/`dob`/`nascimento` mascarados |
| `index.ts` | Monitoramento ligado na primeira linha (pega falha de boot) |
| `App.tsx` | `AppErrorBoundary` dentro do tema; raiz envolvida pelo Sentry quando ligado |
| `src/components/AppErrorBoundary.tsx`, `ErrorFallbackScreen.tsx` | Tela de erro amigável |
| `src/context/AuthProvider.tsx` | Usuário do monitoramento = id da instalação + papel; limpa ao sair |
| `src/hooks/useDiagnosticoDeErros.ts`, `DadosScreen.tsx` | Diagnóstico só fora de produção |
| `jest.setup.js` | Mock global do SDK |
| `menu.bat`, `.github/workflows/release.yml` | Sem token: envio de source maps desligado com aviso; DSN e token opcionais no Actions |
| `scripts/gerar-env-dev.js` | Preserva o DSN do `.env.dev` |
| `README.md`, `.env.example`, `docs/RUNBOOK.md`, `LICENSE_AUDIT.md`, `SECURITY.md`, `CLAUDE.md`, `.gitignore` | Documentação |

## 3. Como validar

1. Sem DSN: `npm start` (DEV) — o app abre normalmente; nada é enviado.
2. Com a conta criada: DSN no `.env.dev`, token em `.env.sentry-build-plugin`, `menu.bat` → `[P]` → `[5]` → `[9]`.
3. No celular, Perfil → **Diagnóstico de erros** → "Enviar erro de teste", "Erro de tela" e "Travamento nativo" (reabrir o app depois deste).
4. No painel: 3 *issues* em `environment: development`, frames em `src/…`, *release* `com.snakethai.app.dev@1.6.0+dev.N.sha+1006000`, sem IP, e-mail ou CPF, com a tag `role`.
5. No APK de produção, a linha de diagnóstico não aparece.

## 4. Verificações executadas

- [x] `scrub` 11 testes (CPF do PostgREST, e-mail, telefone, JWT, Bearer, URL assinada, usuário só com id, trilha de console descartada, falha de rede), sem estragar UUID, data ou código de erro
- [x] `logger` 6 testes novos (erro original ao coletor, contexto mascarado, warn só como trilha, coletor ausente ou quebrado não derruba, CPF dentro da mensagem não vaza)
- [x] `monitoring` 12 testes (desligado sem DSN e no Metro debug, environment da variante, `beforeSend` descarta rede e filtra, logger ligado, `captureException`/`captureMessage` sem PII, SDK quebrado não propaga, usuário = id + papel, limpeza, raiz sem wrap quando desligado)
- [x] `installId` 3, `AppErrorBoundary` 3, `useDiagnosticoDeErros` 3
- [x] Suíte completa 481 e typecheck verdes; licenças sem copyleft
- [x] Prebuild PROD: `apply sentry.gradle` e a trava de assinatura (T2) convivem no `build.gradle`; `sentry.properties` sem token
- [x] Prebuild DEV: Sentry presente, sem a trava de assinatura, versão consistente; bundle JS gerado com o Metro do Sentry
- [x] actionlint do `release.yml` limpo
- [x] APK DEV compilado com o SDK nativo (`release/snake-thai-dev-v1.6.0+dev.49.d320bf9.apk`, 14 min): a tarefa `SentryUpload` foi **pulada** sem token, como previsto, e o build terminou com sucesso
- [ ] Evento real chegando ao painel — depende da conta no Sentry e do celular

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | Sentry, não tabela própria no Supabase | Único jeito de ver travamento nativo e stack legível sem reconstruir agrupamento e alerta | — |
| P2 | Organização na UE (Frankfurt) | GDPR facilita justificar a transferência; a escolha é irreversível | Criar nos EUA (nada no código muda) |
| P3 | Usuário = id aleatório da instalação + papel | Conta pessoas afetadas sem identificar ninguém | Trocar `setMonitoringUser` para o id do perfil |
| P4 | Um projeto, separado por `environment` | Cota é por organização; filtro simples | Dois DSNs, um em cada `.env` |
| P5 | Só `log.error` vira evento | Protege a cota gratuita | `sinkDoSentry.breadcrumb` → `captureMessage` |
| P6 | Diagnóstico visível só fora de produção | Testar cada release sem código temporário | Remover o grupo em `DadosScreen` |
| P7 | Boundary próprio (`AppErrorBoundary`) em vez do `Sentry.ErrorBoundary` | Funciona com o monitoramento desligado e passa pelo mesmo logger | — |

## 6. Decisão visual

Mockup: não. A `design-de-interface-projeto` definiu o fallback no desenho do `ErrorState`
(ícone `alert-circle` em `error`, "Algo deu errado", "O erro foi registrado. Tente de novo.",
botão primário), sem detalhe técnico, com o texto como `alert` e o botão focável no
TalkBack; e o diagnóstico como uma `NavRow` num grupo próprio "DIAGNÓSTICO".

## 7. Pendências

- [ ] 👤 Criar a conta no Sentry (plano Developer, 2FA), a organização (região — irreversível) e o projeto React Native; ligar "Prevent Storing of IP Addresses" e os Data Scrubbers
- [ ] 👤 Colar o DSN em `EXPO_PUBLIC_SENTRY_DSN` no `.env.dev` e no `.env.prod`; token e slugs em `.env.sentry-build-plugin` (e, para o Actions, secret `SENTRY_AUTH_TOKEN`, variáveis `SENTRY_ORG`/`SENTRY_PROJECT` e secret `EXPO_PUBLIC_SENTRY_DSN` no Environment `release`)
- [ ] 👤 Regra de alerta por e-mail para issue nova em produção
- [ ] 👤 **Política de Privacidade:** citar o Sentry como operador (dados técnicos de falha, sem nome/CPF/e-mail; id aleatório; região; 30 dias) antes de publicar o APK com o DSN de produção — entra na versão única da política (lacuna L4)
- [ ] 👤 Validar os cenários da seção 3 no celular

## 8. Próximo passo

**T7 — editar dados do aluno e exclusão de conta (LGPD).**
