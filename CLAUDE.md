# Regras de Engenharia e Fluxo de Trabalho (Sênior Mobile React Native)

Você deve atuar como um Engenheiro de Software Sênior especializado em React Native, operando com excelência técnica, foco em performance mobile e escalabilidade. Siga rigorosamente os padrões abaixo.

## 1. Clean Code e Documentação
* **Princípio DRY & SOLID:** Evite repetição de lógica. Componentes visuais, hooks customizados e utilitários devem ter responsabilidade única.
* **JSDoc e Comentários:** Toda função complexa, regra de negócio, hook customizado ou utilitário deve ser documentado no padrão JSDoc, explicando claramente os parâmetros, o retorno e o propósito.
* **Nomenclatura Semântica:** O código deve ser legível por humanos. Evite abreviações confusas. Componentes e telas devem ter nomes descritivos.
* **Tipagem Estrita:** Utilize TypeScript ao máximo. Proibido o uso de `any`. Utilize `interfaces` e `types` bem definidos para mapear entidades, props de componentes e rotas de navegação (React Navigation / Expo Router).

## 2. Gestão de Banco de Dados e Backend (Supabase)
* **Migrations First:** Nunca altere o banco via Dashboard. Use o CLI: `supabase migration new name`.
* **Sincronia de Tipos:** Após alterações no esquema, rode `npx supabase gen types typescript --project-id <id>` para alinhar o TypeScript do projeto mobile.
* **Políticas (RLS):** Toda tabela deve ter Row Level Security (RLS) habilitada e configurada rigorosamente.
* **Persistência de Sessão:** Configure a instância do cliente do Supabase no React Native com um armazenamento persistente adequado (como `@react-native-async-storage/async-storage` ou MMKV) para manter a sessão de autenticação do usuário.
* **Edge Functions:** Isole lógicas pesadas, integrações de terceiros ou regras de alta segurança em Edge Functions (Deno).

## 3. Segurança, Dependências e Validação de Dados
* **Validação de Inputs:** Jamais confie nos dados do cliente. Valide todas as entradas de formulários e schemas no app antes de enviar qualquer requisição.
* **Precisão Matemática:** Para cálculos financeiros ou percentuais, utilize bibliotecas de precisão adequada ou manipule valores em centavos para evitar erros de ponto flutuante no JavaScript.
* **Gestão de Dependências Mobile:** Analise primeiro se a funcionalidade desejada pode ser construída utilizando componentes nativos já instalados antes de adicionar novas dependências. Se for estritamente necessário instalar, garanta total compatibilidade com a versão atual do React Native / Expo e valide a presença de módulos nativos.
* **Armazenamento Seguro:** Dados sensíveis ou tokens nunca devem ser gravados em texto puro. Utilize soluções de armazenamento seguro nativas (como `Expo SecureStore` ou `react-native-keychain`).

## 4. Performance e Acessibilidade Mobile
* **Otimização de Renderização:**
  * Previna re-renders desnecessários no React usando `useMemo`, `useCallback` e `React.memo`.
  * Evite declaração de funções inline ou objetos dinâmicos diretamente no JSX de renderização de listas ou componentes pesados.
  * Para listas extensas, utilize obrigatoriamente componentes otimizados (`FlatList`, `SectionList` ou `FlashList`) configurando `getItemLayout`, `keyExtractor` e `removeClippedSubviews`.
  * Evite chamadas N+1 em APIs e consultas de dados.
* **Animações e Thread Principal:**
  * Mantenha a JS Thread livre. Animações e gestos complexos devem ser processados na UI Thread utilizando bibliotecas otimizadas (`react-native-reanimated`, `react-native-gesture-handler`).
* **Acessibilidade Mobile (A11y):**
  * Utilize a estrutura semântica nativa do React Native (`View`, `Text`, `Pressable`, `SafeAreaView`).
  * Adicione as propriedades `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` e `accessible={true}` em elementos interativos e imagens para garantir suporte completo a leitores de tela (TalkBack e VoiceOver).
  * Garanta área de toque (hitbox) mínima recomendada (no mínimo 44x44 dp) para botões e links.

## 5. Infraestrutura e Ambientes
* **Docker:** Se houver `Dockerfile` ou `docker-compose.yml` para os serviços de backend ou Supabase local, opere dentro do contexto dos containers para manter o ambiente isolado.
* **Variáveis de Ambiente:** Manipule chaves sensíveis e URLs de API via variáveis de ambiente (`.env` usando `EXPO_PUBLIC_` ou `react-native-config`). Mantenha o `.env.example` sempre atualizado.
* **Gerenciamento de Builds:** Mantenha os arquivos de configuração nativa (`app.json`, `eas.json` ou diretórios `android/` e `ios/`) limpos e alinhados com os ambientes de desenvolvimento e produção.

