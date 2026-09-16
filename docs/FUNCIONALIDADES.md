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

- [x] **P0** Nome, cor e contato da academia — tela `ConfiguracoesScreen` · OK (logo: falta upload)
- [~] **P0** Textos legais versionados — aceite por versão no primeiro acesso, novo aceite a cada versão e leitura em Perfil → Termos e privacidade · APP OK · falta aprovar e publicar os textos ([`legal/`](legal/README.md))
- [x] **P0** Chave PIX configurável — editável e já consumida na tela de pagamento · OK
- [ ] **P1** Dados de contato, endereço e redes sociais · FALTA

## B. Pessoas — alunos e equipe

- [x] Cadastrar aluno (Edge Function `create-student`) · OK
- [x] Listar alunos e trocar turma · OK
- [x] Redefinir senha do aluno para a padrão (Edge Function `reset-student-password`) · OK
- [x] **P0** Editar dados do aluno pelo admin (inclui o e-mail de login) · OK
- [x] **P0** Desativar / reativar aluno — trancar matrícula preservando histórico · OK
- [x] **P0** Excluir aluno com apagamento LGPD · OK
- [x] **P0** Promover / rebaixar admin — botão na lista de alunos, com trava do último admin · OK
- [ ] **P1** Busca, filtro e ordenação na lista de alunos · FALTA
- [ ] **P1** Ficha do aluno (histórico de presença + financeiro consolidado) · FALTA
- [ ] **P1** Papéis intermediários (professor, recepção) · FALTA
- [ ] **P2** Foto, contato de emergência, responsável para menores · FALTA
- [ ] **P2** Importação de alunos em massa (CSV) · FALTA

## C. Turmas e agenda

- [x] Criar turma · OK
- [x] Criar aula avulsa · OK
- [x] Lançar presença pelo admin · OK
- [x] **P0** Controle de frequência (contador, percentual, histórico mensal,
  conclusão da chamada, aviso de aula sem chamada e justificativa de falta) —
  regras em [`FREQUENCIA.md`](FREQUENCIA.md) · FEITO
- [x] Chamada em andamento guardada no aparelho e recuperada ao reabrir o app,
  com aviso de conflito se outra pessoa salvou antes · FEITO
- [x] **P0** Renomear / excluir turma — turma com histórico é arquivada (e pode
  ser reativada), a nunca usada é apagada; o admin escolhe para onde vão os
  alunos · FEITO
- [x] **P0** Aulas recorrentes — grade semanal por turma; as aulas são geradas
  até o fim do mês seguinte e editar/encerrar um horário nunca mexe em aula com
  chamada · FEITO
- [ ] **P1** Capacidade máxima e professor responsável por turma · FALTA
- [ ] **P1** Cancelar/remarcar aula e calendário de feriados · FALTA
- [ ] **P2** Check-in pelo próprio aluno · FALTA
- [ ] **P2** Lista de espera e limite de vagas · FALTA

## D. Financeiro

> **Buraco crítico:** a tabela `payments` **não tem campo de valor**, e `plan_id`
> referencia uma tabela `plans` que **não existe**. O sistema sabe QUEM deve e
> QUANDO vence, mas não QUANTO. É mudança de esquema — precede qualquer UI.

- [x] Aprovar / recusar comprovante PIX · OK
- [x] **P0** Histórico de pagamentos por aluno — lista expansível com anexo, dias de atraso e marcação manual de paga / não paga pelo admin · OK
- [x] **P0** Financeiro geral por mês — seletor de competência com marcador de pendência e categoria "Pagas" · OK
- [x] **P0** Comprovante obrigatório para o aluno — garantido no banco, não só na tela · OK
- [x] **P0** Planos com preço e periodicidade — tela de CRUD em `PlanosScreen` · OK
- [~] **P0** Campo de valor no pagamento — `payments.amount_cents` + FK real para `plans` · BANCO OK
- [x] **P0** Dia de vencimento configurável — por plano e padrão da academia · OK
- [ ] **P0** Geração automática das mensalidades — hoje o cron só marca atraso · PARCIAL
- [x] **P0** Relatório de inadimplência (por aluno e por faixa de atraso) e
  faturamento por competência de 12 meses — regras em [`PAINEL.md`](PAINEL.md) · FEITO
- [ ] **P1** Descontos, bolsas e isenções · FALTA
- [ ] **P1** Multa e juros por atraso · FALTA
- [ ] **P1** Recibo para o aluno · FALTA
- [ ] **P1** Exportação (CSV/PDF) para o contador · FALTA

## E. Comunicação

- [ ] **P1** Mural de avisos · FALTA
- [x] **P1** Push de vencimento e atraso (e comprovante, justificativa e aula sem
  chamada) — regras em [`NOTIFICACOES.md`](NOTIFICACOES.md); chega ao aparelho
  depois de configurar Expo e Firebase · FEITO
- [ ] **P2** Mensagem direcionada por turma · FALTA

## F. Painel e relatórios

- [x] **P0** Dashboard do admin (alunos ativos, receita do mês, inadimplência,
  frequência e alunos em risco de evasão) — aba **Painel** · FEITO
- [ ] **P1** Relatório de frequência e evasão — depende de [`FREQUENCIA.md`](FREQUENCIA.md) · FALTA

## G. Governança, LGPD e continuidade

- [x] **P0** Exportar dados do titular — `export_my_data()` respeitando RLS, com botão em Dados · OK
- [x] **P0** Excluir conta — direito ao esquecimento: pelo titular (com senha) e pelo admin, numa transação no banco · OK
- [x] **P0** Log de auditoria — `audit_log` + trigger em profiles/payments/plans/settings · OK
- [~] **P1** Consentimento versionado — tabela `consents` por versão de documento · BANCO OK
- [ ] **P1** Backup testado periodicamente (não basta agendar) · FALTA

## H. Configurações do sistema

- [x] **P1** Senha padrão configurável — editável e consumida no cadastro e no reset · OK
- [ ] **P2** Política de exigir biometria para administradores — hoje é escolha individual · PARCIAL

---

## Documentação

- [x] **P1** Manual do administrador — `docs/MANUAL-DO-ADMINISTRADOR.md`, passo a passo sem exigir técnica · OK
- [x] **P1** Documentação técnica — arquitetura, edge functions e runbook em `docs/` · OK

## Infraestrutura

- [x] **P1** Esteira de CI (GitHub Actions) — typecheck, 125 testes, gate de licenças e auditoria de CVE a cada push/PR; verde no runner · OK

## Experiência e interface

- [x] **P0** Redesenho profissional — tokens de tipografia/elevação, `Card`, `ErrorState` com retry nas 6 telas de dados e log estruturado · OK
- [x] **P1** Acessibilidade — contraste WCAG AA nas duas paletas com teste de regressão, rótulos e estados anunciados · OK (ver `docs/A11Y.md`)

---

## Placar

| Bloco | Itens | Prontos |
| --- | --- | --- |
| A. Marca | 4 | 0 |
| B. Pessoas | 12 | 3 |
| C. Turmas e agenda | 11 | 7 |
| D. Financeiro | 12 | 7 |
| E. Comunicação | 3 | 1 |
| F. Painel | 2 | 1 |
| G. Governança | 5 | 0 |
| H. Configurações | 2 | 0 |
| UI/UX | 2 | 0 |
| **Total** | **53** | **19** |

**20 itens P0.** Os três de maior peso: **planos e valores** (sem eles não há
produto vendável), **gestão de papéis** (hoje o cliente depende do dev para
promover um sócio) e **auditoria/LGPD** (risco jurídico ao comercializar).
