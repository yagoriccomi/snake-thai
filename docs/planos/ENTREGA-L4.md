# ENTREGA — L4: Política de Privacidade, Termos de Uso e registro do aceite

| Campo | Valor |
|---|---|
| **Tarefa** | `L4` (lacuna do revisor) |
| **Plano** | [`PLANO-L4.md`](PLANO-L4.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/politica-de-privacidade` |
| **Status** | 🟡 Pronto e conferido no ambiente local; **textos são rascunhos e nada foi publicado** |

---

## 1. O que foi feito

- **Rascunhos dos textos.** A Política de Privacidade e os Termos de Uso estão em
  [`docs/legal/`](../legal/README.md). Eles descrevem o app como ele é hoje:
  - dados coletados;
  - quem vê o quê dentro da academia;
  - empresas que processam dados e onde ficam;
  - prazos de guarda;
  - exclusão e exportação;
  - notificações, relatórios de falha e rascunho da chamada.

  O que só a academia sabe está marcado com `[PREENCHER: …]`: razão social, CNPJ,
  contato, encarregado, prazos, base legal do dado de saúde, transferência
  internacional, menores de idade e foro.
- **Aceite registrado de verdade.** No primeiro acesso, a pessoa pode ler cada documento
  e o aceite vai para o banco com a versão. Antes era só uma caixa na tela, sem prova de
  nada.
- **Versão nova pede novo aceite.** Quando um texto novo é publicado, todos (aluno,
  professor e admin) veem "Termos atualizados" ao abrir o app. Só continuam aceitando
  ou saindo da conta.
- **Consulta a qualquer momento.** Perfil → "Termos e privacidade" mostra o texto
  vigente, quando foi publicado e quando a pessoa aceitou.
- **Proteções no banco:**
  - texto publicado não pode ser editado, nem pelo admin;
  - o aceite só vale para a versão vigente;
  - publicar recusa rascunho com `[PREENCHER`.
- **Publicação por script.** `npm run legal:publicar -- politica 1.0` gera a migration
  a partir do arquivo aprovado, sem copiar texto à mão.
- **Nada muda antes da publicação.** Enquanto nenhum texto estiver publicado (situação
  atual), o app se comporta exatamente como antes.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/20260916223510_documentos_legais_aceite.sql` | Gatilho de imutabilidade; `publicar_documento_legal`, `documentos_legais_pendentes`, `documentos_legais_vigentes`, `aceitar_documentos_legais`; escrita direta revogada |
| `supabase/tests/regressao_documentos_legais.sql` | 9 grupos de casos (D1–D9) |
| `docs/legal/` | `POLITICA-DE-PRIVACIDADE.md`, `TERMOS-DE-USO.md`, `README.md` (fluxo e consultas) |
| `scripts/publicar-documento-legal.js`, `package.json` | Gera a migration; recusa placeholder e versão inválida |
| `src/constants/legal.ts`, `src/utils/legalText.ts` | Nomes dos documentos; leitor do texto (4 marcações) e frases do aceite |
| `src/services/legalDocuments.service.ts`, `src/hooks/useLegalDocuments.ts` | Leitura validada e aceite |
| `src/context/LegalConsentProvider.tsx`, `App.tsx`, `RootNavigator` | Porta do novo aceite, sem travar sem rede |
| `src/components/LegalDocumentText/Modal/Links.tsx` | Texto, leitura em tela cheia e links |
| `src/screens/legal/AceiteDocumentosScreen.tsx`, `DocumentosLegaisScreen.tsx` | Tela de novo aceite; Perfil → Termos e privacidade |
| `OnboardingScreen`, `DadosScreen`, `DadosStackNavigator`, `types.ts` | Aceite registrado no primeiro acesso; linha nova no Perfil |
| `PushNotificationsProvider` | O toque na notificação espera o aceite |
| Docs | `PUBLICACAO-1.7.0`, `PLANO-DE-TAREFAS`, `RUNBOOK`, `FUNCIONALIDADES`, `MANUAL-DO-ADMINISTRADOR`, `README`s |

## 3. Verificações executadas

- [x] **Regressão SQL no banco limpo:**
  - o aluno não publica;
  - placeholder, texto vazio, versão repetida e escrita direta são recusados;
  - a pendência some depois do aceite e aceitar de novo não duplica;
  - uma versão nova volta a pedir aceite;
  - aceitar a versão antiga ou um documento inexistente é recusado, sem aceite
    parcial;
  - o texto publicado é imutável até para o dono do banco;
  - anon não tem acesso.

  Suíte SQL completa verde.
- [x] **API local, com as contas de demonstração:**
  - anon recebe 401;
  - o aluno que tenta publicar recebe 403;
  - o admin que tenta publicar o rascunho recebe 400 ("campos [PREENCHER] em aberto");
  - insert direto em `consents` recebe 403;
  - migration gerada pelo script a partir de uma cópia preenchida só para o ensaio:
    - o texto lido pelo app é **idêntico** ao arquivo;
    - aceite 200 e a pendência some;
    - repetir registra 0.
  - admin publica a 1.1:
    - o aluno volta a ter pendência;
    - aceitar a 1.0 dá 400 "Os documentos foram atualizados";
    - o PATCH direto no texto dá 403;
    - o export traz os 2 consentimentos.

  Banco local devolvido ao estado das sementes depois do ensaio.
- [x] **Jest (698 testes, typecheck verde):**
  - leitor do texto e frases;
  - rascunhos só com marcação suportada;
  - serviço;
  - provider: pendente, em dia, falha sem rede com nova checagem ao voltar;
  - tela de aceite: botão travado até marcar, leitura, recusa do banco com recarga,
    tentar de novo, sair, liberar sem pendência;
  - tela do Perfil: abas, datas, vazio, erro;
  - onboarding: aceite antes do perfil e da senha, falha não conclui, sem publicação e
    sem rede seguem como antes;
  - raiz: primeiro acesso e digital vêm antes do aceite;
  - toque na notificação espera o aceite.
- [ ] Teste no celular — celular não conectado.

## 4. Premissas assumidas

| # | Premissa | Como mudar |
|---|---|---|
| P1 | Nenhum texto é publicado sem aprovação; o banco recusa rascunho | — |
| P2 | Publicar é migration gerada por script, não tela do admin | Criar tela chamando `publicar_documento_legal` |
| P3 | Texto publicado é imutável | — (publique outra versão) |
| P4 | Aceite só pela função e só da versão vigente | — |
| P5 | Sem rede, a checagem deixa entrar e pergunta na volta | `LegalConsentProvider` (tratar `falhou` como `pendente`) |
| P6 | A checagem não segura a abertura (as abas podem piscar uma vez por versão) | Mostrar carregando enquanto `verificando` |
| P7 | Recusar = sair da conta e pedir exclusão à academia | Texto da tela de aceite |
| P8 | Marcação mínima, sem biblioteca de Markdown | `utils/legalText.ts` |
| P9 | Todos os papéis aceitam | `LegalConsentProvider` |

## 5. Decisão visual

- **Mockup:** não, porque as telas seguem padrões existentes. A
  `design-de-interface-projeto` definiu:
  - **Leitor:** texto inteiro rolável, com títulos marcados como cabeçalho para o
    TalkBack.
  - **Leitura:** em tela cheia, com fechar de 44 dp.
  - **Links:** no mesmo cartão das linhas do Perfil.
  - **Tela de aceite:** botão principal travado até marcar "Li e concordo" e "Sair da
    conta" como secundário.
  - **Carga e cores:** estados de carregando, erro com "Tentar de novo" e vazio. Cores
    só por tokens; nenhum erro técnico aparece na tela.

## 6. Pendências (suas)

1. ⚠️ **Preencher e aprovar os textos** com apoio jurídico. Os pontos que mais pedem
   atenção:
   - base legal do dado de saúde nas justificativas;
   - mecanismo de transferência internacional (Supabase e Render nos EUA; Sentry com
     conta nos EUA);
   - região da Cloudinary;
   - prazos de guarda (mensalidades, comprovantes, auditoria, backups);
   - encarregado.
2. **Menores de idade.** O app não tem cadastro de responsável. A política deixa o ponto
   em aberto; é preciso decidir o procedimento (art. 14 da LGPD) antes de cadastrar
   aluno menor.
3. ⚠️ **Publicar a migration `documentos_legais_aceite`** junto das demais (roteiro
   [`PUBLICACAO-1.7.0`](../PUBLICACAO-1.7.0.md)). Depois de aprovar os textos, faça as
   migrations de publicação com `npm run legal:publicar`.
4. **Push e Sentry** só depois dos textos publicados.
