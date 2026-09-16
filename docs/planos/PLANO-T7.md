# PLANO DE EXECUÇÃO — T7: Editar dados do aluno pelo admin e exclusão de conta pela LGPD (titular e admin)

> Parte do checklist [`docs/PLANO-DE-TAREFAS.md`](../PLANO-DE-TAREFAS.md). Plano produzido por um planejador
> somente-leitura e revisado por um crítico que cruzou as 11 tarefas (seção "Ajustes do revisor").
> Onde o ajuste do revisor contradiz um passo, **vale o ajuste**.

| Campo | Valor |
|---|---|
| **Tarefa** | `T7` |
| **Origem** | Pedido do usuário em 2026-09-16 |
| **Modo de execução** | 🔁 Loop (ações destrutivas, irreversíveis ou em produção continuam pedindo confirmação) |
| **Data do plano** | 2026-09-16 |
| **Branch** | `feat/editar-aluno-lgpd` |
| **Esforço** | G |
| **Depende de** | T1 |

## 1. Enunciado

Criar a tela EditarAluno (nome, CPF, celular, nascimento, turma, plano, situação e, se aprovado, e-mail) e ligar a exclusão de conta à interface, tanto pelo próprio titular quanto pelo admin. A regra de anonimização sai da Edge Function e vai para uma única função SQL transacional e idempotente, que também corrige três falhas encontradas: as imagens dos comprovantes não são apagadas na exclusão, os anexos e textos das justificativas ficam para trás, e cada comprovante entra duas vezes na fila de eliminação. O prazo de guarda dos comprovantes (P-11) vira uma varredura por pg_cron assim que o usuário escolher o número de dias.

## 2. Terreno (situação verificada)

- Não existe tela para o admin editar os dados pessoais do aluno. A gestão só troca turma e plano, promove ou rebaixa, tranca e redefine a senha, e não há rota de edição.  
  _Evidência:_ src/screens/dados/GerenciarAlunosScreen.tsx:105-242 e 324-333; src/navigation/types.ts:22-31 (DadosStackParamList sem EditarAluno)
- O service não tem função para o admin alterar CPF. updateProfile só grava name, phone e dob.  
  _Evidência:_ src/services/profile.service.ts:74-98
- A edição pelo admin não precisa de migration de permissão: o trigger vigente libera o admin por inteiro. O titular só altera name, phone, dob, is_first_login e color, e o CPF só pode passar de nulo para um valor.  
  _Evidência:_ supabase/migrations/20260903120100_professores.sql:51-84 (linha 63: is_admin retorna new; linhas 71-72: whitelist)
- O CPF é UNIQUE no banco, mas a CHECK só confere o formato de 11 dígitos. Os dígitos verificadores só são validados no app, e create-staff também só confere os 11 dígitos. O erro 23505 com 'cpf' já é traduzido para 'Este CPF já está cadastrado em outra conta.'  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:50,56; src/utils/validation.ts:34-56; supabase/functions/create-staff/index.ts:44,127; src/utils/errors.ts:100-102
- O e-mail não existe em profiles, só em auth.users. Hoje o admin nem consegue ver o e-mail do aluno no app, e para alterá-lo é preciso a Auth Admin API (service_role).  
  _Evidência:_ src/types/database.types.ts:647-663 (Row de profiles sem email); DadosScreen.tsx:94 lê session.user.email (só o próprio)
- O onboarding pula a etapa de dados quando name e cpf já estão preenchidos. Se o admin preencher os dois num aluno pendente, o aluno nunca informa telefone e nascimento.  
  _Evidência:_ src/screens/onboarding/OnboardingScreen.tsx:79-85
- Bug existente: o filtro 'Admins' da gestão fica sempre vazio, porque fetchAllStudents busca só role='user' e o chip compara com role==='admin'.  
  _Evidência:_ src/services/profile.service.ts:119-124; src/screens/dados/GerenciarAlunosScreen.tsx:97-98
- A Edge Function delete-my-account existe. Ela anonimiza o perfil, troca e-mail e senha, bane a conta e apaga consents. Recusa admin, mas deixa o professor se autoexcluir.  
  _Evidência:_ supabase/functions/delete-my-account/index.ts:106-111, 115-151
- Não há interface de exclusão de conta no app, e o manual do admin afirma o contrário.  
  _Evidência:_ grep 'delete-my-account|excluir conta' em src/ sem resultado; docs/FUNCIONALIDADES.md:87 ('Excluir conta · FALTA'); docs/MANUAL-DO-ADMINISTRADOR.md:203-207 diz que o aluno exclui pelo app
- Os documentos dizem que a função foi publicada na rodada de 2026-08-19. Não verifiquei se a versão em produção é igual à do repositório, porque não acessei o projeto de produção.  
  _Evidência:_ REVIEW.md:304-306 ('Edge Function publicada'); docs/RUNBOOK.md:81
- Falha de LGPD: a Edge Function não chama eliminar_comprovantes_do_titular, embora a migration e a documentação do snake-server digam que chama. As imagens dos comprovantes continuam na Cloudinary e no Storage depois da exclusão.  
  _Evidência:_ delete-my-account/index.ts inteiro sem rpc; supabase/migrations/20260831120000_proofs_cloudinary_contract.sql:200,238; snake-server docs/BACKEND.md:225-227 e docs/PENDENCIAS.md:220
