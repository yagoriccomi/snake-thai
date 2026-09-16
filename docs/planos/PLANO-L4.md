# PLANO DE EXECUÇÃO — L4: Política de Privacidade, Termos de Uso e registro do aceite

| Campo | Valor |
|---|---|
| **Tarefa** | `L4` (lacuna do revisor, [`PLANO-DE-TAREFAS`](../PLANO-DE-TAREFAS.md)) |
| **Modo de execução** | 🔁 Loop (publicar texto legal e produção só com a sua aprovação) |
| **Data** | 2026-09-16 |
| **Branch** | `feat/politica-de-privacidade` |

## 1. Enunciado

**Problema.**
- **Não existe texto.** Não há Política de Privacidade nem Termos de Uso, em lugar
  nenhum.
- **O aceite não fica registrado.** O onboarding tem só uma caixa "Concordo" e nada
  vai para o banco. A tabela `consents` existe desde agosto, mas nunca foi usada.
- **Os blocos novos não aparecem em política nenhuma:**
  - exclusão e retenção (T7);
  - notificações (T9);
  - monitoramento de falhas (T10);
  - rascunho da chamada no aparelho (T11).

**Resultado esperado.**
1. **Rascunhos para aprovação.** A política e os termos ficam escritos com os fatos
   reais do app. Os campos que só a academia sabe ficam marcados com
   `[PREENCHER: …]`.
2. **Aceite registrado por versão.** No primeiro acesso, a pessoa lê os documentos e
   o aceite vai para o banco, com a versão.
3. **Novo aceite a cada versão.** Quando a academia publica uma versão nova, cada
   pessoa precisa aceitá-la antes de continuar no app.
4. **Consulta no Perfil.** Em Perfil → "Termos e privacidade", a pessoa lê os textos
   vigentes e vê quando aceitou.
5. **Nada muda antes da publicação.** Enquanto nenhum documento estiver publicado,
   o app se comporta como hoje.

**Como validar.**
- Regressão SQL.
- Jest: parser, serviço, provider, telas.
- API local: publicar um documento de teste, aceitar e ver a nova versão pedir novo
  aceite.

## 2. Escopo negativo

- **Nada publicado em produção.** Nem o texto (precisa da sua aprovação e da
  assessoria jurídica) nem a migration.
- **Sem consentimento do responsável** por aluno menor de idade. O app não tem
  cadastro de responsável; fica registrado como decisão pendente.
- **Sem tela de admin para publicar documentos.** Colar texto jurídico no celular é
  ruim; a publicação é por migration gerada a partir do arquivo aprovado.
- **Sem histórico de versões aceitas na tela.** O export de dados já traz os
  consentimentos.

## 3. Premissas assumidas (Loop)

