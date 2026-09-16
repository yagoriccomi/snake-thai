# ENTREGA — T7: editar aluno e exclusão de conta (LGPD)

| Campo | Valor |
|---|---|
| **Tarefa** | `T7` |
| **Plano** | [`PLANO-T7.md`](PLANO-T7.md) |
| **Modo** | 🔁 Loop |
| **Data** | 2026-09-16 |
| **Branch / PR** | `feat/editar-aluno-lgpd` · `snake-server` #16 (correção da documentação) |
| **Status** | 🟡 Pronto e testado no ambiente local; **nada publicado em produção** (migrations e funções dependem da sua aprovação) |

---

## 1. O que foi feito

- **O admin edita o aluno** pelo app: nome, CPF, celular, nascimento, turma, plano,
  situação e o e-mail de login.
- **A conta pode ser excluída** pelo próprio aluno ou professor (com a senha) ou pelo
  admin. Tudo numa única transação no banco, que também corrige três falhas que
  existiam:
  1. as imagens dos comprovantes ficavam no provedor depois da exclusão;
  2. as justificativas de falta (texto e anexo) ficavam para trás;
  3. cada comprovante entrava duas vezes na fila de eliminação.
- **A pessoa exporta os próprios dados** antes, se quiser.
- **O prazo de guarda das imagens de comprovante** ficou pronto, mas desligado.

## 2. O que mudou

| Onde | Mudança |
|---|---|
| `supabase/migrations/…_lgpd_exclusao_de_conta.sql` | `anonimizar_titular()` (transação, idempotente, só servidor); fila sem duplicata; `export_my_data` com frequência mensal e justificativas; `email_do_usuario` (admin); `email_ja_cadastrado` (servidor); fim do DELETE em `profiles` pelo app |
| `supabase/migrations/…_retencao_comprovantes.sql` | `academy_settings.proof_retention_days` (nulo = desligado, mínimo 30) e varredura diária às 02:30 |
| `supabase/tests/regressao_lgpd_exclusao.sql` | 23 casos |
| `supabase/functions/_shared/` | `anonimizar-conta.ts` (banco + Auth) e `http.ts` |
| `supabase/functions/delete-my-account` | Senha conferida no servidor; usa a transação; derruba as sessões |
| `supabase/functions/delete-user-account` (nova) | Admin exclui aluno ou professor |
| `supabase/functions/admin-update-user-email` (nova) | Admin corrige o e-mail de login |
| `src/services/profile.service.ts`, `src/lib/functionsError.ts`, `src/utils/errors.ts` | Serviços; mensagem do servidor chega à tela |
| `src/utils/studentForm.ts`, `src/utils/payments.ts` | Validação do formulário; contagem de mensalidades em aberto |
| `src/components/ConfirmarExclusaoSheet.tsx`, `Button` (`danger`) | Confirmação da exclusão |
| `src/screens/dados/EditarAlunoScreen.tsx`, `ExcluirContaScreen.tsx`, `src/hooks/useExportarMeusDados.ts` | Telas e exportação |
| `DadosScreen`, `GerenciarAlunosScreen`, navegação, `AuthProvider` | Botões novos, lápis de edição, filtro "Admins" corrigido, excluídos ocultos, saída se o perfil estiver anonimizado |
| Docs (`EDGE-FUNCTIONS`, `MANUAL-DO-ADMINISTRADOR`, `RUNBOOK`, `FUNCIONALIDADES`; `snake-server` `BACKEND`/`PENDENCIAS`) | Contratos, manual e correção da afirmação falsa |

## 3. Como validar (local)

1. `scripts\db-dev test` → inclui `regressao_lgpd_exclusao.sql` (23 "OK").
2. `scripts\db-dev stop`, `start`, `reset` e o roteiro de `curl` descrito na seção 4.
3. No app DEV: Gerenciar Alunos → lápis → editar e salvar; trocar e-mail; excluir um aluno de teste. Em Dados: exportar; com a conta de aluno, excluir com senha errada (recusa) e certa (sai da conta; login seguinte recusado).

## 4. Verificações executadas