- As justificativas de falta não são tratadas na exclusão: o campo message (texto livre, pode trazer dado de saúde) e o anexo continuam lá. O gatilho da fila só dispara em UPDATE ou DELETE da própria justificativa, e uma constraint impede zerar message e anexo ao mesmo tempo.  
  _Evidência:_ supabase/migrations/20260914120100_frequencia_fundacao.sql:129-133 (constraints), 302-332 (gatilho)
- Enfileiramento duplicado: eliminar_comprovantes_do_titular insere na fila e depois limpa proof_* com UPDATE. Esse UPDATE dispara trg_payments_enfileirar_exclusao_comprovante, que insere o mesmo arquivo de novo com motivo 'comprovante_recusado'. O worker aguenta item repetido, mas a fila duplica e fica com o motivo errado.  
  _Evidência:_ supabase/migrations/20260831120000_proofs_cloudinary_contract.sql:153-172 e 211-231; snake-server docs/PENDENCIAS.md:231-232 (idempotente)
- A exclusão não é atômica: o UPDATE do perfil e a troca de e-mail no Auth são chamadas separadas. Se o passo do Auth falhar, o perfil fica anonimizado e o login continua funcionando. O erro do delete em consents é ignorado.  
  _Evidência:_ supabase/functions/delete-my-account/index.ts:115-147 e 151
- export_my_data cobre perfil, attendance (to_jsonb da linha inteira, então inclui declared_status, a presença declarada), payments e consents. Não cobre attendance_monthly nem absence_justifications, e nada no app chama a função.  
  _Evidência:_ supabase/migrations/20260819150000_academy_settings_and_lgpd.sql:105-132; grep export_my_data em src/ só acha src/types/database.types.ts:768
- A RLS deixa o admin fazer DELETE em profiles, e o cascade apagaria pagamentos, presenças e justificativas. O app não usa esse caminho (o único .delete() em src/ é em class_teachers).  
  _Evidência:_ supabase/migrations/20260727130000_init_schema.sql:113,132,271-273; frequencia_fundacao.sql:116,344; src/services/classes.service.ts:297
- Relatórios de banco já ignoram anonimizados (mensalidades, diretório, fechamento de frequência), mas fetchAllStudents não. Um removido apareceria como 'Trancado' na gestão; no financeiro o nome precisa continuar aparecendo.  
  _Evidência:_ 20260904200000_geracao_mensalidades.sql:220; 20260904210000_diretorio_de_perfis.sql:38; 20260914140000_frequencia_regras.sql:284; src/hooks/useAdminPayments.ts:83; HistoricoPagamentosAlunosScreen.tsx:51
- A trilha de auditoria não guarda o conteúdo de PII (cpf, phone, dob e name viram {"alterado": true}). Numa exclusão pela service_role, porém, actor_id fica nulo e não registra quem pediu.  
  _Evidência:_ supabase/migrations/20260819170000_harden_profile_updates.sql:84-116
- P-11 está em aberto: não há prazo de guarda dos comprovantes. O motivo 'retencao_expirada' existe e ninguém usa, e o worker não varre por prazo. O worker é um Cron Job da Render no plano starter (pago); não verifiquei se ele está criado no painel.  
  _Evidência:_ snake-server docs/PENDENCIAS.md:214-247; src/jobs/media-cleanup/media-cleanup.service.ts:8-16; render.yaml:76-91
- A Supabase CLI está linkada ao projeto de produção, então functions deploy e db push sem cuidado vão direto para produção.  
  _Evidência:_ supabase/.temp/project-ref e linked-project.json (datados 2026-08-10)
- Os testes SQL rodam no psql com BEGIN/ROLLBACK, e o cabeçalho diz que 'pode rodar contra produção'. O psql não está instalado no host.  
  _Evidência:_ supabase/tests/regressao_frequencia_fundacao.sql:1-5; 'which psql' vazio
- Fora do escopo, mas afeta a mesma tela: as Edge Functions usam a senha padrão fixa 'a senha padrão', enquanto a gestão mostra ao admin a senha configurável de academy_settings.  
  _Evidência:_ supabase/functions/reset-student-password/index.ts:20; create-student/index.ts:19; create-staff/index.ts:27; GerenciarAlunosScreen.tsx:70

## 3. Premissas assumidas (decisões com a recomendação adotada no modo Loop)

> Cada linha é uma decisão que é do usuário. No modo Loop segue-se a recomendação;
> para mudar, basta responder com a opção desejada.

**P1. O e-mail do aluno entra na tela de edição do admin?**

- Não entra: o e-mail continua sendo visto e alterado só no painel da Supabase
- Entra: uma função SQL só para admin lê o e-mail e uma Edge Function admin-update-user-email (Auth Admin API) faz a troca

➡️ _Adotado:_ Entra. Hoje um e-mail digitado errado no cadastro deixa a conta inacessível sem conserto pelo app. A única saída seria excluir e recriar, o que deixa um 'Usuário removido' e uma fatura de entrada órfã. O custo é baixo: 1 função SQL e 1 Edge Function pequena.

**P2. Quem pode excluir a conta de quem?**

- A: aluno e professor se autoexcluem; o admin exclui aluno e professor; conta admin precisa ser rebaixada antes
- B: só o aluno se autoexclui; professor só pelo admin
- C: só o admin exclui (sem autoexclusão no app)

➡️ _Adotado:_ A. O pedido de eliminação (LGPD art. 18, VI) deve ser simples para qualquer titular. A trava do último admin e a exigência de rebaixar antes evitam perder o controle do sistema.