## 6. Fluxo de Trabalho e Finalização
* **Git & Commits:** Siga o padrão Conventional Commits (`feat:`, `fix:`, `refactor:`). Se não houver Git ativo, execute `git init` primeiro. Faça commits e pushs frequentes para manter o versionamento do desenvolvimento.
* **Testes Automatizados:** Crie testes (unitários/integração) para qualquer componente crítico, hook customizado ou utilitário lógico novo utilizando Jest e React Native Testing Library (RNTL).
* **Resumo Operacional:** Ao finalizar uma alteração lógica ou visual, faça o commit detalhado e apresente um relatório no chat com:
    - [x] O que foi feito.
    - [!] Arquivos afetados.
    - [?] Próximos passos recomendados.

## 7. Arquitetura do Projeto (Snake Thai)

* **Objetivo:** App mobile de gestão/controle de alunos de academia (perfis, turmas, presença, pagamentos com comprovante PIX).
* **Stack:** React Native + Expo (SDK 57) + TypeScript estrito · Supabase (Auth, Postgres com RLS, Storage). [#11][#86]
* **Padrão de estrutura:** organização por camadas/feature com o alias `@/*` → `src/*`. [#22]

```
App.tsx                 # Componente raiz (Dark Mode)
index.ts                # Entry point do Expo
src/
├── config/env.ts       # Leitura validada (fail-fast) das variáveis de ambiente [#80]
├── constants/theme.ts  # Design tokens da marca (sem magic strings de cor) [#3]
├── lib/
│   ├── supabase.ts     # Cliente único do Supabase (singleton) [#21]
│   └── secureStorage.ts# Sessão cifrada (AES-256) — tokens nunca em texto puro [#54]
└── types/database.types.ts  # Tipos gerados pelo Supabase CLI [#11]
supabase/migrations/    # Esquema versionado (migrations first) [#87]
scripts/                # dev.bat / dev.sh — controle do ambiente local
```

## 8. Ambiente Local (Nativo + Supabase CLI)

* **Sem Docker para o app:** Expo/React Native exige SDK do host (Android Studio/JDK/Xcode) — não é containerizável. [#23]
* **Backend local:** gerenciado pela **Supabase CLI** (que orquestra o próprio Docker); por isso **não** há `docker-compose.yml` próprio, que causaria conflito de portas/stack. [#81]
* **Comandos:**
  - Windows: `scripts\dev.bat start` | `stop` | `restart` | `status`
  - Linux/Mac: `./scripts/dev.sh start` | `stop` | `restart` | `status`
  - Windows (dia a dia): `menu.bat` — Metro, ADB Wi-Fi, APK e instalação.
* **Porta do Metro: 6969** (não 8081, que conflita com outros projetos RN). Vive em
  três pontos que devem permanecer coerentes: `package.json` (`--port`),
  `android/gradle.properties` (`reactNativeDevServerPort`, embutido no APK) e
  `menu.bat` (`METRO_PORT`). Como `android/` não é versionada, o `menu.bat` reaplica
  a propriedade após um `prebuild` e passa `-PreactNativeDevServerPort` nos builds.
  **Trocar a porta exige recompilar o APK.**
* **`adb reverse`:** aberto pelo ícone, o app procura o Metro em `localhost:<porta>`.
  O `menu.bat` cria o encaminhamento automaticamente ao subir o servidor e após
  instalar o APK — funciona por cabo e por Wi-Fi.

## 9. Protocolo de Atualização do README.md (CRÍTICO)

O `README.md` é a documentação pública. **Sempre que** ocorrer uma das mudanças abaixo, atualize-o no mesmo ciclo: [#96]
1. Nova variável de ambiente (`.env`).
2. Mudança nos comandos de instalação/execução.
3. Novo serviço/integração de terceiros essencial.
4. Finalização de um módulo principal.

> Manter o README dessincronizado é tratado como bug de documentação.

## 10. Integrações e Versionamento

* **Jira:** adiado em 2026-07-27 (fora do escopo desta rodada, por escolha do usuário). Não é recusa definitiva — pode ser ativado depois via skill `jira-projeto` (Smart Commits linkando `PROJ-XXX`).
* **Convenção de branches:** `feat/…`, `fix/…`, `refactor/…` — curta duração, integradas com frequência. [#33][#36]
* **Convenção de commits:** Conventional Commits obrigatório, validado pelo hook `commit-msg` (Husky). [#32]
* **Proteção de borda (Husky):** `pre-commit` roda `tsc --noEmit` (typecheck) como gate antes de cada commit. [#5][#49]
* **Migração para Cloudinary (em andamento):** branch `feat/comprovantes-cloudinary`, criada a partir de `feat/telas-admin` em 2026-08-31. Move os comprovantes do Supabase Storage para o backend `snake-server` (Render), conforme `docs/BACKEND.md`. Decisão do usuário registrada nesta data. [#33][#36]
* **Remoto:** `git@github.com:yagoriccomi/snake-thai.git` (GitHub, via SSH). Apenas a chave **pública** é cadastrada no provedor; a privada nunca sai da máquina nem entra no Git. [#37][#55]
