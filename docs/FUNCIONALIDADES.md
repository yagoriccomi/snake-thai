# Mapa de Funcionalidades — Autogestão pelo Administrador

> **Objetivo deste documento:** listar tudo que o app precisa ter para que o
> **cliente que compra o sistema opere sozinho**, sem depender do desenvolvedor.
> Serve como checklist de execução: marque `[x]` conforme cada item for entregue.
>
> Legenda de estado: **OK** = pronto · **BANCO OK** = esquema pronto, falta a interface
> · **PARCIAL** = existe incompleto · **FALTA** = não existe
> Marcadores: `[x]` concluído · `[~]` fundação de dados pronta, aguardando UI · `[ ]` não iniciado
> Prioridade: **P0** trava a venda · **P1** esperado pelo cliente · **P2** diferencial

---

## A. Identidade e marca (white-label)

Sem esta camada vende-se "o Snake Thai", não um produto replicável.

- [~] **P0** Nome, logo e cores da academia — tabela `academy_settings`; falta a UI ler dela · BANCO OK
- [~] **P0** Textos legais versionados — `legal_documents` + `consents` com prova de aceite · BANCO OK
- [~] **P0** Chave PIX configurável — `academy_settings.pix_key` · BANCO OK
- [ ] **P1** Dados de contato, endereço e redes sociais · FALTA

## B. Pessoas — alunos e equipe

- [x] Cadastrar aluno (Edge Function `create-student`) · OK
- [x] Listar alunos e trocar turma · OK
- [x] Redefinir senha do aluno para a padrão (Edge Function `reset-student-password`) · OK
- [ ] **P0** Editar dados do aluno pelo admin · FALTA
- [~] **P0** Desativar / reativar aluno — `profiles.status` + `deactivated_at` · BANCO OK
- [ ] **P0** Excluir aluno com apagamento LGPD · FALTA
- [~] **P0** Promover / rebaixar admin — trava do último admin ativa no banco; falta a UI · BANCO OK
- [ ] **P1** Busca, filtro e ordenação na lista de alunos · FALTA
- [ ] **P1** Ficha do aluno (histórico de presença + financeiro consolidado) · FALTA
- [ ] **P1** Papéis intermediários (professor, recepção) · FALTA
- [ ] **P2** Foto, contato de emergência, responsável para menores · FALTA
- [ ] **P2** Importação de alunos em massa (CSV) · FALTA

## C. Turmas e agenda

- [x] Criar turma · OK
- [x] Criar aula avulsa · OK
- [x] Lançar presença pelo admin · OK
- [ ] **P0** Renomear / excluir turma — hoje só existe criação · PARCIAL
- [ ] **P0** Aulas recorrentes (grade semanal fixa em vez de aula a aula) · FALTA
- [ ] **P1** Capacidade máxima e professor responsável por turma · FALTA
- [ ] **P1** Cancelar/remarcar aula e calendário de feriados · FALTA
- [ ] **P2** Check-in pelo próprio aluno · FALTA
- [ ] **P2** Lista de espera e limite de vagas · FALTA

## D. Financeiro

> **Buraco crítico:** a tabela `payments` **não tem campo de valor**, e `plan_id`
> referencia uma tabela `plans` que **não existe**. O sistema sabe QUEM deve e
> QUANDO vence, mas não QUANTO. É mudança de esquema — precede qualquer UI.

- [x] Aprovar / recusar comprovante PIX · OK
- [~] **P0** Planos com preço e periodicidade — tabela `plans` criada com RLS; falta a UI · BANCO OK
- [~] **P0** Campo de valor no pagamento — `payments.amount_cents` + FK real para `plans` · BANCO OK
- [~] **P0** Dia de vencimento configurável — `plans.due_day` e `academy_settings.default_due_day` · BANCO OK
- [ ] **P0** Geração automática das mensalidades — hoje o cron só marca atraso · PARCIAL
- [ ] **P0** Relatório de inadimplência e faturamento · FALTA
- [ ] **P1** Descontos, bolsas e isenções · FALTA
- [ ] **P1** Multa e juros por atraso · FALTA
- [ ] **P1** Recibo para o aluno · FALTA
- [ ] **P1** Exportação (CSV/PDF) para o contador · FALTA

## E. Comunicação

- [ ] **P1** Mural de avisos · FALTA
- [ ] **P1** Push de vencimento e atraso · FALTA
- [ ] **P2** Mensagem direcionada por turma · FALTA

## F. Painel e relatórios

- [ ] **P0** Dashboard do admin (alunos ativos, receita do mês, inadimplência, frequência) · FALTA
- [ ] **P1** Relatório de frequência e evasão · FALTA

## G. Governança, LGPD e continuidade

- [x] **P0** Exportar dados do titular — função `export_my_data()` respeitando RLS · OK
- [ ] **P0** Excluir conta — direito ao esquecimento · FALTA
- [x] **P0** Log de auditoria — `audit_log` + trigger em profiles/payments/plans/settings · OK
- [~] **P1** Consentimento versionado — tabela `consents` por versão de documento · BANCO OK
- [ ] **P1** Backup testado periodicamente (não basta agendar) · FALTA

## H. Configurações do sistema

- [~] **P1** Senha padrão configurável — `academy_settings.default_student_password` · BANCO OK
- [ ] **P2** Política de exigir biometria para administradores — hoje é escolha individual · PARCIAL

---

## Experiência e interface

- [ ] **P0** Redesenho profissional (hierarquia visual, densidade, estados vazios, feedback de erro) sem sacrificar usabilidade
- [ ] **P1** Acessibilidade sobre a interface nova (leitores de tela, foco, contraste, alvo de toque)

---

## Placar

| Bloco | Itens | Prontos |
| --- | --- | --- |
| A. Marca | 4 | 0 |
| B. Pessoas | 12 | 3 |
| C. Turmas e agenda | 9 | 3 |
| D. Financeiro | 10 | 1 |
| E. Comunicação | 3 | 0 |
| F. Painel | 2 | 0 |
| G. Governança | 5 | 0 |
| H. Configurações | 2 | 0 |
| UI/UX | 2 | 0 |
| **Total** | **49** | **7** |

**20 itens P0.** Os três de maior peso: **planos e valores** (sem eles não há
produto vendável), **gestão de papéis** (hoje o cliente depende do dev para
promover um sócio) e **auditoria/LGPD** (risco jurídico ao comercializar).