**P3. O que fazer com as mensalidades em aberto ou vencidas de quem pede exclusão?**

- A: manter como estão (igual a trancar matrícula); a tela avisa que excluir não quita débito e os relatórios separam 'Usuário removido'
- B: apagar as cobranças ainda não vencidas e manter as vencidas
- C: bloquear a autoexclusão enquanto houver débito vencido e encaminhar ao admin

➡️ _Adotado:_ A. É a opção menos destrutiva e segue o comportamento de 'trancar'. B apaga registro financeiro. C condiciona o direito do titular a pagar a dívida, o que é juridicamente frágil. O admin continua podendo ajustar pela baixa manual. Quem fizer o dashboard e o relatório de inadimplência precisa tratar esses casos à parte.

**P4. O que fazer com as justificativas de falta do titular na exclusão?**

- A: apagar (o gatilho existente já manda o anexo para a fila de eliminação)
- B: manter a linha, trocando o texto por '[removido a pedido do titular]' e removendo o anexo

➡️ _Adotado:_ A. O texto é livre e pode conter dado de saúde (dado sensível, art. 11). A frequência dos meses fechados fica congelada em attendance_monthly, e o fechamento já ignora anonimizados.

**P5. A autoexclusão deve exigir a senha atual?**

- Sim, conferida no servidor (a Edge Function reautentica)
- Não, basta digitar EXCLUIR

➡️ _Adotado:_ Sim. A ação é irreversível, e um celular desbloqueado na mão de outra pessoa não pode apagar a conta. É o mesmo padrão da troca de senha (src/services/auth.service.ts:54-68).

**P6. O botão 'Exportar meus dados' (portabilidade, art. 18, V) entra junto?**

- Sim: estender export_my_data e oferecer em Dados, compartilhando o JSON
- Não: só estender a função SQL agora e fazer a interface depois

➡️ _Adotado:_ Sim. É pouco trabalho, e o natural é oferecer 'baixe seus dados antes de excluir'.

**P7. Com aluno ainda pendente de primeiro acesso, o admin pode preencher nome e CPF?**

- A: não; nome e CPF ficam travados até o aluno concluir o primeiro acesso, e o resto continua editável
- B: sim, e o onboarding pula a etapa de dados (o aluno fica sem telefone e nascimento)
- C: sim, e o onboarding muda para pular a etapa só de professor/admin, com o CPF do aluno pré-preenchido e travado

➡️ _Adotado:_ A. É o mais simples e não mexe no onboarding, que já teve um loop de regressão.

**P8. P-11: por quanto tempo guardar a IMAGEM do comprovante de uma mensalidade paga? O registro do pagamento é mantido de qualquer forma.**

- A: 30 dias após a aprovação. Base: art. 6º, III (necessidade) e art. 15, I (a finalidade se cumpre na aprovação). Como prova ficam o registro do pagamento e o extrato da academia
- B: 90 dias após a aprovação (paid_at). Cobre o prazo de contestação de Pix pelo pagador no MED do Banco Central (até 80 dias) e os prazos de reclamação do CDC art. 26 (30/90 dias). Depois disso a imagem perde a finalidade (art. 15, I) e só o registro é retido (art. 16, I)
- C: 5 anos contados do 1º dia do exercício seguinte. Base: CTN arts. 173, 174 e 195, parágrafo único, e CC arts. 1.194 e 206, §5º, I. Dá a maior segurança de prova, mas expõe mais PII, custa mais armazenamento, e a imagem enviada pelo aluno dificilmente é documento fiscal da academia
- D: guardar sem prazo (como é hoje). Contraria os arts. 15 e 16; não recomendado

➡️ _Adotado:_ B: 90 dias após paid_at, com o registro do pagamento (valor, competência, status, paid_at) mantido por pelo menos 5 anos mais o exercício seguinte. Comprovante recusado continua sendo eliminado na hora. O prazo escolhido precisa constar na Política de Privacidade (art. 9º, II). Isto é um resumo técnico, não um parecer jurídico; vale confirmar com o contador ou advogado da academia.

## 4. Ações que só o usuário pode fazer

- [ ] Responder as 8 decisões acima. Só o passo de retenção (P-11) fica travado sem resposta; o resto pode começar.
- [ ] Conferir no painel da Render se o Cron Job 'snakethai-media-cleanup' existe e está ativo, aceitando o custo do plano starter. Sem ele a media_deletion_queue não é consumida e nenhum arquivo é de fato apagado na Cloudinary ou no Storage.
- [ ] Autorizar explicitamente, na hora certa, cada efeito externo: push, PR e merge no snake-thai; PR de documentação no snake-server; aplicar as migrations em produção; publicar as Edge Functions delete-my-account, delete-user-account e admin-update-user-email; publicar o APK.
- [ ] Aprovar o texto atualizado da Política de Privacidade (legal_documents), com o prazo de retenção e o fluxo de exclusão. É uma declaração da academia como controladora.
- [ ] Opcional: validar o prazo do P-11 com o contador ou advogado da academia.
- [ ] Fazer o teste final no celular com contas de teste no APK DEV (autoexclusão e exclusão pelo admin), nunca com alunos reais.

## 5. Passos atômicos

### Passo 1