- **P1. O texto nunca é publicado sem aprovação.** A função de publicar recusa texto
  com `[PREENCHER`, então o rascunho não vai ao ar nem por engano [#98].
- **P2. Publicar é uma migration** gerada por script a partir do arquivo aprovado.
  - Fica versionado e revisado, como todo o esquema [#87].
  - O admin não publica pelo app: insert e update diretos em `legal_documents` são
    revogados e tudo passa pela função.
- **P3. Documento publicado não muda.** Um gatilho recusa alterar conteúdo, tipo,
  versão ou data. Um aceite antigo precisa continuar apontando para o texto que a
  pessoa leu.
- **P4. O aceite só entra pela função e só para a versão vigente.**
  - Se a versão mudou enquanto a pessoa lia, a função recusa e o app recarrega.
  - O insert direto em `consents` é revogado.
- **P5. A checagem do novo aceite não trava o app (fail-open).**
  - Sem rede, o app abre normalmente: a falha vai para o log `warn` e a checagem
    repete ao voltar para o app.
  - Travar um aluno fora do app por uma oscilação de rede é pior do que pedir o
    aceite na abertura seguinte.
- **P6. A checagem não segura a abertura do app.** As abas abrem e a tela de aceite
  entra por cima quando existe versão pendente. Isso só acontece uma vez por versão.
- **P7. Recusar é sair da conta.** A tela de aceite oferece "Sair da conta" e explica
  como pedir a exclusão à academia.
- **P8. Texto com marcação mínima**, sem nova dependência [#7]:
  - `# ` título;
  - `## ` seção;
  - `- ` item;
  - linha em branco separa parágrafos.
- **P9. Todos os papéis aceitam:** aluno, professor e admin.

## 4. Decisão visual

- **Mockup:** não. As telas seguem padrões existentes:
  - grupo CONTA com `NavRow`;
  - `SegmentedControl`;
  - `Checkbox` do onboarding;
  - cabeçalho da stack.
- **A `design-de-interface-projeto` definiu:**
  - **Leitor do texto:** `ScrollView` e não `FlatList`, porque um documento de ~100
    blocos lido em sequência pelo TalkBack funciona melhor inteiro [#99]. Títulos
    com `accessibilityRole="header"`.
  - **`LegalDocumentModal`:** tela cheia, botão fechar de 44 dp e voltar do Android.
  - **Onboarding:** linhas "Ler a Política de Privacidade" e "Ler os Termos de Uso"
    acima da caixa. Se a carga falhar, aparece um aviso em `warning` com "Tentar de
    novo", sem bloquear o cadastro.
  - **Tela de aceite:** título, explicação curta e um cartão por documento (versão,
    data e botão Ler).
    - A caixa "Li e concordo" libera o botão principal.
    - Erro aparece inline.
    - "Sair da conta" é o botão secundário.
  - **Termos e privacidade (Perfil):**
    - abas quando há dois documentos;
    - rodapé com versão, publicação e data do aceite;
    - estados carregando, erro com "Tentar de novo" e vazio.
  - **Cores e logs:** todas as cores vêm dos tokens; nada de stack na tela; erros de
    carga vão para o log `warn` e de aceite para `error` [#92][#93].

## 5. Passos

1. **Migration `documentos_legais_aceite`:**
   - gatilho `proteger_documento_legal` (23514);
   - `publicar_documento_legal(p_tipo, p_versao, p_conteudo)` para admin ou
     servidor: recusa `[PREENCHER`, versão vazia e texto vazio; troca a vigente de
     forma atômica [#89];
   - `documentos_legais_pendentes()`: leve, sem o texto;
   - `documentos_legais_vigentes()`: com o texto e a data do meu aceite;
   - `aceitar_documentos_legais(p_documentos uuid[])`: só versão vigente e idempotente;
   - revoga insert e update diretos em `legal_documents` e o insert direto em
     `consents`, com as políticas correspondentes.
2. **Regressão `supabase/tests/regressao_documentos_legais.sql`:**
   - aluno não publica;
   - placeholder recusado;
   - pendente aparece e some depois do aceite;
   - aceite idempotente;
   - versão nova volta a pedir aceite e o aceite da antiga é recusado;
   - conteúdo imutável;
   - insert direto negado;
   - versão duplicada recusada;
   - lista vazia recusada;
   - anon sem acesso.
3. **Rascunhos em `docs/legal/`:** `POLITICA-DE-PRIVACIDADE.md`, `TERMOS-DE-USO.md` e
   um `README.md` com o fluxo de aprovação e publicação.
4. **Script `scripts/publicar-documento-legal.js`:** gera a migration a partir do
   arquivo e recusa placeholder. Teste Jest da função pura.
5. **Tipos regenerados; no app:**
   - `constants/legal.ts`;
   - `utils/legalText.ts` (parser);
   - `services/legalDocuments.service.ts`;
   - `hooks/useLegalDocuments.ts`;
   - `context/LegalConsentProvider.tsx`;
   - componentes `LegalDocumentText`, `LegalDocumentModal`, `LegalDocumentLinks`;
   - telas `AceiteDocumentosScreen` e `DocumentosLegaisScreen`;
   - `OnboardingScreen` registra o aceite;
   - `RootNavigator` ganha a porta do aceite;
   - `DadosScreen` ganha a linha nova.
6. **Testes Jest:** parser, serviço, provider, links, tela de aceite, tela do Perfil,
   onboarding com e sem documento publicado.
7. **Docs:**
   - `PLANO-DE-TAREFAS` (L4);
   - `PUBLICACAO-1.7.0` (passo de publicar o texto);
   - `RUNBOOK` (consulta de aceites);
   - `FUNCIONALIDADES`;
   - `ENTREGA-L4.md`.

## 6. Riscos e rollback

- **APK 1.6.0 em produção.** Nunca gravou consentimento e não edita
  `legal_documents`, então as revogações não quebram nada.
- **Aceite do onboarding que falha.** O cadastro não conclui e o erro aparece na
  tela; tentar de novo é seguro, porque o aceite é idempotente.
- **Publicação errada.** Publicar a versão anterior de novo como uma versão nova
  (por exemplo, 1.0.1). O documento publicado não é apagado.
- **Rollback da migration.** As funções são novas e o app continua funcionando sem
  elas: a checagem falha, é registrada e o app segue aberto.