- [x] 29 migrations aplicam do zero; suíte SQL completa verde (7 arquivos)
- [x] Regressão LGPD: perfil anonimizado; pagamentos preservados sem imagem; 1 item por arquivo na fila com o motivo certo; justificativa apagada e anexo enfileirado; consentimentos apagados; presenças mantidas; auditoria com quem pediu; idempotência; admin recusado; professor só sai das aulas futuras e mantém a cor; export completo e só do titular; admin edita e CPF repetido é recusado; aluno não troca o próprio CPF nem vê e-mail alheio; DELETE em perfil negado; retenção desligada por padrão, só o pago antigo, sem duplicata, mínimo de 30 dias
- [x] Edge Functions no Supabase local (`curl`): `delete-my-account` 401/400/401 (senha)/403 (admin)/200; `admin-update-user-email` 403/400/409 (duplicado)/200 e login com o e-mail novo; `delete-user-account` 403/400 (si mesmo)/404/200/200 `ja_anonimizado`; depois da exclusão: login recusado, e-mail aleatório com banimento, e-mail original fora de `auth.identities`, nenhuma sessão, 6 pagamentos intactos, professor fora das aulas futuras, auditoria com o admin
- [x] Jest: 520 testes (serviços, validação, folha de confirmação, `Button` danger, exportação, `EditarAlunoScreen`); typecheck verde
- [ ] Teste no celular com o app DEV — celular não conectado

## 5. ⚠️ Premissas assumidas (revisar)

| # | Premissa | Por quê | Como mudar se estiver errada |
|---|---|---|---|
| P1 | E-mail editável pelo admin | E-mail digitado errado deixava a conta inacessível | Remover o bloco "E-mail de login" |
| P2 | Aluno e professor se autoexcluem; admin exclui aluno e professor; admin precisa ser rebaixado | Pedido simples para o titular sem perder o controle do sistema | `anonimizar_titular` e as funções |
| P3 | Mensalidades em aberto continuam existindo (aviso na tela) | Menos destrutivo; condicionar a exclusão ao pagamento é juridicamente frágil | — |
| P4 | Justificativas apagadas | Texto livre pode ter dado de saúde | Trocar o DELETE por anonimização do texto |
| P5 | Autoexclusão exige a senha, conferida no servidor | Celular desbloqueado não apaga a conta | — |
| P6 | "Exportar meus dados" entra junto | Oferecer cópia antes de excluir | — |
| P7 | Nome e CPF travados para aluno pendente | Não muda o onboarding | — |
| **P8** | **Prazo de guarda dos comprovantes criado DESLIGADO** (e não com 90 dias, como o plano recomendava) | Ligar apaga arquivos reais de produção; o número é decisão da academia (e do contador/advogado) | `update academy_settings set proof_retention_days = 90;` depois da migration aplicada |

## 6. Decisão visual

Mockup: não. As telas seguem os padrões existentes (formulário do CadastrarAluno, grupos
do Perfil, folha inferior da justificativa). A `design-de-interface-projeto` definiu:
- variante `danger` do botão (contorno e texto em `error`, que já passa AA);
- zona de perigo separada no fim da edição;
- folha com listas curtas do que é apagado e do que fica;
- estados de carregando, erro, "não encontrado" e "excluída";
- mensagens do servidor mostradas como vieram, sem detalhe técnico.

## 7. Pendências — ordem de publicação importa

Publicar em produção **nesta ordem**, cada passo com a sua aprovação:

1. 👤 Backup e `scripts\db-push-prod.bat` (aplica as 2 migrations).
2. 👤 `npx supabase functions deploy delete-my-account delete-user-account admin-update-user-email --project-ref <ref>`.
3. Só então gerar e publicar um APK com esta versão. Um APK publicado antes do passo 2 chamaria a `delete-my-account` antiga, que exclui **sem conferir a senha** e sem apagar as imagens.

Outras:
- [ ] 👤 Confirmar na Render se o Cron Job `snakethai-media-cleanup` existe e está ativo — sem ele a fila não é consumida e nenhum arquivo é apagado de fato
- [ ] 👤 Decidir o prazo de guarda (recomendação: 90 dias) e aprovar o texto da Política de Privacidade (exclusão, retenção; junto com Sentry — lacuna L4)
- [ ] 👤 Testar no celular com contas de teste no app DEV
- [ ] Lacuna L1 continua: a senha padrão fixa nas Edge Functions `create-student`, `create-staff` e `reset-student-password`

## 8. Próximo passo

**T6 — grade semanal e turmas.** Se a T6 criar `class_schedule_teachers`, a geração de aulas precisa ignorar professor anonimizado e `anonimizar_titular` precisa limpar a grade (ajuste do revisor).