Preparação. Com o ambiente de desenvolvimento local de T1 pronto, criar a branch feat/editar-aluno-lgpd a partir de feat/papel-professor (ou da main, se o merge já tiver sido feito). Subir só o stack local: `npx supabase start` e depois `npx supabase db reset` (aplica as 26 migrations e o seed no Docker local). Nesta fase nunca usar `db push`, `--linked` nem `functions deploy`, porque a CLI está linkada à produção.

**Como verificar:** `npx supabase status` mostra API em 127.0.0.1:54321 e DB em 54322. Os 6 testes existentes passam no local com `docker exec -i supabase_db_snake-thai psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/<arquivo>.sql`. O nome do contêiner é suposto a partir do project_id; confirmar com `docker ps`.

### Passo 2

Migration do núcleo da LGPD. (a) Em enfileirar_exclusao_de_comprovante(), sair antes do INSERT quando já houver item pendente (processado_em nulo) para o mesmo provider e asset_ref; isso acaba com a duplicata 'comprovante_recusado'. (b) Criar anonimizar_titular(p_user_id uuid, p_solicitante uuid) returns jsonb, SECURITY DEFINER, search_path ''. Ela faz SELECT ... FOR UPDATE no perfil; se o perfil não existe, erro P0002; se já está anonimizado, retorna {ja_anonimizado:true} (idempotente); se é admin, erro 42501 'rebaixe antes'. Depois: PERFORM eliminar_comprovantes_do_titular; DELETE em absence_justifications do usuário (decisão 4); DELETE em consents; se for professor, DELETE em class_teachers só das aulas com date_time > now(), sem mexer em color por causa da constraint; UPDATE em profiles (name 'Usuário removido', cpf, phone, dob, group_id e plan_id nulos, status inactive, deactivated_at = coalesce(deactivated_at, now()), anonymized_at = now()); INSERT em audit_log com actor_id = p_solicitante e changes {lgpd_exclusao:{origem}}. Retorna as contagens. Fazer REVOKE de public, anon e authenticated e GRANT EXECUTE para service_role. (c) Recriar export_my_data() como SECURITY INVOKER, acrescentando 'frequencia_mensal' (attendance_monthly) e 'justificativas' (absence_justifications). (d) Se a decisão 1 for 'entra', criar email_do_usuario(p_user_id uuid) returns text, SECURITY DEFINER, que recusa com 42501 quando not is_admin(); REVOKE de public e anon, GRANT para authenticated. (e) DROP POLICY profiles_delete_admin e REVOKE DELETE ON profiles FROM authenticated, para ninguém apagar perfil e levar o financeiro no cascade.

_Arquivos:_ `supabase/migrations/20260917120000_lgpd_exclusao_de_conta.sql`

**Como verificar:** `npx supabase db reset` roda sem erro. `npm run supabase:types` regenera src/types/database.types.ts com anonimizar_titular e email_do_usuario. `npm run typecheck` fica verde.

### Passo 3

Teste de regressão SQL no padrão BEGIN/ROLLBACK. Massa: aluno com 2 pagamentos com comprovante (1 Cloudinary, 1 Storage), 1 justificativa com anexo e texto, consentimento, presença e attendance_monthly; professor com uma aula passada e uma futura; admin. Casos: T1 perfil anonimizado corretamente; T2 pagamentos preservados (quantidade, amount_cents, status, paid_at) com proof_* nulos; T3 exatamente 1 item por arquivo na fila, com motivo conta_excluida e nenhum comprovante_recusado; T4 justificativa apagada e anexo na fila; T5 consents removidos, attendance e attendance_monthly preservados; T6 segunda chamada devolve ja_anonimizado sem criar itens novos; T7 alvo admin dá 42501; T8 authenticated não executa anonimizar_titular; T9 professor sai só das aulas futuras e mantém a cor; T10 export_my_data do aluno traz frequencia_mensal e justificativas e não mostra dados de outro aluno; T11 admin altera name, cpf, phone, dob, group_id, plan_id e status de um aluno, CPF repetido dá unique_violation e o aluno que tenta trocar o próprio CPF já definido recebe 42501; T12 email_do_usuario funciona para admin e dá 42501 para aluno; T13 recusa de comprovante continua gerando 1 item na fila; T14 DELETE em profiles pelo admin é negado.

_Arquivos:_ `supabase/tests/regressao_lgpd_exclusao.sql`

**Como verificar:** Rodar via docker exec no banco local: todas as linhas saem como 'OK T..'. Rodar de novo regressao_c3_payment_whitelist.sql e regressao_frequencia_fundacao.sql (o T14 dela valida o gatilho de anexo). Não rodar nada disso em produção.

### Passo 4

Código compartilhado das Edge Functions e refatoração de delete-my-account. Em _shared, anonimizarConta(adminClient, {userId, solicitanteId}) chama (1) rpc('anonimizar_titular') e (2) auth.admin.updateUserById com e-mail 'removido-<uuid>@anonimizado.invalid', senha aleatória e ban_duration '876000h'. Em delete-my-account, o corpo passa a ser {confirmacao:'EXCLUIR MINHA CONTA', senha}. A função reautentica com cliente anon via signInWithPassword(email do chamador, senha) e devolve 401 'Senha incorreta' se falhar (decisão 5); mantém o 403 para admin; chama anonimizarConta; depois auth.admin.signOut(jwt,'global') para revogar os refresh tokens. Qualquer falha devolve 500 'tente novamente' (repetir é seguro por causa da idempotência). O delete de consents com erro ignorado deixa de existir, porque agora está dentro da transação SQL.

