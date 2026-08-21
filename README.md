# Snake Thai 🐍

App mobile para **gestão e controle de alunos de academia**: perfis, turmas/aulas,
presença (check-in), planos e pagamentos (comprovantes PIX). Construído com foco em
**segurança**, **acessibilidade** e **conformidade com a LGPD** para dados sensíveis
(CPF, telefone, data de nascimento).

## ✨ Features (roadmap inicial)

- Autenticação de alunos e administradores com sessão persistida de forma **cifrada**.
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
| `npm start` | Inicia o Metro/Expo. |
| `npm run android` / `ios` / `web` | Abre em uma plataforma específica. |
| `npm run typecheck` | Checagem de tipos estrita (`tsc --noEmit`). |
| `npm test` | Executa os testes (Jest + React Native Testing Library). |
| `npm run supabase:types` | Gera os tipos do banco local. |

## ⚡ Edge Functions

O cadastro de aluno pelo admin usa a Edge Function `create-student` (Deno), que
cria a conta com a senha padrão e inicializa o perfil usando a `service_role`
(nunca exposta no app). Deploy:

```bash
supabase functions deploy create-student
```
