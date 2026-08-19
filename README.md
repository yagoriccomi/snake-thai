# Snake Thai 🐍

App mobile para **gestão e controle de alunos de academia**: perfis, turmas/aulas,
presença (check-in), planos e pagamentos (comprovantes PIX). Construído com foco em
**segurança**, **acessibilidade** e **conformidade com a LGPD** para dados sensíveis
(CPF, telefone, data de nascimento).

## ✨ Features (roadmap inicial)

- Autenticação de alunos e administradores com sessão persistida de forma **cifrada**.
- Desbloqueio por **impressão digital opcional**: o app pergunta uma vez, respeita a escolha e deixa um interruptor no perfil.
- Troca de senha pelo próprio usuário (exigindo a senha atual) e **redefinição pelo admin** para a senha padrão.
- Política de senha forte com **checklist ao vivo** do que falta (maiúscula, minúscula, número e especial).
- Cadastro de perfis com segregação rígida de acesso por papel (aluno × admin).
- Agenda de aulas (rotina e eventos) por turma.
- Registro de presença explícito por aula.
- Gestão de pagamentos com envio e aprovação de comprovantes.

## 🛠️ Tecnologias

- **Mobile:** React Native + Expo (SDK 57) + TypeScript (modo estrito)
- **Backend/BaaS:** Supabase (Auth, Postgres com RLS, Storage)
- **Sessão segura:** Expo SecureStore + AsyncStorage cifrado (AES-256)

## 🚀 Rodando localmente

### Pré-requisitos do host

Este é um app **React Native (Expo)**, que roda **nativo no host** — não é
containerizável. Instale na sua máquina:

- **Node.js** 20 LTS ou superior — <https://nodejs.org>
- **Git**
- App **Expo Go** no seu celular (Android/iOS) para testar sem build nativo — ou:
  - **Android:** [Android Studio](https://developer.android.com/studio) + **JDK 17**,
    com as variáveis `ANDROID_HOME` e `JAVA_HOME` configuradas no `PATH`.
  - **iOS:** **Xcode** (somente em macOS).
- **(Opcional) Supabase CLI** para subir o backend localmente —
  <https://supabase.com/docs/guides/cli>. A CLI gerencia seu próprio Docker.

### Passo a passo

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente (copie o exemplo e preencha):
   ```bash
   cp .env.example .env
   ```

3. (Opcional) Suba o backend local do Supabase e o app:
   - Windows: `scripts\dev.bat start`
   - Linux/Mac: `./scripts/dev.sh start`

   Ou apenas o app Expo:
   ```bash
   npm start
   ```

4. Abra no **Expo Go** lendo o QR Code, ou pressione `a` (Android) / `i` (iOS).

> **Windows:** o `menu.bat` na raiz concentra o dia a dia — subir o Metro, conectar
> o aparelho por ADB Wi-Fi, gerar o APK e instalar. Ele elege um único alvo ADB
> (`ANDROID_SERIAL`), então o erro `more than one device/emulator` não ocorre nem
> quando o mesmo celular está conectado por cabo e por Wi-Fi ao mesmo tempo.

### Debug x Release — por que o app "não abre sozinho"

O APK **debug** não carrega JavaScript embutido: ele busca o bundle no Metro a
cada abertura. Se o servidor não estiver no ar (ou o `adb reverse` tiver caído),
o app mostra tela preta ou `Unable to load script`. Isso é o comportamento
normal de um build de desenvolvimento — não é falha do aplicativo.

Para usar o app no celular sem depender do computador, gere o **release**, que
empacota o JS dentro do APK:

```bash
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

| | Debug | Release |
| --- | --- | --- |
| Precisa do Metro rodando | Sim | Não |
| Recarrega ao salvar arquivo | Sim | Não (exige novo build) |
| Uso indicado | desenvolvimento | levar no bolso, testar de verdade |

### Porta do Metro

O projeto usa a porta **6969** em vez da 8081 padrão do React Native, que conflita
com qualquer outro projeto RN aberto na máquina. A porta é definida em três lugares
que precisam continuar coerentes:

| Onde | Para quê |
| --- | --- |
| `package.json` (`--port 6969`) | porta em que o servidor Metro sobe |
| `android/gradle.properties` (`reactNativeDevServerPort`) | porta **embutida no APK**, que o app procura ao iniciar |
| `menu.bat` (`METRO_PORT`) | servidor, build (`-PreactNativeDevServerPort`) e liberação da porta |

Como a pasta `android/` não é versionada (fluxo prebuild), um `expo prebuild --clean`
apaga a propriedade do Gradle — o `menu.bat` a reaplica sozinho antes de cada build.
**Trocar a porta exige recompilar o APK**, pois ela vira um resource do binário.

## 📝 Variáveis de Ambiente

| Variável | Propósito |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase (ex.: `https://xxxx.supabase.co`). |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave pública `anon` do Supabase (segura no cliente; proteção real vem das políticas de RLS). |

> A chave `service_role` **nunca** deve ser colocada no app.

## 🗄️ Banco de Dados (Supabase)

O esquema é versionado em `supabase/migrations/` (migrations first — nunca altere pelo
Dashboard). Após aplicar as migrations, sincronize os tipos do TypeScript:

```bash
# projeto remoto
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.types.ts

# ou ambiente local (com supabase start)
npm run supabase:types
```

## 📂 Estrutura

```
snake-thai/
├── App.tsx                 # Componente raiz (Dark Mode)
├── index.ts                # Entry point (registerRootComponent)
├── app.json                # Configuração do Expo
├── src/
│   ├── config/             # env.ts — leitura validada de variáveis de ambiente
│   ├── constants/          # theme.ts — design tokens da marca
│   ├── lib/                # supabase.ts (cliente) + secureStorage.ts (sessão cifrada)
│   └── types/              # database.types.ts (gerado pelo Supabase CLI)
├── supabase/migrations/    # Migrations SQL versionadas
└── scripts/                # dev.bat / dev.sh — controle do ambiente local
```

## 📜 Scripts úteis

| Comando | Ação |
| --- | --- |
| `npm start` | Inicia o Metro/Expo na porta **6969**. |
| `npm run android` / `ios` / `web` | Abre em uma plataforma específica (mesma porta). |
| `npm run typecheck` | Checagem de tipos estrita (`tsc --noEmit`). |
| `npm test` | Executa os testes (Jest + React Native Testing Library). |
| `npm run supabase:types` | Gera os tipos do banco local. |

## 📚 Documentação

A documentação completa vive em [`docs/`](docs/README.md):

- **[Manual do Administrador](docs/MANUAL-DO-ADMINISTRADOR.md)** — operar o sistema pelo celular, sem depender do dev.
- **[Arquitetura](docs/ARQUITETURA.md)** — camadas, RLS e Edge Functions (comece aqui se é dev novo no projeto).
- **[Runbook](docs/RUNBOOK.md)** — migrations, tipos, APK, rotação de chaves.
- **[Edge Functions](docs/EDGE-FUNCTIONS.md)** — contratos das funções server-side.
- Auditorias: [REVIEW.md](REVIEW.md) · [SECURITY.md](SECURITY.md) · [LICENSE_AUDIT.md](LICENSE_AUDIT.md)

## ⚡ Edge Functions

Operações que exigem a `service_role` (nunca exposta no app) vivem em Edge
Functions Deno, e ambas verificam pelo JWT que quem chama é **administrador**:

| Função | O que faz |
| --- | --- |
| `create-student` | Cria a conta do aluno com a senha padrão e inicializa o perfil. |
| `reset-student-password` | Devolve a conta à senha padrão e remarca `is_first_login`, forçando nova senha no próximo acesso. |

```bash
supabase functions deploy create-student
supabase functions deploy reset-student-password
```

> A `service_role` ignora a RLS, mas **não** os GRANTs do Postgres: a migration
> `20260819120000_service_role_grants.sql` concede a ela `select/insert/update`
> em `profiles` — sem isso as funções falham com `42501`.