_Arquivos:_ `supabase/functions/_shared/anonimizar-conta.ts`, `supabase/functions/delete-my-account/index.ts`

**Como verificar:** Com `npx supabase functions serve` local e curl em http://127.0.0.1:54321/functions/v1/delete-my-account: sem token dá 401; confirmação errada, 400; senha errada, 401; admin, 403; aluno do seed com comprovante, 200. No banco local, depois do 200: perfil anonimizado, 1 item por arquivo na fila e pagamentos intactos. O login do aluno passa a ser recusado. Conferir também se `select identity_data from auth.identities where user_id=...` ainda guarda o e-mail original e registrar o resultado.

### Passo 5

Nova Edge Function delete-user-account, para o admin. Segue a estrutura de reset-student-password/index.ts:60-112: exige admin; corpo {userId, confirmacao:'EXCLUIR CONTA'}; valida UUID; recusa o próprio id com 400; alvo inexistente dá 404; alvo admin dá 403 'Rebaixe o administrador antes de excluir' (decisão 2). Chama anonimizarConta com solicitanteId = admin e devolve {success, comprovantes, justificativas}.

_Arquivos:_ `supabase/functions/delete-user-account/index.ts`

**Como verificar:** Curl local: aluno chamando dá 403; admin excluindo aluno, 200; admin excluindo professor, 200, e o professor some das aulas futuras e de diretorio_perfis; alvo admin, 403. Conferir em audit_log uma linha com actor_id do admin.

### Passo 6

Só se a decisão 1 for 'entra': Edge Function admin-update-user-email. Exige admin; corpo {userId, email}; e-mail com trim, minúsculas e isValidEmail equivalente; alvo existe e não está anonimizado; chama auth.admin.updateUserById(userId, {email, email_confirm:true}); e-mail já usado dá 409 'Este e-mail já está cadastrado'.

_Arquivos:_ `supabase/functions/admin-update-user-email/index.ts`

**Como verificar:** Curl local: depois da troca, o login funciona com o e-mail novo e é recusado com o antigo; e-mail duplicado dá 409; aluno chamando dá 403.

### Passo 7

Camada de serviço no app. updateStudentByAdmin(studentId, antes: Profile, depois: StudentAdminInput) monta o payload só com os campos alterados, CPF e celular só com dígitos, nascimento em ISO, e envia deactivated_at somente quando o status muda. Novas funções: fetchUserEmail (rpc), updateUserEmail, deleteMyAccount(senha) e deleteUserAccount(userId) (functions.invoke, nunca from('profiles').delete), exportMyData (rpc) e fetchManagedProfiles (role in user, admin, sem alterar fetchAllStudents, que o financeiro usa). Um helper lerMensagemDaFuncao lê error.context (Response do FunctionsHttpError) e devolve o campo 'error' do JSON, com describeError como alternativa.

_Arquivos:_ `src/services/profile.service.ts`, `src/lib/functionsError.ts`, `src/services/__tests__/profile.service.test.ts`, `src/lib/__tests__/functionsError.test.ts`

**Como verificar:** `npx jest src/services src/lib` verde, com novos casos: payload só com diferenças; status sem mudança não envia deactivated_at; trancar envia a data; 23505 profiles_cpf_key é propagado; deleteMyAccount envia a confirmação exata e a senha; deleteUserAccount não chama from('profiles').delete; erro de função vira mensagem legível.

### Passo 8

Validação do formulário em função pura validarFormularioDeAluno(valores, {pendente}). Para perfil já integrado, nome (isValidName) e CPF com dígitos verificadores (isValidCpf) são obrigatórios, por causa da constraint profiles_complete_when_onboarded. Para perfil pendente, nome e CPF não são editáveis (decisão 7). Celular e nascimento são opcionais, mas precisam ser válidos se preenchidos. E-mail passa por isValidEmail. A unicidade do CPF NÃO é checada antes do envio, para evitar condição de corrida: fica a cargo da UNIQUE do banco e da mensagem de errors.ts:100-102.

_Arquivos:_ `src/utils/studentForm.ts`, `src/utils/__tests__/studentForm.test.ts`

**Como verificar:** Os testes cobrem: dígito verificador errado; 111.111.111-11; celular com 9 dígitos; data futura; opcionais vazios aceitos; perfil pendente sem nome aceito.

### Passo 9

Componente ConfirmarExclusaoSheet, usando BottomSheet via Portal e não Modal (padrão do projeto por causa do teclado em edge-to-edge). Mostra o que é apagado e o que é mantido e por quê, o aviso de mensalidades em aberto (recebe a contagem, decisão 3), o campo 'digite EXCLUIR' e o campo de senha no modo titular. O botão destrutivo fica desabilitado até a confirmação e mostra carregando e erro.

_Arquivos:_ `src/components/ConfirmarExclusaoSheet.tsx`, `src/components/__tests__/ConfirmarExclusaoSheet.test.tsx`

**Como verificar:** Testes: botão desabilitado sem EXCLUIR; no modo senha, desabilitado sem senha; onConfirm chamado uma única vez; erro exibido; rótulos de acessibilidade conforme docs/A11Y.md.

### Passo 10

Tela EditarAluno, na rota EditarAluno: {userId}. Campos: nome, CPF (maskCpf), celular (maskPhone), nascimento (maskDate), turma (GroupPicker), plano (PlanPicker) e situação (SegmentedControl Ativo/Trancado). O e-mail (decisão 1) tem botão próprio 'Alterar e-mail', com confirmação. Salvar passa por validarFormularioDeAluno e updateStudentByAdmin; erros via describeError. Numa 'Zona de perigo', 'Excluir conta (LGPD)' conta as mensalidades open e overdue, abre o ConfirmarExclusaoSheet, chama deleteUserAccount e volta para a lista. Com alvo admin, o botão some e aparece o aviso 'rebaixe antes'.

_Arquivos:_ `src/screens/dados/EditarAlunoScreen.tsx`, `src/navigation/types.ts`, `src/navigation/DadosStackNavigator.tsx`

**Como verificar:** `npm run typecheck`. No APK DEV: editar nome, CPF e celular e ver os valores mantidos depois de recarregar; CPF de outro aluno mostra 'Este CPF já está cadastrado em outra conta.'; excluir um aluno de teste e ver que o login dele é recusado.

### Passo 11

Ajustes em GerenciarAlunos: tocar no cartão ou num ícone de lápis (com accessibilityLabel) abre EditarAluno; a lista recarrega ao voltar (useFocusEffect); perfis com anonymized_at preenchido ficam ocultos; o filtro 'Admins' é corrigido usando fetchManagedProfiles.

_Arquivos:_ `src/screens/dados/GerenciarAlunosScreen.tsx`

**Como verificar:** O chip Admins lista os administradores; um aluno excluído não aparece mais; o histórico financeiro (HistoricoPagamentosAlunosScreen) continua mostrando 'Usuário removido'.

### Passo 12

Autoexclusão e exportação. Na seção CONTA de DadosScreen (linhas 448-464), adicionar 'Exportar meus dados' (decisão 6: exportMyData e Share.share com o JSON). Para quem não é admin, adicionar 'Excluir minha conta', que abre ExcluirContaScreen: explica o que é apagado e o que é mantido, avisa sobre débito, sugere exportar antes, abre o ConfirmarExclusaoSheet com senha e, no sucesso, chama deleteMyAccount, mostra um Alert final e faz signOut. Para admin, mostrar o texto 'contas de administrador são removidas por outro administrador'. No AuthProvider, se o perfil carregado tiver anonymized_at preenchido, fazer signOut; é a defesa para o caso de a etapa do Auth ter falhado.

_Arquivos:_ `src/screens/dados/ExcluirContaScreen.tsx`, `src/screens/dados/DadosScreen.tsx`, `src/navigation/types.ts`, `src/navigation/DadosStackNavigator.tsx`, `src/context/AuthProvider.tsx`

**Como verificar:** No APK DEV com aluno de teste: o JSON exportado contém perfil, presencas, pagamentos, frequencia_mensal e justificativas; excluir com senha errada é recusado; com a senha certa o app sai da conta e o login seguinte é recusado. Os 324 testes existentes e os novos passam com `npx jest`.

### Passo 13

Retenção do P-11, só depois da decisão 8. Criar a coluna academy_settings.proof_retention_days smallint (nulo = desligado; CHECK >= 30), já com o valor decidido. Criar enfileirar_comprovantes_expirados() returns integer, SECURITY DEFINER, só para service_role: enfileira com motivo 'retencao_expirada' os pagamentos com status 'paid', paid_at < now() - dias e proof_provider não nulo, e limpa os ponteiros (a guarda do passo 2a evita duplicata). Agendar com cron.schedule('expire-payment-proofs','30 2 * * *'), antes do worker da Render às 03:00. Não tocar em pending_approval, open ou overdue.

_Arquivos:_ `supabase/migrations/20260917130000_retencao_comprovantes.sql`, `supabase/tests/regressao_lgpd_exclusao.sql`

**Como verificar:** Novos casos no teste SQL: pago antigo entra na fila; pago recente, pendente e aberto não entram; nenhuma duplicata. No local, `select jobname, schedule from cron.job` lista o job. A tela do comprovante já trata pagamento sem arquivo (ComprovanteScreen.tsx:86-89).

### Passo 14

Documentação. docs/EDGE-FUNCTIONS.md: novo contrato de delete-my-account (senha e idempotência) e as funções delete-user-account e admin-update-user-email; registrar também create-staff, que hoje não aparece. docs/MANUAL-DO-ADMINISTRADOR.md: seção 4 (editar e excluir aluno) e correção da seção 8 (linhas 203-207). docs/FUNCIONALIDADES.md:87 passa para [x]. docs/RUNBOOK.md: deploy com --project-ref explícito. No snake-server, em branch e PR próprios: corrigir docs/BACKEND.md:225-227 e docs/PENDENCIAS.md:220, que afirmavam que a função já chamava eliminar_comprovantes_do_titular, e registrar o prazo decidido no P-11.

_Arquivos:_ `docs/EDGE-FUNCTIONS.md`, `docs/MANUAL-DO-ADMINISTRADOR.md`, `docs/FUNCIONALIDADES.md`, `docs/RUNBOOK.md`, `../snake-server/docs/PENDENCIAS.md`, `../snake-server/docs/BACKEND.md`

**Como verificar:** `git diff --stat` mostra só documentação coerente com o código; grep sem valores de segredo nem senha padrão nos textos novos.

### Passo 15

Gate e publicação, somente com autorização explícita do usuário. Commits passam pelo husky (typecheck + jest). Push e PR para a main entram no fluxo de T4, nunca com force push. Em produção, nesta ordem: (1) `npx supabase migration list` para confirmar que só as 2 migrations novas estão pendentes, depois `npx supabase db push`; (2) `npx supabase functions deploy delete-my-account delete-user-account admin-update-user-email --project-ref <ref de produção>`; (3) gerar o APK pelo fluxo de assinatura e versão das outras tarefas. Nenhum teste SQL nem exclusão de conta de teste em produção: esses testes ficam no ambiente DEV.

**Como verificar:** `npx supabase migration list` sem pendências; o painel de Edge Functions mostra a data do novo deploy; no APK de produção, abrir EditarAluno carrega os dados. Nenhuma conta real é excluída para teste.

## 6. Riscos

- A anonimização é irreversível. Teste só no ambiente DEV e confira o backup antes do deploy.
- A CLI está linkada à produção (supabase/.temp/project-ref): um `functions deploy` ou `db push` distraído publica direto. Use sempre --project-ref explícito e só com autorização.
- Os registros retidos (pagamentos, presenças, audit_log) continuam ligados ao uuid. Cruzados com o extrato bancário (nome do pagador, valor, data), podem reidentificar a pessoa: na prática são dados pseudonimizados e devem ficar com acesso restrito.
- Ainda não verificado: auth.identities.identity_data e auth.audit_log_entries podem guardar o e-mail original depois da troca pela Admin API. Conferir no stack local (passo 4) e, se guardarem, avaliar a limpeza, já que é schema gerenciado pela Supabase.
- A eliminação real dos arquivos depende do Cron pago da Render. Se ele não existir, a fila só cresce, e a exclusão fica prometida sem ser cumprida.
- O access token de quem foi banido continua válido até expirar (jwt_expiry = 3600 em supabase/config.toml:27). O signOut global na autoexclusão e o bloqueio no AuthProvider reduzem o problema no próprio aparelho, mas não o eliminam.
- O ajuste no gatilho de comprovante mexe no fluxo de recusa que já está em produção; ele é coberto pelo T13 do teste novo e pela regressão existente.
- Mudar o contrato de delete-my-account (senha obrigatória) não quebra nenhum APK publicado, porque nenhum chama a função (grep em src/ vazio).
- Mensalidades em aberto de contas removidas continuam contando na inadimplência (decisão 3, opção A); o dashboard e os relatórios precisam separá-las.
- Fora do escopo, registrado: as Edge Functions usam 'a senha padrão' fixo, enquanto a gestão mostra a senha configurável (reset-student-password/index.ts:20; GerenciarAlunosScreen.tsx:70).
- Suposições não verificadas: T1 é a tarefa do ambiente DEV local; o contêiner do banco local se chama supabase_db_snake-thai; a versão publicada de delete-my-account é igual à do repositório.

## 7. Ajustes do revisor crítico

- **Conflito com T1, T6, T8, T9:** A T1 move a stack local para as portas 553xx (API 55321, DB 55322) porque o radar-tributario ocupa as 543xx. As outras tarefas assumem as portas antigas: T7 ('API em 127.0.0.1:54321', curl em 54321), T8 ('adb reverse tcp:54321'), T9 (psql do host em 54322, vault push_project_url 'http://host.docker.internal:54321', 'supabase status mostra 54321/54322'). A T9 também usa psql no host, que não está instalado.  
  **Resolução:** Depois da T1, trocar em todos os planos para 55321/55322. Rodar SQL sempre por 'docker exec -i supabase_db_snake-thai psql' ou pelos subcomandos do scripts/db-dev. Na T9, o Vault local usa 'http://host.docker.internal:55321' ou o nome do container Kong com a porta interna 8000. Na T8, o adb reverse passa para tcp:55321.
- **Conflito com T1, T6, T8:** Não há um jeito único de rodar os testes e as seeds locais. A T1 (passo 4) roda a suíte com 'db reset --local' e só o seed.sql, sem demo. A T8 (passos 1 e 4) semeia a demo e roda as 6 regressões com os dados de demo carregados. T6 e T7 (passo 1) exigem as 6 regressões verdes como linha de base, mas regressao_c3_payment_whitelist.sql falha hoje e só a T1 (passo 4) a corrige. A T8 (passo 1) roda demo_seed.sql direto, e ele depende de contas @snake.com, turmas e plano que só o local_base.sql da T1 (passo 5) cria. A T6 (passo 11) reescreve a seção 8 do demo_seed.sql, onde a T1 (passo 5) coloca uma trava.  
  **Resolução:** T6, T7 e T8 começam só depois dos passos 2 a 5 da T1. Entrada única: 'scripts\db-dev test' para a suíte (banco limpo) e 'scripts\db-dev reset' para as seeds. Testes novos usam UUIDs próprios e deltas, para passar nos dois estados. A edição da T6 no demo_seed.sql é feita em cima da versão com a trava da T1.
- **Conflito com T1, T6, T8, T9:** A publicação em produção não segue o fluxo novo. T6 (passo 14), T7 (passo 15) e T9 (passo 18) chamam 'supabase db push' direto, sem o script com dupla confirmação da T1; a CLI está linkada à produção e 'db push' usa o projeto linkado por padrão. A T7 fixa timestamps (20260917120000, 20260917130000) enquanto as outras usam 'migration new'. Uma migration criada depois mas com timestamp menor que a última aplicada no remoto faz o 'db push' recusar, exigindo --include-all. Ninguém prevê backup antes de cada push.  
  **Resolução:** Todo push de migration em produção passa por scripts\db-push-prod.bat (T1, passo 12), antecedido por 'npx supabase db dump --linked' para fora do repositório, feito pelo usuário. Os timestamps são gerados ('migration new' ou renomeação) no rebase final, logo antes do merge de cada tarefa, na ordem de integração T7 → T6 → T8 → T9. Nunca usar --include-all em produção sem revisão.
- **Conflito com T6:** Um professor anonimizado continua sendo escalado em aulas futuras. A T7 remove o professor só de class_teachers das aulas futuras e mantém role='professor'. A T6 cria class_schedule_teachers, e gerar_aulas_da_grade (cron diário) copia os professores do horário com join em profiles.role='professor', sem filtrar anonymized_at. Na geração seguinte o professor volta às aulas futuras. O diretório e os avisos da T9 também passariam a mirar esse perfil.  
  **Resolução:** Na T6, a geração filtra 'p.anonymized_at is null and p.status = ''active'''. Se a T7 entrar primeiro, a migration da T6 também atualiza anonimizar_titular para apagar class_schedule_teachers do titular. Se a T6 entrar primeiro, isso fica na migration da T7. Incluir um caso de regressão nas duas.
- **Conflito com T9, T11:** A exclusão LGPD não cobre os dados novos das outras tarefas. export_my_data (T7) não inclui push_devices nem notification_outbox (T9), que são dados pessoais. O rascunho de chamada (T11) só é apagado se a autoexclusão da T7 passar por authService.signOut.  
  **Resolução:** Se a T9 já estiver integrada, a T7 inclui push_devices no export. Senão, a T9 estende export_my_data. O ExcluirContaScreen da T7 encerra a sessão por AuthProvider.signOut → authService.signOut, caminho que apaga os rascunhos (T11) e o token do aparelho (T9).
- **Conflito com T6, T8, T9, T10, T11:** Os mesmos arquivos do app são alterados em paralelo: DadosScreen.tsx (T6 linha Turmas, T7 exportar/excluir, T9 switch de notificações, T10 diagnóstico); navigation/types.ts e os StackNavigators (T6, T7, T8, T9); AuthProvider.tsx (T7 signOut se anonimizado, T9 remove dispositivo, T10 usuário de monitoramento); FrequenciaScreen.tsx (T6 somente leitura em turma arquivada, T11 move o estado do rascunho para o hook); GerenciarAlunosScreen/GroupPicker (T6 e T7); App.tsx (T1, T9, T10); jest.setup.js (T9, T10); logger.ts (T10, e a T11 introduz log.warn).  
  **Resolução:** Integrar em série, na ordem recomendada, com cada branch nascendo da main atualizada e rebaseada depois de cada merge. A T11 entra antes da T6 (a refatoração de FrequenciaScreen é maior) e a T7 antes da T6 (GerenciarAlunos). Na T10, log.warn vira só breadcrumb, o que atende ao uso que a T11 faz.
- **Afirmação a conferir:** O container do banco local se chama 'supabase_db_snake-thai'.  
  **Por quê:** Só existe o volume supabase_db_snake-thai; nenhum container do projeto está rodando (docker ps -a da T1). O nome segue o padrão da CLI e é provável, mas nenhum plano confirmou. Todos os comandos 'docker exec' dependem disso.
- **Afirmação a conferir:** Fila de eliminação duplicada ao excluir conta (eliminar_comprovantes_do_titular insere e o UPDATE seguinte dispara o gatilho com motivo 'comprovante_recusado').  
  **Por quê:** Confirmado nesta revisão, não é dúvida: 20260831120000_proofs_cloudinary_contract.sql:153-172 (o gatilho enfileira quando old.proof_provider não é nulo e os novos ponteiros são nulos) e :211-231 (insert seguido de update que zera todos os proof_*). delete-my-account/index.ts não tem nenhuma chamada rpc (grep vazio). Registrado aqui para que a correção não seja tratada como hipótese.
- **Decisão consolidada (T7):** Exclusão de conta, e-mail editável, débitos e prazo de guarda dos comprovantes (P-11).  
  **Recomendação:** Aluno e professor se autoexcluem com senha. O admin exclui aluno e professor; conta admin precisa ser rebaixada antes. E-mail editável pelo admin. Débitos mantidos. Justificativas apagadas. Imagem do comprovante guardada 90 dias após paid_at e registro do pagamento por 5 anos mais o exercício seguinte, com confirmação do contador ou advogado.
- **Decisão consolidada (T7 + T9 + T10):** Atualização da Política de Privacidade.  
  **Recomendação:** Uma única nova versão em legal_documents, cobrindo exclusão e retenção (T7), push com Expo e Google (T9) e Sentry (T10), aprovada pelo usuário antes do release que traz a primeira dessas funcionalidades.

## 8. Definição de pronto

- [ ] Todos os passos executados, com a verificação de cada um registrada
- [ ] Typecheck e testes (Jest e, quando houver, regressão SQL no banco LOCAL) verdes
- [ ] Comportamento conferido de verdade (aparelho ou banco local), nunca só "compilou"
- [ ] Nenhum segredo no Git; nada executado em produção sem confirmação explícita
- [ ] Commits atômicos em Conventional Commits; PR com merge commit
- [ ] Documentação atualizada (README/FUNCIONALIDADES/manual, conforme o caso)
- [ ] `docs/planos/ENTREGA-T7.md` escrito
